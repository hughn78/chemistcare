// preload.cjs — ChemistCare-Offline
// Exposes a small whitelisted API (window.chemistScribe) to the renderer.
// contextIsolation stays true, nodeIntegration stays false. Pattern ported
// from OpenWhispr (MIT, see electron/openwhispr/LICENSE-OpenWhispr).
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE_CHANNELS = {
  transcribe: 'chemist-scribe:transcribe',
  listModels: 'chemist-scribe:list-models',
  downloadModel: 'chemist-scribe:download-model',
  deleteModel: 'chemist-scribe:delete-model',
  cancelDownload: 'chemist-scribe:cancel-download',
  getStatus: 'chemist-scribe:get-status',
};

const PROGRESS_CHANNEL = 'chemist-scribe:download-progress';

contextBridge.exposeInMainWorld('chemistScribe', {
  /**
   * Transcribe recorded audio locally.
   * @param {ArrayBuffer} audioBuffer  Encoded audio (webm/opus, mp4, or wav)
   * @param {object} [options] { diarize?: boolean, keepAudio?: boolean }
   * @returns {Promise<{success: boolean, text?: string, segments?: Array, speakers?: string[], engine: string, error?: string}>}
   */
  transcribe: (audioBuffer, options = {}) =>
    ipcRenderer.invoke(INVOKE_CHANNELS.transcribe, audioBuffer, options),

  /** List whisper models (+ diarization bundle) with download state. */
  listModels: () => ipcRenderer.invoke(INVOKE_CHANNELS.listModels),

  /** Download a whisper model by name, or the diarization model bundle ("diarization"). */
  downloadModel: (modelName) =>
    ipcRenderer.invoke(INVOKE_CHANNELS.downloadModel, modelName),

  /** Delete a downloaded whisper model, or the diarization bundle ("diarization"). */
  deleteModel: (modelName) =>
    ipcRenderer.invoke(INVOKE_CHANNELS.deleteModel, modelName),

  /** Cancel the in-flight model download, if any. */
  cancelDownload: () => ipcRenderer.invoke(INVOKE_CHANNELS.cancelDownload),

  /**
   * Subscribe to model download progress events.
   * @param {(event: object) => void} callback
   * @returns {() => void} unsubscribe
   */
  onDownloadProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(PROGRESS_CHANNEL, listener);
    return () => ipcRenderer.removeListener(PROGRESS_CHANNEL, listener);
  },

  /** Offline/engine status: server availability, running model, diarization readiness. */
  getStatus: () => ipcRenderer.invoke(INVOKE_CHANNELS.getStatus),
});
