import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, Copy, Check, Loader2, Square, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAudioRecorder, RecorderStatus } from '@/hooks/useAudioRecorder';

interface ScribeRecorderProps {
  compact?: boolean;
  onTranscriptChange?: (transcript: string) => void;
  className?: string;
}

const DEMO_FALLBACK = '[Demo] Patient presents with symptoms consistent with seasonal allergic rhinitis. No red flags identified. Recommends trial of intranasal corticosteroid.';

async function transcribeAudio(blob: Blob): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-transcribe`;
  const formData = new FormData();
  // Determine extension from MIME
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('aac') ? 'aac' : 'webm';
  formData.append('audio', blob, `recording.${ext}`);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Transcription failed (${resp.status}): ${errBody}`);
  }

  const data = await resp.json();
  return data.text || '';
}

const STATUS_LABELS: Record<RecorderStatus, string> = {
  idle: 'Ready to record',
  requesting: 'Requesting microphone…',
  recording: 'Recording…',
  processing: 'Processing transcription…',
  complete: 'Transcription complete',
  failed: 'Recording failed',
  denied: 'Microphone access denied',
  unsupported: 'Browser not supported',
};

export function ScribeRecorder({ compact = false, onTranscriptChange, className }: ScribeRecorderProps) {
  const [transcript, setTranscript] = useState('');
  const [copied, setCopied] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentType, setConsentType] = useState<'written' | 'verbal' | ''>('');

  const recorder = useAudioRecorder({ maxDurationMs: 3000 });

  const doRecord = useCallback(async () => {
    const blob = await recorder.startRecording();
    if (!blob) return;

    recorder.setStatus('processing');
    try {
      const text = await transcribeAudio(blob);
      if (text.trim()) {
        setTranscript(text.trim());
        onTranscriptChange?.(text.trim());
        recorder.setStatus('complete');
        toast({ title: 'Transcription ready', description: `${text.trim().split(' ').length} words captured` });
      } else {
        // No speech detected — use fallback
        setTranscript(DEMO_FALLBACK);
        onTranscriptChange?.(DEMO_FALLBACK);
        recorder.setStatus('complete');
        toast({ title: 'No speech detected', description: 'Demo note inserted instead.' });
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      // Graceful fallback
      setTranscript(DEMO_FALLBACK);
      onTranscriptChange?.(DEMO_FALLBACK);
      recorder.setStatus('complete');
      toast({ title: 'Transcription unavailable', description: 'Demo note inserted as fallback.', variant: 'destructive' });
    }
  }, [recorder, onTranscriptChange]);

  const handleStartClick = useCallback(() => {
    setConsentType('');
    setShowConsentDialog(true);
  }, []);

  const handleConsentConfirm = useCallback(() => {
    if (!consentType) return;
    setShowConsentDialog(false);
    doRecord();
  }, [consentType, doRecord]);

  const copyTranscript = useCallback(() => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied', description: 'Transcript copied to clipboard' });
  }, [transcript]);

  const progressPct = recorder.status === 'recording'
    ? Math.min((recorder.elapsed / recorder.maxDurationMs) * 100, 100)
    : recorder.status === 'processing' ? 100 : 0;

  const isWorking = recorder.status === 'requesting' || recorder.status === 'recording' || recorder.status === 'processing';
  const isError = recorder.status === 'failed' || recorder.status === 'denied' || recorder.status === 'unsupported';

  // Consent dialog — shared between compact and full mode
  const consentDialog = (
    <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Patient Consent Required
          </DialogTitle>
          <DialogDescription>
            Confirm that the patient has consented to have this consultation audio recorded and transcribed.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Label className="text-sm font-medium mb-3 block">How was consent obtained?</Label>
          <RadioGroup value={consentType} onValueChange={(v) => setConsentType(v as 'written' | 'verbal')}>
            <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="written" id="consent-written" />
              <Label htmlFor="consent-written" className="cursor-pointer flex-1">
                <span className="font-medium">Written consent</span>
                <span className="block text-xs text-muted-foreground">Signed consent form obtained</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-muted/50 transition-colors mt-2">
              <RadioGroupItem value="verbal" id="consent-verbal" />
              <Label htmlFor="consent-verbal" className="cursor-pointer flex-1">
                <span className="font-medium">Verbal consent</span>
                <span className="block text-xs text-muted-foreground">Patient verbally agreed to recording</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setShowConsentDialog(false)}>Cancel</Button>
          <Button onClick={handleConsentConfirm} disabled={!consentType} className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Confirm & Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── Compact mode (embedded in consultation) ───
  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        {consentDialog}
        <div className="flex items-center gap-2">
          {!isWorking ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStartClick}
              disabled={isWorking}
              className="gap-1.5"
            >
              <Mic className="h-3.5 w-3.5" />
              Record & Transcribe
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={recorder.stopRecording} disabled={recorder.status !== 'recording'} className="gap-1.5">
              {recorder.status === 'recording' ? <Square className="h-3 w-3" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {STATUS_LABELS[recorder.status]}
            </Button>
          )}
          {transcript && (
            <Button size="sm" variant="ghost" onClick={copyTranscript} className="gap-1 text-xs h-7">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </Button>
          )}
        </div>

        {recorder.status === 'recording' && (
          <Progress value={progressPct} className="h-1.5" />
        )}

        {isError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {recorder.error}
          </p>
        )}

        {transcript && (
          <div className="bg-muted/50 border rounded-md p-2 max-h-32 overflow-y-auto text-xs leading-relaxed">
            {transcript}
          </div>
        )}
      </div>
    );
  }

  // ─── Full card mode (Scribe page) ───
  return (
    <>
      {consentDialog}
      <Card className={cn('', className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            Clinical Scribe
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {STATUS_LABELS[recorder.status]}
            </Badge>
            {transcript && (
              <Button size="sm" variant="ghost" onClick={copyTranscript} className="gap-1.5 h-8">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-3">
            {!isWorking ? (
              <Button variant="destructive" onClick={handleStartClick} className="gap-2">
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
            ) : recorder.status === 'recording' ? (
              <Button variant="destructive" onClick={recorder.stopRecording} className="gap-2">
                <Square className="h-4 w-4" /> Stop Early
              </Button>
            ) : (
              <Button variant="outline" disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {STATUS_LABELS[recorder.status]}
              </Button>
            )}

            {recorder.status === 'complete' && (
              <Button variant="outline" onClick={recorder.reset} className="gap-2">
                Record Again
              </Button>
            )}
          </div>

          {/* Progress */}
          {recorder.status === 'recording' && (
            <div className="space-y-1">
              <Progress value={progressPct} className="h-2" />
              <p className="text-[10px] text-muted-foreground text-right">
                {Math.ceil((recorder.maxDurationMs - recorder.elapsed) / 1000)}s remaining
              </p>
            </div>
          )}

          {recorder.status === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending audio for transcription…
            </div>
          )}

          {/* Error display */}
          {isError && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {recorder.status === 'denied' ? 'Microphone Access Denied' : 
                   recorder.status === 'unsupported' ? 'Browser Not Supported' : 'Recording Failed'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{recorder.error}</p>
              </div>
            </div>
          )}

          {/* Transcript area */}
          <div className="border rounded-lg min-h-[200px] p-4">
            {!transcript && !isWorking && !isError ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-center">
                <MicOff className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Capture your session</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Press Start Recording to capture up to 3 seconds of audio
                </p>
              </div>
            ) : transcript ? (
              <div className="text-sm leading-relaxed">
                {transcript}
              </div>
            ) : null}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Recordings are limited to 3 seconds for this demo. Review transcriptions before clinical use.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
