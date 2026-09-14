// @vitest-environment node
/**
 * Regression guards for the second wave of transcribed Victorian protocols
 * (mild acne, atopic dermatitis flare).
 *
 * The most important test in this file is the one that asserts ABSENCE:
 * these source documents give no per-product contraindications, cautions or
 * interactions. If someone later "helpfully" fills those arrays in from
 * general knowledge, this file fails. That is the point — inventing clinical
 * content is the exact failure the whole canonical-protocol architecture was
 * built to prevent.
 */
import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_REGISTRY,
  SOURCES_WITHOUT_PROTOCOL,
  protocolsForCondition,
  validateRegistry,
} from '@/clinical/registry';
import { getSource } from '@/clinical/sources';
import { acneProtocol } from '@/clinical/protocols/acne';
import { dermatitisProtocol } from '@/clinical/protocols/dermatitis';
import { mayPresentAsPrescribingPathway } from '@/clinical/types';

describe('expanded protocol registry', () => {
  it('still validates cleanly with the new protocols registered', () => {
    expect(validateRegistry().map(i => `${i.code}: ${i.message}`)).toEqual([]);
  });

  it('exposes UTI, mild acne and atopic dermatitis flare', () => {
    expect(PROTOCOL_REGISTRY.map(p => p.id)).toEqual(
      expect.arrayContaining([
        'VIC_CCN_UTI_2026_01',
        'VIC_CCN_ACNE_2026_08',
        'VIC_CCN_DERMATITIS_2026_08',
      ]),
    );
  });

  it('holds every non-UTI protocol in reference/development mode', () => {
    for (const p of PROTOCOL_REGISTRY) {
      if (p.id === 'VIC_CCN_UTI_2026_01') continue;
      expect(mayPresentAsPrescribingPathway(p.lifecycle), p.id).toBe(false);
      expect(p.needsClinicalReview, p.id).toBe(true);
      expect(p.reviewNote, p.id).toBeTruthy();
    }
  });

  it('refuses to ship a protocol for a condition whose source is blocked', () => {
    for (const blocked of SOURCES_WITHOUT_PROTOCOL) {
      expect(protocolsForCondition(blocked.conditionId), blocked.conditionId).toEqual([]);
      // The blocking reason must be backed by a real registered source.
      expect(getSource(blocked.sourceId), blocked.sourceId).toBeDefined();
    }
  });

  it('does not offer a shingles pathway', () => {
    // The only retrieved shingles document is a superseded 2024 Safer Care
    // Victoria pilot protocol with internal contradictions.
    expect(protocolsForCondition('shingles')).toEqual([]);
    const src = getSource('VIC_CCN_SHINGLES_2026_02')!;
    expect(src.authority).toBe('Safer Care Victoria');
    expect(src.needsClinicalReview).toBe(true);
  });
});

describe('mild acne protocol (VIC, July 2026)', () => {
  it('cites the published source', () => {
    const src = getSource(acneProtocol.sourceId)!;
    expect(src.isbn).toBe('978-1-76131-994-5');
    expect(src.title).toBe('Protocol for Management of Mild Acne');
    expect(src.version).toBe('July 2026');
  });

  it('caps supply at 6 weeks on every medicine', () => {
    for (const m of acneProtocol.medicines) {
      const text = [...(m.cautions ?? []), ...m.counsellingPoints].join(' ');
      expect(text, m.id).toMatch(/6 weeks/);
    }
  });

  it('treats all seven true exclusions as blocking', () => {
    const blocking = acneProtocol.redFlags.filter(f => f.prescribingBlocked);
    expect(blocking.map(f => f.id)).toEqual([
      'unclear_diagnosis',
      'severe_or_scarring',
      'pregnant_or_planning',
      'medicine_induced_acne',
      'androgenisation_or_pcos',
      'treatment_failure',
      'poorly_tolerated',
    ]);
  });

  it('treats marked psychosocial impact as treat-and-refer, not a block', () => {
    const f = acneProtocol.redFlags.find(x => x.id === 'marked_psychosocial_impact')!;
    expect(f.outcome).toBe('treat_and_refer');
    expect(f.prescribingBlocked).toBe(false);
  });

  it('excludes pregnancy absolutely because protocol medicines are Schedule D', () => {
    const f = acneProtocol.redFlags.find(x => x.id === 'pregnant_or_planning')!;
    expect(f.label).toMatch(/Schedule D/);
    expect(f.label).toMatch(/actively trying to conceive or intending to conceive in the next 1/);
    expect(f.prescribingBlocked).toBe(true);
  });

  it('carries the teratogenicity warning on every retinoid', () => {
    const retinoidIds = [
      'adapalene_0_1',
      'tretinoin_0_05',
      'trifarotene_0_005',
      'adapalene_bpo',
      'clindamycin_tretinoin',
    ];
    for (const id of retinoidIds) {
      const m = acneProtocol.medicines.find(x => x.id === id)!;
      const text = [...m.contraindications, ...m.counsellingPoints].join(' ');
      expect(text.toLowerCase(), id).toMatch(/teratogenic|child-?bearing|pregnan/);
    }
  });

  it('enforces the topical clindamycin antimicrobial stewardship limits', () => {
    const text = acneProtocol.medicines
      .filter(m => /clindamycin/i.test(m.medicineName))
      .flatMap(m => [...(m.cautions ?? []), ...m.counsellingPoints])
      .join(' ');
    expect(text).toMatch(/3 months/);
    expect(text).toMatch(/resistance/i);
  });

  it('restricts single-agent clindamycin to irritation-prone skin', () => {
    const m = acneProtocol.medicines.find(x => x.id === 'clindamycin_single')!;
    expect(m.line).toBe(2);
    expect((m.cautions ?? []).join(' ')).toMatch(/prone to irritation/);
  });

  it('excludes oral isotretinoin and oral antibiotics from the medicines list', () => {
    expect(acneProtocol.medicines.some(m => /isotretinoin/i.test(m.medicineName))).toBe(false);
    const excluded = (acneProtocol.excludedMedicines ?? []).map(e => e.medicineName).join(' ');
    expect(excluded).toMatch(/isotretinoin/i);
    expect(excluded).toMatch(/Oral antibiotics/);
  });

  it('requires a 6-week supply trial before pharmacist supply is appropriate', () => {
    const e = acneProtocol.eligibility.find(x => x.id === 'seeking_supply_after_appropriate_trial')!;
    expect(e.label).toMatch(/6 weeks/);
    expect(e.prescribingBlocked).toBe(true);
  });
});

