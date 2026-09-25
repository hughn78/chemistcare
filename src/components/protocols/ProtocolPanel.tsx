/**
 * ProtocolPanel — jurisdiction protocol decision-support rail
 * ----------------------------------------------------------
 * Consultation-side view over the OCR protocol corpus. Renders, for the
 * state being consulted in:
 *   • the instrument header (name, version, effective date, legal basis,
 *     supervision model) with provenance footer;
 *   • the eligibility checklist (inclusion/exclusion, each row shows its
 *     extraction confidence and page provenance);
 *   • red flags — structured rules (age, temperature, heart rate…) are
 *     evaluated live against consultation form data and turn red with
 *     the protocol's own action text; textual rules render as an
 *     actively-cleared checklist;
 *   • suggested treatments that can be copied into the script — never
 *     auto-prescribed.
 *
 * The pharmacist makes and records every decision. This panel only ever
 * reads from immutable, versioned corpus documents; each consultation
 * already stores the protocol stamp, so notes stay reproducible after
 * protocols change.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Shield, AlertTriangle, ChevronDown, ChevronRight, FileText,
  Stethoscope, ClipboardCheck, CheckCircle2, MinusCircle, Bell, Copy,
} from 'lucide-react';
import {
  getJurisdictionsForSlug,
  getPayload,
  formatProvenance,
  shortSha,
  severityTone,
  evaluateStructuredRule,
  CORPUS_AS_AT,
  type CorpusDocumentMeta,
  type CorpusRedFlag,
  type CorpusProvenance,
  type CorpusCriteriaItem,
} from '@/data/protocol-corpus';

const STATE_LABELS: Record<string, string> = {
  ACT: 'ACT', NSW: 'New South Wales', NT: 'Northern Territory', QLD: 'Queensland',
  SA: 'South Australia', TAS: 'Tasmania', VIC: 'Victoria', WA: 'Western Australia',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'clinical-badge clinical-badge-info',
  medium: 'clinical-badge clinical-badge-warn',
  unclear: 'clinical-badge clinical-badge-warn',
  low: 'clinical-badge clinical-badge-warn',
};

function flagTone(sev: ReturnType<typeof severityTone>): string {
  switch (sev) {
    case 'critical': return 'border-destructive/60 bg-destructive/10';
    case 'high': return 'border-destructive/40 bg-destructive/5';
    case 'moderate': return 'border-amber-500/40 bg-amber-500/5';
    case 'low': return 'border-border';
  }
}

export interface ProtocolPanelProps {
  /** Consultation registry slug (e.g. 'uncomplicated-uti'). */
  conditionSlug?: string;
  /** State the pharmacy operates in — drives which protocol version applies. */
  state?: string;
  /** Live consultation form data (dob, temperature, heart_rate, allergies…). */
  formData?: Record<string, unknown>;
  /** Called when the pharmacist clicks "Copy into script" on a treatment. */
  onUseTreatment?: (drug: string, dose: string, frequency: string, duration: string) => void;
  /** Compact mode for narrow right rails. */
  compact?: boolean;
}

type LoadedDoc = { meta: CorpusDocumentMeta; payload: NonNullable<ReturnType<typeof getPayload>> };

