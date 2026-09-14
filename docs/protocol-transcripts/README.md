# Protocol transcripts

Working material for transcribing official Australian jurisdictional protocols
into `src/clinical/protocols/*.ts`.

**These files are review artifacts, not clinical guidance and not code.** They
exist so a pharmacist can check a transcription against the source without
re-reading a 28-page PDF. The authoritative document is always the published
PDF; where a transcript and the PDF disagree, the PDF wins.

## Attribution

Source documents are © State of Victoria (Department of Health, and Safer Care
Victoria for the 2024 shingles protocol). They are reproduced here in
structured, quoted form solely to support clinical verification of this
software. Each transcript records the document's own title, publisher, date and
ISBN. Do not treat this folder as a redistribution of the guidelines.

## Status

| Condition | Source document | ISBN | Transcript | Encoded in code |
|---|---|---|---|---|
| Uncomplicated UTI | Protocol for Management of Urinary Tract Infections, Jan 2026 (upd. 4 Feb 2026) | 978-1-76131-955-6 | — (transcribed directly) | ✅ `protocols/uti.ts` |
| Mild acne | Protocol for Management of Mild Acne, July 2026 | 978-1-76131-994-5 | — (transcribed directly) | ✅ `protocols/acne.ts` |
| Atopic dermatitis flare | Protocol for Management of Acute Exacerbations of Mild to Moderate Atopic Dermatitis, July 2026 | 978-1-76131-993-8 | — (transcribed directly) | ✅ `protocols/dermatitis.ts` |
| OCP **initiation** | Protocol for Initiation of the Oral Contraceptive Pill, July 2026 | 978-1-76195-024-7 | `ocp-initiation-2026-07.extraction.md` | ❌ blocked |
| Impetigo | Protocol for Management of Impetigo, December 2025 | 978-1-76131-946-4 | `impetigo-2025-12.extraction.md` | ❌ not yet |
| Herpes zoster (shingles) | Protocol for Management of Herpes Zoster (Shingles), **February 2024, Safer Care Victoria** | 978-1-76131-470-4 | not produced | ❌ blocked |

## Why some are blocked

Blocked items are listed in `SOURCES_WITHOUT_PROTOCOL` in
`src/clinical/registry.ts`, and a test asserts no protocol ships for them.

### Shingles — superseded and internally contradictory

The only retrievable Victorian shingles protocol is a **February 2024 Safer
Care Victoria** document under the **Community Pharmacist Statewide Pilot**.
Every other protocol in the registry is a Department of Health **Community
Pharmacist Program** document dated December 2025 – July 2026. This one is
roughly two years older, from a different publisher, under a different
Secretary Approval instrument, and contains internal contradictions.

Per the sprint's stop-condition rule, it was **not** transcribed. Action
required: confirm whether a current Community Pharmacist Program shingles
protocol exists and supersedes this one.

### OCP — initiation is not resupply

The July 2026 document is an **initiation** protocol. Hormonal contraception
**resupply** is a separate protocol (`VIC_CCN_HORMONAL_RESUPPLY_2025_12`),
which was not retrieved. Eligibility, exclusions and risk screening differ
between the two. They must never be modelled with each other's content.

## Two findings that affect the whole product

1. **"Chemist Care Now" appears in none of the protocol documents.** It is the
   public-facing campaign name for the Victorian Community Pharmacist Program.
   Provenance UI must cite the program by its formal name — "The Victorian
   Community Pharmacist Program" — and must not label a document a "Chemist
   Care Now protocol" when the document says otherwise.

2. **These protocols delegate drug safety information.** The acne and
   dermatitis protocols both state that pharmacists *must* consult Therapeutic
   Guidelines and the Australian Medicines Handbook for contraindications,
   precautions, interactions and pregnancy/lactation, and give none
   per-product. The encoded protocols therefore carry **empty**
   `contraindications` arrays with `needsClinicalReview: true`. An empty array
   means "the protocol states none — pharmacist must confirm externally". It
   must never be filled in from memory; a test in
   `src/test/clinical/protocol-expansion.test.ts` fails if it is.
