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
import { impetigoTemplate } from './impetigo';
import { rhinitisTemplate } from './rhinitis';
import { gordTemplate } from './gord';
import { acneTemplate } from './acne';
import { atopicDermatitisTemplate } from './atopicDermatitis';
import { earInfectionsTemplate } from './earInfections';
import { nauseaTemplate } from './nauseaCorpus';
import { psoriasisTemplate } from './psoriasisCorpus';
import { gordTemplate as gordCorpusTemplate } from './gordCorpus';
import { atopicDermatitisCorpusTemplate } from './atopicDermatitisCorpus';

/**
 * Corpus-driven templates (nauseaCorpus/psoriasisCorpus/gordCorpus/
 * atopicDermatitisCorpus) are DATA-DERIVED from the Sep 2026 protocol
 * corpus: their red flags, scope rules, treatments and note generators
 * come from the governing instrument (see ./corpusFactory.ts). They are
 * listed FIRST so first-match-wins lookup below resolves their slugs to
 * the corpus versions; the hand-written GORD/AD templates remain
 * registered for any code referencing them by import.
 */
export const CONDITION_TEMPLATES: ConditionTemplate[] = [
  utiTemplate,
  nauseaTemplate,
  psoriasisTemplate,
  gordCorpusTemplate,
  atopicDermatitisCorpusTemplate,
  herpesZosterTemplate,
  ocpResupplyTemplate,
  smokingCessationTemplate,
  impetigoTemplate,
  rhinitisTemplate,
  gordTemplate,
  acneTemplate,
  atopicDermatitisTemplate,
  earInfectionsTemplate,
];

const BY_SLUG = new Map<string, ConditionTemplate>();
for (const t of CONDITION_TEMPLATES) {
  if (!BY_SLUG.has(t.slug)) BY_SLUG.set(t.slug, t);
}
const BY_ID = new Map<string, ConditionTemplate>();
for (const t of CONDITION_TEMPLATES) {
  if (!BY_ID.has(t.id)) BY_ID.set(t.id, t);
}

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
