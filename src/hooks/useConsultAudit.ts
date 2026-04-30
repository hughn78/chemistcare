import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { appendAudit } from '@/lib/auditStore';
import type { ProtocolStamp } from '@/lib/protocolVersion';

export type AuditEventType =
  | 'draft_saved'
  | 'step_validated'
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
  /** Protocol/template stamp captured at the moment of the event. */
  protocol?: ProtocolStamp;
}

export function useConsultAudit() {
  const logEvent = useCallback(async (
    consultId: string,
    eventType: AuditEventType,
    options?: AuditEventOptions
  ) => {
    const protocol = options?.protocol;

    // Always write to local store
    appendAudit({
      consultId,
      action: eventType,
      details: {
        step: options?.step,
        validationResult: options?.validationResult,
        errorReason: options?.errorReason,
        templateVersion: protocol?.templateVersion ?? null,
        protocolJurisdiction: protocol?.protocolJurisdiction ?? null,
        protocolJurisdictionVersion: protocol?.protocolJurisdictionVersion ?? null,
        protocolName: protocol?.protocolName ?? null,
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
        template_version: protocol?.templateVersion ?? null,
        protocol_jurisdiction: protocol?.protocolJurisdiction ?? null,
        protocol_jurisdiction_version: protocol?.protocolJurisdictionVersion ?? null,
        protocol_name: protocol?.protocolName ?? null,
      });
    } catch {
      // Audit logging should never break the UI
      console.warn('[Audit] Failed to log event to backend:', eventType);
    }
  }, []);

  return { logEvent };
}
