/**
 * Protocol source registry
 * ------------------------
 * Every clinical protocol rendered by the application must trace back to an
 * entry here. This is what makes "Where did this recommendation come from?"
 * answerable, and what a future scheduled source-checker will diff against.
 *
 * VICTORIAN entries below were retrieved from the Victorian Department of
 * Health "Community Pharmacist Program – Resources for pharmacists" page on
 * 2026-09-13. Titles and update dates are as published there.
 *
 * QUEENSLAND entries are registered at PROGRAM level only. The individual
 * condition protocols were NOT retrieved during this sprint, so any
 * Queensland-derived clinical content is flagged needsClinicalReview and must
 * not be presented as an active prescribing pathway.
 */

import type { ProtocolSource } from './types';

export const VIC_PROGRAM_LANDING_PAGE =
  'https://www.health.vic.gov.au/primary-care/community-pharmacist-program-resources-for-pharmacists';

/** Date these sources were retrieved/verified. */
export const SOURCES_RETRIEVED_AT = '2026-09-13';

const vic = (
  id: string,
  title: string,
  documentUrl: string,
  updatedDate?: string,
  extra: Partial<ProtocolSource> = {},
): ProtocolSource => ({
  id,
  title,
  jurisdiction: 'VIC',
  authority: 'Victorian Department of Health',
  program: 'Community Pharmacist Program (Chemist Care Now)',
  sourceType: 'government',
  updatedDate,
  retrievedAt: SOURCES_RETRIEVED_AT,
  url: VIC_PROGRAM_LANDING_PAGE,
  documentUrl,
  ...extra,
});

