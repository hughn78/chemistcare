import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, ShieldAlert, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  AI_DRAFT_NOTICE,
  PHARMACIST_ATTESTATION,
  attestDraft,
  validateAiDraft,
  type AiConsentState,
  type AiDraft,
} from '@/clinical/aiGuardrails';

/**
 * Hybrid documentation: the pharmacist writes (or dictates) their own notes
 * first, AI may expand them into a draft, and the pharmacist then reviews and
 * attests before anything reaches the record.
 *
 * Requirements enforced here:
 *  - Consent is asked explicitly, with a "Continue without AI" path.
 *  - AI output is always labelled a draft.
 *  - A draft cannot be saved until "Reviewed and confirmed by pharmacist" is
 *    ticked AND the pharmacist is named.
 *  - AI never satisfies a mandatory clinical field, clears a red flag,
 *    overrides an exclusion, or finalises anything — the guardrail module
 *    forbids it and this panel only ever handles narrative text.
 */
export function AiAssistPanel({
  value,
  onChange,
  consent,
  onConsentChange,
  pharmacistName,
  onPharmacistNameChange,
  disabled = false,
  /** Optional: expand the pharmacist's own notes into an AI draft. */
  onExpand,
}: {
  value: string;
  onChange: (v: string) => void;
  consent: AiConsentState;
  onConsentChange: (c: AiConsentState) => void;
  pharmacistName: string;
  onPharmacistNameChange: (name: string) => void;
  disabled?: boolean;
  onExpand?: (pharmacistNotes: string) => Promise<string> | string;
}) {
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [attested, setAttested] = useState(false);

  const issues = useMemo(() => (draft ? validateAiDraft(draft) : []), [draft]);
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  const requestDraft = async () => {
    if (!onExpand) return;
    setExpanding(true);
    try {
      const content = await onExpand(value);
      setDraft({
        id: `ai-${Date.now()}`,
        kind: 'narrative',
        content,
        status: 'draft',
        generatedBy: 'AI scribe',
        generatedAt: new Date().toISOString(),
      });
      setAttested(false);
    } finally {
      setExpanding(false);
    }
  };

  const acceptDraft = () => {
    if (!draft) return;
    if (!attested || !pharmacistName.trim()) return;
    const reviewed = attestDraft(draft, pharmacistName);
    setDraft(reviewed);
    onChange(reviewed.content);
  };

  if (consent === 'not_asked') {
    return (
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-start gap-2">
          <Bot className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Use AI assistance for this note?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              If you continue, an AI draft will be generated from your own notes. It is always
              marked as a draft and you must review and confirm it before it is saved.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onConsentChange('granted')}>
                Yes — use AI assistance
              </Button>
              <Button size="sm" variant="outline" onClick={() => onConsentChange('declined')}>
                Continue without AI
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          {consent === 'granted' ? 'AI assistance on' : 'AI assistance off'}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={() => onConsentChange('not_asked')}
        >
          Change
        </Button>
      </div>

      <div>
        <Label htmlFor="pharmacist-notes" className="text-xs">
          Your notes
        </Label>
        <Textarea
          id="pharmacist-notes"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Write your own assessment in your words first."
          className="min-h-[7rem] text-sm"
          aria-describedby="pharmacist-notes-help"
        />
        <p id="pharmacist-notes-help" className="mt-1 text-[10px] text-muted-foreground">
          Documentation is complete without AI. The draft below is optional.
        </p>
      </div>

      {consent === 'granted' && !onExpand && (
        <p className="rounded-md border bg-muted/50 p-2 text-[11px] text-muted-foreground">
          AI drafting is not connected in this environment. Consent has been recorded and
          documentation remains fully manual.
        </p>
      )}

      {consent === 'granted' && onExpand && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={requestDraft}
            disabled={disabled || expanding || !value.trim()}
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {expanding ? 'Drafting…' : 'Draft note from my notes'}
          </Button>

          {draft && (
            <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-amber-950">
              <p className="flex items-start gap-1.5 text-xs font-semibold">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {AI_DRAFT_NOTICE}
              </p>

              <Textarea
                aria-label="AI-generated draft note"
                value={draft.content}
                onChange={e => setDraft({ ...draft, content: e.target.value, status: 'draft' })}
                className="min-h-[7rem] bg-background text-sm"
              />

              {warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {w.message}
                </p>
              ))}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="ai-attest"
                    checked={attested}
                    onCheckedChange={v => setAttested(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="ai-attest" className="text-xs leading-relaxed">
                    {PHARMACIST_ATTESTATION} — I have read this note and confirm it accurately
                    represents the consultation.
                  </Label>
                </div>
                <div>
                  <Label htmlFor="ai-reviewer" className="text-xs">
                    Reviewing pharmacist *
                  </Label>
                  <Input
                    id="ai-reviewer"
                    value={pharmacistName}
                    onChange={e => onPharmacistNameChange(e.target.value)}
                    placeholder="Full name"
                    className="h-8"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={acceptDraft}
                  disabled={!attested || !pharmacistName.trim()}
                >
                  Accept into record
                </Button>
                {errors.length > 0 && (
                  <p role="status" className="text-[11px] text-clinical-danger">
                    {errors[0].message}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
