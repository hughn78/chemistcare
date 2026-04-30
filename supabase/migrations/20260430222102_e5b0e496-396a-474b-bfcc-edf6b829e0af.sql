-- Consultations: add condition + protocol metadata
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS condition_slug text,
  ADD COLUMN IF NOT EXISTS condition_template_version text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS jurisdiction_protocol_version text,
  ADD COLUMN IF NOT EXISTS protocol_source_label text,
  ADD COLUMN IF NOT EXISTS protocol_last_reviewed date,
  ADD COLUMN IF NOT EXISTS protocol_status text,
  ADD COLUMN IF NOT EXISTS finalised_note text,
  ADD COLUMN IF NOT EXISTS finalised_note_protocol_snapshot jsonb;

-- Backfill legacy rows
UPDATE public.consultations
SET
  condition_slug = COALESCE(condition_slug, 'legacy'),
  condition_template_version = COALESCE(condition_template_version, 'unknown'),
  jurisdiction = COALESCE(jurisdiction, 'Victoria'),
  jurisdiction_protocol_version = COALESCE(jurisdiction_protocol_version, 'unknown'),
  protocol_status = COALESCE(protocol_status, 'needs_review');

CREATE INDEX IF NOT EXISTS idx_consultations_condition_slug
  ON public.consultations(condition_slug);

-- Audit events: add condition + protocol metadata
ALTER TABLE public.consult_audit_events
  ADD COLUMN IF NOT EXISTS condition_slug text,
  ADD COLUMN IF NOT EXISTS condition_template_version text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS jurisdiction_protocol_version text,
  ADD COLUMN IF NOT EXISTS protocol_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_consult_audit_events_condition_slug
  ON public.consult_audit_events(condition_slug);
