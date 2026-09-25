/**
 * Corpus-driven template tests
 * -----------------------------
 * Proves the four corpus-generated ConditionTemplates evaluate scope and
 * safety from the corpus instruments, carry per-document provenance, and
 * resolve from the registry ahead of the legacy hand-written templates.
 */
import { describe, it, expect } from 'vitest';
import { getConditionTemplateBySlug } from '@/lib/conditionTemplates';
import {
  nauseaTemplate,
  NAUSEA_RED_FLAG_IDS,
  nauseaCorpusSelection,
} from '@/lib/conditionTemplates/nauseaCorpus';
import { psoriasisTemplate, psoriasisCorpusSelection } from '@/lib/conditionTemplates/psoriasisCorpus';
import { gordTemplate, gordCorpusSelection } from '@/lib/conditionTemplates/gordCorpus';
import {
  atopicDermatitisCorpusTemplate,
  atopicDermatitisCorpusSelection,
} from '@/lib/conditionTemplates/atopicDermatitisCorpus';
import {
  evaluateTemplateScope,
  computeTemplateSafetyScore,
} from '@/pages/TemplateConsultation';
import { CORPUS_AS_AT } from '@/data/protocol-corpus';

function baseData(): any {
  return {
    patient: { firstName: 'Test', lastName: 'Patient', dob: '1990-06-15', sex: 'female', pregnancyStatus: 'not_pregnant' },
    fields: {},
    findings: {},
    counsellingDone: [],
    templateVersion: 1,
  };
}

function answeredFlags(template: any, data: any): any {
  const findings: Record<string, 'yes' | 'no'> = { ...data.findings };
  for (const rf of template.redFlags) findings[rf.id] = 'no';
  return { ...data, findings };
}

describe('corpus templates read from the governing instrument', () => {
  it('nausea template derives from the WA nausea guideline with provenance', () => {
    expect(nauseaCorpusSelection.meta.state).toBe('WA');
    expect(nauseaTemplate.redFlags.length).toBe(nauseaCorpusSelection.payload.red_flags!.length);
    expect(nauseaTemplate.protocolSourceLabel).toContain('nausea');
    expect(nauseaTemplate.jurisdictionProtocolVersion).toMatch(/^WA/);
  });

  it('psoriasis template derives from the VIC instrument', () => {
    expect(psoriasisCorpusSelection.meta.state).toBe('VIC');
    expect(psoriasisTemplate.redFlags.length).toBe(25);
    expect(psoriasisTemplate.treatments.length).toBe(7);
    expect(psoriasisTemplate.treatments.some(t => t.medicineName.includes('Betamethasone'))).toBe(true);
  });

  it('GORD template derives from the WA instrument with age window 18–55', () => {
    expect(gordCorpusSelection.meta.state).toBe('WA');
    const ageRule = gordTemplate.scopeRules.find(r => r.id === 'age_window');
    expect((ageRule as any).label).toMatch(/18–55/);
    expect(gordTemplate.treatments.length).toBeGreaterThan(0);
  });

  it('atopic dermatitis template derives from the VIC July 2026 instrument', () => {
    expect(atopicDermatitisCorpusSelection.meta.state).toBe('VIC');
    expect(atopicDermatitisCorpusTemplate.redFlags.length).toBe(30);
    expect(atopicDermatitisCorpusTemplate.treatments.length).toBe(7);
  });

  it('registry resolves slugs to the CORPUS templates (first-match-wins)', () => {
    expect(getConditionTemplateBySlug('acute-nausea-and-vomiting')?.protocolSourceLabel).toContain('nausea');
    expect(getConditionTemplateBySlug('psoriasis')?.id).toBe('psoriasis');
    expect(getConditionTemplateBySlug('gord')?.protocolSourceLabel).toMatch(/reflux/i);
    expect(getConditionTemplateBySlug('atopic-dermatitis')?.redFlags.length).toBe(30);
    // UTI still resolves to the untouched hand-written reference.
    expect(getConditionTemplateBySlug('uncomplicated-uti')?.id).toBe('uti');
  });
});

describe('scope evaluation reads from corpus (WA nausea: age ≥ 18)', () => {
  it('rejects a 15-year-old as out of scope via instrument age rule', () => {
    const t = nauseaTemplate;
    const d = { ...baseData(), patient: { ...baseData().patient, dob: '2011-01-01' } };
    const scope = evaluateTemplateScope(t, d);
    expect(scope.status).toBe('out_of_scope');
    expect(scope.reasons.some(r => r.includes('18'))).toBe(true);
  });

  it('flags severe dehydration as out of scope', () => {
    const d = answeredFlags(nauseaTemplate, { ...baseData(), fields: { dehydration: 'severe', duration: 'under_24h', fluid_intake: 'yes' } });
    const scope = evaluateTemplateScope(nauseaTemplate, d);
    expect(scope.status).toBe('out_of_scope');
    expect(scope.reasons.some(r => r.toLowerCase().includes('dehydration'))).toBe(true);
  });

  it('blocks when red flag screening is unanswered (needs_clarification)', () => {
    const scope = evaluateTemplateScope(nauseaTemplate, baseData());
    expect(scope.status).toBe('needs_clarification');
  });

  it('fully-screened clean adult is in scope', () => {
    const d = answeredFlags(nauseaTemplate, {
      ...baseData(),
      fields: { duration: 'under_24h', fluid_intake: 'yes', dehydration: 'none_mild' },
    });
    const scope = evaluateTemplateScope(nauseaTemplate, d);
    expect(scope.status).toBe('in_scope');
  });
});

