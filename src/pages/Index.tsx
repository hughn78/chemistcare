import { useState, useEffect } from 'react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  Users,
  ClipboardList,
  AlertTriangle,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  Calculator,
  Mic,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';

const DRAFT_KEY = 'chemistcare_consultation_draft';

const Dashboard = () => {
  const navigate = useNavigate();
  const [hasDraft, setHasDraft] = useState(false);
  const [showDraftMenu, setShowDraftMenu] = useState(false);

  useEffect(() => {
    try {
      setHasDraft(localStorage.getItem(DRAFT_KEY) !== null);
    } catch {
      setHasDraft(false);
    }
  }, []);

  const handleStartNew = () => {
    // Clear any existing draft to ensure fresh state, then route to the
    // condition picker — the new entry point for every consultation.
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    navigate('/consultations/new');
  };

  const handleResumeDraft = () => {
    // The picker inspects the saved draft and offers a typed resume into the
    // correct condition pathway (or prompts for a condition if legacy).
    navigate('/consultations/new');
    setShowDraftMenu(false);
  };

  return (
    <ClinicalLayout>
      <div className="p-3 sm:p-5 space-y-4 sm:space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl">Clinical Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              ChemistCare Prescriber<span className="text-accent">OS</span> — Pharmacist Prescriber Workspace
            </p>
          </div>
          
          {/* Split-button: Start New vs Resume Draft */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button onClick={handleStartNew} className="gap-2 flex-1 sm:flex-initial">
              <FilePlus className="h-4 w-4" />
              Start New Consult
            </Button>
            {hasDraft && (
              <Button variant="outline" onClick={handleResumeDraft} className="gap-2 flex-1 sm:flex-initial border-accent/30 text-accent hover:bg-accent/5">
                <RotateCcw className="h-4 w-4" />
                Resume Draft
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Today's Consults", value: '0', icon: Activity, color: 'text-accent' },
            { label: 'Active Patients', value: '0', icon: Users, color: 'text-clinical-safe' },
            { label: 'Pending Follow-ups', value: '0', icon: Clock, color: 'text-clinical-warning' },
            { label: 'Scripts This Month', value: '0', icon: ClipboardList, color: 'text-foreground' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-3 pb-2.5 px-3 sm:pt-4 sm:pb-3 sm:px-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[0.625rem] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 truncate">{stat.label}</p>
                    <p className="text-xl sm:text-[1.75rem] font-semibold tabular-nums leading-none">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-5 w-5 sm:h-7 sm:w-7 ${stat.color} opacity-20 shrink-0`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Quick actions */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Start New Consultation', desc: 'Begin structured clinical assessment', icon: FilePlus, action: handleStartNew },
                { label: 'View Conditions Library', desc: 'Browse 22 supported conditions', icon: TrendingUp, action: () => navigate('/conditions') },
                { label: 'Patient Records', desc: 'Search and manage patient profiles', icon: Users, action: () => navigate('/patients') },
                { label: 'Clinical Calculators', desc: 'CrCl, eGFR, Framingham & more', icon: Calculator, action: () => navigate('/calculators'), accent: true },
                { label: 'Clinical Scribe', desc: 'Record & transcribe consultations in real-time', icon: Mic, action: () => navigate('/scribe') },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className={`w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-md border transition-colors text-left ${
                    a.accent
                      ? 'border-accent/30 hover:bg-accent/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md ${
                    a.accent ? 'bg-accent/15' : 'bg-accent/10'
                  }`}>
                    <a.icon className={`h-4 w-4 ${a.accent ? 'text-accent' : 'text-accent'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${a.accent ? 'text-accent' : ''}`}>{a.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Safety reminders */}
          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <AlertTriangle className="h-4 w-4 text-clinical-warning" />
                Safety Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                'Complete all assessment steps before prescribing',
                'Red flags always require referral documentation',
                'Verify PBS eligibility before script generation',
                'Document differential diagnoses for every encounter',
                'Check pregnancy status for all female patients',
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-clinical-safe mt-0.5 shrink-0" />
                  <p className="text-xs sm:text-[0.8125rem] text-muted-foreground leading-snug">{r}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Supported conditions summary */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Supported Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {[
                { label: 'Acute', count: 7 },
                { label: 'Chronic', count: 10 },
                { label: 'Preventive', count: 3 },
                { label: 'Resupply', count: 1 },
              ].map((cat) => (
                <Badge key={cat.label} variant="secondary" className="gap-1.5 text-xs">
                  {cat.label}
                  <span className="text-accent font-semibold tabular-nums">{cat.count}</span>
                </Badge>
              ))}
              <Badge variant="outline" className="sm:ml-2 text-xs">22 Total Conditions</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClinicalLayout>
  );
};

export default Dashboard;
