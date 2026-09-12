import { AlertOctagon, AlertTriangle, ArrowRight, Info, ShieldCheck, Stethoscope } from 'lucide-react';
import type { SafetyFinding, SafetySeverity } from '@/clinical/types';
import { MIN_OVERRIDE_REASON_LENGTH } from '@/clinical/safety';

/**
 * Renders structured safety findings.
 *
 * Design constraints from the sprint brief:
 *  - No numeric safety score. A "72/100" cannot express "absolute
 *    contraindication, do not supply" versus "monitor renal function".
 *  - Severity is conveyed by icon + label + colour, never colour alone.
 *  - Override policy is stated explicitly, because "you can override this"
 *    and "you cannot override this" is the single most important thing a
 *    pharmacist needs to know about a warning.
 *  - Nothing here is hover-only.
 */

const SEVERITY_META: Record<
  SafetySeverity,
  { label: string; icon: typeof Info; className: string; textClassName: string }
> = {
  hard_stop: {
    label: 'Do not supply',
    icon: AlertOctagon,
    className: 'border-red-500/50 bg-red-50',
    textClassName: 'text-red-900',
  },
  contraindication: {
    label: 'Contraindication',
    icon: AlertOctagon,
    className: 'border-red-400/50 bg-red-50/70',
    textClassName: 'text-red-900',
  },
  refer: {
    label: 'Refer',
    icon: ArrowRight,
    className: 'border-amber-500/50 bg-amber-50',
    textClassName: 'text-amber-950',
  },
  caution: {
    label: 'Caution',
    icon: AlertTriangle,
    className: 'border-amber-400/50 bg-amber-50/70',
    textClassName: 'text-amber-950',
  },
  monitor: {
    label: 'Monitor / incomplete',
    icon: Stethoscope,
    className: 'border-sky-500/40 bg-sky-50',
    textClassName: 'text-sky-950',
  },
  information: {
    label: 'Information',
    icon: Info,
    className: 'border-border bg-muted/50',
    textClassName: 'text-foreground',
  },
};

const POLICY_LABEL: Record<SafetyFinding['overridePolicy'], string> = {
  non_overridable: 'Cannot be overridden',
  rationale_required: `Overridable with written rationale (min ${MIN_OVERRIDE_REASON_LENGTH} characters)`,
  warning_only: 'Advisory — does not block',
};

export function SafetyFindingsPanel({
  findings,
  title = 'Safety findings',
  emptyMessage = 'No safety findings. All screened rules are clear.',
}: {
  findings: SafetyFinding[];
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
        {findings.length > 0 && (
          <span className="ml-1 font-normal normal-case">({findings.length})</span>
        )}
      </h3>

      {findings.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-clinical-safe" aria-hidden="true" />
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {findings.map(f => {
            const meta = SEVERITY_META[f.severity];
            const Icon = meta.icon;
            return (
              <li
                key={f.ruleId}
                className={`rounded-md border p-2 ${meta.className} ${meta.textClassName}`}
              >
                <div className="flex items-start gap-1.5">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      <span className="uppercase tracking-wide">{meta.label}</span> · {f.finding}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug opacity-90">{f.reason}</p>
                    <p className="mt-1 text-[11px] font-medium leading-snug">
                      Action: {f.recommendedAction}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide opacity-70">
                      {POLICY_LABEL[f.overridePolicy]}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
