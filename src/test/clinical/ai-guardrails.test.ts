// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  AI_DRAFT_NOTICE,
  PHARMACIST_ATTESTATION,
  aiMayDraft,
  attestDraft,
  detectClinicalOverreach,
  mayEnterRecord,
  validateAiDraft,
  type AiDraft,
} from '@/clinical/aiGuardrails';

function draft(overrides: Partial<AiDraft> = {}): AiDraft {
  return {
    id: 'ai-1',
    kind: 'narrative',
    content: 'Patient reports dysuria and frequency for two days.',
    status: 'draft',
    generatedBy: 'AI scribe',
    generatedAt: '2026-09-13T00:00:00Z',
    ...overrides,
  };
}

describe('AI may only draft narrative text', () => {
  it('allows narrative and nothing else', () => {
    expect(aiMayDraft('narrative')).toBe(true);
    for (const kind of [
      'red_flag_answer',
      'eligibility_answer',
      'treatment_selection',
      'safety_override',
      'referral_decision',
      'finalisation',
      'diagnosis',
      'prescription',
    ] as const) {
      expect(aiMayDraft(kind)).toBe(false);
    }
  });

  it('rejects a draft aimed at a red flag answer', () => {
    const issues = validateAiDraft(draft({ kind: 'red_flag_answer' }));
    expect(issues.some(i => i.code === 'ai_forbidden_field' && i.severity === 'error')).toBe(true);
  });
});

describe('an unreviewed draft cannot enter the record', () => {
  it('blocks a draft that has not been reviewed', () => {
    const d = draft();
    expect(mayEnterRecord(d)).toBe(false);
    expect(validateAiDraft(d).some(i => i.code === 'unreviewed_draft')).toBe(true);
  });

  it('blocks a "reviewed" draft with no named reviewer', () => {
    const d = draft({ status: 'reviewed' });
    expect(mayEnterRecord(d)).toBe(false);
    expect(validateAiDraft(d).some(i => i.code === 'missing_reviewer')).toBe(true);
  });

  it('allows a reviewed draft that names the pharmacist', () => {
    const d = attestDraft(draft(), 'A. Pharmacist');
    expect(d.status).toBe('reviewed');
    expect(d.reviewedBy).toBe('A. Pharmacist');
    expect(mayEnterRecord(d)).toBe(true);
  });

  it('uses the required attestation wording', () => {
    expect(PHARMACIST_ATTESTATION).toBe('Reviewed and confirmed by pharmacist');
  });

  it('an empty draft is an error, not a silent no-op', () => {
    expect(validateAiDraft(draft({ content: '   ' })).some(i => i.code === 'empty_draft')).toBe(true);
  });
});

describe('overreach detection', () => {
  it('warns on diagnostic language', () => {
    const issues = detectClinicalOverreach('The patient is diagnosed with acute cystitis.');
    expect(issues.some(i => i.code === 'diagnostic_language')).toBe(true);
    // Warnings inform; they do not silently rewrite the text.
    expect(issues.every(i => i.severity === 'warning')).toBe(true);
  });

  it('warns on prescribing instructions', () => {
    expect(
      detectClinicalOverreach('I prescribe nitrofurantoin 100 mg four times daily for 5 days.')
        .some(i => i.code === 'prescriptive_language'),
    ).toBe(true);
  });

  it('stays quiet on plain narrative', () => {
    expect(detectClinicalOverreach('Reports dysuria and urinary frequency for 2 days.')).toEqual([]);
  });
});

describe('draft notice', () => {
  it('states that the draft is not clinically reviewed', () => {
    expect(AI_DRAFT_NOTICE).toMatch(/not clinically reviewed/i);
  });
});