export const PROTOCOL_SOURCES: readonly ProtocolSource[] = [
  vic(
    'VIC_CCN_UTI_2026_01',
    'Protocol for Management of Urinary Tract Infections',
    'https://www.health.vic.gov.au/sites/default/files/2026-02/protocol-for-management-of-urinary-tract-infections.pdf',
    '2026-02-04',
    {
      // Title page states "January 2026"; landing page states updated 4 Feb 2026.
      version: 'January 2026',
      publishedDate: '2026-01-01',
      isbn: '978-1-76131-955-6',
    },
  ),
  vic(
    'VIC_CCN_SHINGLES_2026_02',
    'Protocol for Management of Herpes Zoster (Shingles)',
    'https://www.health.vic.gov.au/sites/default/files/2026-02/protocol-for-management-of-herpes-zoster-shingles.pdf',
    '2026-02-12',
  ),
  vic(
    'VIC_CCN_MSK_PAIN_2026_06',
    'Protocol for Management of Acute Mild Musculoskeletal Pain',
    'https://www.health.vic.gov.au/sites/default/files/2026-06/protocol-for-management-of-acute-mild-musculoskeletal-pain.pdf',
    '2026-06-22',
  ),
  vic(
    'VIC_CCN_OCP_INIT_2026_07',
    'Protocol for Initiation of the Oral Contraceptive Pill',
    'https://www.health.vic.gov.au/sites/default/files/2026-07/protocol-for-initiation-of-the-oral-contraceptive-pill-july-2026.pdf',
    '2026-07-29',
  ),
  vic(
    'VIC_CCN_ACNE_2026_08',
    'Protocol for Management of Mild Acne',
    'https://www.health.vic.gov.au/sites/default/files/2026-08/protocol-for-management-of-mild-acne.pdf',
  ),
  vic(
    'VIC_CCN_DERMATITIS_2026_08',
    'Protocol for Management of Acute Exacerbations of Mild to Moderate Atopic Dermatitis',
    'https://www.health.vic.gov.au/sites/default/files/2026-08/protocol-for-management-of-acute-exacerbations-of-mild-to-moderate-atopic-dermatitis.pdf',
  ),
  vic(
    'VIC_CCN_IMPETIGO_2025_12',
    'Protocol for Management of Impetigo',
    'https://www.health.vic.gov.au/sites/default/files/2025-12/protocol-for-management-of-impetigo-december-2025.pdf',
  ),
  vic(
    'VIC_CCN_HORMONAL_RESUPPLY_2025_12',
    'Protocol for Resupply of Hormonal Contraception',
    'https://www.health.vic.gov.au/sites/default/files/2025-12/protocol-for-resupply-of-hormonal-contraception-december-2025.pdf',
  ),
  vic(
    'VIC_CCN_PSORIASIS_2024_02',
    'Protocol for Management of Acute Exacerbation of Mild Plaque Psoriasis',
    'https://www.health.vic.gov.au/sites/default/files/2024-02/protocol-for-management-of-acute-exacerbation-of-mild-plaque-psoriasis.pdf',
  ),
  vic(
    'VIC_CCN_VACCINE_ADMIN',
    'Protocol for Vaccine Administration',
    'https://www.health.vic.gov.au/sites/default/files/2024-02/protocol-for-vaccine-administration.pdf',
  ),

  // ── Queensland ────────────────────────────────────────────────────────────
  // Program-level guidance only. Condition protocols were not retrieved.
  {
    id: 'QLD_SCOPE_PRACTICE_2025_07',
    title: 'Prescribing scope of practice management',
    jurisdiction: 'QLD',
    authority: 'Queensland Health',
    program: 'Community Pharmacy Prescribing (from 1 July 2025)',
    sourceType: 'government',
    publishedDate: '2025-07-01',
    retrievedAt: SOURCES_RETRIEVED_AT,
    url: 'https://www.health.qld.gov.au/__data/assets/pdf_file/0031/1450984/guidance-prescribing-scope-practice.pdf',
    needsClinicalReview: true,
    reviewNote:
      'Queensland source document could not be retrieved (HTTP 403). Program-level ' +
      'existence and 1 July 2025 commencement confirmed via search, but condition-level ' +
      'eligibility, red flags and dosing have NOT been extracted. No Queensland clinical ' +
      'content may be marked active until this document is retrieved and mapped.',
  },
  {
    id: 'QLD_PROFESSIONAL_PRACTICE_2025_07',
    title: 'Prescribing in community pharmacy: professional practice',
    jurisdiction: 'QLD',
    authority: 'Queensland Health',
    program: 'Community Pharmacy Prescribing (from 1 July 2025)',
    sourceType: 'government',
    publishedDate: '2025-07-01',
    retrievedAt: SOURCES_RETRIEVED_AT,
    url: 'https://www.health.qld.gov.au/__data/assets/pdf_file/0032/1450985/guidance-professional-practice.pdf',
    needsClinicalReview: true,
    reviewNote: 'Not retrieved (HTTP 403). Retained for provenance/traceability only.',
  },
] as const;

const SOURCE_INDEX = new Map(PROTOCOL_SOURCES.map(s => [s.id, s]));

export function getSource(sourceId: string): ProtocolSource | undefined {
  return SOURCE_INDEX.get(sourceId);
}

/**
 * Throws in tests / dev if a protocol references an unknown source.
 * A protocol without traceable provenance must not silently render.
 */
export function requireSource(sourceId: string): ProtocolSource {
  const s = SOURCE_INDEX.get(sourceId);
  if (!s) {
    throw new Error(
      `Unknown protocol source '${sourceId}'. Every clinical protocol must reference ` +
        `a registered ProtocolSource in src/clinical/sources.ts.`,
    );
  }
  return s;
}

export function sourcesForJurisdiction(j: 'VIC' | 'QLD'): ProtocolSource[] {
  return PROTOCOL_SOURCES.filter(s => s.jurisdiction === j);
}

/** One-line provenance string for UI badges. */
export function describeSource(s: ProtocolSource): string {
  const date = s.updatedDate ?? s.publishedDate;
  const datePart = date ? ` · ${date}` : '';
  return `${s.authority} · ${s.title}${datePart}`;
}
