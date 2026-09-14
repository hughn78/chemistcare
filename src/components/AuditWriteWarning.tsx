import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  flushPendingAudit,
  getAuditHealth,
  subscribeAuditStatus,
  type AuditHealth,
} from '@/lib/auditStore';

/**
 * Visible warning when the clinical audit trail is incomplete.
 *
 * An unwritten audit entry is a medico-legal event, not a console warning.
 * This banner stays on screen (it is not hover-only, not colour-only, and has
 * an explicit retry action) until the record is actually persisted.
 */
export function AuditWriteWarning() {
  const [health, setHealth] = useState<AuditHealth>(() => getAuditHealth());

  useEffect(() => subscribeAuditStatus(setHealth), []);

  const hasProblem = health.pendingCount > 0 || health.lastError !== null;
  if (!hasProblem) return null;

  const retry = () => {
    const result = flushPendingAudit();
    setHealth(getAuditHealth());
    if (result.remaining > 0) {
      // getAuditHealth() already carries the reason; nothing further to do here
      // — the banner stays visible, which is the point.
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-destructive bg-destructive/95 px-4 py-3 text-destructive-foreground shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">Audit trail incomplete — do not rely on this record</p>
            <p className="opacity-90">
              {health.lastError ?? 'Some consultation events have not been saved.'}
              {health.pendingCount > 0 && (
                <> {health.pendingCount} entr{health.pendingCount === 1 ? 'y' : 'ies'} waiting to be written.</>
              )}{' '}
              Free up browser storage or export the record before continuing.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={retry}
          className="shrink-0"
          disabled={health.pendingCount === 0}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Retry save
        </Button>
      </div>
    </div>
  );
}
