/**
 * Smoking Cessation — Condition Template
 * ---------------------------------------
 * Pharmacist-led smoking cessation service combining behavioural
 * support, dependence screening (Heaviness of Smoking Index / FTND),
 * and pharmacotherapy selection (NRT, varenicline, bupropion).
 *
 * Clinical alignment: RACGP Smoking Cessation Guidelines, AMH,
 * Therapeutic Guidelines. Status = draft pending clinical sign-off.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const SC_RED_FLAG_IDS = [
  'recent_mi_stroke', 'serious_arrhythmia', 'pregnancy_breastfeeding',
  'paediatric', 'severe_psychiatric_unstable', 'seizure_history_bupropion',
  'eating_disorder_bupropion', 'severe_renal_hepatic',
] as const;
type ScRedFlagId = (typeof SC_RED_FLAG_IDS)[number];

const nrtCombination: TreatmentOptionDefinition = {
  id: 'nrt-combination',
  medicineName: 'NRT — patch + short-acting (combination)',
  line: 'first',
  dose: '21 mg/24h patch + 2 mg lozenge/gum PRN',
  frequency: 'Patch daily; PRN for cravings',
  duration: '8–12 weeks with taper',
  maxQuantity: 1,
  repeats: 2,
  pbsRestriction: 'PBS subsidised — varies by formulation',
  contraindications: ['recent MI < 2 weeks', 'unstable angina', 'serious arrhythmia'],
  cautions: ['Caution in cardiovascular disease', 'Skin sensitivity for patch'],
  allergyConflicts: ['nicotine'],
  interactionFlags: ['caffeine', 'theophylline', 'clozapine', 'olanzapine'],
  counsellingPoints: [
    'Apply patch to clean dry skin in the morning; rotate sites',
    'Use short-acting (gum/lozenge) for cravings on top of patch',
    'Stop smoking on the chosen quit date; do NOT smoke while wearing patch',
    'Side effects: skin irritation, vivid dreams, nausea',
    'Plan a 3-month taper',
  ],
  followUpAdvice: 'Schedule follow-up in 1 week, then 4 and 12 weeks.',
};

const varenicline: TreatmentOptionDefinition = {
  id: 'varenicline',
  medicineName: 'Varenicline',
  line: 'first',
  dose: '0.5 mg → titrated to 1 mg',
  frequency: 'Twice daily',
  duration: '12 weeks',
  maxQuantity: 56,
  repeats: 2,
  pbsRestriction: 'PBS Authority — smoking cessation',
  contraindications: ['severe renal impairment', 'severe psychiatric instability'],
  cautions: ['Monitor for mood changes / suicidal ideation', 'May worsen CV disease'],
  allergyConflicts: ['varenicline'],
  interactionFlags: ['cimetidine'],
  counsellingPoints: [
    'Start 1 week before quit date; titrate over first week',
    'Take with food and a full glass of water to reduce nausea',
    'Stop and report immediately: changes in mood, agitation, suicidal thoughts',
    'May cause vivid dreams',
  ],
};

const bupropion: TreatmentOptionDefinition = {
  id: 'bupropion',
  medicineName: 'Bupropion SR',
  line: 'second',
  dose: '150 mg → 150 mg twice daily after 3 days',
  frequency: 'Twice daily (≥ 8h apart)',
  duration: '7–9 weeks',
  maxQuantity: 60,
  repeats: 1,
  pbsRestriction: 'PBS Authority — smoking cessation',
  contraindications: ['seizure disorder', 'eating disorder (current/past)', 'MAOI use within 14 days', 'abrupt alcohol/benzo withdrawal'],
  cautions: ['Lowers seizure threshold', 'Insomnia common'],
  allergyConflicts: ['bupropion'],
  interactionFlags: ['MAOI', 'tamoxifen', 'metoprolol', 'tricyclic antidepressants'],
  counsellingPoints: [
    'Start 1–2 weeks before quit date',
    'Take morning + late afternoon (avoid bedtime — insomnia)',
    'Stop immediately if seizure occurs',
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
    id: 'red_flags',
    label: 'No critical red flags',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = SC_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
      if (positives.includes('recent_mi_stroke') || positives.includes('serious_arrhythmia') ||
          positives.includes('pregnancy_breastfeeding') || positives.includes('paediatric') ||
          positives.includes('severe_psychiatric_unstable')) {
        return { status: 'out_of_scope', reason: `Refer: ${positives[0]}` };
      }
      return { status: 'in_scope' };
    },
  },
];

function generateNote(data: Record<string, unknown>): string {
  const p = (data.patient ?? {}) as Record<string, string>;
  const h = (data.history ?? {}) as Record<string, string>;
  const dep = (data.dependence ?? {}) as Record<string, string>;
  const tx = data.selectedTreatment as TreatmentOptionDefinition | undefined;
  const lines: string[] = [];
  const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '[patient]';

  lines.push(`PATIENT: ${fullName}${p.dob ? `, DOB ${p.dob}` : ''}`);
  lines.push('');
  lines.push('SMOKING HISTORY');
  if (h.cigarettesPerDay) lines.push(`Cigarettes per day: ${h.cigarettesPerDay}.`);
  if (h.yearsSmoking) lines.push(`Years smoking: ${h.yearsSmoking}.`);
  if (h.priorQuitAttempts) lines.push(`Prior quit attempts: ${h.priorQuitAttempts}.`);
  if (h.priorPharmacotherapy) lines.push(`Prior pharmacotherapy: ${h.priorPharmacotherapy}.`);
  if (h.triggers) lines.push(`Triggers: ${h.triggers}.`);

  lines.push('');
  lines.push('DEPENDENCE');
  if (dep.timeToFirstCigarette) lines.push(`Time to first cigarette of the day: ${dep.timeToFirstCigarette}.`);
  if (dep.htsiScore) lines.push(`HSI score: ${dep.htsiScore}/6 (${Number(dep.htsiScore) >= 4 ? 'high' : 'low–moderate'} dependence).`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Pharmacotherapy: ${tx.medicineName} — ${tx.dose}, ${tx.frequency} for ${tx.duration}.`);
    lines.push(`Quit date set: ${(data.quitDate as string) ?? '[not set]'}.`);
    lines.push('Behavioural support agreed; follow-up scheduled.');
  } else {
    lines.push('Behavioural support only at this visit; no pharmacotherapy initiated.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Smoking Cessation, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const smokingCessationTemplate: ConditionTemplate = {
  id: 'smoking-cessation',
  slug: 'smoking-cessation',
  name: 'Smoking Cessation',
  category: 'preventive',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-SC-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'RACGP Smoking Cessation Guidelines + Vic CPSP (draft)',
  legacyCondition: getConditionById('smoking-cessation') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'history', kind: 'presenting-complaint', label: 'Smoking History' },
    { id: 'dependence', kind: 'presenting-complaint', label: 'Dependence Screening' },
    { id: 'red-flags', kind: 'red-flags', label: 'Contraindication Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Pharmacotherapy Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Behavioural Plan & Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'recent_mi_stroke', label: 'Recent MI or stroke (< 2 weeks)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer for medical assessment before initiating pharmacotherapy' },
    { id: 'serious_arrhythmia', label: 'Serious cardiac arrhythmia', severity: 'high', blocksPrescribing: true,
      action: 'Refer to GP for review of pharmacotherapy choice' },
    { id: 'pregnancy_breastfeeding', label: 'Pregnant or breastfeeding', severity: 'high', blocksPrescribing: true,
      action: 'Refer — pharmacotherapy choice requires medical input' },
    { id: 'paediatric', label: 'Patient under 18', severity: 'critical', blocksPrescribing: true,
      action: 'Refer to GP / youth health service' },
    { id: 'severe_psychiatric_unstable', label: 'Severe psychiatric illness, currently unstable', severity: 'high', blocksPrescribing: true,
      action: 'Refer to GP / mental health team — varenicline / bupropion need monitoring' },
    { id: 'seizure_history_bupropion', label: 'History of seizures (bupropion contraindicated)', severity: 'high', blocksPrescribing: false,
      action: 'Avoid bupropion; choose NRT or varenicline' },
    { id: 'eating_disorder_bupropion', label: 'Current/past eating disorder (bupropion contraindicated)', severity: 'high', blocksPrescribing: false,
      action: 'Avoid bupropion' },
    { id: 'severe_renal_hepatic', label: 'Severe renal or hepatic impairment', severity: 'high', blocksPrescribing: true,
      action: 'Refer — dosing adjustment / specialist input needed' },
  ],

  scopeRules,

  differentials: [],

  treatments: [nrtCombination, varenicline, bupropion],

  counselling: [
    { id: 'quit_date', label: 'Quit date set and recorded', required: true },
    { id: 'behavioural_techniques', label: 'Behavioural techniques discussed (delay, distract, deep breath)', required: true },
    { id: 'trigger_planning', label: 'High-risk situations and trigger plan', required: true },
    { id: 'withdrawal_expectations', label: 'Withdrawal symptoms and timeline explained', required: true },
    { id: 'medication_use', label: 'Pharmacotherapy use, side effects, and duration', required: true },
    { id: 'support_resources', label: 'Quitline 13 7848 and support resources offered', required: true },
    { id: 'relapse_plan', label: 'Plan if slip / relapse occurs', required: true },
    { id: 'follow_up_schedule', label: 'Follow-up at 1, 4, 12 weeks scheduled', required: true },
    { id: 'co_morbid_med_review', label: 'Reviewed medicines affected by smoking cessation (e.g. clozapine, theophylline)', required: false },
  ],

  documentation: {
    sections: [
      { id: 'patient', heading: 'Patient' },
      { id: 'history', heading: 'Smoking History' },
      { id: 'dependence', heading: 'Dependence' },
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
    { id: 'history', label: 'Smoking history documented', required: true,
      isComplete: (d) => {
        const h = (d.history ?? {}) as Record<string, string>;
        return !!(h.cigarettesPerDay && h.yearsSmoking);
      } },
    { id: 'dependence', label: 'Dependence assessment recorded', required: true,
      isComplete: (d) => {
        const dep = (d.dependence ?? {}) as Record<string, string>;
        return !!(dep.timeToFirstCigarette);
      } },
    { id: 'red_flags', label: 'Contraindication screening complete', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return SC_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'quit_date', label: 'Quit date set', required: true,
      isComplete: (d) => !!d.quitDate },
    { id: 'follow_up', label: 'Follow-up plan documented', required: true,
      isComplete: (d) => !!d.followUpPlan },
  ],

  safetyWeights: {
    missingCriticalField: 15,
    unansweredRedFlag: 10,
    allergyConflict: 40,
    outOfScopeTreatment: 50,
    treatmentWithoutCounselling: 20,
    treatmentWithoutFollowUp: 25,
  },
};