describe('atopic dermatitis flare protocol (VIC, July 2026)', () => {
  it('cites the published source', () => {
    const src = getSource(dermatitisProtocol.sourceId)!;
    expect(src.isbn).toBe('978-1-76131-993-8');
    expect(src.title).toBe(
      'Protocol for Management of Acute Exacerbations of Mild to Moderate Atopic Dermatitis',
    );
  });

  it('scopes itself to a flare, not maintenance', () => {
    expect(dermatitisProtocol.title).toMatch(/Acute Exacerbations/);
    const e = dermatitisProtocol.eligibility.find(x => x.id === 'acute_flare_under_2_weeks')!;
    expect(e.label).toMatch(/less than 2 weeks/);
  });

  it('requires a prior diagnosis by a medical or nurse practitioner', () => {
    const e = dermatitisProtocol.eligibility.find(x => x.id === 'previously_diagnosed')!;
    expect(e.label).toMatch(/medical or nurse practitioner/);
    expect(e.prescribingBlocked).toBe(true);
  });

  it('excludes facial dermatitis, including periorbital and perioral', () => {
    const e = dermatitisProtocol.eligibility.find(x => x.id === 'face_not_involved')!;
    expect(e.label).toMatch(/periorbital or perioral/);
    expect(e.prescribingBlocked).toBe(true);
  });

  it('caps TCS supply at 7 days', () => {
    for (const m of dermatitisProtocol.medicines) {
      if (m.id === 'moisturiser') continue;
      expect((m.cautions ?? []).join(' '), m.id).toMatch(/7 days/);
    }
  });

  it('selects TCS by body site and says so in every entry', () => {
    for (const m of dermatitisProtocol.medicines) {
      if (m.id === 'moisturiser') continue;
      expect((m.cautions ?? []).join(' '), m.id).toMatch(/Site:/);
    }
  });

  /**
   * THE CRITICAL GUARD. The source Medicines List has only "Dose" and "Pack
   * size examples" columns. It delegates contraindications, precautions,
   * interactions and pregnancy/lactation to Therapeutic Guidelines and the AMH.
   * An empty array means "the protocol states none — pharmacist must confirm
   * externally". It must never be filled in from memory.
   */
  it('invents no per-product contraindications the source does not state', () => {
    for (const m of dermatitisProtocol.medicines) {
      expect(m.contraindications, `${m.id} contraindications`).toEqual([]);
      expect(m.needsClinicalReview, `${m.id} review flag`).toBe(true);
    }
    const delegated = dermatitisProtocol.medicines
      .flatMap(m => m.cautions ?? [])
      .join(' ');
    expect(delegated).toMatch(/Therapeutic Guidelines/);
    expect(delegated).toMatch(/Australian Medicines Handbook/);
  });

  it('excludes pimecrolimus, crisaborole and coal tar from Program supply', () => {
    const excluded = (dermatitisProtocol.excludedMedicines ?? []).map(e => e.medicineName).join(' ');
    expect(excluded).toMatch(/Pimecrolimus/);
    expect(excluded).toMatch(/Crisaborole/);
    expect(excluded).toMatch(/coal tar/);
  });

  it('escalates eczema herpeticum and non-blanching rash to emergency care', () => {
    for (const id of ['eczema_herpeticum', 'non_blanching_purple_rash', 'blistering']) {
      const f = dermatitisProtocol.redFlags.find(x => x.id === id)!;
      expect(f.outcome, id).toBe('emergency_department');
      expect(f.prescribingBlocked, id).toBe(true);
    }
  });

  it('has exactly two treat-and-refer criteria', () => {
    const t = dermatitisProtocol.redFlags.filter(f => f.outcome === 'treat_and_refer');
    expect(t.map(f => f.id).sort()).toEqual(['marked_psychosocial_impact', 'no_eczema_care_plan']);
  });

  it('records the page 8 / page 16 conflict rather than silently picking one', () => {
    const m = dermatitisProtocol.medicines.find(x => x.id === 'methylprednisolone_aceponate_lotion')!;
    expect((m.cautions ?? []).join(' ')).toMatch(/page 8/);
    expect(m.reviewNote).toMatch(/page 16/);
  });

  it('flags the severity band gaps in its review note', () => {
    expect(dermatitisProtocol.reviewNote).toMatch(/EASI 7\.0/);
    expect(dermatitisProtocol.reviewNote).toMatch(/SCORAD exactly 50/);
  });
});
