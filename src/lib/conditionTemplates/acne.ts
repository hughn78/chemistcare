/**
 * Mild–Moderate Acne — Condition Template
 * ---------------------------------------
 * VIC pharmacist prescribing protocol (draft). Mild to moderate acne
 * vulgaris in patients ≥ 12 years. Severe nodulocystic, scarring,
 * or treatment-refractory acne is out of scope and refers to GP/
 * dermatology for systemic therapy / isotretinoin.
 *
 * Clinical alignment: Therapeutic Guidelines (Dermatology) — Acne,
 * AMH, Victorian CPSP. Status: `draft` / `needs_review` until
 * clinically signed off.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const ACNE_RED_FLAG_IDS = [
  'severe_nodulocystic',
  'scarring_or_pigmentation',
  'sudden_severe_onset',
  'virilising_features',
  'isotretinoin_candidate',
  'pregnancy_or_planning',
  'mental_health_concerns',
  'failed_topical_therapy',
] as const;

const benzoylPeroxide: TreatmentOptionDefinition = {
  id: 'bpo',
  medicineName: 'Benzoyl peroxide 2.5–5% gel',
  line: 'first',
  dose: 'Pea-sized amount to affected area',
  frequency: 'Once daily (build to twice daily)',
  duration: '8–12 weeks initial trial',
  maxQuantity: 1,
  repeats: 2,
  pbsRestriction: 'Unscheduled — pharmacy supply',
  contraindications: ['benzoyl peroxide hypersensitivity'],
  cautions: ['May bleach fabric/hair', 'Initial irritation common'],
  allergyConflicts: ['benzoyl peroxide'],
  interactionFlags: ['topical retinoids (avoid concurrent use same time)'],
  counsellingPoints: [
    'Wash face with mild cleanser, pat dry, then apply a thin layer',
    'Start once daily at night; build to twice daily as tolerated',
    'Will bleach pillowcases, towels and clothing — use white linen',
    'Use sunscreen daily — increases sun sensitivity',
    'Improvement takes 6–8 weeks; do not stop early',
  ],
  followUpAdvice: 'Review at 8 weeks. If inadequate response, escalate to combination topical or refer.',
};

const adapaleneBPO: TreatmentOptionDefinition = {
  id: 'adapalene_bpo',
  medicineName: 'Adapalene 0.1% + Benzoyl peroxide 2.5% gel',
  line: 'second',
  dose: 'Pea-sized amount to affected area',
  frequency: 'Once daily at night',
  duration: '12 weeks',
  maxQuantity: 1,
  repeats: 2,
  pbsRestriction: 'Streamlined — moderate inflammatory acne',
  contraindications: ['retinoid hypersensitivity', 'pregnancy', 'planning pregnancy', 'breastfeeding'],
  cautions: ['Marked initial dryness/irritation', 'Photosensitivity'],
  allergyConflicts: ['adapalene', 'retinoid', 'benzoyl peroxide'],
  interactionFlags: ['other topical retinoids', 'salicylic acid (cumulative irritation)'],
  counsellingPoints: [
    'Apply at night to clean, dry skin — avoid eyes, lips, mucosa',
    'Expect dryness and peeling weeks 2–4; use a non-comedogenic moisturiser',
    'Strict daily SPF 50+ sunscreen',
    'Do NOT use if pregnant, planning pregnancy, or breastfeeding',
    'Improvement from 8–12 weeks',
  ],
  followUpAdvice: 'Review at 12 weeks; refer if no improvement or if scarring developing.',
};

const topicalClindamycinBPO: TreatmentOptionDefinition = {
  id: 'clinda_bpo',
  medicineName: 'Clindamycin 1% + Benzoyl peroxide 5% gel',
  line: 'second',
  dose: 'Apply to affected area',
  frequency: 'Once daily',
  duration: 'Maximum 12 weeks',
  maxQuantity: 1,
  repeats: 1,
  pbsRestriction: 'Streamlined — inflammatory acne',
  contraindications: ['clindamycin/lincomycin hypersensitivity', 'history of antibiotic-associated colitis'],
  cautions: ['Limit duration to minimise antimicrobial resistance', 'Discontinue if persistent diarrhoea'],
  allergyConflicts: ['clindamycin', 'lincomycin', 'benzoyl peroxide'],
  interactionFlags: ['erythromycin topical (do not combine)'],
  counsellingPoints: [
    'Apply once daily after washing — thin layer',
    'Limited to 12 weeks to reduce resistance',
    'Stop and seek review if persistent diarrhoea or abdominal pain',
    'Continue benzoyl peroxide-containing therapy long-term to suppress resistance',
  ],
  followUpAdvice: 'Review at 12 weeks; transition to maintenance with BPO or adapalene.',
};

const scopeRules = [
  {
    id: 'age',
    label: 'Patient ≥ 12 years',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const dob = (d.patient as Record<string, string> | undefined)?.dob;
      if (!dob) return { status: 'needs_clarification', reason: 'DOB required' };
      const age = (Date.now() - new Date(dob).getTime()) / 31557600000;
      if (age < 12) return { status: 'out_of_scope', reason: 'Under 12 years — refer to GP/derm' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'severity',
    label: 'Mild–moderate severity (no nodules/cysts/scarring)',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const sev = (d.symptoms as Record<string, string> | undefined)?.severity;
      if (!sev) return { status: 'needs_clarification', reason: 'Document severity (mild/moderate/severe)' };
      if (sev === 'severe') return { status: 'out_of_scope', reason: 'Severe acne — refer for systemic/isotretinoin assessment' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No critical red flags',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = ACNE_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
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
  lines.push(`Acne vulgaris — severity ${s.severity ?? '[not documented]'}; distribution ${s.distribution ?? '[face]'}; duration ${s.duration ?? '[not documented]'}.`);
  if (s.priorTherapy) lines.push(`Prior therapy: ${s.priorTherapy}.`);
  if (s.psychosocialImpact) lines.push(`Psychosocial impact: ${s.psychosocialImpact}.`);

  lines.push('');
  lines.push('RED FLAG SCREENING');
  const positives = ACNE_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All red flags negative. No nodulocystic disease, no scarring, not pregnant/planning, no virilising features.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration} (qty ${tx.maxQuantity}, ${tx.repeats} repeats).`);
    lines.push('Counselled on application, sunscreen, expected timeframe (8–12 weeks), and irritation management.');
  } else {
    lines.push('No prescription supplied. Refer/recommend OTC adjuncts as appropriate.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  if (data.safetyNet) lines.push(`SAFETY NET: ${data.safetyNet}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Mild–Moderate Acne, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const acneTemplate: ConditionTemplate = {
  id: 'acne',
  slug: 'mild-moderate-acne',
  name: 'Mild–Moderate Acne',
  category: 'acute',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-ACNE-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('acne') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'symptoms', kind: 'presenting-complaint', label: 'Acne Assessment' },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Topical Therapy Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'severe_nodulocystic', label: 'Nodules, cysts, or deep painful lesions', severity: 'critical', blocksPrescribing: true,
      action: 'Refer to GP/dermatology — systemic therapy needed' },
    { id: 'scarring_or_pigmentation', label: 'Active scarring or post-inflammatory hyperpigmentation', severity: 'high', blocksPrescribing: true,
      action: 'Refer — prevent further scarring with systemic options' },
    { id: 'sudden_severe_onset', label: 'Sudden severe onset (acne fulminans pattern)', severity: 'critical', blocksPrescribing: true,
      action: 'Urgent referral — risk of acne fulminans' },
    { id: 'virilising_features', label: 'Virilising features (hirsutism, voice change, menstrual irregularity)', severity: 'high', blocksPrescribing: true,
      action: 'Refer — endocrine work-up needed' },
    { id: 'isotretinoin_candidate', label: 'Has failed multiple courses of conventional therapy', severity: 'moderate', blocksPrescribing: true,
      action: 'Refer to dermatology for isotretinoin assessment' },
    { id: 'pregnancy_or_planning', label: 'Pregnant, breastfeeding, or planning pregnancy', severity: 'critical', blocksPrescribing: true,
      action: 'Topical retinoids contraindicated — refer for safe options' },
    { id: 'mental_health_concerns', label: 'Significant psychosocial distress / mental health concerns', severity: 'high', blocksPrescribing: false,
      action: 'Co-manage with GP — consider mental health referral' },
    { id: 'failed_topical_therapy', label: 'Adequate trial (≥ 12 weeks) of topical therapy already failed', severity: 'moderate', blocksPrescribing: true,
      action: 'Refer for systemic options' },
  ],

  scopeRules,

  differentials: [
    { id: 'rosacea', label: 'Rosacea', whenToSuspect: 'Adult onset, central facial flushing, telangiectasia, no comedones' },
    { id: 'perioral_dermatitis', label: 'Perioral dermatitis', whenToSuspect: 'Papules sparing vermilion border, often topical steroid history' },
    { id: 'folliculitis', label: 'Bacterial/Pityrosporum folliculitis', whenToSuspect: 'Monomorphic itchy papulopustules on trunk' },
    { id: 'hidradenitis', label: 'Hidradenitis suppurativa', whenToSuspect: 'Painful nodules in axilla/groin, sinus tracts', referralOnHighSuspicion: true },
    { id: 'drug_induced', label: 'Drug-induced acne', whenToSuspect: 'New onset on corticosteroids, lithium, anabolic steroids' },
  ],

  treatments: [benzoylPeroxide, adapaleneBPO, topicalClindamycinBPO],

  counselling: [
    { id: 'expectations', label: 'Realistic timeframe — improvement at 8–12 weeks', required: true },
    { id: 'sunscreen', label: 'Daily SPF 50+ sunscreen (especially with retinoids/BPO)', required: true },
    { id: 'irritation', label: 'Manage irritation with non-comedogenic moisturiser', required: true },
    { id: 'no_picking', label: 'Avoid picking/squeezing — risk of scarring', required: true },
    { id: 'fabric_warning', label: 'BPO bleaches fabric/hair — use white linen', required: false },
    { id: 'pregnancy_warning', label: 'Topical retinoids contraindicated in pregnancy', required: true },
    { id: 'maintenance', label: 'Long-term maintenance therapy is usually required', required: true },
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
    { id: 'severity', label: 'Severity + distribution + prior therapy documented', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, string>;
        return !!(s.severity && s.distribution);
      } },
    { id: 'red_flags', label: 'All red flags answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return ACNE_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'plan', label: 'Treatment or referral plan documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'follow_up', label: 'Follow-up + safety net documented', required: true,
      isComplete: (d) => !!d.followUpPlan && !!d.safetyNet },
  ],

  safetyWeights: {
    missingCriticalField: 15,
    unansweredRedFlag: 10,
    allergyConflict: 50,
    outOfScopeTreatment: 60,
    treatmentWithoutCounselling: 20,
    treatmentWithoutFollowUp: 15,
  },
};
