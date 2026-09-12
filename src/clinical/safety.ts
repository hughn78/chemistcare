/**
 * Clinical safety engine
 * ----------------------
 * Replaces the previous implementation, which matched medicines with a naive
 * bidirectional substring test:
 *
 *     const matchesMed = m.includes(r) || r.includes(m);
 *
 * That treated free text such as "warfarin stopped 2019" as an ACTIVE
 * interacting medicine and raised a hard blocker. It also produced a
 * "safety score" of `100 - 40*blockers - 10*warnings`, implying a numerical
 * precision the underlying 14 rules did not have.
 *
 * This module instead:
 *   1. normalises free-text medicines into a structured form with a STATUS,
 *   2. emits clinically interpretable findings (hard_stop / contraindication /
 *      refer / caution / monitor / information), each with provenance,
 *   3. attaches an explicit override policy to every finding,
 *   4. summarises by worst severity rather than a fake percentage.
 */

import type {
  Allergy,
  Medication,
  MedicineStatus,
  OverridePolicy,
  ProtocolDefinition,
  RedFlag,
  SafetyFinding,
  SafetySeverity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Medication normalisation
// ─────────────────────────────────────────────────────────────────────────────

const CEASED_PATTERN =
  /\b(stopped|ceased|discontinued|d\/c\b|dc'd|no longer|formerly|previously|ex-|past|old|completed|finished|came off)\b/i;
const PRN_PATTERN = /\b(prn|as needed|as required|when required|when needed|if needed)\b/i;
/** A bare past year, e.g. "warfarin 2019" or "amoxicillin (2021)". */
const PAST_YEAR_PATTERN = /\b(19|20)\d{2}\b/;

const DOSE_PATTERN =
  /\b\d+(\.\d+)?\s?(mcg|mg|g|ml|microgram|milligram|gram|unit|units|iu|%)\b/gi;
const FREQ_PATTERN =
  /\b(once|twice|three times|four times|[a-z]+ times)?\s?(daily|bd|tds|qds|nocte|nightly|weekly|hourly|every \d+ hours?)\b/gi;

export function normaliseMedication(rawText: string): Medication {
  const raw = (rawText ?? '').trim();
  const lower = raw.toLowerCase();

  let status: MedicineStatus = 'current';
  if (CEASED_PATTERN.test(lower)) status = 'ceased';
  else if (PAST_YEAR_PATTERN.test(lower)) status = 'historical';
  if (PRN_PATTERN.test(lower) && status === 'current') status = 'prn';
  if (raw === '') status = 'unknown';

  const strengthMatch = raw.match(DOSE_PATTERN);
  const strength = strengthMatch?.[0]?.trim();

  const normalisedName = raw
    .replace(DOSE_PATTERN, '')
    .replace(FREQ_PATTERN, '')
    .replace(/\((?:stopped|ceased|discontinued)[^)]*\)/gi, '')
    .replace(/[,;]\s*(stopped|ceased|discontinued)[^,;]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    rawText: raw,
    normalisedName: normalisedName || raw,
    strength,
    status,
    codeSystem: 'unmapped',
  };
}

/** Parse a comma/semicolon separated free-text medicine list. */
export function parseMedicationList(text: string | undefined | null): Medication[] {
  if (!text) return [];
  return text
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(normaliseMedication);
}

/** Only these statuses can generate a hard stop or contraindication. */
export function isActiveStatus(status: MedicineStatus): boolean {
  return status === 'current' || status === 'prn';
}

// ─────────────────────────────────────────────────────────────────────────────
// Override policy derived from the protocol, not from intuition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protocol-defined absolute exclusions cannot be overridden by a short text
 * reason. A red flag the protocol sends to ED or to immediate GP review, or
 * one that blocks prescribing outright, is non-overridable.
 * "Treat and refer" findings remain overridable with documented rationale.
 */
export function overridePolicyForRedFlag(flag: RedFlag): OverridePolicy {
  if (flag.outcome === 'emergency_department' || flag.outcome === 'call_emergency') {
    return 'non_overridable';
  }
  if (flag.prescribingBlocked) return 'non_overridable';
  if (flag.outcome === 'treat_and_refer') return 'rationale_required';
  return 'warning_only';
}

export function severityForRedFlag(flag: RedFlag): SafetySeverity {
  switch (flag.outcome) {
    case 'emergency_department':
    case 'call_emergency':
      return 'hard_stop';
    case 'refer_same_day':
    case 'urgent_care':
      return flag.prescribingBlocked ? 'hard_stop' : 'refer';
    case 'refer_routine':
    case 'specialist':
      return flag.prescribingBlocked ? 'contraindication' : 'refer';
    case 'treat_and_refer':
      return 'caution';
    default:
      return 'information';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyInput {
  /** Map of redFlag id -> true (positive), false (negative), undefined (unanswered). */
  redFlags?: Record<string, boolean | undefined>;
  medicationsText?: string;
  allergies?: Allergy[];
  /** Medicine id the pharmacist proposes to supply. */
  proposedMedicineId?: string;
}

export function evaluateSafety(
  protocol: ProtocolDefinition,
  input: SafetyInput,
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  const flags = input.redFlags ?? {};
  const meds = parseMedicationList(input.medicationsText);

  for (const flag of protocol.redFlags) {
    if (flags[flag.id] !== true) continue;
    findings.push({
      ruleId: `redflag:${flag.id}`,
      finding: flag.label,
      severity: severityForRedFlag(flag),
      reason: flag.action,
      sourceId: flag.sourceId,
      recommendedAction: flag.action,
      overridePolicy: overridePolicyForRedFlag(flag),
    });
  }

  // Medicine/allergy checks only apply to the medicine being proposed.
  const proposed = protocol.medicines.find(m => m.id === input.proposedMedicineId);
  if (proposed) {
    for (const ci of proposed.contraindications) {
      const hit = meds.find(
        m => isActiveStatus(m.status) && matchesTerm(ci, m),
      );
      if (hit) {
        findings.push({
          ruleId: `contraindication:${proposed.id}`,
          finding: `${proposed.medicineName} contraindicated — ${ci}`,
          severity: 'contraindication',
          reason: `Recorded medicine "${hit.rawText}" matches protocol contraindication "${ci}".`,
          sourceId: proposed.sourceId,
          recommendedAction:
            'Select an alternative agent under the protocol, or refer to GP if all recommended antibiotics are contraindicated.',
          overridePolicy: 'non_overridable',
        });
      }
    }

    for (const substance of proposed.allergyConflicts ?? []) {
      const allergy = (input.allergies ?? []).find(
        a => a.status !== 'resolved' && a.substance.toLowerCase().includes(substance),
      );
      if (!allergy) continue;
      const severe = allergy.severity === 'anaphylaxis' || allergy.severity === 'severe';
      findings.push({
        ruleId: `allergy:${proposed.id}:${substance}`,
        finding: `Allergy conflict — ${proposed.medicineName} vs recorded ${allergy.substance}`,
        severity: severe ? 'hard_stop' : 'contraindication',
        reason:
          `Recorded allergy to ${allergy.substance}` +
          (allergy.reaction ? ` (reaction: ${allergy.reaction})` : '') +
          ` conflicts with ${proposed.medicineName}.`,
        sourceId: proposed.sourceId,
        recommendedAction: 'Select an alternative agent or refer to GP.',
        overridePolicy: severe ? 'non_overridable' : 'rationale_required',
      });
    }
  }

  return findings;
}

/** Does a medicine entry match a contraindication/interaction phrase? */
function matchesTerm(term: string, med: Medication): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  const name = (med.normalisedName ?? '').toLowerCase();
  const ingredient = (med.activeIngredient ?? '').toLowerCase();
  if (name === t || ingredient === t) return true;
  // Word-boundary containment only — never a bare bidirectional substring.
  const re = new RegExp(`\\b${escapeRegExp(t)}\\b`);
  return re.test(name) || (ingredient ? re.test(ingredient) : false);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<SafetySeverity, number> = {
  hard_stop: 0,
  contraindication: 1,
  refer: 2,
  caution: 3,
  monitor: 4,
  information: 5,
};

export interface SafetySummary {
  worst: SafetySeverity | 'none';
  counts: Record<SafetySeverity, number>;
  /** True when any finding is a hard stop or contraindication. */
  prescribingBlocked: boolean;
  /** Findings that may be overridden with a documented rationale. */
  overridable: SafetyFinding[];
  nonOverridable: SafetyFinding[];
}

export function summariseSafety(findings: SafetyFinding[]): SafetySummary {
  const counts: Record<SafetySeverity, number> = {
    hard_stop: 0,
    contraindication: 0,
    refer: 0,
    caution: 0,
    monitor: 0,
    information: 0,
  };
  for (const f of findings) counts[f.severity] += 1;

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  return {
    worst: sorted.length ? sorted[0].severity : 'none',
    counts,
    prescribingBlocked: counts.hard_stop > 0 || counts.contraindication > 0,
    overridable: findings.filter(f => f.overridePolicy !== 'non_overridable'),
    nonOverridable: findings.filter(f => f.overridePolicy === 'non_overridable'),
  };
}

/** Minimum length for an override rationale. Intentionally not 10 characters. */
export const MIN_OVERRIDE_REASON_LENGTH = 25;

export function canOverride(finding: SafetyFinding, reason: string): boolean {
  if (finding.overridePolicy === 'non_overridable') return false;
  if (finding.overridePolicy === 'warning_only') return true;
  return (reason ?? '').trim().length >= MIN_OVERRIDE_REASON_LENGTH;
}