describe('scope evaluation for psoriasis / GORD / AD', () => {
  it('psoriasis: first presentation is out of scope', () => {
    const d = answeredFlags(psoriasisTemplate, { ...baseData(), fields: { firstPresentation: 'yes', highImpactSites: 'no' } });
    expect(evaluateTemplateScope(psoriasisTemplate, d).status).toBe('out_of_scope');
  });

  it('psoriasis: high-impact sites are out of scope', () => {
    const d = answeredFlags(psoriasisTemplate, { ...baseData(), fields: { firstPresentation: 'no', highImpactSites: 'yes' } });
    expect(evaluateTemplateScope(psoriasisTemplate, d).status).toBe('out_of_scope');
  });

  it('GORD: symptoms over 4 weeks are out of scope', () => {
    const d = answeredFlags(gordTemplate, {
      ...baseData(),
      fields: { heartburn: 'yes', duration: 'over_4w', priorPpiUse: 'none' },
    });
    expect(evaluateTemplateScope(gordTemplate, d).status).toBe('out_of_scope');
  });

  it('GORD: prior PPI failure is out of scope', () => {
    const d = answeredFlags(gordTemplate, { ...baseData(), fields: { heartburn: 'yes', duration: 'under_2w', priorPpiUse: 'failed' } });
    expect(evaluateTemplateScope(gordTemplate, d).status).toBe('out_of_scope');
  });

  it('atopic dermatitis: severe flare is out of scope', () => {
    const d = answeredFlags(atopicDermatitisCorpusTemplate, {
      ...baseData(),
      fields: { firstPresentation: 'no', severity: 'severe' },
    });
    expect(evaluateTemplateScope(atopicDermatitisCorpusTemplate, d).status).toBe('out_of_scope');
  });

  it('atopic dermatitis: mild flare in previously diagnosed adult is in scope', () => {
    const d = answeredFlags(atopicDermatitisCorpusTemplate, {
      ...baseData(),
      fields: { firstPresentation: 'no', severity: 'mild' },
    });
    expect(evaluateTemplateScope(atopicDermatitisCorpusTemplate, d).status).toBe('in_scope');
  });
});

describe('safety scoring (corpus-driven)', () => {
  it('clean in-scope data with treatment + counselling scores ≥ 80', () => {
    const d = answeredFlags(gordTemplate, {
      ...baseData(),
      fields: { heartburn: 'yes', duration: 'under_2w', priorPpiUse: 'none' },
      selectedTreatment: gordTemplate.treatments[0],
      followUpPlan: 'Review 2 weeks',
      safetyNet: 'Return if alarm features',
      counsellingDone: gordTemplate.counselling.filter(c => c.required).map(c => c.id),
    });
    const { score } = computeTemplateSafetyScore(gordTemplate, d);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('treatment without counselling or follow-up is penalised', () => {
    const d = answeredFlags(gordTemplate, {
      ...baseData(),
      fields: { heartburn: 'yes', duration: 'under_2w', priorPpiUse: 'none' },
      selectedTreatment: gordTemplate.treatments[0],
    });
    const { score, penalties } = computeTemplateSafetyScore(gordTemplate, d);
    expect(score).toBeLessThan(80);
    expect(penalties.some(p => p.reason.toLowerCase().includes('counselling'))).toBe(true);
    expect(penalties.some(p => p.reason.toLowerCase().includes('follow-up'))).toBe(true);
  });

  it('treatment selected while out of scope incurs the heavy penalty', () => {
    const d = answeredFlags(gordTemplate, {
      ...baseData(),
      patient: { ...baseData().patient, dob: '2010-01-01' }, // 16 years old → out of window
      fields: { heartburn: 'yes', duration: 'under_2w', priorPpiUse: 'none' },
      selectedTreatment: gordTemplate.treatments[0],
      followUpPlan: 'x',
      safetyNet: 'y',
      counsellingDone: gordTemplate.counselling.filter(c => c.required).map(c => c.id),
    });
    const { penalties } = computeTemplateSafetyScore(gordTemplate, d);
    expect(penalties.some(p => p.reason.toLowerCase().includes('out of scope'))).toBe(true);
  });
});

describe('corpus note generation carries provenance', () => {
  it('embeds the instrument title + sha256 + corpus date + scope in the note', () => {
    const d = {
      ...answeredFlags(nauseaTemplate, { ...baseData(), fields: { duration: 'under_24h', fluid_intake: 'yes', dehydration: 'none_mild' } }),
      scopeStatus: 'in_scope',
    };
    const note = nauseaTemplate.documentation.generate(d as never);
    expect(note).toMatch(/Source instrument:/);
    expect(note).toMatch(/sha256 [0-9a-f]{12}/);
    expect(note).toContain(String(CORPUS_AS_AT));
    expect(note).toMatch(/SCOPE DECISION/);
    expect(note).toMatch(/Status: in_scope/);
    expect(note).toMatch(/Negative for all \d+ screened protocol item/);
  });
});