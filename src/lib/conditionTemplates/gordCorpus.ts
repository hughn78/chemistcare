/**
 * GORD / Gastro-oesophageal Reflux — Corpus-driven template
 * ---------------------------------------------------------
 * Generated from the Sep 2026 protocol corpus: primary instrument is the
 * WA "Enhanced Access Community Pharmacy Pilot — Gastro-oesophageal reflux
 * and GORD" guideline, QLD CPG as fallback. Age window (18–55), alarm
 * features and PPI therapy come from the instrument's own extraction.
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

const CONDITION_KEY = 'gord';
const PREFERRED_STATE = 'WA';
const sel = selectCorpusDoc(CONDITION_KEY, PREFERRED_STATE)!;
const { ids: RED_FLAG_IDS, defs: RED_FLAG_DEFS } = corpusRedFlagDefs(sel.payload);

function isUnansweredVal(v: unknown): boolean {
  return v === undefined || v === '' || v === null;
}

const extraScopeRules: ScopeRuleDefinition[] = [
  {
    id: 'symptom_duration',
    label: 'Symptom pattern within protocol (≤ 4 weeks, no prior PPI failure)',
    evaluate: (data): ScopeRuleResult | null => {
      const dur = data.duration as string | undefined;
      const ppi = data.priorPpiUse as string | undefined;
      if (isUnansweredVal(dur)) {
        return { status: 'needs_clarification', reason: 'Symptom duration required' };
      }
      if (dur === 'over_4w') {
        return { status: 'out_of_scope', reason: 'Symptoms > 4 weeks — GP review required' };
      }
      if (ppi === 'failed') {
        return { status: 'out_of_scope', reason: 'Prior PPI failure — medical assessment required' };
      }
      return { status: 'in_scope' };
    },
  },
];

export const gordTemplate: ConditionTemplate = {
  id: 'gord',
  slug: 'gord',
  name: 'GORD / Reflux',
  category: 'acute',
  jurisdictions: Array.from(new Set([sel.meta.state])),
  templateVersion: 1,
  conditionTemplateVersion: '1.0.0',
  jurisdictionProtocolVersion: corpusJurisdictionProtocolVersion(sel),
  protocolStatus: 'active',
  protocolLastReviewed: sel.meta.extractedAt?.slice(0, 10),
  protocolSourceLabel: sel.meta.title,
  legacyCondition: getConditionById('gord')!,

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
        { id: 'heartburn', label: 'Heartburn / retrosternal burning', kind: 'boolean', required: true },
        { id: 'reflux_regurgitation', label: 'Acid regurgitation', kind: 'boolean', required: true },
        { id: 'duration', label: 'Symptom duration', kind: 'select', required: true,
          options: [
            { value: 'under_2w', label: 'Under 2 weeks' },
            { value: '2_4w', label: '2–4 weeks' },
            { value: 'over_4w', label: 'Over 4 weeks', flagsOutOfScope: true },
          ] },
        { id: 'priorPpiUse', label: 'Previous PPI use', kind: 'select', required: true,
          options: [
            { value: 'none', label: 'None' },
            { value: 'helped', label: 'Previously helped' },
            { value: 'failed', label: 'Failed adequate course', flagsOutOfScope: true },
          ] },
        { id: 'symptomNotes', label: 'Clinical notes', kind: 'textarea' },
      ],
    },
    {
      id: 'alarm', kind: 'red-flags', label: 'Alarm Features (GI cancer risk)',
      description: 'Negative answers required for all alarm features',
      blockableByRedFlags: true,
    },
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
    corpusAgeScopeRule(sel.payload, 18, 55, 'GORD'),
    corpusNoRedFlagsScopeRule(RED_FLAG_IDS),
    ...extraScopeRules,
  ],

  differentials: [
    { id: 'cardiac', label: 'Cardiac chest pain (ACS)', whenToSuspect: 'Exertional, radiating, diaphoresis', referralOnHighSuspicion: true },
    { id: 'peptic_ulcer', label: 'Peptic ulcer disease', whenToSuspect: 'Epigastric pain, NSAID use, H. pylori risk', referralOnHighSuspicion: false },
    { id: 'h_pylori', label: 'H. pylori gastritis', whenToSuspect: 'Dyspepsia, no alarm features — test-and-treat pathway' },
    { id: 'oesophageal_cancer', label: 'Oesophageal cancer', whenToSuspect: 'Progressive dysphagia, weight loss, age > 55', referralOnHighSuspicion: true },
    { id: ' functional_dyspepsia', label: 'Functional dyspepsia', whenToSuspect: 'Post-prandial fullness, no alarm features' },
  ],

  treatments: corpusTreatmentOptions(sel.payload),

  counselling: [
    { id: 'ppi_timing', label: 'PPI timing — 30–60 min before food', required: true },
    { id: 'lifestyle', label: 'Lifestyle measures (weight, alcohol, smoking, trigger foods, evening meals)', required: true },
    { id: 'expected_response', label: 'Expected response within days to 2 weeks', required: true },
    { id: 'urgent_care', label: 'When to seek urgent care (dysphagia, vomiting blood, black stools)', required: true },
    { id: 'review_window', label: 'Review if no response at 2 weeks — GP referral', required: true },
  ],

  documentation: {
    sections: [
      { id: 'patient', heading: 'Patient' },
      { id: 'complaint', heading: 'Presenting Complaint' },
      { id: 'alarm', heading: 'Alarm Feature Screening' },
      { id: 'scope', heading: 'Scope Decision' },
      { id: 'plan', heading: 'Plan' },
      { id: 'counselling', heading: 'Counselling' },
    ],
    generate: corpusNoteGenerator(sel, 'GORD / Reflux'),
  },

  completionChecklist: [
    { id: 'patient', label: 'Patient profile complete', required: true,
      isComplete: (d) => {
        const p = (d.patient ?? {}) as Record<string, string>;
        return !!(p.firstName && p.lastName && p.dob);
      } },
    { id: 'symptoms', label: 'Symptoms and duration documented', required: true,
      isComplete: (d) => {
        const f = ((d as Record<string, unknown>).fields ?? {}) as Record<string, unknown>;
        return !isUnansweredVal(f.heartburn) && !isUnansweredVal(f.duration) && !isUnansweredVal(f.priorPpiUse);
      } },
    { id: 'red_flags', label: 'Instrument red flag screening complete', required: true,
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

export const gordCorpusSelection = sel;