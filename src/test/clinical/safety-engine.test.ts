// @vitest-environment node
/**
 * Safety engine behaviour
 * Focus: medicine status normalisation, override policy, and the absence of a
 * misleading numeric "safety score".
 */
import { describe, it, expect } from 'vitest';
import {
  normaliseMedication,
  parseMedicationList,
  summariseSafety,
  canOverride,
  MIN_OVERRIDE_REASON_LENGTH,
} from '@/clinical/safety';
import type { SafetyFinding } from '@/clinical/types';

describe('medication normalisation', () => {
  it('detects a ceased medicine', () => {
    expect(normaliseMedication('warfarin stopped 2019').status).toBe('ceased');
    expect(normaliseMedication('amoxicillin ceased').status).toBe('ceased');
    expect(normaliseMedication('prednisolone discontinued 2023').status).toBe('ceased');
  });

  it('detects a historical medicine by past year alone', () => {
    expect(normaliseMedication('warfarin 2019').status).toBe('historical');
  });

  it('detects PRN medicines', () => {
    expect(normaliseMedication('salbutamol PRN').status).toBe('prn');
    expect(normaliseMedication('paracetamol as needed').status).toBe('prn');
  });

  it('treats a plain medicine as current', () => {
    const m = normaliseMedication('methotrexate 15mg weekly');
    expect(m.status).toBe('current');
    expect(m.strength).toBe('15mg');
    expect(m.normalisedName).toBe('methotrexate');
  });

  it('parses a comma-separated list', () => {
    const list = parseMedicationList('metformin 500mg BD, ramipril 5mg daily');
    expect(list).toHaveLength(2);
    expect(list.every(m => m.status === 'current')).toBe(true);
  });

  it('returns nothing for empty input', () => {
    expect(parseMedicationList('')).toEqual([]);
    expect(parseMedicationList(undefined)).toEqual([]);
  });
});

describe('override policy', () => {
  const finding = (policy: SafetyFinding['overridePolicy']): SafetyFinding => ({
    ruleId: 'test:rule',
    finding: 'Test finding',
    severity: 'hard_stop',
    reason: 'Because',
    sourceId: 'VIC_CCN_UTI_2026_01',
    recommendedAction: 'Do something',
    overridePolicy: policy,
  });

  it('never allows overriding a non-overridable finding', () => {
    expect(canOverride(finding('non_overridable'), 'a'.repeat(500))).toBe(false);
  });

  it('requires a substantive reason for rationale-required findings', () => {
    expect(canOverride(finding('rationale_required'), 'fine')).toBe(false);
    expect(MIN_OVERRIDE_REASON_LENGTH).toBeGreaterThan(10);
    expect(
      canOverride(
        finding('rationale_required'),
        'Discussed with patient; GP appointment unavailable for 5 days and symptoms are mild.',
      ),
    ).toBe(true);
  });
});

describe('safety summary', () => {
  it('reports worst severity rather than a fabricated percentage', () => {
    const summary = summariseSafety([]);
    expect(summary.worst).toBe('none');
    expect(summary.prescribingBlocked).toBe(false);
  });

  it('blocks prescribing on a hard stop and lists it as non-overridable', () => {
    const summary = summariseSafety([
      {
        ruleId: 'r1',
        finding: 'Pyelonephritis suspected',
        severity: 'hard_stop',
        reason: 'x',
        sourceId: 'VIC_CCN_UTI_2026_01',
        recommendedAction: 'Refer to ED',
        overridePolicy: 'non_overridable',
      },
      {
        ruleId: 'r2',
        finding: 'Diabetes',
        severity: 'caution',
        reason: 'y',
        sourceId: 'VIC_CCN_UTI_2026_01',
        recommendedAction: 'Treat and refer',
        overridePolicy: 'rationale_required',
      },
    ]);
    expect(summary.worst).toBe('hard_stop');
    expect(summary.prescribingBlocked).toBe(true);
    expect(summary.nonOverridable.map(f => f.ruleId)).toEqual(['r1']);
    expect(summary.overridable.map(f => f.ruleId)).toEqual(['r2']);
  });

  it('counts by severity', () => {
    const mk = (severity: SafetyFinding['severity']) => ({
      ruleId: severity,
      finding: severity,
      severity,
      reason: 'x',
      sourceId: 'VIC_CCN_UTI_2026_01',
      recommendedAction: 'y',
      overridePolicy: 'warning_only' as const,
    });
    const summary = summariseSafety([mk('caution'), mk('caution'), mk('monitor')]);
    expect(summary.counts.caution).toBe(2);
    expect(summary.counts.monitor).toBe(1);
    expect(summary.prescribingBlocked).toBe(false);
  });
});
