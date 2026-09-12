import { useMemo, useState } from 'react';
import { ArrowRight, ClipboardCopy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { ConsultOutcomeKind, ReferralOutcome } from '@/clinical/types';

/**
 * Referral is a successful clinical outcome, not a dead end.
 *
 * Previously a consultation that ended in a referral had nowhere to go: the
 * treatment step simply locked. This panel makes the outcome explicit, names
 * the urgency, and produces an ISBAR handover the pharmacist can send.
 */

const URGENCY_STYLE: Record<ConsultOutcomeKind, { className: string; note: string }> = {
  call_emergency: {
    className: 'border-red-600 bg-red-100 text-red-950',
    note: 'Call 000 now. Do not leave the patient unattended.',
  },
  emergency_department: {
    className: 'border-red-500 bg-red-50 text-red-950',
    note: 'Arrange immediate transfer to an Emergency Department.',
  },
  urgent_care: {
    className: 'border-orange-500 bg-orange-50 text-orange-950',
    note: 'Same-day urgent care review.',
  },
  refer_same_day: {
    className: 'border-amber-500 bg-amber-50 text-amber-950',
    note: 'Contact the GP today and arrange review today.',
  },
  specialist: {
    className: 'border-sky-500 bg-sky-50 text-sky-950',
    note: 'Refer to the appropriate specialist or service.',
  },
  refer_routine: {
    className: 'border-sky-500 bg-sky-50 text-sky-950',
    note: 'Advise the patient to see their GP. Provide a written summary.',
  },
  treat_and_refer: {
    className: 'border-emerald-500 bg-emerald-50 text-emerald-950',
    note: 'Supply may proceed under the protocol AND the patient needs GP review.',
  },
  treat: {
    className: 'border-emerald-500 bg-emerald-50 text-emerald-950',
    note: 'Supply under the protocol with safety-netting advice.',
  },
  no_treatment: {
    className: 'border-border bg-muted text-foreground',
    note: 'No medicine supplied. Self-care advice and safety netting given.',
  },
  undecided: {
    className: 'border-border bg-muted text-foreground',
    note: 'Assessment is not complete. Finish screening before deciding.',
  },
};

export function ReferralPanel({
  outcome,
  handover,
  onHandoverChange,
  readOnly = false,
}: {
  outcome: ReferralOutcome;
  handover: string;
  /** When provided, the handover is editable (pharmacist reviews before sending). */
  onHandoverChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const style = URGENCY_STYLE[outcome.kind];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handover);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the textarea is still selectable.
      setCopied(false);
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${style.className}`}>
      <div className="flex items-start gap-2">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide">Outcome</p>
          <p className="text-sm font-bold">{outcome.label}</p>
          <p className="mt-0.5 text-xs leading-snug">{outcome.reason}</p>
          <p className="mt-1 text-[11px] font-medium leading-snug opacity-90">{style.note}</p>
          {outcome.prescribingBlocked && (
            <p className="mt-1 text-[11px] font-semibold uppercase">
              Supply not permitted under the protocol
            </p>
          )}
          {outcome.ruleId && (
            <p className="mt-1 text-[10px] uppercase tracking-wide opacity-70">
              Rule {outcome.ruleId}
            </p>
          )}
        </div>
      </div>

      {handover && (
        <>
          <Separator className="my-3" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="isbar-handover" className="text-[11px] font-semibold uppercase tracking-wider">
                ISBAR handover
              </Label>
              <Button size="sm" variant="ghost" onClick={copy} className="h-6 px-2 text-[11px]">
                {copied ? (
                  <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                ) : (
                  <ClipboardCopy className="mr-1 h-3 w-3" aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {readOnly || !onHandoverChange ? (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-background/60 p-2 text-[11px] leading-snug">
                {handover}
              </pre>
            ) : (
              <Textarea
                id="isbar-handover"
                value={handover}
                onChange={e => onHandoverChange(e.target.value)}
                className="min-h-[10rem] font-mono text-[11px]"
                aria-describedby="isbar-handover-help"
              />
            )}
            <p id="isbar-handover-help" className="text-[10px] opacity-75">
              Review and edit before sending. This text is for clinicians — give the patient a
              plain-language explanation separately.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
