/**
 * Consult audit trail (local-first).
 *
 * Audit entries are a medico-legal record. The previous implementation did
 * this on a storage failure:
 *
 *   } catch {
 *     console.warn('[AuditStore] Failed to persist audit entry');
 *   }
 *   return full;            // <- caller believes the record was saved
 *
 * A quota-exceeded error therefore produced a green UI and an empty record.
 * This version never reports success it did not achieve:
 *
 *  - `appendAudit` returns a `AuditWriteResult` with an explicit status of
 *    `persisted` | `queued` | `failed`.
 *  - A write that fails on quota is retried once after trimming the oldest
 *    entries, then parked in a durable pending queue for a later retry.
 *  - Anything that is not persisted is announced to subscribers so the UI can
 *    show a visible warning instead of pretending.
 *  - Storage that exists but cannot be parsed is quarantined rather than
 *    silently overwritten.
 */

const STORAGE_KEY = 'chemistcare:audit:v1';
const PENDING_KEY = 'chemistcare:audit:v1:pending';
const MAX_ENTRIES = 500;
/** How far we trim when storage is full, before giving up on the main log. */
const TRIM_TO = 250;

export interface AuditEntry {
  id: string;
  at: string;
  consultId: string;
  action: string;
  details?: Record<string, unknown>;
}

/**
 * `persisted`  — written to the durable audit log.
 * `queued`     — parked in a durable retry queue; NOT YET part of the record.
 * `failed`     — could not be written anywhere. Must be surfaced to the user.
 */
export type AuditWriteStatus = 'persisted' | 'queued' | 'failed';

export interface AuditWriteResult {
  entry: AuditEntry;
  status: AuditWriteStatus;
  /** Human-readable reason, present when status is not `persisted`. */
  error?: string;
  /** Number of entries currently waiting in the retry queue. */
  pendingCount: number;
}

export interface AuditHealth {
  pendingCount: number;
  lastError: string | null;
  lastErrorAt: string | null;
}

type StatusListener = (health: AuditHealth) => void;

/* ------------------------------------------------------------------ */
/* storage helpers                                                      */
/* ------------------------------------------------------------------ */

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Access can throw in private-browsing / sandboxed contexts.
    return null;
  }
}

