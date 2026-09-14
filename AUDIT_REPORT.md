# ChemistCare PrescriberOS — Deep Dive Audit

**Repository:** `E:\AI\chemistcare` (origin: `https://github.com/hughn78/chemistcare.git`)
**Branch:** `offline-desktop` · **HEAD:** `0f08c37` (2026-05-21, "Added Care Episodes page")
**Audit date:** 12 September 2026
**Scope:** full repo — frontend, Supabase schema/RLS, edge functions, Electron/offline STT, CI/CD, dependencies, clinical logic
**Method:** static analysis, schema review, dependency audit, build/test execution. **No files were modified.**

---

## 1. Executive summary

ChemistCare PrescriberOS is an **Australian pharmacist-prescribing clinical workflow platform**. It is a genuinely ambitious, domain-rich product: 33k lines of TypeScript, a 41-table Postgres schema, 21 modelled clinical conditions, structured 8CPA service records, claim/billing rule engines, PBS lookup, PPA integration, patient SMS/email, triage, and — on this branch — a local-first Electron build with fully on-device speech-to-text (whisper.cpp + ONNX speaker diarization).

**The clinical domain layer is the strongest part of this codebase.** `safetyEngine`, `triageEngine`, `travelRiskEngine`, `conditionRegistry`, `protocolVersion`, and `consultStateMachine` show real modelling discipline. Someone who understands pharmacy built this.

**The application shell around it is prototype-grade, and the security posture is not safe for real patient data.** The defining finding is the gap between those two facts.

### The headline

> **This app handles identifiable patient health information, is connected to a live production Supabase project, and has no authentication of any kind.** There is no login page, no session gate, no protected routes. All 34 routes — including `/admin/settings`, `/prescribing-log`, `/episodes`, and `/messaging` — are reachable by anyone with the URL. Compounding this, the database RLS is enabled on all 41 tables but ~28 of them are effectively public: policies use `USING (true)` with no `TO` clause, which in Supabase means the **anonymous** key can read and write them.

Five findings are release-blocking. Everything else is a quality or maintainability issue.

### Severity scorecard

| Severity | Count | Summary |
|---|---|---|
| 🔴 **P0 Blocker** | 5 | No auth; anon-readable PHI; unauthenticated service-role proxy; unsigned Twilio webhook; `verify_jwt = false` on 7/9 functions |
| 🟠 **High** | 8 | `strict: false`; broken error boundary; PHI in plaintext `localStorage`; unsafe safety-engine matching; conflicting clinical dosing data; draft protocols live; silent audit failure |
| 🟡 **Medium** | 11 | react-query installed but unused; 2.67 MB bundle; 18 dead UI components; duplicate toast systems; no test coverage; orphaned legal-scope CSV |
| 🔵 **Low** | 7 | Port mismatch; `.env` committed; commit hygiene; unused deps; a11y label defects |

### Verdict

**Do not deploy to a real pharmacy or connect real patient data until the P0 items are closed.** The good news is that none of the P0s are architectural rewrites — they are a few days of focused work (see §9, Phase 1). The codebase is worth investing in; it does not need to be thrown away.

---

## 2. What the app does

### 2.1 Product

A clinical decision-support and documentation platform for **Australian pharmacist prescribers** operating under Structured Prescribing Arrangements. It covers the full consultation lifecycle:

1. **Triage / eligibility** — `PatientTriage`, `triageEngine` (age bands, symptom-duration rules, GP-referral logic).
2. **Condition selection** — `ConsultationPicker` over 21 registered conditions (`conditionRegistry`).
3. **Structured consultation** — two parallel engines:
   - **Generic engine** (`NewConsultation.tsx`, 1,459 lines) drives 20 conditions via `src/data/conditions.ts`.
   - **Template engine** (`UtiConsultation.tsx`, 885 lines) is the "gold standard" path, backed by typed `conditionTemplates/*` (UTI, GORD, rhinitis, acne, impetigo, ear infections, atopic dermatitis, herpes zoster, OCP, smoking cessation).
   - Plus `TravelConsultation` (983 lines) and `ProtocolConsultation`.
