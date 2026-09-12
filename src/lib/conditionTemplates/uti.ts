/**
 * Uncomplicated UTI — Reference Condition Template
 * --------------------------------------------------
 * First full implementation of the `ConditionTemplate` contract.
 * All 21 remaining conditions should copy this file's shape.
 *
 * Clinical alignment:
 *   - Therapeutic Guidelines: Antibiotic — Urinary tract infections
 *   - Australian Medicines Handbook
 *   - Victorian Community Pharmacist Statewide Prescribing Pilot
 *
 * NOTE: All clinical claims are stored as editable protocol data
 * (treatments, counselling, red flags) so they can be reviewed and
 * versioned without touching workflow logic. Bump `templateVersion`
 * whenever the data shape changes.
 */
import { getConditionById } from '@/data/conditions';
import { utiProtocol } from '@/clinical/protocols/uti';
import type {
  ConditionTemplate,
  RedFlagDefinition,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';
import { evaluateSafety } from '@/clinical/safety';
import { ageFromDob, isWithinAgeBand } from '@/clinical/primitives';
import { buildHandover, decide, type ConsultDecision, type DecisionInput } from '@/clinical/decision';
import type { SafetyFinding } from '@/clinical/types';

// ────────── Helpers ──────────
const lc = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '');
const tagContains = (csv: unknown, needle: string) =>
  lc(csv).split(/[,;]/).map(x => x.trim()).some(x => x && x.includes(needle.toLowerCase()));

const isPositive = (v: unknown) => v === 'yes' || v === true;
const isNegative = (v: unknown) => v === 'no' || v === false;
const isUnanswered = (v: unknown) => v === undefined || v === '' || v === null;

/**
 * Red flags are the protocol's red flags — all 22 of them.
 *
 * This list previously carried 15 hand-written flags, so the app never asked
 * about IUD inserted <3 months, neurological bladder, urinary tract
 * abnormality, diabetes/SGLT2, long-term inpatient care, asplenia, or history
 * of pyelonephritis — every one of which the protocol screens for. It also
 * invented a separate `nausea_vomiting` flag that duplicates the protocol's
 * pyelonephritis criterion.
 *
 * `RedFlagId` is a literal union for compile-time safety, and
 * `src/test/clinical/protocol-integrity.test.ts` asserts it stays identical to
 * the canonical protocol's red flag ids.
 */
const RED_FLAG_IDS = [
  'pyelonephritis_suspected', 'fever_rigors', 'flank_pain', 'pregnant',
  'visible_haematuria', 'neurological_bladder', 'recent_iud', 'catheter_related',
  'tract_abnormality', 'diabetes_or_sglt2', 'recurrent_pattern',
  'recent_treatment_failure', 'long_term_inpatient', 'std_concern',
  'immunocompromised', 'known_renal_disease', 'asplenia', 'history_pyelonephritis',
  'iud_in_situ_over_3_months', 'atypical_symptoms', 'male_patient', 'paediatric',
] as const;
type RedFlagId = (typeof RED_FLAG_IDS)[number];

/**
 * Severity for display, derived from the protocol-stated outcome rather than
 * invented per flag.
 */
function redFlagSeverity(outcome: string, blocksPrescribing: boolean): 'critical' | 'high' | 'moderate' {
  if (outcome === 'emergency_department' || outcome === 'call_emergency') return 'critical';
  return blocksPrescribing ? 'high' : 'moderate';
}

function redFlagsFromProtocol(): RedFlagDefinition[] {
  return utiProtocol.redFlags.map(f => ({
    id: f.id,
    label: f.label,
    detail: f.action,
    severity: redFlagSeverity(f.outcome, f.prescribingBlocked),
    action: f.action,
    blocksPrescribing: f.prescribingBlocked,
  }));
}

