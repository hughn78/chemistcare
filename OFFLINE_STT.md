# ChemistCare-Offline — Offline Speech-to-Text Architecture

This document describes the local (on-device) transcription subsystem added on the
`offline-desktop` branch. Patient consultation audio **never leaves the local machine**.
After a one-time model download the app transcribes with **no internet connection**.

## Architecture

```
Renderer (React)                          Main process (Electron)
──────────────────────────────────────    ──────────────────────────────────────────
ScribeRecorder.tsx                        electron-main.cjs
  └─ src/lib/scribeBridge.ts  ──IPC──▶    electron/preload.cjs  (contextBridge, whitelisted API)
      window.chemistScribe                electron/ipc.cjs      (ipcMain handlers)
                                            └─ electron/scribeService.cjs
                                                 ├─ WhisperManager      (ported: openwhispr/helpers/whisper.js)
                                                 │    └─ WhisperServerManager → whisper.cpp "whisper-server"
                                                 │       localhost HTTP sidecar (127.0.0.1:8178–8199)
                                                 └─ DiarizationManager  (ported: openwhispr/helpers/diarization.js)
                                                      └─ sherpa-onnx-offline-speaker-diarization (ONNX)
```

### Pipeline

1. The renderer records audio (`MediaRecorder`, webm/opus) and sends the encoded
   buffer over IPC via `window.chemistScribe.transcribe(arrayBuffer, options)`.
2. The main process converts it to 16 kHz mono WAV with the bundled FFmpeg
   (`ffmpeg-static`).
3. If diarization is enabled and ready, `sherpa-onnx-offline-speaker-diarization`
   segments the WAV into speaker turns (segmentation model: pyannote 3.0 ONNX;
   embedding model: 3D-Speaker CampPlus; both run fully locally).
4. Each speaker segment is sliced from the WAV and POSTed to the local
   `whisper-server` sidecar for transcription.
5. Segments are stitched into a timestamped, labelled transcript:
   `[00:12] Pharmacist: …` / `[00:16] Patient: …` (labels are `Speaker 1/2`
   until renamed in the UI).
6. The raw WAV is deleted immediately unless the user enabled
   **Settings → Voice & transcription → Keep recordings** (then it is copied to
   `userData/recordings/`). Transcripts themselves continue to be stored via the
   existing Supabase/Postgres flow — unchanged.

### Fallback chain

`ScribeRecorder` tries the local engine first. If the desktop bridge is missing
(web/Android builds) or no local model is downloaded yet, it falls back to the
existing ElevenLabs Supabase Edge Function (`elevenlabs-transcribe`). The cloud
path is a fallback, not a replacement.

## Whisper models

| Settings entry                    | Registry name | File                      | Size     |
|-----------------------------------|---------------|---------------------------|----------|
| Whisper Base                      | `base`        | `ggml-base.bin`           | ~142 MB  |
| Whisper Small (**default**)       | `small`       | `ggml-small.bin`          | ~466 MB  |
| Whisper Large v3 Turbo            | `turbo`       | `ggml-large-v3-turbo.bin` | ~1.6 GB  |

- Downloaded from Hugging Face (`ggerganov/whisper.cpp`) on first use, with
  progress events pushed to the renderer (`onDownloadProgress`).
- Cached in `~/.cache/openwhispr/whisper-models/` (path inherited from the
  ported code; kept identical to ease upstream syncing).
- The installer ships **without** models; download happens on first launch from
  **Settings → Practice settings → Voice & transcription**.

## Sidecar binaries (build-time)

Unlike models, native binaries ship **inside** the installer as
`extraResources` (`resources/bin/`). They are fetched at build/CI time:

```bash
npm run stt:binaries       # current platform only
npm run stt:binaries:all   # every platform (for cross-building)
```

- `whisper-server-<platform>-<arch>` — pinned build from
  `OpenWhispr/whisper.cpp` release `0.0.8` (`WHISPER_CPP_VERSION` overrides).
  Script: `electron/openwhispr/scripts/download-whisper-cpp.js`.
