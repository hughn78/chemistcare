/**
 * Lightweight QA telemetry for validation blockers.
 * Writes to localStorage for demo introspection.
 */

const QA_KEY = 'chemistcare:qa_blockers:v1';

export interface QABlockerEntry {
  id: string;
  at: string;
  consultId: string;
  stepId: string;
  fieldId: string;
  validatorReason: string;
  sessionId: string;
}

let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = sessionStorage.getItem('chemistcare:session_id');
    if (!_sessionId) {
      _sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      sessionStorage.setItem('chemistcare:session_id', _sessionId);
    }
  }
  return _sessionId;
}

export function logValidationBlocker(
  consultId: string,
  stepId: string,
  fieldId: string,
  validatorReason: string,
): void {
  try {
    const entry: QABlockerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      consultId,
      stepId,
      fieldId,
      validatorReason,
      sessionId: getSessionId(),
    };
    const existing = getBlockerLog();
    existing.unshift(entry);
    const capped = existing.slice(0, 200);
    localStorage.setItem(QA_KEY, JSON.stringify(capped));
  } catch {
    // Fail silently
  }
}

export function getBlockerLog(): QABlockerEntry[] {
  try {
    const raw = localStorage.getItem(QA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearBlockerLog(): void {
  localStorage.removeItem(QA_KEY);
}
