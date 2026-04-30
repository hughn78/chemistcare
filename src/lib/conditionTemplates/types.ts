/**
 * ChemistCare PrescriberOS — Condition Template Contract
 * ------------------------------------------------------
 * Shared types that every condition pathway must implement to be
 * pluggable into the new condition-driven consultation engine.
 *
 * UTI is the first full implementation (`./uti.ts`). Future conditions
 * (the remaining 21) should copy the same shape so that:
 *
 *   - Steps are declared (not hardcoded)
 *   - Red flags / scope rules are pure data
 *   - Treatment decision support is editable protocol data
 *   - Counselling + documentation templates are part of the contract
 *
 * IMPORTANT: This contract is intentionally additive. The legacy
 * `Condition` type in `src/types/clinical.ts` continues to drive the
 * generic 6-step engine in `NewConsultation.tsx`. We do NOT migrate
 * the other 21 conditions in this change.
 */

import type { Condition } from '@/types/clinical';
import type { ComponentType } from 'react';

// ────────── Field primitives ──────────

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'date'
  | 'datetime'
  | 'number'
  | 'boolean'        // yes / no
  | 'tristate'       // yes / no / unsure
  | 'tags'
  | 'checkbox-group';

export interface FieldOption {
  value: string;
  label: string;
  /** If selected, contributes to scope/red-flag evaluation. */
  flagsOutOfScope?: boolean;
}

export interface FieldDefinition {
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  /** Optional dependency: only show if predicate returns true. */
  showIf?: (data: Record<string, unknown>) => boolean;
}

// ────────── Steps ──────────

export type StepKind =
  | 'patient-profile'
  | 'presenting-complaint'
  | 'red-flags'
  | 'scope-validation'
  | 'differentials'
  | 'treatment'
  | 'counselling'
  | 'documentation'
  | 'completion';

export interface StepDefinition {
  id: string;
  kind: StepKind;
  label: string;
  description?: string;
  fields?: FieldDefinition[];
  /** Whether the user can advance past this step while blockers exist. */
  blockableByRedFlags?: boolean;
  blockableByScope?: boolean;
}

// ────────── Red flags ──────────

export interface RedFlagDefinition {
  id: string;
  label: string;
  /** Reason shown when the flag is positive. */
  detail?: string;
  /** Severity drives display + safety score weighting. */
  severity: 'critical' | 'high' | 'moderate';
  /** Action message surfaced in the UI when positive. */
  action: string;
  /** A positive answer blocks pharmacist prescribing. */
  blocksPrescribing: boolean;
}

// ────────── Scope ──────────

export type ScopeStatus = 'in_scope' | 'needs_clarification' | 'out_of_scope';

export interface ScopeRuleResult {
  status: ScopeStatus;
  reason?: string;
}

export interface ScopeRuleDefinition {
  id: string;
  label: string;
  /**
   * Pure function evaluated against the full consultation data.
   * Return null/undefined to indicate "no contribution to scope".
   */
  evaluate: (data: Record<string, unknown>) => ScopeRuleResult | null | undefined;
}

// ────────── Differentials ──────────

export interface DifferentialDefinition {
  id: string;
  label: string;
  /** Hint shown to the pharmacist for when to suspect this. */
  whenToSuspect?: string;
  /** Strong suspicion should trigger referral. */
  referralOnHighSuspicion?: boolean;
}

// ────────── Treatment ──────────

export interface TreatmentOptionDefinition {
  id: string;
  medicineName: string;
  /** "first" / "second" line ordering hint. */
  line: 'first' | 'second' | 'third';
  dose: string;
  frequency: string;
  duration: string;
  maxQuantity: number;
  repeats: number;
  pbsRestriction?: string;
  /** Free-text contraindication strings, matched case-insensitively
   *  against the patient's `relevantConditions` + `currentMeds`. */
  contraindications: string[];
  cautions?: string[];
  /** Allergy class/medicine substrings that block this option. */
  allergyConflicts: string[];
  /** Drug names that trigger an interaction warning. */
  interactionFlags: string[];
  counsellingPoints: string[];
  followUpAdvice?: string;
  referralTriggers?: string[];
  /** Suggested alternative option id when this one is blocked. */
  alternativeOptionId?: string;
}

// ────────── Counselling ──────────

export interface CounsellingItemDefinition {
  id: string;
  label: string;
  /** If true, must be ticked before consultation can finalise. */
  required?: boolean;
}

// ────────── Documentation ──────────

export interface DocumentationTemplateDefinition {
  /** Section headings rendered in the live note. */
  sections: { id: string; heading: string }[];
  /**
   * Generator that turns the typed consultation data into a clinical
   * note string. Each condition writes its own UTI-, OCP-, etc-
   * specific narrative — no generic fallback.
   */
  generate: (data: Record<string, unknown>) => string;
}

// ────────── Completion checklist ──────────

export interface CompletionItemDefinition {
  id: string;
  label: string;
  /** Pure check evaluated against the consultation data. */
  isComplete: (data: Record<string, unknown>) => boolean;
  /** Marked critical → blocks finalisation. */
  required?: boolean;
}

// ────────── Safety score weighting ──────────

export interface SafetyScoreWeights {
  /** Penalty per missing critical assessment field (e.g. pregnancy). */
  missingCriticalField: number;
  /** Penalty per unanswered red flag. */
  unansweredRedFlag: number;
  /** Penalty per allergy conflict against selected treatment. */
  allergyConflict: number;
  /** Penalty applied when treatment selected while out of scope. */
  outOfScopeTreatment: number;
  /** Penalty when treatment selected without counselling complete. */
  treatmentWithoutCounselling: number;
  /** Penalty when treatment selected without follow-up advice. */
  treatmentWithoutFollowUp: number;
}

// ────────── Top-level template ──────────

export interface ConditionTemplate {
  /** Canonical id (must match registry id, e.g. `uti`). */
  id: string;
  /** Stable URL slug (must match registry slug). */
  slug: string;
  /** Human-readable name. */
  name: string;
  /** Acute / Chronic / etc. */
  category: 'acute' | 'chronic' | 'preventive' | 'resupply' | 'travel';
  /** Jurisdiction the protocol is valid in. */
  jurisdictions: string[];
  /** Bumped when the template shape changes. */
  templateVersion: number;
  /** Last clinical review date (ISO). */
  lastReviewed?: string;
  /** Source of truth for the underlying clinical record (used by
   *  legacy components like ConditionDetail). */
  legacyCondition: Condition;

  steps: StepDefinition[];
  redFlags: RedFlagDefinition[];
  scopeRules: ScopeRuleDefinition[];
  differentials: DifferentialDefinition[];
  treatments: TreatmentOptionDefinition[];
  counselling: CounsellingItemDefinition[];
  documentation: DocumentationTemplateDefinition;
  completionChecklist: CompletionItemDefinition[];
  safetyWeights: SafetyScoreWeights;

  /** Optional per-condition right-rail decision support widget. */
  decisionSupport?: ComponentType<{ data: Record<string, unknown> }>;
}

// ────────── Generic consultation state envelope ──────────

export interface ConsultationStateEnvelope<TStep = Record<string, Record<string, unknown>>> {
  conditionSlug: string;
  templateVersion: number;
  stepData: TStep;
  safetyScore: number;
  completionStatus: 'in_progress' | 'ready' | 'blocked' | 'finalised';
  auditEvents: { at: string; type: string; meta?: Record<string, unknown> }[];
}
