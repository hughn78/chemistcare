const { app, BrowserWindow, session, systemPreferences } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

let scribeService = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'ChemistCare-Offline',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'electron', 'preload.cjs'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

/**
 * Microphone access: approve audio capture for our own window only.
 * On macOS the OS-level prompt is driven by NSMicrophoneUsageDescription
 * (see build/entitlements.mac.plist and the extendInfo in package.json).
 */
function setupMicrophonePermissions() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');
}

async function ensureMacMicrophoneAccess() {
  if (process.platform !== 'darwin') return;
  try {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status !== 'granted') {
      await systemPreferences.askForMediaAccess('microphone');
    }
  } catch (err) {
    console.warn('macOS microphone access request failed:', err.message);
  }
}

app.whenReady().then(async () => {
  setupMicrophonePermissions();
  await ensureMacMicrophoneAccess();

  // Local STT service (whisper.cpp sidecar + ONNX diarization).
  const { ScribeService } = require('./electron/scribeService.cjs');
  const { registerScribeIpc } = require('./electron/ipc.cjs');
  scribeService = new ScribeService();
  registerScribeIpc(scribeService);

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async () => {
  if (scribeService) {
    try {
      await scribeService.shutdown();
    } catch {
      // best effort — app is exiting
    }
    scribeService = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
