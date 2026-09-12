// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  utiTemplate,
  emptyUtiData,
  evaluateTreatmentBlockers,
  evaluateUtiFindings,
  UTI_RED_FLAG_IDS,
  type UtiConsultationData,
} from '@/lib/conditionTemplates/uti';
import { utiProtocol } from '@/clinical/protocols/uti';
import { summariseSafety } from '@/clinical/safety';

function baseInScope(): UtiConsultationData {
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
  d.symptoms = { dysuria: 'yes', frequency: 'yes' };
  UTI_RED_FLAG_IDS.forEach(id => {
    d.redFlags[id] = 'no';
  });
  return d;
}

const treatment = (id: string) => utiTemplate.treatments.find(t => t.id === id)!;

describe('safety engine — medication status', () => {
  /**
   * The defect this whole engine exists to fix. The old matcher was
   * `currentMeds.includes('methotrexate')`, so "methotrexate (ceased 2019)"
   * raised a hard blocker and stopped a pharmacist supplying third-line
   * trimethoprim to a patient who had not taken methotrexate for years.
   */
  it('does NOT block on a CEASED interacting medicine', () => {
    const d = baseInScope();
    d.patient.currentMeds = 'methotrexate 15mg weekly (ceased 2019)';

    const findings = evaluateUtiFindings(d, treatment('trimethoprim'));
    const interaction = findings.filter(f => f.ruleId.startsWith('interaction:'));

    expect(interaction).toHaveLength(0);
  });

  it('DOES flag a CURRENT interacting medicine', () => {
    const d = baseInScope();
    d.patient.currentMeds = 'methotrexate 15mg weekly';

    const findings = evaluateUtiFindings(d, treatment('trimethoprim'));
    const interaction = findings.filter(f => f.ruleId.startsWith('interaction:'));

    expect(interaction).toHaveLength(1);
    expect(interaction[0].finding).toMatch(/methotrexate/i);
    expect(interaction[0].overridePolicy).toBe('rationale_required');
  });

  it('treats PRN medicines as active but flags them as cautions, not blockers', () => {
    const d = baseInScope();
    d.patient.currentMeds = 'methotrexate 10mg PRN';

    const findings = evaluateUtiFindings(d, treatment('trimethoprim'));
    const interaction = findings.filter(f => f.ruleId.startsWith('interaction:'));

    expect(interaction).toHaveLength(1);
    expect(interaction[0].severity).toBe('caution');
  });

  it('matches a contraindication stated as a condition rather than a medicine', () => {
    const d = baseInScope();
    // "Severe renal impairment" is a condition, not a medicine. The old code
    // only searched the medicines field, so it never matched.
    d.patient.relevantConditions = 'Severe renal impairment';

    const findings = evaluateUtiFindings(d, treatment('nitrofurantoin'));
    expect(findings.some(f => f.ruleId.startsWith('contraindication:'))).toBe(true);
  });
});

describe('safety engine — red flag handling', () => {
  it('sends an ED red flag to hard_stop, non-overridable', () => {
    const d = baseInScope();
    d.redFlags.fever_rigors = 'yes';

    const findings = evaluateUtiFindings(d, treatment('nitrofurantoin'));
    const flag = findings.find(f => f.ruleId === 'redflag:fever_rigors')!;

    expect(flag.severity).toBe('hard_stop');
    expect(flag.overridePolicy).toBe('non_overridable');
    expect(flag.recommendedAction).toMatch(/Emergency Department/i);
  });

  it('treat-and-refer red flags do not block supply', () => {
    const d = baseInScope();
    d.redFlags.diabetes_or_sglt2 = 'yes';

    const findings = evaluateUtiFindings(d, treatment('nitrofurantoin'));
    const flag = findings.find(f => f.ruleId === 'redflag:diabetes_or_sglt2')!;

    expect(flag.severity).toBe('caution');
    expect(flag.overridePolicy).toBe('rationale_required');
    expect(summariseSafety([flag]).prescribingBlocked).toBe(false);
  });

  it('flags unanswered red flags as a completeness finding', () => {
    const d = baseInScope();
    d.redFlags.asplenia = undefined;

    const findings = evaluateUtiFindings(d, treatment('nitrofurantoin'));
    const completeness = findings.find(f => f.ruleId === 'completeness:red_flags');

    expect(completeness).toBeTruthy();
    expect(completeness!.finding).toMatch(/1 red flag/);
    expect(completeness!.overridePolicy).toBe('non_overridable');
  });
});

describe('allergy handling', () => {
  it('blocks the drug the patient is allergic to, and only that drug', () => {
    const d = baseInScope();
    d.patient.allergies = 'trimethoprim - rash';

    const trimBlockers = evaluateTreatmentBlockers(d, treatment('trimethoprim'));
    expect(trimBlockers.some(b => /allergy/i.test(b))).toBe(true);

    const nitroBlockers = evaluateTreatmentBlockers(d, treatment('nitrofurantoin'));
    expect(nitroBlockers.some(b => /allergy/i.test(b))).toBe(false);
  });

  it('treats anaphylaxis as a hard stop', () => {
    const d = baseInScope();
    d.patient.allergies = 'nitrofurantoin (anaphylaxis)';

    const findings = evaluateUtiFindings(d, treatment('nitrofurantoin'));
    const allergy = findings.find(f => f.ruleId.startsWith('allergy:'))!;

    expect(allergy.severity).toBe('hard_stop');
    expect(allergy.overridePolicy).toBe('non_overridable');
  });

  it('ignores resolved childhood allergies', () => {
    const d = baseInScope();
    d.patient.allergies = 'trimethoprim (childhood, resolved)';

    const findings = evaluateUtiFindings(d, treatment('trimethoprim'));
    expect(findings.filter(f => f.ruleId.startsWith('allergy:'))).toHaveLength(0);
  });
});

describe('red flag coverage — template vs protocol', () => {
  it('screens every red flag the protocol lists', () => {
    const protocolIds = utiProtocol.redFlags.map(f => f.id).sort();
    const templateIds = [...UTI_RED_FLAG_IDS].sort();
    expect(templateIds).toEqual(protocolIds);
  });

  it('no longer invents a nausea_vomiting flag absent from the protocol', () => {
    expect(UTI_RED_FLAG_IDS).not.toContain('nausea_vomiting');
    // It is covered by the protocol's pyelonephritis criterion instead.
    expect(utiProtocol.redFlags.find(f => f.id === 'pyelonephritis_suspected')!.label)
      .toMatch(/nausea/i);
  });

  it('does not offer cefalexin, which the protocol excludes', () => {
    expect(utiTemplate.treatments.map(t => t.medicineName)).not.toContain('Cefalexin');
  });
});
