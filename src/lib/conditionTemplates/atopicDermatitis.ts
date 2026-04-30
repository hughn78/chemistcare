/**
 * Atopic Dermatitis (Eczema) — Condition Template
 * -----------------------------------------------
 * VIC pharmacist prescribing protocol (draft). Mild–moderate flares
 * of established atopic dermatitis in patients ≥ 3 months. Severe,
 * widespread, infected, or eczema herpeticum is out of scope.
 *
 * Clinical alignment: Therapeutic Guidelines (Dermatology) — Eczema,
 * AMH, Victorian CPSP. Status: `draft` / `needs_review`.
 */
import { getConditionById } from '@/data/conditions';
import type {
  ConditionTemplate,
  ScopeRuleResult,
  TreatmentOptionDefinition,
} from './types';

export const AD_RED_FLAG_IDS = [
  'eczema_herpeticum',
  'bacterial_superinfection_systemic',
  'widespread_erythroderma',
  'first_presentation_adult',
  'failed_potent_steroid',
  'under_3_months',
  'periorbital_extensive_face',
  'immunocompromise',
] as const;

const hydrocortisone: TreatmentOptionDefinition = {
  id: 'hc1',
  medicineName: 'Hydrocortisone 1% cream/ointment',
  line: 'first',
  dose: 'Apply thin layer (fingertip unit guidance)',
  frequency: 'Once to twice daily',
  duration: '7–14 days per flare',
  maxQuantity: 1,
  repeats: 1,
  pbsRestriction: 'Pharmacist-only / unscheduled',
  contraindications: ['untreated bacterial/viral/fungal skin infection', 'rosacea', 'perioral dermatitis'],
  cautions: ['Use on face/flexures only short-term', 'Avoid occlusion in infants'],
  allergyConflicts: ['hydrocortisone', 'corticosteroid'],
  interactionFlags: [],
  counsellingPoints: [
    'Apply a thin layer to inflamed areas — fingertip unit (FTU) guidance',
    'Use ointment for very dry skin, cream for weeping areas',
    'Continue daily moisturiser (emollient) — apply 30 min before steroid',
    'Step down once flare settles; do not use long-term on face',
    'If no improvement in 7 days, return for review',
  ],
  followUpAdvice: 'Review in 1–2 weeks. If inadequate, escalate potency or refer.',
};

const methylpred: TreatmentOptionDefinition = {
  id: 'methylpred',
  medicineName: 'Methylprednisolone aceponate 0.1% cream/ointment',
  line: 'second',
  dose: 'Apply thin layer',
  frequency: 'Once daily',
  duration: 'Up to 4 weeks per flare',
  maxQuantity: 1,
  repeats: 1,
  pbsRestriction: 'Streamlined — moderate-potency topical steroid',
  contraindications: ['untreated skin infection', 'rosacea', 'perioral dermatitis'],
  cautions: ['Avoid prolonged use on face', 'Caution in flexures', 'Skin atrophy with prolonged use'],
  allergyConflicts: ['methylprednisolone', 'corticosteroid'],
  interactionFlags: [],
  counsellingPoints: [
    'Apply once daily to affected eczema (NOT for normal skin)',
    'Limit face/flexure use to 5–7 days; body up to 4 weeks',
    'Step down to hydrocortisone or stop once cleared',
    'Continue emollients twice daily indefinitely',
    'Watch for skin thinning, stretch marks — return if seen',
  ],
  followUpAdvice: 'Review at 2–4 weeks; refer if inadequate response or steroid dependence.',
};

const ceramideMoisturiser: TreatmentOptionDefinition = {
  id: 'emollient_intensive',
  medicineName: 'Ceramide-based emollient (e.g. QV Intensive, Cetaphil Restoraderm)',
  line: 'first',
  dose: 'Liberal application (≥ 250 g/week adult)',
  frequency: 'At least twice daily + after bathing',
  duration: 'Indefinite — maintenance',
  maxQuantity: 1,
  repeats: 5,
  pbsRestriction: 'OTC — no prescription required',
  contraindications: ['emollient component hypersensitivity'],
  cautions: ['Patch test new product on small area first'],
  allergyConflicts: [],
  interactionFlags: [],
  counsellingPoints: [
    'Apply liberally — at least twice daily and immediately after bathing',
    'Use enough — adult should get through ~250 g per week',
    'Apply in direction of hair growth to prevent folliculitis',
    'Continue even when skin looks clear — maintenance prevents flares',
    'Avoid soap; use soap-free wash',
  ],
  followUpAdvice: 'Maintenance — review at next presentation.',
};

