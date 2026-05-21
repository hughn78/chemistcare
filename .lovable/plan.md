## Scope

A multi-page rewrite touching dashboard, inner pages, and shared loading patterns. All work is presentation-layer — no business logic, routes, or fields removed.

## 1. Dashboard rewrite — `src/pages/Index.tsx`

- Header: "Prescriber command centre" + current date (formatted `Thursday, 21 May 2026`) + status pill `Practice: ChemistCare Demo • All systems operational` (green dot).
- Stats row: 4 cards (Today's consultations, Active patients, Pending follow-ups, Scripts this month). Each: label, large counting-up number, 7-day recharts sparkline (1px stroke, no fill, no grid, no axes, no tooltip), delta indicator (`+12% vs avg`).
- Custom hook `useCountUp(target, durationMs)` — rAF-based, no library.
- Activity feed: timeline items like `09:14 — UTI protocol completed for Sarah Chen (Rx sent to MediSecure)`, left border colour by event type (green/amber/red), monospaced timestamp.
- Clinical actions: 2-column grid, icon + label only, lucide icons, no emojis.
- Remove: safety reminders card, supported-conditions promo card, draft menu noise.

## 2. Skeleton loading

Add a brief skeleton state to `Patients.tsx`, `Claims.tsx`, and `NewConsultation.tsx` (the consultations entry). No `Episodes.tsx` exists — will skip per the "do not delete/rename" rule and note it. Pattern:

- `useState(loading)` flipped after 600ms timeout on mount (demo data is local).
- Skeletons fade with `transition-opacity duration-200`.
- Tables: header visible immediately, 6 skeleton body rows.
- Empty state: Lucide `Inbox`, sentence-case copy, "Clear filters" link.
- No spinners, no "Loading…" text.

## 3. Page rebranding (copy + headers only — no field/step removal)

- `Patients.tsx` → header "Patient registry". Card rows already show name/DOB/Medicare/last visit/conditions; add a "Risk score" badge column (derived placeholder: `Low`/`Moderate` from conditions count). Replace any "Status: Healthy"-style copy with "Active under care".
- `NewConsultation.tsx` → header "Clinical consultation"; CTA "Start consultation".
- `Claims.tsx` → header "PBS claims & reimbursements" + summary bar (Total claimable / Total paid / Discrepancies) computed from existing claim data.
- `Settings.tsx` → header "Practice settings"; group existing sections under Clinic profile / Prescriber credentials / Integrations / Notifications. Remove theme toggle if present.
- Capitalisation pass: sentence case for all headings/buttons touched.

## Out of scope

- No new routes, no removed fields, no router/sidebar changes.
- No new dependencies (recharts already installed via shadcn chart).
- No backend/schema changes.

## Files touched

- `src/pages/Index.tsx` (rewrite)
- `src/hooks/useCountUp.ts` (new)
- `src/pages/Patients.tsx` (skeleton + rebrand)
- `src/pages/Claims.tsx` (skeleton + summary bar + rebrand)
- `src/pages/NewConsultation.tsx` (header rebrand only — large file, surgical edit)
- `src/pages/Settings.tsx` (rebrand + grouping)
- `src/components/PageSkeleton.tsx` (extend with `TableRowsSkeleton`, `EmptyState` already exists)

Confirm to proceed, or tell me which sections to drop.