export function ProtocolPanel({
  conditionSlug,
  state = 'VIC',
  formData = {},
  onUseTreatment,
  compact = false,
}: ProtocolPanelProps) {
  const [openState, setOpenState] = useState(state);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [openFlag, setOpenFlag] = useState<string | null>(null);

  const jurisdictions = useMemo(
    () => (conditionSlug ? getJurisdictionsForSlug(conditionSlug) : []),
    [conditionSlug],
  );

  const activeDocs = useMemo(() => {
    const j = jurisdictions.find(x => x.state === openState) ?? jurisdictions[0];
    return j ? j.docs.filter(d => d.docType !== 'repealed') : [];
  }, [jurisdictions, openState]);

  const loaded = useMemo(
    () =>
      activeDocs
        .map(d => ({ meta: d, payload: getPayload(d.file) }))
        .filter((x): x is LoadedDoc => Boolean(x.payload)),
    [activeDocs],
  );

  if (!conditionSlug) return null;

  return (
    <div className="space-y-3">
      {/* Jurisdiction switcher */}
      {jurisdictions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Shield className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-xs font-semibold text-foreground">Protocol</span>
          {jurisdictions.map(j => (
            <button
              key={j.state}
              type="button"
              onClick={() => setOpenState(j.state)}
              className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
                j.state === openState
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'
              }`}
            >
              {j.state}
            </button>
          ))}
        </div>
      )}

      {loaded.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No corpus protocol bundled for this condition{jurisdictions.length === 0 ? ' / state' : ''}.
        </p>
      )}

      {loaded.map(({ meta, payload }) => (
        <Collapsible
          key={meta.file}
          open={openDoc === meta.file}
          onOpenChange={o => setOpenDoc(o ? meta.file : null)}
        >
          <Card className="border-border/70">
            <CollapsibleTrigger asChild>
              <CardHeader className={compact ? 'p-3 cursor-pointer' : 'p-4 cursor-pointer'}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-xs leading-snug">{meta.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                      <span className="clinical-badge clinical-badge-info">{meta.instrumentVersion}</span>
                      {meta.effectiveDate && <span>eff. {meta.effectiveDate}</span>}
                      <span>{STATE_LABELS[meta.state] || meta.state}</span>
                      {meta.truncated && <span className="clinical-badge clinical-badge-warn">extraction truncated</span>}
                      {(meta.counts.openQuestions + meta.counts.toConfirm) > 0 && (
                        <span className="clinical-badge clinical-badge-warn">
                          {meta.counts.openQuestions + meta.counts.toConfirm} open questions
                        </span>
                      )}
                    </div>
                  </div>
                  {openDoc === meta.file
                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 px-3 pb-3 space-y-3 text-xs">
                {payload.protocol.legal_basis && (
                  <p className="text-muted-foreground leading-relaxed">{payload.protocol.legal_basis}</p>
                )}
                {payload.protocol.supervision_model && (
                  <p>
                    <span className="font-medium text-foreground">Supervision: </span>
                    {payload.protocol.supervision_model}
                  </p>
                )}

                {((payload.eligibility?.inclusion?.length ?? 0) > 0 ||
                  (payload.eligibility?.exclusion?.length ?? 0) > 0) && (
                  <ProtocolSection title="Eligibility" icon={<ClipboardCheck className="h-3 w-3" />}>
                    {payload.eligibility?.inclusion?.length ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inclusion</p>
                        {payload.eligibility.inclusion.map(item => (
                          <CriteriaRow key={item.id} item={item} kind="inclusion" />
                        ))}
                      </>
                    ) : null}
                    {payload.eligibility?.exclusion?.length ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">Exclusion</p>
                        {payload.eligibility.exclusion.map(item => (
                          <CriteriaRow key={item.id} item={item} kind="exclusion" />
                        ))}
                      </>
                    ) : null}
                  </ProtocolSection>
                )}

                {payload.red_flags?.length ? (
                  <ProtocolSection title="Red flags (live)" icon={<AlertTriangle className="h-3 w-3" />}>
                    <div className="space-y-1.5">
                      {payload.red_flags.map(rf => (
                        <RedFlagRow
                          key={rf.id}
                          flag={rf}
                          formData={formData}
                          expanded={openFlag === rf.id}
                          onToggle={() => setOpenFlag(openFlag === rf.id ? null : rf.id)}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
                      Structured rules evaluate live against age (DOB) and recorded vitals. Textual rules must be
                      actively cleared by the pharmacist. Nothing is prescribed automatically.
                    </p>
                  </ProtocolSection>
                ) : null}

                {payload.treatments?.length ? (
                  <ProtocolSection title="Suggested treatments" icon={<Stethoscope className="h-3 w-3" />}>
                    <div className="space-y-1.5">
                      {payload.treatments.map(tx => (
                        <div key={tx.id} className="rounded border border-border/60 p-2 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-foreground text-[11px] leading-snug">{tx.drug || '—'}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {tx.first_line && <span className="clinical-badge clinical-badge-info">1st line</span>}
                              <span className={CONFIDENCE_STYLES[tx.confidence] || CONFIDENCE_STYLES.medium}>
                                {tx.confidence}
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {[tx.strength, tx.form, tx.dose, tx.frequency, tx.duration, tx.quantity_to_supply]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {tx.notes && <p className="text-[10px] text-muted-foreground italic">{tx.notes}</p>}
                          {onUseTreatment && tx.drug && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() =>
                                onUseTreatment(tx.drug, tx.dose || tx.strength || '', tx.frequency || '', tx.duration || '')
                              }
                            >
                              <Copy className="h-2.5 w-2.5 mr-1" /> Copy into script
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ProtocolSection>
                ) : null}

                {payload.review_followup?.length ? (
                  <ProtocolSection title="Review & follow-up" icon={<ClipboardCheck className="h-3 w-3" />}>
                    <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                      {payload.review_followup.slice(0, 6).map((r, i) => (
                        <li key={i} className="leading-relaxed">
                          {r.when ? <span className="text-foreground">{r.when}</span> : null}
                          {r.what ? ` — ${r.what}` : ''}
                        </li>
                      ))}
                    </ul>
                  </ProtocolSection>
                ) : null}

                {payload.notifiable?.required ? (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    <Bell className="h-3 w-3" /> Notifiable: {payload.notifiable.conditions?.join('; ')}
                  </p>
                ) : null}

                <div className="rounded bg-muted/40 px-2 py-1.5 text-[10px] text-muted-foreground space-y-0.5">
                  <p>
                    <FileText className="h-2.5 w-2.5 inline mr-1" />
                    {payload.source.pdf_file} · sha256 {shortSha(payload.source.pdf_sha256)} · {payload.source.page_count} pages
                  </p>
                  <p>Extracted {payload.source.extracted_at?.slice(0, 10)} · corpus as at {CORPUS_AS_AT}</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}

function ProtocolSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

function CriteriaRow({ item, kind }: { item: CorpusCriteriaItem; kind: 'inclusion' | 'exclusion' }) {
  const isExcl = kind === 'exclusion';
  return (
    <div className="rounded border border-border/60 p-1.5">
      <div className="flex items-start gap-1.5">
        <span className={isExcl ? 'text-destructive mt-0.5' : 'text-emerald-600 mt-0.5'}>
          {isExcl ? <MinusCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
        </span>
        <p className="flex-1 text-[11px] leading-snug text-foreground/90">{item.text}</p>
        <span className={CONFIDENCE_STYLES[item.confidence] || CONFIDENCE_STYLES.medium}>{item.confidence}</span>
      </div>
      {item.provenance && (
        <p className="text-[9px] text-muted-foreground mt-1 pl-5 truncate">
          {formatProvenance(item.provenance as CorpusProvenance)}
        </p>
      )}
    </div>
  );
}

function RedFlagRow({
  flag,
  formData,
  expanded,
  onToggle,
}: {
  flag: CorpusRedFlag;
  formData: Record<string, unknown>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [cleared, setCleared] = useState(false);
  const structuredResult = flag.structured ? evaluateStructuredRule(flag.structured, formData) : null;
  const isLiveFail = structuredResult === 'fail';
  const showLive = isLiveFail && !cleared;
  const tone = flagTone(severityTone(flag.severity));

  return (
    <div className={`rounded border p-1.5 ${tone}`}>
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 shrink-0">
          {showLive ? (
            <AlertTriangle className="h-3 w-3 text-destructive" />
          ) : (
            <button type="button" onClick={onToggle} aria-label="Toggle flag detail">
              <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
        </span>
        <p className="flex-1 text-[11px] leading-snug">{flag.trigger_text}</p>
        <span className={CONFIDENCE_STYLES[flag.confidence] || CONFIDENCE_STYLES.medium}>{flag.confidence}</span>
      </div>
      {(showLive || expanded) && (
        <div className="mt-1 pl-5 space-y-0.5">
          {showLive && (
            <>
              <p className="text-[10px] font-semibold text-destructive uppercase">Live trigger — {flag.action}</p>
              <p className="text-[10px] text-muted-foreground">{explainRule(flag.structured)}</p>
            </>
          )}
          {!showLive && (
            <>
              <p className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">Action: </span>
                {flag.action}
              </p>
              {flag.provenance && (
                <p className="text-[10px] text-muted-foreground">{formatProvenance(flag.provenance)}</p>
              )}
              <p className="text-[9px] text-muted-foreground">
                {flag.structured
                  ? `Rule: ${flag.structured.parameter} ${flag.structured.operator} ${flag.structured.value}${
                      flag.structured.unit ? ' ' + flag.structured.unit : ''
                    } — ${structuredResult === 'unverifiable' ? 'awaiting data (screen before prescribing)' : 'not triggered'}`
                  : 'Clear this flag manually only after active screening.'}
              </p>
              {!flag.structured && (
                <label className="flex items-center gap-1.5 text-[10px] mt-1 cursor-pointer">
                  <Checkbox checked={cleared} onCheckedChange={v => setCleared(v === true)} />
                  Actively cleared by pharmacist
                </label>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function explainRule(rule?: CorpusRedFlag['structured']): string {
  if (!rule) return '';
  const unit = rule.unit ? ` ${rule.unit}` : '';
  return `Live rule: ${rule.parameter} ${rule.operator} ${rule.value}${unit}`;
}

/** Convenience wrapper: renders inside a bordered card section titled "Protocol". */
export function ProtocolPanelSection(props: ProtocolPanelProps) {
  return (
    <div className="space-y-2">
      <Separator className="my-2" />
      <ProtocolPanel {...props} compact />
    </div>
  );
}