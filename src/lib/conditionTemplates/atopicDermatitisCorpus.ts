/**
 * Atopic Dermatitis (mild–moderate flare) — Corpus-driven template
 * ----------------------------------------------------------------
 * Generated from the Sep 2026 protocol corpus: primary instrument is the
 * VIC "Management of Acute Exacerbations of Mild to Moderate Atopic
 * Dermatitis" protocol (July 2026), QLD guideline as fallback. Age window,
 * severity gate, red flags and topical corticosteroid selections all come
 * from the instrument's own extraction.
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

const CONDITION_KEY = 'dermatitis';
const PREFERRED_STATE = 'VIC';
const sel = selectCorpusDoc(CONDITION_KEY, PREFERRED_STATE)!;
const { ids: RED_FLAG_IDS, defs: RED_FLAG_DEFS } = corpusRedFlagDefs(sel.payload);

function isUnansweredVal(v: unknown): boolean {
  return v === undefined || v === '' || v === null;
}

const extraScopeRules: ScopeRuleDefinition[] = [
  {
    id: 'flare_not_first_presentation',
    label: 'Previously diagnosed atopic dermatitis presenting with a flare',
    evaluate: (data): ScopeRuleResult | null => {
      const v = data.firstPresentation as string | undefined;
      if (isUnansweredVal(v)) {
        return { status: 'needs_clarification', reason: 'Confirm whether eczema is previously diagnosed' };
      }
      if (v === 'yes') {
        return { status: 'out_of_scope', reason: 'First presentation requires medical diagnosis' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'severity_gate',
    label: 'Flare severity within mild–moderate band',
    evaluate: (data): ScopeRuleResult | null => {
      const v = data.severity as string | undefined;
      if (isUnansweredVal(v)) {
        return { status: 'needs_clarification', reason: 'Assess flare severity before scope decision' };
      }
      if (v === 'severe') {
        return { status: 'out_of_scope', reason: 'Severe flare — medical management required' };
      }
      return { status: 'in_scope' };
    },
  },
];

export const atopicDermatitisCorpusTemplate: ConditionTemplate = {
  id: 'atopic-dermatitis',
  slug: 'atopic-dermatitis',
  name: 'Atopic Dermatitis (mild–moderate flare)',
  category: 'chronic',
  jurisdictions: Array.from(new Set([sel.meta.state])),
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: corpusJurisdictionProtocolVersion(sel),
  protocolStatus: 'active',
  protocolLastReviewed: sel.meta.extractedAt?.slice(0, 10),
  protocolSourceLabel: sel.meta.title,
  legacyCondition: getConditionById('atopic-dermatitis')!,

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
        { id: 'firstPresentation', label: 'First presentation of eczema?', kind: 'select', required: true,
          options: [
            { value: 'no', label: 'No — previously diagnosed' },
            { value: 'yes', label: 'Yes — first presentation', flagsOutOfScope: true },
          ] },
        { id: 'severity', label: 'Flare severity', kind: 'select', required: true,
          options: [
            { value: 'mild', label: 'Mild' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'severe', label: 'Severe', flagsOutOfScope: true },
          ] },
        { id: 'sites', label: 'Areas affected', kind: 'tags',
          helpText: 'e.g. flexures, hands, face (avoid potent steroids on face unless directed)' },
        { id: 'symptomNotes', label: 'Clinical notes', kind: 'textarea',
          helpText: 'Duration, current/previous treatments, response, triggers' },
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
    corpusAgeScopeRule(sel.payload, 1, 120, 'Atopic dermatitis'),
    corpusNoRedFlagsScopeRule(RED_FLAG_IDS),
    ...extraScopeRules,
  ],

  differentials: [
    { id: 'eczema_herpeticum', label: 'Eczema herpeticum', whenToSuspect: 'Punched-out erosions, monomorphic vesicles, fever', referralOnHighSuspicion: true },
    { id: 'bacterial_infection', label: 'Bacterial superinfection (impetiginised)', whenToSuspect: 'Weeping, golden crust, spreading erythema', referralOnHighSuspicion: false },
    { id: 'contact_dermatitis', label: 'Contact allergic dermatitis', whenToSuspect: 'New exposure, sharply demarcated' },
    { id: 'tinea', label: 'Tinea', whenToSuspect: 'Active scaly edge, unilateral', referralOnHighSuspicion: true },
    { id: 'psoriasis', label: 'Psoriasis', whenToSuspect: 'Well-demarcated silvery plaques, extensor surfaces' },
  ],

  treatments: corpusTreatmentOptions(sel.payload),

  counselling: [
    { id: 'emollients', label: 'Emollient-first strategy (liberal, frequent)', required: true },
    { id: 'application_technique', label: 'Steroid application — fingertip units, thin layer', required: true },
    { id: 'treatment_duration', label: 'Treatment duration and when to step down', required: true },
    { id: 'expected_response', label: 'Expected response timeframe', required: true },
    { id: 'urgent_care', label: 'When to seek urgent care (spreading redness, fever, punched-out lesions)', required: true },
    { id: 'trigger_avoidance', label: 'Trigger identification and avoidance', required: true },
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
    generate: corpusNoteGenerator(sel, 'Atopic Dermatitis (mild–moderate flare)'),
  },

  completionChecklist: [
    { id: 'patient', label: 'Patient profile complete', required: true,
      isComplete: (d) => {
        const p = (d.patient ?? {}) as Record<string, string>;
        return !!(p.firstName && p.lastName && p.dob);
      } },
    { id: 'presentation', label: 'Presentation and severity documented', required: true,
      isComplete: (d) => {
        const f = ((d as Record<string, unknown>).fields ?? {}) as Record<string, unknown>;
        return !isUnansweredVal(f.firstPresentation) && !isUnansweredVal(f.severity);
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

export const AD_CORPUS_RED_FLAG_IDS = RED_FLAG_IDS;
export const atopicDermatitisCorpusSelection = sel;