4. **Safety evaluation** — `safetyEngine` scores red flags, drug–drug interactions, pregnancy and allergy conflicts; hard blockers gate the "Continue"/prescribe action. Overrides are possible via `SafetyOverrideDialog` with a written reason.
5. **Documentation & output** — GP letters, patient education links, `SketchPad` (fabric.js) for body diagrams, PDF export via jsPDF.
6. **Billing** — 8CPA service records (13 tables), claim rule engine, claim batches, PPA integration.
7. **Follow-up** — SMS (Twilio), email queue (pgmq), calendar, booking flow, patient messaging.
8. **Scribe** — `ScribeRecorder` records consultation audio and transcribes it. On desktop this runs **fully on-device**; in web/Android it falls back to ElevenLabs cloud STT.

### 2.2 Deployment targets

The repo has grown four distinct delivery targets, each only partially finished:

| Target | Entry point | Status |
|---|---|---|
| **Web (cloud)** | Vite dev server → Supabase cloud | Functional, unsecured |
| **Web (local-first)** | `local:bootstrap` → Docker Supabase | Functional; **needs Docker + Supabase CLI — not truly "offline" in the air-gapped sense** |
| **Desktop (Electron)** | `electron-main.cjs` | Built; **entirely uncommitted (untracked)**; still requires Docker Supabase for data |
| **Android (Capacitor)** | `android/` | Shell only; no offline data layer |

### 2.3 Technical stack

React 18 · TypeScript 5.8 · Vite 5 · Tailwind 3 + shadcn/ui (51 vendored components) · Radix primitives · React Router 6 · Supabase (Postgres + Auth + Edge Functions + Storage) · TanStack Query (installed, unused) · Recharts · framer-motion · jsPDF · fabric.js · Electron 32 · Capacitor 8 · Vitest.

### 2.4 Size

| Metric | Value |
|---|---|
| Source LOC (`src/`) | **33,103** across 209 files |
| Electron LOC | 7,113 (incl. 27 MB vendored OpenWhispr port) |
| DB tables | 41 across 14 migrations |
| Edge functions | 9 |
| Routes | 34 |
| Dependencies | 63 prod + 25 dev |
| Test LOC | **272 (0.82% of src)** |
| Production bundle | **2.67 MB** single JS chunk; 7.2 MB total `dist` |

---

## 3. Architecture map

```
┌─ Renderer (React 18 + Vite) ────────────────────────────────────┐
│  App.tsx: 34 static routes, NO auth gate, NO lazy loading       │
│  Pages (33) ──> Supabase client (17 files, 98 .from() calls)    │
│  ├─ NewConsultation (generic engine, 20 conditions)             │
│  ├─ UtiConsultation (template engine, gold standard)            │
│  ├─ TravelConsultation / ProtocolConsultation                    │
│  └─ Patients (mock data — no backend!)                          │
│                                                                  │
│  Clinical layer  ── safetyEngine / triageEngine /               │
│                     travelRiskEngine / conditionRegistry        │
│  Persistence     ── localStorage (auditStore, useAutosave)      │
└─────────────────────────────────────────────────────────────────┘
        │                    │                       │
        ▼                    ▼                       ▼
┌─ Supabase ─────────┐ ┌─ Edge Functions ─┐ ┌─ Electron main ─────┐
│ 41 tables          │ │ 9 functions      │ │ contextIsolation ✓  │
│ RLS on, but        │ │ 7 × verify_jwt   │ │ nodeIntegration ✗ ✓ │
│ USING(true) on ~28 │ │     = false      │ │ whisper.cpp sidecar │
│ anon can read PHI  │ │ 1 × SERVICE_ROLE │ │ ONNX diarization    │
└────────────────────┘ └──────────────────┘ └─────────────────────┘
```

**Electron security is actually done well** — `contextIsolation: true`, `nodeIntegration: false`, a whitelisted `contextBridge` preload with an explicit channel allowlist, and a scoped microphone permission handler. This is the most security-conscious part of the repo, which makes the absence of app-level auth more glaring by contrast.

---

## 4. 🔴 P0 — Release blockers

### P0-1 · No authentication whatsoever

`src/App.tsx:43-84` defines 34 routes with no guard. Grep for `supabase.auth` across `src/` returns **2 hits**, both of which *consume* an assumed session rather than verify one:

