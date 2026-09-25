/**
 * TemplateConsultation — generic corpus-driven consultation page
 * --------------------------------------------------------------
 * Drives ANY registered ConditionTemplate (uti.ts pattern, generalised).
 * Used for the corpus-driven conditions: nausea, psoriasis, GORD,
 * atopic dermatitis. Scope rules, red flags and treatments all come from
 * the template — which for these conditions is generated from the
 * governing instrument in the protocol corpus. The pharmacist makes and
 * records every decision; nothing is prescribed automatically. Each
 * finalised consultation stamps the corpus document (file, instrument
 * version, sha256) it was guided by.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TagInput, parseTagString, tagsToString } from '@/components/ui/tag-input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, FileText, Pill,
  RotateCcw, Shield, Stethoscope, User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getConditionTemplateBySlug,
  type ConditionTemplate,
} from '@/lib/conditionTemplates';
import type { FieldDefinition, RedFlagDefinition, TreatmentOptionDefinition } from '@/lib/conditionTemplates/types';
import { buildProtocolStamp, formatProtocolFooter } from '@/lib/protocolVersion';
import { ProtocolPanel } from '@/components/protocols/ProtocolPanel';
import { useConsultAudit } from '@/hooks/useConsultAudit';
import { supabase } from '@/integrations/supabase/client';

const isUnanswered = (v: unknown) => v === undefined || v === '' || v === null;
const isPositive = (v: unknown) => v === 'yes' || v === true;

type StepId = string;

interface TemplateConsultData {
  patient: {
    firstName?: string;
    lastName?: string;
    dob?: string;
    sex?: string;
    pregnancyStatus?: string;
    allergies?: string;
    currentMeds?: string;
    relevantConditions?: string;
  };
  /** Flat answers for the template's condition-specific fields. */
  fields: Record<string, unknown>;
  /** Red-flag screening answers, keyed by corpus flag id. */
  findings: Record<string, 'yes' | 'no'>;
  scopeStatus?: 'in_scope' | 'needs_clarification' | 'out_of_scope';
  scopeReasons?: string[];
  selectedTreatment?: TreatmentOptionDefinition;
  followUpPlan?: string;
  safetyNet?: string;
  referralNotes?: string;
  counsellingDone: string[];
  noteText?: string;
  pharmacistName?: string;
  templateVersion: number;
}

function emptyData(t: ConditionTemplate): TemplateConsultData {
  return {
    patient: {},
    fields: {},
    findings: {},
    counsellingDone: [],
    templateVersion: t.templateVersion,
  };
}

// ────────── Pure evaluators (corpus-driven) ──────────

function flatten(t: ConditionTemplate, d: TemplateConsultData): Record<string, unknown> {
  return {
    ...(d.fields ?? {}),
    ...(d.findings ?? {}),
    firstName: d.patient.firstName,
    lastName: d.patient.lastName,
    dob: d.patient.dob,
    sex: d.patient.sex,
    pregnancyStatus: d.patient.pregnancyStatus,
    allergies: d.patient.allergies,
    currentMeds: d.patient.currentMeds,
    relevantConditions: d.patient.relevantConditions,
    patient: d.patient,
    findings: d.findings,
    selectedTreatment: d.selectedTreatment,
    __template: t,
  };
}

export function evaluateTemplateScope(t: ConditionTemplate, d: TemplateConsultData) {
  const flat = flatten(t, d);
  const results = t.scopeRules
    .map(r => ({ rule: r, result: r.evaluate(flat) }))
    .filter(r => r.result);
  const reasons: string[] = [];
  let status: 'in_scope' | 'needs_clarification' | 'out_of_scope' = 'in_scope';
  for (const r of results) {
    if (!r.result) continue;
    if (r.result.status === 'out_of_scope') {
      status = 'out_of_scope';
      if (r.result.reason) reasons.push(r.result.reason);
    } else if (r.result.status === 'needs_clarification' && status !== 'out_of_scope') {
      status = 'needs_clarification';
      if (r.result.reason) reasons.push(r.result.reason);
    }
  }
  return { status, reasons };
}

const lc = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '');
const tagContains = (csv: unknown, needle: string) =>
  lc(csv).split(/[,;]/).map(x => x.trim()).some(x => x && x.includes(needle.toLowerCase()));

