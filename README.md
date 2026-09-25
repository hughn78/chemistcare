# ChemistCare PrescriberOS

Clinical prescribing and pharmacy workflow app.

## Protocol corpus (Sep 2026 snapshot)

`src/data/protocol-corpus/` bundles the OCR extraction of **all 113 Australian
pharmacist prescribing / expanded-scope protocols** (8 jurisdictions, current as
at 25 Sep 2026) as immutable JSON with per-item provenance (pdf sha256, page,
section heading) and extraction confidence.

- `manifest.json` — generated index: classification (condition × state × doc
  type), counts, hashes. Regenerate with `python3 scripts/build_manifest.py`
  (script lives beside the source corpus at
  `~/Documents/pharmacy/ocr-2026-09/build_manifest.py`).
- `src/data/protocol-corpus/index.ts` — loader: condition→jurisdiction lookups,
  full-text search, structured red-flag evaluation (`evaluateStructuredRule`).
- `src/components/protocols/ProtocolPanel.tsx` — consultation right-rail
  decision support (eligibility, live red flags, suggested treatments —
  copy-only, never auto-prescribed) used by `NewConsultation` and
  `UtiConsultation`.
- `/protocol-corpus` route — in-app reference browser for all documents.
- Protocol stamps: finalised consultations record the exact corpus document
  (file, instrument version, sha256) in `finalised_note_protocol_snapshot`.

To refresh the corpus: replace the JSON files in `protocol-corpus/protocols/`,
re-run the manifest script, bump `CORPUS_AS_AT`, and record the instrument
version changes in the commit message.

## Local-first PC mode (offline capable)

You can run this app entirely on a local Windows PC without relying on public internet services at runtime.

### Architecture for local mode
- **Frontend:** Vite React app (localhost)
- **Backend/Data/Auth:** local Supabase stack in Docker (localhost)
- **Data location:** your PC (local Postgres container)

> Note: first-time setup may require internet to install dependencies and pull Docker images. After setup, day-to-day use can run on local network/offline.

---

## 1) Prerequisites (Windows or macOS)

1. Install **Node.js 20+**
2. Install **Docker Desktop** and ensure it is running
3. Install **Supabase CLI**
   - Docs: https://supabase.com/docs/guides/cli
   - macOS Homebrew: `brew install supabase/tap/supabase`

---

## 2) Setup

```bash
npm install
```

Bootstrap local Supabase + local env file:

```bash
npm run local:bootstrap
```

This command will:
- start local Supabase containers
- read local API/anon key from `supabase status -o env`
- generate `.env.local` with local values

---

## 3) Run locally

```bash
npm run local:dev
```

Open:
- App: http://localhost:5173

---

## 4) Stop local backend

```bash
supabase stop
```

---

## 5) Reset local DB (if needed)

```bash
supabase db reset
```

This reapplies migrations from `supabase/migrations`.

---

## 6) Existing cloud mode

If you want to use hosted Supabase again, remove/rename `.env.local` and use `.env` cloud variables.

---

## Scripts

- `npm run dev` — normal dev mode
- `npm run local:bootstrap` — prepare local/offline mode env + local Supabase
- `npm run local:dev` — run app for LAN/local PC access
- `npm run build` — production build
- `npm run test` — run tests

---

## Notes for robust offline operations

For pharmacy floor reliability:
- Keep Docker Desktop set to auto-start on login
- Keep periodic local backups (`supabase db dump`)
- Use UPS for host PC to reduce corruption risk
- Plan a sync/export workflow for when internet is available (future enhancement)

### macOS one-click launcher

You can also run:
- `scripts/mac-start.command` (starts local backend + app)
- `scripts/mac-stop.command` (stops local backend)

Tip: move `mac-start.command` to your Desktop for one-click launch.

## macOS packaged app (.app/.dmg)

You can package ChemistCare as a normal Mac app.

### Build installer

```bash
npm install
npm run local:bootstrap
npm run electron:build
```

Output will be in `dist_electron/` (DMG + ZIP).

### Run desktop app in dev mode

```bash
npm run electron:dev
```

### Important runtime note

The desktop app still needs the local Supabase backend running on your Mac.
Use:

```bash
npm run mac:start
```

Or at minimum run `npm run local:bootstrap` once and keep Docker/Supabase local stack running.

## Android app version (Capacitor)

An Android native shell has been added using Capacitor.

### Included
- `capacitor.config.ts`
- `android/` native project

### Build/run workflow

```bash
npm install
npm run android:sync
npm run android:open
```

Then in Android Studio:
1. Let Gradle sync
2. Connect Android device or start emulator
3. Run app

### Useful scripts
- `npm run android:sync` — builds web app and syncs assets/plugins to Android
- `npm run android:open` — opens Android Studio project
- `npm run android:run` — attempts CLI run on connected device/emulator

### Notes
- This packages the app as a native Android app shell.
- If your data backend is remote Supabase, internet is still needed for backend calls.
- Full offline-on-phone mode would require replacing remote Supabase calls with an on-device/local-sync data layer (future phase).

## Windows 11 all-in-one installer (.exe)

### Option A (recommended): GitHub Actions build (no local Windows setup needed)

A workflow is included at:
- `.github/workflows/build-windows-installer.yml`

How to use:
1. Push to `main` (or trigger manually from Actions tab)
2. Open GitHub → **Actions** → **Build Windows Installer**
3. Download artifact: `chemistcare-windows-installer`
4. Distribute the generated `.exe` installer

### Option B: Build directly on Windows

On a Windows 11 machine:

```bash
npm install
npm run electron:build:win
```

Installer output:
- `dist/ChemistCare-PrescriberOS-<version>-Setup-x64.exe`
- `dist/ChemistCare-PrescriberOS-<version>-Setup-x64-portable.exe`

### Runtime prerequisites for local-first mode

If you want full local backend (no cloud dependency), target PCs still need:
- Docker Desktop
- Supabase CLI

Then run local backend bootstrap once using project scripts.
