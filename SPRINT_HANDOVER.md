# ChemistCare PrescriberOS — Clinical Engine & Product Modernisation Sprint
## Handover Report

**Branch:** `prescriberos-clinical-modernisation` (local, 11 commits)
**Base:** `main` @ `0f08c37`
**Date:** 2026-09-13
**Scope:** clinical content architecture, clinical engine, consultation outcomes, AI guardrails, reliability. **Security was out of scope and was not touched.**

---

### 1. Executive summary

The single most important finding is clinical, not technical. The app's UTI content **contradicted the official Victorian protocol on every therapy line**:

| | App before | Victorian protocol (Jan 2026, ISBN 978-1-76131-955-6) |
|---|---|---|
| First line | Trimethoprim | **Nitrofurantoin 100 mg q6h × 5 days (qty 20)** |
| Second line | Nitrofurantoin (with invented "eGFR <30") | **Fosfomycin 3 g single dose** |
| Third line | — | **Trimethoprim 300 mg nocte × 3 nights** |
| Cefalexin | Offered | **Explicitly excluded** to limit resistance |
| Renal threshold | "eGFR <30 mL/min" (invented) | "Severe renal impairment" — **no number published** |

That content existed in three places with three different values (`conditions.ts`, `conditionTemplates/uti.ts`, `types/protocols.ts`). It is now one canonical protocol that the other three derive from.

Also fixed: the safety engine matched medicines with a substring test, so **"methotrexate (ceased 2019)" raised a hard blocker**; audit failures were swallowed with `console.warn` and reported as saved; a single failed async call destroyed the whole React tree; and the app never asked about **7 of the 22 red flags** the protocol screens for.

**Verification:** `tsc` exit 0 · **119 tests passing** in 10 files (was 18 passing + 1 file erroring) · production build OK · lint 57 errors / 24 warnings vs 55 / 24 at baseline.

---

### 2. Clinical source hierarchy and provenance

Priority 1 = Victorian Department of Health, Community Pharmacist Program ("Chemist Care Now"). Priority 2 = Queensland Health only where no Victorian equivalent exists. Victorian content overrides Queensland for the Victorian pathway.

**10 Victorian protocols registered** in `src/clinical/sources.ts` with exact title, jurisdiction, authority, program, version, published/updated date, retrieval date (`2026-09-13`), URL and ISBN where published:

| Source ID | Title | Updated |
|---|---|---|
| `VIC_CCN_UTI_2026_01` | Protocol for Management of Urinary Tract Infections | 2026-02-04 (v. January 2026, ISBN 978-1-76131-955-6) |
| `VIC_CCN_SHINGLES_2026_02` | Herpes Zoster (Shingles) | 2026-02-12 |
| `VIC_CCN_MSK_PAIN_2026_06` | Acute Mild Musculoskeletal Pain | 2026-06-22 |
| `VIC_CCN_OCP_INIT_2026_07` | Initiation of the Oral Contraceptive Pill | 2026-07-29 |
| `VIC_CCN_ACNE_2026_08` | Mild Acne | — |
| `VIC_CCN_DERMATITIS_2026_08` | Acute Exacerbations of Mild–Moderate Atopic Dermatitis | — |
| `VIC_CCN_IMPETIGO_2025_12` | Impetigo | — |
| `VIC_CCN_HORMONAL_RESUPPLY_2025_12` | Resupply of Hormonal Contraception | — |
| `VIC_CCN_PSORIASIS_2024_02` | Acute Exacerbation of Mild Plaque Psoriasis | — |
| `VIC_CCN_VACCINE_ADMIN` | Vaccine Administration | — |

**Queensland: 2 program-level sources only, both flagged `needsClinicalReview: true`.** `health.qld.gov.au` returned **HTTP 403** to every retrieval attempt. Program existence and the 1 July 2025 commencement were confirmed, but **no Queensland clinical content has been extracted and none is marked active**. This is the sprint's largest open item.

The three concepts the brief required to stay separate are separate in the type system: `ProtocolDefinition` (clinical protocol) · `JurisdictionScope` (legal authority) · `PharmacistCapability` (individual scope). There is no `canPrescribe` boolean.

**Provenance UI:** `ProtocolStatusBadge` (icon + text + colour, never colour alone), `ProtocolProvenancePopover` (protocol, ID, jurisdiction, authority, source with link, version, published, last updated, retrieved, ISBN, effective date, clinical status), and `ProtocolReferenceModeBanner`. Wired into `ConditionDetail` and `UtiConsultation`.

---

### 3. Single source of truth

New canonical layer under `src/clinical/`:

```
types.ts        — ProtocolDefinition, SafetyFinding, Medication, Allergy, ReferralOutcome…
sources.ts      — citable source registry (no clinical content)
protocols/uti.ts— the one UTI protocol, transcribed from the real PDF
registry.ts     — PROTOCOL_REGISTRY + validateRegistry() (11 validation codes)
safety.ts       — structured medication/allergy matching + findings
decision.ts     — decide() -> outcome, buildHandover() -> ISBAR
primitives.ts   — ageFromDob, isWithinAgeBand, isPregnancyExcluded
aiGuardrails.ts — what AI may and may not generate
```

`conditions.ts`, `types/protocols.ts` and `conditionTemplates/uti.ts` now **derive** from `utiProtocol`. `src/test/clinical/protocol-integrity.test.ts` asserts they cannot drift — including a regex guard that no `eGFR`/`GFR` threshold can reappear anywhere in UTI medicine text.

`validateRegistry()` rejects: duplicate ids, unknown sources, missing provenance, `active` while `needsClinicalReview`, empty medicine lists, duplicate red-flag/eligibility ids, and review flags without a note.

---

### 4. Clinical engine

**Lifecycle:** `draft → source_verified → clinical_review_required → clinically_reviewed → active → superseded → retired`. `mayPresentAsPrescribingPathway()` returns true only for `active` and `clinically_reviewed`.

UTI is **`source_verified` + `needsClinicalReview: true`** — transcribed from the retrieved PDF, not yet signed off by a pharmacist prescriber. It therefore renders in REFERENCE / DEVELOPMENT mode with a visible banner. Moving it to `clinically_reviewed` is a one-line change once a pharmacist reviews it. **This is deliberate: I did not mark my own transcription as approved.**

**Safety engine** replaced the substring matcher:
- `normaliseMedication()` → `{ rawText, normalisedName, strength, status }` where status is `current | ceased | historical | prn | unknown`. "Stopped", "ceased", "discontinued", "no longer", "formerly", a bare past year, and "PRN" are all recognised.
- Only `current`/`prn` can raise a hard stop or contraindication.
- `parseAllergyList()` extracts substance, reaction, severity (anaphylaxis/severe detected) and resolved status ("childhood, resolved" is ignored).
- Contraindications are matched against **conditions as well as medicines** — "Severe renal impairment" is a condition, and the old code only searched the medicines field.
- Findings carry `ruleId`, `severity`, `reason`, `sourceId`, `recommendedAction`, `overridePolicy`.
- Override policy: **non-overridable** (ED/000 red flags, protocol exclusions, allergy to the proposed drug itself, anaphylaxis) · **rationale required** (min 25 chars) · **warning only**.
- **The 0–100 "safety score" is gone.** It could not express "absolute contraindication" versus "monitor this". `SafetyFindingsPanel` renders findings instead.

**Red flag coverage gap closed.** The template had 15 hand-written flags; the protocol screens for 22. The app never asked about IUD inserted <3 months, IUD >3 months, neurological bladder, urinary tract abnormality/obstruction/urolithiasis, spinal cord injury, diabetes/SGLT2, long-term inpatient care, asplenia, or history of pyelonephritis. All 22 are now derived from the protocol. The invented `nausea_vomiting` flag was removed — the protocol lists nausea and vomiting under its pyelonephritis criterion, so no meaning is lost.

**Referral is a first-class outcome.** `decide()` returns `treat | treat_and_refer | refer_routine | refer_same_day | urgent_care | emergency_department | call_emergency | specialist | no_treatment | undecided`, prioritised so an emergency outranks everything. `ReferralPanel` names the urgency, states whether supply is permitted, and produces an editable, copyable **ISBAR handover**. A referral is finalisable on documented outcome + safety-netting rather than blocked waiting for a supply that must not happen.

---

### 5. Consultation model

The UTI pathway already runs 8 steps (patient → symptoms → red flags → scope → differentials → treatment → counselling → documentation). Additions this sprint:

- **Consent is now a clinical field**, not a legal checkbox off to the side. It is one of the protocol's eligibility criteria *and* one of its documentation requirements, so the decision stays `undecided` until it is recorded.
- Outcome, safety findings and handover are computed on every render in the right rail — nothing is hover-only.
- `ClinicalDisclaimer` is now in `ClinicalLayout`, always visible: the software does not diagnose or prescribe, does not assess registration/training/scope, and content needs pharmacist sign-off.

---

### 6. AI scribe

There is no LLM integration in the codebase today, so **no AI backend was faked** — the panel says plainly when drafting is not connected. What was built is the guardrail layer, enforced in code rather than in a prompt:

