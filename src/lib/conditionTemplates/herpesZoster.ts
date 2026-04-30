/**
 * Herpes Zoster (Shingles) — Condition Template
 * ----------------------------------------------
 * VIC pharmacist prescribing protocol. Antiviral therapy is most
 * effective when started within 72 hours of rash onset; the template
 * makes onset window a hard scope rule.
 *
 * Clinical alignment: Therapeutic Guidelines (Antibiotic), AMH,
 * Victorian CPSP. All clinical content is `protocolStatus: 'draft'`
 * and `needs_review` until clinically signed off.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

const lc = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '');
const tagContains = (csv: unknown, needle: string) =>
  lc(csv).split(/[,;]/).map(x => x.trim()).some(x => x && x.includes(needle.toLowerCase()));

export const HZ_RED_FLAG_IDS = [
  'eye_involvement', 'ear_involvement_ramsay_hunt', 'disseminated_rash',
  'severe_immunocompromise', 'pregnancy', 'paediatric',
  'meningism_neuro_signs', 'systemic_sepsis_signs',
  'multidermatomal_rash', 'severe_pain_uncontrolled',
] as const;
type HzRedFlagId = (typeof HZ_RED_FLAG_IDS)[number];

const valaciclovir: TreatmentOptionDefinition = {
  id: 'valaciclovir',
  medicineName: 'Valaciclovir',
  line: 'first',
  dose: '1 g',
  frequency: 'Three times daily',
  duration: '7 days',
  maxQuantity: 21,
  repeats: 0,
  pbsRestriction: 'Restricted benefit',
  contraindications: ['severe renal impairment'],
  cautions: ['Reduce dose if CrCl < 50 mL/min', 'Maintain hydration'],
  allergyConflicts: ['valaciclovir', 'aciclovir', 'famciclovir'],
  interactionFlags: ['nephrotoxic agents', 'mycophenolate'],
  counsellingPoints: [
    'Take three times daily for 7 days, with or without food',
    'Drink plenty of water — keep well hydrated',
    'Start as soon as possible — antivirals work best within 72 hours of rash',
    'Pain may persist after rash resolves (post-herpetic neuralgia)',
  ],
  followUpAdvice: 'Review in 7 days; refer if rash spreads, eye/ear involvement appears, or pain uncontrolled.',
};

const famciclovir: TreatmentOptionDefinition = {
  id: 'famciclovir',
  medicineName: 'Famciclovir',
  line: 'second',
  dose: '500 mg',
  frequency: 'Three times daily',
  duration: '7 days',
  maxQuantity: 21,
  repeats: 0,
  contraindications: ['severe renal impairment'],
  cautions: ['Dose adjust in renal impairment'],
  allergyConflicts: ['famciclovir', 'penciclovir'],
  interactionFlags: [],
  counsellingPoints: [
    'Take three times daily for 7 days',
    'Start within 72 hours of rash onset for best effect',
  ],
};

const aciclovir: TreatmentOptionDefinition = {
  id: 'aciclovir',
  medicineName: 'Aciclovir',
  line: 'third',
  dose: '800 mg',
  frequency: 'Five times daily (every 4 hours awake)',
  duration: '7 days',
  maxQuantity: 35,
  repeats: 0,
  contraindications: ['severe renal impairment'],
  cautions: ['High pill burden — adherence risk'],
  allergyConflicts: ['aciclovir', 'valaciclovir'],
  interactionFlags: ['nephrotoxic agents'],
  counsellingPoints: [
    'Take five times daily — set reminders',
    'Maintain hydration',
  ],
};

const scopeRules = [
  {
    id: 'age',
    label: 'Adult ≥ 18 years',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const dob = (d.patient as Record<string, string> | undefined)?.dob;
      if (!dob) return { status: 'needs_clarification', reason: 'DOB required' };
      const age = (Date.now() - new Date(dob).getTime()) / 31557600000;
      if (age < 18) return { status: 'out_of_scope', reason: 'Under 18 — refer to GP' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'onset_window',
    label: 'Within 72-hour onset window',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const onset = (d.symptoms as Record<string, string> | undefined)?.onsetWindow;
      if (!onset) return { status: 'needs_clarification', reason: 'Confirm rash onset window' };
      if (onset === 'over_72h') {
        return { status: 'out_of_scope', reason: 'Rash > 72h old — antivirals less effective; assess case-by-case / refer' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No critical red flags',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = HZ_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
      if (positives.length) return { status: 'out_of_scope', reason: `Positive red flag: ${positives[0]}` };
      return { status: 'in_scope' };
    },
  },
];

function generateNote(data: Record<string, unknown>): string {
  const p = (data.patient ?? {}) as Record<string, string>;
  const s = (data.symptoms ?? {}) as Record<string, string>;
  const rf = (data.redFlags ?? {}) as Record<string, string>;
  const tx = data.selectedTreatment as TreatmentOptionDefinition | undefined;
  const lines: string[] = [];
  const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '[patient]';

  lines.push(`PATIENT: ${fullName}${p.dob ? `, DOB ${p.dob}` : ''}`);
  lines.push('');
  lines.push('PRESENTING COMPLAINT');
  lines.push(`Patient presents with painful unilateral vesicular rash${s.dermatome ? ` involving ${s.dermatome} dermatome` : ''}${s.onsetWindow ? ` (onset ${s.onsetWindow.replace('_', ' ')})` : ''}.`);
  if (s.prodrome) lines.push(`Prodromal symptoms: ${s.prodrome}.`);
  if (s.painSeverity) lines.push(`Pain severity (NRS 0–10): ${s.painSeverity}.`);

  lines.push('');
  lines.push('RED FLAG SCREENING');
  const positives = HZ_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All red flags negative.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration} (qty ${tx.maxQuantity}).`);
    lines.push('Counselled on early initiation, hydration, post-herpetic neuralgia risk, and red flag escalation.');
  } else {
    lines.push('No antiviral supplied. Refer for medical review.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  if (data.safetyNet) lines.push(`SAFETY NET: ${data.safetyNet}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Herpes Zoster, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const herpesZosterTemplate: ConditionTemplate = {
  id: 'herpes-zoster',
  slug: 'herpes-zoster',
  name: 'Herpes Zoster',
  category: 'acute',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-HZ-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('herpes-zoster') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'symptoms', kind: 'presenting-complaint', label: 'Rash & Pain Assessment' },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Antiviral Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'eye_involvement', label: 'Rash involves tip of nose, forehead, or eye (Hutchinson sign)', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent ophthalmology / ED referral — risk of zoster ophthalmicus' },
    { id: 'ear_involvement_ramsay_hunt', label: 'Ear pain, facial weakness, or vesicles in ear canal', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent referral — possible Ramsay Hunt syndrome' },
    { id: 'disseminated_rash', label: 'Rash spread beyond a single dermatome / disseminated', severity: 'critical', blocksPrescribing: true,
      action: 'Refer urgently — disseminated zoster' },
    { id: 'severe_immunocompromise', label: 'Severe immunocompromise (haematological malignancy, transplant, high-dose immunosuppressant)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer to GP / specialist for IV antiviral consideration' },
    { id: 'pregnancy', label: 'Pregnant or possibly pregnant', severity: 'high', blocksPrescribing: true,
      action: 'Refer — antiviral choice and dosing requires medical review' },
    { id: 'paediatric', label: 'Patient under 18', severity: 'high', blocksPrescribing: true, action: 'Refer to GP / paediatric service' },
    { id: 'meningism_neuro_signs', label: 'Headache, neck stiffness, or new neurological signs', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent ED referral — possible CNS involvement' },
    { id: 'systemic_sepsis_signs', label: 'Fever, rigors, or systemically unwell', severity: 'critical', blocksPrescribing: true,
      action: 'Refer — systemic features beyond pharmacist scope' },
    { id: 'multidermatomal_rash', label: 'Rash crosses midline or spans multiple dermatomes', severity: 'high', blocksPrescribing: true,
      action: 'Refer — atypical presentation' },
    { id: 'severe_pain_uncontrolled', label: 'Severe pain unmanaged by simple analgesia', severity: 'moderate', blocksPrescribing: false,
      action: 'Counsel + advise GP review for analgesia escalation' },
  ],

  scopeRules,

  differentials: [
    { id: 'contact_dermatitis', label: 'Contact dermatitis', whenToSuspect: 'Pruritic rash without dermatomal pattern' },
    { id: 'cellulitis', label: 'Cellulitis', whenToSuspect: 'Diffuse erythema, warmth, no vesicles', referralOnHighSuspicion: true },
    { id: 'herpes_simplex', label: 'Herpes simplex', whenToSuspect: 'Recurrent vesicles in same site, often oral/genital' },
    { id: 'impetigo', label: 'Impetigo', whenToSuspect: 'Honey-coloured crust, no dermatomal distribution' },
    { id: 'allergic_reaction', label: 'Allergic reaction', whenToSuspect: 'Pruritic, generalised, recent exposure history' },
  ],

  treatments: [valaciclovir, famciclovir, aciclovir],

  counselling: [
    { id: 'early_start', label: 'Importance of early antiviral initiation (<72h)', required: true },
    { id: 'hydration', label: 'Maintain hydration', required: true },
    { id: 'pain_management', label: 'Simple analgesia for zoster pain', required: true },
    { id: 'phn_warning', label: 'Post-herpetic neuralgia possibility', required: true },
    { id: 'transmission', label: 'Cover rash; avoid contact with pregnant women, neonates, immunocompromised', required: true },
    { id: 'red_flag_escalation', label: 'Return immediately if eye/ear involvement, neuro symptoms, or rash spreads', required: true },
    { id: 'shingles_vaccination', label: 'Discuss shingles vaccination once acute episode resolves', required: false },
    { id: 'no_topical_steroids', label: 'Avoid topical corticosteroids on rash', required: true },
  ],

  documentation: {
    sections: [
      { id: 'patient', heading: 'Patient' },
      { id: 'complaint', heading: 'Presenting Complaint' },
      { id: 'red_flags', heading: 'Red Flag Screening' },
      { id: 'plan', heading: 'Plan' },
    ],
    generate: generateNote,
  },

  completionChecklist: [
    { id: 'patient', label: 'Patient profile complete', required: true,
      isComplete: (d) => {
        const p = (d.patient ?? {}) as Record<string, string>;
        return !!(p.firstName && p.lastName && p.dob && p.sex);
      } },
    { id: 'rash', label: 'Rash assessment documented (dermatome, onset window)', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, string>;
        return !!(s.dermatome && s.onsetWindow);
      } },
    { id: 'red_flags', label: 'All red flags answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return HZ_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'plan', label: 'Treatment or referral plan documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'follow_up', label: 'Follow-up + safety net documented', required: true,
      isComplete: (d) => !!d.followUpPlan && !!d.safetyNet },
  ],

  safetyWeights: {
    missingCriticalField: 20,
    unansweredRedFlag: 10,
    allergyConflict: 50,
    outOfScopeTreatment: 60,
    treatmentWithoutCounselling: 25,
    treatmentWithoutFollowUp: 20,
  },
};
