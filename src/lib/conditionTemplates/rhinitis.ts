/**
 * Allergic and Non-allergic Rhinitis — Condition Template
 * -------------------------------------------------------
 * VIC pharmacist prescribing protocol (draft). Covers persistent /
 * intermittent rhinitis in adults and children ≥ 2 years (intranasal
 * corticosteroid age limits noted per agent). Sinusitis features,
 * unilateral symptoms, or systemic disease are out of scope.
 *
 * Clinical alignment: ARIA, Therapeutic Guidelines (Respiratory),
 * AMH, Victorian CPSP. `protocolStatus: 'draft'` until clinical sign-off.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const RHN_RED_FLAG_IDS = [
  'unilateral_symptoms',
  'bloody_purulent_discharge',
  'severe_facial_pain',
  'visual_disturbance',
  'persistent_fever',
  'nasal_polyps_known',
  'nasal_septum_perforation',
  'pregnancy_first_trimester_steroid',
  'under_2_years',
  'asthma_uncontrolled',
] as const;

const mometasone: TreatmentOptionDefinition = {
  id: 'mometasone',
  medicineName: 'Mometasone furoate nasal spray 50 mcg/actuation',
  line: 'first',
  dose: '2 sprays each nostril',
  frequency: 'Once daily',
  duration: 'Up to 6 months (review at 3 months)',
  maxQuantity: 1,
  repeats: 2,
  pbsRestriction: 'Unrestricted',
  contraindications: ['recent nasal surgery', 'untreated nasal infection'],
  cautions: ['Onset 3–7 days; full effect 2 weeks', 'Children: limit to age ≥ 3 (mometasone)'],
  allergyConflicts: ['mometasone', 'corticosteroid intranasal'],
  interactionFlags: ['strong CYP3A4 inhibitors (e.g. ritonavir, ketoconazole)'],
  counsellingPoints: [
    'Use daily for at least 2 weeks for full benefit — not as-needed',
    'Prime the spray when new and after a week unused',
    'Aim the nozzle slightly outward, away from the septum, breathe gently',
    'Do not sniff hard after spraying — let it sit',
    'Common side effects: mild nosebleed, throat irritation; review if persistent',
  ],
  followUpAdvice: 'Review at 4 weeks; if poor response, check technique then consider add-on antihistamine.',
};

const fluticasone: TreatmentOptionDefinition = {
  id: 'fluticasone',
  medicineName: 'Fluticasone furoate nasal spray 27.5 mcg/actuation',
  line: 'first',
  dose: '2 sprays each nostril',
  frequency: 'Once daily',
  duration: 'Up to 6 months (review at 3 months)',
  maxQuantity: 1,
  repeats: 2,
  pbsRestriction: 'Unrestricted',
  contraindications: ['recent nasal surgery', 'untreated nasal infection'],
  cautions: ['Onset 3–7 days; full effect 2 weeks'],
  allergyConflicts: ['fluticasone', 'corticosteroid intranasal'],
  interactionFlags: ['strong CYP3A4 inhibitors'],
  counsellingPoints: [
    'Use daily — not as-needed',
    'Correct technique: nozzle pointed away from septum',
    'May reduce to 1 spray per nostril once symptoms controlled',
  ],
};

const cetirizine: TreatmentOptionDefinition = {
  id: 'cetirizine',
  medicineName: 'Cetirizine',
  line: 'second',
  dose: '10 mg (adult) / 5 mg (6–12 yrs) / 2.5 mg (2–6 yrs)',
  frequency: 'Once daily',
  duration: 'As required during symptomatic period',
  maxQuantity: 30,
  repeats: 2,
  pbsRestriction: 'Unrestricted',
  contraindications: ['severe renal impairment'],
  cautions: ['Mild sedation possible', 'Reduce dose if CrCl < 30'],
  allergyConflicts: ['cetirizine', 'hydroxyzine', 'levocetirizine'],
  interactionFlags: ['CNS depressants', 'alcohol'],
  counsellingPoints: [
    'Take once daily; works within 1–2 hours',
    'Less sedating than older antihistamines but may still cause drowsiness',
    'Best added to intranasal steroid if itch/sneeze remains prominent',
  ],
};

const azelastineFluticasone: TreatmentOptionDefinition = {
  id: 'azelastine_fluticasone',
  medicineName: 'Azelastine + Fluticasone nasal spray',
  line: 'third',
  dose: '1 spray each nostril',
  frequency: 'Twice daily',
  duration: 'Up to 6 months (review at 3 months)',
  maxQuantity: 1,
  repeats: 2,
  pbsRestriction: 'Restricted — moderate–severe persistent allergic rhinitis inadequately controlled on monotherapy',
  contraindications: ['recent nasal surgery', 'children < 12 years'],
  cautions: ['Bitter taste reported', 'Onset within hours'],
  allergyConflicts: ['azelastine', 'fluticasone'],
  interactionFlags: ['CNS depressants', 'strong CYP3A4 inhibitors'],
  counsellingPoints: [
    'Use morning and evening — combination of antihistamine + steroid',
    'Bitter taste is common; tilt head forward when spraying',
    'Indicated when single-agent therapy has failed',
  ],
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
    id: 'duration',
    label: 'Clearly rhinitis (not acute sinusitis)',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const s = (d.symptoms as Record<string, string> | undefined) ?? {};
      if (s.facialPain === 'severe' || s.discharge === 'purulent_unilateral') {
        return { status: 'out_of_scope', reason: 'Features suggest sinusitis — refer for medical review' };
      }
      if (!s.pattern) return { status: 'needs_clarification', reason: 'Document symptom pattern (intermittent / persistent)' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No critical red flags',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = RHN_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
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
  lines.push(`Patient presents with rhinitis symptoms: ${s.symptoms ?? 'congestion / rhinorrhoea / sneeze / itch'}.`);
  if (s.pattern) lines.push(`Pattern: ${s.pattern.replace('_', ' ')} (ARIA classification).`);
  if (s.severity) lines.push(`Severity: ${s.severity}.`);
  if (s.triggers) lines.push(`Triggers: ${s.triggers}.`);
  if (s.priorTherapy) lines.push(`Prior therapy: ${s.priorTherapy}.`);

  lines.push('');
  lines.push('RED FLAG SCREENING');
  const positives = RHN_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All red flags negative. No unilateral symptoms, bloody/purulent discharge, severe facial pain, or visual disturbance.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration}.`);
    lines.push('Counselled on technique, expected onset (intranasal steroid 3–7 days), and adherence.');
  } else {
    lines.push('No medicine supplied. Refer for medical review.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  if (data.safetyNet) lines.push(`SAFETY NET: ${data.safetyNet}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Rhinitis, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const rhinitisTemplate: ConditionTemplate = {
  id: 'rhinitis',
  slug: 'allergic-and-non-allergic-rhinitis',
  name: 'Allergic and Non-allergic Rhinitis',
  category: 'acute',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-RHN-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('rhinitis') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'symptoms', kind: 'presenting-complaint', label: 'Symptom Pattern (ARIA)' },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Therapy Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'unilateral_symptoms', label: 'Persistent unilateral nasal symptoms', severity: 'high', blocksPrescribing: true,
      action: 'Refer — exclude anatomical lesion / foreign body / tumour' },
    { id: 'bloody_purulent_discharge', label: 'Bloody or persistently purulent discharge', severity: 'high', blocksPrescribing: true,
      action: 'Refer — exclude bacterial sinusitis / lesion' },
    { id: 'severe_facial_pain', label: 'Severe facial pain or pressure (especially unilateral)', severity: 'high', blocksPrescribing: true,
      action: 'Refer — possible sinusitis' },
    { id: 'visual_disturbance', label: 'Visual changes, eye swelling, or proptosis', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent ED referral — orbital involvement' },
    { id: 'persistent_fever', label: 'Persistent fever > 38°C', severity: 'high', blocksPrescribing: true,
      action: 'Refer — systemic features beyond pharmacist scope' },
    { id: 'nasal_polyps_known', label: 'Known nasal polyps', severity: 'moderate', blocksPrescribing: false,
      action: 'INCS appropriate but flag for ENT review if persistent' },
    { id: 'nasal_septum_perforation', label: 'Known septal perforation', severity: 'high', blocksPrescribing: true,
      action: 'Avoid INCS without ENT advice' },
    { id: 'pregnancy_first_trimester_steroid', label: 'First-trimester pregnancy and considering INCS', severity: 'moderate', blocksPrescribing: false,
      action: 'Prefer cromoglycate or saline; INCS only if benefit > risk — refer if uncertain' },
    { id: 'under_2_years', label: 'Patient under 2 years', severity: 'high', blocksPrescribing: true,
      action: 'Refer — paediatric review required' },
    { id: 'asthma_uncontrolled', label: 'Uncontrolled or severe asthma', severity: 'high', blocksPrescribing: true,
      action: 'Refer — review asthma management with GP' },
  ],

  scopeRules,

  differentials: [
    { id: 'sinusitis', label: 'Acute bacterial sinusitis', whenToSuspect: 'Severe unilateral facial pain, purulent discharge > 10 days, fever', referralOnHighSuspicion: true },
    { id: 'common_cold', label: 'Viral URTI', whenToSuspect: 'Acute onset, sore throat, < 10 days, no atopic history' },
    { id: 'vasomotor_rhinitis', label: 'Vasomotor (non-allergic) rhinitis', whenToSuspect: 'Triggers: temperature, smells, food; no atopy' },
    { id: 'rhinitis_medicamentosa', label: 'Rhinitis medicamentosa', whenToSuspect: 'Long-term decongestant nasal spray use' },
    { id: 'nasal_polyps', label: 'Nasal polyposis', whenToSuspect: 'Anosmia, persistent obstruction, asthma comorbidity', referralOnHighSuspicion: true },
  ],

  treatments: [mometasone, fluticasone, cetirizine, azelastineFluticasone],

  counselling: [
    { id: 'technique', label: 'Correct intranasal spray technique', required: true },
    { id: 'adherence', label: 'Daily use required — not as-needed', required: true },
    { id: 'onset', label: 'Onset 3–7 days, full effect 2 weeks', required: true },
    { id: 'allergen_avoidance', label: 'Allergen avoidance + saline rinses', required: true },
    { id: 'no_decongestant_overuse', label: 'Avoid topical decongestants > 5 days (rebound)', required: true },
    { id: 'red_flag_escalation', label: 'Return if unilateral symptoms, bleeding, severe facial pain, or visual change', required: true },
    { id: 'asthma_link', label: 'If asthmatic, ensure asthma plan up to date', required: false },
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
    { id: 'symptoms', label: 'ARIA symptom pattern documented', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, string>;
        return !!(s.pattern && s.severity);
      } },
    { id: 'red_flags', label: 'All red flags answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return RHN_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'plan', label: 'Treatment or referral plan documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'follow_up', label: 'Follow-up + safety net documented', required: true,
      isComplete: (d) => !!d.followUpPlan && !!d.safetyNet },
  ],

  safetyWeights: {
    missingCriticalField: 15,
    unansweredRedFlag: 10,
    allergyConflict: 40,
    outOfScopeTreatment: 50,
    treatmentWithoutCounselling: 20,
    treatmentWithoutFollowUp: 15,
  },
};
