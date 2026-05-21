import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox } from 'lucide-react';

type Outcome = 'Active' | 'Completed' | 'Referred' | 'Awaiting follow-up';

interface Episode {
  id: string;
  patient: string;
  type: string; // UTI, GORD, etc.
  initiation: string; // ISO date
  clinician: string;
  outcome: Outcome;
}

const MOCK: Episode[] = [
  { id: 'e1', patient: 'Sarah Chen', type: 'UTI', initiation: '2026-05-21', clinician: 'P. Nguyen', outcome: 'Completed' },
  { id: 'e2', patient: 'James Patel', type: 'Smoking cessation', initiation: '2026-05-18', clinician: 'P. Nguyen', outcome: 'Active' },
  { id: 'e3', patient: 'Maya Singh', type: 'Shingles', initiation: '2026-05-17', clinician: 'A. Roberts', outcome: 'Referred' },
  { id: 'e4', patient: "Emily O'Brien", type: 'OCP resupply', initiation: '2026-05-15', clinician: 'P. Nguyen', outcome: 'Completed' },
  { id: 'e5', patient: 'David Kowalski', type: 'GORD', initiation: '2026-05-14', clinician: 'A. Roberts', outcome: 'Awaiting follow-up' },
  { id: 'e6', patient: 'Riya Lim', type: 'Travel medicine', initiation: '2026-05-12', clinician: 'P. Nguyen', outcome: 'Active' },
];

const OUTCOME_TONE: Record<Outcome, string> = {
  Active: 'bg-clinical-info-bg text-clinical-info',
  Completed: 'bg-clinical-safe-bg text-clinical-safe',
  Referred: 'bg-clinical-danger-bg text-clinical-danger',
  'Awaiting follow-up': 'bg-clinical-warning-bg text-clinical-warning',
};

const Episodes = () => {
  const [loading, setLoading] = useState(true);
  const [episodes] = useState<Episode[]>(MOCK);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <ClinicalLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Care Episodes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every active and completed prescribing episode, with initiating clinician and outcome status.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1fr] gap-4 border-b px-4 py-2.5 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
              <div>Patient</div>
              <div>Episode type</div>
              <div>Initiated</div>
              <div>Clinician</div>
              <div>Outcome</div>
            </div>

            {loading ? (
              <div className="divide-y">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1fr] gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : episodes.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center gap-3 text-center">
                <Inbox className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm">No care episodes recorded yet.</p>
              </div>
            ) : (
              <motion.div
                className="divide-y"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.02 } } }}
              >
                {episodes.map((e, idx) => (
                  <motion.div
                    key={e.id}
                    variants={{
                      hidden: { opacity: 0, y: 4 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
                    }}
                    className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1fr] gap-4 px-4 py-3 text-sm hover:bg-muted/40"
                  >
                    <div className="font-medium">{e.patient}</div>
                    <div>{e.type}</div>
                    <div className="tabular-nums text-muted-foreground">{e.initiation}</div>
                    <div>{e.clinician}</div>
                    <div>
                      <span className={`inline-flex text-[0.6875rem] font-medium px-2 py-0.5 rounded-full ${OUTCOME_TONE[e.outcome]}`}>
                        {e.outcome}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClinicalLayout>
  );
};

export default Episodes;
