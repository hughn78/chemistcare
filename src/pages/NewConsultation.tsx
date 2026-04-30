import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PatientEducationPanel } from '@/components/clinical-api/PatientEducationPanel';
import { MedicineDetailDrawer } from '@/components/clinical-api/MedicineDetailDrawer';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FloatingInput, FloatingSelectWrapper } from '@/components/ui/floating-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CONDITIONS, getConditionById } from '@/data/conditions';
import {
  CONDITION_REGISTRY,
  getConditionBySlug,
  getRegistryEntryById,
} from '@/lib/conditionRegistry';
import { recordRecentCondition } from '@/pages/ConsultationPicker';
import { CONSULTATION_STEPS, ConsultationStep } from '@/types/clinical';
import { useAutosave } from '@/hooks/useAutosave';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { validateStep, StepChecklist, SaveStatus, computeStepStatus, StepStatus } from '@/components/ConsultationValidation';
import { FormPageSkeleton } from '@/components/PageSkeleton';
import { ConsultStatusBar } from '@/components/consult/ConsultStatusBar';
import { LiveNotePreview } from '@/components/consult/LiveNotePreview';
import { EvidenceDrawer } from '@/components/consult/EvidenceDrawer';
import { SafetyChecksCard } from '@/components/consult/SafetyChecksCard';
import { SafetyOverrideDialog } from '@/components/consult/SafetyOverrideDialog';
import { ApplyTemplateDialog } from '@/components/consult/ApplyTemplateDialog';
import { ScribeRecorder } from '@/components/scribe/ScribeRecorder';
import { ReviewPanel } from '@/components/consult/ReviewPanel';
import { SketchPad } from '@/components/consult/SketchPad';
import { ConsultStatus, transitionConsult } from '@/lib/consultStateMachine';
import { useConsultAudit } from '@/hooks/useConsultAudit';
import { evaluateSafety } from '@/lib/safetyEngine';
import { logValidationBlocker } from '@/lib/qaTelemetry';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle, CheckCircle, XCircle, ChevronRight, ChevronLeft,
  Shield, Pill, FileText, User, Stethoscope, Brain, Lock, RotateCcw, Trash2, LayoutTemplate,
  Circle, ChevronDown, Pen, AlertCircle, Repeat,
} from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { CalculatorsDialog } from '@/components/CalculatorsDialog';
import { AnatomyDialog } from '@/components/AnatomyDialog';
import { TagInput, parseTagString, tagsToString } from '@/components/ui/tag-input';
import type { SafetyResult, SafetyOverride } from '@/types/safety';
import type { ConsultTemplate } from '@/types/templates';

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ValidationResult } from '@/components/ConsultationValidation';

const DRAFT_KEY = 'chemistcare_consultation_draft';

interface DraftState {
  formData: Record<string, string>;
  selectedCondition: string;
  redFlagsChecked: Record<string, boolean>;
  differentials: { diagnosis: string; reasonExcluded: string }[];
  currentStep: ConsultationStep;
  pinnedEvidence: { question: string; answer: string; sources: string[] }[];
  noteHeadings?: string[];
  safetyOverride?: SafetyOverride;
}

/* ── Completion Readiness Panel ── */
function CompletionReadinessPanel({
  allStepValidations,
  safetyResult,
  safetyOverride,
}: {
  allStepValidations: { step: ConsultationStep; label: string; validation: ValidationResult }[];
  safetyResult: SafetyResult;
  safetyOverride?: SafetyOverride;
}) {
  const allComplete = allStepValidations.every(s => s.validation.complete || s.validation.total === 0);
  const hasUnresolvedBlockers = safetyResult.blockers.length > 0 && !safetyOverride;
  const readyToFinalise = allComplete && !hasUnresolvedBlockers;
  const totalMissing = allStepValidations.reduce((sum, s) => sum + s.validation.missing.length, 0);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completion Readiness</h3>
      
      {/* Ready indicator */}
      <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${
        readyToFinalise 
          ? 'bg-clinical-safe/10 text-clinical-safe' 
          : 'bg-clinical-warning-bg text-clinical-warning'
      }`}>
        {readyToFinalise ? (
          <><CheckCircle className="h-4 w-4" /> Ready to finalise</>
        ) : (
          <><AlertCircle className="h-4 w-4" /> {totalMissing} field{totalMissing !== 1 ? 's' : ''} remaining</>
        )}
      </div>

      {/* Per-step summary */}
      <div className="space-y-1.5 text-xs">
        {allStepValidations.map(s => {
          if (s.validation.total === 0) return null;
          return (
            <div key={s.step} className="flex items-center justify-between">
              <span className="text-muted-foreground">{s.label}</span>
              {s.validation.complete ? (
                <CheckCircle className="h-3.5 w-3.5 text-clinical-safe" />
              ) : (
                <span className="tabular-nums text-clinical-warning">
                  {s.validation.filled}/{s.validation.total}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Safety risk flags */}
      {safetyResult.blockers.length > 0 && (
        <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
          safetyOverride ? 'bg-muted text-muted-foreground' : 'bg-clinical-danger-bg text-clinical-danger'
        }`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {safetyOverride
            ? `${safetyResult.blockers.length} safety blocker${safetyResult.blockers.length !== 1 ? 's' : ''} (overridden)`
            : `${safetyResult.blockers.length} unresolved safety blocker${safetyResult.blockers.length !== 1 ? 's' : ''}`
          }
        </div>
      )}
    </div>
  );
}

