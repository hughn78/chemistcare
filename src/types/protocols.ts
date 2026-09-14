import { utiProtocol } from '@/clinical/protocols/uti';

export interface ProtocolAlert {
  level: 'red' | 'amber' | 'green';
  title: string;
  message: string;
  action?: string;
  blocksPrescribing?: boolean;
}

export interface PrescribingOption {
  id: string;
  name: string;
  line: 'first' | 'second' | 'third';
  dose: string;
  frequency: string;
  duration: string;
  notes?: string;
  safetyChecks?: { question: string; blockIf: boolean; blockMessage: string }[];
}

// UTI Protocol
/**
 * DERIVED from the canonical Victorian protocol (src/clinical/protocols/uti.ts).
 * Do not edit clinical values here — change the canonical protocol instead.
 *
 * The previous copy stated "Nitrofurantoin 100mg MR, twice daily,
 * contraindicated in eGFR <30 mL/min". The official protocol specifies
 * 100 mg every 6 hours for 5 days (20 capsules) and states NO numeric renal
 * threshold — it says "severe renal impairment" and directs prescribers to
 * Therapeutic Guidelines / AMH. Invented thresholds have been removed.
 */
export const UTI_PRESCRIBING: PrescribingOption[] = utiProtocol.medicines.map(m => ({
  id: m.id,
  name: `${m.medicineName} ${m.dose}`,
  line: m.line === 1 ? ('first' as const) : m.line === 2 ? ('second' as const) : ('third' as const),
  dose: m.dose,
  frequency: m.frequency,
  duration: m.duration,
  notes:
    m.id === 'trimethoprim'
      ? 'Third-line only — not if trimethoprim used, or trimethoprim-resistant E. coli, in the last 3 months.'
      : m.cautions?.[0],
  safetyChecks:
    m.id === 'trimethoprim'
      ? [
          {
            question: 'Has the patient used trimethoprim in the last 3 months, or had a trimethoprim-resistant E. coli isolate?',
            blockIf: true,
            blockMessage:
              'Trimethoprim should not be used if taken within 3 months or if a trimethoprim-resistant ' +
              'E. coli isolate was identified. Select an alternative agent under the protocol.',
          },
        ]
      : undefined,
}));

// Shingles Protocol
export const SHINGLES_PRESCRIBING: PrescribingOption[] = [
  {
    id: 'valaciclovir',
    name: 'Valaciclovir 1g',
    line: 'first',
    dose: '1g',
    frequency: 'Every 8 hours',
    duration: '7 days',
    notes: 'Standard immunocompetent dosing.',
  },
  {
    id: 'famciclovir',
    name: 'Famciclovir 500mg',
    line: 'first',
    dose: '500mg',
    frequency: 'Every 8 hours',
    duration: '7 days (10 days if immunocompromised)',
    notes: 'Extend to 10 days for immunocompromised patients.',
  },
  {
    id: 'aciclovir',
    name: 'Aciclovir 800mg',
    line: 'second',
    dose: '800mg',
    frequency: '5 times daily',
    duration: '7 days',
    notes: 'Higher pill burden; use if others unavailable.',
  },
];

export const CONTRACEPTION_PRESCRIBING: PrescribingOption[] = [
  {
    id: 'levonorgestrel-ee',
    name: 'Levonorgestrel/Ethinylestradiol',
    line: 'first',
    dose: 'As per current prescription',
    frequency: 'Daily',
    duration: '4 months supply',
    notes: 'Resupply of current combined OCP only.',
  },
  {
    id: 'desogestrel',
    name: 'Desogestrel (POP)',
    line: 'first',
    dose: '75mcg',
    frequency: 'Daily, continuous',
    duration: '4 months supply',
    notes: 'Progestogen-only pill resupply.',
  },
];
