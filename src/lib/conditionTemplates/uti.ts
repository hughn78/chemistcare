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
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

// ────────── Helpers ──────────
const lc = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '');
const tagContains = (csv: unknown, needle: string) =>
  lc(csv).split(/[,;]/).map(x => x.trim()).some(x => x && x.includes(needle.toLowerCase()));

const isPositive = (v: unknown) => v === 'yes' || v === true;
const isNegative = (v: unknown) => v === 'no' || v === false;
const isUnanswered = (v: unknown) => v === undefined || v === '' || v === null;

const RED_FLAG_IDS = [
  'fever_rigors', 'flank_pain', 'nausea_vomiting', 'pyelonephritis_suspected',
  'pregnant', 'male_patient', 'paediatric', 'immunocompromised',
  'known_renal_disease', 'catheter_related', 'recurrent_pattern',
  'visible_haematuria', 'std_concern', 'atypical_symptoms', 'recent_treatment_failure',
] as const;
type RedFlagId = (typeof RED_FLAG_IDS)[number];

// ────────── Treatments ──────────
const trimethoprim: TreatmentOptionDefinition = {
  id: 'trimethoprim',
  medicineName: 'Trimethoprim',
  line: 'first',
  dose: '300 mg',
  frequency: 'Once daily',
  duration: '3 days',
  maxQuantity: 3,
  repeats: 0,
  pbsRestriction: 'Restricted benefit (PBP)',
  contraindications: ['folate deficiency', 'blood dyscrasia', 'severe renal impairment'],
  cautions: ['Monitor INR if on warfarin', 'Avoid in early pregnancy'],
  allergyConflicts: ['trimethoprim', 'sulfonamide'],
  interactionFlags: ['methotrexate', 'warfarin', 'phenytoin', 'spironolactone', 'ace inhibitor'],
  counsellingPoints: [
    'Take once daily for 3 days, with or without food',
    'Complete the full course even if you feel better',
    'Drink plenty of fluids',
  ],
  followUpAdvice: 'Symptoms should improve within 48 hours. If not, see a GP.',
  referralTriggers: ['No improvement at 48 h', 'Symptoms worsen', 'Fever or flank pain develops'],
  alternativeOptionId: 'nitrofurantoin',
};

const nitrofurantoin: TreatmentOptionDefinition = {
  id: 'nitrofurantoin',
  medicineName: 'Nitrofurantoin',
  line: 'second',
  dose: '100 mg (modified release)',
  frequency: 'Twice daily',
  duration: '5 days',
  maxQuantity: 10,
  repeats: 0,
  pbsRestriction: 'Restricted benefit (PBP)',
  contraindications: ['eGFR < 45 mL/min', 'g6pd deficiency', 'pulmonary fibrosis history'],
  cautions: ['Take with food to reduce nausea', 'Avoid at term (≥36 weeks) pregnancy'],
  allergyConflicts: ['nitrofurantoin'],
  interactionFlags: ['magnesium antacid', 'probenecid'],
  counsellingPoints: [
    'Take twice daily with food for 5 days',
    'May discolour urine yellow-brown — harmless',
    'Stop and seek review if you develop cough, breathlessness, or numbness/tingling',
  ],
  followUpAdvice: 'Expect improvement within 48–72 hours. Review at 5 days.',
  referralTriggers: ['No improvement at 72 h', 'Respiratory symptoms develop'],
  alternativeOptionId: 'cefalexin',
};

