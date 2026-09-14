import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendAudit,
  clearAudit,
  flushPendingAudit,
  getAuditHealth,
  listAudit,
  listPendingAudit,
  subscribeAuditStatus,
  type AuditEntry,
} from '@/lib/auditStore';

const KEY = 'chemistcare:audit:v1';
const PENDING_KEY = 'chemistcare:audit:v1:pending';

function fill(key: string, entries: Partial<AuditEntry>[]): void {
  localStorage.setItem(
    key,
    JSON.stringify(entries.map((e, i) => ({
      id: `seed-${i}`,
      at: new Date(Date.now() - i * 1000).toISOString(),
      consultId: 'c1',
      action: 'seeded',
      ...e,
    }))),
  );
}

describe('auditStore — medico-legal write integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('generates unique, non-sequential ids (no Math.random() ids)', () => {
    const a = appendAudit({ consultId: 'c1', action: 'consultation_started' });
    const b = appendAudit({ consultId: 'c1', action: 'draft_saved' });
    expect(a.entry.id).not.toBe(b.entry.id);
    // crypto.randomUUID() is a 36-char RFC 4122 string; the old
    // `${Date.now()}-${Math.random()...}` id is not.
    expect(a.entry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('reports persisted on a successful write', () => {
    const result = appendAudit({ consultId: 'c1', action: 'consultation_started' });
    expect(result.status).toBe('persisted');
    expect(listAudit()).toHaveLength(1);
  });

  it('does NOT claim success when storage is full', () => {
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === KEY || key === PENDING_KEY) {
        const err = new DOMException('full', 'QuotaExceededError');
        throw err;
      }
      return realSetItem.call(this, key, value);
    });

    const result = appendAudit({ consultId: 'c1', action: 'consultation_finalised' });

    expect(result.status).toBe('failed');
    expect(result.error).toBeTruthy();
    // The critical assertion: we never return the entry as if it were saved.
    expect(listAudit()).toHaveLength(0);
  });

  it('queues durably when the main log is full but pending storage works', () => {
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === KEY) throw new DOMException('full', 'QuotaExceededError');
      return realSetItem.call(this, key, value);
    });

    const result = appendAudit({ consultId: 'c1', action: 'treatment_selected' });

    expect(result.status).toBe('queued');
    expect(result.pendingCount).toBe(1);
    expect(listPendingAudit()).toHaveLength(1);
    // Queued is NOT persisted — the audit log is still incomplete.
    expect(listAudit()).toHaveLength(0);
  });

  it('flushes queued entries once storage frees up', () => {
    const realSetItem = Storage.prototype.setItem;
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === KEY) throw new DOMException('full', 'QuotaExceededError');
      return realSetItem.call(this, key, value);
    });

    appendAudit({ consultId: 'c1', action: 'treatment_selected' });
    expect(getAuditHealth().pendingCount).toBe(1);

    failing.mockRestore();

    const flushed = flushPendingAudit();
    expect(flushed.flushed).toBe(1);
    expect(flushed.remaining).toBe(0);
    expect(listPendingAudit()).toHaveLength(0);
    expect(listAudit()).toHaveLength(1);
    expect(getAuditHealth().lastError).toBeNull();
  });

  it('trims the oldest entries and retries before giving up', () => {
    fill(KEY, Array.from({ length: 500 }, () => ({ action: 'old' })));

    const realSetItem = Storage.prototype.setItem;
    let attempts = 0;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === KEY) {
        attempts += 1;
        // Fail the normal-cap write, allow the trimmed write.
        const parsed = JSON.parse(value) as AuditEntry[];
        if (parsed.length > 250) throw new DOMException('full', 'QuotaExceededError');
      }
      return realSetItem.call(this, key, value);
    });

    const result = appendAudit({ consultId: 'c1', action: 'consultation_finalised' });

    spy.mockRestore();

    expect(attempts).toBeGreaterThan(1);
    expect(result.status).toBe('persisted');
    expect(listAudit().length).toBeLessThanOrEqual(250);
    expect(listAudit()[0].action).toBe('consultation_finalised');
  });

  it('notifies subscribers when a write fails', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuditStatus(listener);
    listener.mockClear();

    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === KEY || key === PENDING_KEY) throw new DOMException('full', 'QuotaExceededError');
      return realSetItem.call(this, key, value);
    });

    appendAudit({ consultId: 'c1', action: 'consultation_finalised' });

    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls.at(-1)?.[0].lastError).toBeTruthy();

    unsubscribe();
  });

  it('quarantines unparseable audit data instead of overwriting it', () => {
    localStorage.setItem(KEY, '{ this is not json');
    expect(listAudit()).toHaveLength(0);

    const quarantineKeys = Object.keys(localStorage).filter(k => k.startsWith(`${KEY}:corrupt-`));
    expect(quarantineKeys).toHaveLength(1);
    expect(localStorage.getItem(quarantineKeys[0])).toBe('{ this is not json');
  });

  it('clearAudit removes both the log and the pending queue', () => {
    appendAudit({ consultId: 'c1', action: 'draft_saved' });
    clearAudit();
    expect(listAudit()).toHaveLength(0);
    expect(listPendingAudit()).toHaveLength(0);
  });

  it('still filters by search / date range', () => {
    appendAudit({ consultId: 'c1', action: 'consultation_started', details: { note: 'UTI' } });
    appendAudit({ consultId: 'c2', action: 'draft_saved', details: { note: 'shingles' } });

    expect(listAudit({ search: 'shingles' })).toHaveLength(1);
    expect(listAudit({ search: 'c1' })).toHaveLength(1);
    expect(listAudit({ from: new Date(Date.now() + 60_000).toISOString() })).toHaveLength(0);
  });
});
