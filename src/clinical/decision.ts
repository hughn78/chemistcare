/**
 * Consultation decision engine
 * ----------------------------
 * Turns protocol data + patient answers into a clinical OUTCOME.
 *
 * Referral is a first-class, successful clinical outcome — not a terminal
 * error. A pharmacist deciding not to prescribe is a good consultation.
 */

import { evaluateSafety, summariseSafety } from './safety';
import type {
  Allergy,
  ConsultOutcomeKind,
  ProtocolDefinition,
  ReferralOutcome,
  SafetyFinding,
} from './types';
import type { SafetySummary } from './safety';

export interface DecisionInput {
  /** redFlag id -> true (positive), false (negative), undefined (unanswered). */
  redFlags?: Record<string, boolean | undefined>;
  /** eligibility id -> true (met), false (not met), undefined (unanswered). */
  eligibility?: Record<string, boolean | undefined>;
  medicationsText?: string;
  allergies?: Allergy[];
  proposedMedicineId?: string;
}

export interface ConsultDecision {
  outcome: ReferralOutcome;
  findings: SafetyFinding[];
  summary: SafetySummary;
}

/** Lowest number wins — emergency outranks everything. */
const OUTCOME_PRIORITY: Record<ConsultOutcomeKind, number> = {
  call_emergency: 0,
  emergency_department: 1,
  urgent_care: 2,
  refer_same_day: 3,
  specialist: 4,
  refer_routine: 5,
  treat_and_refer: 6,
  treat: 7,
  no_treatment: 8,
  undecided: 9,
};

const OUTCOME_LABEL: Record<ConsultOutcomeKind, string> = {
  treat: 'Treat under protocol',
  treat_and_refer: 'Treat and refer to GP',
  refer_routine: 'Refer for GP review',
  refer_same_day: 'Immediate referral to GP',
  urgent_care: 'Urgent care',
  emergency_department: 'Immediate referral to Emergency Department',
  call_emergency: 'Call 000',
  specialist: 'Refer to specialist / other clinician',
  no_treatment: 'No treatment — watchful waiting',
  undecided: 'Assessment incomplete',
};

export function decide(protocol: ProtocolDefinition, input: DecisionInput): ConsultDecision {
  const findings = evaluateSafety(protocol, input);
  const summary = summariseSafety(findings);

  const flags = input.redFlags ?? {};
  const elig = input.eligibility ?? {};

  // Candidate outcomes from every rule that fired.
  const candidates: Array<{ kind: ConsultOutcomeKind; reason: string; ruleId?: string }> = [];

  for (const flag of protocol.redFlags) {
    if (flags[flag.id] === true) {
      candidates.push({ kind: flag.outcome, reason: flag.action, ruleId: `redflag:${flag.id}` });
    }
  }

  const unansweredEligibility = protocol.eligibility.filter(e => elig[e.id] === undefined);
  const unmetEligibility = protocol.eligibility.filter(e => elig[e.id] === false);

  for (const e of unmetEligibility) {
    candidates.push({
      kind: e.ifUnmet,
      reason: `Eligibility not met: ${e.label}`,
      ruleId: `eligibility:${e.id}`,
    });
  }

  // A hard clinical stop (contraindication / allergy) blocks supply even when
  // every eligibility question was answered "yes".
  if (summary.prescribingBlocked) {
    const worst = findings.find(
      f => f.severity === 'hard_stop' || f.severity === 'contraindication',
    );
    if (worst) {
      candidates.push({
        kind: 'refer_routine',
        reason: worst.reason,
        ruleId: worst.ruleId,
      });
    }
  }

  if (candidates.length === 0) {
    if (unansweredEligibility.length > 0 || hasUnansweredFlags(protocol, flags)) {
      return {
        outcome: {
          kind: 'undecided',
          label: OUTCOME_LABEL.undecided,
          reason: 'Assessment incomplete — not all protocol questions answered.',
          prescribingBlocked: true,
        },
        findings,
        summary,
      };
    }
    return {
      outcome: {
        kind: 'treat',
        label: OUTCOME_LABEL.treat,
        reason: 'All eligibility criteria met and no red flags positive.',
        prescribingBlocked: false,
      },
      findings,
      summary,
    };
  }

  candidates.sort((a, b) => OUTCOME_PRIORITY[a.kind] - OUTCOME_PRIORITY[b.kind]);
  const winner = candidates[0];

  return {
    outcome: {
      kind: winner.kind,
      label: OUTCOME_LABEL[winner.kind],
      reason: winner.reason,
      ruleId: winner.ruleId,
      prescribingBlocked: isPrescribingBlocked(winner.kind, summary),
    },
    findings,
    summary,
  };
}

function hasUnansweredFlags(
  protocol: ProtocolDefinition,
  flags: Record<string, boolean | undefined>,
): boolean {
  return protocol.redFlags.some(f => flags[f.id] === undefined);
}

function isPrescribingBlocked(kind: ConsultOutcomeKind, summary: SafetySummary): boolean {
  if (summary.prescribingBlocked) return true;
  if (kind === 'treat_and_refer' || kind === 'treat' || kind === 'no_treatment') return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISBAR / SBAR handover
// ─────────────────────────────────────────────────────────────────────────────

export interface HandoverInput {
  patientName?: string;
  patientDob?: string;
  presentingProblem?: string;
  history?: string;
  findingsSummary?: string;
  redFlagsPositive?: string[];
  medicines?: string;
  allergies?: string;
  assessment?: string;
  actionsTaken?: string;
}

/**
 * Concise structured handover. ISBAR ordering is used because it is what
 * receiving clinicians expect; the patient-facing view should NOT use this
 * jargon.
 */
export function buildHandover(
  decision: ConsultDecision,
  input: HandoverInput = {},
): string {
  const line = (label: string, value?: string) =>
    value && value.trim() ? `${label}: ${value.trim()}` : null;

  const positive = decision.findings.filter(f => f.severity === 'hard_stop' || f.severity === 'contraindication');

  const sections = [
    'IDENTIFICATION',
    line('Patient', [input.patientName, input.patientDob && `DOB ${input.patientDob}`].filter(Boolean).join(', ')),
    line('Allergies', input.allergies),
    line('Current medicines', input.medicines),

    'SITUATION',
    line('Presenting problem', input.presentingProblem),
    `Urgency: ${decision.outcome.label}`,

    'BACKGROUND',
    line('Relevant history', input.history),
    line('Actions already taken', input.actionsTaken),

    'ASSESSMENT',
    line('Pharmacist assessment', input.assessment ?? decision.outcome.reason),
    line('Key findings', input.findingsSummary),
    positive.length
      ? `Red flags / blockers: ${positive.map(f => f.finding).join('; ')}`
      : null,

    'RECOMMENDATION',
    `Reason for referral: ${decision.outcome.reason}`,
    decision.outcome.ruleId ? `Protocol rule: ${decision.outcome.ruleId}` : null,
  ].filter((x): x is string => Boolean(x));

  return sections.join('\n');
}
