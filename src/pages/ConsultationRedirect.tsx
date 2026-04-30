import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { getRegistryEntryById } from '@/lib/conditionRegistry';

/**
 * Legacy `/consultation` and `/consultation?condition=<id>` redirector.
 *
 * Older buttons (Dashboard, ConditionDetail, PrescribingLog, ReviewPanel)
 * still link to `/consultation`. This component preserves those links by
 * translating them to the canonical condition-aware URL:
 *
 *   /consultation                  → /consultations/new
 *   /consultation?condition=uti    → /consultations/new/uncomplicated-uti
 *   /consultation?condition=BAD    → /consultations/new?error=...
 *
 * No silent fallback to Travel Medicine.
 */
const ConsultationRedirect = () => {
  const [params] = useSearchParams();
  const conditionId = params.get('condition');

  if (!conditionId) {
    return <Navigate to="/consultations/new" replace />;
  }

  const entry = getRegistryEntryById(conditionId);
  if (!entry) {
    const err = encodeURIComponent('That consultation type is no longer available — please pick one below.');
    return <Navigate to={`/consultations/new?error=${err}`} replace />;
  }

  // Preserve `?resume=1` if a future caller adds it.
  const qs = params.get('resume') ? '?resume=1' : '';
  return <Navigate to={`/consultations/new/${entry.slug}${qs}`} replace />;
};

export default ConsultationRedirect;
