/**
 * Nausea & Vomiting (acute gastroenteritis-associated) — Corpus-driven template
 * ----------------------------------------------------------------------------
 * Generated from the Sep 2026 protocol corpus: primary instrument is the WA
 * "Enhanced Access Community Pharmacy Pilot — Acute nausea and vomiting"
 * guideline, with QLD as fallback. Red flags, eligibility screening, scope
 * rules and treatments all read from the instrument's own extraction —
 * nothing here is invented clinical content.
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
  type CorpusDocSelection,
} from './corpusFactory';

const CONDITION_KEY = 'nausea-vomiting';
const PREFERRED_STATE = 'WA';
const sel = selectCorpusDoc(CONDITION_KEY, PREFERRED_STATE)!;
const { ids: RED_FLAG_IDS, defs: RED_FLAG_DEFS } = corpusRedFlagDefs(sel.payload);
const TREATMENTS = corpusTreatmentOptions(sel.payload);

// Instrument-specific scope rules (on top of age window + red-flag screen).
const extraScopeRules: ScopeRuleDefinition[] = [
  {
    id: 'dehydration_assessed',
    label: 'Dehydration severity assessed',
    evaluate: (data): ScopeRuleResult | null => {
      const sev = data.dehydration as string | undefined;
      if (isUnansweredVal(sev)) {
        return { status: 'needs_clarification', reason: 'Dehydration assessment required before scope decision' };
      }
      if (sev === 'severe') {
        return { status: 'out_of_scope', reason: 'Severe dehydration — urgent medical care required' };
      }
      return { status: 'in_scope' };
    },
  },
  {
    id: 'duration_window',
    label: 'Symptom duration within protocol window (≤ 48 h vomiting)',
    evaluate: (data): ScopeRuleResult | null => {
      const dur = data.duration as string | undefined;
      if (isUnansweredVal(dur)) {
        return { status: 'needs_clarification', reason: 'Symptom duration required' };
      }
      if (dur === 'over_48h') {
        return { status: 'out_of_scope', reason: 'Vomiting > 48 h — refer for assessment' };
      }
      return { status: 'in_scope' };
    },
  },
];

function isUnansweredVal(v: unknown): boolean {
  return v === undefined || v === '' || v === null;
}

export const nauseaTemplate: ConditionTemplate = {
  id: 'nausea',
  slug: 'acute-nausea-and-vomiting',
  name: 'Acute Nausea & Vomiting',
  category: 'acute',
  jurisdictions: Array.from(new Set([sel.meta.state])),
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: corpusJurisdictionProtocolVersion(sel),
  protocolStatus: 'active',
  protocolLastReviewed: sel.meta.extractedAt?.slice(0, 10),
  protocolSourceLabel: sel.meta.title,
  legacyCondition: getConditionById('nausea')!,

  steps: [
    {
      id: 'patient', kind: 'patient-profile', label: 'Patient Profile',
      description: 'Demographics, allergies, medicines, conditions',
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
        { id: 'duration', label: 'Duration of vomiting', kind: 'select', required: true,
          options: [
            { value: 'under_24h', label: 'Under 24 hours' },
            { value: '24_48h', label: '24–48 hours' },
            { value: 'over_48h', label: 'Over 48 hours', flagsOutOfScope: true },
          ] },
        { id: 'diarrhoea', label: 'Diarrhoea also present', kind: 'boolean' },
        { id: 'fluid_intake', label: 'Able to keep fluids down', kind: 'boolean', required: true },
        { id: 'symptomNotes', label: 'Clinical notes', kind: 'textarea',
          helpText: 'Onset, pattern, suspected trigger, oral intake' },
      ],
    },
    { id: 'red-flags', kind: 'red-flags', label: 'Red Flag Screening', blockableByRedFlags: true },
    { id: 'scope', kind: 'scope-validation', label: 'Scope Validation', blockableByScope: true },
    { id: 'treatment', kind: 'treatment', label: 'Treatment',
      blockableByRedFlags: true, blockableByScope: true,
      fields: [
        { id: 'dehydration', label: 'Dehydration severity', kind: 'select', required: true,
          options: [
            { value: 'none_mild', label: 'None / mild' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'severe', label: 'Severe (sunken eyes, poor perfusion, reduced consciousness)', flagsOutOfScope: true },
          ] },
        { id: 'followUpPlan', label: 'Follow-up plan', kind: 'textarea', required: true },
        { id: 'safetyNet', label: 'Safety net advice', kind: 'textarea', required: true },
      ],
    },
    { id: 'counselling', kind: 'counselling', label: 'Counselling' },
    { id: 'documentation', kind: 'documentation', label: 'Documentation' },
  ],

  redFlags: RED_FLAG_DEFS,
  scopeRules: [
    corpusAgeScopeRule(sel.payload, 18, 120, 'Acute nausea & vomiting'),
    corpusNoRedFlagsScopeRule(RED_FLAG_IDS),
    ...extraScopeRules,
  ] as ScopeRuleDefinition[],

  differentials: [
    { id: 'pregnancy', label: 'Pregnancy-related vomiting', whenToSuspect: 'Possibility of pregnancy', referralOnHighSuspicion: true },
    { id: 'migraine', label: 'Migraine', whenToSuspect: 'Photophobia, headache history' },
    { id: 'medication_related', label: 'Medication-related (opioids, antibiotics)', whenToSuspect: 'New medicine or dose change', referralOnHighSuspicion: false },
    { id: 'bowel_obstruction', label: 'Bowel obstruction', whenToSuspect: 'Colicky pain, distension, absolute constipation', referralOnHighSuspicion: true },
    { id: 'diabetic_ketoacidosis', label: 'Diabetic ketoacidosis', whenToSuspect: 'Diabetes, drowsiness, deep breathing', referralOnHighSuspicion: true },
  ],

  treatments: corpusTreatmentOptions(sel.payload),

  counselling: [
    { id: 'rehydration', label: 'Oral rehydration — small frequent sips', required: true },
    { id: 'expected_course', label: 'Expected course of gastroenteritis', required: true },
    { id: 'urgent_care', label: 'When to seek urgent care (signs of dehydration)', required: true },
    { id: 'medication_timing', label: 'How to take the antiemetic (if supplied)', required: true },
    { id: 'hygiene', label: 'Hygiene / transmission prevention', required: true },
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
    generate: corpusNoteGenerator(sel, 'Acute Nausea & Vomiting'),
  },

  completionChecklist: [
    { id: 'patient', label: 'Patient profile complete', required: true,
      isComplete: (d) => {
        const p = (d.patient ?? {}) as Record<string, string>;
        return !!(p.firstName && p.lastName && p.dob);
      } },
    { id: 'symptoms', label: 'Duration and fluid tolerance documented', required: true,
      isComplete: (d) => {
        const f = ((d as Record<string, unknown>).fields ?? {}) as Record<string, unknown>;
        return !isUnansweredVal(f.duration) && !isUnansweredVal(f.fluid_intake);
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

export const NAUSEA_RED_FLAG_IDS = RED_FLAG_IDS;
export const nauseaCorpusSelection = sel;