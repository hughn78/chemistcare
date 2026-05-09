import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ClipboardList, ExternalLink } from 'lucide-react';

const ITEMS: { id: string; left: string; right: string }[] = [
  { id: 'cough',        left: 'I never cough',                                              right: 'I cough all the time' },
  { id: 'phlegm',       left: 'I have no phlegm (mucus) in my chest at all',                right: 'My chest is completely full of phlegm (mucus)' },
  { id: 'tightness',    left: 'My chest does not feel tight at all',                        right: 'My chest feels very tight' },
  { id: 'breathless',   left: 'When I walk up a hill or one flight of stairs I am not breathless', right: 'When I walk up a hill or one flight of stairs I am very breathless' },
  { id: 'activities',   left: 'I am not limited doing any activities at home',              right: 'I am very limited doing activities at home' },
  { id: 'confidence',   left: 'I am confident leaving my home despite my lung condition',   right: 'I am not at all confident leaving my home because of my lung condition' },
  { id: 'sleep',        left: 'I sleep soundly',                                            right: "I don't sleep soundly because of my lung condition" },
  { id: 'energy',       left: 'I have lots of energy',                                      right: 'I have no energy at all' },
];

export interface CATResult {
  total: number;
  perItem: Record<string, number>;
  severity: 'low' | 'medium' | 'high' | 'very_high';
  severityLabel: string;
  diagnosticImpression: string;
  completedAt: string;
}

function classify(total: number): Pick<CATResult, 'severity' | 'severityLabel' | 'diagnosticImpression'> {
  if (total <= 10) return {
    severity: 'low',
    severityLabel: 'Low impact (≤10)',
    diagnosticImpression: 'Low symptomatic burden. Suggests stable COPD (GOLD group A if low exacerbation risk). Optimise inhaler technique, maintain SABA reliever, smoking cessation, vaccinations.',
  };
  if (total <= 20) return {
    severity: 'medium',
    severityLabel: 'Medium impact (11–20)',
    diagnosticImpression: 'Moderate symptomatic burden. Consider GOLD group B if low exacerbation risk; LAMA or LABA maintenance therapy is appropriate. Review trigger avoidance and pulmonary rehabilitation referral.',
  };
  if (total <= 30) return {
    severity: 'high',
    severityLabel: 'High impact (21–30)',
    diagnosticImpression: 'High symptomatic burden. Likely GOLD group B/E — consider LAMA + LABA dual therapy; review for ICS if eosinophilic / frequent exacerbations. Strongly recommend pulmonary rehab and GP/respiratory review.',
  };
  return {
    severity: 'very_high',
    severityLabel: 'Very high impact (>30)',
    diagnosticImpression: 'Very high symptomatic burden — exceeds usual community pharmacist scope. Refer to GP / respiratory physician for triple therapy review (LAMA + LABA + ICS), exacerbation prevention plan and oxygen assessment.',
  };
}

interface Props {
  /** Pre-fill values if the patient has previously completed the test. */
  initial?: Partial<Record<string, number>>;
  initialTotal?: number;
  onSave: (result: CATResult) => void;
  trigger?: React.ReactNode;
}

export function CATAssessmentDialog({ initial, initialTotal, onSave, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(ITEMS.map(i => [i.id, initial?.[i.id] ?? 0])),
  );

  useEffect(() => {
    if (initial) {
      setScores(prev => ({ ...prev, ...initial }));
    }
  }, [initial]);

  const total = useMemo(() => Object.values(scores).reduce((a, b) => a + (Number(b) || 0), 0), [scores]);
  const banding = useMemo(() => classify(total), [total]);

  const handleSave = () => {
    const result: CATResult = {
      total,
      perItem: scores,
      ...banding,
      completedAt: new Date().toISOString(),
    };
    onSave(result);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <ClipboardList className="h-4 w-4" /> COPD Assessment Test (CAT)
            {typeof initialTotal === 'number' && <span className="ml-1 text-xs text-muted-foreground">· {initialTotal}/40</span>}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>COPD Assessment Test (CAT)</DialogTitle>
          <DialogDescription>
            8-item validated questionnaire. Each item scored 0 (best) to 5 (worst). Total 0–40.
            <a
              href="https://www.catestonline.org/patient-site-test-page-english.html"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              Open patient version <ExternalLink className="h-3 w-3" />
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {ITEMS.map(item => (
            <div key={item.id} className="rounded-md border p-3">
              <div className="grid grid-cols-12 gap-2 items-center text-xs">
                <div className="col-span-4 text-foreground">{item.left}</div>
                <div className="col-span-4 flex justify-center gap-1">
                  {[0, 1, 2, 3, 4, 5].map(v => {
                    const active = scores[item.id] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-label={`${item.id} score ${v}`}
                        onClick={() => setScores(s => ({ ...s, [item.id]: v }))}
                        className={`h-8 w-8 rounded-full border text-xs font-semibold transition ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                <div className="col-span-4 text-right text-muted-foreground">{item.right}</div>
              </div>
            </div>
          ))}

          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Total CAT score</Label>
              <span className="text-2xl font-bold tabular-nums">{total}<span className="text-sm text-muted-foreground"> / 40</span></span>
            </div>
            <p className="text-xs font-medium">{banding.severityLabel}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{banding.diagnosticImpression}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save CAT Result</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
