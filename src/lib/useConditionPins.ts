/**
 * User-managed pin state for conditions in the sidebar.
 *
 * The central conditionRegistry ships with a curated default pin set
 * (Travel Medicine, UTI, OCP Resupply, etc.). This hook layers a
 * per-user override on top, persisted to localStorage, so pharmacists
 * can pin/unpin their own quick-start conditions without touching the
 * shared registry. Removing a default pin and re-pinning it both work
 * via the same override map.
 *
 * Storage shape: { [conditionId: string]: boolean }  // true = pinned
 */
import { useCallback, useEffect, useState } from 'react';
import {
  CONDITION_REGISTRY,
  type ConditionRegistryEntry,
} from '@/lib/conditionRegistry';

const STORAGE_KEY = 'chemistcare:condition_pins_v1';
const EVENT_NAME = 'chemistcare:condition_pins_changed';

type PinOverrides = Record<string, boolean>;

function loadOverrides(): PinOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PinOverrides) : {};
  } catch {
    return {};
  }
}

function saveOverrides(next: PinOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

/** Merge default pin status from the registry with the user's overrides. */
export function getEffectivePinnedConditions(
  overrides: PinOverrides = loadOverrides(),
): ConditionRegistryEntry[] {
  return CONDITION_REGISTRY
    .filter(e => {
      if (!e.enabled) return false;
      const override = overrides[e.id];
      return override === undefined ? e.pinned : override;
    })
    .sort((a, b) => {
      // User-pinned (not in default set) sort after default pins by name.
      const aDefault = a.pinned ? a.sortOrder : 9999;
      const bDefault = b.pinned ? b.sortOrder : 9999;
      if (aDefault !== bDefault) return aDefault - bDefault;
      return a.name.localeCompare(b.name);
    });
}

export function isConditionPinned(
  conditionId: string,
  overrides: PinOverrides = loadOverrides(),
): boolean {
  const entry = CONDITION_REGISTRY.find(e => e.id === conditionId);
  if (!entry) return false;
  const override = overrides[conditionId];
  return override === undefined ? entry.pinned : override;
}

/**
 * React hook: subscribe to pin changes (cross-component + cross-tab) and
 * expose toggle/set helpers. Components reading `pinnedConditions` will
 * re-render whenever any other component (or another tab) updates pins.
 */
export function useConditionPins() {
  const [overrides, setOverrides] = useState<PinOverrides>(() => loadOverrides());

  useEffect(() => {
    const handleChange = () => setOverrides(loadOverrides());
    // Cross-tab via storage event, same-tab via custom event.
    window.addEventListener('storage', handleChange);
    window.addEventListener(EVENT_NAME, handleChange);
    return () => {
      window.removeEventListener('storage', handleChange);
      window.removeEventListener(EVENT_NAME, handleChange);
    };
  }, []);

  const setPinned = useCallback((conditionId: string, pinned: boolean) => {
    const entry = CONDITION_REGISTRY.find(e => e.id === conditionId);
    if (!entry) return;
    const next: PinOverrides = { ...loadOverrides() };
    // If the desired value matches the registry default, clear the override
    // so future default changes propagate; otherwise persist the override.
    if (entry.pinned === pinned) {
      delete next[conditionId];
    } else {
      next[conditionId] = pinned;
    }
    saveOverrides(next);
    setOverrides(next);
  }, []);

  const togglePinned = useCallback(
    (conditionId: string) => {
      setPinned(conditionId, !isConditionPinned(conditionId, loadOverrides()));
    },
    [setPinned],
  );

  const isPinned = useCallback(
    (conditionId: string) => isConditionPinned(conditionId, overrides),
    [overrides],
  );

  return {
    pinnedConditions: getEffectivePinnedConditions(overrides),
    isPinned,
    setPinned,
    togglePinned,
  };
}