const cefalexin: TreatmentOptionDefinition = {
  id: 'cefalexin',
  medicineName: 'Cefalexin',
  line: 'third',
  dose: '500 mg',
  frequency: 'Twice daily',
  duration: '5 days',
  maxQuantity: 10,
  repeats: 0,
  pbsRestriction: 'Alternative — confirm protocol locally',
  contraindications: ['cephalosporin allergy'],
  cautions: ['Severe penicillin allergy — assess cross-reactivity risk'],
  allergyConflicts: ['cephalosporin', 'cefalexin', 'cephalexin'],
  interactionFlags: ['probenecid'],
  counsellingPoints: [
    'Take twice daily for 5 days, with or without food',
    'Complete the full course',
    'Notify pharmacist if rash, swelling, or breathing difficulty develops',
  ],
  followUpAdvice: 'Expect improvement within 48–72 hours.',
  referralTriggers: ['Allergic reaction', 'No improvement at 72 h'],
};

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
  lastReviewed: '2026-04-01',
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

  redFlags: [
    { id: 'fever_rigors', label: 'Fever ≥ 38°C or rigors', severity: 'critical', blocksPrescribing: true,
      action: 'Refer for assessment — possible upper UTI / systemic infection' },
    { id: 'flank_pain', label: 'Flank or loin pain / costovertebral tenderness', severity: 'critical',
      blocksPrescribing: true, action: 'Refer urgently — possible pyelonephritis' },
    { id: 'nausea_vomiting', label: 'Nausea or vomiting', severity: 'high', blocksPrescribing: true,
      action: 'Refer — systemic features beyond pharmacist scope' },
    { id: 'pyelonephritis_suspected', label: 'Suspected pyelonephritis', severity: 'critical',
      blocksPrescribing: true, action: 'Urgent GP / ED referral' },
    { id: 'pregnant', label: 'Pregnant or possibly pregnant', severity: 'critical',
      blocksPrescribing: true, action: 'Refer — UTI in pregnancy requires medical management' },
    { id: 'male_patient', label: 'Male patient', severity: 'critical',
      blocksPrescribing: true, action: 'Out of pharmacist scope — refer to GP' },
    { id: 'paediatric', label: 'Child or adolescent outside protocol age', severity: 'critical',
      blocksPrescribing: true, action: 'Refer to GP / paediatric service' },
    { id: 'immunocompromised', label: 'Immunocompromised state', severity: 'high',
      blocksPrescribing: true, action: 'Refer — higher complication risk' },
    { id: 'known_renal_disease', label: 'Known renal disease', severity: 'high',
      blocksPrescribing: true, action: 'Refer — antibiotic dosing / safety considerations' },
    { id: 'catheter_related', label: 'Catheter-associated symptoms', severity: 'high',
      blocksPrescribing: true, action: 'Refer — CAUTI requires medical assessment' },
    { id: 'recurrent_pattern', label: 'Recurrent UTI pattern requiring GP review', severity: 'moderate',
      blocksPrescribing: true, action: 'Refer for investigation' },
    { id: 'visible_haematuria', label: 'Visible blood in urine requiring referral', severity: 'high',
      blocksPrescribing: true, action: 'Refer for urinalysis / further workup' },
    { id: 'std_concern', label: 'Vaginal discharge, pelvic pain, or STI concern', severity: 'high',
      blocksPrescribing: true, action: 'Refer — consider vaginitis / STI workup' },
    { id: 'atypical_symptoms', label: 'Symptoms not consistent with uncomplicated UTI', severity: 'moderate',
      blocksPrescribing: true, action: 'Refer for diagnosis' },
    { id: 'recent_treatment_failure', label: 'Recent UTI treatment failure', severity: 'high',
      blocksPrescribing: true, action: 'Refer — culture and sensitivity needed' },
  ],

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

  treatments: [trimethoprim, nitrofurantoin, cefalexin],

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

export function evaluateTreatmentBlockers(
  data: UtiConsultationData,
  treatment: TreatmentOptionDefinition,
): string[] {
  const reasons: string[] = [];
  const scope = evaluateScope(data);
  if (scope.status !== 'in_scope') reasons.push('Out of scope — treatment not permitted');

  for (const allergyTerm of treatment.allergyConflicts) {
    if (tagContains(data.patient.allergies, allergyTerm)) {
      reasons.push(`Allergy conflict: ${allergyTerm}`);
    }
  }
  for (const ci of treatment.contraindications) {
    if (tagContains(data.patient.relevantConditions, ci)) {
      reasons.push(`Contraindication: ${ci}`);
    }
  }
  for (const ix of treatment.interactionFlags) {
    if (tagContains(data.patient.currentMeds, ix)) {
      reasons.push(`Interaction with ${ix}`);
    }
  }
  // Required assessment fields
  const rfDone = UTI_RED_FLAG_IDS.every(id => !isUnanswered(data.redFlags[id]));
  if (!rfDone) reasons.push('Red flag screening incomplete');
  if (!data.patient.pregnancyStatus) reasons.push('Pregnancy status not confirmed');

  return reasons;
}

export function computeUtiSafetyScore(data: UtiConsultationData): {
  score: number;
  penalties: { reason: string; weight: number }[];
} {
  const w = utiTemplate.safetyWeights;
  const penalties: { reason: string; weight: number }[] = [];

  if (!data.patient.pregnancyStatus) {
    penalties.push({ reason: 'Pregnancy status missing', weight: w.missingCriticalField });
  }
  const unanswered = UTI_RED_FLAG_IDS.filter(id => isUnanswered(data.redFlags[id])).length;
  if (unanswered) penalties.push({ reason: `${unanswered} red flag(s) unanswered`, weight: w.unansweredRedFlag * unanswered });

  if (data.selectedTreatment) {
    const blockers = evaluateTreatmentBlockers(data, data.selectedTreatment);
    const allergyHits = blockers.filter(b => b.startsWith('Allergy')).length;
    if (allergyHits) penalties.push({ reason: 'Allergy conflict with selected treatment', weight: w.allergyConflict * allergyHits });

    const scope = evaluateScope(data);
    if (scope.status !== 'in_scope') {
      penalties.push({ reason: 'Treatment selected while out of scope', weight: w.outOfScopeTreatment });
    }
    const requiredCounselling = utiTemplate.counselling.filter(c => c.required).map(c => c.id);
    const done = data.counsellingDone ?? [];
    const allDone = requiredCounselling.every(id => done.includes(id));
    if (!allDone) penalties.push({ reason: 'Treatment selected without full counselling', weight: w.treatmentWithoutCounselling });
    if (!data.followUpPlan) penalties.push({ reason: 'Treatment selected without follow-up advice', weight: w.treatmentWithoutFollowUp });
  }

  const total = penalties.reduce((s, p) => s + p.weight, 0);
  return { score: Math.max(0, 100 - total), penalties };
}
