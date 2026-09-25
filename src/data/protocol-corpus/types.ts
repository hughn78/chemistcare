/**
 * Protocol Corpus — types for the OCR-extracted jurisdiction protocol JSON.
 * Shapes mirror the upstream extraction schema (schema_version 1):
 * eligibility / diagnosis_pathways / treatments / red_flags / referral /
 * review_followup / notifiable / references / open_questions, each item
 * carrying provenance (pdf sha256, page, section heading) + confidence.
 */
export interface CorpusProvenance {
  pdf_file: string;
  page: number | string;
  section_heading: string;
}

export interface CorpusStructuredRule {
  parameter: string;
  operator: string;
  value: number | string;
  unit?: string;
}

export interface CorpusRedFlag {
  id: string;
  trigger_text: string;
  structured?: CorpusStructuredRule | null;
  action: string;
  severity: string;
  confidence: string;
  provenance?: CorpusProvenance;
}

export interface CorpusTreatment {
  id: string;
  drug: string;
  form?: string;
  strength?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  max_quantity?: string;
  max_dose?: string;
  quantity_to_supply?: string;
  notes?: string;
  first_line?: boolean;
  confidence: string;
  provenance?: CorpusProvenance;
}

export interface CorpusCriteriaItem {
  id: string;
  text: string;
  criteria_group?: { all_of?: string[]; any_of?: string[] };
  confidence: string;
  provenance?: CorpusProvenance;
}

export interface CorpusPathwayStep {
  id: string;
  order: number;
  type: string;
  description: string;
  provenance?: CorpusProvenance;
}

export interface CorpusPathway {
  id: string;
  name: string;
  steps: CorpusPathwayStep[];
}

export interface CorpusDocumentPayload {
  schema_version: number;
  source: {
    pdf_file: string;
    pdf_sha256: string;
    page_count: string | number;
    extracted_at: string;
    extracted_by: string;
  };
  protocol: {
    state: string;
    instrument_name: string;
    instrument_version: string | number;
    effective_date?: string;
    legal_basis?: string;
    supervision_model?: string;
    scope_summary?: string;
  };
  eligibility?: {
    inclusion?: CorpusCriteriaItem[];
    exclusion?: CorpusCriteriaItem[];
  };
  diagnosis_pathways?: CorpusPathway[];
  treatments?: CorpusTreatment[];
  red_flags?: CorpusRedFlag[];
  referral?: Record<string, unknown>;
  review_followup?: Array<{ when?: string; what?: string; provenance?: CorpusProvenance }>;
  notifiable?: { required?: boolean | null; conditions?: string[]; provenance?: CorpusProvenance };
  references?: string[];
  open_questions?: Array<Record<string, unknown>>;
  hugh_to_confirm?: Array<Record<string, unknown>>;
  /** Present only in the truncated SA overweight/obesity extraction. */
  '@@NEXT@@'?: unknown;
}

export interface CorpusDocumentMeta {
  file: string;
  state: string;
  conditionKey: string;
  conditionLabel: string;
  registrySlug: string | null;
  docType: 'clinical-guideline' | 'prescribing-instrument' | 'info-pack' | 'form' | 'summary' | 'repealed';
  title: string;
  instrumentVersion: string;
  effectiveDate: string | null;
  legalBasis: string | null;
  supervisionModel: string | null;
  scopeSummary: string | null;
  pageCount: number | null;
  sha256: string | null;
  extractedAt: string | null;
  counts: {
    inclusion: number;
    exclusion: number;
    redFlags: number;
    treatments: number;
    structuredRedFlags: number;
    openQuestions: number;
    toConfirm: number;
  };
  truncated: boolean;
}

export interface CorpusConditionGroup {
  key: string;
  label: string;
  registrySlug: string | null;
  docCount: number;
  states: Record<string, Array<{
    file: string;
    docType: CorpusDocumentMeta['docType'];
    title: string;
    instrumentVersion: string;
    effectiveDate: string | null;
    sha256: string | null;
    truncated: boolean;
    openQuestions: number;
    counts: CorpusDocumentMeta['counts'];
  }>>;
}

export interface CorpusManifest {
  generatedFrom: string;
  asAt: string;
  schemaVersion: number;
  states: Record<string, number>;
  conditions: Record<string, CorpusConditionGroup>;
  documents: CorpusDocumentMeta[];
}