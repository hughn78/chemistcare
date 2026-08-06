// scribeService.cjs — ChemistCare-Offline local transcription service.
// Wraps the OpenWhispr-ported WhisperManager (whisper.cpp localhost sidecar)
// and DiarizationManager (sherpa-onnx speaker diarization) behind a single
// API consumed by the IPC layer. Audio never leaves the local machine.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const WhisperManager = require('./openwhispr/helpers/whisper');
const DiarizationManager = require('./openwhispr/helpers/diarization');
const { convertToWav } = require('./openwhispr/helpers/ffmpegUtils');
const { getSafeTempDir } = require('./openwhispr/helpers/safeTempDir');
const debugLogger = require('./openwhispr/helpers/debugLogger');

const DEFAULT_MODEL = 'small'; // ggml-small.bin
const DIARIZATION_PSEUDO_MODEL = 'diarization';

function formatTimestamp(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

class ScribeService {
  constructor() {
    this.whisper = new WhisperManager();
    this.diarizer = new DiarizationManager();
    this._progressSender = null;
  }

  /** Register a callback used to push download progress to the renderer. */
  setProgressSender(fn) {
    this._progressSender = typeof fn === 'function' ? fn : null;
  }

  _emitProgress(payload) {
    if (this._progressSender) {
      try {
        this._progressSender(payload);
      } catch (err) {
        debugLogger.warn('progress sender failed', { error: err.message });
      }
    }
  }

  // ─── Model management ────────────────────────────────────────────────

  async listModels() {
    const whisperModels = await this.whisper.listWhisperModels();
    const diarizationStatus = this._getDiarizationStatus();
    return {
      success: true,
      defaultModel: DEFAULT_MODEL,
      cacheDir: whisperModels.cache_dir,
      models: whisperModels.models,
      diarization: diarizationStatus,
    };
  }

  _getDiarizationStatus() {
    return {
      id: DIARIZATION_PSEUDO_MODEL,
      label: 'Speaker diarization (ONNX)',
      modelsDownloaded: this.diarizer.isModelDownloaded(),
      binaryAvailable: this.diarizer.getBinaryPath() !== null,
      available: this.diarizer.isAvailable(),
    };
  }

  async downloadModel(modelName) {
    if (modelName === DIARIZATION_PSEUDO_MODEL) {
      const result = await this.diarizer.downloadModels((p) =>
        this._emitProgress({ model: DIARIZATION_PSEUDO_MODEL, ...p })
      );
      return { ...result, diarization: this._getDiarizationStatus() };
    }
    this.whisper.validateModelName(modelName);
    return this.whisper.downloadWhisperModel(modelName, (p) => this._emitProgress(p));
  }

  async deleteModel(modelName) {
    if (modelName === DIARIZATION_PSEUDO_MODEL) {
      const result = await this.diarizer.deleteModels();
      return { ...result, diarization: this._getDiarizationStatus() };
    }
    this.whisper.validateModelName(modelName);
    return this.whisper.deleteWhisperModel(modelName);
  }

  async cancelDownload() {
    const whisperResult = await this.whisper.cancelDownload();
    const diarResult = await this.diarizer.cancelDownload();
    return {
      success: whisperResult.success || diarResult.success,
      whisper: whisperResult,
      diarization: diarResult,
    };
  }

  getStatus() {
    const server = this.whisper.getServerStatus();
    const ffmpeg = this.whisper.serverManager.getFFmpegPath();
    return {
      whisperServer: server,
      serverBinaryAvailable: this.whisper.serverManager.isAvailable(),
      ffmpegAvailable: !!ffmpeg,
      currentModel: this.whisper.currentServerModel,
      defaultModel: DEFAULT_MODEL,
      diarization: this._getDiarizationStatus(),
      offlineReady:
        server.available &&
        !!ffmpeg &&
        this._hasDownloadedModel(),
    };
  }

  _hasDownloadedModel() {
    try {
      const dir = this.whisper.getModelsDir();
      return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.startsWith('ggml-') && f.endsWith('.bin'));
    } catch {
      return false;
    }
  }

  // ─── Transcription ───────────────────────────────────────────────────

  /**
   * Transcribe an encoded audio buffer locally.
   * Pipeline: convert to 16kHz mono WAV → (optional) diarize into speaker
   * segments → transcribe each segment via the whisper.cpp sidecar → stitch
   * into a timestamped, speaker-labelled transcript.
   *
   * @param {Buffer} audioBuffer encoded audio (webm/mp4/wav)
   * @param {object} options { model?, diarize?, keepAudio? }
   */
  async transcribe(audioBuffer, options = {}) {
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer received');
    }
    if (!this.whisper.serverManager.isAvailable()) {
      const err = new Error('whisper-server binary not found');
      err.code = 'NO_ENGINE';
      throw err;
    }

    const model = options.model || DEFAULT_MODEL;
    const modelPath = this.whisper.getModelPath(model);
    if (!fs.existsSync(modelPath)) {
      const err = new Error(`Whisper model "${model}" not downloaded`);
      err.code = 'NO_MODEL';
      throw err;
    }

    // 1. Convert whatever the recorder produced to 16kHz mono WAV.
    const tempDir = getSafeTempDir();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputPath = path.join(tempDir, `cc-scribe-${runId}.input`);
    const wavPath = path.join(tempDir, `cc-scribe-${runId}.wav`);
    fs.writeFileSync(inputPath, audioBuffer);
    try {
      await convertToWav(inputPath, wavPath, { sampleRate: 16000, channels: 1 });
    } finally {
      try { fs.unlinkSync(inputPath); } catch {}
    }

    const wantDiarize = options.diarize !== false && this.diarizer.isAvailable();

    try {
      if (wantDiarize) {
        const diarSegments = await this.diarizer.diarize(wavPath, { numSpeakers: 2, threshold: 0.55 });
        if (diarSegments && diarSegments.length > 0) {
          const result = await this._transcribeDiarized(wavPath, diarSegments, model);
          this._maybeKeepAudio(wavPath, options.keepAudio);
          return result;
        }
        debugLogger.info('Diarization returned no segments; falling back to plain transcription');
      }

      // Plain whole-audio transcription.
      const wavBuffer = fs.readFileSync(wavPath);
      const result = await this.whisper.transcribeViaServer(wavBuffer, model, null, null, {});
      this._maybeKeepAudio(wavPath, options.keepAudio);
      return {
        success: result.success,
        text: result.text || '',
        segments: [],
        speakers: [],
        engine: 'local-whisper',
        diarized: false,
        message: result.message,
      };
    } finally {
      if (!options.keepAudio) {
        try { fs.unlinkSync(wavPath); } catch {}
      }
    }
  }

  /** Transcribe each diarized segment and stitch a labelled transcript. */
  async _transcribeDiarized(wavPath, diarSegments, model) {
    const wavBuf = fs.readFileSync(wavPath);
    const { sampleRate, dataOffset } = this._parseWavHeader(wavBuf);
    const bytesPerSample = 2;

    const speakerSet = [];
    for (const seg of diarSegments) {
      if (!speakerSet.includes(seg.speaker)) speakerSet.push(seg.speaker);
    }
    const speakerLabel = (sp) => `Speaker ${speakerSet.indexOf(sp) + 1}`;

    const segments = [];
    for (const seg of diarSegments) {
      const startByte = dataOffset + Math.floor(seg.start * sampleRate) * bytesPerSample;
      const endByte = Math.min(
        dataOffset + Math.floor(seg.end * sampleRate) * bytesPerSample,
        wavBuf.length
      );
      if (endByte - startByte < sampleRate * bytesPerSample * 0.3) continue; // <0.3s: skip

      const pcm = wavBuf.subarray(startByte, endByte);
      const segWav = Buffer.concat([
        this.diarizer._createWavHeader(pcm.length, sampleRate, 1),
        pcm,
      ]);

      let text = '';
      try {
        const r = await this.whisper.transcribeViaServer(segWav, model, null, null, {});
        text = (r.text || '').trim();
      } catch (err) {
        debugLogger.warn('segment transcription failed', {
          start: seg.start,
          end: seg.end,
          error: err.message,
        });
      }
      if (!text) continue;

      segments.push({
        start: seg.start,
        end: seg.end,
        speaker: seg.speaker,
        speakerLabel: speakerLabel(seg.speaker),
        text,
      });
    }

    // Merge consecutive same-speaker segments for readability.
    const merged = [];
    for (const seg of segments) {
      const last = merged[merged.length - 1];
      if (last && last.speakerLabel === seg.speakerLabel && seg.start - last.end < 2) {
        last.text += ' ' + seg.text;
        last.end = seg.end;
      } else {
        merged.push({ ...seg });
      }
    }

    const text = merged
      .map((s) => `[${formatTimestamp(s.start)}] ${s.speakerLabel}: ${s.text}`)
      .join('\n');

    return {
      success: merged.length > 0,
      text,
      segments: merged,
      speakers: speakerSet.map((_, i) => `Speaker ${i + 1}`),
      engine: 'local-whisper+diarization',
      diarized: true,
    };
  }

  _parseWavHeader(buf) {
    let offset = 12;
    let sampleRate = 16000;
    let dataOffset = 44;
    while (offset < buf.length - 8) {
      const chunkId = buf.toString('ascii', offset, offset + 4);
      const chunkSize = buf.readUInt32LE(offset + 4);
      if (chunkId === 'fmt ') {
        sampleRate = buf.readUInt32LE(offset + 12);
      } else if (chunkId === 'data') {
        dataOffset = offset + 8;
        break;
      }
      offset += 8 + chunkSize;
    }
    return { sampleRate, dataOffset };
  }

  /** Privacy: raw audio is discarded unless the user opted to keep it. */
  _maybeKeepAudio(wavPath, keepAudio) {
    if (!keepAudio) return;
    try {
      const keepDir = path.join(app.getPath('userData'), 'recordings');
      fs.mkdirSync(keepDir, { recursive: true });
      const dest = path.join(keepDir, path.basename(wavPath));
      fs.copyFileSync(wavPath, dest);
      debugLogger.info('recording retained per user setting', { dest });
    } catch (err) {
      debugLogger.warn('failed to retain recording', { error: err.message });
    }
  }

  async shutdown() {
    await Promise.allSettled([this.whisper.stopServer(), this.diarizer.shutdown()]);
  }
}

module.exports = { ScribeService, DEFAULT_MODEL, DIARIZATION_PSEUDO_MODEL };
