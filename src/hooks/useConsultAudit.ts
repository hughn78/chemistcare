import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { appendAudit } from '@/lib/auditStore';
import {
  type ProtocolStamp,
  type ProtocolSnapshot,
  buildProtocolSnapshot,
} from '@/lib/protocolVersion';

export type AuditEventType =
  | 'consultation_started'
  | 'draft_saved'
  | 'step_validated'
  | 'red_flag_answered'
  | 'scope_status_changed'
  | 'treatment_selected'
  | 'treatment_blocked'
  | 'clinical_note_generated'
  | 'consultation_finalised'
  | 'finalise_started'
  | 'finalise_succeeded'
  | 'finalise_failed'
  | 'draft_discarded'
  | 'evidence_pinned'
  | 'safety_blocker_triggered'
  | 'safety_override_applied'
  | 'template_applied';

export interface AuditEventOptions {
  step?: string;
  validationResult?: Record<string, unknown>;
  errorReason?: string;
  metadata?: Record<string, unknown>;
  /**
   * Protocol/template stamp captured at the moment of the event.
   * Components can pass this directly, or — preferred — bind it once
   * via the consultation page so they don't have to repeat it on every
   * call site.
   */
  protocol?: ProtocolStamp;
}

/**
 * Hook for writing consult audit events.
 *
 * Pass a `defaultProtocol` to bind a single `ProtocolStamp` for all
 * events emitted from this consultation; individual `logEvent` calls
 * can still override via `options.protocol`.
 */
export function useConsultAudit(defaultProtocol?: ProtocolStamp) {
  const logEvent = useCallback(async (
    consultId: string,
    eventType: AuditEventType,
    options?: AuditEventOptions,
  ) => {
    const protocol = options?.protocol ?? defaultProtocol;
    const snapshot: ProtocolSnapshot | null = protocol ? buildProtocolSnapshot(protocol) : null;

    // Always write to local store
    appendAudit({
      consultId,
      action: eventType,
      details: {
        step: options?.step,
        validationResult: options?.validationResult,
        errorReason: options?.errorReason,
        templateVersion: protocol?.templateVersion ?? null,
        conditionSlug: protocol?.conditionSlug ?? null,
        conditionTemplateVersion: protocol?.conditionTemplateVersion ?? null,
        protocolJurisdiction: protocol?.protocolJurisdiction ?? null,
        protocolJurisdictionVersion: protocol?.jurisdictionProtocolVersion ?? null,
        protocolName: protocol?.protocolName ?? null,
        protocolStatus: protocol?.protocolStatus ?? null,
        ...options?.metadata,
      },
    });

    // Best-effort write to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase.from('consult_audit_events') as any).insert({
        consult_id: consultId,
        user_id: user?.id ?? null,
        event_type: eventType,
        step: options?.step ?? null,
        validation_result: options?.validationResult ?? null,
        error_reason: options?.errorReason ?? null,
        metadata: options?.metadata ?? {},
        // Legacy flat columns (kept for back-compat queries).
        template_version: protocol?.templateVersion ?? null,
        protocol_jurisdiction: protocol?.protocolJurisdiction ?? null,
        protocol_jurisdiction_version: protocol?.jurisdictionProtocolVersion ?? null,
        protocol_name: protocol?.protocolName ?? null,
        // New richer columns (added in 2026-04-30 migration).
        condition_slug: protocol?.conditionSlug ?? null,
        condition_template_version: protocol?.conditionTemplateVersion ?? null,
        jurisdiction: protocol?.jurisdiction ?? null,
        jurisdiction_protocol_version: protocol?.jurisdictionProtocolVersion ?? null,
        protocol_snapshot: snapshot ?? null,
      });
    } catch {
      // Audit logging should never break the UI
      console.warn('[Audit] Failed to log event to backend:', eventType);
    }
  }, [defaultProtocol]);

  return { logEvent };
}