// ────────── Treatments ──────────
/**
 * Treatment options are DERIVED from the canonical Victorian protocol
 * (src/clinical/protocols/uti.ts), which is the single source of truth.
 *
 * They are deliberately no longer hardcoded here. Previously this file listed
 * trimethoprim as first line and offered cefalexin as third line. The official
 * protocol is explicit that this is wrong:
 *   - nitrofurantoin is FIRST line (100 mg every 6 hours for 5 days),
 *   - fosfomycin is SECOND line (3 g single dose) — previously absent,
 *   - trimethoprim is THIRD line and only where no trimethoprim exposure or
 *     trimethoprim-resistant E. coli in the last 3 months,
 *   - cefalexin is EXCLUDED from the medicines list to limit resistance.
 */
function treatmentFromProtocol(id: string): TreatmentOptionDefinition {
  const m = utiProtocol.medicines.find(x => x.id === id);
  if (!m) throw new Error(`UTI protocol has no medicine '${id}'`);
  const nextLine = utiProtocol.medicines.find(x => x.line === m.line + 1);
  return {
    id: m.id,
    medicineName: m.medicineName,
    line: m.line === 1 ? 'first' : m.line === 2 ? 'second' : 'third',
    dose: m.dose,
    frequency: m.frequency,
    duration: m.duration,
    maxQuantity: m.quantity ?? 0,
    repeats: m.repeats ?? 0,
    pbsRestriction:
      'Not PBS-subsidised under the Community Pharmacist Program — patient pays full cost',
    contraindications: m.contraindications,
    cautions: m.cautions ?? [],
    allergyConflicts: m.allergyConflicts ?? [],
    interactionFlags: m.interactionFlags ?? [],
    counsellingPoints: m.counsellingPoints ?? [],
    followUpAdvice:
      'Symptoms should respond within 48 hours. If symptoms persist 48–72 hours after ' +
      'finishing treatment, or new symptoms develop, advise the patient to see a GP.',
    referralTriggers: [
      'Fever 38°C or higher',
      'Rigors',
      'Loin or back pain',
      'Vomiting',
      'Symptoms that are not symptoms of acute cystitis',
    ],
    alternativeOptionId: nextLine?.id,
  };
}

const nitrofurantoin = treatmentFromProtocol('nitrofurantoin');
const fosfomycin = treatmentFromProtocol('fosfomycin');
const trimethoprim = treatmentFromProtocol('trimethoprim');