- `src/hooks/useConsultAudit.ts:80` — `auth.getUser()` to fill an audit field
- `src/lib/clinicalApiService.ts:141` — `auth.getSession()` to attach a bearer token

There is no `onAuthStateChange`, no session context, no `useAuth` hook, no login page, no `<ProtectedRoute>`, no `Navigate` redirect on unauthenticated access. `/admin/settings`, `/prescribing-log`, `/episodes`, `/messaging`, `/integration-settings` are all open.

**Fix:** Supabase Auth (email + MFA, given AHPRA context), a session context, a `<RequireAuth>` layout wrapping all non-public routes, and `auth.uid()`-scoped RLS.

### P0-2 · PHI is readable and writable with the anonymous key

RLS is enabled on all 41 tables — the schema author was disciplined. But the policies neutralise it. The 13 `eight_cpa_*` tables all use this pattern, with **no `TO` clause** (which in Supabase means role `public`, i.e. `anon` **and** `authenticated`):

```sql
-- supabase/migrations/20260302063200_096e4a7b-....sql:64
CREATE POLICY "Allow all access to eight_cpa_patient_snapshots"
  ON public.eight_cpa_patient_snapshots FOR ALL USING (true) WITH CHECK (true);
```

Affected (all `FOR ALL USING (true)`, lines 32, 64, 77, 94, 118, 132, 159, 181, 197, 212, 224, 241, 256):
`eight_cpa_services`, `_patient_snapshots` (**name, DOB, address, Medicare/DVA number**), `_pharmacist_snapshots` (**AHPRA registration no.**), `_prescribers`, `_eligibility`, `_consent`, `_clinical_data` (**BP, BGL, allergies**), `_medication_items`, `_action_plan_items`, `_communication_logs`, `_follow_ups`, `_attachments`, `_claim_tracking`.

Additionally:
- `consultations` — `20260304033643_....sql:60` `CREATE POLICY "Users can read consultations" ... FOR SELECT USING (true);` (no `TO`). Migration `20260304115447` only fixed the write policies; **the read policy was left wide open**. Exposes `patient_first_name`, `patient_last_name`, `patient_dob`, `patient_pregnancy_status`, `patient_allergies`, `patient_medications`, `patient_comorbidities`, `clinical_notes`, `gp_letter_text`.
- `consult_audit_events` (`:63-64`) — the clinical audit trail is **anon-writable and anon-readable**, i.e. forgeable.
- Storage bucket `eight-cpa-attachments` (`:261-271`) — policies have no `TO` clause and no per-user path scoping (`storage.foldername(name))[1] = auth.uid()::text`), so anon can upload/read/delete consent-form PDFs.

**Fix:** add `TO authenticated` to every policy, replace `USING (true)` with ownership predicates (`created_by = auth.uid()` or a pharmacy/org membership join), scope storage paths per user, and make `consult_audit_events` insert-only for authenticated users with no UPDATE/DELETE.

### P0-3 · `clinical-api-proxy` — anonymous access to a service-role client

