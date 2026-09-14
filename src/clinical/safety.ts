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

const ALLERGY_SEVERE_PATTERN = /\b(anaphyla\w+|severe|swelling|angioedema)\b/i;
const ALLERGY_RESOLVED_PATTERN = /\b(resolved|outgrown|childhood|no longer)\b/i;

/**
 * Parse a free-text allergy list into structured allergies.
 *
 * "Penicillin - rash" and "Penicillin (anaphylaxis)" mean very different
 * things. Free-text contains() could not tell them apart; this can.
 */
export function parseAllergyList(text: string | undefined | null): Allergy[] {
  if (!text) return [];
  return text
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      // "Penicillin — rash", "Penicillin: rash", "Penicillin (rash)"
      const [substance, reaction] = entry.split(/\s+[—–-]\s+|\s*:\s*|\s*\(([^)]*)\)/);
      return {
        substance: (substance ?? entry).trim(),
        reaction: reaction?.trim() || undefined,
        severity: ALLERGY_SEVERE_PATTERN.test(entry) ? 'severe' : 'unknown',
        certainty: 'unknown',
        status: ALLERGY_RESOLVED_PATTERN.test(entry) ? 'resolved' : 'active',
      } satisfies Allergy;
    })
    .filter(a => a.substance.length > 0);
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
  /** Free-text current medicines, e.g. a tag-input value. */
  medicationsText?: string;
  /** Free-text medical conditions. Contraindications are often conditions. */
  conditionsText?: string;
  /** Structured allergies. Free text is accepted and parsed when omitted. */
  allergies?: Allergy[];
  allergiesText?: string;
  /** Medicine id the pharmacist proposes to supply. */
  proposedMedicineId?: string;
}

export function evaluateSafety(
  protocol: ProtocolDefinition,
  input: SafetyInput,
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  const flags = input.redFlags ?? {};
  const meds = [
    ...parseMedicationList(input.medicationsText),
    ...parseMedicationList(input.conditionsText),
  ];
  const allergies = input.allergies ?? parseAllergyList(input.allergiesText);

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

    for (const flag of proposed.interactionFlags ?? []) {
      const hit = meds.find(m => isActiveStatus(m.status) && matchesTerm(flag, m));
      if (hit) {
        findings.push({
          ruleId: `interaction:${proposed.id}`,
          finding: `${proposed.medicineName} — interaction: ${flag}`,
          severity: 'caution',
          reason: `Recorded "${hit.rawText}" matches the protocol interaction flag "${flag}".`,
          sourceId: proposed.sourceId,
          recommendedAction:
            'Review the interaction and select an alternative agent, or document a rationale and monitor.',
          overridePolicy: 'rationale_required',
        });
      }
    }

    for (const substance of proposed.allergyConflicts ?? []) {
      const allergy = allergies.find(
        a => a.status !== 'resolved' && matchesTerm(a.substance, {
          rawText: substance,
          normalisedName: substance,
          status: 'current',
        }),
      );
      if (!allergy) continue;
      const severe = allergy.severity === 'anaphylaxis' || allergy.severity === 'severe';
      // An allergy to the proposed medicine ITSELF is never overridable.
      // A class/cross-reactivity concern can be reasoned about.
      const sameDrug =
        matchesTerm(proposed.medicineName, {
          rawText: allergy.substance,
          normalisedName: allergy.substance,
          status: 'current',
        }) ||
        (proposed.activeIngredient
          ? matchesTerm(proposed.activeIngredient, {
              rawText: allergy.substance,
              normalisedName: allergy.substance,
              status: 'current',
            })
          : false);
      findings.push({
        ruleId: `allergy:${proposed.id}:${substance}`,
        finding: `Allergy conflict — ${proposed.medicineName} vs recorded ${allergy.substance}`,
        severity: severe ? 'hard_stop' : 'contraindication',
        reason:
          `Recorded allergy to ${allergy.substance}` +
          (allergy.reaction ? ` (reaction: ${allergy.reaction})` : '') +
          ` conflicts with ${proposed.medicineName}.`,
        sourceId: proposed.sourceId,
        recommendedAction: sameDrug
          ? 'Do not supply this medicine. Select an alternative agent under the protocol, or refer to GP.'
          : 'Assess cross-reactivity risk. Select an alternative agent or document a rationale.',
        overridePolicy: sameDrug || severe ? 'non_overridable' : 'rationale_required',
      });
    }
  }

  return findings;
}

/**
 * Stopwords that must never be treated as a drug name when we tokenise a
 * medicine entry to look for it inside a contraindication phrase.
 */
const NAME_STOPWORDS = new Set([
  'with', 'from', 'due', 'the', 'and', 'for', 'that', 'this', 'have', 'has',
  'been', 'using', 'use', 'used', 'severe', 'other', 'others', 'previous',
  'history', 'treatment', 'treated', 'patient', 'known', 'acid', 'tablet',
  'tablets', 'capsule', 'capsules', 'sachet', 'oral', 'dose',
]);

/**
 * Does a recorded medicine relate to a contraindication/interaction phrase?
 *
 * Contraindications are often PHRASES ("Treatment with methotrexate"), so we
 * tokenise the medicine name and look for a whole-word token inside the phrase
 * — never a bare bidirectional substring, which is what caused the old engine
 * to fire on "warfarin stopped 2019".
 */
export function matchesTerm(term: string, med: Medication): boolean {
  const phrase = term.toLowerCase().trim();
  if (!phrase) return false;

  const tokens = [
    ...(med.normalisedName ?? '').toLowerCase().split(/[^a-z0-9]+/),
    ...(med.activeIngredient ?? '').toLowerCase().split(/[^a-z0-9]+/),
  ].filter(tok => tok.length >= 4 && !NAME_STOPWORDS.has(tok));

  return tokens.some(tok => new RegExp(`\\b${escapeRegExp(tok)}\\b`).test(phrase));
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
