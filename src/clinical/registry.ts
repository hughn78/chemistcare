/**
 * Protocol registry + static validation
 * -------------------------------------
 * Every protocol must be registered here to be reachable by the UI.
 *
 * `validateRegistry()` encodes the regression guards demanded by the 12 Sep 2026
 * audit — the same class of defect that allowed nitrofurantoin to carry one
 * renal threshold in conditions.ts and a different one in conditionTemplates/uti.ts.
 * It rejects duplicate IDs, missing provenance, and any protocol claiming
 * 'active' while still flagged for clinical review.
 */

import { requireSource } from './sources';
import { utiProtocol } from './protocols/uti';
import { acneProtocol } from './protocols/acne';
import { dermatitisProtocol } from './protocols/dermatitis';
import {
  PROTOCOL_STATUS_ORDER,
  type ProtocolDefinition,
  type ProtocolLifecycleStatus,
} from './types';

export const PROTOCOL_REGISTRY: readonly ProtocolDefinition[] = [
  utiProtocol,
  acneProtocol,
  dermatitisProtocol,
];

/**
 * Conditions we have a registered source for but deliberately have NOT turned
 * into a ProtocolDefinition, because transcribing them would require inventing
 * or guessing clinical content. See the review note on each source.
 *
 * The registry validator asserts this set stays in sync with reality, so a
 * future contributor cannot silently add an unreviewed protocol for one of
 * these conditions without also removing it from this list.
 */
export const SOURCES_WITHOUT_PROTOCOL: readonly {
  sourceId: string;
  conditionId: string;
  reason: string;
}[] = [
  {
    sourceId: 'VIC_CCN_SHINGLES_2026_02',
    conditionId: 'shingles',
    reason:
      'The retrieved PDF is a February 2024 Safer Care Victoria document under the ' +
      'Community Pharmacist Statewide Pilot, not a current Department of Health ' +
      'Community Pharmacist Program protocol. It also contains internal ' +
      'contradictions. Per the stop-condition rule, it is marked for clinical ' +
      'review rather than transcribed, and no shingles pathway is offered.',
  },
  {
    sourceId: 'VIC_CCN_OCP_INIT_2026_07',
    conditionId: 'ocp-initiation',
    reason:
      'This is an INITIATION protocol, not a resupply protocol. Not yet transcribed; ' +
      'must be reviewed separately from hormonal contraception resupply.',
  },
  {
    sourceId: 'VIC_CCN_HORMONAL_RESUPPLY_2025_12',
    conditionId: 'hormonal-contraception-resupply',
    reason:
      'Source document not retrieved this sprint. Registered from the program ' +
      'landing page only. No content may be encoded until it is retrieved.',
  },
];

const BY_ID = new Map(PROTOCOL_REGISTRY.map(p => [p.id, p]));
const BY_CONDITION = new Map<string, ProtocolDefinition[]>();

for (const p of PROTOCOL_REGISTRY) {
  const list = BY_CONDITION.get(p.conditionId) ?? [];
  list.push(p);
  BY_CONDITION.set(p.conditionId, list);
}

export function getProtocol(protocolId: string): ProtocolDefinition | undefined {
  return BY_ID.get(protocolId);
}

export function protocolsForCondition(conditionId: string): ProtocolDefinition[] {
  return BY_CONDITION.get(conditionId) ?? [];
}

/**
 * Source precedence: Victorian Chemist Care Now protocol wins for the
 * Victorian pathway. Falls back to any other protocol for the condition.
 */
