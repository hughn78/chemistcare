/**
 * scribeBridge — typed renderer-side access to the local offline STT service
 * exposed by electron/preload.cjs as window.chemistScribe.
 *
 * In the browser / Capacitor builds the bridge is absent; callers should use
 * isLocalScribeAvailable() and fall back to the cloud transcription path.
 */

export interface ScribeSegment {
  start: number;
  end: number;
  speaker: string;
  speakerLabel: string;
  text: string;
}

export interface LocalTranscribeResult {
  success: boolean;
  text?: string;
  segments?: ScribeSegment[];
  speakers?: string[];
  engine: string;
  diarized?: boolean;
  error?: string;
  code?: string;
  message?: string;
}

export interface WhisperModelInfo {
  model: string;
  downloaded: boolean;
  path?: string;
  size_bytes?: number;
  size_mb?: number;
  success: boolean;
  isDownloading: boolean;
  isInstalling: boolean;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface DiarizationStatus {
  id: 'diarization';
  label: string;
  modelsDownloaded: boolean;
  binaryAvailable: boolean;
  available: boolean;
}

export interface ScribeModelList {
  success: boolean;
  defaultModel: string;
  cacheDir: string;
  models: WhisperModelInfo[];
  diarization: DiarizationStatus;
}

export interface ScribeDownloadProgress {
  model: string;
  type: 'progress' | 'complete' | 'error';
  stage?: string;
  percentage: number;
  downloaded_bytes?: number;
  total_bytes?: number;
  error?: string;
}

export interface ScribeStatus {
  whisperServer: {
    available: boolean;
    running: boolean;
    port: number | null;
    modelName: string | null;
  };
  serverBinaryAvailable: boolean;
  ffmpegAvailable: boolean;
  currentModel: string | null;
  defaultModel: string;
  diarization: DiarizationStatus;
  offlineReady: boolean;
}

export interface ChemistScribeApi {
  transcribe(
    audioBuffer: ArrayBuffer,
    options?: { diarize?: boolean; keepAudio?: boolean; model?: string }
  ): Promise<LocalTranscribeResult>;
  listModels(): Promise<ScribeModelList>;
  downloadModel(modelName: string): Promise<{ success: boolean; error?: string; code?: string }>;
  deleteModel(modelName: string): Promise<{ success: boolean; error?: string }>;
  cancelDownload(): Promise<{ success: boolean }>;
  onDownloadProgress(callback: (event: ScribeDownloadProgress) => void): () => void;
  getStatus(): Promise<ScribeStatus>;
}

declare global {
  interface Window {
    chemistScribe?: ChemistScribeApi;
  }
}

export function getScribeBridge(): ChemistScribeApi | null {
  if (typeof window !== 'undefined' && window.chemistScribe) {
    return window.chemistScribe;
  }
  return null;
}

export function isLocalScribeAvailable(): boolean {
  return getScribeBridge() !== null;
}

const KEEP_AUDIO_KEY = 'chemistcare.scribe.keepAudio';
const DIARIZE_KEY = 'chemistcare.scribe.diarize';

export function getKeepAudioPreference(): boolean {
  try {
    return localStorage.getItem(KEEP_AUDIO_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setKeepAudioPreference(keep: boolean): void {
  try {
    localStorage.setItem(KEEP_AUDIO_KEY, String(keep));
  } catch {
    // storage unavailable
  }
}

export function getDiarizePreference(): boolean {
  try {
    return localStorage.getItem(DIARIZE_KEY) !== 'false'; // default on
  } catch {
    return true;
  }
}

export function setDiarizePreference(on: boolean): void {
  try {
    localStorage.setItem(DIARIZE_KEY, String(on));
  } catch {
    // storage unavailable
  }
}

/**
 * Transcribe via the local whisper.cpp sidecar. Throws when the bridge is
 * missing or the local engine fails, so callers can fall back to the cloud.
 */
export async function transcribeLocally(blob: Blob): Promise<LocalTranscribeResult> {
  const bridge = getScribeBridge();
  if (!bridge) {
    throw new Error('Local transcription bridge unavailable (not running in the desktop app)');
  }
  const audioBuffer = await blob.arrayBuffer();
  const result = await bridge.transcribe(audioBuffer, {
    diarize: getDiarizePreference(),
    keepAudio: getKeepAudioPreference(),
  });
  if (!result.success) {
    throw new Error(result.error || result.message || 'Local transcription failed');
  }
  return result;
}
