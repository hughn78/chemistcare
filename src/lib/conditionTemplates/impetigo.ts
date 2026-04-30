/**
 * Impetigo — Condition Template
 * -----------------------------
 * VIC pharmacist prescribing protocol (draft). Localised non-bullous
 * impetigo in otherwise well patients ≥ 2 years; widespread, bullous,
 * facial periorbital, recurrent, or systemic disease is out of scope.
 *
 * Clinical alignment: Therapeutic Guidelines (Antibiotic) — Impetigo,
 * AMH, Victorian CPSP. All clinical content is `protocolStatus: 'draft'`
 * and `needs_review` until clinically signed off.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const IMP_RED_FLAG_IDS = [
  'systemic_unwell',
  'cellulitis_features',
  'periorbital_facial',
  'extensive_lesions',
  'bullous_impetigo',
  'recurrent_episodes',
  'immunocompromise',
  'mrsa_risk',
  'under_2_years',
  'pregnancy_breastfeeding_complex',
] as const;

const mupirocin: TreatmentOptionDefinition = {
  id: 'mupirocin',
  medicineName: 'Mupirocin 2% ointment',
  line: 'first',
  dose: 'Apply pea-sized amount',
  frequency: 'Three times daily',
  duration: '5 days',
  maxQuantity: 1,
  repeats: 0,
  pbsRestriction: 'Unrestricted',
  contraindications: ['mupirocin hypersensitivity'],
  cautions: ['Avoid in extensive disease', 'Not for mucosal use'],
  allergyConflicts: ['mupirocin'],
  interactionFlags: [],
  counsellingPoints: [
    'Wash hands before and after applying',
    'Apply a thin layer to all affected areas three times daily for 5 days',
    'Cover lesions with a light dressing where practical',
    'Do not share towels, bedding, or clothing until lesions are crusted over',
    'Keep child home from school/childcare until 24 hours of treatment completed',
  ],
  followUpAdvice: 'Review in 5–7 days; refer if not improving, worsening, or new systemic features.',
};

const cefalexin: TreatmentOptionDefinition = {
  id: 'cefalexin',
  medicineName: 'Cefalexin',
  line: 'second',
  dose: '500 mg (adult) / 25 mg/kg (paediatric, max 500 mg)',
  frequency: 'Twice daily',
  duration: '5 days',
  maxQuantity: 10,
  repeats: 0,
  pbsRestriction: 'Restricted benefit',
  contraindications: ['cephalosporin hypersensitivity', 'severe penicillin anaphylaxis'],
  cautions: ['Adjust in severe renal impairment', 'GI upset common'],
  allergyConflicts: ['cefalexin', 'cephalosporin', 'penicillin'],
  interactionFlags: ['warfarin', 'metformin'],
  counsellingPoints: [
    'Take twice daily for 5 days — complete the course',
    'Take with or without food; if upset stomach, take with food',
    'Return if rash, hives, swelling, or breathing difficulty develops',
    'Hygiene measures (handwashing, no sharing of towels) still required',
  ],
  followUpAdvice: 'Review in 5–7 days; refer if no improvement or worsening.',
};

const trimSulfa: TreatmentOptionDefinition = {
  id: 'trim_sulfa',
  medicineName: 'Trimethoprim+Sulfamethoxazole',
  line: 'third',
  dose: '160/800 mg (adult) / 4+20 mg/kg (paediatric, max 160/800)',
  frequency: 'Twice daily',
  duration: '3 days',
  maxQuantity: 6,
  repeats: 0,
  pbsRestriction: 'Restricted benefit — suspected MRSA',
  contraindications: ['sulfonamide hypersensitivity', 'severe renal impairment', 'pregnancy (1st & 3rd trimester)', 'G6PD deficiency'],
  cautions: ['Photosensitivity', 'Hyperkalaemia risk'],
  allergyConflicts: ['sulfa', 'sulfamethoxazole', 'trimethoprim'],
  interactionFlags: ['warfarin', 'methotrexate', 'ACE inhibitor', 'ARB', 'spironolactone'],
  counsellingPoints: [
    'Take twice daily for 3 days with a full glass of water',
    'Avoid prolonged sun exposure — use sunscreen',
    'Return if rash, mouth ulcers, or feeling unwell',
  ],
  followUpAdvice: 'Review in 5 days; refer if not improving — consider swab for MRSA confirmation.',
};

const scopeRules = [
  {
    id: 'age',
    label: 'Patient ≥ 2 years',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const dob = (d.patient as Record<string, string> | undefined)?.dob;
      if (!dob) return { status: 'needs_clarification', reason: 'DOB required' };
      const age = (Date.now() - new Date(dob).getTime()) / 31557600000;
      if (age < 2) return { status: 'out_of_scope', reason: 'Under 2 years — refer to GP' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'extent',
    label: 'Localised disease (≤ 3 lesions, ≤ 1% BSA)',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const ex = (d.symptoms as Record<string, string> | undefined)?.extent;
      if (!ex) return { status: 'needs_clarification', reason: 'Document lesion extent' };
      if (ex === 'extensive' || ex === 'multiple_sites') {
        return { status: 'out_of_scope', reason: 'Extensive disease — oral therapy under medical review' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No critical red flags',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = IMP_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
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
  lines.push(`Patient presents with localised impetiginous lesions${s.location ? ` on ${s.location}` : ''}${s.duration ? ` (duration ${s.duration})` : ''}.`);
  if (s.appearance) lines.push(`Appearance: ${s.appearance}.`);
  if (s.extent) lines.push(`Extent: ${s.extent.replace('_', ' ')}.`);

  lines.push('');
  lines.push('RED FLAG SCREENING');
  const positives = IMP_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All red flags negative. No systemic features, no cellulitis, not periorbital/facial, not bullous, not recurrent.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration} (qty ${tx.maxQuantity}).`);
    lines.push('Counselled on application/dosing, hygiene, and return precautions.');
  } else {
    lines.push('No antimicrobial supplied. Refer for medical review.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  if (data.safetyNet) lines.push(`SAFETY NET: ${data.safetyNet}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Impetigo, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const impetigoTemplate: ConditionTemplate = {
  id: 'impetigo',
  slug: 'impetigo',
  name: 'Impetigo',
  category: 'acute',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-IMP-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('impetigo') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'symptoms', kind: 'presenting-complaint', label: 'Lesion Assessment' },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Antimicrobial Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'systemic_unwell', label: 'Fever or systemically unwell', severity: 'critical', blocksPrescribing: true,
      action: 'Refer urgently — systemic infection beyond pharmacist scope' },
    { id: 'cellulitis_features', label: 'Surrounding cellulitis (spreading erythema, warmth, pain)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer — cellulitis requires oral antibiotics under medical review' },
    { id: 'periorbital_facial', label: 'Periorbital or extensive facial involvement', severity: 'critical', blocksPrescribing: true,
      action: 'Refer urgently — risk of orbital/facial cellulitis' },
    { id: 'extensive_lesions', label: 'More than 3 lesions or > 1% body surface area', severity: 'high', blocksPrescribing: true,
      action: 'Refer — extensive disease needs oral therapy' },
    { id: 'bullous_impetigo', label: 'Bullous lesions (large, fluid-filled blisters)', severity: 'high', blocksPrescribing: true,
      action: 'Refer — bullous impetigo needs medical management' },
    { id: 'recurrent_episodes', label: 'Recurrent impetigo (≥ 3 episodes/year)', severity: 'moderate', blocksPrescribing: true,
      action: 'Refer for decolonisation work-up' },
    { id: 'immunocompromise', label: 'Immunocompromise (chemo, transplant, biologics, advanced HIV)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer — needs medical review' },
    { id: 'mrsa_risk', label: 'Known MRSA colonisation / recent MRSA contact', severity: 'high', blocksPrescribing: false,
      action: 'Consider trimethoprim+sulfamethoxazole; refer for swab if unsure' },
    { id: 'under_2_years', label: 'Patient under 2 years', severity: 'high', blocksPrescribing: true,
      action: 'Refer to GP / paediatric service' },
    { id: 'pregnancy_breastfeeding_complex', label: 'Pregnant or breastfeeding with complex therapy needs', severity: 'moderate', blocksPrescribing: false,
      action: 'Mupirocin acceptable; avoid trimethoprim+sulfamethoxazole — consider GP' },
  ],

  scopeRules,

  differentials: [
    { id: 'eczema_secondary', label: 'Infected eczema', whenToSuspect: 'Pre-existing dermatitis with new crusting' },
    { id: 'herpes_simplex', label: 'Herpes simplex', whenToSuspect: 'Grouped vesicles, recurrent in same site' },
    { id: 'cellulitis', label: 'Cellulitis', whenToSuspect: 'Diffuse spreading erythema without honey crust', referralOnHighSuspicion: true },
    { id: 'tinea', label: 'Tinea (fungal)', whenToSuspect: 'Annular scaling lesion, no crust' },
    { id: 'scabies_secondary', label: 'Secondary infection of scabies', whenToSuspect: 'Generalised itch, burrows, household contacts affected' },
  ],

  treatments: [mupirocin, cefalexin, trimSulfa],

  counselling: [
    { id: 'application', label: 'Correct application technique (thin layer, three times daily)', required: true },
    { id: 'hygiene', label: 'Hand hygiene + avoid scratching', required: true },
    { id: 'no_sharing', label: 'Do not share towels, bedding, or clothing', required: true },
    { id: 'school_exclusion', label: 'School/childcare exclusion until 24h post-treatment + lesions covered', required: true },
    { id: 'complete_course', label: 'Complete the full course even if improving', required: true },
    { id: 'red_flag_escalation', label: 'Return if fever, spreading redness, or worsening', required: true },
    { id: 'avoid_topical_steroid', label: 'Do not apply topical corticosteroids on lesions', required: false },
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
    { id: 'lesion', label: 'Lesion assessment documented (location, extent, appearance)', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, string>;
        return !!(s.location && s.extent);
      } },
    { id: 'red_flags', label: 'All red flags answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return IMP_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
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