export function preferredProtocol(
  conditionId: string,
  jurisdiction: 'VIC' | 'QLD' = 'VIC',
): ProtocolDefinition | undefined {
  const candidates = protocolsForCondition(conditionId);
  if (candidates.length === 0) return undefined;
  return candidates.find(p => p.jurisdiction === jurisdiction) ?? candidates[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  protocolId: string;
  code:
    | 'duplicate_protocol_id'
    | 'unknown_source'
    | 'missing_source_metadata'
    | 'active_but_needs_review'
    | 'unknown_lifecycle_status'
    | 'medicine_missing_provenance'
    | 'duplicate_medicine_id'
    | 'duplicate_eligibility_id'
    | 'duplicate_red_flag_id'
    | 'empty_medicines'
    | 'review_flag_without_note'
    | 'blocked_source_has_protocol';
  message: string;
}

function hasStatus(s: string): s is ProtocolLifecycleStatus {
  return (PROTOCOL_STATUS_ORDER as readonly string[]).includes(s);
}

export function validateProtocol(p: ProtocolDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (code: ValidationIssue['code'], message: string) =>
    issues.push({ protocolId: p.id, code, message });

  if (!hasStatus(p.lifecycle)) {
    push('unknown_lifecycle_status', `Unknown lifecycle status '${p.lifecycle}'.`);
  }

  // An active protocol must have complete, resolvable source metadata.
  try {
    requireSource(p.sourceId);
  } catch {
    push('unknown_source', `sourceId '${p.sourceId}' is not registered in sources.ts.`);
  }

  if (!p.effectiveDate && (p.lifecycle === 'active' || p.lifecycle === 'clinically_reviewed')) {
    push('missing_source_metadata', 'An active protocol must state an effectiveDate.');
  }

  // The audit's core defect: unverified content silently becoming active.
  if (p.needsClinicalReview && (p.lifecycle === 'active' || p.lifecycle === 'clinically_reviewed')) {
    push(
      'active_but_needs_review',
      'needsClinicalReview is true but lifecycle claims reviewed/active. ' +
        'Unverified clinical content must not be presented as an approved pathway.',
    );
  }

  if (p.needsClinicalReview && !p.reviewNote) {
    push('review_flag_without_note', 'needsClinicalReview requires an explanatory reviewNote.');
  }

  if (p.medicines.length === 0) {
    push('empty_medicines', 'Protocol has no medicines — cannot support a prescribing decision.');
  }

  const seenMeds = new Set<string>();
  for (const m of p.medicines) {
    if (seenMeds.has(m.id)) push('duplicate_medicine_id', `Duplicate medicine id '${m.id}'.`);
    seenMeds.add(m.id);
    if (!m.sourceId) push('medicine_missing_provenance', `Medicine '${m.id}' has no sourceId.`);
  }

  const dup = (ids: { id: string }[], code: ValidationIssue['code'], kind: string) => {
    const seen = new Set<string>();
    for (const x of ids) {
      if (seen.has(x.id)) push(code, `Duplicate ${kind} id '${x.id}'.`);
      seen.add(x.id);
    }
  };
  dup(p.eligibility, 'duplicate_eligibility_id', 'eligibility criterion');
  dup(p.redFlags, 'duplicate_red_flag_id', 'red flag');

  return issues;
}

export function validateRegistry(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const p of PROTOCOL_REGISTRY) {
    if (seen.has(p.id)) {
      issues.push({
        protocolId: p.id,
        code: 'duplicate_protocol_id',
        message: `Duplicate protocol id '${p.id}'.`,
      });
    }
    seen.add(p.id);
    issues.push(...validateProtocol(p));
  }

  // More than one non-superseded protocol for the same jurisdiction+condition
  // is ambiguous unless explicitly intended.
  const activeByKey = new Map<string, ProtocolDefinition[]>();
  for (const p of PROTOCOL_REGISTRY) {
    if (p.lifecycle === 'superseded' || p.lifecycle === 'retired') continue;
    const key = `${p.jurisdiction}:${p.conditionId}`;
    const list = activeByKey.get(key) ?? [];
    list.push(p);
    activeByKey.set(key, list);
  }
  for (const [key, list] of activeByKey) {
    if (list.length > 1) {
      issues.push({
        protocolId: list.map(p => p.id).join(', '),
        code: 'duplicate_protocol_id',
        message: `${list.length} non-superseded protocols for ${key}: ${list
          .map(p => p.id)
          .join(', ')}. Exactly one must be authoritative.`,
      });
    }
  }

  // A condition on the blocked list must not quietly acquire a protocol. If it
  // does, someone has transcribed content the source could not support.
  for (const blocked of SOURCES_WITHOUT_PROTOCOL) {
    const present = protocolsForCondition(blocked.conditionId);
    if (present.length > 0) {
      issues.push({
        protocolId: present.map(p => p.id).join(', '),
        code: 'blocked_source_has_protocol',
        message:
          `Condition '${blocked.conditionId}' is on SOURCES_WITHOUT_PROTOCOL because: ` +
          `${blocked.reason} A protocol has been registered for it anyway. Either the ` +
          `source problem is resolved (remove it from the list) or the protocol must ` +
          `not ship.`,
      });
    }
  }

  return issues;
}
