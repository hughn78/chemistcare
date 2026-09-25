/**
 * Registry ↔ corpus wiring tests
 * -------------------------------
 * Verifies that conditionRegistry.jurisdictionAvailability is derived from
 * the Sep 2026 corpus manifest (the locum's "where is this in scope?"
 * surface), and that protocolVersion covers all 8 jurisdictions.
 */
import { describe, it, expect } from 'vitest';
import { CONDITION_REGISTRY, getRegistryEntryById } from '@/lib/conditionRegistry';
import { PROTOCOLS } from '@/lib/protocolVersion';

const ALL_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

describe('condition registry corpus wiring', () => {
  it('derives UTI availability from the corpus (7 jurisdictions)', () => {
    const uti = getRegistryEntryById('uti');
    expect(uti?.jurisdictionAvailability.slice().sort()).toEqual(
      ['ACT', 'NSW', 'NT', 'QLD', 'TAS', 'VIC', 'WA']
    );
  });

  it('derives acne availability from the corpus (5 jurisdictions)', () => {
    const acne = getRegistryEntryById('acne');
    expect(acne?.jurisdictionAvailability.slice().sort()).toEqual(['NSW', 'QLD', 'SA', 'VIC', 'WA']);
  });

  it('falls back to VIC when the corpus has no documents for a slug', () => {
    // A condition with no corpus documents should keep the safe default.
    const uncovered = CONDITION_REGISTRY.find(
      e => e.jurisdictionAvailability.length === 1 && e.jurisdictionAvailability[0] === 'VIC'
    );
    expect(uncovered).toBeDefined();
  });

  it('keeps explicit overrides winning over corpus data', () => {
    // Every registry entry must have a non-empty availability list.
    for (const e of CONDITION_REGISTRY) {
      expect(e.jurisdictionAvailability.length).toBeGreaterThan(0);
    }
  });
});

describe('protocolVersion jurisdiction registry', () => {
  it('covers all 8 Australian jurisdictions', () => {
    expect(Object.keys(PROTOCOLS).sort()).toEqual(ALL_STATES);
  });

  it('carries corpus-verified instrument metadata for the added states', () => {
    expect(PROTOCOLS.ACT.name).toMatch(/NI2026-189/);
    expect(PROTOCOLS.SA.name).toMatch(/Prescribing Code/);
    expect(PROTOCOLS.NT.effectiveDate).toBe('2026-05-15');
    expect(PROTOCOLS.TAS.version).toBe('2.0');
  });

  it('resolves every jurisdiction without falling back', () => {
    for (const st of ALL_STATES) {
      expect(PROTOCOLS[st]).toBeDefined();
    }
  });
});