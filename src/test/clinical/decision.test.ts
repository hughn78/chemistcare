// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  utiTemplate,
  emptyUtiData,
  decideUti,
  buildUtiHandover,
  UTI_RED_FLAG_IDS,
  type UtiConsultationData,
} from '@/lib/conditionTemplates/uti';
import { ageFromDob, isWithinAgeBand, isPregnancyExcluded } from '@/clinical/primitives';

function eligible(): UtiConsultationData {
  const d = emptyUtiData();
  d.patient = {
    firstName: 'Jane',
    lastName: 'Doe',
    dob: '1990-04-01',
    sex: 'female',
    pregnancyStatus: 'not_pregnant',
    allergies: '',
    currentMeds: '',
    relevantConditions: '',
  };
  d.symptoms = { dysuria: 'yes', frequency: 'yes', urgency: 'yes', suprapubic: 'no' };
  UTI_RED_FLAG_IDS.forEach(id => {
    d.redFlags[id] = 'no';
  });
  d.consentToProgram = true;
  return d;
}

describe('clinical primitives', () => {
  it('computes whole years from a date of birth', () => {
    const at = new Date('2026-09-13T00:00:00Z');
    expect(ageFromDob('1990-04-01', at)).toBe(36);
    // Birthday not yet reached this year.
    expect(ageFromDob('1990-12-01', at)).toBe(35);
  });

  it('returns null rather than guessing for a missing or invalid dob', () => {
    expect(ageFromDob(undefined)).toBeNull();
    expect(ageFromDob('not-a-date')).toBeNull();
  });

  it('treats an unknown age as unknown, not as inside the band', () => {
    expect(isWithinAgeBand(null, 18, 65)).toBeNull();
    expect(isWithinAgeBand(17, 18, 65)).toBe(false);
    expect(isWithinAgeBand(66, 18, 65)).toBe(false);
    expect(isWithinAgeBand(40, 18, 65)).toBe(true);
  });

  it('excludes "possibly pregnant" exactly as it excludes "pregnant"', () => {
    expect(isPregnancyExcluded('pregnant')).toBe(true);
    expect(isPregnancyExcluded('possibly_pregnant')).toBe(true);
    expect(isPregnancyExcluded('not_pregnant')).toBe(false);
    expect(isPregnancyExcluded(undefined)).toBeNull();
  });
});

describe('decision outcomes — golden cases', () => {
  it('Case A: fully eligible patient → treat', () => {
    const d = eligible();
    const decision = decideUti(d, utiTemplate.treatments[0]);
    expect(decision.outcome.kind).toBe('treat');
    expect(decision.outcome.prescribingBlocked).toBe(false);
  });

  it('Case B: fever → immediate Emergency Department referral, non-overridable', () => {
    const d = eligible();
    d.redFlags.fever_rigors = 'yes';
    const decision = decideUti(d, utiTemplate.treatments[0]);
    expect(decision.outcome.kind).toBe('emergency_department');
    expect(decision.outcome.prescribingBlocked).toBe(true);
    expect(decision.summary.nonOverridable.length).toBeGreaterThan(0);
  });

  it('Case C: diabetes → treat AND refer, supply still permitted', () => {
    const d = eligible();
    d.redFlags.diabetes_or_sglt2 = 'yes';
    const decision = decideUti(d, utiTemplate.treatments[0]);
    expect(decision.outcome.kind).toBe('treat_and_refer');
    expect(decision.outcome.prescribingBlocked).toBe(false);
  });

  it('Case D: male patient → referral, supply blocked', () => {
    const d = eligible();
    d.patient.sex = 'male';
    const decision = decideUti(d, utiTemplate.treatments[0]);
    expect(decision.outcome.prescribingBlocked).toBe(true);
    expect(['refer_routine', 'refer_same_day']).toContain(decision.outcome.kind);
  });

  it('Case E: incomplete assessment → undecided, supply blocked', () => {
    const d = eligible();
    d.redFlags.asplenia = undefined;
    const decision = decideUti(d, utiTemplate.treatments[0]);
    expect(decision.outcome.kind).toBe('undecided');
    expect(decision.outcome.prescribingBlocked).toBe(true);
  });

  it('an emergency outranks a routine referral when both apply', () => {
    const d = eligible();
    d.redFlags.fever_rigors = 'yes';       // ED
    d.redFlags.known_renal_disease = 'yes'; // routine GP
    const decision = decideUti(d, utiTemplate.treatments[0]);
    expect(decision.outcome.kind).toBe('emergency_department');
  });

  it('without recorded consent the decision never resolves to treat', () => {
    const d = eligible();
    d.consentToProgram = undefined;
    expect(decideUti(d, utiTemplate.treatments[0]).outcome.kind).not.toBe('treat');
  });

  it('fewer than two cystitis symptoms is not eligible for supply', () => {
    const d = eligible();
    d.symptoms = { dysuria: 'yes', frequency: 'no', urgency: 'no', suprapubic: 'no' };
    expect(decideUti(d, utiTemplate.treatments[0]).outcome.kind).not.toBe('treat');
  });
});

describe('ISBAR handover', () => {
  it('contains all five ISBAR sections and the outcome', () => {
    const d = eligible();
    d.redFlags.fever_rigors = 'yes';
    const handover = buildUtiHandover(d, utiTemplate.treatments[0]);

    expect(handover).toContain('IDENTIFICATION');
    expect(handover).toContain('SITUATION');
    expect(handover).toContain('BACKGROUND');
    expect(handover).toContain('ASSESSMENT');
    expect(handover).toContain('RECOMMENDATION');
    expect(handover).toMatch(/Emergency Department/);
  });

  it('includes the patient identity supplied', () => {
    const handover = buildUtiHandover(eligible(), utiTemplate.treatments[0]);
    expect(handover).toContain('Jane Doe');
    expect(handover).toContain('1990-04-01');
  });

  it('records the protocol rule behind the referral', () => {
    const d = eligible();
    d.redFlags.fever_rigors = 'yes';
    expect(buildUtiHandover(d, utiTemplate.treatments[0])).toContain('redflag:fever_rigors');
  });
});
