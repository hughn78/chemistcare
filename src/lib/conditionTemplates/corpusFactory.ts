/**
 * Corpus factory — derives ConditionTemplate data from the OCR protocol corpus
 * ----------------------------------------------------------------------------
 * Bridge between the immutable Sep 2026 corpus (src/data/protocol-corpus) and
 * the ConditionTemplate contract. Templates built from the corpus here keep a
 * live provenance chain: every red flag, scope rule and treatment they render
 * traces back to a corpus document (file + instrument version + sha256).
 *
 * Scope rules and safety scoring read FROM THE CORPUS:
 *   - age windows come from the instrument's structured age rules;
 *   - red flags are the instrument's own flags (severity + action verbatim);
 *   - treatments are the instrument's pharmacotherapy entries.
 * The pharmacist makes and records every decision — nothing prescribes itself.
 */
import type {
  RedFlagDefinition,
  ScopeRuleDefinition,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';
import {
  getDocsForConditionKey,
  getPayload,
  CORPUS_AS_AT,
  shortSha,
  type CorpusDocumentMeta,
  type CorpusDocumentPayload,
  type CorpusRedFlag,
} from '@/data/protocol-corpus';

// ────────── Document selection ──────────

export interface CorpusDocSelection {
  meta: CorpusDocumentMeta;
  payload: CorpusDocumentPayload;
}

const STATE_PRIORITY = ['VIC', 'QLD', 'NSW', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

/**
 * Pick the best active corpus document for a condition: preferred state
 * first, then non-truncated, then instrument-richness (treatments), then
 * the canonical state order. Repealed instruments never qualify.
 */
export function selectCorpusDoc(conditionKey: string, preferredState?: string): CorpusDocSelection | null {
  const candidates = getDocsForConditionKey(conditionKey).filter(d => d.docType !== 'repealed');
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => {
    const pa = a.state === preferredState ? 0 : 1;
    const pb = b.state === preferredState ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (a.truncated !== b.truncated) return a.truncated ? 1 : -1;
    if (b.counts.treatments !== a.counts.treatments) return b.counts.treatments - a.counts.treatments;
    const sa = STATE_PRIORITY.indexOf(a.state), sb = STATE_PRIORITY.indexOf(b.state);
    if (sa !== sb) return sa - sb;
    return a.file.localeCompare(b.file);
  });
  const meta = ranked[0];
  const payload = getPayload(meta.file);
  return payload ? { meta, payload } : null;
}

/** All active corpus selections for a condition (primary first). */
export function selectCorpusDocs(conditionKey: string, preferredState?: string): CorpusDocSelection[] {
  const metas = getDocsForConditionKey(conditionKey)
    .filter(d => d.docType !== 'repealed')
    .sort((a, b) => {
      const pa = a.state === preferredState ? 0 : 1;
      const pb = b.state === preferredState ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.counts.treatments - a.counts.treatments;
    });
  return metas
    .map(m => ({ meta: m, payload: getPayload(m.file) }))
    .filter((x): x is CorpusDocSelection => Boolean(x.payload));
}

// ────────── Scope rules ──────────

const isUnanswered = (v: unknown) => v === undefined || v === '' || v === null;
const isPositive = (v: unknown) => v === 'yes' || v === true;
const lc = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '');

function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

/**
 * Age-window scope rule derived from the instrument's own structured age
 * rules (e.g. VIC UTI: age `not_in 18-65`). Falls back to explicit
 * min/max when the instrument prints no structured rule.
 */