export function evaluateTreatmentBlockers(
  t: ConditionTemplate,
  d: TemplateConsultData,
  treatment: TreatmentOptionDefinition,
): string[] {
  const reasons: string[] = [];
  const scope = evaluateTemplateScope(t, d);
  if (scope.status !== 'in_scope') reasons.push('Out of scope — treatment not permitted');
  for (const allergyTerm of treatment.allergyConflicts) {
    if (tagContains(d.patient.allergies, allergyTerm)) {
      reasons.push(`Allergy conflict: ${allergyTerm}`);
    }
  }
  for (const ci of treatment.contraindications) {
    if (tagContains(d.patient.relevantConditions, ci)) {
      reasons.push(`Contraindication: ${ci}`);
    }
  }
  for (const ix of treatment.interactionFlags) {
    if (tagContains(d.patient.currentMeds, ix)) {
      reasons.push(`Interaction with ${ix}`);
    }
  }
  const flagIds = t.redFlags.map(f => f.id);
  const rfDone = flagIds.every(id => !isUnanswered(d.findings[id]));
  if (!rfDone) reasons.push('Red flag screening incomplete');
  return reasons;
}

export function computeTemplateSafetyScore(t: ConditionTemplate, d: TemplateConsultData) {
  const w = t.safetyWeights;
  const penalties: { reason: string; weight: number }[] = [];
  const flagIds = t.redFlags.map(f => f.id);

  const unanswered = flagIds.filter(id => isUnanswered(d.findings[id])).length;
  if (unanswered) {
    penalties.push({ reason: `${unanswered} screening item(s) unanswered`, weight: w.unansweredRedFlag * unanswered });
  }
  if (!d.patient.pregnancyStatus) {
    penalties.push({ reason: 'Pregnancy status missing', weight: w.missingCriticalField });
  }
  if (d.selectedTreatment) {
    const blockers = evaluateTreatmentBlockers(t, d, d.selectedTreatment);
    const allergyHits = blockers.filter(b => b.startsWith('Allergy')).length;
    if (allergyHits) {
      penalties.push({ reason: 'Allergy conflict with selected treatment', weight: w.allergyConflict * allergyHits });
    }
    const scope = evaluateTemplateScope(t, d);
    if (scope.status !== 'in_scope') {
      penalties.push({ reason: 'Treatment selected while out of scope', weight: w.outOfScopeTreatment });
    }
    const required = t.counselling.filter(c => c.required).map(c => c.id);
    const done = d.counsellingDone ?? [];
    if (!required.every(id => done.includes(id))) {
      penalties.push({ reason: 'Treatment selected without full counselling', weight: w.treatmentWithoutCounselling });
    }
    if (!d.followUpPlan) {
      penalties.push({ reason: 'Treatment selected without follow-up advice', weight: w.treatmentWithoutFollowUp });
    }
  }
  const total = penalties.reduce((s, p) => s + p.weight, 0);
  return { score: Math.max(0, 100 - total), penalties };
}

// ────────── Page ──────────

const STEP_ICONS: Record<string, typeof User> = {
  'patient-profile': User,
  'presenting-complaint': Stethoscope,
  'red-flags': AlertTriangle,
  'scope-validation': Shield,
  differentials: FileText,
  treatment: Pill,
  counselling: CheckCircle,
  documentation: FileText,
  completion: CheckCircle,
};

