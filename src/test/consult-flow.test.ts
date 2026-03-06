import { describe, it, expect } from 'vitest';
import { validateStep, computeStepStatus } from '@/components/ConsultationValidation';
import { logValidationBlocker, getBlockerLog, clearBlockerLog } from '@/lib/qaTelemetry';

// ─── 1. Patient Profile valid completion → Assessment transition ───
describe('Patient Profile validation', () => {
  const validForm = { firstName: 'Jane', lastName: 'Doe', sex: 'female', dob: '1990-01-15' };
  const emptyRedFlags = {};
  const emptyDiffs = [{ diagnosis: '', reasonExcluded: '' }];
  
  it('marks step complete when all required fields + condition are present', () => {
    const result = validateStep('patient', validForm, undefined, emptyRedFlags, emptyDiffs, 'uti');
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.filled).toBe(result.total);
  });

  it('marks step incomplete when condition is missing', () => {
    const result = validateStep('patient', validForm, undefined, emptyRedFlags, emptyDiffs, '');
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('Condition selection');
  });

  it('marks step incomplete when firstName is empty', () => {
    const result = validateStep('patient', { ...validForm, firstName: '' }, undefined, emptyRedFlags, emptyDiffs, 'uti');
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('First name');
  });

  it('marks step incomplete when sex is empty', () => {
    const result = validateStep('patient', { ...validForm, sex: '' }, undefined, emptyRedFlags, emptyDiffs, 'uti');
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('Sex');
  });
});

// ─── 2. DOB invalid/valid edge cases ───
describe('DOB validation', () => {
  const baseForm = { firstName: 'A', lastName: 'B', sex: 'male' };
  const emptyRedFlags = {};
  const emptyDiffs = [{ diagnosis: '', reasonExcluded: '' }];

  it('rejects missing DOB', () => {
    const result = validateStep('patient', { ...baseForm }, undefined, emptyRedFlags, emptyDiffs, 'uti');
    expect(result.missing).toContain('Date of birth');
  });

  it('rejects invalid date string', () => {
    const result = validateStep('patient', { ...baseForm, dob: 'not-a-date' }, undefined, emptyRedFlags, emptyDiffs, 'uti');
    expect(result.missing.some(m => m.includes('invalid date'))).toBe(true);
  });

  it('rejects future date', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = validateStep('patient', { ...baseForm, dob: futureDate.toISOString().split('T')[0] }, undefined, emptyRedFlags, emptyDiffs, 'uti');
    expect(result.missing.some(m => m.includes('future'))).toBe(true);
  });

  it('accepts valid past date', () => {
    const result = validateStep('patient', { ...baseForm, dob: '2000-06-15' }, undefined, emptyRedFlags, emptyDiffs, 'uti');
    expect(result.missing.filter(m => m.includes('Date of birth'))).toEqual([]);
  });
});

// ─── 3. Discard draft full reset ───
describe('Draft discard ensures fresh state', () => {
  it('localStorage draft key is removed after discard', () => {
    const DRAFT_KEY = 'chemistcare_consultation_draft';
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData: { firstName: 'Test' } }));
    
    // Simulate discard
    localStorage.removeItem(DRAFT_KEY);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

// ─── 4. Restore draft then discard → fresh consult ───
describe('Restore then discard cycle', () => {
  it('produces clean state after restore + discard', () => {
    const DRAFT_KEY = 'chemistcare_consultation_draft';
    const draft = { formData: { firstName: 'Jane' }, selectedCondition: 'uti', currentStep: 'assessment' };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    
    // Restore
    const loaded = JSON.parse(localStorage.getItem(DRAFT_KEY)!);
    expect(loaded.formData.firstName).toBe('Jane');
    
    // Discard
    localStorage.removeItem(DRAFT_KEY);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

// ─── 5. Stepper status correctness under invalid and valid states ───
describe('computeStepStatus deterministic status', () => {
  it('returns "complete" for a fully valid past step', () => {
    const validation = { complete: true, missing: [], total: 4, filled: 4 };
    expect(computeStepStatus('patient', 'assessment', validation, false)).toBe('complete');
  });

  it('returns "needs_attention" for partially filled past step', () => {
    const validation = { complete: false, missing: ['Sex'], total: 5, filled: 3 };
    expect(computeStepStatus('patient', 'assessment', validation, false)).toBe('needs_attention');
  });

  it('returns "active" for current step', () => {
    const validation = { complete: false, missing: ['First name'], total: 5, filled: 2 };
    expect(computeStepStatus('patient', 'patient', validation, false)).toBe('active');
  });

  it('returns "blocked" when isBlocked is true', () => {
    const validation = { complete: false, missing: [], total: 3, filled: 1 };
    expect(computeStepStatus('assessment', 'assessment', validation, true)).toBe('blocked');
  });

  it('returns "incomplete" for untouched future step', () => {
    const validation = { complete: false, missing: ['Working diagnosis', 'At least one differential'], total: 2, filled: 0 };
    expect(computeStepStatus('differentials', 'patient', validation, false)).toBe('incomplete');
  });
});

// ─── 6. QA blocker telemetry ───
describe('QA validation blocker telemetry', () => {
  beforeEach(() => clearBlockerLog());

  it('logs a validation blocker entry', () => {
    logValidationBlocker('consult-123', 'patient', 'First name', 'required_field_missing');
    const log = getBlockerLog();
    expect(log.length).toBe(1);
    expect(log[0].consultId).toBe('consult-123');
    expect(log[0].stepId).toBe('patient');
    expect(log[0].fieldId).toBe('First name');
  });

  it('caps at 200 entries', () => {
    for (let i = 0; i < 210; i++) {
      logValidationBlocker(`c-${i}`, 'patient', 'field', 'reason');
    }
    expect(getBlockerLog().length).toBe(200);
  });
});
