/**
 * MedicineDetailDrawer — Comprehensive medicine detail panel with tabs:
 * PBS details, normalized drug info, drug classes, openFDA safety data.
 */

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Pill, Shield, Activity, FileText, Clock, Info } from 'lucide-react';
import {
  searchPbsMedicines,
  normalizeMedicine,
  getDrugClasses,
  getMedicineSafetyData,
  type PbsCacheItem,
  type NormalizedMedicine,
  type DrugClassInfo,
  type OpenFdaSafetyResult,
} from '@/lib/clinicalApiService';

interface MedicineDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineName: string;
}

export function MedicineDetailDrawer({ open, onOpenChange, medicineName }: MedicineDetailDrawerProps) {
  const [pbsData, setPbsData] = useState<PbsCacheItem[]>([]);
  const [normalized, setNormalized] = useState<NormalizedMedicine | null>(null);
  const [classes, setClasses] = useState<DrugClassInfo[]>([]);
  const [safetyRecall, setSafetyRecall] = useState<OpenFdaSafetyResult | null>(null);
  const [safetyAdverse, setSafetyAdverse] = useState<OpenFdaSafetyResult | null>(null);
  const [safetyLabel, setSafetyLabel] = useState<OpenFdaSafetyResult | null>(null);
  const [loading, setLoading] = useState({ pbs: false, rxnorm: false, safety: false });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!open || !medicineName) return;

    // Fetch all data in parallel
    setLoading({ pbs: true, rxnorm: true, safety: true });

    searchPbsMedicines(medicineName)
      .then(setPbsData)
      .catch(() => setPbsData([]))
      .finally(() => setLoading(l => ({ ...l, pbs: false })));

    normalizeMedicine(medicineName)
      .then(async (n) => {
        setNormalized(n);
        if (n.rxnorm_rxcui) {
          const c = await getDrugClasses(n.rxnorm_rxcui).catch(() => []);
          setClasses(c);
        }
      })
      .catch(() => setNormalized(null))
      .finally(() => setLoading(l => ({ ...l, rxnorm: false })));

    Promise.all([
      getMedicineSafetyData(medicineName, 'recall').then(setSafetyRecall).catch(() => null),
      getMedicineSafetyData(medicineName, 'adverse').then(setSafetyAdverse).catch(() => null),
      getMedicineSafetyData(medicineName, 'label').then(setSafetyLabel).catch(() => null),
    ]).finally(() => {
      setLoading(l => ({ ...l, safety: false }));
      setLastUpdated(new Date());
    });
  }, [open, medicineName]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            {medicineName}
          </SheetTitle>
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </SheetHeader>

        <Tabs defaultValue="pbs" className="mt-4">
          <TabsList className="w-full grid grid-cols-4 text-xs">
            <TabsTrigger value="pbs" className="text-xs">PBS</TabsTrigger>
            <TabsTrigger value="drug" className="text-xs">Drug Info</TabsTrigger>
            <TabsTrigger value="class" className="text-xs">Classes</TabsTrigger>
            <TabsTrigger value="safety" className="text-xs">Safety</TabsTrigger>
          </TabsList>

          {/* PBS Tab */}
          <TabsContent value="pbs" className="space-y-3">
            {loading.pbs ? (
              <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : pbsData.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 opacity-50" />
                No PBS data found for "{medicineName}"
              </div>
            ) : (
              pbsData.slice(0, 10).map((item, i) => (
                <Card key={i} className="text-sm">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{item.mpPt || item.tpuuOrMppPt}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{item.pbsCode}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>ATC: {item.atcCode || '—'}</span>
                      <span>Schedule: {item.scheduleCode || '—'}</span>
                      <span>Max Qty: {item.maxQty ?? '—'}</span>
                      <span>Repeats: {item.numRepeats ?? '—'}</span>
                      <span>Manufacturer: {item.manufacturer || '—'}</span>
                      <span>Restriction: {item.restrictionFlag || '—'}</span>
                    </div>
                    {item.feeAmount && (
                      <span className="text-xs font-mono">Fee: ${Number(item.feeAmount).toFixed(2)}</span>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
            <p className="text-[10px] text-muted-foreground">Source: PBS Public API. Australian reimbursement reference.</p>
          </TabsContent>

          {/* Drug Info Tab */}
          <TabsContent value="drug" className="space-y-3">
            {loading.rxnorm ? (
              <Skeleton className="h-24 w-full" />
            ) : !normalized || !normalized.matched ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Info className="h-5 w-5 mx-auto mb-1 opacity-50" />
                No RxNorm match found
              </div>
            ) : (
              <Card className="text-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div>
                      <span className="text-xs text-muted-foreground">Matched Name</span>
                      <p className="font-medium">{normalized.matched_name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">RxCUI</span>
                      <p className="font-mono text-xs">{normalized.rxnorm_rxcui}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Type</span>
                      <Badge variant="secondary" className="text-[10px]">{normalized.brand_or_generic}</Badge>
                    </div>
                    {normalized.strength && (
                      <div>
                        <span className="text-xs text-muted-foreground">Strength</span>
                        <p>{normalized.strength}</p>
                      </div>
                    )}
                    {normalized.dose_form && (
                      <div>
                        <span className="text-xs text-muted-foreground">Dose Form</span>
                        <p>{normalized.dose_form}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            <p className="text-[10px] text-muted-foreground">
              {normalized?.disclaimer || 'RxNorm is a US drug normalization system. Not an Australian regulatory source.'}
            </p>
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="class" className="space-y-2">
            {loading.rxnorm ? (
              <Skeleton className="h-16 w-full" />
            ) : classes.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">No class data available</div>
            ) : (
              classes.slice(0, 15).map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-sm">
                  <span>{c.className}</span>
                  <Badge variant="outline" className="text-[10px]">{c.classType}</Badge>
                </div>
              ))
            )}
            <p className="text-[10px] text-muted-foreground">Source: RxClass (NLM). Supplementary classification.</p>
          </TabsContent>

          {/* Safety Tab */}
          <TabsContent value="safety" className="space-y-3">
            {loading.safety ? (
              <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : (
              <>
                {/* Recalls */}
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-amber-500" />Recalls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {safetyRecall?.items && safetyRecall.items.length > 0 ? (
                      safetyRecall.items.slice(0, 5).map((r, i) => (
                        <div key={i} className="text-xs py-1 border-b last:border-0">
                          <span className="font-medium">{r.classification}</span>: {r.reason.slice(0, 100)}
                          <span className="text-muted-foreground ml-1">({r.recallDate})</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No recalls found</span>
                    )}
                  </CardContent>
                </Card>

                {/* Adverse events */}
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-amber-500" />Top Adverse Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {safetyAdverse?.reactions && safetyAdverse.reactions.length > 0 ? (
                      safetyAdverse.reactions.slice(0, 8).map((r, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5">
                          <span>{r.term}</span>
                          <span className="font-mono text-muted-foreground">{r.count.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No adverse event data</span>
                    )}
                  </CardContent>
                </Card>

                {/* Label info */}
                {safetyLabel && safetyLabel.type === 'label' && (safetyLabel.indications || safetyLabel.warnings) && (
                  <Card>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />Label Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2 text-xs">
                      {safetyLabel.indications && (
                        <div>
                          <span className="font-medium">Indications:</span>
                          <p className="text-muted-foreground line-clamp-3">{safetyLabel.indications}</p>
                        </div>
                      )}
                      {safetyLabel.warnings && (
                        <div>
                          <span className="font-medium">Warnings:</span>
                          <p className="text-muted-foreground line-clamp-3">{safetyLabel.warnings}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <p className="text-[10px] text-muted-foreground">
                  {safetyRecall?.disclaimer || 'Source: openFDA. US data — supplementary reference only.'}
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
