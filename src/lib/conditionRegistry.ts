/**
 * ChemistCare PrescriberOS — Central Condition Registry
 * ------------------------------------------------------
 * Single source of truth wired on top of the existing clinical
 * `CONDITIONS` data set in `src/data/conditions.ts`. Every consumer
 * (sidebar, picker, NewConsultation, ConditionsLibrary) MUST read
 * conditions from this registry so that:
 *
 *   - URL slugs are stable
 *   - Pinning, sort order, categories, enable flags live in one place
 *   - Adding a new condition only requires editing CONDITIONS + (optionally)
 *     overrides in REGISTRY_OVERRIDES below.
 *
 * NOTE: We intentionally do NOT introduce Zod here. Validation already
 * lives in `src/components/ConsultationValidation.tsx` and is condition-
 * driven via the existing `validateStep(step, formData, condition, ...)`.
 * Migrating to Zod is tracked separately to avoid regressing the safety
 * score and completion-readiness behaviour required by the demo.
 */
import { CONDITIONS, getConditionById } from '@/data/conditions';
import { corpusJurisdictionsForSlug } from '@/data/protocol-corpus';
import type { Condition } from '@/types/clinical';

export type ConditionCategory =
  | 'acute'
  | 'chronic'
  | 'preventive'
  | 'resupply'
  | 'travel';

export interface ConditionRegistryEntry {
  id: string;
  slug: string;
  name: string;
  category: ConditionCategory;
  description: string;
  redFlagCount: number;
  treatmentOptionCount: number;
  /** Underlying clinical condition (template payload). */
  condition: Condition;
  /** Whether the condition is enabled for new consultations. */
  enabled: boolean;
  /** Show as a Quick Start item in the sidebar. */
  pinned: boolean;
  /** Sidebar / picker ordering when pinned. Lower = earlier. */
  sortOrder: number;
  /** Bumped when the underlying protocol template changes shape. */
  templateVersion: number;
  /** Jurisdictions where the protocol is legally available. */
  jurisdictionAvailability: string[];
  /** ISO date of last clinical review. */
  lastReviewed?: string;
}

const TEMPLATE_VERSION = 1;
const DEFAULT_JURISDICTIONS = ['VIC'];

/** Slugify a name → URL-safe stable slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Per-condition overrides: pin status, sort order, category override,
 * stable slug overrides. Anything not listed falls back to defaults
 * (slug derived from name, category derived from classification, not pinned).
 */
type RegistryOverride = Partial<
  Pick<
    ConditionRegistryEntry,
    | 'slug'
    | 'category'
    | 'pinned'
    | 'sortOrder'
    | 'enabled'
    | 'jurisdictionAvailability'
    | 'lastReviewed'
  >
>;

const REGISTRY_OVERRIDES: Record<string, RegistryOverride> = {
  // Pinned / Quick Start (per product spec)
  'travel-medicine': { slug: 'travel-medicine', category: 'travel', pinned: true, sortOrder: 10 },
  uti:               { slug: 'uncomplicated-uti', pinned: true, sortOrder: 20 },
  'ocp-resupply':    { slug: 'ocp-resupply', pinned: true, sortOrder: 30 },
  'herpes-zoster':   { slug: 'herpes-zoster', pinned: true, sortOrder: 40 },
  'wound-management': { slug: 'minor-wound-management', pinned: true, sortOrder: 50 },
  msk:               { slug: 'mild-acute-musculoskeletal-pain', pinned: true, sortOrder: 60 },
  rhinitis:          { slug: 'allergic-and-non-allergic-rhinitis', pinned: true, sortOrder: 70 },

  // Stable slugs for the rest (so URLs don't drift if names get tweaked)
  hypertension:        { slug: 'hypertension' },
  t2dm:                { slug: 'type-2-diabetes' },
  nausea:              { slug: 'acute-nausea-and-vomiting' },
  asthma:              { slug: 'asthma-and-exercise-induced-bronchoconstriction' },
  'atopic-dermatitis': { slug: 'atopic-dermatitis' },
  copd:                { slug: 'copd' },
  dyslipidaemia:       { slug: 'dyslipidaemia' },
  'ear-infections':    { slug: 'ear-infections' },
  gord:                { slug: 'gord' },
  impetigo:            { slug: 'impetigo' },
  acne:                { slug: 'mild-moderate-acne' },
  psoriasis:           { slug: 'psoriasis' },
  'oral-health':       { slug: 'oral-health-screening-fluoride' },
  'smoking-cessation': { slug: 'smoking-cessation' },
  weight:              { slug: 'weight-management-obesity' },
};