function generateId(): string {
  // crypto.randomUUID() is collision-safe; the old Date.now()+Math.random()
  // id could collide within the same millisecond and is guessable.
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  // Last resort only. Not expected in any supported browser or in Node 19+.
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRaw(key: string): { value: string | null; corrupt: boolean } {
  const s = storage();
  if (!s) return { value: null, corrupt: false };
  let raw: string | null;
  try {
    raw = s.getItem(key);
  } catch {
    return { value: null, corrupt: false };
  }
  if (raw === null) return { value: null, corrupt: false };
  try {
    JSON.parse(raw);
    return { value: raw, corrupt: false };
  } catch {
    return { value: raw, corrupt: true };
  }
}

function readEntries(key: string): AuditEntry[] {
  const { value, corrupt } = readRaw(key);
  if (corrupt && value !== null) {
    // Quarantine rather than overwrite: this is a legal record.
    quarantine(value, key);
    return [];
  }
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function quarantine(raw: string, key: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(`${key}:corrupt-${Date.now()}`, raw);
  } catch {
    // Nothing further we can do; the in-memory copy is still returned.
  }
}

function writeEntries(key: string, entries: AuditEntry[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* health + subscription                                                */
/* ------------------------------------------------------------------ */

let lastError: string | null = null;
let lastErrorAt: string | null = null;
const listeners = new Set<StatusListener>();

function notify(): void {
  const health = getAuditHealth();
  listeners.forEach(l => {
    try {
      l(health);
    } catch {
      // A broken listener must not stop the others from hearing this.
    }
  });
}

export function getAuditHealth(): AuditHealth {
  return {
    pendingCount: readEntries(PENDING_KEY).length,
    lastError,
    lastErrorAt,
  };
}

/** Subscribe to audit write problems. Returns an unsubscribe function. */
export function subscribeAuditStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(getAuditHealth());
  return () => listeners.delete(listener);
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return 'Browser storage is full — the audit record could not be saved.';
  }
  if (err instanceof Error) return err.message;
  return 'Unknown storage error.';
}

function recordFailure(message: string): void {
  lastError = message;
  lastErrorAt = new Date().toISOString();
  console.error('[AuditStore]', message);
  notify();
}

/* ------------------------------------------------------------------ */
/* public API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Append an audit entry. Never throws, and never claims success it did not
 * achieve — always inspect `result.status`.
 */
export function appendAudit(entry: Omit<AuditEntry, 'id' | 'at'>): AuditWriteResult {
  const full: AuditEntry = {
    id: generateId(),
    at: new Date().toISOString(),
    ...entry,
  };

  if (!storage()) {
    recordFailure('No accessible storage — audit entry was not recorded.');
    return { entry: full, status: 'failed', error: lastError ?? undefined, pendingCount: 0 };
  }

  const existing = readEntries(STORAGE_KEY);

  // Attempt 1: straightforward append.
  if (writeEntries(STORAGE_KEY, [full, ...existing].slice(0, MAX_ENTRIES))) {
    const pendingCount = getAuditHealth().pendingCount;
    if (pendingCount > 0) void flushPendingAudit();
    return { entry: full, status: 'persisted', pendingCount };
  }

  // Attempt 2: storage is likely full — trim the oldest entries and retry.
  const trimmed = existing.slice(0, Math.max(0, TRIM_TO - 1));
  if (writeEntries(STORAGE_KEY, [full, ...trimmed])) {
    return { entry: full, status: 'persisted', pendingCount: getAuditHealth().pendingCount };
  }

  // Attempt 3: park it durably so it can be retried, rather than losing it.
  const pending = readEntries(PENDING_KEY);
  pending.unshift(full);
  if (writeEntries(PENDING_KEY, pending.slice(0, MAX_ENTRIES))) {
    const message = `Audit entry for "${entry.action}" could not be written to the audit log and is queued for retry.`;
    recordFailure(message);
    return { entry: full, status: 'queued', error: message, pendingCount: pending.length };
  }

  const message = `Audit entry for "${entry.action}" could NOT be recorded. The audit trail is incomplete.`;
  recordFailure(message);
  return { entry: full, status: 'failed', error: message, pendingCount: 0 };
}

/**
 * Retry previously queued entries. Returns the outcome so callers can report
 * honestly.
 */
export function flushPendingAudit(): { flushed: number; remaining: number; error?: string } {
  if (!storage()) {
    return { flushed: 0, remaining: readEntries(PENDING_KEY).length, error: 'No accessible storage.' };
  }

  const pending = readEntries(PENDING_KEY);
  if (pending.length === 0) return { flushed: 0, remaining: 0 };

  const existing = readEntries(STORAGE_KEY);
  const merged = [...pending, ...existing].slice(0, MAX_ENTRIES);

  if (writeEntries(STORAGE_KEY, merged)) {
    writeEntries(PENDING_KEY, []);
    lastError = null;
    lastErrorAt = null;
    notify();
    return { flushed: pending.length, remaining: 0 };
  }

  // Still full — trim harder and try once more before giving up.
  if (writeEntries(STORAGE_KEY, [...pending, ...existing].slice(0, TRIM_TO))) {
    writeEntries(PENDING_KEY, []);
    lastError = null;
    lastErrorAt = null;
    notify();
    return { flushed: pending.length, remaining: 0 };
  }

  const error = 'Storage is still full; queued audit entries remain unsaved.';
  recordFailure(error);
  return { flushed: 0, remaining: pending.length, error };
}

export function listAudit(filters?: {
  search?: string;
  from?: string;
  to?: string;
}): AuditEntry[] {
  let entries = readEntries(STORAGE_KEY);

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(
      e =>
        e.action.toLowerCase().includes(q) ||
        e.consultId.toLowerCase().includes(q) ||
        JSON.stringify(e.details || {}).toLowerCase().includes(q)
    );
  }
  if (filters?.from) {
    entries = entries.filter(e => e.at >= filters.from!);
  }
  if (filters?.to) {
    entries = entries.filter(e => e.at <= filters.to!);
  }

  return entries;
}

/** Entries that have not yet made it into the durable audit log. */
export function listPendingAudit(): AuditEntry[] {
  return readEntries(PENDING_KEY);
}

export function clearAudit(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(STORAGE_KEY);
    s.removeItem(PENDING_KEY);
    lastError = null;
    lastErrorAt = null;
    notify();
  } catch (err) {
    recordFailure(describeError(err));
  }
}