export function corpusAgeScopeRule(
  payload: CorpusDocumentPayload,
  minAge: number,
  maxAge: number,
  conditionLabel: string,
): ScopeRuleDefinition {
  // Find the instrument's own age window, if printed.
  const ageRules = (payload.red_flags ?? [])
    .map(r => r.structured)
    .filter((s): s is NonNullable<CorpusRedFlag['structured']> =>
      Boolean(s) && s!.parameter.toLowerCase() === 'age');
  const notIn = ageRules.find(r => r.operator === 'not_in' && typeof r.value === 'string');
  let lo = minAge;
  let hi = maxAge;
  let source = 'explicit';
  if (notIn) {
    const m = String(notIn.value).match(/(\d+)\s*(?:[-–to]+\s*(\d+))?/i);
    if (m) {
      lo = parseInt(m[1], 10);
      if (m[2]) hi = parseInt(m[2], 10);
      source = 'instrument';
    }
  }
  return {
    id: 'age_window',
    label: `Age ${lo}–${hi} per ${source === 'instrument' ? 'instrument rule' : 'protocol scope'}`,
    evaluate: (data): ScopeRuleResult | null => {
      const dob = data.dob as string | undefined;
      if (!dob) return { status: 'needs_clarification', reason: 'DOB required to confirm protocol age window' };
      const age = ageFromDob(dob);
      if (age === null) return { status: 'needs_clarification', reason: 'DOB invalid' };
      if (age < lo || age > hi) {
        return { status: 'out_of_scope', reason: `Patient aged ${age} — outside protocol window ${lo}–${hi}` };
      }
      return { status: 'in_scope' };
    },
    __meta: { conditionLabel, instrumentRange: `${lo}-${hi}` },
  } as ScopeRuleDefinition & { __meta?: Record<string, unknown> };
}

/**
 * Standard corpus-derived scope rule: all screening red flags must be
 * answered; any blocking flag positive → out of scope.
 */
export function corpusNoRedFlagsScopeRule(flagIds: readonly string[]): ScopeRuleDefinition {
  return {
    id: 'no_blocking_flags',
    label: 'No blocking red flags (instrument screen)',
    evaluate: (data) => {
      const findings = (data.findings ?? {}) as Record<string, unknown>;
      const unanswered = flagIds.filter(id => isUnanswered(findings[id]));
      if (unanswered.length > 0) {
        return { status: 'needs_clarification', reason: `${unanswered.length} screening item(s) unanswered` };
      }
      const positive = flagIds.filter(id => isPositive(findings[id]));
      if (positive.length > 0) {
        return { status: 'out_of_scope', reason: `${positive.length} red flag(s) positive — outside pharmacist scope` };
      }
      return { status: 'in_scope' };
    },
  };
}

// ────────── Red flags ──────────

function humaniseAction(action: string): string {
  const a = (action || '').toUpperCase();
  if (a.includes('REFER_URGENT') || a.includes('URGENT')) return 'Refer urgently (000/ED if severe)';
  if (a.includes('REFER')) return 'Refer — outside pharmacist prescribing scope';
  if (a.includes('NOT_ELIGIBLE')) return 'Not eligible under this protocol';
  if (a.includes('REVIEW_GP')) return 'Refer to GP for review';
  return action || 'Refer for clinical review';
}

/** Map corpus severity → template severity. */
function mapSeverity(sev: string): 'critical' | 'high' | 'moderate' {
  switch ((sev || '').toLowerCase()) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    default: return 'moderate';
  }
}

/**
 * Every corpus red flag becomes a screening definition (verbatim trigger
 * text + protocol action + severity). Structured temperature/age rules are
 * additionally flagged `structured` so the UI can evaluate them live.
 */
export function corpusRedFlagDefs(payload: CorpusDocumentPayload): {
  ids: string[];
  defs: RedFlagDefinition[];
} {
  const flags = payload.red_flags ?? [];
  const defs: RedFlagDefinition[] = flags.map(rf => {
    const severity = mapSeverity(rf.severity);
    const blocks =
      (rf.action || '').toUpperCase().startsWith('REFER') ||
      (rf.action || '').toUpperCase().includes('NOT_ELIGIBLE') ||
      severity === 'critical';
    return {
      id: rf.id,
      label: rf.trigger_text,
      detail: rf.structured
        ? `Structured rule: ${rf.structured.parameter} ${rf.structured.operator} ${rf.structured.value}${rf.structured.unit ? ' ' + rf.structured.unit : ''}`
        : undefined,
      severity,
      action: `${humaniseAction(rf.action)}${rf.provenance?.page ? ` (protocol p. ${rf.provenance.page})` : ''}`,
      blocksPrescribing: blocks,
      structured: rf.structured ?? undefined,
    } as RedFlagDefinition & { structured?: CorpusRedFlag['structured'] };
  });
  return { ids: flags.map(rf => rf.id), defs };
}