/** Map the existing clinical `classification` to a registry `category`. */
function categoryForCondition(c: Condition): ConditionCategory {
  if (c.id === 'travel-medicine') return 'travel';
  if (c.classification === 'acute') return 'acute';
  if (c.classification === 'chronic') return 'chronic';
  if (c.classification === 'preventive') return 'preventive';
  if (c.classification === 'resupply') return 'resupply';
  return 'acute';
}

function buildEntry(c: Condition): ConditionRegistryEntry {
  const override = REGISTRY_OVERRIDES[c.id] ?? {};
  const slug = override.slug ?? slugify(c.name);
  // Corpus-derived jurisdiction availability (Sep 2026 snapshot) takes
  // precedence: static DEFAULT_JURISDICTIONS only applies when the corpus
  // has no document group mapped to this condition's slug.
  const corpusStates = corpusJurisdictionsForSlug(slug);
  return {
    id: c.id,
    slug,
    name: c.name,
    category: override.category ?? categoryForCondition(c),
    description: c.description,
    redFlagCount: c.redFlags.length,
    treatmentOptionCount: c.therapyOptions.length,
    condition: c,
    enabled: override.enabled ?? c.therapyOptions.length > 0,
    pinned: override.pinned ?? false,
    sortOrder: override.sortOrder ?? 1000,
    templateVersion: TEMPLATE_VERSION,
    jurisdictionAvailability:
      override.jurisdictionAvailability ??
      (corpusStates.length > 0 ? corpusStates : DEFAULT_JURISDICTIONS),
    lastReviewed: override.lastReviewed,
  };
}

/** The complete registry, sorted alphabetically by name. */
export const CONDITION_REGISTRY: ConditionRegistryEntry[] = CONDITIONS
  .map(buildEntry)
  .sort((a, b) => a.name.localeCompare(b.name));

// ────────── Lookup helpers ──────────

const BY_SLUG = new Map(CONDITION_REGISTRY.map(e => [e.slug, e]));
const BY_ID = new Map(CONDITION_REGISTRY.map(e => [e.id, e]));

export function getConditionBySlug(slug: string): ConditionRegistryEntry | undefined {
  return BY_SLUG.get(slug);
}

export function getRegistryEntryById(id: string): ConditionRegistryEntry | undefined {
  return BY_ID.get(id);
}

export function getSlugForConditionId(id: string): string | undefined {
  return BY_ID.get(id)?.slug;
}

export function getPinnedConditions(): ConditionRegistryEntry[] {
  return CONDITION_REGISTRY
    .filter(e => e.pinned && e.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const CATEGORY_LABEL: Record<ConditionCategory, string> = {
  acute: 'Acute',
  chronic: 'Chronic',
  preventive: 'Preventive',
  resupply: 'Resupply',
  travel: 'Travel',
};

export const ALL_CATEGORIES: ConditionCategory[] = ['acute', 'chronic', 'preventive', 'resupply', 'travel'];

export function getConditionsByCategory(category: ConditionCategory): ConditionRegistryEntry[] {
  return CONDITION_REGISTRY.filter(e => e.category === category);
}

// Re-export for callers that still want the underlying clinical record.
export { getConditionById };
