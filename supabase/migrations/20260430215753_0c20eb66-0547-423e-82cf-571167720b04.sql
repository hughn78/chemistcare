-- Add protocol/template versioning columns to consultations and audit events
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS protocol_jurisdiction text,
  ADD COLUMN IF NOT EXISTS protocol_jurisdiction_version text,
  ADD COLUMN IF NOT EXISTS protocol_name text;

ALTER TABLE public.consult_audit_events
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS protocol_jurisdiction text,
  ADD COLUMN IF NOT EXISTS protocol_jurisdiction_version text,
  ADD COLUMN IF NOT EXISTS protocol_name text;

CREATE INDEX IF NOT EXISTS idx_consultations_template_version
  ON public.consultations (condition_id, template_version);
CREATE INDEX IF NOT EXISTS idx_audit_events_template_version
  ON public.consult_audit_events (consult_id, template_version);