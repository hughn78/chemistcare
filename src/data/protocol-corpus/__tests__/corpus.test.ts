/**
 * Protocol Corpus — integration tests (node-side, no DOM)
 * --------------------------------------------------------
 * Verifies the immutable Sep 2026 corpus is loadable, complete and
 * internally consistent, and that structured red-flag rules evaluate
 * correctly. These guard the data the consultation protocol panel and
 * protocol stamps depend on.
 */
import { describe, it, expect } from 'vitest';
import {
  CORPUS_DOCUMENTS,
  CORPUS_CONDITIONS,
  getJurisdictionsForSlug,
  getPayload,
  evaluateStructuredRule,
  corpusJurisdictionsForSlug,
} from '../index';

describe('protocol corpus integrity', () => {
  it('loads all 113 documents across 8 jurisdictions', () => {
    expect(CORPUS_DOCUMENTS).toHaveLength(113);
    const states = new Set(CORPUS_DOCUMENTS.map(d => d.state));
    expect([...states].sort()).toEqual(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
  });

  it('classifies every document with condition, docType and provenance', () => {
    for (const d of CORPUS_DOCUMENTS) {
      expect(d.state).toMatch(/^(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)$/);
      expect(d.conditionKey).toBeTruthy();
      expect(d.docType).toBeTruthy();
      expect(d.sha256).toBeTruthy();
      expect(d.counts).toBeDefined();
      expect(d.truncated).toBeTypeOf('boolean');
    }
  });

  it('flags the known truncated SA obesity extraction', () => {
    const sa = CORPUS_DOCUMENTS.find(d => d.file.startsWith('SA_management-for-overweight'));
    expect(sa?.truncated).toBe(true);
    const truncated = CORPUS_DOCUMENTS.filter(d => d.truncated);
    expect(truncated).toHaveLength(1);
  });

  it('maps registry slugs for the consulting conditions', () => {
    expect(corpusJurisdictionsForSlug('uncomplicated-uti').sort()).toEqual([
      'ACT', 'NSW', 'NT', 'QLD', 'TAS', 'VIC', 'WA',
    ]);
    expect(corpusJurisdictionsForSlug('mild-moderate-acne').sort()).toEqual(['NSW', 'QLD', 'SA', 'VIC', 'WA']);
    // Travel medicine is corpus-mapped via the travel-health group.
    expect(corpusJurisdictionsForSlug('travel-medicine').length).toBeGreaterThan(0);
  });

  it('excludes repealed documents from jurisdiction availability', () => {
    const act = getJurisdictionsForSlug('ocp-resupply');
    const actEntry = act.find(j => j.state === 'ACT');
    // The repealed 2025 authorisation must never drive availability…
    expect(actEntry?.docs.some(d => d.docType === 'repealed') ?? false).toBe(false);
    // …while the active 2026 continuation instrument remains.
    expect(actEntry?.docs.some(d => d.docType === 'prescribing-instrument')).toBe(true);
  });

  it('exposes full payloads with provenance for clinical documents', () => {
    const sample = CORPUS_DOCUMENTS.find(d => d.state === 'QLD' && d.conditionKey === 'acne');
    expect(sample).toBeDefined();
    const payload = getPayload(sample!.file);
    expect(payload).not.toBeNull();
    expect(payload!.protocol.state).toBe('QLD');
    expect(payload!.source.pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(payload!.red_flags?.length).toBeGreaterThan(0);
    expect(payload!.eligibility?.inclusion?.length).toBeGreaterThan(0);
  });

  it('counts conditions with registry mappings', () => {
    const mapped = CORPUS_CONDITIONS.filter(c => c.registrySlug);
    expect(mapped.length).toBeGreaterThan(20);
  });
});

describe('structured red-flag evaluation', () => {
  it('detects age out of range from DOB (live fail)', () => {
    const dob65 = new Date();
    dob65.setFullYear(dob65.getFullYear() - 66);
    const dob30 = new Date();
    dob30.setFullYear(dob30.getFullYear() - 30);
    const rule = { parameter: 'age', operator: '>', value: 65 };
    expect(evaluateStructuredRule(rule, { dob: dob65.toISOString().slice(0, 10) })).toBe('fail');
    expect(evaluateStructuredRule(rule, { dob: dob30.toISOString().slice(0, 10) })).toBe('pass');
  });

  it('evaluates numeric vitals (temperature)', () => {
    expect(evaluateStructuredRule({ parameter: 'temperature', operator: '>', value: 38 }, { temperature: '38.5' })).toBe('fail');
    expect(evaluateStructuredRule({ parameter: 'temperature', operator: '>', value: 38 }, { temperature: '37.2' })).toBe('pass');
  });

  it('returns unverifiable when data is absent (checklist, not auto-fail)', () => {
    expect(evaluateStructuredRule({ parameter: 'temperature', operator: '>', value: 38 }, {})).toBe('unverifiable');
    expect(evaluateStructuredRule({ parameter: 'age', operator: '<', value: 16 }, { dob: '' })).toBe('unverifiable');
    expect(evaluateStructuredRule({ parameter: 'temperature', operator: '>', value: 38 }, undefined)).toBe('unverifiable');
  });

  it('rejects malformed rule values as unverifiable', () => {
    expect(evaluateStructuredRule({ parameter: 'age', operator: '>', value: 'NaN?' }, { dob: '2000-01-01' })).toBe('unverifiable');
    expect(evaluateStructuredRule({ parameter: 'age', operator: '~', value: 5 }, { dob: '2000-01-01' })).toBe('unverifiable');
  });
});