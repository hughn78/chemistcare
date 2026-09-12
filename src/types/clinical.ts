export type ConditionClassification = 'acute' | 'chronic' | 'preventive' | 'resupply';

export type Severity = 'mild' | 'moderate' | 'severe';

export interface RedFlag {
  id: string;
  description: string;
  action: 'block_prescribing' | 'referral_required' | 'urgent_referral';
}

export interface ExclusionCriteria {
  id: string;
  description: string;
  type: 'age' | 'sex' | 'pregnancy' | 'breastfeeding' | 'comorbidity' | 'temporal' | 'other';
}

export interface TherapyOption {
  id: string;
  medicineName: string;
  dose: string;
  frequency: string;
  duration: string;
  maxQuantity: number;
  repeats: number;
  pbsItem?: string;
  pbsRestriction?: string;
  authorityRequired: boolean;
  line: 'first' | 'second' | 'third';
  contraindications: string[];
  interactions: string[];
  specialPopulations?: string;
  monitoringRequired?: string;
}

export interface Condition {
  id: string;
  name: string;
  classification: ConditionClassification;
  icdCode?: string;
  description: string;
  scopeValidation: {
    minAge?: number;
    maxAge?: number;
    sexRestriction?: 'male' | 'female' | null;
    pregnancyExcluded: boolean;
    breastfeedingExcluded: boolean;
    temporalConstraint?: string;
    jurisdictionNotes?: string;
  };
  redFlags: RedFlag[];
  exclusionCriteria: ExclusionCriteria[];
  assessmentFields: string[];
  therapyOptions: TherapyOption[];
  guidelineReference: string;
  followUpInterval?: string;
  monitoringChecklist?: string[];
  /**
   * When set, this condition's clinical content is OWNED by the canonical
   * protocol in src/clinical/protocols and must be derived from it rather than
   * duplicated here. Prevents the same drug carrying two different doses.
   */
  canonicalProtocolId?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'male' | 'female' | 'other';
  medicareNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  allergies: string[];
  currentMedications: string[];
  comorbidities: string[];
  pregnancyStatus: 'not_pregnant' | 'pregnant' | 'possibly_pregnant' | 'not_applicable';
  breastfeeding: boolean;
  gpName?: string;
  gpClinic?: string;
  gpPhone?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  conditionId: string;
  pharmacistId: string;
  status: 'in_progress' | 'completed' | 'referred' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  assessment: Record<string, unknown>;
  redFlagsTriggered: string[];
  workingDiagnosis: string;
  differentials: { diagnosis: string; reasonExcluded: string }[];
  scopeValidationPassed: boolean;
  scopeValidationNotes?: string;
  selectedTherapy?: string;
  deviationJustification?: string;
  prescriptionGenerated: boolean;
  referralRequired: boolean;
  referralDetails?: string;
  followUpPlan?: string;
  clinicalNotes?: string;
}

export type ConsultationStep = 
  | 'patient'
  | 'assessment'
  | 'differentials'
  | 'scope'
  | 'treatment'
  | 'documentation';

export const CONSULTATION_STEPS: { key: ConsultationStep; label: string; description: string }[] = [
  { key: 'patient', label: 'Patient Profile', description: 'Demographics, allergies, medications' },
  { key: 'assessment', label: 'Assessment', description: 'Symptoms, red flags, vitals' },
  { key: 'differentials', label: 'Differentials', description: 'Working diagnosis & reasoning' },
  { key: 'scope', label: 'Scope Validation', description: 'Legal authority & restrictions' },
  { key: 'treatment', label: 'Treatment', description: 'Therapeutic decision & prescription' },
  { key: 'documentation', label: 'Documentation', description: 'Clinical notes & outputs' },
];
