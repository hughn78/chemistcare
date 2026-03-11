import { useState, useRef, useCallback } from 'react';

export type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'denied'
  | 'unsupported';

interface UseAudioRecorderOptions {
  /** Max recording duration in ms (default 3000) */
  maxDurationMs?: number;
  /** Called with the recorded audio blob when recording ends */
  onRecordingComplete?: (blob: Blob) => void;
}

export function useAudioRecorder(opts: UseAudioRecorderOptions = {}) {
  const { maxDurationMs = 3000 } = opts;

  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async (): Promise<Blob | null> => {
    setError(null);
    setElapsed(0);

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('Your browser does not support audio recording.');
      return null;
    }

    setStatus('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setError('Microphone permission was denied. Please allow access and try again.');
      } else if (err.name === 'NotFoundError') {
        setStatus('failed');
        setError('No microphone found on this device.');
      } else {
        setStatus('failed');
        setError(err.message || 'Failed to access microphone.');
      }
      return null;
    }

    streamRef.current = stream;

    // Pick a supported MIME type — prefer webm/opus, fall back to mp4/aac (Safari), then wav
    const mimeOptions = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/wav',
    ];
    let mimeType = '';
    for (const m of mimeOptions) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
        mimeType = m;
        break;
      }
    }

    if (typeof MediaRecorder === 'undefined') {
      setStatus('unsupported');
      setError('MediaRecorder is not supported on this browser.');
      cleanup();
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanup();
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        chunksRef.current = [];
        resolve(blob);
      };

      recorder.onerror = () => {
        setStatus('failed');
        setError('Recording failed unexpectedly.');
        cleanup();
        resolve(null);
      };

      // Start
      recorder.start(100); // collect data every 100ms for reliability
      setStatus('recording');

      // Elapsed timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.min(Date.now() - startTime, maxDurationMs));
      }, 100);

      // Hard auto-stop at maxDurationMs
      stopTimerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, maxDurationMs);
    });
  }, [maxDurationMs, cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setStatus('idle');
    setElapsed(0);
    setError(null);
  }, [cleanup]);

  return {
    status,
    setStatus,
    elapsed,
    error,
    setError,
    startRecording,
    stopRecording,
    reset,
    maxDurationMs,
  };
}
