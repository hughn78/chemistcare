/**
 * Plaque Psoriasis (acute exacerbation, mild) — Corpus-driven template
 * --------------------------------------------------------------------
 * Generated from the Sep 2026 protocol corpus: primary instrument is the
 * VIC "Management of Acute Exacerbation of Mild Plaque Psoriasis" protocol
 * (February 2024), QLD CPG as fallback. All red flags, eligibility
 * screening, scope rules and topical corticosteroid treatments come from
 * the instrument's own extraction.
 */
import { getConditionById } from '@/data/conditions';
import type { ConditionTemplate, ScopeRuleDefinition, ScopeRuleResult } from './types';
import {
  selectCorpusDoc,
  corpusAgeScopeRule,
  corpusNoRedFlagsScopeRule,
  corpusRedFlagDefs,
  corpusTreatmentOptions,
  corpusNoteGenerator,
  corpusJurisdictionProtocolVersion,
} from './corpusFactory';

const CONDITION_KEY = 'psoriasis';
const PREFERRED_STATE = 'VIC';
const sel = selectCorpusDoc(CONDITION_KEY, PREFERRED_STATE)!;
const { ids: RED_FLAG_IDS, defs: RED_FLAG_DEFS } = corpusRedFlagDefs(sel.payload);

function isUnansweredVal(v: unknown): boolean {
  return v === undefined || v === '' || v === null;
}

