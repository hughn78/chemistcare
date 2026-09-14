// @vitest-environment node
/**
 * UTI clinical golden cases
 * -------------------------
 * Each case states the expected clinical decision EXPLICITLY. These test
 * clinical behaviour, not that the UI did not change.
 *
 * Source: Victorian Department of Health, Protocol for Management of Urinary
 * Tract Infections, Community Pharmacist Program (January 2026).
 */
import { describe, it, expect } from 'vitest';
import { decide } from '@/clinical/decision';
import { utiProtocol } from '@/clinical/protocols/uti';
import type { Allergy } from '@/clinical/types';

const allNegative = () =>
  Object.fromEntries(utiProtocol.redFlags.map(f => [f.id, false]));

const eligibleAll = () =>
  Object.fromEntries(utiProtocol.eligibility.map(e => [e.id, true]));

const flag = (id: string, value = true) => ({ ...allNegative(), [id]: value });

describe('CASE A — straightforward eligible patient', () => {
  it('may be treated under the protocol', () => {
    const d = decide(utiProtocol, {
      redFlags: allNegative(),
      eligibility: eligibleAll(),
      medicationsText: '',
      allergies: [],
    });
    expect(d.outcome.kind).toBe('treat');
    expect(d.outcome.prescribingBlocked).toBe(false);
    expect(d.findings).toEqual([]);
  });
});

describe('CASE B — one protocol exclusion', () => {
  it('male patient → refer, prescribing blocked', () => {
    const d = decide(utiProtocol, {
      redFlags: flag('male_patient'),
      eligibility: { ...eligibleAll(), sex_female: false },
    });
    expect(d.outcome.prescribingBlocked).toBe(true);
    expect(['refer_routine', 'refer_same_day']).toContain(d.outcome.kind);
    expect(d.summary.prescribingBlocked).toBe(true);
  });

  it('only one cystitis symptom → not eligible, refer', () => {
    const d = decide(utiProtocol, {
      redFlags: allNegative(),
      eligibility: { ...eligibleAll(), two_or_more_cystitis_symptoms: false },
    });
    expect(d.outcome.prescribingBlocked).toBe(true);
    expect(d.outcome.reason).toMatch(/Eligibility not met/);
  });
});

describe('CASE C — red flag requiring referral', () => {
  it('suspected pyelonephritis → Emergency Department, non-overridable', () => {
    const d = decide(utiProtocol, {
      redFlags: flag('pyelonephritis_suspected'),
      eligibility: eligibleAll(),
    });
    expect(d.outcome.kind).toBe('emergency_department');
    expect(d.outcome.prescribingBlocked).toBe(true);
    const finding = d.findings.find(f => f.ruleId === 'redflag:pyelonephritis_suspected');
    expect(finding?.severity).toBe('hard_stop');
    expect(finding?.overridePolicy).toBe('non_overridable');
  });

  it('gross haematuria → immediate GP referral, prescribing blocked', () => {
    const d = decide(utiProtocol, {
      redFlags: flag('visible_haematuria'),
      eligibility: eligibleAll(),
    });
    expect(d.outcome.kind).toBe('refer_same_day');
    expect(d.outcome.prescribingBlocked).toBe(true);
  });

  it('diabetes → treat AND refer (supply still permitted)', () => {
    const d = decide(utiProtocol, {
      redFlags: flag('diabetes_or_sglt2'),
      eligibility: eligibleAll(),
    });
    expect(d.outcome.kind).toBe('treat_and_refer');
    expect(d.outcome.prescribingBlocked).toBe(false);
    const finding = d.findings.find(f => f.ruleId === 'redflag:diabetes_or_sglt2')!;
    expect(finding.overridePolicy).toBe('rationale_required');
  });
});

describe('CASE D — contraindication and allergy', () => {
  it('blocks trimethoprim when the patient is currently taking methotrexate', () => {
    const d = decide(utiProtocol, {
      redFlags: allNegative(),
      eligibility: eligibleAll(),
      medicationsText: 'methotrexate 15mg weekly',
      proposedMedicineId: 'trimethoprim',
    });
    const ci = d.findings.find(f => f.ruleId === 'contraindication:trimethoprim');
    expect(ci).toBeDefined();
    expect(ci!.severity).toBe('contraindication');
    expect(d.outcome.prescribingBlocked).toBe(true);
  });

  it('does NOT block on a CEASED medicine — regression guard', () => {
    // The previous engine matched by substring, so "warfarin stopped 2019"
    // raised a hard blocker. Status must be respected.
    const d = decide(utiProtocol, {
      redFlags: allNegative(),
      eligibility: eligibleAll(),
      medicationsText: 'methotrexate stopped 2019',
      proposedMedicineId: 'trimethoprim',
    });
    expect(d.findings.some(f => f.ruleId === 'contraindication:trimethoprim')).toBe(false);
    expect(d.outcome.prescribingBlocked).toBe(false);
  });

  it('hard-stops on an anaphylaxis allergy to the proposed agent', () => {
    const allergies: Allergy[] = [
      { substance: 'nitrofurantoin', reaction: 'anaphylaxis', severity: 'anaphylaxis', status: 'active' },
    ];
    const d = decide(utiProtocol, {
      redFlags: allNegative(),
      eligibility: eligibleAll(),
      allergies,
      proposedMedicineId: 'nitrofurantoin',
    });
    const f = d.findings.find(x => x.ruleId === 'allergy:nitrofurantoin:nitrofurantoin');
    expect(f?.severity).toBe('hard_stop');
    expect(f?.overridePolicy).toBe('non_overridable');
    expect(d.outcome.prescribingBlocked).toBe(true);
  });

  it('does not fire on a resolved allergy', () => {
    const allergies: Allergy[] = [
      { substance: 'nitrofurantoin', severity: 'anaphylaxis', status: 'resolved' },
    ];
    const d = decide(utiProtocol, {
      redFlags: allNegative(),
      eligibility: eligibleAll(),
      allergies,
      proposedMedicineId: 'nitrofurantoin',
    });
    expect(d.findings.some(x => x.ruleId.startsWith('allergy:'))).toBe(false);
  });
});

describe('CASE E — edge age, pregnancy, renal, comorbidity', () => {
  it('pregnancy → immediate GP referral, blocked', () => {
    const d = decide(utiProtocol, {
      redFlags: flag('pregnant'),
      eligibility: eligibleAll(),
    });
    expect(d.outcome.kind).toBe('refer_same_day');
    expect(d.outcome.prescribingBlocked).toBe(true);
  });

  it('renal disease → refer for investigation, blocked', () => {
    const d = decide(utiProtocol, {
      redFlags: flag('known_renal_disease'),
      eligibility: eligibleAll(),
    });
    expect(d.outcome.prescribingBlocked).toBe(true);
    expect(d.findings[0].finding).toMatch(/Renal disease/i);
  });

  it('age under 18 → not eligible, refer', () => {
    const d = decide(utiProtocol, {
      redFlags: allNegative(),
      eligibility: { ...eligibleAll(), age_18_to_65: false },
    });
    expect(d.outcome.prescribingBlocked).toBe(true);
  });

  it('immunocompromised → refer, blocked', () => {
    const d = decide(utiProtocol, {
      redFlags: flag('immunocompromised'),
      eligibility: eligibleAll(),
    });
    expect(d.outcome.prescribingBlocked).toBe(true);
  });

  it('incomplete assessment is never treated as eligible', () => {
    const d = decide(utiProtocol, { redFlags: allNegative(), eligibility: {} });
    expect(d.outcome.kind).toBe('undecided');
    expect(d.outcome.prescribingBlocked).toBe(true);
  });
});
