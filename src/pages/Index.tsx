import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  Users,
  ClipboardList,
  Clock,
  Activity,
  TrendingUp,
  Calculator,
  Mic,
  RotateCcw,
  Zap,
  Shield,
  Sparkles,
} from 'lucide-react';
import { isDemoMode, getDemoMetrics, seedDemoData, type DemoMetrics } from '@/lib/demoData';

const DRAFT_KEY = 'chemistcare_consultation_draft';

const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [hasDraft, setHasDraft] = useState(false);
  const [metrics, setMetrics] = useState<DemoMetrics | null>(null);
  const [showDemoBanner, setShowDemoBanner] = useState(false);

  useEffect(() => {
    try {
      setHasDraft(localStorage.getItem(DRAFT_KEY) !== null);
    } catch {
      setHasDraft(false);
    }
    setMetrics(getDemoMetrics());
    setShowDemoBanner(!isDemoMode());
  }, []);

  const handleStartNew = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    navigate('/consultations/new');
  };

  const handleResumeDraft = () => {
    navigate('/consultations/new');
  };

  const handleLaunchDemo = () => {
    seedDemoData();
    setMetrics(getDemoMetrics());
    setShowDemoBanner(false);
    window.location.reload();
  };

  const todayConsults = metrics?.todayConsults ?? 0;
  const activePatients = metrics?.activePatients ?? 0;
  const pendingFollowups = metrics?.pendingFollowups ?? 0;
  const scriptsThisMonth = metrics?.scriptsThisMonth ?? 0;
  const trendUp = metrics?.trendUp ?? 0;

  return (
    <ClinicalLayout>
      <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
        {/* Demo mode banner */}
        {showDemoBanner && (
          <motion.div
            {...fadeInUp}
            className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Investor Demo Mode</p>
                <p className="text-xs text-muted-foreground">
                  Click below to populate the platform with realistic sample data and see ChemistCare in action.
                </p>
              </div>
            </div>
            <Button onClick={handleLaunchDemo} className="shrink-0">
              <Zap className="h-4 w-4 mr-2" />
              Launch Demo Data
            </Button>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          {...fadeInUp}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Prescriber Command Centre</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              AI-assisted clinical intelligence for pharmacist-prescribers
            </p>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button onClick={handleStartNew} className="gap-2 flex-1 sm:flex-initial">
              <FilePlus className="h-4 w-4" />
              New Episode
            </Button>
            {hasDraft && (
              <Button
                variant="outline"
                onClick={handleResumeDraft}
                className="gap-2 flex-1 sm:flex-initial border-accent/30 text-accent hover:bg-accent/5"
              >
                <RotateCcw className="h-4 w-4" />
                Resume Draft
              </Button>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"
        >
          {[
            { label: "Today's Episodes", value: todayConsults, suffix: '', icon: Activity, color: 'text-accent', sparkLineColor: '#2dd4bf' },
            { label: 'Active Patients', value: activePatients, suffix: '', icon: Users, color: 'text-emerald-500', sparkLineColor: '#10b981' },
            { label: 'Pending Follow-ups', value: pendingFollowups, suffix: '', icon: Clock, color: 'text-amber-500', sparkLineColor: '#f59e0b' },
            { label: 'Scripts This Month', value: scriptsThisMonth, suffix: '', icon: ClipboardList, color: 'text-foreground', sparkLineColor: '#94a3b8' },
          ].map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp}>
              <Card className="h-full">
                <CardContent className="pt-3 pb-2.5 px-3 sm:pt-4 sm:pb-3 sm:px-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[0.625rem] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 truncate">
                        {stat.label}
                      </p>
                      <p className="text-xl sm:text-[1.75rem] font-semibold tabular-nums leading-none">
                        {stat.value}
                      </p>
                      {stat.label === "Scripts This Month" && trendUp > 0 && (
                        <p className="text-[0.625rem] text-emerald-500 mt-1 font-medium">
                          +{trendUp}% vs last month
                        </p>
                      )}
                    </div>
                    <stat.icon className={`h-5 w-5 sm:h-7 sm:w-7 ${stat.color} opacity-20 shrink-0`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* AI Copilot Widget */}
        <motion.div {...fadeInUp}>
          <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                    <Shield className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">AI Clinical Copilot — Active</p>
                    <p className="text-xs text-muted-foreground">
                      3 safety guardrails passed. PBS eligibility verified. Auto-documentation running.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[0.65rem]">
                    <Zap className="h-3 w-3 mr-1" />
                    Live Transcription
                  </Badge>
                  <Badge variant="outline" className="text-[0.65rem] border-accent/30 text-accent">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Notes: ON
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Quick actions */}
          <motion.div {...fadeInUp} className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-sm sm:text-base">Clinical Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'New Clinical Episode', desc: 'Begin structured prescribing protocol', icon: FilePlus, action: handleStartNew },
                  { label: 'Protocol Library', desc: 'Browse 22 evidence-based pathways', icon: TrendingUp, action: () => navigate('/conditions') },
                  { label: 'Patient Registry', desc: 'Search and manage patient profiles', icon: Users, action: () => navigate('/patients') },
                  { label: 'Dose Intelligence', desc: 'CrCl, eGFR, Framingham & more', icon: Calculator, action: () => navigate('/calculators'), accent: true },
                  { label: 'Clinical Scribe', desc: 'Real-time AI transcription & note generation', icon: Mic, action: () => navigate('/scribe') },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={a.action}
                    className={`w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-md border transition-all duration-200 hover:translate-x-0.5 text-left ${
                      a.accent
                        ? 'border-accent/30 hover:bg-accent/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md ${
                        a.accent ? 'bg-accent/15' : 'bg-accent/10'
                      }`}
                    >
                      <a.icon className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Safety & compliance */}
          <motion.div {...fadeInUp}>
            <Card>
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Shield className="h-4 w-4 text-accent" />
                  Compliance Guardrails
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  'AI-powered safety checks active on every episode',
                  'Red flag detection monitors 140+ severity criteria',
                  'PBS eligibility pre-verified before script generation',
                  'Audit trail auto-generated with differential diagnoses',
                  'AHPRA-aligned documentation standards enforced',
                ].map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <div className="h-3.5 w-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-[0.8125rem] text-muted-foreground leading-snug">{r}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Supported conditions summary */}
        <motion.div {...fadeInUp}>
          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Clinical Protocol Library</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {[
                  { label: 'Acute Pathways', count: 7 },
                  { label: 'Chronic Management', count: 10 },
                  { label: 'Preventive Care', count: 3 },
                  { label: 'Resupply', count: 1 },
                ].map((cat) => (
                  <Badge key={cat.label} variant="secondary" className="gap-1.5 text-xs">
                    {cat.label}
                    <span className="text-accent font-semibold tabular-nums">{cat.count}</span>
                  </Badge>
                ))}
                <Badge variant="outline" className="sm:ml-2 text-xs text-muted-foreground">
                  22 Protocols · 8CPA-Ready · PBS-Integrated
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ClinicalLayout>
  );
};

export default Dashboard;
