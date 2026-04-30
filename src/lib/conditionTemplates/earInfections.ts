/**
 * Ear Infections (AOE / uncomplicated AOM) — Condition Template
 * -------------------------------------------------------------
 * VIC pharmacist prescribing protocol (draft). Acute otitis externa
 * (swimmer's ear) in patients ≥ 12 years and uncomplicated acute
 * otitis media in patients ≥ 12 years (where local protocol allows).
 * Children < 12, perforated TM with discharge, mastoiditis, recurrent
 * otitis, or systemic illness are out of scope.
 *
 * Clinical alignment: Therapeutic Guidelines (Antibiotic) — Otitis,
 * AMH, Victorian CPSP. Status: `draft` / `needs_review`.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const EAR_RED_FLAG_IDS = [
  'systemic_unwell',
  'severe_pain_swelling_postauricular',
  'tm_perforation_discharge',
  'cranial_nerve_deficit',
  'recurrent_otitis',
  'tympanostomy_tubes',
  'immunocompromise',
  'malignant_otitis_externa_risk',
  'under_12_years',
  'hearing_loss_persistent',
] as const;

const ciproDex: TreatmentOptionDefinition = {
  id: 'cipro_dex_otic',
  medicineName: 'Ciprofloxacin 0.3% + dexamethasone 0.1% ear drops',
  line: 'first',
  dose: '4 drops',
  frequency: 'Twice daily',
  duration: '7 days',
  maxQuantity: 1,
  repeats: 0,
  pbsRestriction: 'Restricted benefit — acute otitis externa',
  contraindications: ['fluoroquinolone hypersensitivity', 'corticosteroid hypersensitivity', 'viral ear infection'],
  cautions: ['Confirm intact tympanic membrane before use', 'Avoid in suspected fungal otitis'],
  allergyConflicts: ['ciprofloxacin', 'fluoroquinolone', 'dexamethasone'],
  interactionFlags: [],
  counsellingPoints: [
    'Lie with affected ear up; instil 4 drops; remain in position 60 seconds',
    'Twice daily for 7 days — do not stop early',
    'Pain should improve in 48–72 h; return if worsening or no improvement at 72 h',
    'Keep ear dry — no swimming, use shower cap',
    'Do not use cotton buds',
  ],
  followUpAdvice: 'Review at 48–72 hours by phone or in-store; refer if no improvement.',
};

const framycetinGramicidinDex: TreatmentOptionDefinition = {
  id: 'fram_otic',
  medicineName: 'Framycetin + gramicidin + dexamethasone ear drops',
  line: 'second',
  dose: '3 drops',
  frequency: 'Three times daily',
  duration: '7 days',
  maxQuantity: 1,
  repeats: 0,
  pbsRestriction: 'Unrestricted',
  contraindications: ['perforated tympanic membrane', 'aminoglycoside hypersensitivity'],
  cautions: ['Ototoxicity if TM perforated — confirm intact', 'Limit duration to 7 days'],
  allergyConflicts: ['framycetin', 'aminoglycoside', 'neomycin'],
  interactionFlags: [],
  counsellingPoints: [
    'CONFIRM eardrum intact before use — risk of hearing damage if perforated',
    'Three drops three times daily for 7 days',
    'Keep ear dry; no swimming during treatment',
    'Return if no improvement in 72 hours, or hearing changes',
  ],
  followUpAdvice: 'Review at 72 hours; refer if no improvement.',
};

const amoxicillin: TreatmentOptionDefinition = {
  id: 'amoxicillin_aom',
  medicineName: 'Amoxicillin (uncomplicated AOM, ≥ 12 years)',
  line: 'first',
  dose: '500 mg',
  frequency: 'Three times daily',
  duration: '5 days',
  maxQuantity: 15,
  repeats: 0,
  pbsRestriction: 'Restricted benefit — acute otitis media',
  contraindications: ['penicillin hypersensitivity', 'infectious mononucleosis'],
  cautions: ['Watch for rash', 'Diarrhoea common'],
  allergyConflicts: ['amoxicillin', 'penicillin', 'beta-lactam'],
  interactionFlags: ['warfarin', 'methotrexate', 'allopurinol (rash)'],
  counsellingPoints: [
    '500 mg three times daily for 5 days — complete the course',
    'Take with or without food',
    'Return immediately if rash, hives, swelling, or breathing difficulty',
    'Most AOM resolves with simple analgesia — antibiotics shorten symptoms modestly',
    'Adequate paracetamol/ibuprofen for pain',
  ],
  followUpAdvice: 'Review at 48–72 h; refer if no improvement, perforation with discharge, or worsening.',
};

const scopeRules = [
  {
    id: 'age',
    label: 'Patient ≥ 12 years',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const dob = (d.patient as Record<string, string> | undefined)?.dob;
      if (!dob) return { status: 'needs_clarification', reason: 'DOB required' };
      const age = (Date.now() - new Date(dob).getTime()) / 31557600000;
      if (age < 12) return { status: 'out_of_scope', reason: 'Under 12 years — refer to GP' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'type_documented',
    label: 'Otitis type documented (externa vs media)',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const ty = (d.symptoms as Record<string, string> | undefined)?.otitisType;
      if (!ty) return { status: 'needs_clarification', reason: 'Document AOE vs AOM' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No critical red flags',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = EAR_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
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
  lines.push(`Ear infection — type ${s.otitisType ?? '[not documented]'}; side ${s.side ?? '[not documented]'}; duration ${s.duration ?? '[not documented]'}.`);
  if (s.painScore) lines.push(`Pain score (0–10): ${s.painScore}.`);
  if (s.discharge) lines.push(`Discharge: ${s.discharge}.`);
  if (s.hearingChange) lines.push(`Hearing change: ${s.hearingChange}.`);
  if (s.tmStatus) lines.push(`Tympanic membrane: ${s.tmStatus}.`);

  lines.push('');
  lines.push('RED FLAG SCREENING');
  const positives = EAR_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All red flags negative. No systemic features, no postauricular swelling, TM intact, no recurrent otitis, no immunocompromise.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration} (qty ${tx.maxQuantity}).`);
    lines.push('Counselled on instillation technique / dosing, ear-dry precautions, and return advice.');
  } else {
    lines.push('No antimicrobial supplied. Analgesia + safety-net advice provided.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  if (data.safetyNet) lines.push(`SAFETY NET: ${data.safetyNet}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Ear Infections, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const earInfectionsTemplate: ConditionTemplate = {
  id: 'ear-infections',
  slug: 'ear-infections',
  name: 'Ear Infections (AOE / AOM)',
  category: 'acute',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-EAR-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('ear-infections') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'symptoms', kind: 'presenting-complaint', label: 'Otologic Assessment' },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Antimicrobial Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'systemic_unwell', label: 'Fever > 38.5 °C or systemically unwell', severity: 'critical', blocksPrescribing: true,
      action: 'Refer urgently — possible mastoiditis or systemic infection' },
    { id: 'severe_pain_swelling_postauricular', label: 'Postauricular swelling, redness, or protruding ear', severity: 'critical', blocksPrescribing: true,
      action: 'URGENT referral — suspected mastoiditis' },
    { id: 'tm_perforation_discharge', label: 'Tympanic membrane perforation with purulent discharge', severity: 'high', blocksPrescribing: true,
      action: 'Refer — needs medical review and culture' },
    { id: 'cranial_nerve_deficit', label: 'Facial weakness, vertigo, or other cranial nerve deficit', severity: 'critical', blocksPrescribing: true,
      action: 'URGENT referral — possible intracranial complication' },
    { id: 'recurrent_otitis', label: 'Recurrent otitis (≥ 3 episodes in 6 months)', severity: 'moderate', blocksPrescribing: true,
      action: 'Refer to GP/ENT for further investigation' },
    { id: 'tympanostomy_tubes', label: 'Grommets / tympanostomy tubes in situ', severity: 'high', blocksPrescribing: true,
      action: 'Refer — choice of drops affected by tube presence' },
    { id: 'immunocompromise', label: 'Immunocompromise (chemo, transplant, biologics, diabetes uncontrolled)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer — risk of malignant otitis externa' },
    { id: 'malignant_otitis_externa_risk', label: 'Severe pain disproportionate to findings, especially in elderly diabetic', severity: 'critical', blocksPrescribing: true,
      action: 'URGENT referral — exclude malignant otitis externa' },
    { id: 'under_12_years', label: 'Patient under 12 years', severity: 'high', blocksPrescribing: true,
      action: 'Refer to GP/paediatrics' },
    { id: 'hearing_loss_persistent', label: 'Persistent hearing loss > 4 weeks', severity: 'moderate', blocksPrescribing: true,
      action: 'Refer for audiology / ENT review' },
  ],

  scopeRules,

  differentials: [
    { id: 'aoe', label: 'Acute otitis externa', whenToSuspect: 'Tragal tenderness, ear canal swelling/discharge, recent water exposure' },
    { id: 'aom', label: 'Acute otitis media', whenToSuspect: 'Bulging erythematous TM, deep ear pain, recent URTI' },
    { id: 'ome', label: 'Otitis media with effusion (glue ear)', whenToSuspect: 'Hearing loss, retracted TM, no acute pain' },
    { id: 'foreign_body', label: 'Foreign body / impacted cerumen', whenToSuspect: 'Sudden hearing loss, discomfort, history of insertion', referralOnHighSuspicion: true },
    { id: 'fungal_otitis', label: 'Otomycosis (fungal)', whenToSuspect: 'Black/white spores in canal, chronic itch, prior antibiotic drops' },
    { id: 'tmj', label: 'Temporomandibular joint dysfunction', whenToSuspect: 'Pain on chewing, jaw clicking, normal TM' },
  ],

  treatments: [ciproDex, framycetinGramicidinDex, amoxicillin],

  counselling: [
    { id: 'instillation', label: 'Drop instillation technique demonstrated', required: true },
    { id: 'dry_ear', label: 'Keep ear dry — no swimming / shower cap', required: true },
    { id: 'no_cotton_buds', label: 'Avoid cotton buds and ear candling', required: true },
    { id: 'analgesia', label: 'Adequate paracetamol/ibuprofen for pain', required: true },
    { id: 'tm_warning', label: 'Aminoglycoside drops only if TM intact', required: true },
    { id: 'red_flag_return', label: 'Return if fever, severe pain, postauricular swelling, dizziness, or facial weakness', required: true },
    { id: 'antibiotic_stewardship', label: 'Most AOM resolves without antibiotics — consider delayed script', required: false },
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
    { id: 'otologic', label: 'Otitis type, side, duration, TM status documented', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, string>;
        return !!(s.otitisType && s.side && s.tmStatus);
      } },
    { id: 'red_flags', label: 'All red flags answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return EAR_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'plan', label: 'Treatment or referral plan documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'follow_up', label: 'Follow-up + safety net documented', required: true,
      isComplete: (d) => !!d.followUpPlan && !!d.safetyNet },
  ],

  safetyWeights: {
    missingCriticalField: 18,
    unansweredRedFlag: 12,
    allergyConflict: 50,
    outOfScopeTreatment: 60,
    treatmentWithoutCounselling: 22,
    treatmentWithoutFollowUp: 18,
  },
};
