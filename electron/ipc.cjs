// ipc.cjs — ChemistCare-Offline IPC handlers for the local scribe service.
// Every channel here is mirrored by the whitelisted preload API in preload.cjs.
const { ipcMain, BrowserWindow } = require('electron');

const CHANNELS = {
  transcribe: 'chemist-scribe:transcribe',
  listModels: 'chemist-scribe:list-models',
  downloadModel: 'chemist-scribe:download-model',
  deleteModel: 'chemist-scribe:delete-model',
  cancelDownload: 'chemist-scribe:cancel-download',
  getStatus: 'chemist-scribe:get-status',
  progress: 'chemist-scribe:download-progress',
};

function broadcastProgress(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send(CHANNELS.progress, payload);
    } catch {
      // window may be mid-teardown
    }
  }
}

/**
 * @param {import('./scribeService.cjs').ScribeService} service
 */
function registerScribeIpc(service) {
  service.setProgressSender(broadcastProgress);

  ipcMain.handle(CHANNELS.transcribe, async (_event, audioBuffer, options = {}) => {
    const buffer = Buffer.isBuffer(audioBuffer)
      ? audioBuffer
      : Buffer.from(audioBuffer || []);
    const safeOptions = {
      model: typeof options.model === 'string' ? options.model : undefined,
      diarize: options.diarize !== false,
      keepAudio: options.keepAudio === true,
    };
    try {
      return await service.transcribe(buffer, safeOptions);
    } catch (err) {
      // Structured failure lets the renderer fall back to the cloud path.
      return { success: false, engine: 'local-whisper', error: err.message, code: err.code };
    }
  });

  ipcMain.handle(CHANNELS.listModels, () => service.listModels());

  ipcMain.handle(CHANNELS.downloadModel, async (_event, modelName) => {
    if (typeof modelName !== 'string' || !modelName) {
      return { success: false, error: 'Invalid model name' };
    }
    try {
      return await service.downloadModel(modelName);
    } catch (err) {
      return { success: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle(CHANNELS.deleteModel, async (_event, modelName) => {
    if (typeof modelName !== 'string' || !modelName) {
      return { success: false, error: 'Invalid model name' };
    }
    try {
      return await service.deleteModel(modelName);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(CHANNELS.cancelDownload, () => service.cancelDownload());

  ipcMain.handle(CHANNELS.getStatus, () => service.getStatus());
}

module.exports = { registerScribeIpc, CHANNELS };
