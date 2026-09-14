/**
 * Protocol source registry
 * ------------------------
 * Every clinical protocol rendered by the application must trace back to an
 * entry here. This is what makes "Where did this recommendation come from?"
 * answerable, and what a future scheduled source-checker will diff against.
 *
 * VICTORIAN entries below were retrieved from the Victorian Department of
 * Health "Community Pharmacist Program – Resources for pharmacists" page on
 * 2026-09-13. Titles and update dates are as published there. Entries marked
 * "Verified against the retrieved PDF" have had their title, publisher, date
 * and ISBN read directly out of the downloaded document rather than inferred
 * from the landing page.
 *
 * ⚠️ "Chemist Care Now" is the public-facing campaign name for the Victorian
 * Community Pharmacist Program. It does NOT appear anywhere inside any of the
 * protocol documents. Always cite the program by its formal name —
 * "The Victorian Community Pharmacist Program" — in clinical provenance UI,
 * and never imply a document is a "Chemist Care Now protocol" when the
 * document itself says otherwise.
 *
 * ⚠️ Not all Victorian protocols in this registry belong to the same program.
 * VIC_CCN_SHINGLES_2026_02 is a 2024 Safer Care Victoria document under the
 * Community Pharmacist Statewide Pilot. See its reviewNote.
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
    {
      // ⚠️ The PDF served at this URL is NOT a Community Pharmacist Program
      // document. Verified by reading the retrieved file on 2026-09-13:
      //   • Cover:      "Victorian Community Pharmacist Statewide Pilot"
      //   • Publisher:  "© State of Victoria, Australia, Safer Care Victoria,
      //                  February 2024" (NOT the Department of Health)
      //   • ISBN:       978-1-76131-470-4
      //   • Authority:  "Secretary Approval: Community Pharmacist Statewide
      //                  Pilot" (NOT "Secretary Approval: Community
      //                  Pharmacist Program")
      // Every other protocol in this registry is a Department of Health
      // "Community Pharmacist Program" document dated Dec 2025 – Jul 2026.
      // This one is ~2 years older, from a different publisher, under a
      // different enabling instrument. It must not be assumed current.
      authority: 'Safer Care Victoria',
      program: 'Community Pharmacist Statewide Pilot',
      version: 'February 2024',
      publishedDate: '2024-02-01',
      isbn: '978-1-76131-470-4',
      needsClinicalReview: true,
      reviewNote:
        'Retrieved PDF is a Feb 2024 Safer Care Victoria document under the ' +
        'Community Pharmacist Statewide Pilot, not a current Department of Health ' +
        'Community Pharmacist Program protocol. Confirm whether a current ' +
        'Community Pharmacist Program shingles protocol exists and supersedes this ' +
        'one before any shingles content is presented as a VIC pathway.',
    },
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
    {
      // Verified against the retrieved PDF 2026-09-13:
      //   "Protocol for Initiation of the Oral Contraceptive Pill", July 2026,
      //   ISBN 978-1-76195-024-7, © State of Victoria, Department of Health.
      // ⚠️ This is an INITIATION protocol — starting the OCP, not resupplying
      // it. Resupply of hormonal contraception is a SEPARATE protocol
      // (VIC_CCN_HORMONAL_RESUPPLY_2025_12). Initiation and resupply have
      // different eligibility, different exclusions and different risk
      // screening. Do not model one using the other.
      version: 'July 2026',
      publishedDate: '2026-07-01',
      isbn: '978-1-76195-024-7',
      needsClinicalReview: true,
      reviewNote:
        'This is an INITIATION protocol, not a resupply protocol. Verified against ' +
        'the retrieved PDF (July 2026, ISBN 978-1-76195-024-7). Confirm which of ' +
        'initiation vs resupply each OCP feature in the product actually implements, ' +
        'and that the two are never mixed.',
    },
  ),
  vic(
    'VIC_CCN_ACNE_2026_08',
    'Protocol for Management of Mild Acne',
    'https://www.health.vic.gov.au/sites/default/files/2026-08/protocol-for-management-of-mild-acne.pdf',
    undefined,
    {
      // Verified against the retrieved PDF 2026-09-13:
      //   "Protocol for Management of Mild Acne", The Victorian Community
      //   Pharmacist Program, July 2026, ISBN/ISSN 978-1-76131-994-5.
      // Note the title scopes the service to MILD acne only.
      version: 'July 2026',
      publishedDate: '2026-07-01',
      isbn: '978-1-76131-994-5',
    },
  ),
  vic(
    'VIC_CCN_DERMATITIS_2026_08',
    'Protocol for Management of Acute Exacerbations of Mild to Moderate Atopic Dermatitis',
    'https://www.health.vic.gov.au/sites/default/files/2026-08/protocol-for-management-of-acute-exacerbations-of-mild-to-moderate-atopic-dermatitis.pdf',
    undefined,
    {
      // Verified against the retrieved PDF 2026-09-13:
      //   July 2026, ISBN/ISSN 978-1-76131-993-8, Department of Health.
      // ⚠️ Scope is an ACUTE EXACERBATION (flare), not maintenance management.
      // Note also: the protocol states no per-product contraindications,
      // cautions or interactions — it delegates all of these to Therapeutic
      // Guidelines / AMH. Any such content for these products therefore has no
      // in-document source and must NOT be transcribed as if it did.
      version: 'July 2026',
      publishedDate: '2026-07-01',
      isbn: '978-1-76131-993-8',
      needsClinicalReview: true,
      reviewNote:
        'Scope is acute exacerbation (flare) management only, not maintenance. The ' +
        'protocol delegates contraindications, cautions, interactions and counselling ' +
        'to Therapeutic Guidelines / AMH and gives none per product — do not ' +
        'manufacture them. Age range 2–65 inclusive; face involvement excluded. ' +
        'Severity bands have gaps (EASI 7.0–7.1 and SCORAD exactly 50 are ' +
        'unclassified); confirm handling before encoding thresholds.',
    },
  ),
  vic(
    'VIC_CCN_IMPETIGO_2025_12',
    'Protocol for Management of Impetigo',
    'https://www.health.vic.gov.au/sites/default/files/2025-12/protocol-for-management-of-impetigo-december-2025.pdf',
    undefined,
    {
      // Verified against the retrieved PDF 2026-09-13:
      //   "Protocol for Management of Impetigo", December 2025,
      //   ISBN 978-1-76131-946-4, Department of Health.
      version: 'December 2025',
      publishedDate: '2025-12-01',
      isbn: '978-1-76131-946-4',
    },
  ),
  vic(
    'VIC_CCN_HORMONAL_RESUPPLY_2025_12',
    'Protocol for Resupply of Hormonal Contraception',
    'https://www.health.vic.gov.au/sites/default/files/2025-12/protocol-for-resupply-of-hormonal-contraception-december-2025.pdf',
    undefined,
    {
      // Not retrieved during this sprint — registered from the landing page
      // listing only. Distinct from VIC_CCN_OCP_INIT_2026_07 (initiation).
      needsClinicalReview: true,
      reviewNote:
        'Not retrieved during this sprint; registered from the program landing page. ' +
        'This is the RESUPPLY protocol and is a different document from the OCP ' +
        'INITIATION protocol (VIC_CCN_OCP_INIT_2026_07). Retrieve before any ' +
        'resupply content is encoded.',
    },
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
