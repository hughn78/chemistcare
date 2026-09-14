// @vitest-environment node
/**
 * Protocol regression guards
 * --------------------------
 * These tests exist to make the audit's headline defect impossible to reintroduce:
 * a medicine carrying one renal threshold in one file and a different one
 * elsewhere. They validate the registry statically rather than rendering UI.
 */
import { describe, it, expect } from 'vitest';
import { PROTOCOL_REGISTRY, validateRegistry, validateProtocol, getProtocol } from '@/clinical/registry';
import { PROTOCOL_SOURCES, getSource, requireSource } from '@/clinical/sources';
import { utiProtocol } from '@/clinical/protocols/uti';
import { UTI_PRESCRIBING } from '@/types/protocols';
import { CONDITIONS } from '@/data/conditions';
import type { ProtocolDefinition } from '@/clinical/types';

describe('protocol registry integrity', () => {
  it('has no validation issues', () => {
    const issues = validateRegistry();
    expect(issues.map(i => `${i.code}: ${i.message}`)).toEqual([]);
  });

  it('has no duplicate protocol ids', () => {
    const ids = PROTOCOL_REGISTRY.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every protocol sourceId to a registered source', () => {
    for (const p of PROTOCOL_REGISTRY) {
      expect(getSource(p.sourceId), `protocol ${p.id}`).toBeDefined();
    }
  });

  it('throws when a protocol references an unknown source', () => {
    expect(() => requireSource('DOES_NOT_EXIST')).toThrow(/Unknown protocol source/);
  });

  it('gives every medicine provenance', () => {
    for (const p of PROTOCOL_REGISTRY) {
      for (const m of p.medicines) {
        expect(m.sourceId, `${p.id}/${m.id}`).toBeTruthy();
      }
    }
  });

  it('has no duplicate medicine ids within a protocol', () => {
    for (const p of PROTOCOL_REGISTRY) {
      const ids = p.medicines.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('lifecycle guards', () => {
  it('rejects a protocol claiming active while needing clinical review', () => {
    const bad: ProtocolDefinition = {
      ...utiProtocol,
      id: 'BAD_TEST',
      lifecycle: 'active',
      needsClinicalReview: true,
      reviewNote: 'note',
    };
    const issues = validateProtocol(bad);
    expect(issues.some(i => i.code === 'active_but_needs_review')).toBe(true);
  });

  it('rejects an unknown lifecycle status', () => {
    const bad = { ...utiProtocol, id: 'BAD2', lifecycle: 'bananas' } as unknown as ProtocolDefinition;
    expect(validateProtocol(bad).some(i => i.code === 'unknown_lifecycle_status')).toBe(true);
  });

  it('rejects needsClinicalReview without an explanatory note', () => {
    const bad: ProtocolDefinition = {
      ...utiProtocol,
      id: 'BAD3',
      lifecycle: 'draft',
      needsClinicalReview: true,
      reviewNote: undefined,
    };
    expect(validateProtocol(bad).some(i => i.code === 'review_flag_without_note')).toBe(true);
  });

  it('keeps source_verified protocols out of normal prescribing mode', async () => {
    const { mayPresentAsPrescribingPathway } = await import('@/clinical/types');
    expect(utiProtocol.lifecycle).toBe('source_verified');
    expect(mayPresentAsPrescribingPathway(utiProtocol.lifecycle)).toBe(false);
  });
});

describe('UTI single source of truth', () => {
  it('orders therapy exactly as the Victorian protocol states', () => {
    expect(utiProtocol.medicines.map(m => m.id)).toEqual([
      'nitrofurantoin',
      'fosfomycin',
      'trimethoprim',
    ]);
    expect(utiProtocol.medicines.map(m => m.line)).toEqual([1, 2, 3]);
  });

  it('excludes cefalexin, which the protocol removes from the medicines list', () => {
    expect(utiProtocol.medicines.some(m => /cefalexin|cephalexin/i.test(m.medicineName))).toBe(false);
    expect(utiProtocol.excludedMedicines?.some(m => /cefalexin/i.test(m.medicineName))).toBe(true);
  });

  it('states no invented numeric renal threshold', () => {
    // The audit found eGFR <30 in one file and eGFR <45 in another. The
    // protocol says "severe renal impairment" and gives no number.
    const allText = utiProtocol.medicines
      .flatMap(m => [m.dose, ...m.contraindications, ...(m.cautions ?? [])])
      .join(' ')
      .toLowerCase();
    expect(allText).not.toMatch(/egfr\s*</);
    expect(allText).not.toMatch(/\b(egfr|gfr)\b/);
    expect(allText).toContain('severe renal impairment');
  });

  it('keeps the derived UTI_PRESCRIBING copy in step with canonical', () => {
    expect(UTI_PRESCRIBING.map(o => o.id)).toEqual(utiProtocol.medicines.map(m => m.id));
    expect(UTI_PRESCRIBING.map(o => o.line)).toEqual(['first', 'second', 'third']);
    expect(UTI_PRESCRIBING.find(o => o.id === 'nitrofurantoin')?.frequency).toBe('Every 6 hours');
  });

  it('keeps the derived conditions.ts UTI entry in step with canonical', () => {
    const uti = CONDITIONS.find(c => c.id === 'uti');
    expect(uti).toBeDefined();
    expect(uti!.canonicalProtocolId).toBe(utiProtocol.id);
    expect(uti!.therapyOptions.map(t => t.line)).toEqual(['first', 'second', 'third']);
    // Previously 'Trimethoprim' was first in this array.
    expect(uti!.therapyOptions[0].medicineName).toBe('Nitrofurantoin');
    expect(uti!.therapyOptions.some(t => /cefalexin/i.test(t.medicineName))).toBe(false);
  });

  it('cites the real published source, not a generic guideline name', () => {
    expect(getProtocol(utiProtocol.id)).toBe(utiProtocol);
    expect(utiProtocol.sourceId).toBe('VIC_CCN_UTI_2026_01');
    const src = getSource(utiProtocol.sourceId)!;
    expect(src.authority).toBe('Victorian Department of Health');
    expect(src.isbn).toBe('978-1-76131-955-6');
    expect(src.documentUrl).toMatch(/health\.vic\.gov\.au/);
    expect(src.retrievedAt).toBe('2026-09-13');
  });
});

describe('source registry', () => {
  it('registers the Victorian Chemist Care Now service set', () => {
    const vic = PROTOCOL_SOURCES.filter(s => s.jurisdiction === 'VIC');
    expect(vic.length).toBeGreaterThanOrEqual(10);
  });

  it('flags Queensland sources for clinical review because content was not retrieved', () => {
    const qld = PROTOCOL_SOURCES.filter(s => s.jurisdiction === 'QLD');
    expect(qld.length).toBeGreaterThan(0);
    for (const s of qld) {
      expect(s.needsClinicalReview).toBe(true);
      expect(s.reviewNote).toBeTruthy();
    }
  });
});
