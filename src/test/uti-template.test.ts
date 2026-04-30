import { describe, it, expect } from 'vitest';
import {
  utiTemplate,
  emptyUtiData,
  evaluateScope,
  evaluateTreatmentBlockers,
  computeUtiSafetyScore,
  UTI_RED_FLAG_IDS,
  type UtiConsultationData,
} from '@/lib/conditionTemplates/uti';

function baseInScope(): UtiConsultationData {
  const d = emptyUtiData();
  d.patient = {
    firstName: 'Jane', lastName: 'Doe', dob: '1990-04-01',
    sex: 'female', pregnancyStatus: 'not_pregnant',
    allergies: '', currentMeds: '', relevantConditions: '',
  };
  d.symptoms = { dysuria: 'yes', frequency: 'yes', urgency: 'no', suprapubic: 'no', haematuria: 'no', duration: '1-3d', priorEpisode: 'first' };
  UTI_RED_FLAG_IDS.forEach(id => { d.redFlags[id] = 'no'; });
  d.differentials = { vaginitis: { considered: true } };
  d.followUpPlan = 'Review at 48h';
  d.safetyNet = 'Return if fever / flank pain';
  d.counsellingDone = utiTemplate.counselling.filter(c => c.required).map(c => c.id);
  return d;
}

describe('UTI template — Case 1: in-scope', () => {
  it('scope is in_scope and treatment is allowed', () => {
    const d = baseInScope();
    expect(evaluateScope(d).status).toBe('in_scope');
    const blockers = evaluateTreatmentBlockers(d, utiTemplate.treatments[0]);
    expect(blockers).toEqual([]);
  });

  it('safety score is high (>=80) when no penalties apply', () => {
    const d = baseInScope();
    d.selectedTreatment = utiTemplate.treatments[0];
    const { score } = computeUtiSafetyScore(d);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('clinical note mentions Trimethoprim when supplied', () => {
    const d = baseInScope();
    d.selectedTreatment = utiTemplate.treatments[0];
    const note = utiTemplate.documentation.generate(d as unknown as Record<string, unknown>);
    expect(note).toMatch(/Trimethoprim/);
    expect(note).toMatch(/Vic CPSP/);
  });
});

describe('UTI template — Case 2: pregnant patient', () => {
  it('is out_of_scope and blocks treatment selection', () => {
    const d = baseInScope();
    d.patient.pregnancyStatus = 'pregnant';
    const scope = evaluateScope(d);
    expect(scope.status).toBe('out_of_scope');
    const blockers = evaluateTreatmentBlockers(d, utiTemplate.treatments[0]);
    expect(blockers.some(b => b.startsWith('Out of scope'))).toBe(true);
  });
});

describe('UTI template — Case 3: flank pain + fever', () => {
  it('flags pyelonephritis risk and blocks prescribing', () => {
    const d = baseInScope();
    d.redFlags.fever_rigors = 'yes';
    d.redFlags.flank_pain = 'yes';
    const scope = evaluateScope(d);
    expect(scope.status).toBe('out_of_scope');
    const fever = utiTemplate.redFlags.find(r => r.id === 'fever_rigors')!;
    const flank = utiTemplate.redFlags.find(r => r.id === 'flank_pain')!;
    expect(fever.blocksPrescribing).toBe(true);
    expect(flank.severity).toBe('critical');
  });
});

describe('UTI template — Case 4: allergy conflict', () => {
  it('blocks Trimethoprim when patient is sulfa-allergic and suggests an alternative', () => {
    const d = baseInScope();
    d.patient.allergies = 'sulfonamide';
    const blockers = evaluateTreatmentBlockers(d, utiTemplate.treatments[0]);
    expect(blockers.some(b => b.toLowerCase().includes('allergy'))).toBe(true);
    expect(utiTemplate.treatments[0].alternativeOptionId).toBe('nitrofurantoin');
    // Alternative is not blocked by sulfa allergy
    const altBlockers = evaluateTreatmentBlockers(d, utiTemplate.treatments[1]);
    expect(altBlockers.some(b => b.toLowerCase().includes('allergy'))).toBe(false);
  });
});

describe('UTI template — Case 5: incomplete red flags', () => {
  it('blocks treatment until all red flags answered', () => {
    const d = baseInScope();
    d.redFlags.fever_rigors = undefined;
    const blockers = evaluateTreatmentBlockers(d, utiTemplate.treatments[0]);
    expect(blockers.some(b => b.toLowerCase().includes('red flag'))).toBe(true);
    const scope = evaluateScope(d);
    expect(scope.status).toBe('needs_clarification');
  });
});

describe('UTI template — registry shape', () => {
  it('has slug uncomplicated-uti and 15 red flags', () => {
    expect(utiTemplate.slug).toBe('uncomplicated-uti');
    expect(utiTemplate.redFlags.length).toBe(15);
    expect(utiTemplate.treatments.length).toBe(3);
  });
});
