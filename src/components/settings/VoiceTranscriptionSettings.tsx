import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, Trash2, Loader2, WifiOff, CloudOff, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  getScribeBridge,
  getKeepAudioPreference,
  setKeepAudioPreference,
  getDiarizePreference,
  setDiarizePreference,
  ScribeModelList,
  ScribeStatus,
} from '@/lib/scribeBridge';

/** Models offered in Settings (registry has more; these are the supported set). */
const OFFERED_MODELS: { name: string; label: string; hint: string }[] = [
  { name: 'base', label: 'Whisper Base (ggml-base)', hint: '~142 MB · fastest, good accuracy' },
  { name: 'small', label: 'Whisper Small (ggml-small)', hint: '~466 MB · recommended default' },
  { name: 'turbo', label: 'Whisper Large v3 Turbo (ggml-large-v3-turbo)', hint: '~1.6 GB · best accuracy' },
];

const DEFAULT_MODEL = 'small';

export function VoiceTranscriptionSettings() {
  const bridge = getScribeBridge();
  const [modelList, setModelList] = useState<ScribeModelList | null>(null);
  const [status, setStatus] = useState<ScribeStatus | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busyModel, setBusyModel] = useState<string | null>(null);
  const [keepAudio, setKeepAudio] = useState(getKeepAudioPreference());
  const [diarize, setDiarize] = useState(getDiarizePreference());

  const refresh = useCallback(async () => {
    if (!bridge) return;
    try {
      const [list, st] = await Promise.all([bridge.listModels(), bridge.getStatus()]);
      setModelList(list);
      setStatus(st);
    } catch (err: any) {
      console.error('Failed to load voice settings:', err);
    }
  }, [bridge]);

  useEffect(() => {
    refresh();
    if (!bridge) return;
    const unsubscribe = bridge.onDownloadProgress((event) => {
      if (event.type === 'progress') {
        setProgress((prev) => ({ ...prev, [event.model]: event.percentage }));
      } else {
        setProgress((prev) => {
          const next = { ...prev };
          delete next[event.model];
          return next;
        });
        setBusyModel(null);
        refresh();
        if (event.type === 'error') {
          toast({ title: 'Download failed', description: event.error, variant: 'destructive' });
        }
      }
    });
    return unsubscribe;
  }, [bridge, refresh]);

  const handleDownload = async (modelName: string) => {
    if (!bridge) return;
    setBusyModel(modelName);
    const result = await bridge.downloadModel(modelName);
    if (!result.success) {
      setBusyModel(null);
      if (result.code !== 'DOWNLOAD_CANCELLED') {
        toast({ title: 'Download failed', description: result.error, variant: 'destructive' });
      }
    }
    await refresh();
  };

  const handleDelete = async (modelName: string) => {
    if (!bridge) return;
    await bridge.deleteModel(modelName);
    toast({ title: 'Model deleted', description: modelName });
    await refresh();
  };

  const modelInfo = (name: string) => modelList?.models.find((m) => m.model === name);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-primary" />
          Voice &amp; transcription
          {status?.offlineReady ? (
            <Badge variant="secondary" className="text-xs gap-1 ml-1">
              <CheckCircle2 className="h-3 w-3" /> Offline ready
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs gap-1 ml-1">
              <CloudOff className="h-3 w-3" /> Model download required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!bridge ? (
          <p className="text-sm text-muted-foreground">
            On-device transcription is available in the ChemistCare-Offline desktop app.
            This build uses the cloud transcription service.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Consultation audio is transcribed on this computer and never leaves the device.
              Models download once on first use; after that the app works fully offline.
            </p>

            {OFFERED_MODELS.map(({ name, label, hint }) => {
              const info = modelInfo(name);
              const pct = progress[name];
              const isBusy = busyModel === name;
              return (
                <div key={name} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {label}
                        {name === DEFAULT_MODEL && (
                          <Badge variant="outline" className="text-[10px]">default</Badge>
                        )}
                        {info?.downloaded && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> downloaded
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {info?.downloaded ? (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(name)} className="gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      ) : isBusy || pct !== undefined ? (
                        <Button size="sm" variant="outline" disabled className="gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {pct ?? 0}%
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleDownload(name)} className="gap-1.5">
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                      )}
                    </div>
                  </div>
                  {pct !== undefined && <Progress value={pct} className="h-1.5" />}
                </div>
              );
            })}

            {/* Diarization bundle */}
            <div className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    Speaker diarization (ONNX)
                    {modelList?.diarization.available ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> ready
                      </Badge>
                    ) : modelList?.diarization.binaryAvailable ? (
                      <Badge variant="outline" className="text-[10px]">models required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <XCircle className="h-3 w-3" /> binary missing
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ~40 MB · labels Pharmacist / Patient speakers in consultations
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {modelList?.diarization.modelsDownloaded ? (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete('diarization')} className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  ) : busyModel === 'diarization' || progress['diarization'] !== undefined ? (
                    <Button size="sm" variant="outline" disabled className="gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress['diarization'] ?? 0}%
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleDownload('diarization')} className="gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  )}
                </div>
              </div>
              {progress['diarization'] !== undefined && (
                <Progress value={progress['diarization']} className="h-1.5" />
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label htmlFor="diarize-toggle" className="text-sm font-medium">Speaker labels</Label>
                <p className="text-xs text-muted-foreground">
                  Separate Pharmacist / Patient speakers in consultation transcripts
                </p>
              </div>
              <Switch
                id="diarize-toggle"
                checked={diarize}
                onCheckedChange={(v) => {
                  setDiarize(v);
                  setDiarizePreference(v);
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="keep-audio-toggle" className="text-sm font-medium">Keep recordings</Label>
                <p className="text-xs text-muted-foreground">
                  Off by default — raw audio is discarded right after transcription
                </p>
              </div>
              <Switch
                id="keep-audio-toggle"
                checked={keepAudio}
                onCheckedChange={(v) => {
                  setKeepAudio(v);
                  setKeepAudioPreference(v);
                }}
              />
            </div>

            {modelList?.cacheDir && (
              <p className="text-[10px] text-muted-foreground break-all">
                Model cache: {modelList.cacheDir}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