const scopeRules = [
  {
    id: 'age',
    label: 'Patient ≥ 3 months',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const dob = (d.patient as Record<string, string> | undefined)?.dob;
      if (!dob) return { status: 'needs_clarification', reason: 'DOB required' };
      const ageMonths = (Date.now() - new Date(dob).getTime()) / 2629800000;
      if (ageMonths < 3) return { status: 'out_of_scope', reason: 'Under 3 months — refer to GP/paediatrics' };
      return { status: 'in_scope' };
    },
  },
  {
    id: 'severity',
    label: 'Mild–moderate flare; not widespread/erythrodermic',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const sev = (d.symptoms as Record<string, string> | undefined)?.severity;
      if (!sev) return { status: 'needs_clarification', reason: 'Document flare severity' };
      if (sev === 'severe' || sev === 'erythroderma') {
        return { status: 'out_of_scope', reason: 'Severe / widespread eczema — refer for systemic options' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'red_flags',
    label: 'No critical red flags',
    evaluate: (d: Record<string, unknown>): ScopeRuleResult | null => {
      const rf = (d.redFlags ?? {}) as Record<string, unknown>;
      const positives = AD_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
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
  lines.push(`Atopic dermatitis flare — severity ${s.severity ?? '[not documented]'}; distribution ${s.distribution ?? '[not documented]'}; trigger ${s.trigger ?? 'unknown'}.`);
  if (s.itchScore) lines.push(`Itch score (0–10): ${s.itchScore}.`);
  if (s.priorTherapy) lines.push(`Prior therapy: ${s.priorTherapy}.`);

  lines.push('');
  lines.push('RED FLAG SCREENING');
  const positives = AD_RED_FLAG_IDS.filter(id => rf[id] === 'yes');
  if (positives.length === 0) lines.push('All red flags negative. No eczema herpeticum, no systemic infection, no erythroderma, established atopic history.');
  else lines.push(`POSITIVE: ${positives.join(', ')}.`);

  lines.push('');
  lines.push('PLAN');
  if (tx) {
    lines.push(`Supplied: ${tx.medicineName} ${tx.dose}, ${tx.frequency} for ${tx.duration} (qty ${tx.maxQuantity}).`);
    lines.push('Counselled on FTU dosing, emollient priming, step-down, and steroid safety.');
  } else {
    lines.push('No topical steroid supplied — emollient + trigger avoidance advised.');
  }
  if (data.followUpPlan) lines.push(`FOLLOW-UP: ${data.followUpPlan}`);
  if (data.safetyNet) lines.push(`SAFETY NET: ${data.safetyNet}`);

  lines.push('');
  lines.push(`Protocol: Vic CPSP — Atopic Dermatitis, template v${(data.conditionTemplateVersion ?? '1.0.0')}.`);

  return lines.join('\n');
}

export const atopicDermatitisTemplate: ConditionTemplate = {
  id: 'atopic-dermatitis',
  slug: 'atopic-dermatitis',
  name: 'Atopic Dermatitis (Eczema)',
  category: 'chronic',
  jurisdictions: ['VIC'],
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: 'VIC-PP-AD-2026.1',
  protocolStatus: 'draft',
  protocolLastReviewed: '2026-04-30',
  protocolSourceLabel: 'Victorian pharmacist prescribing protocol (draft — pending clinical sign-off)',
  legacyCondition: getConditionById('atopic-dermatitis') ?? getConditionById('uti')!,

  steps: [
    { id: 'patient', kind: 'patient-profile', label: 'Patient Profile' },
    { id: 'symptoms', kind: 'presenting-complaint', label: 'Flare Assessment' },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Topical Therapy Selection', blockableByRedFlags: true, blockableByScope: true },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: [
    { id: 'eczema_herpeticum', label: 'Painful clustered vesicles / punched-out erosions (eczema herpeticum)', severity: 'critical', blocksPrescribing: true,
      action: 'URGENT referral — eczema herpeticum is a dermatological emergency' },
    { id: 'bacterial_superinfection_systemic', label: 'Weeping/crusting + fever or systemically unwell', severity: 'critical', blocksPrescribing: true,
      action: 'Refer — needs oral antibiotics under medical review' },
    { id: 'widespread_erythroderma', label: 'Widespread erythroderma (> 90% BSA)', severity: 'critical', blocksPrescribing: true,
      action: 'URGENT referral — risk of fluid/temperature dysregulation' },
    { id: 'first_presentation_adult', label: 'First-time presentation in an adult ≥ 30 years', severity: 'moderate', blocksPrescribing: true,
      action: 'Refer — exclude contact dermatitis, cutaneous lymphoma' },
    { id: 'failed_potent_steroid', label: 'Failed adequate course of moderate/potent topical steroid', severity: 'high', blocksPrescribing: true,
      action: 'Refer for systemic / non-steroid options (calcineurin inhibitors, biologics)' },
    { id: 'under_3_months', label: 'Patient under 3 months of age', severity: 'high', blocksPrescribing: true,
      action: 'Refer — paediatric assessment required' },
    { id: 'periorbital_extensive_face', label: 'Extensive periorbital/eyelid involvement', severity: 'high', blocksPrescribing: true,
      action: 'Refer — risk of steroid-induced glaucoma/cataract' },
    { id: 'immunocompromise', label: 'Immunocompromise (transplant, biologics, advanced HIV)', severity: 'critical', blocksPrescribing: true,
      action: 'Refer — needs medical co-management' },
  ],

  scopeRules,

  differentials: [
    { id: 'contact_dermatitis', label: 'Allergic / irritant contact dermatitis', whenToSuspect: 'Sharp borders matching exposure pattern, new product use' },
    { id: 'seborrhoeic', label: 'Seborrhoeic dermatitis', whenToSuspect: 'Greasy yellow scale on scalp/face/chest' },
    { id: 'psoriasis', label: 'Psoriasis', whenToSuspect: 'Well-demarcated silvery plaques on extensor surfaces' },
    { id: 'scabies', label: 'Scabies', whenToSuspect: 'Generalised itch worse at night, household contacts affected, burrows', referralOnHighSuspicion: true },
    { id: 'tinea', label: 'Tinea (fungal)', whenToSuspect: 'Annular lesion with central clearing — KOH if uncertain' },
  ],

  treatments: [ceramideMoisturiser, hydrocortisone, methylpred],

  counselling: [
    { id: 'emollient_priming', label: 'Apply emollient liberally + 30 min before topical steroid', required: true },
    { id: 'ftu', label: 'Fingertip unit dosing explained', required: true },
    { id: 'step_down', label: 'Step down to weakest effective potency once cleared', required: true },
    { id: 'soap_avoidance', label: 'Avoid soap; use soap-free wash', required: true },
    { id: 'trigger_avoidance', label: 'Identify and avoid known triggers (heat, wool, allergens)', required: true },
    { id: 'steroid_safety', label: 'Counselled on safe steroid use (no long-term face/flexure)', required: true },
    { id: 'flare_action', label: 'Written flare action plan provided', required: false },
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
    { id: 'flare', label: 'Flare assessment documented (severity, distribution, trigger)', required: true,
      isComplete: (d) => {
        const s = (d.symptoms ?? {}) as Record<string, string>;
        return !!(s.severity && s.distribution);
      } },
    { id: 'red_flags', label: 'All red flags answered', required: true,
      isComplete: (d) => {
        const rf = (d.redFlags ?? {}) as Record<string, unknown>;
        return AD_RED_FLAG_IDS.every(id => rf[id] === 'yes' || rf[id] === 'no');
      } },
    { id: 'plan', label: 'Treatment or referral plan documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'follow_up', label: 'Follow-up + safety net documented', required: true,
      isComplete: (d) => !!d.followUpPlan && !!d.safetyNet },
  ],

  safetyWeights: {
    missingCriticalField: 15,
    unansweredRedFlag: 12,
    allergyConflict: 50,
    outOfScopeTreatment: 60,
    treatmentWithoutCounselling: 20,
    treatmentWithoutFollowUp: 15,
  },
};
