# Third-Party Licenses

ChemistCare-Offline includes code and models from the following third-party
projects.

## OpenWhispr (ported source code)

- **Project:** OpenWhispr — https://github.com/OpenWhispr/openwhispr
- **Version ported:** v1.8.1
- **License:** MIT — full text at `electron/openwhispr/LICENSE-OpenWhispr`
- **Used for:** whisper.cpp sidecar lifecycle, model registry and downloads,
  ONNX speaker diarization, transcript formatting, and the preload/IPC security
  pattern (see `OFFLINE_STT.md` for the exact file list).

```
MIT License

Copyright (c) 2024 OpenWhispr Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## whisper.cpp (runtime binary + models)

- **Project:** whisper.cpp — https://github.com/ggerganov/whisper.cpp
- **Binary:** pinned `OpenWhispr/whisper.cpp` build (release 0.0.8), downloaded
  at build time by `electron/openwhispr/scripts/download-whisper-cpp.js`.
- **License:** MIT — https://github.com/ggerganov/whisper.cpp/blob/master/LICENSE
- **Models:** `ggml-*.bin` Whisper models (OpenAI Whisper, MIT), downloaded at
  runtime from Hugging Face (`ggerganov/whisper.cpp`).

## sherpa-onnx (diarization binary)

- **Project:** sherpa-onnx — https://github.com/k2-fsa/sherpa-onnx
- **Version:** v1.13.4 (`sherpa-onnx-offline-speaker-diarization`), downloaded at
  build time by `electron/openwhispr/scripts/download-diarization-binary.js`.
- **License:** Apache-2.0 — https://github.com/k2-fsa/sherpa-onnx/blob/master/LICENSE

## Diarization models (downloaded at runtime)

- **pyannote-segmentation-3.0** (sherpa-onnx ONNX export) — pyannote.audio, MIT
  (https://github.com/pyannote/pyannote-audio)
- **3D-Speaker CampPlus speaker embedding** (`3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx`)
  — Apache-2.0 (https://github.com/modelscope/3D-Speaker)
- **Silero VAD** (`silero_vad.onnx`) — MIT (https://github.com/snakers4/silero-vad)

## FFmpeg (audio conversion)

- **Package:** `ffmpeg-static` (npm) — bundles FFmpeg, GPL/LGPL depending on build
  configuration; see https://github.com/eugeneware/ffmpeg-static — used only as a
  separate invoked subprocess for WAV conversion.
