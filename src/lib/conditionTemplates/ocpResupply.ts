/**
 * OCP Resupply + Hormonal Contraception — Condition Template
 * -----------------------------------------------------------
 * Continuation supply only. Initiation, switching, or first-time
 * prescribing is OUT OF SCOPE. Pharmacist must apply UKMEC-aligned
 * contraindication screening (BP, migraine with aura, VTE history,
 * smoking >35y, recent pregnancy, etc.).
 *
 * Clinical alignment: Faculty of Sexual & Reproductive Healthcare
 * (FSRH) UKMEC, Therapeutic Guidelines, Vic CPSP. Status = draft.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const OCP_RED_FLAG_IDS = [
  'migraine_with_aura', 'vte_history', 'known_thrombophilia',
  'smoker_over_35', 'bp_elevated', 'breast_cancer_history',
  'liver_disease', 'recent_pregnancy_postpartum', 'undiagnosed_bleeding',
  'multiple_cv_risk_factors', 'prolonged_immobility',
] as const;
type OcpRedFlagId = (typeof OCP_RED_FLAG_IDS)[number];

const combinedOcpResupply: TreatmentOptionDefinition = {
  id: 'cocp-resupply',
  medicineName: 'Combined Oral Contraceptive (continuation)',
  line: 'first',
  dose: 'Per existing brand',
  frequency: 'Once daily',
  duration: 'Up to 4 months supply',
  maxQuantity: 4,
  repeats: 0,
  pbsRestriction: 'Pharmacist continuation supply (Vic CPSP)',
  contraindications: [
    'migraine with aura', 'vte history', 'known thrombophilia',
    'breast cancer', 'severe liver disease', 'uncontrolled hypertension',
  ],
  cautions: ['BP must be < 140/90', 'Smoking + age ≥ 35 contraindicates'],
  allergyConflicts: ['oestrogen', 'ethinylestradiol'],
  interactionFlags: ['rifampicin', 'carbamazepine', 'phenytoin', 'topiramate', 'st johns wort'],
  counsellingPoints: [
    'Continuation supply only — book GP review within 12 months',
    'If a pill is missed, follow the missed-pill rules in the CMI',
    'Seek urgent review for severe leg pain, chest pain, sudden vision change, or new severe headache',
    'Effectiveness reduced by some antibiotics (rifampicin) and enzyme inducers',
  ],
  followUpAdvice: 'Confirm patient has GP follow-up booked within 12 months for ongoing prescribing.',
};

const popResupply: TreatmentOptionDefinition = {
  id: 'pop-resupply',
  medicineName: 'Progestogen-only Pill (continuation)',
  line: 'first',
  dose: 'Per existing brand',
  frequency: 'Once daily, continuous',
  duration: 'Up to 4 months supply',
  maxQuantity: 4,
  repeats: 0,
  contraindications: ['breast cancer', 'severe liver disease', 'undiagnosed vaginal bleeding'],
  cautions: ['Strict same-time daily dosing for desogestrel/norethisterone'],
  allergyConflicts: ['progestogen'],
  interactionFlags: ['rifampicin', 'carbamazepine', 'phenytoin', 'st johns wort'],
  counsellingPoints: [
    'Take at the same time every day — late = potential loss of cover',
    'No pill-free interval',
    'Continuation supply only — GP review within 12 months',
  ],
};

const scopeRules = [
  {
    id: 'continuation_only',
    label: 'Continuation supply only',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const c = (d.continuation ?? {}) as Record<string, unknown>;
      if (c.firstTimeUse === true) return { status: 'out_of_scope', reason: 'First-time prescribing — refer to GP' };
      if (c.brandSwitch === true) return { status: 'out_of_scope', reason: 'Brand/method switch — refer to GP' };
      if (!c.currentBrand) return { status: 'needs_clarification', reason: 'Current brand required' };
      if (!c.lastGpReview) return { status: 'needs_clarification', reason: 'Last GP review date required' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'gp_review_window',
    label: 'GP reviewed within last 24 months',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const c = (d.continuation ?? {}) as Record<string, unknown>;
      const last = c.lastGpReview as string | undefined;
      if (!last) return null;
      const months = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (months > 24) return { status: 'out_of_scope', reason: 'Last GP review > 24 months — refer for full review' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No UKMEC contraindications',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = OCP_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
      if (positives.length) return { status: 'out_of_scope', reason: `Positive red flag: ${positives[0]}` };
      return { status: 'in_scope' };
    },
  },
];

function generateNote(data: Record<string, unknown>): string {
  const p = (data.patient ?? {}) as Record<string, string>;
  const c = (data.continuation ?? {}) as Record<string, string>;
  const rf = (data.redFlags ?? {}) as Record<string, string>;
  const tx = data.selectedTreatment as TreatmentOptionDefinition | undefined;
  const obs = (data.observations ?? {}) as Record<string, string>;
  const lines: string[] = [];
  const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '[patient]';

  lines.push(`PATIENT: ${fullName}${p.dob ? `, DOB ${p.dob}` : ''}`);
  lines.push('');
  lines.push('CONTRACEPTION CONTINUATION');
  lines.push(`Current method: ${c.currentBrand ?? '[brand]'} (${c.method ?? 'method unspecified'}).`);
  if (c.lastGpReview) lines.push(`Last GP review: ${c.lastGpReview}.`);
  if (c.missedPillsHistory) lines.push(`Missed pills history: ${c.missedPillsHistory}.`);

  lines.push('');
  lines.push('OBSERVATIONS');
  if (obs.bpSystolic && obs.bpDiastolic) lines.push(`BP: ${obs.bpSystolic}/${obs.bpDiastolic} mmHg.`);
  if (obs.bmi) lines.push(`BMI: ${obs.bmi}.`);
  if (obs.smokingStatus) lines.push(`Smoking: ${obs.smokingStatus}.`);

  lines.push('');
  lines.push('UKMEC RED FLAG SCREENING');
  const positives = OCP_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All UKMEC contraindications screened negative.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Continuation supplied: ${tx.medicineName}, ${tx.duration}.`);
    lines.push('Counselled on missed-pill rules, VTE warning signs, and need for GP review within 12 months.');
  } else {
    lines.push('No supply provided — refer to GP.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Hormonal Contraception Continuation, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const ocpResupplyTemplate: ConditionTemplate = {
  id: 'ocp-resupply',
  slug: 'ocp-resupply',
  name: 'OCP Resupply + Hormonal Contraception',
  category: 'resupply',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-CONTRA-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('ocp-resupply') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'continuation', kind: 'presenting-complaint', label: 'Continuation Details' },
    { id: 'observations', kind: 'presenting-complaint', label: 'Observations (BP, BMI, smoking)' },
    { id: 'red-flags', kind: 'red-flags', label: 'UKMEC Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Continuation Supply', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'migraine_with_aura', label: 'Migraine with aura (any age)', severity: 'critical', blocksPrescribing: true,
      action: 'Combined hormonal contraception contraindicated — refer to GP' },
    { id: 'vte_history', label: 'Personal history of VTE / PE', severity: 'critical', blocksPrescribing: true,
      action: 'Combined hormonal contraception contraindicated — refer' },
    { id: 'known_thrombophilia', label: 'Known thrombophilia', severity: 'critical', blocksPrescribing: true,
      action: 'Refer to GP / haematology' },
    { id: 'smoker_over_35', label: 'Current smoker AND age ≥ 35', severity: 'critical', blocksPrescribing: true,
      action: 'Combined hormonal contraception contraindicated — refer or consider POP' },
    { id: 'bp_elevated', label: 'BP ≥ 140/90 today', severity: 'high', blocksPrescribing: true,
      action: 'Recheck after 5 min rest; if persistently elevated, refer' },
    { id: 'breast_cancer_history', label: 'Personal history of breast cancer', severity: 'critical', blocksPrescribing: true,
      action: 'Hormonal contraception contraindicated — refer' },
    { id: 'liver_disease', label: 'Active liver disease (severe cirrhosis, tumour)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer to GP' },
    { id: 'recent_pregnancy_postpartum', label: 'Postpartum < 6 weeks (or breastfeeding)', severity: 'high', blocksPrescribing: true,
      action: 'Refer — restart timing and method choice need medical review' },
    { id: 'undiagnosed_bleeding', label: 'Undiagnosed abnormal vaginal bleeding', severity: 'high', blocksPrescribing: true,
      action: 'Refer to GP for investigation' },
    { id: 'multiple_cv_risk_factors', label: 'Multiple cardiovascular risk factors', severity: 'high', blocksPrescribing: true,
      action: 'Refer to GP' },
    { id: 'prolonged_immobility', label: 'Prolonged immobility (post-op, long-haul travel within 4 weeks)', severity: 'moderate', blocksPrescribing: false,
      action: 'Counsel on VTE warning signs' },
  ],

  scopeRules,

  differentials: [],

  treatments: [combinedOcpResupply, popResupply],

  counselling: [
    { id: 'missed_pill_rules', label: 'Missed-pill rules walked through', required: true },
    { id: 'vte_warning', label: 'VTE warning signs (chest pain, severe leg pain, breathlessness)', required: true },
    { id: 'aura_warning', label: 'Stop and seek review if new migraine with aura develops', required: true },
    { id: 'gp_review', label: 'GP review booked within 12 months', required: true },
    { id: 'enzyme_inducers', label: 'Counselled on enzyme-inducer interactions', required: true },
    { id: 'sti_screening', label: 'Discussed STI screening / barrier methods', required: false },
    { id: 'breakthrough_bleeding', label: 'Breakthrough bleeding expected pattern', required: false },
    { id: 'storage', label: 'Storage and shelf-life', required: false },
  ],

  documentation: {
    sections: [
      { id: 'patient', heading: 'Patient' },
      { id: 'continuation', heading: 'Continuation Details' },
      { id: 'observations', heading: 'Observations' },
      { id: 'red_flags', heading: 'UKMEC Screening' },
      { id: 'plan', heading: 'Plan' },
    ],
    generate: generateNote,
  },

  completionChecklist: [
    { id: 'patient', label: 'Patient profile complete', required: true,
      isComplete: (d) => {
        const p = (d.patient ?? {}) as Record<string, string>;
        return !!(p.firstName && p.lastName && p.dob);
      } },
    { id: 'continuation', label: 'Current brand + last GP review documented', required: true,
      isComplete: (d) => {
        const c = (d.continuation ?? {}) as Record<string, string>;
        return !!(c.currentBrand && c.lastGpReview);
      } },
    { id: 'bp', label: 'Blood pressure recorded today', required: true,
      isComplete: (d) => {
        const o = (d.observations ?? {}) as Record<string, string>;
        return !!(o.bpSystolic && o.bpDiastolic);
      } },
    { id: 'red_flags', label: 'All UKMEC red flags answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return OCP_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'plan', label: 'Supply or referral decision documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
  ],

  safetyWeights: {
    missingCriticalField: 25,
    unansweredRedFlag: 15,
    allergyConflict: 40,
    outOfScopeTreatment: 70,
    treatmentWithoutCounselling: 25,
    treatmentWithoutFollowUp: 20,
  },
};