const extraScopeRules: ScopeRuleDefinition[] = [
  {
    id: 'established_diagnosis',
    label: 'Previously diagnosed mild plaque psoriasis (exacerbation, not first presentation)',
    evaluate: (data): ScopeRuleResult | null => {
      const v = data.firstPresentation as string | undefined;
      if (isUnansweredVal(v)) {
        return { status: 'needs_clarification', reason: 'Confirm whether psoriasis is previously diagnosed' };
      }
      if (v === 'yes') {
        return { status: 'out_of_scope', reason: 'First presentation requires medical diagnosis' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'body_area_limits',
    label: 'Affected body areas within protocol limits (no face/flexures/genital/high-impact sites)',
    evaluate: (data): ScopeRuleResult | null => {
      const v = data.highImpactSites as string | undefined;
      if (isUnansweredVal(v)) {
        return { status: 'needs_clarification', reason: 'Confirm affected body areas' };
      }
      if (v === 'yes') {
        return { status: 'out_of_scope', reason: 'High-impact sites (face, flexures, palms/soles, genital, scalp) require medical management' };
      }
      return { status: 'in_scope' };
    },
  },
];

export const psoriasisTemplate: ConditionTemplate = {
  id: 'psoriasis',
  slug: 'psoriasis',
  name: 'Plaque Psoriasis (acute exacerbation)',
  category: 'chronic',
  jurisdictions: Array.from(new Set([sel.meta.state])),
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: corpusJurisdictionProtocolVersion(sel),
  protocolStatus: 'active',
  protocolLastReviewed: sel.meta.extractedAt?.slice(0, 10),
  protocolSourceLabel: sel.meta.title,
  legacyCondition: getConditionById('psoriasis')!,

  steps: [
    {
      id: 'patient', kind: 'patient-profile', label: 'Patient Profile',
      fields: [
        { id: 'firstName', label: 'First name', kind: 'text', required: true },
        { id: 'lastName', label: 'Last name', kind: 'text', required: true },
        { id: 'dob', label: 'Date of birth', kind: 'date', required: true },
        { id: 'sex', label: 'Sex at birth', kind: 'select',
          options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] },
        { id: 'pregnancyStatus', label: 'Pregnancy status', kind: 'select',
          options: [
            { value: 'not_pregnant', label: 'Not pregnant' },
            { value: 'pregnant', label: 'Pregnant', flagsOutOfScope: true },
            { value: 'possibly_pregnant', label: 'Possibly pregnant', flagsOutOfScope: true },
            { value: 'not_applicable', label: 'Not applicable' },
          ] },
        { id: 'allergies', label: 'Allergies', kind: 'tags' },
        { id: 'currentMeds', label: 'Current medicines', kind: 'tags' },
        { id: 'relevantConditions', label: 'Relevant medical conditions', kind: 'tags' },
      ],
    },
    {
      id: 'symptoms', kind: 'presenting-complaint', label: 'Presenting Complaint',
      fields: [
        { id: 'firstPresentation', label: 'First presentation of psoriasis?', kind: 'select', required: true,
          options: [
            { value: 'no', label: 'No — previously diagnosed' },
            { value: 'yes', label: 'Yes — first presentation', flagsOutOfScope: true },
          ] },
        { id: 'highImpactSites', label: 'Face, flexures, palms/soles, genitals or scalp affected?', kind: 'select', required: true,
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes', flagsOutOfScope: true },
          ] },
        { id: 'affectedPct', label: 'Approximate body surface area affected (%)', kind: 'number' },
        { id: 'symptomNotes', label: 'Clinical notes', kind: 'textarea',
          helpText: 'Duration of flare, current/previous treatments, response' },
      ],
    },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Treatment',
      blockableByRedFlags: true, blockableByScope: true,
      fields: [
        { id: 'followUpPlan', label: 'Follow-up plan', kind: 'textarea', required: true },
        { id: 'safetyNet', label: 'Safety net advice', kind: 'textarea', required: true },
      ],
    },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: RED_FLAG_DEFS,
  scopeRules: [
    corpusAgeScopeRule(sel.payload, 18, 120, 'Plaque psoriasis'),
    corpusNoRedFlagsScopeRule(RED_FLAG_IDS),
    ...extraScopeRules,
  ],

  differentials: [
    { id: 'eczema', label: 'Eczema / atopic dermatitis', whenToSuspect: 'Flexural, lichenified, itchy' },
    { id: 'tinea', label: 'Tinea (fungal)', whenToSuspect: 'Active edge, single plaque, wet mount KOH', referralOnHighSuspicion: true },
    { id: 'drug_eruption', label: 'Drug eruption', whenToSuspect: 'New medicine, maculopapular pattern', referralOnHighSuspicion: true },
    { id: 'seborrheic_dermatitis', label: 'Seborrhoeic dermatitis', whenToSuspect: 'Scalp, nasolabial, brow involvement' },
    { id: 'guttate_psoriasis', label: 'Guttate psoriasis', whenToSuspect: 'Post-streptococcal drop lesions, widespread', referralOnHighSuspicion: true },
  ],

  treatments: corpusTreatmentOptions(sel.payload),

  counselling: [
    { id: 'application_technique', label: 'Fingertip unit application technique', required: true },
    { id: 'treatment_duration', label: 'Treatment duration and review point', required: true },
    { id: 'expected_response', label: 'Expected response timeframe', required: true },
    { id: 'steroid_safety', label: 'Topical steroid safety (thin layer, avoid face/flexures unless directed)', required: true },
    { id: 'urgent_care', label: 'When to seek urgent care (spreading redness, fever, pustules)', required: true },
    { id: 'follow_up_window', label: 'When to return or see a GP', required: true },
  ],

  documentation: {
    sections: [
      { id: 'patient', heading: 'Patient' },
      { id: 'complaint', heading: 'Presenting Complaint' },
      { id: 'screening', heading: 'Protocol Screening' },
      { id: 'scope', heading: 'Scope Decision' },
      { id: 'plan', heading: 'Plan' },
      { id: 'counselling', heading: 'Counselling' },
    ],
    generate: corpusNoteGenerator(sel, 'Plaque Psoriasis (acute exacerbation)'),
  },

  completionChecklist: [
    { id: 'patient', label: 'Patient profile complete', required: true,
      isComplete: (d) => {
        const p = (d.patient ?? {}) as Record<string, string>;
        return !!(p.firstName && p.lastName && p.dob);
      } },
    { id: 'presentation', label: 'Presentation status confirmed', required: true,
      isComplete: (d) => {
        const f = ((d as Record<string, unknown>).fields ?? {}) as Record<string, unknown>;
        return !isUnansweredVal(f.firstPresentation) && !isUnansweredVal(f.highImpactSites);
      } },
    { id: 'red_flags', label: 'Red flag screening complete', required: true,
      isComplete: (d) => {
        const f = (d.findings ?? {}) as Record<string, unknown>;
        return RED_FLAG_IDS.every(id => !isUnansweredVal(f[id]));
      } },
    { id: 'scope', label: 'Scope validation complete', required: true,
      isComplete: (d) => d.scopeStatus !== undefined && d.scopeStatus !== 'needs_clarification' },
    { id: 'plan', label: 'Treatment selected or referral documented', required: true,
      isComplete: (d) => !!d.selectedTreatment || !!d.referralNotes },
    { id: 'counselling', label: 'Counselling completed (when treatment supplied)', required: true,
      isComplete: (d) => {
        if (!d.selectedTreatment) return true;
        const done = (d.counsellingDone ?? []) as unknown[];
        return done.length >= 4;
      } },
    { id: 'note', label: 'Clinical note generated', required: true, isComplete: (d) => !!d.noteText },
  ],

  safetyWeights: {
    missingCriticalField: 25,
    unansweredRedFlag: 6,
    allergyConflict: 40,
    outOfScopeTreatment: 60,
    treatmentWithoutCounselling: 15,
    treatmentWithoutFollowUp: 15,
  },
};

export const PSORIASIS_RED_FLAG_IDS = RED_FLAG_IDS;
export const psoriasisCorpusSelection = sel;