import { useMemo } from 'react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useCountUp } from '@/hooks/useCountUp';
import {
  FilePlus,
  Users,
  ClipboardList,
  Activity,
  Clock,
  Calculator,
  Mic,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

type EventType = 'complete' | 'awaiting' | 'alert';

const ACCENT_BY_TYPE: Record<EventType, string> = {
  complete: 'border-l-clinical-safe',
  awaiting: 'border-l-clinical-warning',
  alert: 'border-l-clinical-danger',
};

interface StatDef {
  label: string;
  value: number;
  delta: number; // % vs avg
  spark: number[];
}

const STATS: StatDef[] = [
  { label: "Today's consultations", value: 14, delta: 12, spark: [6, 9, 7, 11, 8, 12, 14] },
  { label: 'Active patients', value: 312, delta: 4, spark: [280, 285, 290, 295, 300, 308, 312] },
  { label: 'Pending follow-ups', value: 7, delta: -18, spark: [12, 11, 10, 9, 9, 8, 7] },
  { label: 'Scripts this month', value: 186, delta: 9, spark: [120, 134, 145, 158, 170, 178, 186] },
];

interface TimelineItem {
  time: string;
  type: EventType;
  text: string;
}

const TIMELINE: TimelineItem[] = [
  { time: '09:14', type: 'complete', text: 'UTI protocol completed for Sarah Chen (Rx sent to MediSecure).' },
  { time: '09:02', type: 'awaiting', text: 'Smoking cessation review awaiting GP correspondence for J. Patel.' },
  { time: '08:47', type: 'alert', text: 'Red-flag escalation flagged on shingles assessment for M. Singh — referred to GP.' },
  { time: '08:31', type: 'complete', text: 'OCP resupply issued for E. O\u2019Brien (12-month supply).' },
  { time: '08:12', type: 'complete', text: 'GORD initial consult completed for D. Kowalski.' },
  { time: '07:58', type: 'awaiting', text: 'Travel medicine pre-consult submitted by R. Lim awaiting screening.' },
];

function StatCard({ stat }: { stat: StatDef }) {
  const v = useCountUp(stat.value, 900);
  const positive = stat.delta >= 0;
  const data = useMemo(() => stat.spark.map((y, i) => ({ i, y })), [stat.spark]);

  return (
    <Card>
      <CardContent className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <p className="text-3xl font-semibold tabular-nums leading-tight mt-1.5">{v}</p>
            <div className={`flex items-center gap-1 text-[0.6875rem] mt-1 tabular-nums ${positive ? 'text-clinical-safe' : 'text-clinical-danger'}`}>
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              <span>{positive ? '+' : ''}{stat.delta}% vs avg</span>
            </div>
          </div>
          <div className="h-10 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line
                  type="monotone"
                  dataKey="y"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  const actions = [
    { label: 'Start new consultation', icon: FilePlus, action: () => navigate('/consultations/new') },
    { label: 'Open patient registry', icon: Users, action: () => navigate('/patients') },
    { label: 'Browse conditions library', icon: TrendingUp, action: () => navigate('/conditions') },
    { label: 'Open clinical calculators', icon: Calculator, action: () => navigate('/calculators') },
    { label: 'Open clinical scribe', icon: Mic, action: () => navigate('/scribe') },
    { label: 'Review prescribing log', icon: ClipboardList, action: () => navigate('/prescribing-log') },
  ];

  return (
    <ClinicalLayout>
      <div className="p-5 space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-1 border-b">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Prescriber command centre</h1>
            <p className="text-sm text-muted-foreground mt-1 tabular-nums">{today}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium self-start lg:self-auto">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clinical-safe opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-clinical-safe" />
            </span>
            <span className="text-muted-foreground">Practice:</span>
            <span>ChemistCare Demo</span>
            <span className="text-muted-foreground">•</span>
            <span>All systems operational</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>

        {/* Two-column: activity feed + clinical actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Activity feed */}
          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Activity feed</h2>
                </div>
                <span className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">Today</span>
              </div>
              <ol className="divide-y">
                {TIMELINE.map((item, i) => (
                  <li
                    key={i}
                    className={`flex gap-3 px-4 py-3 border-l-2 ${ACCENT_BY_TYPE[item.type]}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground tabular-nums pt-0.5 shrink-0">
                      {item.time}
                    </span>
                    <p className="text-sm leading-snug">{item.text}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Clinical actions */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Clinical actions</h2>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.action}
                    className="flex flex-col items-start gap-2 bg-card px-3 py-3.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <a.icon className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium leading-snug">{a.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Primary CTA — kept compact */}
        <div className="flex justify-end">
          <Button onClick={() => navigate('/consultations/new')} className="gap-2">
            <FilePlus className="h-4 w-4" />
            Start new consultation
          </Button>
        </div>
      </div>
    </ClinicalLayout>
  );
};

export default Dashboard;