- `aiMayDraft()` permits **only narrative text**. Red-flag answers, eligibility, treatment selection, safety overrides, referral decisions, finalisation, diagnosis and prescription all raise an error.
- An unreviewed draft, or a "reviewed" draft with no named reviewer, **cannot enter the record**.
- `detectClinicalOverreach()` **warns** on diagnostic and prescriptive language instead of silently rewriting it.
- `AiAssistPanel`: pharmacist writes first → consent gate with an explicit **"Continue without AI"** path → draft always labelled unreviewed → **"Reviewed and confirmed by pharmacist"** + named reviewer required before "Accept into record".

---

### 7. Engineering quality

**Audit trail (medico-legal).** `appendAudit()` used `Math.random()` ids and swallowed quota failures with `catch { console.warn(...) }` while still returning the entry — a green UI over an empty record. Now: `crypto.randomUUID()`; `AuditWriteResult { status: persisted | queued | failed }`; retry once after trimming; a durable pending queue; quarantine (not overwrite) of unparseable storage; `subscribeAuditStatus()`; and a persistent, non-dismissable `AuditWriteWarning` banner (`role="alert"`, `aria-live`) with a Retry action. `useConsultAudit` returns the write outcome instead of `void`.

**Error handling.** `main.tsx` replaced the entire `#root` innerHTML on any unhandled rejection — one failed Supabase call destroyed an in-progress consultation. Handlers now log only. Every route gets `errorElement: <RouteError />` (previously the only error element rendered `<NotFound />`, so an exception looked like a 404).

**Performance.** All 30+ routes are now `lazy()` behind one Suspense boundary. Main chunk **2,726 kB → 381 kB** (gzip 790 kB → 123 kB). Largest route chunk is Claims at 477 kB, fetched only when opened.

**Honest public claims.** Removed "AHPRA Aligned", "AES-256 Encrypted", "Privacy Act Compliant", "reviewed by practising pharmacist prescribers", "Victoria-approved playbooks for UTI, shingles, OCP, skin conditions, and more" (only UTI is transcribed) and the invented "reduce admin by up to 50%". Replaced with claims the code can support.

---

### 8. Verification

```bash
npm run typecheck   # tsc --noEmit -p tsconfig.app.json → exit 0
npm run test        # 119 passed, 10 files, 0 failures
npm run lint        # 57 errors, 24 warnings
npm run build       # OK
npm run verify      # all four in sequence
npm run test:coverage
```

| | Baseline (`0f08c37`) | Now |
|---|---|---|
| Tests | 18 passing, 1 file erroring (`window is not defined`) | **119 passing, 10 files** |
| `tsc` | exit 0 (but `strict: false`) | exit 0 (unchanged) |
| Lint | 55 errors / 24 warnings | 57 errors / 24 warnings |
| Main bundle | 2,673.95 kB (gzip ~780 kB) | **381.03 kB (gzip 123.10 kB)** |

**New lint debt: 2 errors, both in files restored from previously-untracked work** (`ScribeRecorder.tsx`, `VoiceTranscriptionSettings.tsx`) committed in `c81d706` to preserve them. Every file this sprint created lints clean.

**Coverage baseline:** `src/clinical` (the safety-critical engine) is at **94.08% statements / 83.72% branches / 87.17% functions**. `src/lib` and `src/hooks` are near zero — that is the honest picture, not a target. Caveat: the v8 provider does not attribute coverage from suites that declare a per-file `node` environment in this version, so some `src/lib` files under-report.

---

### 9. Condition library reconciliation

22 conditions in the library. **1 has a canonical protocol.**

| Condition | VIC source exists? | Canonical protocol | Status |
|---|---|---|---|
| Uncomplicated UTI | Yes | ✅ `VIC_CCN_UTI_2026_01` | Transcribed, `source_verified`, needs clinical sign-off |
| Herpes zoster (shingles) | Yes | ❌ | PDF downloaded, not transcribed |
| OCP resupply | Yes (resupply + initiation) | ❌ | PDF downloaded, not transcribed |
| Acne | Yes | ❌ | PDF downloaded, not transcribed |
| Atopic dermatitis | Yes | ❌ | PDF downloaded, not transcribed |
| Impetigo | Yes | ❌ | PDF downloaded, not transcribed |
| Acute mild MSK pain | Yes | ❌ | Source registered, not transcribed |
| Plaque psoriasis | Yes | ❌ | Source registered, not transcribed |
| Hypertension, T2DM, asthma, COPD, dyslipidaemia, nausea, rhinitis, ear infections, GORD, wound, oral health, smoking cessation, travel medicine, weight management | **No VIC pharmacist protocol** | ❌ | Not part of the Victorian program — content is unverified and may be out of scope entirely |

