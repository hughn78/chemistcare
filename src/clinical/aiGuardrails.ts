/**
 * AI scribe guardrails
 * --------------------
 * The product uses AI to DRAFT narrative text. It must never decide anything.
 *
 * These rules are enforced in code, not in a prompt, because a prompt is a
 * suggestion and a consultation record is a medico-legal document.
 */

/** Free-text narrative the pharmacist writes or reviews. AI may draft this. */
export type ClinicalFieldKind =
  | 'narrative'
  | 'red_flag_answer'
  | 'eligibility_answer'
  | 'treatment_selection'
  | 'safety_override'
  | 'referral_decision'
  | 'finalisation'
  | 'diagnosis'
  | 'prescription';

/**
 * The only kind of field an AI may draft. Everything else is a clinical
 * decision and stays with the pharmacist.
 */
export const AI_DRAFTABLE_FIELD_KINDS: readonly ClinicalFieldKind[] = ['narrative'] as const;

export function aiMayDraft(kind: ClinicalFieldKind): boolean {
  return AI_DRAFTABLE_FIELD_KINDS.includes(kind);
}

export type AiConsentState = 'not_asked' | 'granted' | 'declined';

/** An AI-drafted piece of clinical text. Never enters the record unreviewed. */
export type AiDraftStatus = 'draft' | 'reviewed' | 'discarded';

export interface AiDraft {
  id: string;
  kind: ClinicalFieldKind;
  content: string;
  status: AiDraftStatus;
  generatedBy: string;
  generatedAt: string;
  /** Who reviewed it — required before it can enter the record. */
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface AiGuardrailIssue {
  code:
    | 'ai_forbidden_field'
    | 'unreviewed_draft'
    | 'missing_reviewer'
    | 'empty_draft'
    | 'diagnostic_language'
    | 'prescriptive_language';
  severity: 'error' | 'warning';
  message: string;
}

/** Exact attestation wording required by the brief. */
export const PHARMACIST_ATTESTATION =
  'Reviewed and confirmed by pharmacist';

/**
 * Phrases that indicate the model stepped outside drafting. Surfaced as
 * warnings so the pharmacist looks, never silently rewritten.
 */
const DIAGNOSTIC_PATTERNS = [
  /\bdiagnos(?:is|ed|e)\b/i,
  /\byou (?:have|definitely have)\b/i,
  /\bconfirmed? (?:diagnosis|UTI|infection)\b/i,
  /\bthis is (?:definitely|clearly)\b/i,
];

const PRESCRIPTIVE_PATTERNS = [
  /\bprescrib(?:e|ed|ing)\b/i,
  /\bi recommend (?:taking|using)\b/i,
  /\bstart (?:taking|the antibiotic)\b/i,
  /\bdose (?:is|of) \d+\s?mg\b/i,
];

export function detectClinicalOverreach(text: string): AiGuardrailIssue[] {
  const issues: AiGuardrailIssue[] = [];
  if (!text || !text.trim()) return issues;

  if (DIAGNOSTIC_PATTERNS.some(p => p.test(text))) {
    issues.push({
      code: 'diagnostic_language',
      severity: 'warning',
      message:
        'This draft contains diagnostic language. A diagnosis is the pharmacist’s judgement, not the scribe’s. Edit it before accepting.',
    });
  }
  if (PRESCRIPTIVE_PATTERNS.some(p => p.test(text))) {
    issues.push({
      code: 'prescriptive_language',
      severity: 'warning',
      message:
        'This draft contains prescribing instructions. Dosing and supply decisions must be made by the pharmacist under the protocol.',
    });
  }
  return issues;
}

/** Validate a draft before it is allowed anywhere near the record. */
export function validateAiDraft(draft: AiDraft): AiGuardrailIssue[] {
  const issues: AiGuardrailIssue[] = [];

  if (!aiMayDraft(draft.kind)) {
    issues.push({
      code: 'ai_forbidden_field',
      severity: 'error',
      message: `AI must not generate content for a "${draft.kind}" field. This is a clinical decision.`,
    });
  }
  if (!draft.content || !draft.content.trim()) {
    issues.push({ code: 'empty_draft', severity: 'error', message: 'Draft is empty.' });
  }
  if (draft.status === 'draft') {
    issues.push({
      code: 'unreviewed_draft',
      severity: 'error',
      message: 'This is an unreviewed AI draft. It cannot be saved to the consultation record.',
    });
  }
  if (draft.status === 'reviewed' && !draft.reviewedBy?.trim()) {
    issues.push({
      code: 'missing_reviewer',
      severity: 'error',
      message: 'A reviewed draft must name the pharmacist who reviewed it.',
    });
  }

  issues.push(...detectClinicalOverreach(draft.content));
  return issues;
}

/**
 * May this draft be written into the consultation record?
 * Errors block; warnings do not.
 */
export function mayEnterRecord(draft: AiDraft): boolean {
  return !validateAiDraft(draft).some(i => i.severity === 'error');
}

export function attestDraft(
  draft: AiDraft,
  pharmacistName: string,
  at: string = new Date().toISOString(),
): AiDraft {
  return {
    ...draft,
    status: 'reviewed',
    reviewedBy: pharmacistName.trim(),
    reviewedAt: at,
  };
}

/** Banner shown whenever AI-drafted text is on screen. Never hover-only. */
export const AI_DRAFT_NOTICE =
  'AI-generated draft — not clinically reviewed. Do not rely on it until a pharmacist has reviewed and confirmed it.';
