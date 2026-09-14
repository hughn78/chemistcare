import { AlertTriangle, CheckCircle2, Clock, FileText, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  mayPresentAsPrescribingPathway,
  type ProtocolDefinition,
  type ProtocolLifecycleStatus,
} from '@/clinical/types';
import { describeSource, getSource } from '@/clinical/sources';

/**
 * Protocol provenance UI.
 *
 * The sprint brief is explicit: every protocol must be able to answer
 * "Where did this recommendation come from?" — Protocol, Jurisdiction,
 * Source, Version date, Clinical status — shown subtly, inspectable on
 * demand, and never implied to be approved when it is not.
 *
 * Status is conveyed by icon + text + colour, never by colour alone
 * (accessibility requirement).
 */

const STATUS_META: Record<
  ProtocolLifecycleStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' | 'success' | 'info'; icon: typeof Info; hint: string }
> = {
  draft: {
    label: 'Draft',
    variant: 'secondary',
    icon: FileText,
    hint: 'Not yet traced to a published source. Reference only.',
  },
  source_verified: {
    label: 'Source verified',
    variant: 'info',
    icon: CheckCircle2,
    hint: 'Transcribed from a retrieved source document; awaiting clinical review.',
  },
  clinical_review_required: {
    label: 'Clinical review required',
    variant: 'warning',
    icon: ShieldAlert,
    hint: 'A conflict or unverified value was found. Must be reviewed before use.',
  },
  clinically_reviewed: {
    label: 'Clinically reviewed',
    variant: 'success',
    icon: CheckCircle2,
    hint: 'Reviewed by a clinician and approved for use as a pathway.',
  },
  active: {
    label: 'Active',
    variant: 'success',
    icon: CheckCircle2,
    hint: 'Approved and current.',
  },
  superseded: {
    label: 'Superseded',
    variant: 'warning',
    icon: Clock,
    hint: 'Replaced by a newer version. Do not use for new consultations.',
  },
  retired: {
    label: 'Retired',
    variant: 'destructive',
    icon: AlertTriangle,
    hint: 'Withdrawn. Do not use.',
  },
};

export function ProtocolStatusBadge({
  status,
  needsClinicalReview,
  className,
}: {
  status: ProtocolLifecycleStatus;
  needsClinicalReview?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className={className} title={meta.hint}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {meta.label}
      {/* Text, not just colour — the review flag must survive greyscale. */}
      {needsClinicalReview && <span className="ml-1 font-normal">· needs review</span>}
    </Badge>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Full provenance record for a protocol. Rendered inside a popover/details
 * drawer; intentionally dense because a pharmacist auditing a decision needs
 * the citation, not a summary.
 */
export function ProtocolProvenanceDetails({ protocol }: { protocol: ProtocolDefinition }) {
  const source = getSource(protocol.sourceId);
  const usable = mayPresentAsPrescribingPathway(protocol.lifecycle);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-tight">{protocol.title}</p>
        <p className="text-xs text-muted-foreground">
          {protocol.conditionName} · {protocol.jurisdiction}
        </p>
      </div>

      <dl className="divide-y divide-border">
        <Row label="Protocol" value={protocol.title} />
        <Row label="Protocol ID" value={<code className="text-[11px]">{protocol.id}</code>} />
        <Row label="Jurisdiction" value={protocol.jurisdiction} />
        <Row label="Authority" value={protocol.authorityName} />
        <Row
          label="Source"
          value={
            source ? (
              <a
                href={source.documentUrl ?? source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:no-underline"
              >
                {source.title}
              </a>
            ) : (
              <span className="text-destructive">Unknown source ({protocol.sourceId})</span>
            )
          }
        />
        <Row label="Version" value={source?.version ?? protocol.effectiveDate} />
        <Row label="Published" value={source?.publishedDate} />
        <Row label="Last updated" value={source?.updatedDate} />
        <Row label="Retrieved" value={source?.retrievedAt ?? protocol.sourceId} />
        {source?.isbn && <Row label="ISBN" value={source.isbn} />}
        <Row label="Effective" value={protocol.effectiveDate} />
        <Row
          label="Clinical status"
          value={
            <span className="inline-flex items-center gap-1.5">
              <ProtocolStatusBadge
                status={protocol.lifecycle}
                needsClinicalReview={protocol.needsClinicalReview}
              />
              <span className="text-muted-foreground">{STATUS_META[protocol.lifecycle].hint}</span>
            </span>
          }
        />
        {source && <Row label="Provenance" value={<span className="text-muted-foreground">{describeSource(source)}</span>} />}
      </dl>

      {protocol.needsClinicalReview && (
        <div className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900">
          <p className="font-semibold">Flagged for clinical review</p>
          <p className="mt-0.5">
            {protocol.reviewNote ??
              'A value in this protocol could not be verified against the source document.'}
          </p>
        </div>
      )}

      {!usable && (
        <p className="rounded-md border bg-muted p-2 text-xs text-muted-foreground">
          This protocol is <strong>not an approved prescribing pathway</strong>. It is shown for
          reference and development only.
        </p>
      )}
    </div>
  );
}

/**
 * Subtle trigger ("Where did this come from?") that opens the provenance
 * record. Use wherever a protocol-derived recommendation is displayed.
 */
export function ProtocolProvenancePopover({
  protocol,
  align = 'start',
}: {
  protocol: ProtocolDefinition;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3 w-3" aria-hidden="true" />
          Source &amp; status
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[26rem]">
        <ProtocolProvenanceDetails protocol={protocol} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Banner shown whenever a protocol is displayed that must NOT be treated as
 * an approved pathway. Deliberately impossible to miss but does not block
 * reading: this is reference material, not a live service.
 */
export function ProtocolReferenceModeBanner({
  protocol,
  compact = false,
}: {
  protocol: ProtocolDefinition;
  /** One-line variant for use inside a consultation header. */
  compact?: boolean;
}) {
  if (mayPresentAsPrescribingPathway(protocol.lifecycle)) return null;

  const reason =
    protocol.lifecycle === 'clinical_review_required'
      ? 'One or more values in this protocol could not be verified against the source document.'
      : protocol.lifecycle === 'source_verified'
        ? 'This protocol has been transcribed from the source document but has not yet been reviewed and signed off by a pharmacist prescriber.'
        : protocol.lifecycle === 'superseded'
          ? 'This protocol has been replaced by a newer version.'
          : protocol.lifecycle === 'retired'
            ? 'This protocol has been withdrawn.'
            : 'This protocol has not been traced to a published source document.';

  if (compact) {
    return (
      <p
        role="note"
        className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-50 px-2 py-1.5 text-xs text-amber-950"
      >
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span>
          <strong>Reference / development mode.</strong> {reason}
        </span>
      </p>
    );
  }

  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-950"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <div>
        <p className="font-semibold">Reference / development mode — not an approved pathway</p>
        <p className="mt-0.5 text-xs leading-relaxed">{reason}</p>
        {protocol.needsClinicalReview && protocol.reviewNote && (
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80">{protocol.reviewNote}</p>
        )}
      </div>
    </div>
  );
}
