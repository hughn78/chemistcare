/**
 * GORD (Gastro-oesophageal Reflux Disease) — Condition Template
 * -------------------------------------------------------------
 * VIC pharmacist prescribing protocol (draft). Short-course PPI for
 * uncomplicated reflux symptoms in adults ≥ 18 years where alarm
 * features are absent.
 *
 * Clinical alignment: Therapeutic Guidelines (Gastrointestinal),
 * AMH, Victorian CPSP. `protocolStatus: 'draft'` until clinical sign-off.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const GORD_RED_FLAG_IDS = [
  'dysphagia',
  'odynophagia',
  'haematemesis_melaena',
  'unintentional_weight_loss',
  'persistent_vomiting',
  'iron_deficiency_anaemia',
  'new_onset_over_55',
  'chest_pain_cardiac_features',
  'family_history_upper_gi_cancer',
  'long_standing_uninvestigated',
] as const;

const esomeprazole: TreatmentOptionDefinition = {
  id: 'esomeprazole',
  medicineName: 'Esomeprazole',
  line: 'first',
  dose: '20 mg',
  frequency: 'Once daily, 30–60 min before breakfast',
  duration: '4 weeks (max 8 weeks before review)',
  maxQuantity: 30,
  repeats: 1,
  pbsRestriction: 'Restricted benefit',
  contraindications: ['known PPI hypersensitivity'],
  cautions: ['Risk with long-term use: B12, Mg, fracture, C. difficile, CAP'],
  allergyConflicts: ['esomeprazole', 'omeprazole', 'pantoprazole', 'rabeprazole', 'lansoprazole'],
  interactionFlags: ['clopidogrel', 'methotrexate (high dose)', 'rilpivirine', 'atazanavir', 'warfarin'],
  counsellingPoints: [
    'Take once daily 30–60 minutes before breakfast — empty stomach',
    'Swallow whole; do not crush MR tablets',
    'Effect builds over 3–5 days',
    'Lifestyle: weight, late meals, alcohol, caffeine, smoking, head-of-bed elevation',
    'Plan: step down to PRN or stop after 4 weeks if symptoms resolve',
  ],
  followUpAdvice: 'Review at 4 weeks; refer if poor response, alarm features, or relapse needing > 8 weeks PPI.',
};

const pantoprazole: TreatmentOptionDefinition = {
  id: 'pantoprazole',
  medicineName: 'Pantoprazole',
  line: 'first',
  dose: '40 mg',
  frequency: 'Once daily, 30–60 min before breakfast',
  duration: '4 weeks (max 8 weeks before review)',
  maxQuantity: 30,
  repeats: 1,
  pbsRestriction: 'Restricted benefit',
  contraindications: ['known PPI hypersensitivity'],
  cautions: ['Long-term use risks as per class'],
  allergyConflicts: ['pantoprazole', 'PPI'],
  interactionFlags: ['methotrexate (high dose)', 'warfarin'],
  counsellingPoints: [
    'Take 30–60 minutes before breakfast',
    'Lower interaction profile vs omeprazole/esomeprazole',
    'Step down or stop after 4 weeks if symptoms resolve',
  ],
};

const famotidine: TreatmentOptionDefinition = {
  id: 'famotidine',
  medicineName: 'Famotidine (H2RA)',
  line: 'second',
  dose: '20 mg',
  frequency: 'Twice daily (or 40 mg nocte)',
  duration: '2–4 weeks',
  maxQuantity: 30,
  repeats: 0,
  pbsRestriction: 'Unrestricted',
  contraindications: ['H2RA hypersensitivity'],
  cautions: ['Adjust in renal impairment', 'Tachyphylaxis with continuous use'],
  allergyConflicts: ['famotidine', 'ranitidine', 'nizatidine'],
  interactionFlags: ['atazanavir', 'cefpodoxime', 'itraconazole'],
  counsellingPoints: [
    'Useful as second-line or step-down from PPI',
    'Take regularly for first 2 weeks then PRN',
    'Faster onset than PPI but less acid suppression',
  ],
};

const antacidAlginate: TreatmentOptionDefinition = {
  id: 'antacid_alginate',
  medicineName: 'Alginate-antacid (e.g. Gaviscon Dual Action)',
  line: 'third',
  dose: '10–20 mL or 2 tablets',
  frequency: 'After meals and at bedtime PRN',
  duration: 'PRN — adjunct',
  maxQuantity: 1,
  repeats: 0,
  pbsRestriction: 'OTC',
  contraindications: ['severe renal impairment (Na/Mg load)'],
  cautions: ['High sodium content — caution in HF/HTN', 'Separate from other oral medicines by 2 hours'],
  allergyConflicts: ['alginate'],
  interactionFlags: ['levothyroxine', 'tetracyclines', 'fluoroquinolones', 'iron', 'bisphosphonates'],
  counsellingPoints: [
    'Use as needed for symptom relief, especially after meals and bedtime',
    'Separate dosing from other medicines by at least 2 hours',
    'Useful adjunct or as stand-alone for very mild symptoms',
  ],
};

const scopeRules = [
  {
    id: 'age',
    label: 'Adult ≥ 18 years and ≤ 55 years (or known reflux > 55)',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const dob = (d.patient as Record<string, string> | undefined)?.dob;
      if (!dob) return { status: 'needs_clarification', reason: 'DOB required' };
      const age = (Date.now() - new Date(dob).getTime()) / 31557600000;
      if (age < 18) return { status: 'out_of_scope', reason: 'Under 18 — refer to GP' };
      const newOnset = (d.symptoms as Record<string, string> | undefined)?.newOnsetOver55;
      if (age > 55 && newOnset === 'yes') {
        return { status: 'out_of_scope', reason: 'New-onset reflux > 55 — refer for endoscopy assessment' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'duration',
    label: 'Symptoms not refractory to prior PPI',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const s = (d.symptoms as Record<string, string> | undefined) ?? {};
      if (s.priorPpiResponse === 'failed_8w') {
        return { status: 'out_of_scope', reason: 'Failed 8 weeks of PPI — refer for endoscopy / specialist' };
      }
      if (!s.frequency) return { status: 'needs_clarification', reason: 'Document symptom frequency' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No alarm features',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = GORD_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
      if (positives.length) return { status: 'out_of_scope', reason: `Positive alarm feature: ${positives[0]}` };
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
  lines.push(`Patient presents with reflux/heartburn symptoms${s.frequency ? ` (${s.frequency})` : ''}${s.duration ? ` for ${s.duration}` : ''}.`);
  if (s.triggers) lines.push(`Triggers: ${s.triggers}.`);
  if (s.priorPpiResponse) lines.push(`Prior PPI response: ${s.priorPpiResponse.replace('_', ' ')}.`);

  lines.push('');
  lines.push('ALARM FEATURE SCREENING');
  const positives = GORD_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All alarm features negative. No dysphagia, GI bleeding, weight loss, persistent vomiting, anaemia, or new-onset > 55.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration} (qty ${tx.maxQuantity}, repeats ${tx.repeats}).`);
    lines.push('Counselled on dosing, lifestyle measures, and 4-week step-down/stop plan.');
  } else {
    lines.push('No medicine supplied. Refer for medical review.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  if (data.safetyNet) lines.push(`SAFETY NET: ${data.safetyNet}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — GORD, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const gordTemplate: ConditionTemplate = {
  id: 'gord',
  slug: 'gord',
  name: 'GORD',
  category: 'acute',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-GORD-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('gord') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'symptoms', kind: 'presenting-complaint', label: 'Symptom Pattern' },
    { id: 'red-flags', kind: 'red-flags', label: 'Alarm Feature Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Acid Suppression Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling + Lifestyle' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'dysphagia', label: 'Difficulty swallowing (dysphagia)', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent referral — endoscopy required to exclude obstruction/malignancy' },
    { id: 'odynophagia', label: 'Painful swallowing (odynophagia)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer urgently — exclude oesophagitis / candida / malignancy' },
    { id: 'haematemesis_melaena', label: 'Vomiting blood, coffee-ground vomit, or melaena', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent ED referral — upper GI bleed' },
    { id: 'unintentional_weight_loss', label: 'Unintentional weight loss', severity: 'critical', blocksPrescribing: true,
      action: 'Refer urgently — exclude malignancy' },
    { id: 'persistent_vomiting', label: 'Persistent vomiting', severity: 'high', blocksPrescribing: true,
      action: 'Refer — exclude obstruction / dehydration' },
    { id: 'iron_deficiency_anaemia', label: 'Known iron deficiency anaemia', severity: 'high', blocksPrescribing: true,
      action: 'Refer for endoscopy work-up' },
    { id: 'new_onset_over_55', label: 'New-onset reflux symptoms over age 55', severity: 'high', blocksPrescribing: true,
      action: 'Refer for endoscopy as per Australian guidelines' },
    { id: 'chest_pain_cardiac_features', label: 'Chest pain with exertional or cardiac features', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent ED referral — exclude ACS before treating as reflux' },
    { id: 'family_history_upper_gi_cancer', label: 'First-degree relative with upper GI cancer', severity: 'moderate', blocksPrescribing: false,
      action: 'Counsel; suggest GP review for surveillance' },
    { id: 'long_standing_uninvestigated', label: 'Long-standing reflux (> 5 years) never investigated', severity: 'moderate', blocksPrescribing: false,
      action: 'Refer for endoscopy assessment — Barrett risk' },
  ],

  scopeRules,

  differentials: [
    { id: 'cardiac_chest_pain', label: 'Cardiac chest pain', whenToSuspect: 'Exertional, radiating, diaphoretic, risk factors', referralOnHighSuspicion: true },
    { id: 'peptic_ulcer', label: 'Peptic ulcer disease', whenToSuspect: 'Epigastric pain related to meals, NSAID use', referralOnHighSuspicion: true },
    { id: 'biliary', label: 'Biliary colic', whenToSuspect: 'RUQ pain after fatty meals, fever' },
    { id: 'eosinophilic_oesophagitis', label: 'Eosinophilic oesophagitis', whenToSuspect: 'Food impaction, atopic history, PPI failure', referralOnHighSuspicion: true },
    { id: 'functional_dyspepsia', label: 'Functional dyspepsia', whenToSuspect: 'Bloating, early satiety without classic reflux features' },
  ],

  treatments: [esomeprazole, pantoprazole, famotidine, antacidAlginate],

  counselling: [
    { id: 'dosing', label: 'PPI dosing 30–60 min before breakfast', required: true },
    { id: 'lifestyle', label: 'Lifestyle: weight, late meals, alcohol, caffeine, smoking, HOB elevation', required: true },
    { id: 'duration', label: 'Plan to step down or stop at 4 weeks; max 8 weeks before review', required: true },
    { id: 'long_term_risks', label: 'Awareness of long-term PPI risks (B12, Mg, fracture, infection)', required: true },
    { id: 'interactions', label: 'Check interactions (clopidogrel, methotrexate, antiretrovirals)', required: true },
    { id: 'red_flag_escalation', label: 'Return for any alarm feature, chest pain, GI bleeding, or weight loss', required: true },
    { id: 'gp_review', label: 'GP review if symptoms recur after stopping or persist > 8 weeks', required: false },
  ],

  documentation: {
    sections: [
      { id: 'patient', heading: 'Patient' },
      { id: 'complaint', heading: 'Presenting Complaint' },
      { id: 'red_flags', heading: 'Alarm Feature Screening' },
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
    { id: 'symptoms', label: 'Symptom pattern documented (frequency, prior therapy)', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, string>;
        return !!(s.frequency && s.duration);
      } },
    { id: 'red_flags', label: 'All alarm features answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return GORD_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'plan', label: 'Treatment or referral plan documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'follow_up', label: 'Follow-up + safety net documented (incl. step-down plan)', required: true,
      isComplete: (d) => !!d.followUpPlan && !!d.safetyNet },
  ],

  safetyWeights: {
    missingCriticalField: 20,
    unansweredRedFlag: 15,
    allergyConflict: 40,
    outOfScopeTreatment: 60,
    treatmentWithoutCounselling: 20,
    treatmentWithoutFollowUp: 20,
  },
};