`supabase/config.toml:21-22` sets `verify_jwt = false`, and `supabase/functions/clinical-api-proxy/index.ts` performs **no auth check in code** — the only validation is `if (!action)` at line 590. It holds `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely, and proxies to 8 upstream APIs (PBS, NIH, MedlinePlus, RxNorm, openFDA, Open-Meteo, Nominatim). `params.query` is never length- or type-validated.

This is the single most dangerous endpoint in the repo: an unauthenticated caller drives a service-role client.

**Fix:** `verify_jwt = true`, or an explicit `getUser()` + role check at the top of the handler.

### P0-4 · `twilio-inbound` — unauthenticated webhook, no signature validation

`verify_jwt = false` in config, and there is **no `X-Twilio-Signature` HMAC validation anywhere** in `supabase/functions/twilio-inbound/index.ts`. It writes to `sms_messages` and mutates `patient_sms_consent` using an attacker-supplied `From` (line 17). Anyone who learns the URL can flood the SMS log or force-opt-out any patient number.

**Fix:** verify HMAC-SHA1 of `URL + sorted params` against `TWILIO_AUTH_TOKEN` (constant-time compare).

### P0-5 · `verify_jwt = false` is the default posture

`supabase/config.toml` disables JWT verification for 7 of 9 functions: `ppa-integration`, `elevenlabs-scribe-token`, `twilio-inbound`, `send-followup-sms`, `send-sms`, `process-email-queue`, `clinical-api-proxy`.

Three of these (`elevenlabs-scribe-token`, `send-followup-sms`, `send-sms`) do implement a manual `Bearer` + `getClaims()` check, which mitigates — but the default is wrong and one missed check becomes a breach. Note also `process-email-queue/index.ts:41` contains the comment *"Auth: verify_jwt = true in config.toml — Supabase gateway validates the service role JWT"*, which **contradicts the config and is false**.

All 9 functions also set `Access-Control-Allow-Origin: *`.

**Fix:** flip the default to `verify_jwt = true`; opt out only for genuine third-party webhooks with signature validation.

---

## 5. 🟠 High severity

### H-1 · TypeScript `strict` is off — for a clinical app
`tsconfig.app.json:16,25` — `"noImplicitAny": false`, `"strict": false`, plus `noUnusedLocals`/`noUnusedParameters` off. There are **41 `any` usages** (27 `as any`, 13 `: any`), concentrated in `EightCpaNewService.tsx` (8), `ClaimBatches.tsx` (5), `PrescribingLog.tsx` (4). Most concerning:

```ts
// src/pages/NewConsultation.tsx:650
(supabase.from('consultations') as any)
```

The finalise write — the most safety-critical mutation in the app — is fully type-escaped. `tsc --noEmit` currently passes, but **only because strict mode is off**; that clean result is misleading.

### H-2 · Error handling destroys the app
- `src/main.tsx:19-26` installs a global `window.onerror`/`unhandledrejection` handler that **replaces the entire `#root` innerHTML**. One uncaught async rejection anywhere — including in a half-filled clinical form — wipes the whole app and all in-progress data entry.
- `src/components/ErrorBoundary.tsx` exists but is mounted **once**, at `App.tsx:44`, and is *misused*: it is passed as `errorElement` wrapping `<NotFound />`. React Router's `errorElement` is already the error handler, so the practical effect is that route errors render a **404 page** rather than an error. No other route has error isolation.

### H-3 · PHI persisted in plaintext `localStorage`, with no logout
`src/hooks/useAutosave.ts` debounces 1.5 s into `localStorage`: patient name, DOB, medications, allergies, comorbidities. No encryption, no TTL, no clear-on-logout (there is no logout). `useAutosave.ts:25` has a `catch {}` that swallows quota-exceeded while the UI still reports a saved state. `src/lib/auditStore.ts` caps at 500 entries, is user-clearable, and generates IDs with `Math.random().toString(36)` rather than `crypto.randomUUID()`.

For an app marketed as "Privacy Act Compliant" and "AES-256", this is a direct contradiction.

### H-4 · Safety engine uses naive substring matching
`src/lib/safetyEngine.ts:20` matches medications bidirectionally by substring:

```ts
const matchesMed = m.includes(r) || r.includes(m);
```

Because medications are free-text, `"warfarin stopped 2019"` fires a hard interaction blocker. The engine holds only **10 DDI pairs, 4 pregnancy contraindications, and 4 allergy classes** (`src/data/safety-demo-data.ts`) — presented in the UI as a safety net. The score is a naive `100 - 40*blockers - 10*warnings` (line 99). There is no CYP450, QTc, or therapeutic-duplication logic.

### H-5 · Conflicting clinical dosing data across three sources
The same drug is specified three different ways:

| Source | Nitrofurantoin renal threshold | Trimethoprim line |
|---|---|---|
| `src/data/conditions.ts:44` | `eGFR <30` | — |
| `src/lib/conditionTemplates/uti.ts:76` | `eGFR < 45 mL/min` | **first** line (`:45`) |
| `src/types/protocols.ts:29` | `eGFR <30 mL/min` | **third** line |

Also `conditions.ts` defines 2 UTI treatment options vs `uti.ts` 3, so `conditionRegistry.ts:132` `treatmentOptionCount` under-reports. **This is a patient-safety issue, not a cosmetic one.**

