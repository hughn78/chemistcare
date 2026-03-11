/**
 * PatientEducationPanel — Displays patient education links from MedlinePlus.
 * Used in consult completion and patient summary views.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, BookOpen, Search, AlertTriangle, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  getPatientEducationLinks,
  searchMedlineTopics,
  type PatientEducationLink,
  type MedlineTopicResult,
} from '@/lib/clinicalApiService';

interface PatientEducationPanelProps {
  diagnosisCode?: string;
  diagnosisName?: string;
  medicationName?: string;
  className?: string;
}

export function PatientEducationPanel({
  diagnosisCode,
  diagnosisName,
  medicationName,
  className = '',
}: PatientEducationPanelProps) {
  const [links, setLinks] = useState<PatientEducationLink[]>([]);
  const [topics, setTopics] = useState<MedlineTopicResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);

  // Auto-fetch education links when code/name changes
  useEffect(() => {
    const fetchLinks = async () => {
      if (!diagnosisCode && !diagnosisName && !medicationName) return;
      setLoading(true);
      try {
        const results: PatientEducationLink[] = [];

        if (diagnosisCode) {
          const coded = await getPatientEducationLinks(diagnosisCode);
          results.push(...coded);
        }

        // If no coded results or also have medication, search by name
        if ((results.length === 0 && diagnosisName) || medicationName) {
          const searchTerm = medicationName || diagnosisName || '';
          const topicResults = await searchMedlineTopics(searchTerm);
          setTopics(topicResults);
        }

        setLinks(results);
      } catch {
        // Silent fail — education is supplementary
      } finally {
        setLoading(false);
      }
    };
    fetchLinks();
  }, [diagnosisCode, diagnosisName, medicationName]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const results = await searchMedlineTopics(searchQuery);
      setTopics(results);
    } catch {
      toast.error('Search unavailable');
    } finally {
      setSearchLoading(false);
    }
  };

  const copyLink = (url: string, idx: number) => {
    navigator.clipboard.writeText(url);
    setCopied(idx);
    toast.success('Link copied');
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleReviewed = (idx: number) => {
    setReviewed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const allItems = [
    ...links.map(l => ({ title: l.title, summary: l.summary, url: l.url, source: l.source })),
    ...topics.map(t => ({ title: t.title, summary: t.snippet, url: t.url, source: 'MedlinePlus' })),
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Patient Education
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-mono">MedlinePlus</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Manual search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search health topics…"
              className="pl-8 text-sm h-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleSearch} disabled={searchLoading} className="h-8">
            Search
          </Button>
        </div>

        {/* Loading */}
        {(loading || searchLoading) && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {/* Results */}
        {!loading && !searchLoading && allItems.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 opacity-50" />
            No education materials found. Try searching above.
          </div>
        )}

        {allItems.map((item, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded border bg-muted/20">
            <Checkbox
              checked={reviewed.has(i)}
              onCheckedChange={() => toggleReviewed(i)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
              >
                {item.title}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              {item.summary && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.summary}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 shrink-0"
              onClick={() => copyLink(item.url, i)}
            >
              {copied === i ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        ))}

        {allItems.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Source: MedlinePlus (U.S. NLM). Review before sharing with patients. Not a substitute for professional advice.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