/* ── Step Progress Panel (deterministic) ── */
function StepProgressPanel({ getStepStatus, getStepValidation }: {
  getStepStatus: (step: ConsultationStep) => StepStatus;
  getStepValidation: (step: ConsultationStep) => ValidationResult;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full group">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step Progress</h3>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2.5 mt-3 text-xs">
          {CONSULTATION_STEPS.map(s => {
            const status = getStepStatus(s.key);
            const validation = getStepValidation(s.key);
            const pct = validation.total > 0 ? Math.round((validation.filled / validation.total) * 100) : (status === 'complete' ? 100 : 0);

            const statusLabel = status === 'complete' ? 'Complete' 
              : status === 'needs_attention' ? 'Needs Attention'
              : status === 'active' ? 'In Progress'
              : status === 'blocked' ? 'Blocked'
              : 'Incomplete';

            return (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {status === 'complete' ? (
                      <CheckCircle className="h-3.5 w-3.5" style={{ color: 'hsl(var(--clinical-safe))' }} />
                    ) : status === 'active' ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-primary pulse-ring" style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }} />
                    ) : status === 'blocked' ? (
                      <XCircle className="h-3.5 w-3.5 text-clinical-danger" />
                    ) : status === 'needs_attention' ? (
                      <AlertCircle className="h-3.5 w-3.5 text-clinical-warning" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
                    )}
                    <span className={status === 'active' ? 'font-medium text-foreground' : status === 'complete' ? 'text-foreground/70' : 'text-muted-foreground'}>{s.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] ${
                      status === 'complete' ? 'text-clinical-safe' 
                      : status === 'needs_attention' ? 'text-clinical-warning'
                      : 'text-muted-foreground/50'
                    }`}>{statusLabel}</span>
                    {validation.total > 0 && (
                      <span className={`tabular-nums ${validation.complete ? 'text-clinical-safe' : 'text-muted-foreground'}`}>
                        {validation.filled}/{validation.total}
                      </span>
                    )}
                  </div>
                </div>
                {/* Thin progress bar */}
                <div className="h-1 rounded-full bg-muted ml-5.5" style={{ marginLeft: '22px' }}>
                  <div
                    className="h-full rounded-full step-progress-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: status === 'complete' ? 'hsl(var(--clinical-safe))' 
                        : status === 'needs_attention' ? 'hsl(var(--clinical-warning))'
                        : pct > 0 ? 'hsl(var(--primary))' : 'transparent',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const NewConsultation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logEvent } = useConsultAudit();
  const params = useParams<{ conditionSlug?: string }>();

  // Resolve condition strictly from the URL slug. Fall back to the legacy
  // `?condition=<id>` query only for backward compatibility with older links
  // (e.g. ConditionDetail) — never to a hardcoded default.
  const slugFromRoute = params.conditionSlug;
  const legacyConditionId = !slugFromRoute ? searchParams.get('condition') : null;
  const initialCondition = (() => {
    if (slugFromRoute) {
      const entry = getConditionBySlug(slugFromRoute);
      return entry?.id ?? '';
    }
    if (legacyConditionId) {
      const entry = getRegistryEntryById(legacyConditionId);
      return entry?.id ?? '';
    }
    return '';
  })();

  // Hard guard: an explicit slug that doesn't resolve must redirect to the
  // picker — we never silently fall back to Travel Medicine or any other
  // pathway. (See the "Hard Requirements" in the New Consultation spec.)
  useEffect(() => {
    if (slugFromRoute && !getConditionBySlug(slugFromRoute)) {
      navigate(`/consultations/new?error=${encodeURIComponent('Unknown consultation type — please pick one below.')}`, { replace: true });
    } else if (!slugFromRoute && !legacyConditionId) {
      // Reached `/consultation` (legacy) without a condition — bounce to picker.
      navigate('/consultations/new', { replace: true });
    }
  }, [slugFromRoute, legacyConditionId, navigate]);

  const [currentStep, setCurrentStep] = useState<ConsultationStep>('patient');
  const [selectedCondition, setSelectedCondition] = useState(initialCondition);
  const [redFlagsChecked, setRedFlagsChecked] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [differentials, setDifferentials] = useState([{ diagnosis: '', reasonExcluded: '' }]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [consultStatus, setConsultStatus] = useState<ConsultStatus>('draft');
  const [consultId, setConsultId] = useState<string | undefined>();
  const [finalisedAt, setFinalisedAt] = useState<string | undefined>();
  const [pinnedEvidence, setPinnedEvidence] = useState<{ question: string; answer: string; sources: string[] }[]>([]);
  const [attemptedProgress, setAttemptedProgress] = useState(false);

  // Safety state
  const [safetyResult, setSafetyResult] = useState<SafetyResult>({ score: 100, alerts: [], blockers: [] });
  const [safetyOverride, setSafetyOverride] = useState<SafetyOverride | undefined>();
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const prevBlockerCount = useRef(0);

  // Template state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [noteHeadings, setNoteHeadings] = useState<string[]>([]);

  // Sketch pad state
  const [showSketchPad, setShowSketchPad] = useState(false);
  const [savedSketches, setSavedSketches] = useState<{ dataUrl: string; timestamp: string }[]>([]);

  const condition = useMemo(() => getConditionById(selectedCondition), [selectedCondition]);
  const registryEntry = useMemo(() => getRegistryEntryById(selectedCondition), [selectedCondition]);
  const stepIndex = CONSULTATION_STEPS.findIndex(s => s.key === currentStep);
  const hasRedFlagTriggered = Object.values(redFlagsChecked).some(Boolean);
  const canProceedFromAssessment = !hasRedFlagTriggered;

  // Patient data is "in progress" once any clinical/identity field has been
  // touched. Used to gate the "Change condition" action with a confirm.
  const patientDataExists = useMemo(() => {
    return ['firstName', 'lastName', 'dob', 'allergies', 'medications', 'comorbidities'].some(
      k => (formData[k] || '').trim().length > 0,
    ) || differentials.some(d => d.diagnosis.trim()) || Object.values(redFlagsChecked).some(Boolean);
  }, [formData, differentials, redFlagsChecked]);

  // Track this condition in "recently used" the moment we render a real
  // consultation so the picker can surface it. Idempotent per slug.
  useEffect(() => {
    if (registryEntry?.slug) {
      recordRecentCondition(registryEntry.slug);
    }
  }, [registryEntry?.slug]);

  const handleChangeCondition = useCallback(() => {
    if (patientDataExists) {
      const ok = window.confirm(
        'Changing condition will discard the current consultation data. Continue?',
      );
      if (!ok) return;
    }
    // Clear all in-progress state and bounce to picker.
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    navigate('/consultations/new');
  }, [patientDataExists, navigate]);

  // Re-evaluate safety whenever relevant inputs change
  useEffect(() => {
    const allergies = parseTagString(formData.allergies);
    const currentMeds = parseTagString(formData.medications);
    const selectedTreatments: string[] = [];

    if (formData.selectedTherapy && condition) {
      const therapy = condition.therapyOptions.find(t => t.id === formData.selectedTherapy);
      if (therapy) selectedTreatments.push(therapy.medicineName);
    }

    const result = evaluateSafety({
      allergies,
      currentMeds,
      selectedTreatments,
      sex: formData.sex,
      pregnancyStatus: formData.pregnancy,
    });

    setSafetyResult(result);

    // Audit: blocker count went from 0 to >0
    if (result.blockers.length > 0 && prevBlockerCount.current === 0) {
      const cId = consultId || 'draft';
      logEvent(cId, 'safety_blocker_triggered', {
        metadata: { blockerCount: result.blockers.length, blockerTitles: result.blockers.map(b => b.title) },
      });
    }
    prevBlockerCount.current = result.blockers.length;

    // Clear override if blockers change
    if (result.blockers.length === 0) {
      setSafetyOverride(undefined);
    }
  }, [formData.allergies, formData.medications, formData.selectedTherapy, formData.sex, formData.pregnancy, condition]);

  // Draft state for autosave
  const draftState: DraftState = useMemo(() => ({
    formData, selectedCondition, redFlagsChecked, differentials, currentStep, pinnedEvidence, noteHeadings, safetyOverride,
  }), [formData, selectedCondition, redFlagsChecked, differentials, currentStep, pinnedEvidence, noteHeadings, safetyOverride]);

  const isDirty = useMemo(() => {
    return consultStatus !== 'finalised' && consultStatus !== 'discarded' &&
      (Object.keys(formData).length > 0 || selectedCondition !== '' || differentials.some(d => d.diagnosis.trim()));
  }, [formData, selectedCondition, differentials, consultStatus]);

  const { lastSaved, isSaving, loadDraft, clearDraft, hasDraft } = useAutosave(DRAFT_KEY, draftState, isLoaded && isDirty);

  // Navigation guard
  useNavigationGuard(isDirty, 'You have unsaved consultation data. Are you sure you want to leave?');

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleNextStep();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStep, formData, selectedCondition]);

  // Load draft on mount
  useEffect(() => {
    if (hasDraft()) {
      setShowDraftPrompt(true);
    }
    setIsLoaded(true);
  }, []);

  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      setFormData(draft.formData || {});
      setSelectedCondition(draft.selectedCondition || '');
      setRedFlagsChecked(draft.redFlagsChecked || {});
      setDifferentials(draft.differentials?.length ? draft.differentials : [{ diagnosis: '', reasonExcluded: '' }]);
      setCurrentStep(draft.currentStep || 'patient');
      setPinnedEvidence(draft.pinnedEvidence || []);
      setNoteHeadings(draft.noteHeadings || []);
      setSafetyOverride(draft.safetyOverride);
    }
    setShowDraftPrompt(false);
  }, [loadDraft]);

  /** Idempotent full discard — clears ALL state */
  const handleDiscard = useCallback(() => {
    const cId = consultId;
    
    // Reset all React state to pristine
    setFormData({});
    setSelectedCondition('');
    setRedFlagsChecked({});
    setDifferentials([{ diagnosis: '', reasonExcluded: '' }]);
    setCurrentStep('patient');
    setPinnedEvidence([]);
    setConsultStatus('draft');
    setConsultId(undefined);
    setFinalisedAt(undefined);
    setAttemptedProgress(false);
    setSafetyOverride(undefined);
    setNoteHeadings([]);
    setSavedSketches([]);
    setShowDraftPrompt(false);

    // Clear all storage artefacts
    clearDraft();
    try {
      localStorage.removeItem(DRAFT_KEY);
      // Clear any session-scoped draft keys
      sessionStorage.removeItem('chemistcare:active_consult_id');
    } catch {
      // Storage unavailable
    }

    if (cId) {
      logEvent(cId, 'draft_discarded');
    }
  }, [consultId, clearDraft, logEvent]);

  const discardDraftPrompt = useCallback(() => {
    clearDraft();
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setShowDraftPrompt(false);
  }, [clearDraft]);

  const updateField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }));
  const toggleRedFlag = (id: string) => setRedFlagsChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const stepIcons: Record<ConsultationStep, typeof User> = {
    patient: User, assessment: Stethoscope, differentials: Brain,
    scope: Shield, treatment: Pill, documentation: FileText,
  };

  /** Deterministic step status using actual validation */
  const getStepValidation = useCallback((step: ConsultationStep) => {
    return validateStep(step, formData, condition, redFlagsChecked, differentials, selectedCondition);
  }, [formData, condition, redFlagsChecked, differentials, selectedCondition]);

  const getStepStatus = useCallback((step: ConsultationStep): StepStatus => {
    const validation = getStepValidation(step);
    const isBlocked = step === 'assessment' && hasRedFlagTriggered;
    return computeStepStatus(step, currentStep, validation, isBlocked);
  }, [getStepValidation, currentStep, hasRedFlagTriggered]);

  // All step validations for readiness panel
  const allStepValidations = useMemo(() => {
    return CONSULTATION_STEPS.map(s => ({
      step: s.key,
      label: s.label,
      validation: getStepValidation(s.key),
    }));
  }, [getStepValidation]);

  // Compute all validation blockers for status bar
  const validationBlockers = useMemo(() => {
    const blockers: string[] = [];
    allStepValidations.forEach(s => {
      blockers.push(...s.validation.missing);
    });
    if (safetyResult.blockers.length > 0 && !safetyOverride) {
      blockers.push('Safety blockers unresolved');
    }
    return blockers;
  }, [allStepValidations, safetyResult, safetyOverride]);

  // Safety-aware treatment progression check
  const hasSafetyBlock = safetyResult.blockers.length > 0 && !safetyOverride;

  const handleNextStep = () => {
    const steps = CONSULTATION_STEPS;
    const currentIdx = steps.findIndex(s => s.key === currentStep);
    const validation = getStepValidation(currentStep);

    if (!validation.complete && currentStep === 'patient') {
      setAttemptedProgress(true);
      // QA telemetry: log each blocker
      const cId = consultId || 'draft';
      validation.missing.forEach(field => {
        logValidationBlocker(cId, 'patient', field, 'required_field_missing');
      });
      toast({
        title: 'Required fields missing',
        description: validation.missing.join(', '),
        variant: 'destructive',
      });
      return;
    }

    // Block progression past treatment if safety blockers exist
    if (currentStep === 'treatment' && hasSafetyBlock) {
      toast({
        title: 'Safety blockers detected',
        description: 'Resolve safety blockers or apply a clinical override before proceeding.',
        variant: 'destructive',
      });
      return;
    }

    if (currentIdx < steps.length - 1) {
      if (currentStep === 'assessment' && hasRedFlagTriggered) {
        setCurrentStep('documentation');
        return;
      }
      const nextStep = steps[currentIdx + 1];
      sonnerToast.success(`${steps[currentIdx].label} saved ✓`, { duration: 3000, position: 'bottom-right' });
      setCurrentStep(nextStep.key);
    }
  };

  const handlePinEvidence = (evidence: { question: string; answer: string; sources: string[] }) => {
    setPinnedEvidence(prev => [...prev, evidence]);
    toast({ title: 'Evidence pinned to consult' });
    if (consultId) {
      logEvent(consultId, 'evidence_pinned', { metadata: { question: evidence.question } });
    }
  };

  const handleSafetyOverride = (override: SafetyOverride) => {
    setSafetyOverride(override);
    const cId = consultId || 'draft';
    logEvent(cId, 'safety_override_applied', {
      metadata: { reason: override.reason, blockerCount: safetyResult.blockers.length },
    });
    toast({ title: 'Safety override applied', description: 'You may now proceed with treatment.' });
  };

  const handleApplyTemplate = (template: ConsultTemplate) => {
    const p = template.prefill;
    setFormData(prev => {
      const next = { ...prev };
      if (p.allergies?.length) next.allergies = tagsToString([...parseTagString(prev.allergies), ...p.allergies.filter(a => !parseTagString(prev.allergies).includes(a))]);
      if (p.currentMeds?.length) next.medications = tagsToString([...parseTagString(prev.medications), ...p.currentMeds.filter(m => !parseTagString(prev.medications).includes(m))]);
      if (p.comorbidities?.length) next.comorbidities = tagsToString([...parseTagString(prev.comorbidities), ...p.comorbidities.filter(c => !parseTagString(prev.comorbidities).includes(c))]);
      return next;
    });

    if (p.differentials?.length) {
      setDifferentials(prev => {
        const existing = prev.filter(d => d.diagnosis.trim());
        const newOnes = p.differentials!.filter(d => !existing.some(e => e.diagnosis === d)).map(d => ({ diagnosis: d, reasonExcluded: '' }));
        return [...existing, ...newOnes, { diagnosis: '', reasonExcluded: '' }];
      });
    }

    if (p.noteHeadings?.length) {
      setNoteHeadings(prev => {
        const merged = [...prev];
        for (const h of p.noteHeadings!) {
          if (!merged.includes(h)) merged.push(h);
        }
        return merged;
      });
    }

    const cId = consultId || 'draft';
    logEvent(cId, 'template_applied', { metadata: { templateName: template.name, templateId: template.id } });
    toast({ title: `Template applied: ${template.name}` });
  };

  const handleFinalise = async (): Promise<{ success: boolean; consultId?: string; error?: string }> => {
    // Block if safety blockers unresolved
    if (hasSafetyBlock) {
      return { success: false, error: 'Safety blockers must be resolved or overridden before finalising.' };
    }

    const nextStatus = transitionConsult(consultStatus, 'SUBMIT') || transitionConsult(consultStatus, 'VALIDATE');
    if (!nextStatus && consultStatus !== 'draft') {
      return { success: false, error: `Cannot finalise from status: ${consultStatus}` };
    }

    setConsultStatus('submitting');

    try {
      const consultData = {
        status: 'finalised',
        patient_first_name: formData.firstName || null,
        patient_last_name: formData.lastName || null,
        patient_dob: formData.dob || null,
        patient_sex: formData.sex || null,
        patient_pregnancy_status: formData.pregnancy || null,
        patient_allergies: formData.allergies || null,
        patient_medications: formData.medications || null,
        patient_comorbidities: formData.comorbidities || null,
        gp_name: formData.gpName || null,
        gp_clinic: formData.gpClinic || null,
        gp_phone: formData.gpPhone || null,
        condition_id: selectedCondition || null,
        condition_name: condition?.name || null,
        red_flags_checked: redFlagsChecked,
        red_flag_triggered: hasRedFlagTriggered,
        referral_notes: formData.referralNotes || null,
        // `condition_slug` and `template_version` are stored inside the
        // existing `assessment_data` jsonb to avoid a schema migration. Once
        // the consultations table grows dedicated columns, promote them.
        assessment_data: {
          ...Object.fromEntries(
            Object.entries(formData).filter(([k]) => k.startsWith('assess_'))
          ),
          __conditionSlug: registryEntry?.slug ?? null,
          __templateVersion: registryEntry?.templateVersion ?? null,
        },
        working_diagnosis: formData.workingDiagnosis || null,
        differentials: differentials.filter(d => d.diagnosis.trim()),
        selected_therapy_id: formData.selectedTherapy || null,
        deviation_justification: formData.deviationJustification || null,
        follow_up_plan: formData.followUpPlan || null,
        safety_net_advice: formData.safetyNet || null,
        clinical_notes: formData.clinicalNotes || null,
        pinned_evidence: pinnedEvidence,
        finalised_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase.from('consultations') as any)
        .insert(consultData)
        .select('id, finalised_at')
        .single();

      if (error) throw error;

      const newId = data.id;
      setConsultId(newId);
      setFinalisedAt(data.finalised_at);
      setConsultStatus('finalised');

      await logEvent(newId, 'finalise_succeeded');
      clearDraft();

      return { success: true, consultId: newId };
    } catch (err: any) {
      setConsultStatus('validated');
      const errorMsg = err?.message || 'Unknown error';

      if (consultId) {
        await logEvent(consultId, 'finalise_failed', { errorReason: errorMsg });
      }

      return { success: false, error: errorMsg };
    }
  };

  if (!isLoaded) return <ClinicalLayout><FormPageSkeleton /></ClinicalLayout>;

  return (
    <ClinicalLayout>
      {/* Sticky status bar */}
      <ConsultStatusBar
        status={consultStatus}
        currentStep={currentStep}
        conditionName={condition?.name}
        lastSaved={lastSaved}
        isSaving={isSaving}
        validationBlockers={validationBlockers}
        patientName={formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}` : undefined}
      />

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-6.5rem)]">
        {/* Main content */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <div key={currentStep} className="max-w-3xl space-y-5 slide-enter">

            {/* Draft restore prompt */}
            {showDraftPrompt && (
              <Card className="border-accent/40 bg-accent/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RotateCcw className="h-5 w-5 text-accent" />
                    <div>
                      <p className="text-sm font-medium">Unsaved draft found</p>
                      <p className="text-xs text-muted-foreground">Would you like to resume your previous consultation?</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={discardDraftPrompt} className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Discard
                    </Button>
                    <Button size="sm" onClick={restoreDraft} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> Resume Draft
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Condition header — proves to the pharmacist exactly which
                protocol pathway is loaded, and offers a confirm-protected
                way to switch back to the picker. */}
            {condition && registryEntry && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    New Consultation
                  </p>
                  <h1 className="text-base sm:text-lg font-bold truncate">
                    {condition.name}
                  </h1>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Victorian pharmacist prescriber pathway · {registryEntry.redFlagCount} red flags · {registryEntry.treatmentOptionCount} treatment options
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={handleChangeCondition}
                >
                  <Repeat className="h-3.5 w-3.5" /> Change condition
                </Button>
              </div>
            )}

            {/* Step indicator + tools */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {CONSULTATION_STEPS.map((step, i) => {
                  const status = getStepStatus(step.key);
                  const Icon = stepIcons[step.key];
                  const validation = getStepValidation(step.key);
                  return (
                    <div key={step.key} className="flex items-center">
                      <button
                        onClick={() => {
                          if (status !== 'incomplete' && status !== 'blocked') setCurrentStep(step.key);
                        }}
                        disabled={status === 'incomplete' && step.key !== currentStep}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          status === 'active' ? 'bg-accent/10 text-accent' :
                          status === 'complete' ? 'text-clinical-safe hover:bg-muted' :
                          status === 'needs_attention' ? 'text-clinical-warning hover:bg-muted' :
                          status === 'blocked' ? 'text-clinical-danger' :
                          'text-muted-foreground'
                        }`}
                      >
                        <div className={`step-indicator w-6 h-6 text-[10px] ${
                          status === 'active' ? 'step-active' :
                          status === 'complete' ? 'step-complete' :
                          status === 'needs_attention' ? 'step-active' :
                          status === 'blocked' ? 'step-blocked' : 'step-pending'
                        }`}>
                          {status === 'complete' ? <CheckCircle className="h-3.5 w-3.5" /> :
                           status === 'blocked' ? <Lock className="h-3.5 w-3.5" /> :
                           status === 'needs_attention' ? <AlertCircle className="h-3.5 w-3.5" /> :
                           <Icon className="h-3.5 w-3.5" />}
                        </div>
                        <span className="hidden sm:inline">{step.label}</span>
                        {(status === 'active' || status === 'needs_attention') && validation.total > 0 && (
                          <StepChecklist validation={validation} compact />
                        )}
                      </button>
                      {i < CONSULTATION_STEPS.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scribe recorder + all tool buttons row */}
            <div className="flex items-center gap-2 flex-wrap">
              <ScribeRecorder compact className="px-1" onTranscriptChange={(text) => {
                if (text) setFormData(prev => ({ ...prev, clinicalNotes: text }));
              }} />
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)} className="gap-1.5 text-xs">
                  <LayoutTemplate className="h-3.5 w-3.5" /> Template
                </Button>
                <EvidenceDrawer conditionName={condition?.name} onPinEvidence={handlePinEvidence} />
                <Button variant="outline" size="sm" onClick={() => setShowSketchPad(true)} className="gap-1.5 text-xs">
                  <Pen className="h-3.5 w-3.5" /> Sketch Pad
                </Button>
                <CalculatorsDialog />
                <AnatomyDialog />
              </div>
            </div>

            {/* Step 1: Patient */}
            {currentStep === 'patient' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Patient Profile</h2>
                  {(() => {
                    const v = getStepValidation('patient');
                    return (
                      <span className={`text-xs font-semibold tabular-nums ${v.complete ? 'text-clinical-safe' : 'text-muted-foreground'}`}>
                        {v.complete ? (
                          <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Complete</span>
                        ) : (
                          <span>{v.filled}/{v.total} fields</span>
                        )}
                      </span>
                    );
                  })()}
                </div>

                {/* Patient Identity */}
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Patient Identity</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FloatingInput
                        label="First Name"
                        required
                        value={formData.firstName || ''}
                        onChange={e => updateField('firstName', e.target.value)}
                        error={attemptedProgress && !formData.firstName}
                        valid={!!formData.firstName}
                      />
                      <FloatingInput
                        label="Last Name"
                        required
                        value={formData.lastName || ''}
                        onChange={e => updateField('lastName', e.target.value)}
                        error={attemptedProgress && !formData.lastName}
                        valid={!!formData.lastName}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <FloatingInput
                          label="Date of Birth"
                          required
                          type="date"
                          value={formData.dob || ''}
                          onChange={e => updateField('dob', e.target.value)}
                          error={attemptedProgress && (!formData.dob || (formData.dob && (isNaN(new Date(formData.dob).getTime()) || new Date(formData.dob) > new Date())))}
                          valid={!!formData.dob && !isNaN(new Date(formData.dob).getTime()) && new Date(formData.dob) <= new Date()}
                          max={new Date().toISOString().split('T')[0]}
                        />
                        {attemptedProgress && formData.dob && new Date(formData.dob) > new Date() && (
                          <p className="text-[11px] text-clinical-danger pl-1">Date of birth cannot be in the future</p>
                        )}
                        {attemptedProgress && formData.dob && isNaN(new Date(formData.dob).getTime()) && (
                          <p className="text-[11px] text-clinical-danger pl-1">Invalid date format</p>
                        )}
                      </div>
                      <FloatingSelectWrapper label="Sex" required hasValue={!!formData.sex} valid={!!formData.sex} error={attemptedProgress && !formData.sex}>
                        <Select value={formData.sex || ''} onValueChange={v => updateField('sex', v)}>
                          <SelectTrigger className="border-0 shadow-none focus:ring-0 h-auto py-0 px-3">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </FloatingSelectWrapper>
                      <FloatingSelectWrapper label="Pregnancy Status" hasValue={!!formData.pregnancy} valid={!!formData.pregnancy}>
                        <Select value={formData.pregnancy || ''} onValueChange={v => updateField('pregnancy', v)}>
                          <SelectTrigger className="border-0 shadow-none focus:ring-0 h-auto py-0 px-3">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_pregnant">Not pregnant</SelectItem>
                            <SelectItem value="pregnant">Pregnant</SelectItem>
                            <SelectItem value="possibly_pregnant">Possibly pregnant</SelectItem>
                            <SelectItem value="not_applicable">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      </FloatingSelectWrapper>
                    </div>
                  </CardContent>
                </Card>

                {/* Clinical Background */}
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Clinical Background</p>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Known Allergies</Label>
                      <TagInput placeholder="Type allergy and press Enter…" value={parseTagString(formData.allergies)} onChange={tags => updateField('allergies', tagsToString(tags))} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Current Medications</Label>
                      <TagInput placeholder="Type medication and press Enter…" value={parseTagString(formData.medications)} onChange={tags => updateField('medications', tagsToString(tags))} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Comorbidities</Label>
                      <TagInput placeholder="Type comorbidity and press Enter…" value={parseTagString(formData.comorbidities)} onChange={tags => updateField('comorbidities', tagsToString(tags))} />
                    </div>
                  </CardContent>
                </Card>

                {/* Referring Clinician */}
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Referring Clinician</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FloatingInput
                        label="GP Name"
                        value={formData.gpName || ''}
                        onChange={e => updateField('gpName', e.target.value)}
                        valid={!!formData.gpName}
                      />
                      <FloatingInput
                        label="GP Clinic"
                        value={formData.gpClinic || ''}
                        onChange={e => updateField('gpClinic', e.target.value)}
                        valid={!!formData.gpClinic}
                      />
                      <FloatingInput
                        label="GP Phone"
                        value={formData.gpPhone || ''}
                        onChange={e => updateField('gpPhone', e.target.value)}
                        valid={!!formData.gpPhone}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Condition Selection card removed — the consultation
                    pathway is now driven by the URL slug and chosen on the
                    Consultation Picker. The header above shows the active
                    condition and offers "Change condition". */}
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      const v = getStepValidation('patient');
                      if (!v.complete) {
                        setAttemptedProgress(true);
                        // QA telemetry
                        const cId = consultId || 'draft';
                        v.missing.forEach(field => {
                          logValidationBlocker(cId, 'patient', field, 'required_field_missing');
                        });
                        toast({ title: 'Required fields missing', description: v.missing.join(', '), variant: 'destructive' });
                        return;
                      }
                      setAttemptedProgress(false);
                      sonnerToast.success('Patient profile saved ✓', { duration: 3000, position: 'bottom-right' });
                      setCurrentStep('assessment');
                    }}
                    className="gap-2"
                  >
                    Continue to Assessment <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Assessment */}
            {currentStep === 'assessment' && condition && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Structured Assessment — {condition.name}</h2>
                  <StepChecklist validation={getStepValidation('assessment')} />
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Presenting Symptoms & History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {condition.assessmentFields.map(field => (
                      <div key={field}>
                        <Label className="text-xs">{field} <span className="text-clinical-danger">*</span></Label>
                        <Input
                          placeholder={`Enter ${field.toLowerCase()}`}
                          value={formData[`assess_${field}`] || ''}
                          onChange={e => updateField(`assess_${field}`, e.target.value)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Red Flag Screening */}
                <Card className={hasRedFlagTriggered ? 'border-clinical-danger bg-clinical-danger-bg' : ''}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${hasRedFlagTriggered ? 'text-clinical-danger' : 'text-clinical-warning'}`} />
                      Red Flag Screening
                      {hasRedFlagTriggered && <Badge variant="destructive" className="text-[10px]">PRESCRIBING BLOCKED</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground mb-2">Check any red flags present in this patient:</p>
                    {condition.redFlags.map(rf => (
                      <div key={rf.id} className="flex items-start gap-3">
                        <Checkbox
                          id={rf.id}
                          checked={redFlagsChecked[rf.id] || false}
                          onCheckedChange={() => toggleRedFlag(rf.id)}
                        />
                        <label htmlFor={rf.id} className="text-xs leading-relaxed cursor-pointer">
                          <span className="font-medium">{rf.description}</span>
                          <span className="block text-muted-foreground capitalize mt-0.5">Action: {rf.action.replace(/_/g, ' ')}</span>
                        </label>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {hasRedFlagTriggered && (
                  <Card className="border-clinical-danger">
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-center gap-2 text-clinical-danger">
                        <XCircle className="h-5 w-5" />
                        <span className="text-sm font-semibold">Prescribing Blocked — Red Flag Detected</span>
                      </div>
                      <p className="text-xs text-muted-foreground">A red flag has been identified. You must document a referral before proceeding.</p>
                      <div>
                        <Label className="text-xs">Referral Documentation (mandatory) <span className="text-clinical-danger">*</span></Label>
                        <Textarea
                          placeholder="Document referral details..."
                          value={formData.referralNotes || ''}
                          onChange={e => updateField('referralNotes', e.target.value)}
                          className="h-24"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep('patient')} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  {canProceedFromAssessment ? (
                    <Button onClick={() => setCurrentStep('differentials')} className="gap-2">
                      Continue to Differentials <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="destructive" disabled={!formData.referralNotes} onClick={() => setCurrentStep('documentation')} className="gap-2">
                      Generate Referral Documentation <FileText className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Differentials */}
            {currentStep === 'differentials' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Differential Diagnosis</h2>
                  <StepChecklist validation={getStepValidation('differentials')} />
                </div>
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <div>
                      <Label className="text-xs font-semibold">Working Diagnosis <span className="text-clinical-danger">*</span></Label>
                      <Input
                        placeholder="State your working diagnosis"
                        value={formData.workingDiagnosis || ''}
                        onChange={e => updateField('workingDiagnosis', e.target.value)}
                      />
                    </div>
                    <Separator />
                    <Label className="text-xs font-semibold">Differentials Considered <span className="text-clinical-danger">*</span></Label>
                    <p className="text-xs text-muted-foreground">List each differential considered and the reason it was excluded.</p>
                    {differentials.map((d, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          placeholder="Differential diagnosis"
                          value={d.diagnosis}
                          onChange={e => {
                            const next = [...differentials];
                            next[i] = { ...next[i], diagnosis: e.target.value };
                            setDifferentials(next);
                          }}
                        />
                        <Input
                          placeholder="Reason excluded"
                          value={d.reasonExcluded}
                          onChange={e => {
                            const next = [...differentials];
                            next[i] = { ...next[i], reasonExcluded: e.target.value };
                            setDifferentials(next);
                          }}
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDifferentials([...differentials, { diagnosis: '', reasonExcluded: '' }])}
                    >
                      + Add Differential
                    </Button>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep('assessment')} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStep('scope')}
                    disabled={!getStepValidation('differentials').complete}
                    className="gap-2"
                  >
                    Continue to Scope Validation <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Scope Validation */}
            {currentStep === 'scope' && condition && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Legal Scope Validation</h2>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-accent" /> Automated Scope Check
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'Age within range', pass: true, detail: condition.scopeValidation.minAge ? `${condition.scopeValidation.minAge}${condition.scopeValidation.maxAge ? '–' + condition.scopeValidation.maxAge : '+'}` : 'No restriction' },
                      { label: 'Sex eligibility', pass: !condition.scopeValidation.sexRestriction || formData.sex === condition.scopeValidation.sexRestriction, detail: condition.scopeValidation.sexRestriction ? `${condition.scopeValidation.sexRestriction} only` : 'No restriction' },
                      { label: 'Pregnancy exclusion', pass: !condition.scopeValidation.pregnancyExcluded || formData.pregnancy === 'not_pregnant' || formData.pregnancy === 'not_applicable', detail: condition.scopeValidation.pregnancyExcluded ? 'Excluded' : 'Not excluded' },
                      { label: 'Jurisdiction authority', pass: true, detail: 'Victoria – Community Pharmacist Prescriber' },
                    ].map((check, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          {check.pass ? <CheckCircle className="h-4 w-4 text-clinical-safe" /> : <XCircle className="h-4 w-4 text-clinical-danger" />}
                          <span className="text-sm font-medium">{check.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{check.detail}</span>
                      </div>
                    ))}
                    {condition.scopeValidation.temporalConstraint && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-clinical-warning-bg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-clinical-warning" />
                          <span className="text-sm font-medium">Temporal Constraint</span>
                        </div>
                        <span className="text-xs font-medium">{condition.scopeValidation.temporalConstraint}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep('differentials')} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={() => setCurrentStep('treatment')} className="gap-2">
                    Continue to Treatment <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Treatment */}
            {currentStep === 'treatment' && condition && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Therapeutic Decision</h2>
                  <StepChecklist validation={getStepValidation('treatment')} />
                </div>
                {condition.therapyOptions.length > 0 ? (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Recommended Therapies <span className="text-clinical-danger">*</span></CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {condition.therapyOptions.map(t => (
                          <label
                            key={t.id}
                            className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                              formData.selectedTherapy === t.id ? 'border-accent bg-accent/5' : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="therapy"
                                value={t.id}
                                checked={formData.selectedTherapy === t.id}
                                onChange={() => updateField('selectedTherapy', t.id)}
                                className="accent-[hsl(var(--accent))]"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold">{t.medicineName} {t.dose}</span>
                                  <span className={`clinical-badge ${t.line === 'first' ? 'clinical-badge-safe' : 'clinical-badge-info'}`}>{t.line}-line</span>
                                  {t.authorityRequired && <span className="clinical-badge clinical-badge-danger">PBS Authority</span>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{t.frequency} for {t.duration} — Qty: {t.maxQuantity}, Repeats: {t.repeats}</p>
                              </div>
                            </div>
                          </label>
                        ))}
                      </CardContent>
                    </Card>

                    {formData.selectedTherapy && condition.therapyOptions.find(t => t.id === formData.selectedTherapy)?.line !== 'first' && (
                      <Card className="border-clinical-warning">
                        <CardContent className="pt-5">
                          <Label className="text-xs font-semibold text-clinical-warning">Deviation Justification Required <span className="text-clinical-danger">*</span></Label>
                          <Textarea
                            placeholder="Explain why first-line therapy is not being used..."
                            value={formData.deviationJustification || ''}
                            onChange={e => updateField('deviationJustification', e.target.value)}
                            className="mt-2 h-20"
                          />
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardContent className="pt-5 space-y-3">
                        <div>
                          <Label className="text-xs">Follow-up Plan <span className="text-clinical-danger">*</span></Label>
                          <Textarea placeholder="Document follow-up plan..." value={formData.followUpPlan || ''} onChange={e => updateField('followUpPlan', e.target.value)} className="h-20" />
                        </div>
                        <div>
                          <Label className="text-xs">Safety Net Advice <span className="text-clinical-danger">*</span></Label>
                          <Textarea placeholder="Document safety net advice given to patient..." value={formData.safetyNet || ''} onChange={e => updateField('safetyNet', e.target.value)} className="h-16" />
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p className="text-sm">Therapy options for this condition are being developed.</p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep('scope')} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (hasSafetyBlock) {
                        toast({
                          title: 'Safety blockers detected',
                          description: 'Resolve safety blockers or apply a clinical override before proceeding.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setCurrentStep('documentation');
                    }}
                    className="gap-2"
                  >
                    Review & Finalise <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Documentation / Review */}
            {currentStep === 'documentation' && (
              <div className="space-y-4">
                <ReviewPanel
                  formData={formData}
                  condition={condition}
                  differentials={differentials}
                  hasRedFlagTriggered={hasRedFlagTriggered}
                  consultStatus={consultStatus}
                  consultId={consultId}
                  finalisedAt={finalisedAt}
                  onFinalise={handleFinalise}
                  onDiscard={handleDiscard}
                  pinnedEvidence={pinnedEvidence}
                />
                {/* Patient Education — auto-populated from diagnosis */}
                <PatientEducationPanel
                  diagnosisName={condition?.name}
                  medicationName={formData.selectedTherapy}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Live Note Preview + Safety + Readiness */}
        <div className="hidden lg:block w-80 border-l bg-muted/30 p-4 overflow-auto">
          <LiveNotePreview
            formData={formData}
            condition={condition}
            differentials={differentials}
            hasRedFlagTriggered={hasRedFlagTriggered}
            redFlagsChecked={redFlagsChecked}
            pinnedEvidence={pinnedEvidence}
            noteHeadings={noteHeadings}
            isGenerating={Object.keys(formData).length > 0 && currentStep !== 'documentation'}
          />

          <Separator className="my-4" />

          {/* Safety Checks Card */}
          <SafetyChecksCard
            result={safetyResult}
            override={safetyOverride}
            onRequestOverride={() => setShowOverrideDialog(true)}
          />

          <Separator className="my-4" />

          {/* Completion Readiness */}
          <CompletionReadinessPanel
            allStepValidations={allStepValidations}
            safetyResult={safetyResult}
            safetyOverride={safetyOverride}
          />

          <Separator className="my-4" />

          {/* Collapsible Step Progress */}
          <StepProgressPanel
            getStepStatus={getStepStatus}
            getStepValidation={getStepValidation}
          />
        </div>
      </div>

      {/* Dialogs */}
      <SafetyOverrideDialog
        open={showOverrideDialog}
        onOpenChange={setShowOverrideDialog}
        blockerCount={safetyResult.blockers.length}
        onApply={handleSafetyOverride}
      />
      <ApplyTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onApply={handleApplyTemplate}
      />
      <SketchPad
        open={showSketchPad}
        onOpenChange={setShowSketchPad}
        onSave={(dataUrl) => {
          setSavedSketches(prev => [...prev, {
            dataUrl,
            timestamp: new Date().toISOString(),
          }]);
        }}
      />
    </ClinicalLayout>
  );
};

export default NewConsultation;