### H-6 · Draft protocols are reachable in the product
9 of 10 condition templates carry `protocolStatus: 'draft'` with `protocolSourceLabel: '...(draft — pending clinical sign-off)'` (`gord.ts:205-207`, plus acne, rhinitis, impetigo, ear infections, atopic dermatitis, herpes zoster, OCP, smoking cessation) — yet `NewConsultation` serves all 21 conditions. Meanwhile `LandingPage.tsx:141` states: *"Our protocols are reviewed by practising pharmacist prescribers."*

Related bug — `NewConsultation.tsx:592`:
```ts
protocolStatus: registryEntry ? 'needs_review' : 'needs_review'
```
Both branches are identical.

### H-7 · No clinical disclaimer on the prescribing surfaces
Greps for `disclaimer|clinical judgement|decision support` return **0 hits** in `NewConsultation.tsx`, `ProtocolConsultation.tsx`, `PatientTriage.tsx`, `ConditionDetail.tsx`, `PrescribingLog.tsx`. Disclaimers exist only on `Calculators.tsx:187`, `TravelConsultation.tsx:975` (rendered **only on the `documentation` step**), and `ConsultationPicker.tsx:359` at `text-[10px] text-muted-foreground/80` — effectively invisible.

There is also **no privacy policy or terms page anywhere in `src/`** (grep returns nothing), while the landing page displays "Privacy Act Compliant", "APPs Aligned", and "AES-256" badges.

### H-8 · Audit trail can silently fail
`src/hooks/useConsultAudit.ts:79-104` wraps the Supabase audit insert in `try { } catch { console.warn(...) }` with no queue or retry. The medico-legal record can therefore exist **only in user-clearable `localStorage`**. Compounding: `SafetyOverrideDialog.tsx:24` allows overriding *any* hard blocker with `reason.trim().length >= 10 && discussed` — 10 characters and a self-ticked checkbox bypasses an anaphylaxis-class allergy alert. No second signatory, no non-overridable list.

---

## 6. 🟡 Medium — architecture and quality

### M-1 · TanStack Query installed, provider mounted, never used
`App.tsx:41` creates a `QueryClient`, `App.tsx:87` mounts `QueryClientProvider` — and grep for `useQuery|useMutation|useQueryClient` across `src/` returns **0**. All data access is ad-hoc `useEffect` + `useState`: **98 `.from()` calls across 17 files**. No caching, dedup, retry, or invalidation. This is the largest single architectural gap and the highest-leverage refactor.

### M-2 · No code splitting; 2.67 MB bundle
Zero `React.lazy`/`Suspense` in `src/`; no `manualChunks` in `vite.config.ts`. All 34 routes ship in one 2.67 MB chunk. `dist` is 7.2 MB, including two unoptimised PNGs (469 KB and **2.2 MB** — `src/assets/chemistcare-logo-full.png`, a logo!). Converting those to WebP/SVG and lazy-loading routes would cut first load dramatically.

### M-3 · 18 dead UI components with live dependencies
`src/components/ui/*` contains 51 files; **18 have no importer anywhere**: accordion, aspect-ratio, avatar, breadcrumb, carousel, chart, command, context-menu, drawer, dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, resizable, toggle-group. Their Radix/Recharts/cmdk/vaul/embla dependencies still ship.

### M-4 · Two toast systems and a duplicated module
`App.tsx:89-90` mounts both `<Toaster />` (Radix) and `<Sonner />` simultaneously. `src/components/ui/use-toast.ts` (3 lines) is a re-export shim of `src/hooks/use-toast.ts` (186 lines) — the same module forked in two places. `sonner.tsx:8` calls `useTheme` but no `ThemeProvider` is mounted.

### M-5 · Test coverage is 0.82%
272 lines of test for 33,103 lines of source. Only 3 test files; **none of the clinical engines (`safetyEngine`, `triageEngine`, `travelRiskEngine`, `protocolVersion`) has a single test**. No coverage threshold in `vitest.config.ts`.

