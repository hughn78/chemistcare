import { useState, useMemo, useEffect } from 'react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Download, Database, AlertTriangle, RefreshCw, Pill } from 'lucide-react';
import { toast } from 'sonner';
import { pbsDemoData, type PbsItem } from '@/data/pbs-demo-data';
import { MedicineDetailDrawer } from '@/components/clinical-api/MedicineDetailDrawer';

const CACHE_KEY = 'chemistcare_pbs_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached(): PbsItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}

function setCache(data: PbsItem[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
}

function exportCsv(items: PbsItem[]) {
  const header = 'Medicine,PBS Code,ATC Code,Manufacturer,Pack Size,Price (Dispensed),Price (Max),Restriction,Schedule';
  const rows = items.map(i => `"${i.name}","${i.pbsCode}","${i.atcCode}","${i.manufacturer}","${i.packSize}","${i.priceDispensed}","${i.priceMax}","${i.restriction}","${i.schedule}"`);
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'pbs-lookup-export.csv'; a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exported');
}

export default function PbsLookup() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<PbsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'cache' | 'demo'>('demo');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState('');

  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setData(cached);
      setSource('cache');
    } else {
      setData(pbsDemoData);
      setCache(pbsDemoData);
      setSource('demo');
    }
    setLoading(false);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(i => i.name.toLowerCase().includes(q) || i.pbsCode.toLowerCase().includes(q) || i.atcCode.toLowerCase().includes(q));
  }, [search, data]);

  const handleRefresh = () => {
    localStorage.removeItem(CACHE_KEY);
    setData(pbsDemoData);
    setCache(pbsDemoData);
    setSource('demo');
    toast.info('Data refreshed from demo dataset');
  };

  const restrictionColor = (r: string) => {
    if (r === 'Unrestricted') return 'default' as const;
    if (r === 'Restricted') return 'secondary' as const;
    return 'destructive' as const;
  };

  return (
    <ClinicalLayout>
      <div className="p-4 md:p-6 space-y-4 animate-fade-in max-w-6xl">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 font-mono text-xs">DEMO – Public Data Mode</Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">PBS Medicine Lookup</h1>
            <p className="text-sm text-muted-foreground">Search the Pharmaceutical Benefits Scheme dataset</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)} disabled={!filtered.length}><Download className="h-3.5 w-3.5 mr-1" />Export CSV</Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by medicine name, PBS code, or ATC code…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                <Database className="h-3 w-3 mr-1" />{source === 'cache' ? 'Cached' : 'Demo'} · {filtered.length} results
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No results found for "{search}"</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>PBS Code</TableHead>
                      <TableHead className="hidden md:table-cell">ATC</TableHead>
                      <TableHead className="hidden lg:table-cell">Manufacturer</TableHead>
                      <TableHead>Pack Size</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Restriction</TableHead>
                      <TableHead className="hidden sm:table-cell">Sched.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(item => (
                      <TableRow key={item.pbsCode} className="cursor-pointer hover:bg-accent/10" onClick={() => { setSelectedMedicine(item.name); setDrawerOpen(true); }}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-xs">{item.pbsCode}</TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{item.atcCode}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{item.manufacturer}</TableCell>
                        <TableCell className="text-sm">{item.packSize}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{item.priceDispensed}</TableCell>
                        <TableCell><Badge variant={restrictionColor(item.restriction)} className="text-xs">{item.restriction}</Badge></TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-xs">{item.schedule}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <MedicineDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} medicineName={selectedMedicine} />
    </ClinicalLayout>
  );
}