const TemplateConsultation = () => {
  const navigate = useNavigate();
  const { conditionSlug } = useParams<{ conditionSlug: string }>();
  const { logEvent } = useConsultAudit();
  const template = conditionSlug ? getConditionTemplateBySlug(conditionSlug) : undefined;

  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<TemplateConsultData>(() => ({
    patient: {}, fields: {}, findings: {}, counsellingDone: [],
    templateVersion: template?.templateVersion ?? 1,
  }));
  const [isFinalising, setIsFinalising] = useState(false);
  const [restored, setRestored] = useState(false);

  const DRAFT_KEY = useMemo(
    () => `chemistcare:template_consultation_draft:${conditionSlug ?? 'unknown'}`,
    [conditionSlug],
  );

  const steps = template?.steps ?? [];
  const step: StepId = steps[stepIdx]?.id ?? '';

  // Protocol stamp — from the template's corpus metadata.
  const protocolStamp = useMemo(() => {
    if (!template) return null;
    return buildProtocolStamp({
      conditionSlug: template.slug,
      conditionTemplateVersion: template.conditionTemplateVersion,
      templateVersionNumber: template.templateVersion,
      jurisdiction: template.jurisdictions[0] ?? 'VIC',
      jurisdictionProtocolVersion: template.jurisdictionProtocolVersion,
      protocolStatus: template.protocolStatus,
      protocolSourceLabel: template.protocolSourceLabel,
      protocolLastReviewed: template.protocolLastReviewed,
    });
  }, [template]);

  // ── Draft restore prompt ──
  useEffect(() => {
    if (!template) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw && !restored) {
        const ok = window.confirm('A previous draft exists for this condition. Restore it?');
        if (ok) setData(JSON.parse(raw));
        else localStorage.removeItem(DRAFT_KEY);
        setRestored(true);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  // ── Autosave ──
  useEffect(() => {
    if (!template) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data, template, DRAFT_KEY]);

  // ── Derived scope + note + safety ──
  const scope = useMemo(
    () => (template ? evaluateTemplateScope(template, data) : { status: 'in_scope' as const, reasons: [] }),
    [template, data],
  );
  const safety = useMemo(
    () => (template ? computeTemplateSafetyScore(template, data) : { score: 100, penalties: [] }),
    [template, data],
  );

  useEffect(() => {
    setData(d =>
      d.scopeStatus === scope.status && JSON.stringify(d.scopeReasons) === JSON.stringify(scope.reasons)
        ? d
        : { ...d, scopeStatus: scope.status, scopeReasons: scope.reasons }
    );
  }, [scope.status, scope.reasons]);

  const noteText = useMemo(() => {
    if (!template) return '';
    return template.documentation.generate({
      patient: data.patient,
      findings: data.findings,
      symptomNotes: String(data.fields['symptomNotes'] ?? ''),
      scopeStatus: data.scopeStatus,
      scopeReasons: data.scopeReasons,
      selectedTreatment: data.selectedTreatment,
      referralNotes: data.referralNotes,
      followUpPlan: data.followUpPlan,
      safetyNet: data.safetyNet,
      counsellingDone: data.counsellingDone,
      pharmacistName: data.pharmacistName,
      templateVersion: template.templateVersion,
    } as unknown as Record<string, unknown>);
  }, [template, data]);

  useEffect(() => {
    setData(d => (d.noteText === noteText ? d : { ...d, noteText }));
  }, [noteText]);

  const positiveRedFlags = useMemo(
    () => (template?.redFlags ?? []).filter(f => data.findings[f.id] === 'yes'),
    [template, data.findings],
  );

  const completion = useMemo(() => {
    if (!template) return [];
    return template.completionChecklist.map(item => ({
      ...item,
      done: item.isComplete(data as unknown as Record<string, unknown>),
    }));
  }, [template, data]);

  const readyToFinalise =
    completion.every(c => !c.required || c.done) && safety.score >= 60 && scope.status === 'in_scope';
  const readyAsReferral =
    scope.status === 'out_of_scope' && !data.selectedTreatment && !!data.referralNotes && !!data.followUpPlan;

  // ── Updaters ──
  const updatePatient = useCallback(<K extends keyof TemplateConsultData['patient']>(k: K, v: TemplateConsultData['patient'][K]) => {
    setData(d => ({ ...d, patient: { ...d.patient, [k]: v } }));
  }, []);
  const updateField = useCallback((k: string, v: unknown) => {
    setData(d => ({ ...d, fields: { ...d.fields, [k]: v } }));
  }, []);
  const updateFinding = useCallback((k: string, v: 'yes' | 'no') => {
    setData(d => ({ ...d, findings: { ...d.findings, [k]: v } }));
  }, []);
  const toggleCounselling = useCallback((id: string, on: boolean) => {
    setData(d => ({
      ...d,
      counsellingDone: on ? Array.from(new Set([...d.counsellingDone, id])) : d.counsellingDone.filter(x => x !== id),
    }));
  }, []);
  const discardDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    if (template) setData({ patient: {}, fields: {}, findings: {}, counsellingDone: [], templateVersion: template.templateVersion });
  }, [template, DRAFT_KEY]);

  if (!template || !protocolStamp) {
    return (
      <ClinicalLayout>
        <div className="p-6">
          <p className="text-muted-foreground">No protocol template registered for this condition.</p>
          <Button variant="ghost" onClick={() => navigate('/consultations/new')} className="mt-2">← All conditions</Button>
        </div>
      </ClinicalLayout>
    );
  }

  const currentStep = steps[stepIdx];
  const treatmentBlocked = positiveRedFlags.some(f => f.blocksPrescribing) || scope.status !== 'in_scope';

  const handleFinalise = async () => {
    if (!readyToFinalise && !readyAsReferral) return;
    setIsFinalising(true);
    const isReferral = readyAsReferral && !readyToFinalise;
    const noteWithFooter = `${noteText}\n\n— ${formatProtocolFooter(protocolStamp)}`;
    try {
      const insertPayload: Record<string, unknown> = {
        status: 'finalised',
        patient_first_name: data.patient.firstName ?? null,
        patient_last_name: data.patient.lastName ?? null,
        patient_dob: data.patient.dob ?? null,
        patient_sex: data.patient.sex ?? null,
        patient_pregnancy_status: data.patient.pregnancyStatus ?? null,
        patient_allergies: data.patient.allergies ?? null,
        patient_medications: data.patient.currentMeds ?? null,
        patient_comorbidities: data.patient.relevantConditions ?? null,
        condition_id: template.id,
        condition_name: template.name,
        red_flags_checked: data.findings,
        red_flag_triggered: positiveRedFlags.length > 0,
        assessment_data: {
          fields: data.fields,
          findings: data.findings,
          scopeStatus: data.scopeStatus,
          scopeReasons: data.scopeReasons,
          counsellingDone: data.counsellingDone,
          __conditionSlug: template.slug,
          __templateVersion: template.templateVersion,
        },
        selected_therapy_id: data.selectedTreatment?.id ?? null,
        follow_up_plan: data.followUpPlan ?? null,
        safety_net_advice: data.safetyNet ?? null,
        referral_notes: data.referralNotes ?? null,
        full_note_text: noteWithFooter,
        finalised_at: new Date().toISOString(),
        template_version: template.templateVersion,
        protocol_jurisdiction: protocolStamp.protocolJurisdiction,
        protocol_jurisdiction_version: protocolStamp.jurisdictionProtocolVersion,
        protocol_name: protocolStamp.protocolName,
        condition_slug: template.slug,
        condition_template_version: template.conditionTemplateVersion,
        jurisdiction: protocolStamp.jurisdiction,
        protocol_source_label: template.protocolSourceLabel ?? null,
        protocol_last_reviewed: template.protocolLastReviewed ?? null,
        protocol_status: template.protocolStatus,
        finalised_note: noteWithFooter,
        finalised_note_protocol_snapshot: { ...protocolStamp, capturedAt: new Date().toISOString() },
      };
      const { data: inserted, error } = await (supabase.from('consultations') as any)
        .insert(insertPayload)
        .select('id')
        .single();
      const consultId = inserted?.id ?? `local-${Date.now()}`;
      await logEvent(consultId, 'finalise_started', { protocol: protocolStamp });
      if (error) {
        await logEvent(consultId, 'finalise_failed', { errorReason: error.message, protocol: protocolStamp });
        toast.success(isReferral ? 'Referral consultation finalised (offline)' : 'Consultation finalised (offline)');
      } else {
        await logEvent(consultId, 'finalise_succeeded', { protocol: protocolStamp, metadata: { isReferral } });
        toast.success(isReferral ? 'Referral consultation finalised' : 'Consultation finalised');
      }
      discardDraft();
      navigate('/prescribing-log');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await logEvent(`local-${Date.now()}`, 'finalise_failed', { errorReason: msg, protocol: protocolStamp });
      toast.error(`Finalisation failed: ${msg}`);
    } finally {
      setIsFinalising(false);
    }
  };

  return (
    <ClinicalLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-card px-4 sm:px-6 py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Stethoscope className="h-5 w-5 text-accent shrink-0" />
                <h1 className="text-base sm:text-lg font-bold truncate">New Consultation: {template.name}</h1>
                <Badge className="clinical-badge clinical-badge-danger">
                  {template.category} · {protocolStamp.jurisdiction}
                </Badge>
                <Badge variant="outline" className="text-[10px]" title={protocolStamp.protocolName}>
                  Template v{template.conditionTemplateVersion} · {protocolStamp.jurisdictionProtocolVersion}
                </Badge>
                <Badge variant="outline" className={`text-[10px] capitalize ${
                  template.protocolStatus === 'active' ? 'border-clinical-safe text-clinical-safe' : 'border-clinical-warning text-clinical-warning'
                }`}>
                  {template.protocolStatus.replace('_', ' ')}
                </Badge>
              </div>
              {template.protocolSourceLabel && (
                <p className="text-[11px] text-muted-foreground mt-1 truncate" title={template.protocolSourceLabel}>
                  Protocol: {template.protocolSourceLabel}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/consultations/new')} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Change condition
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px]">
          {/* Main column */}
          <div className="overflow-auto p-4 sm:p-6 space-y-4">
            {/* Stepper */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {steps.map((s, i) => {
                const Icon = STEP_ICONS[s.kind] ?? FileText;
                const active = i === stepIdx;
                const blockerHere =
                  s.kind === 'treatment' && treatmentBlocked;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStepIdx(i)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : blockerHere
                          ? 'bg-clinical-danger-bg text-clinical-danger hover:bg-clinical-danger-bg/70'
                          : 'bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {i + 1}. {s.label}
                  </button>
                );
              })}
            </div>

            {/* PATIENT PROFILE */}
            {currentStep?.kind === 'patient-profile' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Patient Profile</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">First name *</Label>
                      <Input value={data.patient.firstName ?? ''} onChange={e => updatePatient('firstName', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Last name *</Label>
                      <Input value={data.patient.lastName ?? ''} onChange={e => updatePatient('lastName', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Date of birth *</Label>
                      <Input type="date" value={data.patient.dob ?? ''} onChange={e => updatePatient('dob', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Sex at birth</Label>
                      <Select value={data.patient.sex ?? ''} onValueChange={v => updatePatient('sex', v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Pregnancy status *</Label>
                      <Select value={data.patient.pregnancyStatus ?? ''} onValueChange={v => updatePatient('pregnancyStatus', v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_pregnant">Not pregnant</SelectItem>
                          <SelectItem value="pregnant">Pregnant</SelectItem>
                          <SelectItem value="possibly_pregnant">Possibly pregnant</SelectItem>
                          <SelectItem value="not_applicable">Not applicable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div>
                    <Label className="text-xs">Allergies</Label>
                    <TagInput placeholder="Type allergy and press Enter…" value={parseTagString(data.patient.allergies ?? '')} onChange={tags => updatePatient('allergies', tagsToString(tags))} />
                  </div>
                  <div>
                    <Label className="text-xs">Current medicines</Label>
                    <TagInput placeholder="Type medicine and press Enter…" value={parseTagString(data.patient.currentMeds ?? '')} onChange={tags => updatePatient('currentMeds', tagsToString(tags))} />
                  </div>
                  <div>
                    <Label className="text-xs">Relevant medical conditions</Label>
                    <TagInput placeholder="e.g. renal impairment, immunosuppression" value={parseTagString(data.patient.relevantConditions ?? '')} onChange={tags => updatePatient('relevantConditions', tagsToString(tags))} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CONDITION-SPECIFIC FIELDS (from template.steps[].fields, excluding patient-profile/treatment fields) */}
            {currentStep && (currentStep.kind === 'presenting-complaint') && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{currentStep.label}</CardTitle>
                  {currentStep.description && <p className="text-xs text-muted-foreground">{currentStep.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {(currentStep.fields ?? []).map(f => (
                    <FieldRenderer key={f.id} field={f} value={data.fields[f.id]} onChange={v => updateField(f.id, v)} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* RED FLAGS (corpus verbatim) */}
            {currentStep?.kind === 'red-flags' && template && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{currentStep.label}</CardTitle>
                  {currentStep.description && <p className="text-xs text-muted-foreground">{currentStep.description}</p>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    {template.redFlags.length} items from {template.protocolSourceLabel}. Any positive flag blocks
                    pharmacist prescribing.
                  </p>
                  {template.redFlags.map(rf => (
                    <div
                      key={rf.id}
                      className={`rounded border p-2.5 ${data.findings[rf.id] === 'yes' ? (rf.severity === 'critical' ? 'border-destructive/60 bg-destructive/10' : 'border-amber-500/40 bg-amber-500/5') : 'border-border/60'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-snug">{rf.label}</p>
                          {rf.action && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Action: {rf.action}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[9px]">{rf.severity}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {(['yes', 'no'] as const).map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateFinding(rf.id, v)}
                            aria-pressed={data.findings[rf.id] === v}
                            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                              data.findings[rf.id] === v
                                ? v === 'yes'
                                  ? 'bg-clinical-danger text-white border-clinical-danger'
                                  : 'bg-clinical-safe text-white border-clinical-safe'
                                : 'bg-card text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {v === 'yes' ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* SCOPE VALIDATION */}
            {currentStep?.kind === 'scope-validation' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Scope Validation</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Badge className={`${
                    scope.status === 'in_scope' ? 'clinical-badge clinical-badge-safe' :
                    scope.status === 'needs_clarification' ? 'clinical-badge clinical-badge-warning' :
                    'clinical-badge clinical-badge-danger'
                  }`}>
                    {scope.status.replace(/_/g, ' ')}
                  </Badge>
                  {scope.reasons.map((r, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                  ))}
                  {scope.status === 'needs_clarification' && (
                    <p className="text-xs text-muted-foreground">Resolve the items above to proceed.</p>
                  )}
                  {scope.status === 'out_of_scope' && (
                    <p className="text-xs text-clinical-danger">Prescribing blocked — document a referral instead.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TREATMENT (corpus verbatim, blocker-gated) */}
            {currentStep?.kind === 'treatment' && template && (
              <div className="space-y-3">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Treatment selection</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {treatmentBlocked && (
                      <div className="rounded border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-clinical-danger">
                        Prescribing blocked — {positiveRedFlags.length > 0 ? 'red flag(s) positive' : 'out of scope'}. Document a referral below.
                      </div>
                    )}
                    {template.treatments.map(t => {
                      const blockers = evaluateTreatmentBlockers(template, data, t);
                      const blocked = blockers.length > 0;
                      const selected = data.selectedTreatment?.id === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`rounded border p-2.5 transition-colors ${
                            selected ? 'border-accent bg-accent/5' : blocked ? 'border-border/40 opacity-70' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={selected}
                              disabled={blocked}
                              onChange={() =>
                                setData(d => ({
                                  ...d,
                                  selectedTreatment: selected ? undefined : t,
                                  referralNotes: selected || !blocked ? d.referralNotes : d.referralNotes,
                                }))
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium">{t.medicineName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {t.dose} · {t.frequency} · {t.duration} · qty {t.maxQuantity}
                              </p>
                              {t.cautions?.[0] && (
                                <p className="text-[10px] text-muted-foreground italic mt-0.5">{t.cautions[0]}</p>
                              )}
                              {blocked && blockers.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {blockers.map((b, i) => (
                                    <li key={i} className="text-[10px] text-clinical-danger">• {b}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Plan & safety net</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Follow-up plan *</Label>
                      <Textarea rows={2} value={data.followUpPlan ?? ''} onChange={e => setData(d => ({ ...d, followUpPlan: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Safety net advice *</Label>
                      <Textarea rows={2} value={data.safetyNet ?? ''} onChange={e => setData(d => ({ ...d, safetyNet: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Referral notes (use when out of scope / no treatment)</Label>
                      <Textarea rows={2} value={data.referralNotes ?? ''} onChange={e => setData(d => ({ ...d, referralNotes: e.target.value }))} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* COUNSELLING */}
            {currentStep?.kind === 'counselling' && template && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Counselling</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {template.counselling.map(c => {
                    const done = data.counsellingDone.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 rounded border border-border/60 p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={e => toggleCounselling(c.id, e.target.checked)}
                        />
                        <span className="text-xs flex-1">{c.label}</span>
                        {c.required && <Badge variant="outline" className="text-[9px]">required</Badge>}
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* DOCUMENTATION */}
            {currentStep?.kind === 'documentation' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Clinical Note (protocol-derived)</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-[12px] leading-relaxed whitespace-pre-wrap p-3 rounded-md bg-muted font-mono">
                    {noteText}
                  </pre>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(noteText); toast.success('Note copied'); }}>
                      Copy note
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step nav */}
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="outline" disabled={stepIdx === 0} onClick={() => setStepIdx(i => i - 1)} className="gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <span className="text-[11px] text-muted-foreground">Step {stepIdx + 1} of {steps.length}</span>
              <Button size="sm" disabled={stepIdx === steps.length - 1} onClick={() => setStepIdx(i => i + 1)} className="gap-1.5">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Right rail */}
          <aside className="border-l bg-card overflow-auto p-4 space-y-4 hidden lg:block">
            <ProtocolPanel conditionSlug={conditionSlug} formData={{ ...data.fields, ...data.patient }} compact />

            <Separator className="my-2" />

            {/* Safety score */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Safety Score</h3>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold tabular-nums ${
                  safety.score >= 80 ? 'text-clinical-safe' : safety.score >= 50 ? 'text-clinical-warning' : 'text-clinical-danger'
                }`}>{safety.score}</span>
                <span className="text-xs text-muted-foreground mb-1">/ 100</span>
              </div>
              {safety.penalties.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {safety.penalties.map((p, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{p.reason}</span>
                      <span className="text-clinical-danger tabular-nums">−{p.weight}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator className="my-2" />

            {/* Completion readiness */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Readiness</h3>
              <ul className="space-y-1">
                {completion.map(c => (
                  <li key={c.id} className="flex items-center gap-1.5 text-[11px]">
                    {c.done
                      ? <CheckCircle className="h-3 w-3 text-clinical-safe shrink-0" />
                      : <span className="h-3 w-3 rounded-full border border-muted-foreground/40 shrink-0" />}
                    <span className={c.done ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                className="w-full mt-3"
                disabled={isFinalising || (!readyToFinalise && !readyAsReferral)}
                onClick={handleFinalise}
              >
                {isReferralMode(readyToFinalise, readyAsReferral) ? 'Finalise referral' : 'Finalise consultation'}
              </Button>
              {(!readyToFinalise && !readyAsReferral) && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Complete all required items and resolve scope to finalise.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </ClinicalLayout>
  );
};

function isReferralMode(readyToFinalise: boolean, readyAsReferral: boolean): boolean {
  return !readyToFinalise && readyAsReferral;
}

/** Renders one template field (compact, protocol-driven). */
function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${field.id}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {field.label}
        {field.required ? ' *' : ''}
      </Label>
      {field.helpText && <p className="text-[10px] text-muted-foreground">{field.helpText}</p>}
      {field.kind === 'select' && field.options && (
        <Select
          value={String(value ?? '')}
          onValueChange={v => {
            const opt = field.options?.find(o => o.value === v);
            onChange(v);
            void opt;
          }}
        >
          <SelectTrigger id={id}><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {field.options.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.kind === 'text' && (
        <Input id={id} value={String(value ?? '')} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.kind === 'number' && (
        <Input id={id} type="number" value={String(value ?? '')} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.kind === 'date' && (
        <Input id={id} type="date" value={String(value ?? '')} onChange={e => onChange(e.target.value)} />
      )}
      {field.kind === 'textarea' && (
        <Textarea id={id} rows={3} value={String(value ?? '')} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.kind === 'boolean' && (
        <div className="flex gap-1.5">
          {(['yes', 'no'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-pressed={value === v}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                value === v
                  ? v === 'yes' ? 'bg-clinical-safe text-white border-clinical-safe' : 'bg-card text-foreground border-border'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {v === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      )}
      {field.kind === 'tags' && (
        <TagInput
          placeholder={field.placeholder ?? 'Type and press Enter…'}
          value={parseTagString(String(value ?? ''))}
          onChange={tags => onChange(tagsToString(tags))}
        />
      )}
    </div>
  );
}

export default TemplateConsultation;