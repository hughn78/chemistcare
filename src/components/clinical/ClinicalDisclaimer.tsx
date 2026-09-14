/**
 * Clinical decision-support disclaimer.
 *
 * Always visible, never hover-only, never a modal the user must dismiss to
 * proceed. The point is that a pharmacist can see at a glance that this is
 * decision support, not a decision maker.
 */
export function ClinicalDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[10px] leading-snug text-muted-foreground">
        Clinical decision support only. Protocol content must be reviewed and signed off by a
        pharmacist prescriber before use, and does not replace professional judgement or establish
        legal authority to prescribe.
      </p>
    );
  }

  return (
    <aside
      aria-label="Clinical disclaimer"
      className="border-t bg-muted/40 px-4 py-2 text-[10px] leading-snug text-muted-foreground"
    >
      <strong className="font-semibold">Clinical decision support only.</strong> This software does
      not diagnose, prescribe, or make clinical decisions, and it does not assess your registration,
      training or scope of practice. Protocol content is transcribed from published state health
      department documents and must be reviewed and signed off by a pharmacist prescriber before
      clinical use. Legal authority to supply is determined by the jurisdiction and your own scope —
      not by this application.
    </aside>
  );
}