- `sherpa-onnx-diarize-<platform>-<arch>` (+ shared libs) — from
  `k2-fsa/sherpa-onnx` v1.13.4. Script:
  `electron/openwhispr/scripts/download-diarization-binary.js` (trimmed from
  OpenWhispr's `download-sherpa-onnx.js`; the ASR websocket servers are not ported).
- Diarization **models** (pyannote segmentation, CampPlus embedding, Silero VAD)
  are downloaded at runtime to `~/.cache/openwhispr/diarization-models/` via the
  Settings UI (or ahead of time with
  `node electron/openwhispr/scripts/download-diarization-models.js`).

## Preload / IPC security

- `contextIsolation: true`, `nodeIntegration: false` — unchanged.
- `electron/preload.cjs` exposes only this whitelist on `window.chemistScribe`:
  `transcribe`, `listModels`, `downloadModel`, `deleteModel`, `cancelDownload`,
  `onDownloadProgress`, `getStatus`. No other IPC channels exist.
- Mic access: `session.setPermissionRequestHandler` grants `media` only;
  macOS declares `NSMicrophoneUsageDescription` (`extendInfo` in package.json)
  and the audio-input entitlement (`build/entitlements.mac.plist`).

## Ported OpenWhispr files

Ported from [OpenWhispr](https://github.com/OpenWhispr/openwhispr) **v1.8.1**
(MIT — see `electron/openwhispr/LICENSE-OpenWhispr` and `THIRD_PARTY_LICENSES.md`).

Kept byte-for-byte identical to upstream (to ease future syncing):

- `electron/openwhispr/helpers/whisperServer.js` — whisper.cpp sidecar lifecycle + HTTP transcribe
- `electron/openwhispr/helpers/whisper.js` — model registry/download + server transcription
- `electron/openwhispr/helpers/diarization.js` — ONNX diarization runner + merge helpers
- `electron/openwhispr/helpers/speakerEmbeddings.js`, `speakerMerge.js`,
  `speakerAssignmentPolicy.js`, `transcriptFormatter.js`, `transcriptText.js`
- `electron/openwhispr/helpers/downloadUtils.js`, `systemTar.js`, `safeTempDir.js`,
  `sidecarPidFile.js`, `transcriptionTimeout.js`, `whisperVadConfig.js`,
  `ffmpegUtils.js`, `abortError.js`, `debugLogger.js`, `modelDirUtils.js`
- `electron/openwhispr/utils/process.js`, `utils/serverUtils.js`
- `electron/openwhispr/workers/onnxWorker.js`, `helpers/onnxWorkerClient.js`
- `electron/openwhispr/models/modelRegistryData.json`, `constants/whisperVad.json`
- `electron/openwhispr/scripts/download-whisper-cpp.js`,
  `scripts/download-diarization-models.js`, `scripts/lib/download-utils.js`

Local adaptations (not upstream-identical):

- `electron/openwhispr/helpers/i18nMain.js` — English-only shim (i18n not ported)
- `electron/openwhispr/scripts/download-diarization-binary.js` — trimmed to the
  diarization binary only (no ASR websocket servers)

**Not ported** (per project scope): teams/billing/auth, notes editor, chat/agent
features, system-wide hotkey dictation, calendar/meeting detection, native key
listeners, Qdrant/vector search, i18n, OpenWhispr's React UI, parakeet/llama
engines, and all cloud STT providers except the pre-existing ElevenLabs fallback.

## Updating the ported files from upstream

1. Check the [OpenWhispr releases](https://github.com/OpenWhispr/openwhispr/releases)
   and pick a release tag (never track `main` blindly).
2. Diff the files listed above between the currently ported tag (`v1.8.1`) and
   the new tag:
   ```bash
   git clone https://github.com/OpenWhispr/openwhispr.git
   cd openwhispr && git fetch --tags
   git diff v1.8.1 vX.Y.Z -- src/helpers/whisperServer.js ...
   ```
3. Copy updated files over `electron/openwhispr/…`, preserving the two local
   adaptations (`i18nMain.js`, `download-diarization-binary.js`).
4. Check `WHISPER_CPP_VERSION` in `download-whisper-cpp.js` and
   `SHERPA_ONNX_VERSION` in `download-diarization-binary.js` for bumps, then
   re-run `npm run stt:binaries` and re-test an offline transcription.
5. Bump the ported-tag note in this file and in `THIRD_PARTY_LICENSES.md`.

## Verifying offline behaviour

1. `npm install && npm run stt:binaries && npm run electron:dev`
2. Settings → Voice & transcription → download **Whisper Small** (and the
   diarization bundle for speaker labels).
3. Disable Wi-Fi. Record a consultation in the Scribe page → transcript appears
   with an "On-device" badge. Two-speaker audio yields
   `[mm:ss] Speaker 1/2:` lines, renamable to Pharmacist / Patient.
4. `npm run electron:build` (macOS dmg+zip, arm64+x64) /
   `npm run electron:build:win` (NSIS + portable, x64).