// ────────── Scope rules ──────────
const scopeRules = [
  {
    id: 'female_adult',
    label: 'Adult female within protocol age range',
    evaluate: (data: Record<string, unknown>): ScopeRuleResult | null => {
      const sex = data.sex as string | undefined;
      const dob = data.dob as string | undefined;
      if (!sex || !dob) return { status: 'needs_clarification', reason: 'Sex and DOB required' };
      if (sex !== 'female') {
        return { status: 'out_of_scope', reason: 'Pharmacist UTI protocol applies to female patients only' };
      }
      const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
      if (isNaN(age)) return { status: 'needs_clarification', reason: 'DOB invalid' };
      if (age < 18) return { status: 'out_of_scope', reason: 'Patient under 18' };
      if (age > 65) return { status: 'out_of_scope', reason: 'Patient over 65 — refer for assessment' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'not_pregnant',
    label: 'Not pregnant',
    evaluate: (data) => {
      const p = data.pregnancyStatus;
      if (p === undefined || p === '') {
        return { status: 'needs_clarification', reason: 'Pregnancy status not confirmed' };
      }
      if (p === 'pregnant' || p === 'possibly_pregnant') {
        return { status: 'out_of_scope', reason: 'Pregnancy excludes pharmacist UTI prescribing' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'no_red_flags',
    label: 'No positive red flags',
    evaluate: (data) => {
      const rf = (data.redFlags ?? {}) as Record<string, unknown>;
      const positive = RED_FLAG_IDS.filter(id => isPositive(rf[id]));
      const unanswered = RED_FLAG_IDS.filter(id => isUnanswered(rf[id]));
      if (unanswered.length > 0) {
        return { status: 'needs_clarification', reason: `${unanswered.length} red flag question(s) unanswered` };
      }
      if (positive.length > 0) {
        return { status: 'out_of_scope', reason: 'One or more red flags positive' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'symptoms_consistent',
    label: 'Symptoms consistent with uncomplicated lower UTI',
    evaluate: (data) => {
      const s = (data.symptoms ?? {}) as Record<string, unknown>;
      const has = isPositive(s.dysuria) || isPositive(s.frequency) || isPositive(s.urgency) || isPositive(s.suprapubic);
      if (!has) return { status: 'needs_clarification', reason: 'No characteristic UTI symptom recorded' };
      return { status: 'in_scope' };
    },
  },
] satisfies ConditionTemplate['scopeRules'];

// ────────── Documentation generator ──────────
function generateNote(data: Record<string, unknown>): string {
  const p = (data.patient ?? {}) as Record<string, string>;
  const s = (data.symptoms ?? {}) as Record<string, unknown>;
  const rf = (data.redFlags ?? {}) as Record<string, unknown>;
  const tx = data.selectedTreatment as TreatmentOptionDefinition | undefined;
  const counselling = (data.counsellingDone ?? []) as string[];
  const scope = data.scopeStatus as string | undefined;

  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || '[Patient]';
  const positiveSymptoms = [
    isPositive(s.dysuria) && 'dysuria',
    isPositive(s.frequency) && 'urinary frequency',
    isPositive(s.urgency) && 'urgency',
    isPositive(s.suprapubic) && 'suprapubic discomfort',
    isPositive(s.haematuria) && 'haematuria',
  ].filter(Boolean).join(', ') || 'urinary symptoms';

  const negatives = RED_FLAG_IDS
    .filter(id => isNegative(rf[id]))
    .map(id => id.replace(/_/g, ' '));
  const positives = RED_FLAG_IDS
    .filter(id => isPositive(rf[id]))
    .map(id => id.replace(/_/g, ' '));

  const lines: string[] = [];
  lines.push(`PATIENT: ${fullName}${p.dob ? `, DOB ${p.dob}` : ''}`);
  lines.push('');
  lines.push('PRESENTING COMPLAINT');
  lines.push(`Patient presents with ${positiveSymptoms}${s.onset ? ` (onset ${s.onset})` : ''}${s.duration ? `, duration ${s.duration}` : ''}.`);
  if (s.priorEpisode === 'recurrent') lines.push('Reports recurrent episode pattern.');
  else if (s.priorEpisode === 'first') lines.push('Reports this as first episode.');

  lines.push('');
  lines.push('RED FLAG SCREENING');
  if (positives.length === 0) {
    lines.push(`Negative for: ${negatives.length ? negatives.join(', ') : 'all screened red flags'}.`);
  } else {
    lines.push(`POSITIVE: ${positives.join(', ')}.`);
    if (negatives.length) lines.push(`Negative for: ${negatives.join(', ')}.`);
  }

  lines.push('');
  lines.push('SCOPE DECISION');
  lines.push(`Status: ${scope ?? 'not assessed'}.`);

  const diffs = (data.differentials ?? {}) as Record<string, { considered?: boolean; note?: string }>;
  const consideredDiffs = Object.entries(diffs).filter(([, v]) => v?.considered);
  if (consideredDiffs.length) {
    lines.push('');
    lines.push('DIFFERENTIALS CONSIDERED');
    consideredDiffs.forEach(([id, v]) => {
      lines.push(`• ${id.replace(/_/g, ' ')}${v.note ? ` — ${v.note}` : ''}`);
    });
  }

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration} (qty ${tx.maxQuantity}, ${tx.repeats} repeats).`);
  } else if (scope === 'out_of_scope') {
    lines.push('Out of scope for pharmacist prescribing — referral recommended.');
    if (data.referralNotes) lines.push(`Referral: ${data.referralNotes}`);
  } else {
    lines.push('No treatment supplied at this time.');
  }

  if (counselling.length) {
    lines.push('');
    lines.push(`COUNSELLING PROVIDED: ${counselling.length} item${counselling.length === 1 ? '' : 's'} confirmed.`);
  }
  if (data.followUpPlan) {
    lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  }
  if (data.safetyNet) {
    lines.push(`SAFETY NET: ${data.safetyNet}`);
  }

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Uncomplicated UTI, template v${(data.templateVersion ?? 1)}.`);
  lines.push(`Pharmacist: ${data.pharmacistName ?? '[name]'}, ${new Date().toLocaleString('en-AU')}.`);

  return lines.join('\n');
}

// ────────── The template ──────────
export const utiTemplate: ConditionTemplate = {
  id: 'uti',
  slug: 'uncomplicated-uti',
  name: 'Uncomplicated UTI',
  category: 'acute',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  // Traceable to the actual published document — see src/clinical/sources.ts.
  jurisdictionProtocolVersion: utiProtocol.id,
  /**
   * NOT 'active'. The clinical content is transcribed from the retrieved
   * official Victorian protocol, but it has not been signed off by a practising
   * pharmacist prescriber. Presenting it as 'active' would claim a review that
   * has not happened. Canonical lifecycle: 'source_verified'.
   */
  protocolStatus: 'needs_review',
  protocolLastReviewed: utiProtocol.effectiveDate ?? '2026-02-04',
  protocolSourceLabel:
    'Victorian Department of Health — Protocol for Management of Urinary Tract Infections, ' +
    'Community Pharmacist Program (January 2026; updated 4 February 2026)',
  lastReviewed: '2026-09-13',
  legacyCondition: getConditionById('uti')!,

  steps: [
    {
      id: 'patient', kind: 'patient-profile', label: 'Patient Profile',
      description: 'Demographics, allergies, medicines, conditions',
      fields: [
        { id: 'firstName', label: 'First name', kind: 'text', required: true },
        { id: 'lastName', label: 'Last name', kind: 'text', required: true },
        { id: 'dob', label: 'Date of birth', kind: 'date', required: true },
        { id: 'sex', label: 'Sex at birth', kind: 'select', required: true,
          options: [
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male', flagsOutOfScope: true },
            { value: 'intersex', label: 'Intersex / other', flagsOutOfScope: true },
          ] },
        { id: 'pregnancyStatus', label: 'Pregnancy status', kind: 'select', required: true,
          options: [
            { value: 'not_pregnant', label: 'Not pregnant' },
            { value: 'pregnant', label: 'Pregnant', flagsOutOfScope: true },
            { value: 'possibly_pregnant', label: 'Possibly pregnant', flagsOutOfScope: true },
            { value: 'not_applicable', label: 'Not applicable' },
          ] },
        { id: 'allergies', label: 'Allergies', kind: 'tags',
          helpText: 'List drug + non-drug allergies' },
        { id: 'currentMeds', label: 'Current medicines', kind: 'tags' },
        { id: 'relevantConditions', label: 'Relevant medical conditions', kind: 'tags',
          helpText: 'e.g. renal impairment, G6PD deficiency, immunosuppression' },
      ],
    },
    {
      id: 'symptoms', kind: 'presenting-complaint', label: 'Presenting Complaint',
      fields: [
        { id: 'dysuria', label: 'Dysuria (painful urination)', kind: 'boolean', required: true },
        { id: 'frequency', label: 'Urinary frequency', kind: 'boolean', required: true },
        { id: 'urgency', label: 'Urinary urgency', kind: 'boolean', required: true },
        { id: 'suprapubic', label: 'Suprapubic discomfort', kind: 'boolean', required: true },
        { id: 'haematuria', label: 'Haematuria (blood in urine)', kind: 'boolean', required: true },
        { id: 'onset', label: 'Symptom onset (date/time)', kind: 'datetime' },
        { id: 'duration', label: 'Duration', kind: 'select',
          options: [
            { value: '<24h', label: 'Less than 24 hours' },
            { value: '1-3d', label: '1–3 days' },
            { value: '4-7d', label: '4–7 days' },
            { value: '>7d', label: 'More than 7 days', flagsOutOfScope: true },
          ] },
        { id: 'priorEpisode', label: 'First or recurrent episode', kind: 'select',
          options: [
            { value: 'first', label: 'First episode' },
            { value: 'recurrent', label: 'Recurrent (≥2 in 6 months or ≥3 in 12 months)' },
          ] },
        { id: 'previousUti', label: 'Previous UTI history (notes)', kind: 'textarea' },
        { id: 'recentAntibiotics', label: 'Recent antibiotic use (last 3 months)', kind: 'textarea' },
        { id: 'selfTreatment', label: 'Self-treatment attempted', kind: 'textarea' },
      ],
    },
    {
      id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening',
      blockableByRedFlags: true,
    },
    {
      id: 'scope', kind: 'scope-validation', label: 'Scope Validation',
      blockableByScope: true,
    },
    {
      id: 'differentials', kind: 'differentials', label: 'Differentials',
    },
    {
      id: 'treatment', kind: 'treatment', label: 'Treatment',
      blockableByRedFlags: true, blockableByScope: true,
      fields: [
        { id: 'followUpPlan', label: 'Follow-up plan', kind: 'textarea', required: true },
        { id: 'safetyNet', label: 'Safety net advice', kind: 'textarea', required: true },
      ],
    },
    {
      id: 'counselling', kind: 'counselling', label: 'Counselling',
    },
    {
      id: 'documentation', kind: 'documentation', label: 'Documentation',
    },
  ],

  // Derived from the canonical protocol — see redFlagsFromProtocol().
  redFlags: redFlagsFromProtocol(),

  scopeRules,

  differentials: [
    { id: 'vaginitis', label: 'Vaginitis', whenToSuspect: 'Discharge, vulval irritation, no dysuria',
      referralOnHighSuspicion: true },
    { id: 'sti_urethritis', label: 'STI / urethritis', whenToSuspect: 'New partner, discharge, dyspareunia',
      referralOnHighSuspicion: true },
    { id: 'pyelonephritis', label: 'Pyelonephritis', whenToSuspect: 'Fever, flank pain, vomiting',
      referralOnHighSuspicion: true },
    { id: 'pregnancy_urinary', label: 'Pregnancy-related urinary symptoms',
      whenToSuspect: 'Possibility of pregnancy', referralOnHighSuspicion: true },
    { id: 'renal_calculi', label: 'Renal calculi', whenToSuspect: 'Severe colicky pain, haematuria',
      referralOnHighSuspicion: true },
    { id: 'interstitial_cystitis', label: 'Interstitial cystitis',
      whenToSuspect: 'Chronic pelvic pain without infection', referralOnHighSuspicion: true },
    { id: 'medication_related', label: 'Medication-related urinary symptoms',
      whenToSuspect: 'Recent diuretic / new medicines' },
  ],

  // Order matters: the protocol's line of therapy (1st → 3rd).
  treatments: [nitrofurantoin, fosfomycin, trimethoprim],

  counselling: [
    { id: 'how_to_take', label: 'How to take the medicine', required: true },
    { id: 'expected_improvement', label: 'Expected symptom improvement timeframe', required: true },
    { id: 'hydration', label: 'Hydration advice', required: true },
    { id: 'urgent_care', label: 'When to seek urgent care', required: true },
    { id: 'persistence', label: 'What to do if symptoms persist or worsen', required: true },
    { id: 'adverse_effects', label: 'Possible adverse effects', required: true },
    { id: 'adherence', label: 'Antibiotic adherence — complete the course', required: true },
    { id: 'no_leftovers', label: 'Do not save leftover antibiotics', required: true },
    { id: 'follow_up_window', label: 'Follow-up timeframe communicated', required: true },
  ],

  documentation: {
    sections: [
      { id: 'patient', heading: 'Patient' },
      { id: 'complaint', heading: 'Presenting Complaint' },
      { id: 'red_flags', heading: 'Red Flag Screening' },
      { id: 'scope', heading: 'Scope Decision' },
      { id: 'differentials', heading: 'Differentials' },
      { id: 'plan', heading: 'Plan' },
      { id: 'counselling', heading: 'Counselling' },
      { id: 'follow_up', heading: 'Follow-up' },
    ],
    generate: generateNote,
  },

  completionChecklist: [
    { id: 'patient', label: 'Patient profile complete', required: true,
      isComplete: (d) => {
        const p = (d.patient ?? {}) as Record<string, string>;
        return !!(p.firstName && p.lastName && p.dob && p.sex);
      } },
    { id: 'pregnancy', label: 'Pregnancy status confirmed', required: true,
      isComplete: (d) => !!(d.patient as Record<string, string> | undefined)?.pregnancyStatus },
    { id: 'symptoms', label: 'Symptoms documented', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, unknown>;
        return ['dysuria', 'frequency', 'urgency', 'suprapubic', 'haematuria'].every(k => !isUnanswered(s[k]));
      } },
    { id: 'red_flags', label: 'Red flag screening complete', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return RED_FLAG_IDS.every(id => !isUnanswered(rf[id]));
      } },
    { id: 'scope', label: 'Scope validation complete', required: true,
      isComplete: (d) => d.scopeStatus !== undefined && d.scopeStatus !== 'needs_clarification' },
    { id: 'differentials', label: 'Differentials considered', required: true,
      isComplete: (d) => {
        const diffs = (d.differentials ?? {}) as Record<string, { considered?: boolean }>;
        return Object.values(diffs).some(v => v.considered);
      } },
    { id: 'plan', label: 'Treatment selected or referral documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'counselling', label: 'Counselling completed', required: true,
      isComplete: (d) => {
        const done = (d.counsellingDone ?? []) as string[];
        // Required only when treatment supplied
        if (!d.selectedTreatment) return true;
        return done.length >= 7; // at least 7 of 9 required items
      } },
    { id: 'note', label: 'Clinical note generated', required: true,
      isComplete: (d) => !!d.noteText },
    { id: 'follow_up', label: 'Follow-up advice documented', required: true,
      isComplete: (d) => !!d.followUpPlan },
  ],

  safetyWeights: {
    missingCriticalField: 25,        // pregnancy status missing etc.
    unansweredRedFlag: 8,
    allergyConflict: 40,
    outOfScopeTreatment: 60,
    treatmentWithoutCounselling: 15,
    treatmentWithoutFollowUp: 15,
  },
};

// Public helpers used by engine + tests
export const UTI_RED_FLAG_IDS = RED_FLAG_IDS;
export type UtiRedFlagId = RedFlagId;

export interface UtiConsultationData {
  patient: {
    firstName?: string;
    lastName?: string;
    dob?: string;
    sex?: 'female' | 'male' | 'intersex';
    pregnancyStatus?: 'not_pregnant' | 'pregnant' | 'possibly_pregnant' | 'not_applicable';
    allergies?: string;
    currentMeds?: string;
    relevantConditions?: string;
  };
  symptoms: Partial<Record<
    'dysuria' | 'frequency' | 'urgency' | 'suprapubic' | 'haematuria',
    'yes' | 'no'
  >> & {
    onset?: string;
    duration?: '<24h' | '1-3d' | '4-7d' | '>7d';
    priorEpisode?: 'first' | 'recurrent';
    previousUti?: string;
    recentAntibiotics?: string;
    selfTreatment?: string;
  };
  redFlags: Partial<Record<RedFlagId, 'yes' | 'no'>>;
  scopeStatus?: 'in_scope' | 'needs_clarification' | 'out_of_scope';
  scopeReasons?: string[];
  differentials: Record<string, { considered?: boolean; note?: string; highSuspicion?: boolean }>;
  selectedTreatment?: TreatmentOptionDefinition;
  treatmentBlockedReasons?: string[];
  followUpPlan?: string;
  safetyNet?: string;
  referralNotes?: string;
  /**
   * Consent to participate in the program, including communication with the
   * patient's usual GP. One of the protocol's eligibility criteria, so it is
   * part of the clinical record rather than a legal checkbox off to the side.
   */
  consentToProgram?: boolean;
  counsellingDone: string[];
  noteText?: string;
  pharmacistName?: string;
  templateVersion: number;
}

export function emptyUtiData(): UtiConsultationData {
  return {
    patient: {},
    symptoms: {},
    redFlags: {},
    differentials: {},
    counsellingDone: [],
    templateVersion: utiTemplate.templateVersion,
  };
}

// ────────── Pure evaluators (used by engine + tests) ──────────

export function evaluateScope(data: UtiConsultationData): {
  status: 'in_scope' | 'needs_clarification' | 'out_of_scope';
  reasons: string[];
} {
  const flat: Record<string, unknown> = {
    sex: data.patient.sex,
    dob: data.patient.dob,
    pregnancyStatus: data.patient.pregnancyStatus,
    redFlags: data.redFlags,
    symptoms: data.symptoms,
  };
  const results = utiTemplate.scopeRules
    .map(r => ({ rule: r, result: r.evaluate(flat) }))
    .filter(r => r.result);

  const reasons: string[] = [];
  let status: 'in_scope' | 'needs_clarification' | 'out_of_scope' = 'in_scope';
  for (const r of results) {
    if (!r.result) continue;
    if (r.result.status === 'out_of_scope') {
      status = 'out_of_scope';
      if (r.result.reason) reasons.push(r.result.reason);
    } else if (r.result.status === 'needs_clarification' && status !== 'out_of_scope') {
      status = 'needs_clarification';
      if (r.result.reason) reasons.push(r.result.reason);
    }
  }
  return { status, reasons };
}

/**
 * Structured safety findings for this consultation.
 *
 * Replaces the numeric "safety score". A single 0-100 number implied a
 * precision the underlying rules did not have, and could not express "this is
 * an absolute contraindication" versus "monitor this".
 */
export function evaluateUtiFindings(
  data: UtiConsultationData,
  treatment?: TreatmentOptionDefinition,
): SafetyFinding[] {
  const redFlags: Record<string, boolean | undefined> = {};
  for (const id of RED_FLAG_IDS) {
    const v = data.redFlags[id];
    redFlags[id] = v === 'yes' ? true : v === 'no' ? false : undefined;
  }

  const findings = evaluateSafety(utiProtocol, {
    redFlags,
    medicationsText: data.patient.currentMeds,
    conditionsText: data.patient.relevantConditions,
    allergiesText: data.patient.allergies,
    proposedMedicineId: treatment?.id,
  });

  // Completeness findings are not protocol rules but must be visible: an
  // unanswered red flag is a safety issue, not an administrative one.
  const unanswered = RED_FLAG_IDS.filter(id => isUnanswered(data.redFlags[id])).length;
  if (unanswered > 0) {
    findings.push({
      ruleId: 'completeness:red_flags',
      finding: `${unanswered} red flag(s) not answered`,
      severity: 'monitor',
      reason: 'The protocol requires every listed red flag to be assessed before a decision.',
      sourceId: utiProtocol.sourceId,
      recommendedAction: 'Complete red flag screening before selecting treatment.',
      overridePolicy: 'non_overridable',
    });
  }
  if (!data.patient.pregnancyStatus) {
    findings.push({
      ruleId: 'completeness:pregnancy_status',
      finding: 'Pregnancy status not confirmed',
      severity: 'monitor',
      reason: 'Pregnancy changes both eligibility and the required referral pathway.',
      sourceId: utiProtocol.sourceId,
      recommendedAction: 'Record pregnancy status before selecting treatment.',
      overridePolicy: 'non_overridable',
    });
  }

  return findings;
}

/**
 * Human-readable reasons why the proposed treatment must not proceed.
 * Derived from the structured findings so the two can never disagree.
 */
export function evaluateTreatmentBlockers(
  data: UtiConsultationData,
  treatment: TreatmentOptionDefinition,
): string[] {
  const reasons: string[] = [];
  const scope = evaluateScope(data);
  if (scope.status !== 'in_scope') reasons.push('Out of scope — treatment not permitted');

  const findings = evaluateUtiFindings(data, treatment);
  for (const f of findings) {
    // Absolute barriers: non-overridable by policy, or a hard stop /
    // contraindication by severity. There is no override UI in the product
    // yet, so anything at that severity must stop the supply.
    if (
      f.overridePolicy === 'non_overridable' ||
      f.severity === 'hard_stop' ||
      f.severity === 'contraindication'
    ) {
      reasons.push(`${f.finding} — ${f.recommendedAction}`);
    }
  }

  // Caution-level findings never block silently: they are surfaced too, so a
  // pharmacist cannot miss them behind a green "no blockers" state.
  for (const f of findings) {
    if (f.severity === 'caution' || f.severity === 'monitor' || f.severity === 'refer') {
      reasons.push(`${f.severity === 'refer' ? 'Referral' : 'Caution'}: ${f.finding}`);
    }
  }

  return dedupe(reasons);
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision — referral is a clinical outcome, not a failure state
// ─────────────────────────────────────────────────────────────────────────────

/** Build the canonical DecisionInput from this template's data shape. */
export function utiDecisionInput(
  data: UtiConsultationData,
  treatment?: TreatmentOptionDefinition,
): DecisionInput {
  const redFlags: Record<string, boolean | undefined> = {};
  for (const id of RED_FLAG_IDS) {
    const v = data.redFlags[id];
    redFlags[id] = v === 'yes' ? true : v === 'no' ? false : undefined;
  }

  const age = ageFromDob(data.patient.dob);
  const inAgeBand = isWithinAgeBand(age, 18, 65);
  const cystitisSymptoms = ['dysuria', 'frequency', 'urgency', 'suprapubic'].filter(
    k => data.symptoms[k] === 'yes',
  ).length;

  return {
    redFlags,
    eligibility: {
      sex_female: data.patient.sex ? data.patient.sex === 'female' : undefined,
      age_18_to_65: inAgeBand === null ? undefined : inAgeBand,
      // Two or more acute cystitis symptoms, as the protocol requires.
      two_or_more_cystitis_symptoms:
        cystitisSymptoms > 0 || ['dysuria', 'frequency', 'urgency', 'suprapubic']
          .some(k => data.symptoms[k] === 'no')
          ? cystitisSymptoms >= 2
          : undefined,
      // Consent to participate is captured explicitly in the consultation;
      // until it is recorded the decision stays 'undecided'.
      consent_and_present: data.consentToProgram === true ? true : undefined,
    },
    medicationsText: data.patient.currentMeds,
    conditionsText: data.patient.relevantConditions,
    allergiesText: data.patient.allergies,
    proposedMedicineId: treatment?.id,
  };
}

export function decideUti(
  data: UtiConsultationData,
  treatment?: TreatmentOptionDefinition,
): ConsultDecision {
  return decide(utiProtocol, utiDecisionInput(data, treatment));
}

/**
 * ISBAR handover text for this consultation. Used for the GP letter and for
 * the referral record; never shown to the patient in this form.
 */
export function buildUtiHandover(
  data: UtiConsultationData,
  treatment?: TreatmentOptionDefinition,
): string {
  const decision = decideUti(data, treatment);
  const positive = RED_FLAG_IDS.filter(id => data.redFlags[id] === 'yes').map(
    id => utiProtocol.redFlags.find(f => f.id === id)?.label ?? id,
  );

  return buildHandover(decision, {
    patientName: [data.patient.firstName, data.patient.lastName].filter(Boolean).join(' '),
    patientDob: data.patient.dob,
    presentingProblem: 'Suspected uncomplicated lower urinary tract infection (cystitis)',
    history: data.symptoms.previousUti,
    medicines: data.patient.currentMeds,
    allergies: data.patient.allergies,
    assessment: data.referralNotes,
    redFlagsPositive: positive,
    actionsTaken: treatment ? `Pharmacist proposed ${treatment.medicineName}.` : undefined,
  });
}
