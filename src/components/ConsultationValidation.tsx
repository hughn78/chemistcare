import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { ConsultationStep } from '@/types/clinical';
import { Condition } from '@/types/clinical';

export interface ValidationResult {
  complete: boolean;
  missing: string[];
  total: number;
  filled: number;
}

/**
 * Single source-of-truth validation for each consultation step.
 * The `selectedCondition` param was added to unify condition validation
 * into the patient step (prevents the 3/4 → 4/4 desync).
 */
export function validateStep(
  step: ConsultationStep,
  formData: Record<string, string>,
  condition: Condition | undefined,
  redFlagsChecked: Record<string, boolean>,
  differentials: { diagnosis: string; reasonExcluded: string }[],
  selectedCondition?: string,
): ValidationResult {
  const missing: string[] = [];

  switch (step) {
    case 'patient': {
      if (!formData.firstName) missing.push('First name');
      if (!formData.lastName) missing.push('Last name');
      if (!formData.sex) missing.push('Sex');
      if (!formData.dob) missing.push('Date of birth');
      // Validate DOB is a real, parseable date and not in the future
      if (formData.dob) {
        const parsed = new Date(formData.dob);
        if (isNaN(parsed.getTime())) {
          missing.push('Date of birth (invalid date)');
        } else if (parsed > new Date()) {
          missing.push('Date of birth (cannot be in the future)');
        }
      }
      if (!selectedCondition && selectedCondition !== undefined) missing.push('Condition selection');
      const total = 5; // firstName, lastName, sex, dob, condition
      return { complete: missing.length === 0, missing, total, filled: total - missing.length };
    }
    case 'assessment': {
      const hasRedFlag = Object.values(redFlagsChecked).some(Boolean);
      if (hasRedFlag && !formData.referralNotes) missing.push('Referral documentation');
      if (!condition) missing.push('Condition selection');
      const assessFields = condition?.assessmentFields || [];
      assessFields.forEach(f => {
        if (!formData[`assess_${f}`]) missing.push(f);
      });
      const total = assessFields.length + (hasRedFlag ? 1 : 0) + 1;
      return { complete: missing.length === 0, missing, total, filled: total - missing.length };
    }
    case 'differentials': {
      if (!formData.workingDiagnosis) missing.push('Working diagnosis');
      const hasDiff = differentials.some(d => d.diagnosis.trim());
      if (!hasDiff) missing.push('At least one differential');
      const total = 2;
      return { complete: missing.length === 0, missing, total, filled: total - missing.length };
    }
    case 'scope': {
      // Scope is auto-validated
      return { complete: true, missing: [], total: 0, filled: 0 };
    }
    case 'treatment': {
      if (condition?.therapyOptions.length && !formData.selectedTherapy) missing.push('Selected therapy');
      if (formData.selectedTherapy) {
        const therapy = condition?.therapyOptions.find(t => t.id === formData.selectedTherapy);
        if (therapy?.line !== 'first' && !formData.deviationJustification) missing.push('Deviation justification');
      }
      if (!formData.followUpPlan) missing.push('Follow-up plan');
      if (!formData.safetyNet) missing.push('Safety net advice');
      const total = 3;
      return { complete: missing.length === 0, missing, total, filled: total - missing.length };
    }
    case 'documentation': {
      return { complete: true, missing: [], total: 0, filled: 0 };
    }
    default:
      return { complete: false, missing: [], total: 0, filled: 0 };
  }
}

/** Deterministic step status based on actual validation, not positional index */
export type StepStatus = 'complete' | 'needs_attention' | 'incomplete' | 'active' | 'blocked';

export function computeStepStatus(
  step: ConsultationStep,
  currentStep: ConsultationStep,
  validation: ValidationResult,
  isBlocked: boolean,
): StepStatus {
  const STEPS_ORDER: ConsultationStep[] = ['patient', 'assessment', 'differentials', 'scope', 'treatment', 'documentation'];
  const stepIdx = STEPS_ORDER.indexOf(step);
  const currentIdx = STEPS_ORDER.indexOf(currentStep);

  if (isBlocked) return 'blocked';
  if (step === currentStep) return 'active';
  
  // For steps before the current one, check actual validation
  if (stepIdx < currentIdx) {
    if (validation.complete) return 'complete';
    if (validation.filled > 0) return 'needs_attention';
    return 'incomplete';
  }
  
  // For steps after the current one
  if (validation.complete) return 'complete';
  if (validation.filled > 0) return 'needs_attention';
  return 'incomplete';
}

interface StepChecklistProps {
  validation: ValidationResult;
  compact?: boolean;
}

export function StepChecklist({ validation, compact }: StepChecklistProps) {
  if (validation.total === 0) return null;

  if (compact) {
    return (
      <span className={`text-xs tabular-nums ${validation.complete ? 'text-clinical-safe' : 'text-muted-foreground'}`}>
        {validation.filled}/{validation.total}
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {validation.missing.length > 0 && (
        <div className="text-xs space-y-1">
          <p className="font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" style={{ color: 'hsl(var(--clinical-warning))' }} />
            Required fields ({validation.missing.length} remaining)
          </p>
          {validation.missing.map(item => (
            <p key={item} className="flex items-center gap-1.5 text-muted-foreground pl-5">
              <Circle className="h-2.5 w-2.5 shrink-0" />
              {item}
            </p>
          ))}
        </div>
      )}
      {validation.complete && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'hsl(var(--clinical-safe))' }}>
          <CheckCircle className="h-3.5 w-3.5" /> All required fields complete
        </p>
      )}
    </div>
  );
}

interface SaveStatusProps {
  lastSaved: Date | null;
  isSaving: boolean;
}

export function SaveStatus({ lastSaved, isSaving }: SaveStatusProps) {
  if (isSaving) {
    return <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>;
  }
  if (lastSaved) {
    const time = lastSaved.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    return <span className="text-xs text-muted-foreground">Last saved at {time}</span>;
  }
  return null;
}