**One test file is currently broken:**
```
FAIL src/test/uti-template.test.ts — ReferenceError: window is not defined
  ❯ src/test/setup.ts:3 — Object.defineProperty(window, "matchMedia", ...)
```
`uti-template.test.ts:1` declares `// @vitest-environment node` but the shared `setupFiles` assumes jsdom. `npm test` exits non-zero today. (18 tests do pass.)

### M-6 · Orphaned legal-scope data
`src/data/full-scope-by-state.csv` is imported **nowhere**, while the same jurisdiction scope content is duplicated inline in `src/pages/FullScopeOfPractice.tsx` (32 KB). This file defines the *legal* scope of practice — guaranteed divergence between two sources of truth.

### M-7 · `NewConsultation.tsx` is a 1,459-line god file
The generic engine driving 20 conditions is 1,459 lines (73 KB). `TravelConsultation.tsx` (983), `UtiConsultation.tsx` (885), and `FullScopeOfPractice.tsx` (481) are similar. The state machine (`consultStateMachine.ts`) is applied to **1 of 5 consultation paths**, so the "can't finalise from the wrong state" invariant protects only a fraction of consults.

### M-8 · Dev server binds to all interfaces
`vite.config.ts` sets `server: { host: "::" }` — the dev server is exposed on the LAN. Combined with P0-1 (no auth), any device on the network can reach the app and, through it, production PHI.

