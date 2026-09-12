/**
 * Uncomplicated UTI Consultation Engine
 * --------------------------------------
 * Reference implementation of the condition-driven workflow built on
 * top of `src/lib/conditionTemplates/types.ts`. UTI is the gold-
 * standard pathway — when adding the remaining 21 conditions, copy
 * `uti.ts` and reuse this same page (or extract a generic
 * `<TemplateConsultation />` once a second condition is needed).
 *
 * Design notes:
 *  - Step state lives in a single typed `UtiConsultationData`.
 *  - Scope, treatment blockers and safety score are pure functions
 *    in `uti.ts` — UI only renders.
 *  - We deliberately do NOT reuse the generic `NewConsultation.tsx`
 *    engine: the spec requires UTI-specific scope panels, red-flag
 *    yes/no triage, counselling checklist, and a UTI-specific note.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { TagInput, parseTagString, tagsToString } from '@/components/ui/tag-input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight,
  FileText, Pill, RotateCcw, Shield, Stethoscope, User, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  utiTemplate,
  emptyUtiData,
  evaluateScope,
  evaluateTreatmentBlockers,
  evaluateUtiFindings,
  decideUti,
  buildUtiHandover,
  UTI_RED_FLAG_IDS,
  type UtiConsultationData,
} from '@/lib/conditionTemplates/uti';
import type { TreatmentOptionDefinition } from '@/lib/conditionTemplates/types';
import { utiProtocol } from '@/clinical/protocols/uti';
import {
  ProtocolProvenancePopover,
  ProtocolReferenceModeBanner,
  ProtocolStatusBadge,
} from '@/components/clinical/ProtocolProvenance';
import { SafetyFindingsPanel } from '@/components/clinical/SafetyFindingsPanel';
import { ReferralPanel } from '@/components/clinical/ReferralPanel';
import { buildProtocolStamp, formatProtocolFooter } from '@/lib/protocolVersion';
import { useConsultAudit } from '@/hooks/useConsultAudit';
import { supabase } from '@/integrations/supabase/client';

const DRAFT_KEY = 'chemistcare:uti_consultation_draft_v1';

type StepId = 'patient' | 'symptoms' | 'red-flags' | 'scope' | 'differentials' | 'treatment' | 'counselling' | 'documentation';

const STEP_ORDER: { id: StepId; label: string; icon: typeof User }[] = [
  { id: 'patient', label: 'Patient', icon: User },
  { id: 'symptoms', label: 'Symptoms', icon: Stethoscope },
  { id: 'red-flags', label: 'Red Flags', icon: AlertTriangle },
  { id: 'scope', label: 'Scope', icon: Shield },
  { id: 'differentials', label: 'Differentials', icon: FileText },
  { id: 'treatment', label: 'Treatment', icon: Pill },
  { id: 'counselling', label: 'Counselling', icon: CheckCircle },
  { id: 'documentation', label: 'Documentation', icon: FileText },
];

// ────────── Utility ──────────
function YesNo({
  value, onChange, idBase,
}: { value: 'yes' | 'no' | undefined; onChange: (v: 'yes' | 'no') => void; idBase: string }) {
  return (
    <div className="flex gap-1.5">
      {(['yes', 'no'] as const).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
            value === v
              ? v === 'yes'
                ? 'bg-clinical-danger text-white border-clinical-danger'
                : 'bg-clinical-safe text-white border-clinical-safe'
              : 'bg-card text-muted-foreground border-border hover:bg-muted'
          }`}
          data-testid={`${idBase}-${v}`}
        >
          {v === 'yes' ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

const UtiConsultation = () => {
  const navigate = useNavigate();
  const { logEvent } = useConsultAudit();
  const [step, setStep] = useState<StepId>('patient');
  const [data, setData] = useState<UtiConsultationData>(emptyUtiData);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);

  // Protocol stamp — captured on every audit event and finalised note.
  const protocolStamp = useMemo(
    () => buildProtocolStamp({
      conditionSlug: utiTemplate.slug,
      conditionTemplateVersion: utiTemplate.conditionTemplateVersion,
      templateVersionNumber: utiTemplate.templateVersion,
      jurisdiction: utiTemplate.jurisdictions[0] ?? 'VIC',
      jurisdictionProtocolVersion: utiTemplate.jurisdictionProtocolVersion,
      protocolStatus: utiTemplate.protocolStatus,
      protocolSourceLabel: utiTemplate.protocolSourceLabel,
      protocolLastReviewed: utiTemplate.protocolLastReviewed,
    }),
    [],
  );

  // ── Load draft once ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setShowDraftPrompt(true);
    } catch { /* ignore */ }
  }, []);

  // ── Autosave ──
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);

  const restoreDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch { /* ignore */ }
    setShowDraftPrompt(false);
  }, []);

  const discardDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setData(emptyUtiData());
    setShowDraftPrompt(false);
  }, []);

  // ── Derived ──
  const scope = useMemo(() => evaluateScope(data), [data]);
  // Structured findings replace the old 0–100 safety score.
  const safetyFindings = useMemo(
    () => evaluateUtiFindings(data, data.selectedTreatment),
    [data],
  );
  const positiveRedFlags = useMemo(
    () => UTI_RED_FLAG_IDS.filter(id => data.redFlags[id] === 'yes'),
    [data.redFlags],
  );
  const unansweredRedFlags = useMemo(
    () => UTI_RED_FLAG_IDS.filter(id => !data.redFlags[id]),
    [data.redFlags],
  );

  // Persist scope + note inside data so completion checklist + downstream consumers can see it.
  useEffect(() => {
    setData(d => {
      if (d.scopeStatus === scope.status && JSON.stringify(d.scopeReasons) === JSON.stringify(scope.reasons)) return d;
      return { ...d, scopeStatus: scope.status, scopeReasons: scope.reasons };
    });
  }, [scope.status, scope.reasons]);

  const noteText = useMemo(
    () => utiTemplate.documentation.generate({ ...data, templateVersion: utiTemplate.templateVersion } as Record<string, unknown>),
    [data],
  );
  useEffect(() => {
    setData(d => (d.noteText === noteText ? d : { ...d, noteText }));
  }, [noteText]);

  // Patient data presence (for change-condition guard)
  const hasPatientData = useMemo(() =>
    !!(data.patient.firstName || data.patient.lastName || data.patient.dob ||
       Object.values(data.symptoms).some(Boolean) ||
       Object.values(data.redFlags).some(Boolean)),
    [data]);

  const handleChangeCondition = () => {
    if (hasPatientData && !window.confirm('Changing condition will discard this UTI consultation. Continue?')) return;
    discardDraft();
    navigate('/consultations/new');
  };

  // ── Step navigation ──
  const stepIndex = STEP_ORDER.findIndex(s => s.id === step);
  const goNext = () => {
    if (stepIndex < STEP_ORDER.length - 1) setStep(STEP_ORDER[stepIndex + 1].id);
  };
  const goPrev = () => {
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1].id);
  };

  // ── Field updaters ──
  const updatePatient = <K extends keyof UtiConsultationData['patient']>(k: K, v: UtiConsultationData['patient'][K]) =>
    setData(d => ({ ...d, patient: { ...d.patient, [k]: v } }));
  const updateSymptom = (k: string, v: unknown) =>
    setData(d => ({ ...d, symptoms: { ...d.symptoms, [k]: v } as UtiConsultationData['symptoms'] }));
  const updateRedFlag = (k: typeof UTI_RED_FLAG_IDS[number], v: 'yes' | 'no') =>
    setData(d => ({ ...d, redFlags: { ...d.redFlags, [k]: v } }));
  const toggleDifferential = (id: string, considered: boolean) =>
    setData(d => ({ ...d, differentials: { ...d.differentials, [id]: { ...d.differentials[id], considered } } }));
  const setDifferentialNote = (id: string, note: string) =>
    setData(d => ({ ...d, differentials: { ...d.differentials, [id]: { ...d.differentials[id], note } } }));
  const toggleCounselling = (id: string, on: boolean) =>
    setData(d => ({
      ...d,
      counsellingDone: on ? Array.from(new Set([...d.counsellingDone, id])) : d.counsellingDone.filter(x => x !== id),
    }));
  const selectTreatment = (t: TreatmentOptionDefinition | undefined) =>
    setData(d => ({ ...d, selectedTreatment: t }));

  // ── Completion checklist ──
  const completion = useMemo(() => {
    return utiTemplate.completionChecklist.map(item => ({
      ...item,
      done: item.isComplete(data as unknown as Record<string, unknown>),
    }));
  }, [data]);
  const readyToFinalise =
    completion.every(c => !c.required || c.done)
    && !safetyFindings.some(f => f.overridePolicy === 'non_overridable')
    && scope.status === 'in_scope';
  /**
   * Referral is a real clinical outcome. When the decision is a referral, the
   * consultation is finalisable once the outcome and safety-netting advice are
   * documented — NOT blocked waiting for a supply that must not happen.
   */
  const decision = useMemo(
    () => decideUti(data, data.selectedTreatment),
    [data],
  );
  const isReferralPathway =
    decision.outcome.prescribingBlocked || decision.outcome.kind !== 'treat';
  const readyAsReferral =
    isReferralPathway && !data.selectedTreatment && !!data.followUpPlan;

  const handover = useMemo(
    () => buildUtiHandover(data, data.selectedTreatment),
    [data],
  );

  return (
    <ClinicalLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="border-b bg-card px-4 sm:px-6 py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Stethoscope className="h-5 w-5 text-accent shrink-0" />
                <h1 className="text-base sm:text-lg font-bold truncate">New Consultation: Uncomplicated UTI</h1>
                <Badge className="clinical-badge clinical-badge-danger">Acute · {protocolStamp.jurisdiction}</Badge>
                <Badge variant="outline" className="text-[10px]" title={protocolStamp.protocolName}>
                  Template v{utiTemplate.conditionTemplateVersion} · {protocolStamp.jurisdictionProtocolVersion}
                </Badge>
                <Badge variant="outline" className={`text-[10px] capitalize ${
                  utiTemplate.protocolStatus === 'active' ? 'border-clinical-safe text-clinical-safe' :
                  utiTemplate.protocolStatus === 'draft' ? 'border-clinical-warning text-clinical-warning' :
                  utiTemplate.protocolStatus === 'needs_review' ? 'border-clinical-warning text-clinical-warning' :
                  'border-clinical-danger text-clinical-danger'
                }`}>
                  {utiTemplate.protocolStatus.replace('_', ' ')}
                </Badge>
                {/* Canonical lifecycle status + full provenance, from
                    src/clinical — not from the display template. */}
                <ProtocolStatusBadge
                  status={utiProtocol.lifecycle}
                  needsClinicalReview={utiProtocol.needsClinicalReview}
                />
                <ProtocolProvenancePopover protocol={utiProtocol} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Suspected uncomplicated lower UTI in non-pregnant adult women — Victorian pharmacist prescribing scope.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleChangeCondition} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Change condition
              </Button>
            </div>
          </div>
        </div>

        {/* Resume draft prompt */}
        {showDraftPrompt && (
          <div className="bg-accent/5 border-b border-accent/30 px-4 sm:px-6 py-2 flex items-center justify-between gap-2">
            <span className="text-xs">A previous UTI draft exists. Restore it?</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={discardDraft}>Discard</Button>
              <Button size="sm" onClick={restoreDraft}>Restore</Button>
            </div>
          </div>
        )}

        {/* Provenance / lifecycle honesty: this protocol is transcribed from a
            real source but has not been clinically signed off, so it renders as
            reference content rather than an approved pathway. */}
        <div className="px-4 sm:px-6 pt-3">
          <ProtocolReferenceModeBanner protocol={utiProtocol} compact />
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px]">
          {/* ── Main column ── */}
          <div className="overflow-auto p-4 sm:p-6 space-y-4">
            {/* Stepper */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {STEP_ORDER.map((s, i) => {
                const Icon = s.icon;
                const active = s.id === step;
                const blockerHere =
                  (s.id === 'treatment' && (positiveRedFlags.length > 0 || scope.status !== 'in_scope'));
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
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

            {step === 'patient' && (
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
                      <Label className="text-xs">Sex at birth *</Label>
                      <Select value={data.patient.sex ?? ''} onValueChange={(v) => updatePatient('sex', v as never)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="intersex">Intersex / other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Pregnancy status *</Label>
                      <Select
                        value={data.patient.pregnancyStatus ?? ''}
                        onValueChange={(v) => updatePatient('pregnancyStatus', v as never)}
                      >
                        <SelectTrigger><SelectValue placeholder="Confirm pregnancy status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_pregnant">Not pregnant</SelectItem>
                          <SelectItem value="pregnant">Pregnant</SelectItem>
                          <SelectItem value="possibly_pregnant">Possibly pregnant</SelectItem>
                          <SelectItem value="not_applicable">Not applicable</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        UTI in pregnancy is out of pharmacist scope — confirmation is required.
                      </p>
                    </div>
                  </div>

                  <Separator />
                  <div>
                    <Label className="text-xs">Allergies</Label>
                    <TagInput
                      value={parseTagString(data.patient.allergies)}
                      onChange={t => updatePatient('allergies', tagsToString(t))}
                      placeholder="e.g. trimethoprim, sulfa drugs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Current medicines</Label>
                    <TagInput
                      value={parseTagString(data.patient.currentMeds)}
                      onChange={t => updatePatient('currentMeds', tagsToString(t))}
                      placeholder="e.g. warfarin, methotrexate"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Relevant medical conditions</Label>
                    <TagInput
                      value={parseTagString(data.patient.relevantConditions)}
                      onChange={t => updatePatient('relevantConditions', tagsToString(t))}
                      placeholder="e.g. CKD, G6PD deficiency"
                    />
                  </div>

                  <Separator />
                  {/*
                    Consent is one of the protocol's ELIGIBILITY criteria and one
                    of its documentation requirements, so it belongs in the
                    clinical record rather than as a legal checkbox off to one
                    side. Without it the decision stays 'undecided'.
                  */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">Consent to participate</p>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="consent-program"
                        checked={data.consentToProgram === true}
                        onCheckedChange={v => setData(d => ({ ...d, consentToProgram: v === true }))}
                        className="mt-0.5"
                      />
                      <Label htmlFor="consent-program" className="text-xs leading-relaxed">
                        The patient consents to participate in the Community Pharmacist Program,
                        understands they pay the full cost of the medicine, and agrees to the
                        pharmacist communicating with their usual medical practitioner or practice
                        and accessing their My Health Record.
                      </Label>
                    </div>
                    <p
                      id="consent-program-help"
                      className={`text-[10px] ${
                        data.consentToProgram === true ? 'text-muted-foreground' : 'text-clinical-warning'
                      }`}
                    >
                      {data.consentToProgram === true
                        ? 'Consent recorded.'
                        : 'Not recorded — supply is not permitted under the protocol until consent is given.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'symptoms' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Presenting Complaint</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    ['dysuria', 'Dysuria (painful urination)'],
                    ['frequency', 'Urinary frequency'],
                    ['urgency', 'Urinary urgency'],
                    ['suprapubic', 'Suprapubic discomfort'],
                    ['haematuria', 'Haematuria (blood in urine)'],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-2 py-1 border-b border-border/40">
                      <Label className="text-xs">{label}</Label>
                      <YesNo
                        idBase={`sym-${key}`}
                        value={data.symptoms[key as keyof typeof data.symptoms] as 'yes' | 'no' | undefined}
                        onChange={v => updateSymptom(key, v)}
                      />
                    </div>
                  ))}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <Label className="text-xs">Symptom onset</Label>
                      <Input type="datetime-local" value={(data.symptoms.onset as string) ?? ''} onChange={e => updateSymptom('onset', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Duration</Label>
                      <Select value={(data.symptoms.duration as string) ?? ''} onValueChange={v => updateSymptom('duration', v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="<24h">Less than 24 hours</SelectItem>
                          <SelectItem value="1-3d">1–3 days</SelectItem>
                          <SelectItem value="4-7d">4–7 days</SelectItem>
                          <SelectItem value=">7d">More than 7 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">First or recurrent episode</Label>
                      <Select value={(data.symptoms.priorEpisode as string) ?? ''} onValueChange={v => updateSymptom('priorEpisode', v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first">First episode</SelectItem>
                          <SelectItem value="recurrent">Recurrent (≥2 in 6 months / ≥3 in 12 months)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Previous UTI history</Label>
                    <Textarea rows={2} value={(data.symptoms.previousUti as string) ?? ''} onChange={e => updateSymptom('previousUti', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Recent antibiotic use (last 3 months)</Label>
                    <Textarea rows={2} value={(data.symptoms.recentAntibiotics as string) ?? ''} onChange={e => updateSymptom('recentAntibiotics', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Self-treatment attempted</Label>
                    <Textarea rows={2} value={(data.symptoms.selfTreatment as string) ?? ''} onChange={e => updateSymptom('selfTreatment', e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'red-flags' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-clinical-danger" />
                    Red Flag Screening
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {UTI_RED_FLAG_IDS.length - unansweredRedFlags.length}/{UTI_RED_FLAG_IDS.length} answered
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {utiTemplate.redFlags.map(rf => {
                    const v = data.redFlags[rf.id as never] as 'yes' | 'no' | undefined;
                    const positive = v === 'yes';
                    return (
                      <div
                        key={rf.id}
                        className={`flex items-start justify-between gap-2 p-2 rounded-md border ${
                          positive ? 'border-clinical-danger/50 bg-clinical-danger-bg/40' : 'border-border'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{rf.label}</p>
                          {positive && (
                            <p className="text-[11px] text-clinical-danger mt-0.5">Action: {rf.action}</p>
                          )}
                        </div>
                        <YesNo idBase={`rf-${rf.id}`} value={v} onChange={(nv) => updateRedFlag(rf.id as never, nv)} />
                      </div>
                    );
                  })}
                  {positiveRedFlags.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg border-2 border-clinical-danger bg-clinical-danger-bg">
                      <div className="flex items-center gap-2 text-sm font-semibold text-clinical-danger">
                        <XCircle className="h-4 w-4" /> Out of scope — pharmacist prescribing blocked
                      </div>
                      <p className="text-[11px] text-clinical-danger/90 mt-1">
                        {positiveRedFlags.length} red flag{positiveRedFlags.length > 1 ? 's' : ''} positive.
                        Document referral below; assessment may still be completed.
                      </p>
                      <Textarea
                        className="mt-2"
                        rows={2}
                        placeholder="Referral details (where, when, why)…"
                        value={data.referralNotes ?? ''}
                        onChange={e => setData(d => ({ ...d, referralNotes: e.target.value }))}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 'scope' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Scope Validation</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className={`p-3 rounded-lg border-2 ${
                    scope.status === 'in_scope' ? 'border-clinical-safe bg-clinical-safe-bg' :
                    scope.status === 'out_of_scope' ? 'border-clinical-danger bg-clinical-danger-bg' :
                    'border-clinical-warning bg-clinical-warning-bg'
                  }`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {scope.status === 'in_scope' && <><CheckCircle className="h-4 w-4 text-clinical-safe" /> In scope</>}
                      {scope.status === 'needs_clarification' && <><AlertCircle className="h-4 w-4 text-clinical-warning" /> Needs clarification</>}
                      {scope.status === 'out_of_scope' && <><XCircle className="h-4 w-4 text-clinical-danger" /> Out of scope</>}
                    </div>
                    {scope.reasons.length > 0 && (
                      <ul className="text-[11px] mt-2 list-disc pl-5 space-y-0.5">
                        {scope.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {utiTemplate.scopeRules.map(rule => {
                      const result = rule.evaluate({
                        sex: data.patient.sex,
                        dob: data.patient.dob,
                        pregnancyStatus: data.patient.pregnancyStatus,
                        redFlags: data.redFlags,
                        symptoms: data.symptoms,
                      });
                      const ok = result?.status === 'in_scope';
                      return (
                        <div key={rule.id} className="flex items-center gap-2 text-xs">
                          {ok ? <CheckCircle className="h-3.5 w-3.5 text-clinical-safe" /> :
                            result?.status === 'out_of_scope' ? <XCircle className="h-3.5 w-3.5 text-clinical-danger" /> :
                            <AlertCircle className="h-3.5 w-3.5 text-clinical-warning" />}
                          <span>{rule.label}</span>
                          {result?.reason && <span className="text-muted-foreground">— {result.reason}</span>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'differentials' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Differentials</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {utiTemplate.differentials.map(d => {
                    const state = data.differentials[d.id] ?? {};
                    return (
                      <div key={d.id} className="p-2 rounded-md border border-border space-y-1.5">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={!!state.considered}
                            onCheckedChange={v => toggleDifferential(d.id, !!v)}
                            id={`diff-${d.id}`}
                          />
                          <div className="min-w-0 flex-1">
                            <Label htmlFor={`diff-${d.id}`} className="text-xs font-medium cursor-pointer">{d.label}</Label>
                            {d.whenToSuspect && (
                              <p className="text-[10px] text-muted-foreground">Suspect when: {d.whenToSuspect}</p>
                            )}
                          </div>
                          {d.referralOnHighSuspicion && (
                            <Badge variant="outline" className="text-[10px]">Refer if high</Badge>
                          )}
                        </div>
                        {state.considered && (
                          <Input
                            placeholder="Note (optional)"
                            value={state.note ?? ''}
                            onChange={e => setDifferentialNote(d.id, e.target.value)}
                            className="text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {step === 'treatment' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Treatment Decision Support
                    {scope.status !== 'in_scope' && (
                      <Badge className="clinical-badge clinical-badge-danger ml-auto">Treatment blocked</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scope.status !== 'in_scope' && (
                    <div className="p-2 rounded-md bg-clinical-warning-bg text-clinical-warning text-xs flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Resolve scope ({scope.reasons[0] ?? 'unknown'}) before selecting a therapy.
                    </div>
                  )}

                  {utiTemplate.treatments.map(t => {
                    const blockers = evaluateTreatmentBlockers(data, t);
                    const blocked = blockers.length > 0;
                    const selected = data.selectedTreatment?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-lg border ${
                          selected ? 'border-primary bg-primary/5' :
                          blocked ? 'border-clinical-danger/40' : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold">{t.medicineName}</p>
                              <Badge variant="outline" className="text-[10px] capitalize">{t.line}-line</Badge>
                              {t.pbsRestriction && (
                                <Badge variant="outline" className="text-[10px]">{t.pbsRestriction}</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {t.dose}, {t.frequency} for {t.duration} · qty {t.maxQuantity}, {t.repeats} repeats
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={selected ? 'default' : 'outline'}
                            disabled={blocked}
                            onClick={() => selectTreatment(selected ? undefined : t)}
                          >
                            {selected ? 'Selected' : blocked ? 'Blocked' : 'Select'}
                          </Button>
                        </div>

                        {blocked && (
                          <div className="mt-2 p-2 rounded bg-clinical-danger-bg text-[11px] text-clinical-danger space-y-0.5">
                            {blockers.map((b, i) => <div key={i} className="flex gap-1.5"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{b}</div>)}
                            {t.alternativeOptionId && (
                              <p className="mt-1">
                                Suggested alternative: <strong>{utiTemplate.treatments.find(o => o.id === t.alternativeOptionId)?.medicineName}</strong>
                              </p>
                            )}
                          </div>
                        )}

                        {selected && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <p className="font-medium">Cautions</p>
                              <ul className="list-disc pl-4 text-muted-foreground">
                                {(t.cautions ?? []).map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium">Counselling</p>
                              <ul className="list-disc pl-4 text-muted-foreground">
                                {t.counsellingPoints.map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <Separator />
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-xs">Follow-up plan *</Label>
                      <Textarea rows={2} value={data.followUpPlan ?? ''} onChange={e => setData(d => ({ ...d, followUpPlan: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Safety net advice *</Label>
                      <Textarea rows={2} value={data.safetyNet ?? ''} onChange={e => setData(d => ({ ...d, safetyNet: e.target.value }))} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'counselling' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Counselling Checklist</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {utiTemplate.counselling.map(c => {
                    const done = data.counsellingDone.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={done} onCheckedChange={v => toggleCounselling(c.id, !!v)} />
                        <span className="text-xs">{c.label}{c.required && <span className="text-clinical-danger ml-1">*</span>}</span>
                      </label>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Required only when treatment is supplied. Tick off as you counsel the patient.
                  </p>
                </CardContent>
              </Card>
            )}

            {step === 'documentation' && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Clinical Note (UTI-specific)</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-[12px] leading-relaxed whitespace-pre-wrap p-3 rounded-md bg-muted font-mono">
                    {noteText}
                  </pre>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(noteText); toast.success('Note copied'); }}>
                      Copy note
                    </Button>
                    <Button
                      size="sm"
                      disabled={isFinalising || (!readyToFinalise && !readyAsReferral)}
                      onClick={async () => {
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
                            condition_id: utiTemplate.id,
                            condition_name: utiTemplate.name,
                            red_flags_checked: data.redFlags,
                            red_flag_triggered: positiveRedFlags.length > 0,
                            assessment_data: {
                              symptoms: data.symptoms,
                              differentials: data.differentials,
                              scopeStatus: data.scopeStatus,
                              scopeReasons: data.scopeReasons,
                              counsellingDone: data.counsellingDone,
                              __conditionSlug: utiTemplate.slug,
                              __templateVersion: utiTemplate.templateVersion,
                            },
                            selected_therapy_id: data.selectedTreatment?.id ?? null,
                            follow_up_plan: data.followUpPlan ?? null,
                            safety_net_advice: data.safetyNet ?? null,
                            referral_notes: data.referralNotes ?? null,
                            full_note_text: noteWithFooter,
                            finalised_at: new Date().toISOString(),
                            // Legacy + new flat columns
                            template_version: utiTemplate.templateVersion,
                            protocol_jurisdiction: protocolStamp.protocolJurisdiction,
                            protocol_jurisdiction_version: protocolStamp.jurisdictionProtocolVersion,
                            protocol_name: protocolStamp.protocolName,
                            condition_slug: utiTemplate.slug,
                            condition_template_version: utiTemplate.conditionTemplateVersion,
                            jurisdiction: protocolStamp.jurisdiction,
                            protocol_source_label: utiTemplate.protocolSourceLabel ?? null,
                            protocol_last_reviewed: utiTemplate.protocolLastReviewed ?? null,
                            protocol_status: utiTemplate.protocolStatus,
                            finalised_note: noteWithFooter,
                            finalised_note_protocol_snapshot: {
                              ...protocolStamp,
                              capturedAt: new Date().toISOString(),
                            },
                          };

                          const { data: inserted, error } = await (supabase.from('consultations') as any)
                            .insert(insertPayload)
                            .select('id')
                            .single();

                          // Audit even if insert fails — local store always captures it.
                          const consultId = inserted?.id ?? `local-${Date.now()}`;
                          await logEvent(consultId, 'finalise_started', { protocol: protocolStamp });
                          if (error) {
                            await logEvent(consultId, 'finalise_failed', {
                              errorReason: error.message,
                              protocol: protocolStamp,
                            });
                            toast.success(isReferral ? 'Referral consultation finalised (offline)' : 'UTI consultation finalised (offline)');
                          } else {
                            await logEvent(consultId, 'finalise_succeeded', {
                              protocol: protocolStamp,
                              metadata: { isReferral },
                            });
                            toast.success(isReferral ? 'Referral consultation finalised' : 'UTI consultation finalised');
                          }
                          discardDraft();
                          navigate('/prescribing-log');
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : 'Unknown error';
                          await logEvent(`local-${Date.now()}`, 'finalise_failed', {
                            errorReason: msg,
                            protocol: protocolStamp,
                          });
                          toast.error(`Finalisation failed: ${msg}`);
                        } finally {
                          setIsFinalising(false);
                        }
                      }}
                    >
                      {isFinalising ? 'Finalising…' : 'Finalise consultation'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step nav */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" disabled={stepIndex === 0} onClick={goPrev} className="gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <Button size="sm" disabled={stepIndex === STEP_ORDER.length - 1} onClick={goNext} className="gap-1.5">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Right rail ── */}
          <aside className="border-l bg-card overflow-auto p-4 space-y-4 hidden lg:block">
            {/* Safety findings — structured, not a 0–100 score */}
            <SafetyFindingsPanel findings={safetyFindings} />

            <Separator />

            {/* Outcome + referral / handover */}
            <ReferralPanel
              outcome={decision.outcome}
              handover={handover}
              readOnly={!isReferralPathway}
            />

            <Separator />

            {/* Completion readiness */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Completion Readiness</h3>
              <div className={`flex items-center gap-2 p-2 rounded text-xs font-medium mb-2 ${
                readyToFinalise || readyAsReferral
                  ? 'bg-clinical-safe/10 text-clinical-safe'
                  : 'bg-clinical-warning-bg text-clinical-warning'
              }`}>
                {readyToFinalise ? <><CheckCircle className="h-3.5 w-3.5" /> Ready to finalise</> :
                 readyAsReferral ? <><CheckCircle className="h-3.5 w-3.5" /> Ready (referral pathway)</> :
                 <><AlertCircle className="h-3.5 w-3.5" /> {completion.filter(c => c.required && !c.done).length} item(s) remaining</>}
              </div>
              <ul className="space-y-1 text-[11px]">
                {completion.map(c => (
                  <li key={c.id} className="flex items-center gap-2">
                    {c.done ? <CheckCircle className="h-3 w-3 text-clinical-safe" /> : <AlertCircle className="h-3 w-3 text-muted-foreground" />}
                    <span className={c.done ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Live note */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Live Clinical Note</h3>
              <pre className="text-[10.5px] leading-relaxed whitespace-pre-wrap p-2 rounded bg-muted font-mono max-h-72 overflow-auto">
                {noteText}
              </pre>
            </div>
          </aside>
        </div>
      </div>
    </ClinicalLayout>
  );
};

export default UtiConsultation;
