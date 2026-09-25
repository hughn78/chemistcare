import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CONDITIONS } from '@/data/conditions';
import { getRegistryEntryById } from '@/lib/conditionRegistry';
import { CORPUS_AS_AT, CORPUS_DOCUMENTS } from '@/data/protocol-corpus';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Search, AlertTriangle, ChevronRight } from 'lucide-react';

const classificationColors: Record<string, string> = {
  acute: 'clinical-badge-danger',
  chronic: 'clinical-badge-info',
  preventive: 'clinical-badge-safe',
  resupply: 'clinical-badge-warning',
};

const ConditionsLibrary = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const filtered = CONDITIONS.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filter || c.classification === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <ClinicalLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Conditions Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            22 supported conditions · jurisdiction coverage derived from {CORPUS_DOCUMENTS.length} corpus instruments (as at {CORPUS_AS_AT})
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conditions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {['acute', 'chronic', 'preventive', 'resupply'].map(c => (
              <button
                key={c}
                onClick={() => setFilter(filter === c ? null : c)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  filter === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((condition) => (
            <Card
              key={condition.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/conditions/${condition.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold truncate">{condition.name}</h3>
                      <span className={`clinical-badge ${classificationColors[condition.classification]}`}>
                        {condition.classification}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{condition.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {condition.redFlags.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-clinical-danger font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {condition.redFlags.length} red flag{condition.redFlags.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {condition.therapyOptions.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {condition.therapyOptions.length} therapy option{condition.therapyOptions.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <CoverageChips conditionId={condition.id} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ClinicalLayout>
  );
};

/** Corpus-derived jurisdiction coverage chips for one condition card. */
function CoverageChips({ conditionId }: { conditionId: string }) {
  const entry = getRegistryEntryById(conditionId);
  if (!entry || entry.jurisdictionAvailability.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-2" title={`Corpus instruments (as at ${CORPUS_AS_AT})`}>
      {entry.jurisdictionAvailability.map(st => (
        <span key={st} className="clinical-badge clinical-badge-info text-[9px] px-1.5 py-0">
          {st}
        </span>
      ))}
    </div>
  );
}

export default ConditionsLibrary;
