/**
 * Protocol Corpus page — jurisdiction protocol reference inside PrescriberOS
 * --------------------------------------------------------------------------
 * `/protocol-corpus` — browse all 113 OCR-extracted protocol documents
 * (8 jurisdictions, as at Sep 2026). This is the consultation-side mirror of
 * the external reference site: same immutable corpus, same provenance rules.
 *
 * Not clinical advice: each document shows its own instrument version,
 * effective date, legal basis, supervision model, per-item provenance
 * (pdf sha256 + page + section heading) and extraction confidence. Items
 * flagged `unclear` render with an explicit verification badge — low
 * confidence OCR never reads as clinical guidance.
 */
import { useMemo, useState } from 'react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Shield, ChevronDown, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import {
  CORPUS_AS_AT,
  CORPUS_DOCUMENTS,
  CORPUS_CONDITIONS,
  getPayload,
  shortSha,
  type CorpusDocumentMeta,
} from '@/data/protocol-corpus';

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;
const STATE_LABELS: Record<string, string> = {
  ACT: 'Australian Capital Territory', NSW: 'New South Wales', NT: 'Northern Territory',
  QLD: 'Queensland', SA: 'South Australia', TAS: 'Tasmania', VIC: 'Victoria', WA: 'Western Australia',
};

export default function ProtocolCorpusPage() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<string>('ALL');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CORPUS_DOCUMENTS.filter(d => {
      if (state !== 'ALL' && d.state !== state) return false;
      if (!q) return true;
      return (
        (d.title || '').toLowerCase().includes(q) ||
        (d.legalBasis || '').toLowerCase().includes(q) ||
        (d.scopeSummary || '').toLowerCase().includes(q) ||
        d.conditionLabel.toLowerCase().includes(q)
      );
    });
  }, [query, state]);

  const byCondition = useMemo(() => {
    const groups = new Map<string, CorpusDocumentMeta[]>();
    for (const d of filtered) {
      const list = groups.get(d.conditionKey) ?? [];
      list.push(d);
      groups.set(d.conditionKey, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <ClinicalLayout>
      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" /> Protocol corpus
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {CORPUS_DOCUMENTS.length} OCR-extracted documents · 8 jurisdictions · corpus as at {CORPUS_AS_AT} ·
              every item carries provenance (pdf sha256, page, section heading) and extraction confidence.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search instruments, legal basis, scope summaries…"
                  className="pl-8"
                />
              </div>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="ALL">All jurisdictions ({CORPUS_DOCUMENTS.length})</option>
                {STATES.map(s => (
                  <option key={s} value={s}>
                    {s} — {STATE_LABELS[s]} ({CORPUS_DOCUMENTS.filter(d => d.state === s).length})
                    </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Decision support only — not legal or clinical advice. Always confirm against the current instrument
              published by your state/territory health department before prescribing.
            </p>
          </CardContent>
        </Card>

        {byCondition.map(([key, docs]) => (
          <Card key={key}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">{docs[0].conditionLabel}</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                {Array.from(new Set(docs.map(d => d.state))).join(' · ')}
              </p>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {docs.map(d => (
                <CorpusDocRow key={d.file} doc={d} open={open === d.file} onToggle={() => setOpen(open === d.file ? null : d.file)} />
              ))}
            </CardContent>
          </Card>
        ))}

        {byCondition.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No documents match — adjust the search or jurisdiction filter.
            </CardContent>
          </Card>
        )}
      </div>
    </ClinicalLayout>
  );
}

function CorpusDocRow({
  doc,
  open,
  onToggle,
}: {
  doc: CorpusDocumentMeta;
  open: boolean;
  onToggle: () => void;
}) {
  const payload = useMemo(() => getPayload(doc.file), [doc.file]);
  const [showOq, setShowOq] = useState(false);
  const oq = payload?.open_questions ?? [];
  const htc = payload?.hugh_to_confirm ?? [];

  return (
    <Collapsible open={open} onOpenChange={o => (o ? onToggle() : onToggle())}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          className="w-full text-left px-3 py-2 rounded hover:bg-muted/50 border border-transparent hover:border-border"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              {open ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
              <div>
                <p className="text-xs font-medium leading-snug">{doc.title}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground">
                  <span className="clinical-badge clinical-badge-info">{doc.state}</span>
                  <span>{doc.docType}</span>
                  {doc.instrumentVersion && <span>{doc.instrumentVersion}</span>}
                  {doc.effectiveDate && <span>eff. {doc.effectiveDate}</span>}
                  {doc.truncated && <span className="clinical-badge clinical-badge-warn">truncated extraction</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {doc.counts.redFlags > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0">{doc.counts.redFlags} flags</Badge>}
              {doc.counts.treatments > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0">{doc.counts.treatments} rx</Badge>}
              {(doc.counts.openQuestions + doc.counts.toConfirm) > 0 && (
                <Badge variant="outline" className="text-[9px] px-1 py-0">{doc.counts.openQuestions + doc.counts.toConfirm} OQ</Badge>
              )}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 pt-1 text-xs space-y-2">
          {doc.legalBasis && <p className="text-muted-foreground leading-relaxed">{doc.legalBasis}</p>}
          {doc.supervisionModel && (
            <p><span className="font-medium">Supervision: </span>{doc.supervisionModel}</p>
          )}
          {doc.scopeSummary && (
            <p><span className="font-medium">Scope: </span>{doc.scopeSummary}</p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span><FileText className="h-2.5 w-2.5 inline mr-1" />{payload?.source.pdf_file}</span>
            <span>sha256 {shortSha(payload?.source.pdf_sha256)}</span>
            <span>{payload?.source.page_count} pages</span>
            <span>extracted {payload?.source.extracted_at?.slice(0, 10)}</span>
          </div>
          {(oq.length > 0 || htc.length > 0) && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
              <button
                type="button"
                className="text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                onClick={() => setShowOq(v => !v)}
              >
                {showOq ? '▾' : '▸'} {oq.length + htc.length} open questions / to-confirm items — extraction QA frontier
              </button>
              {showOq && (
                <ul className="mt-1.5 space-y-1 list-disc list-inside text-[10px] text-muted-foreground">
                  {oq.slice(0, 8).map((q, i) => (
                    <li key={`oq${i}`}>{String(q.text ?? q.question ?? q.summary ?? JSON.stringify(q).slice(0, 160))}</li>
                  ))}
                  {htc.slice(0, 8).map((q, i) => (
                    <li key={`htc${i}`}>⚠ {String(q.text ?? q.question ?? q.summary ?? JSON.stringify(q).slice(0, 160))}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}