/**
 * Jurisdiction protocol versioning — single source of truth.
 *
 * Every condition template advertises its own `templateVersion`,
 * `jurisdictionProtocolVersion`, `protocolStatus`, etc. The helpers
 * here turn those into a `ProtocolStamp` / `ProtocolSnapshot` that
 * gets attached to every audit event and finalised note so the
 * record is reproducible long after the template has been bumped.
 */

export type ProtocolStatus = 'draft' | 'active' | 'needs_review' | 'retired';

export interface JurisdictionProtocol {
  /** ISO state/territory code, e.g. 'VIC'. */
  jurisdiction: string;
  /** Human-readable jurisdiction label, e.g. 'Victoria'. */
  jurisdictionLabel: string;
  /** Public name of the prescribing protocol. */
  name: string;
  /** Upstream regulator's version (semver-ish). */
  version: string;
  /** Effective date of this version (ISO date). */
  effectiveDate: string;
}

export const PROTOCOLS: Record<string, JurisdictionProtocol> = {
  VIC: {
    jurisdiction: 'VIC',
    jurisdictionLabel: 'Victoria',
    name: 'Victorian Community Pharmacist Statewide Prescribing',
    version: '2026.04',
    effectiveDate: '2026-04-01',
  },
  NSW: {
    jurisdiction: 'NSW',
    jurisdictionLabel: 'New South Wales',
    name: 'NSW Pharmacist Prescribing Trial',
    version: '2025.11',
    effectiveDate: '2025-11-01',
  },
  QLD: {
    jurisdiction: 'QLD',
    jurisdictionLabel: 'Queensland',
    name: 'Queensland Community Pharmacy Scope of Practice',
    version: '2025.07',
    effectiveDate: '2025-07-01',
  },
};

export const DEFAULT_JURISDICTION = 'VIC';

export function getProtocol(jurisdiction = DEFAULT_JURISDICTION): JurisdictionProtocol {
  return PROTOCOLS[jurisdiction] ?? PROTOCOLS[DEFAULT_JURISDICTION];
}

/**
 * Compact stamp persisted on every audit row + every finalised consult.
 * Fields are intentionally flat (matching the new DB columns) so they
 * can be queried/filtered without unwrapping JSON.
 */
export interface ProtocolStamp {
  /** Backwards-compat numeric version (legacy column). */
  templateVersion: number | null;
  /** New: condition template semver (e.g. '1.0.0'). */
  conditionSlug: string | null;
  conditionTemplateVersion: string | null;
  jurisdiction: string;
  jurisdictionProtocolVersion: string;
  /** Display name of the protocol (kept for legacy column). */
  protocolName: string;
  protocolJurisdiction: string;
  /** Optional richer fields used for the snapshot blob. */
  protocolStatus?: ProtocolStatus;
  protocolSourceLabel?: string;
  protocolLastReviewed?: string;
}

export interface BuildStampInput {
  /** Numeric version on the legacy `ConditionTemplate.templateVersion`. */
  templateVersionNumber?: number | null;
  /** Newer semver-style version, e.g. '1.0.0'. */
  conditionTemplateVersion?: string | null;
  conditionSlug?: string | null;
  jurisdiction?: string;
  jurisdictionProtocolVersion?: string;
  protocolStatus?: ProtocolStatus;
  protocolSourceLabel?: string;
  protocolLastReviewed?: string;
}

/**
 * Build the stamp included on every audit event and finalised consult.
 *
 * Two call shapes are supported for backwards compatibility:
 *   buildProtocolStamp(numericVersion, jurisdictionCode)
 *   buildProtocolStamp({ ...rich input })
 */
export function buildProtocolStamp(
  input?: number | null | BuildStampInput,
  jurisdiction: string = DEFAULT_JURISDICTION,
): ProtocolStamp {
  // Legacy 2-arg signature (number | null, jurisdiction).
  if (input === null || input === undefined || typeof input === 'number') {
    const p = getProtocol(jurisdiction);
    return {
      templateVersion: input ?? null,
      conditionSlug: null,
      conditionTemplateVersion: input != null ? String(input) : null,
      jurisdiction: p.jurisdictionLabel,
      jurisdictionProtocolVersion: p.version,
      protocolName: p.name,
      protocolJurisdiction: p.jurisdiction,
    };
  }

  const p = getProtocol(input.jurisdiction);
  const overrideJV = input.jurisdictionProtocolVersion;
  return {
    templateVersion: input.templateVersionNumber ?? null,
    conditionSlug: input.conditionSlug ?? null,
    conditionTemplateVersion:
      input.conditionTemplateVersion
      ?? (input.templateVersionNumber != null ? String(input.templateVersionNumber) : null),
    jurisdiction: p.jurisdictionLabel,
    jurisdictionProtocolVersion: overrideJV ?? p.version,
    protocolName: p.name,
    protocolJurisdiction: p.jurisdiction,
    protocolStatus: input.protocolStatus,
    protocolSourceLabel: input.protocolSourceLabel,
    protocolLastReviewed: input.protocolLastReviewed,
  };
}

/**
 * Full reproducibility snapshot persisted alongside finalised notes
 * (and on every audit event as `protocol_snapshot`). Bigger than
 * `ProtocolStamp` and stored as JSONB.
 */
export interface ProtocolSnapshot extends ProtocolStamp {
  capturedAt: string;
}

export function buildProtocolSnapshot(stamp: ProtocolStamp): ProtocolSnapshot {
  return { ...stamp, capturedAt: new Date().toISOString() };
}

export function formatProtocolFooter(stamp: ProtocolStamp): string {
  const tv = stamp.conditionTemplateVersion ?? (stamp.templateVersion != null ? `v${stamp.templateVersion}` : null);
  const tvLabel = tv ? ` · template ${tv.startsWith('v') ? tv : 'v' + tv}` : '';
  const status = stamp.protocolStatus ? ` · ${stamp.protocolStatus}` : '';
  return `${stamp.protocolName} ${stamp.protocolJurisdiction} v${stamp.jurisdictionProtocolVersion}${tvLabel}${status}`;
}
