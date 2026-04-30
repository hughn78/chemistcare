/**
 * Jurisdiction protocol versioning — single source of truth.
 *
 * `templateVersion` lives on each `ConditionTemplate` and tracks the shape
 * of the per-condition protocol data file. `protocolJurisdictionVersion`
 * tracks the upstream regulator's version of the prescribing protocol
 * (e.g. Vic CPSP guidance). Both are stamped onto every audit event and
 * every finalised consultation so a consult can be reproduced exactly.
 */

export interface JurisdictionProtocol {
  /** ISO state/territory code, e.g. 'VIC'. */
  jurisdiction: string;
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
    name: 'Victorian Community Pharmacist Statewide Prescribing',
    version: '2026.04',
    effectiveDate: '2026-04-01',
  },
  NSW: {
    jurisdiction: 'NSW',
    name: 'NSW Pharmacist Prescribing Trial',
    version: '2025.11',
    effectiveDate: '2025-11-01',
  },
  QLD: {
    jurisdiction: 'QLD',
    name: 'Queensland Community Pharmacy Scope of Practice',
    version: '2025.07',
    effectiveDate: '2025-07-01',
  },
};

export const DEFAULT_JURISDICTION = 'VIC';

export function getProtocol(jurisdiction = DEFAULT_JURISDICTION): JurisdictionProtocol {
  return PROTOCOLS[jurisdiction] ?? PROTOCOLS[DEFAULT_JURISDICTION];
}

export interface ProtocolStamp {
  templateVersion: number | null;
  protocolJurisdiction: string;
  protocolJurisdictionVersion: string;
  protocolName: string;
}

/**
 * Build the stamp included on every audit event and finalised consult.
 * `templateVersion` is condition-specific; the rest are jurisdiction-wide.
 */
export function buildProtocolStamp(
  templateVersion: number | null | undefined,
  jurisdiction: string = DEFAULT_JURISDICTION,
): ProtocolStamp {
  const p = getProtocol(jurisdiction);
  return {
    templateVersion: templateVersion ?? null,
    protocolJurisdiction: p.jurisdiction,
    protocolJurisdictionVersion: p.version,
    protocolName: p.name,
  };
}

export function formatProtocolFooter(stamp: ProtocolStamp): string {
  const tv = stamp.templateVersion != null ? ` · template v${stamp.templateVersion}` : '';
  return `${stamp.protocolName} ${stamp.protocolJurisdiction} v${stamp.protocolJurisdictionVersion}${tv}`;
}
