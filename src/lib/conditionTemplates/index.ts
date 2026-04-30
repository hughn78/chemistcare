/**
 * Condition Templates — Central Registry
 * ---------------------------------------
 * Single source of truth that maps condition slugs → fully-typed
 * `ConditionTemplate` definitions.
 *
 * STATUS:
 *   - Phase 1 (this iteration): UTI (active) + 3 reference templates
 *     (Herpes Zoster, OCP Resupply, Smoking Cessation) all carrying
 *     real protocol metadata. The remaining 18 conditions still fall
 *     through to the legacy generic engine in `NewConsultation.tsx`
 *     until their templates land.
 *
 * Adding a new condition:
 *   1. Create `./<slug>.ts` exporting a `ConditionTemplate`.
 *   2. Import + register it in `CONDITION_TEMPLATES` below.
 *   3. The `Conditions Library`, picker, sidebar, audit, and note
 *      footer wire-up automatically read from this registry.
 */
import type { ConditionTemplate } from './types';
import { utiTemplate } from './uti';
import { herpesZosterTemplate } from './herpesZoster';
import { ocpResupplyTemplate } from './ocpResupply';
import { smokingCessationTemplate } from './smokingCessation';

export const CONDITION_TEMPLATES: ConditionTemplate[] = [
  utiTemplate,
  herpesZosterTemplate,
  ocpResupplyTemplate,
  smokingCessationTemplate,
];

const BY_SLUG = new Map(CONDITION_TEMPLATES.map(t => [t.slug, t]));
const BY_ID = new Map(CONDITION_TEMPLATES.map(t => [t.id, t]));

export function getConditionTemplateBySlug(slug: string): ConditionTemplate | undefined {
  return BY_SLUG.get(slug);
}

export function getConditionTemplateById(id: string): ConditionTemplate | undefined {
  return BY_ID.get(id);
}

export function hasFullTemplate(slug: string): boolean {
  return BY_SLUG.has(slug);
}

export type { ConditionTemplate } from './types';
