/**
 * ClinicalAutocomplete — Reusable debounced autocomplete for conditions, medications, or codes.
 * Uses NIH Clinical Table Search Service via server-side proxy.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, AlertTriangle, ExternalLink } from 'lucide-react';
import { searchClinicalTerms, type ClinicalSearchResult } from '@/lib/clinicalApiService';

interface ClinicalAutocompleteProps {
  type: 'conditions' | 'medications' | 'codes';
  placeholder?: string;
  value?: string;
  onSelect?: (result: ClinicalSearchResult) => void;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function ClinicalAutocomplete({
  type,
  placeholder,
  value: controlledValue,
  onSelect,
  onChange,
  className = '',
  disabled = false,
}: ClinicalAutocompleteProps) {
  const [query, setQuery] = useState(controlledValue || '');
  const [results, setResults] = useState<ClinicalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync controlled value
  useEffect(() => {
    if (controlledValue !== undefined) setQuery(controlledValue);
  }, [controlledValue]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await searchClinicalTerms(term, type);
      setResults(data.results || []);
      setOpen(true);
      if (data.error) setError(data.error);
    } catch (e) {
      setError('Search unavailable');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  const handleChange = (val: string) => {
    setQuery(val);
    onChange?.(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const handleSelect = (result: ClinicalSearchResult) => {
    setQuery(result.label);
    onChange?.(result.label);
    onSelect?.(result);
    setOpen(false);
  };

  const labels: Record<string, string> = {
    conditions: 'Condition',
    medications: 'Medication',
    codes: 'Code',
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder || `Search ${labels[type] || type}…`}
          className="pl-8 pr-3 text-sm"
          disabled={disabled}
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && (results.length > 0 || error) && (
        <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {error && (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              {error}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.code}-${i}`}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center justify-between gap-2 border-b last:border-0 border-border/50"
            >
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium text-foreground">{r.label}</span>
                {r.synonyms?.length > 0 && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {r.synonyms.slice(0, 2).join(', ')}
                  </span>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                {r.code}
              </Badge>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t bg-muted/30">
            Source: NIH Clinical Tables · {labels[type]} search
          </div>
        </div>
      )}
    </div>
  );
}
