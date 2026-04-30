import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  AlertTriangle,
  Pill,
  ChevronRight,
  Stethoscope,
  RotateCcw,
  Trash2,
  AlertCircle,
  Pin,
  PinOff,
} from 'lucide-react';
import {
  CONDITION_REGISTRY,
  ALL_CATEGORIES,
  CATEGORY_LABEL,
  type ConditionCategory,
  type ConditionRegistryEntry,
  getConditionBySlug,
} from '@/lib/conditionRegistry';
import { useConditionPins } from '@/lib/useConditionPins';
import { toast } from 'sonner';

const RECENT_KEY = 'chemistcare:recent_consult_slugs';
const DRAFT_KEY = 'chemistcare_consultation_draft';
const RECENT_LIMIT = 5;

/** Track the last few condition slugs the pharmacist started a consult for. */
export function recordRecentCondition(slug: string) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [slug, ...list.filter(s => s !== slug)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

function loadRecentSlugs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

interface LegacyDraftInfo {
  hasDraft: boolean;
  conditionSlug?: string;
  conditionName?: string;
}

function inspectDraft(): LegacyDraftInfo {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return { hasDraft: false };
    const parsed = JSON.parse(raw);
    const conditionId = parsed?.selectedCondition;
    if (conditionId) {
      const entry = CONDITION_REGISTRY.find(e => e.id === conditionId);
      if (entry) return { hasDraft: true, conditionSlug: entry.slug, conditionName: entry.name };
    }
    return { hasDraft: true };
  } catch {
    return { hasDraft: false };
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

const CATEGORY_BADGE: Record<ConditionCategory, string> = {
  acute: 'clinical-badge-danger',
  chronic: 'clinical-badge-info',
  preventive: 'clinical-badge-safe',
  resupply: 'clinical-badge-warning',
  travel: 'clinical-badge-info',
};

function ConditionCard({
  entry,
  onStart,
  pinned,
  onTogglePin,
}: {
  entry: ConditionRegistryEntry;
  onStart: (slug: string) => void;
  pinned: boolean;
  onTogglePin: (entry: ConditionRegistryEntry) => void;
}) {
  const disabled = !entry.enabled;
  return (
    <Card className={`transition-shadow ${disabled ? 'opacity-60' : 'hover:shadow-md'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate">{entry.name}</h3>
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{entry.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(entry);
              }}
              aria-label={pinned ? `Unpin ${entry.name} from sidebar` : `Pin ${entry.name} to sidebar`}
              title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
              className={`p-1 rounded transition-colors ${
                pinned
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground/50 hover:text-primary hover:bg-muted'
              }`}
            >
              {pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
            </button>
            <span className={`clinical-badge ${CATEGORY_BADGE[entry.category]}`}>
              {CATEGORY_LABEL[entry.category]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-clinical-danger" />
            {entry.redFlagCount} red flag{entry.redFlagCount === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1">
            <Pill className="h-3 w-3 text-accent" />
            {entry.treatmentOptionCount} treatment{entry.treatmentOptionCount === 1 ? '' : 's'}
          </span>
        </div>

        {disabled ? (
          <div className="flex items-center gap-2 text-[11px] text-clinical-warning">
            <AlertCircle className="h-3 w-3" /> Template not yet available
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => onStart(entry.slug)}
          >
            Start consultation <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

const ConsultationPicker = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ConditionCategory | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [draft, setDraft] = useState<LegacyDraftInfo>({ hasDraft: false });
  const { isPinned, setPinned } = useConditionPins();
  const errorMessage = searchParams.get('error');

  const handleTogglePin = (entry: ConditionRegistryEntry) => {
    const willPin = !isPinned(entry.id);
    setPinned(entry.id, willPin);
    toast.success(willPin ? `Pinned ${entry.name} to sidebar` : `Unpinned ${entry.name}`, {
      action: {
        label: 'Undo',
        onClick: () => setPinned(entry.id, !willPin),
      },
    });
  };

  useEffect(() => {
    setRecent(loadRecentSlugs());
    setDraft(inspectDraft());
  }, []);

  const recentEntries = useMemo(
    () =>
      recent
        .map(slug => getConditionBySlug(slug))
        .filter((e): e is ConditionRegistryEntry => !!e)
        .slice(0, RECENT_LIMIT),
    [recent],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CONDITION_REGISTRY.filter(e => {
      const matchesCategory = !activeCategory || e.category === activeCategory;
      const matchesSearch =
        !q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  const startConsultation = (slug: string) => {
    recordRecentCondition(slug);
    navigate(`/consultations/new/${slug}`);
  };

  const resumeDraft = () => {
    if (draft.conditionSlug) {
      navigate(`/consultations/new/${draft.conditionSlug}?resume=1`);
    }
  };

  const discardLegacyDraft = () => {
    clearDraft();
    setDraft({ hasDraft: false });
  };

  return (
    <ClinicalLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Stethoscope className="h-6 w-6 text-accent shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">New Consultation</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Choose the condition or protocol you are consulting on. The workflow, red flags, scope checks, and
              treatment options are tailored to the selected pathway.
            </p>
          </div>
        </div>

        {/* Slug error from invalid URL */}
        {errorMessage && (
          <Card className="border-clinical-danger/50 bg-clinical-danger-bg/40">
            <CardContent className="p-3 flex items-center gap-2 text-xs text-clinical-danger">
              <AlertCircle className="h-4 w-4" /> {errorMessage}
            </CardContent>
          </Card>
        )}

        {/* Resume draft */}
        {draft.hasDraft && (
          <Card className="border-accent/40 bg-accent/5">
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <RotateCcw className="h-4 w-4 text-accent" />
                {draft.conditionSlug ? (
                  <span>
                    Unsaved draft for <span className="font-semibold">{draft.conditionName}</span>.
                  </span>
                ) : (
                  <span>
                    A legacy draft exists without a condition. Pick a condition below to continue, or discard it.
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={discardLegacyDraft}>
                  <Trash2 className="h-3.5 w-3.5" /> Discard
                </Button>
                {draft.conditionSlug && (
                  <Button size="sm" className="gap-1.5" onClick={resumeDraft}>
                    <RotateCcw className="h-3.5 w-3.5" /> Resume Draft
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conditions, protocols, or symptoms…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeCategory === null ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              All
            </button>
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Recently used */}
        {recentEntries.length > 0 && !search && !activeCategory && (
          <div className="space-y-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Recently used
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentEntries.map(e => (
                <ConditionCard key={`recent-${e.id}`} entry={e} onStart={startConsultation} />
              ))}
            </div>
          </div>
        )}

        {/* Full grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {activeCategory ? `${CATEGORY_LABEL[activeCategory]} consultations` : 'All consultation types'}
            </p>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {filtered.length} of {CONDITION_REGISTRY.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No consultations match your search.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(e => (
                <ConditionCard key={e.id} entry={e} onStart={startConsultation} />
              ))}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          Protocols are aligned to the Therapeutic Guidelines, AMH and Victorian Community Pharmacist Prescriber
          framework. Always exercise clinical judgement and consult current guidelines before prescribing.
        </p>
      </div>
    </ClinicalLayout>
  );
};

export default ConsultationPicker;

// Convenience for other modules.
export { recordRecentCondition as recordRecent };
