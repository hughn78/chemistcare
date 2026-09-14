/**
 * Canonical clinical protocol model
 * ---------------------------------
 * This module exists to end the "same clinical fact in three files" problem
 * found in the 12 Sep 2026 audit, where UTI nitrofurantoin dosing appeared
 * three different ways across conditions.ts, conditionTemplates/uti.ts and
 * types/protocols.ts.
 *
 * There is now ONE canonical representation of a clinical protocol.
 * The UI may transform it for display; treatment rules must never be
 * re-hardcoded anywhere else.
 *
 * Three concepts are deliberately kept SEPARATE (they are not interchangeable):
 *
 *   1. CLINICAL PROTOCOL      — what assessment/treatment a guideline recommends
 *   2. JURISDICTIONAL AUTHORITY — whether a pharmacist may legally provide it there
 *   3. PHARMACIST CAPABILITY  — whether THIS pharmacist is trained/current
 *
 * A single `canPrescribe` boolean can never represent all three.
 */

/** Australian jurisdictions modelled by the product. */
export type JurisdictionCode = 'VIC' | 'QLD' | 'NSW' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT' | 'CTH';

/**
 * Where the clinical content came from.
 * `government` = published government protocol (preferred, citable).
 * `derived`    = derived from a government protocol for a related service.
 * `unverified` = present in the app but not traceable to a retrieved source.
 */
export type SourceType = 'government' | 'professional_body' | 'derived' | 'unverified';

/**
 * Protocol lifecycle. Ordering matters — see PROTOCOL_STATUS_ORDER.
 *
 * A protocol must be `active` before it may be presented as a normal
 * prescribing pathway. Anything earlier renders in REFERENCE / DEVELOPMENT
 * mode so a pharmacist cannot mistake it for an approved pathway.
 */
export type ProtocolLifecycleStatus =
  | 'draft'
  | 'source_verified'
  | 'clinical_review_required'
  | 'clinically_reviewed'
  | 'active'
  | 'superseded'
  | 'retired';

export const PROTOCOL_STATUS_ORDER: readonly ProtocolLifecycleStatus[] = [
  'draft',
  'source_verified',
  'clinical_review_required',
  'clinically_reviewed',
  'active',
  'superseded',
  'retired',
] as const;

/** Statuses that must never be presented as a live prescribing pathway. */
export const NON_PRESCRIBING_STATUSES: readonly ProtocolLifecycleStatus[] = [
  'draft',
  'source_verified',
  'clinical_review_required',
  'retired',
] as const;

export function mayPresentAsPrescribingPathway(status: ProtocolLifecycleStatus): boolean {
  return status === 'active' || status === 'clinically_reviewed';
}

/** A citable source document. Identity + provenance, no clinical content. */
export interface ProtocolSource {
  /** Stable internal identifier, e.g. 'VIC_CCN_UTI_2026_01'. */
  id: string;
  /** Human-readable title exactly as published. */
  title: string;
  jurisdiction: JurisdictionCode;
  /** Issuing authority, e.g. 'Victorian Department of Health'. */
  authority: string;
  /** Program name, e.g. 'Community Pharmacist Program (Chemist Care Now)'. */
  program: string;
  sourceType: SourceType;
  /** Document version string if the publisher states one. */
  version?: string;
  /** Date the document states it was published/updated (ISO date). */
  publishedDate?: string;
  /** Date the publisher last updated it, if stated separately. */
  updatedDate?: string;
  /** Date WE retrieved/verified it. Always set for a verified source. */
  retrievedAt: string;
  /** Canonical landing page. */
  url: string;
  /** Direct document URL if different. */
  documentUrl?: string;
  /** ISBN or similar publisher identifier. */
  isbn?: string;
  /** Set when the source could not be retrieved or two sources conflict. */
  needsClinicalReview?: boolean;
  /** Why review is needed — required when needsClinicalReview is true. */
  reviewNote?: string;
}

/** Service model a jurisdiction uses to authorise pharmacist supply. */
export type AuthorityModel =
  | 'structured_prescribing'
  | 'pilot'
  | 'business_as_usual'
  | 'chronic_conditions_pilot'
  | 'not_authorised'
  | 'unknown';

/**
 * Jurisdictional authority — SEPARATE from clinical protocol.
 * A protocol can be excellent clinical guidance without creating legal
 * authority to use it in a given state.
 */
export interface JurisdictionScope {
  jurisdiction: JurisdictionCode;
  conditionId: string;
  authorityModel: AuthorityModel;
  /** Citation for the legal/enabling instrument. */
  authorityReference?: string;
  /** Is a pharmacist permitted to provide this service here? */
  permitted: boolean;
  /** Free-text limitations on that permission. */
  limitations: string[];
  requiredTraining?: string;
  effectiveDate?: string;
  /** When this was last checked against the source. */
  lastCheckedAt?: string;
  sourceId?: string;
  /** True when legal authority is uncertain — must be surfaced, not hidden. */
  needsClinicalReview?: boolean;
  reviewNote?: string;
}

/**
 * Individual pharmacist capability — SEPARATE again.
 * A permitted service still requires a trained, current pharmacist.
 */