### M-9 · Migration hygiene
- **Missing FK constraints** on PHI references: `integration_audit_log.claim_case_id`/`.user_id`, `eight_cpa_attachments.uploaded_by_user_id`, `sms_messages.created_by`, `patient_education_links.consult_id`.
- **Unindexed foreign keys** on ~12 columns including all `eight_cpa_*` `service_id` children.
- **Missing `updated_at` triggers** on `email_send_state`, `integration_feature_flags`, `medicine_normalizations`.
- **Exception swallowing**: `DO $$ ... EXCEPTION WHEN OTHERS THEN NULL; END $$;` at `20260311124812_....sql:13-18, 36-41, 62-65, 96-111` — schema failures are silent.
- **Four `SECURITY DEFINER` functions** (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`, `:190-217`) correctly revoked from PUBLIC, but **none sets `search_path`**, unlike `update_updated_at_column()` which does.
- **Unfiltered backfill**: `20260430222102_....sql:14-20` rewrites every `consultations` row on deploy.

### M-10 · "Offline" claim is overstated
The package is named `chemistcare-offline` and the README leads with "offline capable", but `scripts/bootstrap-local.mjs:11` requires **Docker Desktop + Supabase CLI**, and `README.md:130` confirms "The desktop app still needs the local Supabase backend running on your Mac." Only the *transcription* is genuinely offline. On-device data would require replacing remote Supabase calls with a local sync layer — the README itself calls this "future phase".

### M-11 · Accessibility
Only **19 aria/role attributes across 112 component files**. Concrete defect: `src/components/ui/floating-input.tsx:36` renders a `<label>` with no `htmlFor` and a paired `<input>` with no `id` — the association is decorative, so screen readers announce an unlabeled input. Same defect in `FloatingSelectWrapper`. `tag-input.tsx` has zero aria attributes. Error state is conveyed by border colour alone, with no `aria-invalid`/`aria-describedby`.

---

## 7. 🔵 Low severity / hygiene

| # | Finding | Location |
|---|---|---|
| L-1 | Dev server port mismatch: `vite.config.ts` uses **8080**, but `local:dev`/`electron:dev` use **5173**, and the README says 5173 | `vite.config.ts`, `package.json:15,21` |
| L-2 | `.env` is **committed to git** (`git ls-files` confirms) and `.gitignore` has **no `.env` entry** — only `*.local`. Currently holds only an anon key (public by design), but any future real secret dropped in `.env` is auto-committed | `.env`, `.gitignore` |
| L-3 | Real anon key + project URL hardcoded as fallbacks in client code (valid to 2036) — cannot rotate without a code deploy | `src/integrations/supabase/client.ts:8,12`; `clinicalApiService.ts:140,148` |
| L-4 | `client.ts:12` fallback key is a malformed 22-char placeholder, not a valid JWT — client breaks silently if env is unset | `src/integrations/supabase/client.ts:12` |
| L-5 | Commit hygiene: 20 of the last 25 commits are named "Changes". No PR flow, no conventional commits, no `CONTRIBUTING` | git log |
| L-6 | **Entire Electron feature is untracked** — `electron/`, `build/`, `src/lib/scribeBridge.ts`, `src/components/settings/`, `OFFLINE_STT.md`, `THIRD_PARTY_LICENSES.md`, and `build-macos-installer.yml` are all uncommitted. Weeks of work exists only on one machine | `git status` |
| L-7 | Unused/unnecessary deps: `@elevenlabs/react` (0 imports in `src/`); `ffmpeg-static`, `onnxruntime-node`, `unzipper`, `unbzip2-stream` are Electron-only but sit in `dependencies` (they bloat web installs) | `package.json` |

---

## 8. Dependency & supply chain

`npm audit` reports **55 vulnerabilities (5 critical, 39 high, 9 moderate, 2 low)**; **25 in production dependencies alone (18 high, 2 critical)**.

Notable: `ws` (high — uninitialized memory disclosure, memory-exhaustion DoS), `yaml` (moderate — stack overflow), `canvas` via `@mapbox/node-pre-gyp` (critical/high chain).

CI/CD gaps:
- `npm install` rather than `npm ci` — `package-lock.json` is not enforced.
- GitHub Actions pinned to mutable major tags (`@v4`), not SHAs.
- Build artifacts are **unsigned**: `build-macos-installer.yml:54` sets `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` and no `CSC_LINK` secret is wired; Windows NSIS/portable is also unsigned → SmartScreen warnings and no provenance for a clinical installer.
- `npm run stt:binaries` downloads whisper.cpp and diarization binaries at build time with **no checksum or signature verification**.
- Windows workflow path filter omits `build/**` (macOS includes it) → macOS-only asset changes won't trigger a Windows rebuild.

*Positives:* no dangerous workflow triggers (`pull_request_target`, `issue_comment`), no secrets in CI, no hardcoded `sk-`/`AKIA`/`ghp_` keys anywhere, and all backend secrets are read via `Deno.env.get()` with no hardcoded fallback.

---

## 9. Remediation roadmap

### Phase 1 — Make it safe to hold patient data (≈1–2 weeks) 🚨

1. **Add authentication.** Supabase Auth with email + MFA; session context; `<RequireAuth>` wrapping all routes except `/`, `/book/:slug`, `/conditions`.
2. **Rewrite RLS policies.** Add `TO authenticated` to all; replace `USING (true)` with `auth.uid()`-ownership or org-membership predicates; scope the storage bucket by user path; make `consult_audit_events` insert-only.
3. **Fix the edges.** `verify_jwt = true` by default; add an explicit auth check to `clinical-api-proxy`; add Twilio HMAC signature validation; delete the false comment in `process-email-queue:41`.
4. **Rotate and un-commit.** `git rm --cached .env`; add `.env` to `.gitignore`; move hardcoded keys to env with no fallback; rotate the anon key.
5. **Add a visible clinical disclaimer** to every consultation and prescribing surface, plus a privacy policy and terms page.

### Phase 2 — Make it correct (≈2–3 weeks)

6. **Reconcile clinical data.** Single source of truth for dosing (migrate `conditions.ts` → typed `conditionTemplates/*`); resolve the three conflicting nitrofurantoin thresholds and the trimethoprim line ordering. Add a clinical-reviewer sign-off gate before any template leaves `draft`.
7. **Harden the safety engine.** Replace substring matching with a coded drug dictionary (RxNorm/AMT IDs); add CYP450/QTc/duplicate-class logic; add **paediatric weight-based dosing** and **breastfeeding** branches (currently entirely absent).
8. **Make the audit trail durable.** Server-side insert with retry/queue; remove the localStorage-only path; `crypto.randomUUID()`; require a second signatory or non-overridable list for hard-blocker overrides.
9. **Enable TypeScript strict mode** and regenerate Supabase types to eliminate the 41 `any` usages — start with `NewConsultation.tsx:650`.
10. **Fix error isolation.** Real top-level `ErrorBoundary` per route; stop destroying `#root` on unhandled rejections.

### Phase 3 — Make it maintainable (≈3–4 weeks)

11. **Introduce a data layer.** Repository modules over TanStack Query; collapse 98 scattered `.from()` calls; get caching, retry, and invalidation for free.
12. **Fix the test suite**, then build it out: unit-test all four clinical engines and the consult state machine; add a coverage threshold (start at 40%, ratchet up); add Playwright smoke tests for the UTI happy path and the safety-blocker path.
13. **Split the bundle.** `React.lazy` per route, `manualChunks` for vendor code, convert the 2.2 MB PNG to SVG/WebP.
14. **Delete dead weight.** 18 unused UI components and their Radix deps; one toast system; duplicate `use-toast`; the orphaned CSV (or make `FullScopeOfPractice` consume it).
15. **Decompose the god files.** Extract `NewConsultation.tsx` into a step-driven shell; extend `consultStateMachine` to all 5 consult paths.
16. **Fix a11y.** Label/input association in `floating-input.tsx` and `FloatingSelectWrapper`; `aria-invalid`/`aria-describedby` on error states.

### Phase 4 — Finish what was started (ongoing)

17. **Commit the Electron work** — it is currently untracked and exists on one machine only.
18. **Decide the target matrix.** Four half-finished targets (cloud web, local web, Electron, Android) is too many. Recommend: **Electron + local Supabase as the primary pharmacy-floor target**, web as secondary, Android on hold.
19. **Be honest about "offline."** Either build the local sync layer that makes the claim true, or correct the naming and README.
20. **Dependency hygiene.** `npm audit fix`, `npm ci` in CI, SHA-pin actions, code-sign both installers, checksum-verify downloaded STT binaries.
21. **Repo hygiene.** Conventional commits, PR flow, `CONTRIBUTING.md`, branch protection on `main`.

---

## 10. What's genuinely good

Worth naming, because the report is otherwise negative:

- **The clinical domain model is strong.** `consultStateMachine.ts` (clean `draft → validated → submitting → finalised` transition table), `protocolVersion.ts` (versioned protocol snapshots captured at consult time — exactly right for medico-legal defence), `conditionRegistry.ts`, and the typed `conditionTemplates/*` contract are well-designed. The UTI pathway is a genuinely good piece of clinical software.
- **Electron security is done properly.** `contextIsolation: true`, `nodeIntegration: false`, a whitelisted `contextBridge` API with an explicit channel allowlist, and a scoped microphone permission handler — plus a properly attributed MIT port of OpenWhispr with `THIRD_PARTY_LICENSES.md`.
- **RLS was enabled on every single table.** The author clearly understood the requirement; the failure is in policy *content*, not intent. That is a much easier fix than retrofitting RLS.
- **On-device transcription is real.** whisper.cpp sidecar + ONNX diarization with no audio leaving the machine is a meaningful privacy win, and the fallback chain (local → cloud) is thoughtfully designed.
- **No destructive migration history.** No `DROP TABLE`, no dropped columns, no disabled triggers across 14 migrations.
- **`tsc` passes and 18 tests pass** — there is a working baseline to build on.

---

## 11. Final assessment

| Dimension | Grade | Note |
|---|---|---|
| Clinical domain modelling | **B+** | Genuinely good; UTI path is production-quality |
| Security | **F** | No auth + anon-readable PHI; not deployable |
| Clinical safety & governance | **D** | Conflicting dosing data, draft protocols live, weak override, no disclaimer |
| Architecture | **C−** | No data layer, 2.67 MB bundle, god files; but recoverable |
| Code quality | **C** | `strict: false`, 41 `any`, 0.82% test coverage |
| Build & ops | **C** | Working multi-target builds, but unsigned and uncommitted |
| Documentation | **B** | README and `OFFLINE_STT.md` are genuinely good; code comments are informative |

**The bottom line:** this is a well-conceived clinical product built on a prototype-grade application shell, currently connected to a live database with real (or soon-to-be real) patient data and no access control. The clinical thinking deserves the engineering rigour that the rest of the stack lacks. Phase 1 is roughly two weeks of work and converts this from "must not deploy" to "safe to pilot". Phases 2–3 are what make it a product a pharmacy can rely on.

---

*Audit performed 12 September 2026. No files were modified.*