// ────────── Treatments ──────────

function parseQty(s?: string | null): number {
  if (!s) return 1;
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

/** Corpus pharmacotherapy entries → TreatmentOptionDefinition[]. */
export function corpusTreatmentOptions(
  payload: CorpusDocumentPayload,
  opts: { contraindications?: Record<string, string[]>; interactions?: Record<string, string[]> } = {},
): TreatmentOptionDefinition[] {
  const txs = payload.treatments ?? [];
  const defs: TreatmentOptionDefinition[] = txs.map((tx, idx) => {
    const drug = (tx.drug || '').trim() || `Treatment ${tx.id}`;
    const nonPharma = /non-pha|lifestyle|rehydrat|dietary/i.test(drug);
    const name = tx.strength ? `${drug} ${tx.strength}` : drug;
    const notes = (tx.notes || '').trim();
    return {
      id: tx.id.toLowerCase(),
      medicineName: name,
      line: tx.first_line ? 'first' : 'second',
      dose: (tx.dose || tx.strength || (nonPharma ? 'as advised' : '')).trim(),
      frequency: (tx.frequency || (nonPharma ? '—' : 'as directed')).trim(),
      duration: (tx.duration || (nonPharma ? 'ongoing' : 'as per protocol')).trim(),
      maxQuantity: nonPharma ? 0 : (() => {
        const q = tx.quantity_to_supply || tx.max_quantity;
        const parsed = parseQty(q ?? undefined);
        return parsed > 0 ? parsed : 1;
      })(),
      repeats: 0,
      contraindications: opts.contraindications?.[tx.id.toLowerCase()] ?? [],
      cautions: notes ? [notes.slice(0, 180)] : undefined,
      allergyConflicts: nonPharma ? [] : [drug.toLowerCase()],
      interactionFlags: [],
      counsellingPoints: notes ? [notes.slice(0, 180)] : ['Use as directed in the protocol'],
      followUpAdvice: (payload.review_followup?.[0]?.when || undefined)?.slice(0, 160),
      // Alternative defaults to the next first-line option (set below).
      alternativeOptionId: undefined,
      __provenance: tx.provenance ? { page: tx.provenance.page, heading: tx.provenance.section_heading } : undefined,
      __confidence: tx.confidence,
      __firstLineOrder: idx,
    } as TreatmentOptionDefinition & { __provenance?: unknown; __confidence?: string; __firstLineOrder?: number };
  });
  // Link alternatives: for each option, the next first-line option.
  const firstLine = defs.filter(d => d.line === 'first');
  for (const d of defs) {
    const pool = firstLine.length > 1 ? firstLine : defs;
    const other = pool.find(x => x.id !== d.id);
    d.alternativeOptionId = other?.id;
  }
  return defs;
}

// ────────── Shared corpus-driven note generator ──────────

export interface CorpusNoteData {
  patient?: { firstName?: string; lastName?: string; dob?: string; sex?: string; pregnancyStatus?: string };
  findings?: Record<string, unknown>;
  symptomNotes?: string;
  scopeStatus?: string;
  scopeReasons?: string[];
  selectedTreatment?: { medicineName: string; dose: string; frequency: string; duration: string };
  referralNotes?: string;
  followUpPlan?: string;
  safetyNet?: string;
  counsellingDone?: string[];
  pharmacistName?: string;
  conditionName: string;
}

/** SOAP-style progress note generated from corpus instrument context. */
export function corpusNoteGenerator(sel: CorpusDocSelection, conditionName: string) {
  const { ids: _ids, defs } = corpusRedFlagDefs(sel.payload);
  const idToLabel = new Map(defs.map(d => [d.id, d.label]));
  return (data: Record<string, unknown>): string => {
    const d = data as unknown as CorpusNoteData;
    const p = d.patient ?? {};
    const findings = d.findings ?? {};
    const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || '[Patient]';

    const positiveIds = Object.entries(findings)
      .filter(([, v]) => isPositive(v))
      .map(([k]) => k);
    const negativeIds = Object.entries(findings)
      .filter(([, v]) => isNegativeValue(v))
      .map(([k]) => k);
    const label = (k: string) => idToLabel.get(k)?.replace(/[?*]/g, '') ?? k.replace(/_/g, ' ');

    const lines: string[] = [];
    lines.push(`PATIENT: ${fullName}${p.dob ? `, DOB ${p.dob}` : ''}${p.sex ? `, ${p.sex}` : ''}`);
    lines.push('');
    lines.push('PRESENTING COMPLAINT');
    lines.push(
      d.symptomNotes?.trim() ||
        `Patient presents for ${conditionName.toLowerCase()} assessment under pharmacist prescribing protocol.`
    );

    lines.push('');
    lines.push('PROTOCOL SCREENING');
    const positive = positiveIds.map(label);
    const negative = negativeIds.map(label);
    if (positive.length) {
      lines.push(`POSITIVE (${positive.length}): ${positive.map(p => p.slice(0, 120)).join('; ')}.`);
      if (negativeIds.length) lines.push(`Negative for ${negativeIds.length} screened protocol item(s).`);
    } else if (negativeIds.length) {
      lines.push(`Negative for all ${negativeIds.length} screened protocol item(s) (verbatim list in instrument).`);
    } else {
      lines.push('Screening not yet documented.');
    }

    lines.push('');
    lines.push('SCOPE DECISION');
    lines.push(`Status: ${d.scopeStatus ?? 'not assessed'}.`);
    if (d.scopeReasons?.length) d.scopeReasons.forEach(r => lines.push(`• ${r}`));

    lines.push('');
    lines.push('PLAN');
    if (d.selectedTreatment) {
      const t = d.selectedTreatment;
      lines.push(`Supplied/recommended per protocol: ${t.medicineName}, ${t.dose}, ${t.frequency}, ${t.duration}.`);
    } else if (d.scopeStatus === 'out_of_scope') {
      lines.push('Out of scope for pharmacist prescribing — referral recommended.');
      if (d.referralNotes) lines.push(`Referral: ${d.referralNotes}`);
    } else {
      lines.push('No treatment supplied at this time.');
    }
    if (d.followUpPlan) lines.push(`FOLLOW-UP: ${d.followUpPlan}`);
    if (d.safetyNet) lines.push(`SAFETY NET: ${d.safetyNet}`);
    if (d.counsellingDone?.length) {
      lines.push(`COUNSELLING PROVIDED: ${d.counsellingDone.length} item(s) confirmed.`);
    }

    lines.push('');
    lines.push(corpusProvenanceLine(sel));
    lines.push(`Pharmacist: ${d.pharmacistName ?? '[name]'}, ${new Date().toLocaleString('en-AU')}.`);
    return lines.join('\n');
  };
}

function isNegativeValue(v: unknown): boolean {
  return v === 'no' || v === false;
}

export function corpusProvenanceLine(sel: CorpusDocSelection): string {
  const p = sel.payload.protocol;
  const version = sel.meta.instrumentVersion || p.instrument_version || 'v1';
  return `Source instrument: ${sel.meta.title} (${sel.meta.state}) — ${version} · sha256 ${shortSha(
    sel.payload.source.pdf_sha256
  )} · corpus as at ${CORPUS_AS_AT}`;
}

export function corpusJurisdictionProtocolVersion(sel: CorpusDocSelection): string {
  const raw = (sel.meta.instrumentVersion || '').trim();
  return raw ? `${sel.meta.state}-${raw.slice(0, 40)}` : `${sel.meta.state}-corpus-${CORPUS_AS_AT}`;
}

// Corpus payload shape re-export for template files.
export type { CorpusDocumentPayload, CorpusDocumentMeta } from '@/data/protocol-corpus';