export interface PharmacistCapability {
  pharmacistId: string;
  conditionId: string;
  trained: boolean;
  trainingProvider?: string;
  trainingCompletedAt?: string;
  competencyStatus: 'current' | 'expired' | 'pending' | 'unknown';
  lastPractisedAt?: string;
}

/** Structured outcome of a consultation. Referral is a first-class success. */
export type ConsultOutcomeKind =
  | 'treat'
  | 'treat_and_refer'
  | 'refer_routine'
  | 'refer_same_day'
  | 'urgent_care'
  | 'emergency_department'
  | 'call_emergency'
  | 'specialist'
  | 'no_treatment'
  | 'undecided';

export interface ReferralOutcome {
  kind: ConsultOutcomeKind;
  /** Short label for UI, e.g. 'Immediate referral to Emergency Department'. */
  label: string;
  /** Why this outcome was chosen. */
  reason: string;
  /** Protocol rule that produced it. */
  ruleId?: string;
  /** Prescribing is not permitted under the protocol for this consultation. */
  prescribingBlocked: boolean;
  /** ISBAR handover text when a referral is generated. */
  handover?: string;
}

/**
 * Clinically interpretable safety finding.
 * Replaces the previous `100 - 40*blockers - 10*warnings` score, which implied
 * a precision it did not have.
 */
export type SafetySeverity =
  | 'hard_stop'
  | 'contraindication'
  | 'refer'
  | 'caution'
  | 'monitor'
  | 'information';

export type OverridePolicy = 'non_overridable' | 'rationale_required' | 'warning_only';

export interface SafetyFinding {
  ruleId: string;
  /** One-line summary, e.g. 'Pregnancy — immediate GP referral required'. */
  finding: string;
  severity: SafetySeverity;
  reason: string;
  /** Protocol source this rule derives from. */
  sourceId: string;
  recommendedAction: string;
  overridePolicy: OverridePolicy;
  /** Populated when a pharmacist overrides a rationale_required finding. */
  override?: {
    reason: string;
    at: string;
    by?: string;
  };
}

/** Structured medicine — never match safety rules on raw free text. */
export type MedicineStatus = 'current' | 'ceased' | 'historical' | 'prn' | 'unknown';

export interface Medication {
  rawText: string;
  normalisedName?: string;
  activeIngredient?: string;
  strength?: string;
  form?: string;
  status: MedicineStatus;
  indication?: string;
  /** Terminology system for `code` — prefer AMT for Australian content. */
  codeSystem?: 'AMT' | 'RxNorm' | 'PBS' | 'unmapped';
  code?: string;
}

export interface Allergy {
  substance: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'anaphylaxis' | 'unknown';
  certainty?: 'confirmed' | 'suspected' | 'unknown';
  status: 'active' | 'resolved' | 'unknown';
}

/** A medicine as listed in a protocol's medicines list. */
export interface ProtocolMedicine {
  id: string;
  medicineName: string;
  activeIngredient?: string;
  /** Line of therapy: 1 = first line per the protocol. */
  line: 1 | 2 | 3 | 4;
  dose: string;
  frequency: string;
  duration: string;
  quantity?: number;
  repeats?: number;
  /** Contraindications exactly as the protocol states them. */
  contraindications: string[];
  cautions?: string[];
  /** Allergy substances that conflict. */
  allergyConflicts?: string[];
  /** Interaction flags stated by the protocol. */
  interactionFlags?: string[];
  counsellingPoints?: string[];
  /** True when the protocol states a quantitative threshold we could not verify. */
  needsClinicalReview?: boolean;
  reviewNote?: string;
  /** Provenance for this specific medicine entry. */
  sourceId: string;
}

export interface RedFlag {
  id: string;
  label: string;
  /** Protocol-stated consequence. */
  action: string;
  /** Outcome this flag drives when positive. */
  outcome: ConsultOutcomeKind;
  prescribingBlocked: boolean;
  sourceId: string;
}

/** An eligibility criterion stated by the protocol. */
export interface EligibilityCriterion {
  id: string;
  label: string;
  /** Outcome if NOT met. */
  ifUnmet: ConsultOutcomeKind;
  prescribingBlocked: boolean;
  sourceId: string;
}

/**
 * The canonical clinical protocol.
 * One of these per condition per jurisdiction. Never duplicated.
 */
export interface ProtocolDefinition {
  id: string;
  conditionId: string;
  conditionName: string;
  title: string;
  jurisdiction: JurisdictionCode;
  authorityName: string;
  sourceId: string;
  sourceType: SourceType;
  lifecycle: ProtocolLifecycleStatus;
  effectiveDate?: string;
  /** Which source this supersedes, for change tracking. */
  supersedes?: string;
  /** Set when any component could not be verified — blocks 'active'. */
  needsClinicalReview?: boolean;
  reviewNote?: string;

  eligibility: EligibilityCriterion[];
  redFlags: RedFlag[];
  /** Conservative/non-drug management stated by the protocol. */
  nonDrugManagement?: string[];
  medicines: ProtocolMedicine[];
  /** Medicines the protocol explicitly EXCLUDES — clinically important. */
  excludedMedicines?: { medicineName: string; reason: string }[];
  followUp?: string[];
  safetyNetting?: string[];
  /** Protocol-stated documentation requirements. */
  documentationRequirements?: string[];
}
