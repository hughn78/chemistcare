/**
 * IntegrationDashboard — Admin panel for managing external API integrations.
 * Shows feature flags, cache health, sync status, API usage logs.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw, Database, Activity, CheckCircle, XCircle,
  Clock, AlertTriangle, BarChart3, Zap, Globe, Pill, BookOpen, Shield,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FeatureFlag {
  id: string;
  feature_key: string;
  enabled: boolean;
  description: string;
}

interface SyncRun {
  id: string;
  provider: string;
  status: string;
  records_processed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface ApiLogSummary {
  provider: string;
  total_calls: number;
  errors: number;
  cache_hits: number;
  avg_response_ms: number;
}

const providerIcons: Record<string, React.ReactNode> = {
  pbs: <Pill className="h-3.5 w-3.5" />,
  nih: <Database className="h-3.5 w-3.5" />,
  medlineplus_connect: <BookOpen className="h-3.5 w-3.5" />,
  medlineplus_web: <BookOpen className="h-3.5 w-3.5" />,
  rxnorm: <Zap className="h-3.5 w-3.5" />,
  rxclass: <Zap className="h-3.5 w-3.5" />,
  openfda: <Shield className="h-3.5 w-3.5" />,
  open_meteo: <Globe className="h-3.5 w-3.5" />,
  nominatim: <Globe className="h-3.5 w-3.5" />,
};

export function IntegrationDashboard() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [syncs, setSyncs] = useState<SyncRun[]>([]);
  const [logSummary, setLogSummary] = useState<ApiLogSummary[]>([]);
  const [cacheCount, setCacheCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch feature flags
      const { data: flagData } = await supabase
        .from('integration_feature_flags')
        .select('*')
        .order('feature_key');
      setFlags((flagData as FeatureFlag[]) || []);

      // Fetch recent sync runs
      const { data: syncData } = await supabase
        .from('integration_sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      setSyncs((syncData as SyncRun[]) || []);

      // Fetch API log summary (aggregate by provider — last 24h)
      const { data: logData } = await supabase
        .from('external_api_logs')
        .select('provider, status_code, response_time_ms, cache_hit')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString());

      if (logData) {
        const grouped: Record<string, { total: number; errors: number; cacheHits: number; totalMs: number }> = {};
        for (const log of logData) {
          const p = log.provider;
          if (!grouped[p]) grouped[p] = { total: 0, errors: 0, cacheHits: 0, totalMs: 0 };
          grouped[p].total++;
          if (!log.status_code || log.status_code >= 400) grouped[p].errors++;
          if (log.cache_hit) grouped[p].cacheHits++;
          grouped[p].totalMs += log.response_time_ms || 0;
        }
        setLogSummary(
          Object.entries(grouped).map(([provider, stats]) => ({
            provider,
            total_calls: stats.total,
            errors: stats.errors,
            cache_hits: stats.cacheHits,
            avg_response_ms: stats.total > 0 ? Math.round(stats.totalMs / stats.total) : 0,
          }))
        );
      }

      // Cache count
      const { count } = await supabase
        .from('external_api_cache')
        .select('id', { count: 'exact', head: true });
      setCacheCount(count || 0);
    } catch {
      toast.error('Failed to load integration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleFlag = async (flag: FeatureFlag) => {
    const newVal = !flag.enabled;
    await supabase
      .from('integration_feature_flags')
      .update({ enabled: newVal, updated_at: new Date().toISOString() })
      .eq('id', flag.id);
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: newVal } : f));
    toast.success(`${flag.feature_key} ${newVal ? 'enabled' : 'disabled'}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Feature Flags */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Integration Feature Flags</CardTitle>
              <CardDescription className="text-xs">Enable or disable external API integrations</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {flags.map((flag) => (
            <div key={flag.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {providerIcons[flag.feature_key] || <Zap className="h-3.5 w-3.5" />}
                <div>
                  <Label className="text-sm font-medium">{flag.feature_key}</Label>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                </div>
              </div>
              <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cache Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Cache Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <span className="text-2xl font-bold">{cacheCount}</span>
              <p className="text-xs text-muted-foreground">Cached entries</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="flex-1 text-xs text-muted-foreground">
              External API responses are cached with TTL to reduce upstream load and improve response times.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Usage (24h) */}
      {logSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> API Usage (Last 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Cache Hits</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Avg ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logSummary.map((s) => (
                  <TableRow key={s.provider}>
                    <TableCell className="flex items-center gap-1.5">
                      {providerIcons[s.provider]}
                      <span className="text-sm">{s.provider}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{s.total_calls}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{s.cache_hits}</TableCell>
                    <TableCell className="text-right">
                      {s.errors > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">{s.errors}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{s.avg_response_ms}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Sync Runs */}
      {syncs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent Sync Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{s.provider}</TableCell>
                    <TableCell>
                      {s.status === 'completed' ? (
                        <Badge variant="secondary" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
                      ) : s.status === 'failed' ? (
                        <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Running</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{s.records_processed}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.started_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-xs">
          External APIs provide supplementary reference data only. PBS is the Australian reimbursement reference.
          RxNorm, openFDA, and MedlinePlus are US-based services used for normalization and education support.
          The pharmacist remains the clinical decision-maker.
        </AlertDescription>
      </Alert>
    </div>
  );
}