PDFs already downloaded to `%TEMP%\vicprotocols\` for: acne, dermatitis, impetigo, ocp, shingles, uti. Transcribing the next five is a mechanical job of a few hours each, **not** a judgement call — but each must be reviewed by a pharmacist before `active`.

---

### 10. NEEDS CLINICAL REVIEW register

| Item | Why | Blocking? |
|---|---|---|
| UTI protocol | Transcribed from a real source, not pharmacist-signed-off | Blocks `active`; renders as reference mode |
| Queensland condition protocols | HTTP 403, not retrieved | Blocks all QLD clinical content |
| 21 of 22 conditions | No canonical protocol; content unverified | Blocks any claim of coverage |
| "Severe renal impairment" | Protocol states no numeric threshold. **None was invented.** | Informational |
| Pregnancy/breastfeeding/paediatric/renal primitives | Only age and pregnancy status implemented. No renal dosing, no weight-band doses — deliberately, because no citable source was retrieved | Blocks those features |
| Antimicrobial stewardship | Cefalexin exclusion and third-line trimethoprim rationale are in the protocol data; no separate AMS module | Not blocking |
| Landing-page compliance claims | Softened, not verified by a compliance reviewer | Not blocking |

---

### 11. Explicitly out of scope — not done

- **All security work.** No auth, RLS, MFA, key rotation, `.env` hardening, JWT verification, Twilio webhook crypto, service-role changes, installer signing. `.env` is still committed and still not gitignored. No `npm audit fix`.
- **TypeScript strict mode.** Deliberately deferred: turning on `strict` across 200+ files is a multi-day change and doing it partially in an overnight sprint would produce worse code than leaving it. Safety-critical modules are typed explicitly instead.
- `NewConsultation.tsx` (1,459 lines) decomposition.
- TanStack Query data layer (installed, still unused).
- SOAP notes, plain-English patient summary, GP letter beyond the ISBAR handover.
- Clinical timeline / Care Episodes, condition library filters, Full Scope of Practice single source of truth (`src/data/full-scope-by-state.csv` is still orphaned).
- Calculators with cited sources; structured antimicrobial stewardship module.
- Playwright E2E; accessibility sweep beyond the components touched.
- The 2.2 MB `chemistcare-logo-full.png` (needs an SVG original, not a build-config change).

---

### 12. Recommended next steps, in order

1. **Pharmacist review of the UTI protocol** → flip to `clinically_reviewed`. One line. Unblocks the flagship pathway from reference mode.
2. **Retrieve the Queensland guidance** (403 — try a different client, or request the PDF directly from Queensland Health) and map condition protocols.
3. **Transcribe the next five Victorian protocols** (shingles, OCP resupply, impetigo, acne, dermatitis). PDFs already downloaded.
4. **Decide what to do with the 14 conditions that have no Victorian protocol.** Either remove them from the prescribing pathway or mark them unmistakably as unscoped reference content. Right now they sit in the same library as a transcribed protocol.
5. **Turn on `strict` incrementally**, starting with `src/clinical/**` where types are already explicit.
6. **Then** the P3/P4 backlog: Query data layer, component decomposition, Playwright, accessibility sweep.

---

### 13. Git and PR status

**11 commits** on `prescriberos-clinical-modernisation`:

```
c81d706 chore: preserve untracked desktop/offline-STT work and audit report
6df24df feat(clinical): add canonical protocol architecture and reconcile UTI
3de4320 test(clinical): add golden cases and protocol regression guards
fba68be fix(reliability): isolate route errors and make audit writes fail loudly
b9b1289 feat(clinical): wire canonical safety engine into the UTI pathway
4ece6f3 feat(clinical): referral as a first-class outcome with ISBAR handover
9ff759f feat(scribe): AI guardrails, consent and pharmacist attestation
960ee89 docs(product): make public claims match what the code actually does
f9a92f9 perf(routing): code-split every route
3b80b51 chore: drop transient vitest config artifact and ignore it
53acbae build(tests): add coverage reporting and one-shot verify script
```

**Not pushed, no PR opened.** `git push` failed: the sandbox has no GitHub credentials (`could not read Username for 'https://github.com'`; `gh` CLI is not installed). Everything is committed locally and ready to push.

**Branch name deviation:** the brief asked for `workbuddy/prescriberos-clinical-modernisation`. Git in this environment silently fails to create nested ref directories under `.git/refs/heads/`, so the branch was created with a flat name. Rename before pushing if you want the slash: `git branch -m workbuddy/prescriberos-clinical-modernisation` once you are in an environment where nested refs persist.

**Do not auto-merge.** The UTI protocol is `source_verified`, not `active`, by design — merging without pharmacist review would put unreviewed clinical content in front of users.
