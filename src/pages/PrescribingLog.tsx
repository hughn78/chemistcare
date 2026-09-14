import { useState, useEffect } from 'react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { appendAudit } from '@/lib/auditStore';
import { FileText, RefreshCw, Trash2, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ConsultRecord {
  id: string;
  status: string;
  patient_first_name: string | null;
  patient_last_name: string | null;
  condition_name: string | null;
  working_diagnosis: string | null;
  finalised_at: string | null;
  created_at: string;
  red_flag_triggered: boolean;
}

const PrescribingLog = () => {
  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ConsultRecord | null>(null);
  const navigate = useNavigate();

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('consultations') as any)
      .select('id, status, patient_first_name, patient_last_name, condition_name, working_diagnosis, finalised_at, created_at, red_flag_triggered')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setRecords(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleDelete = async (record: ConsultRecord) => {
    try {
      const { error } = await (supabase.from('consultations') as any)
        .delete()
        .eq('id', record.id);

      if (error) throw error;

      // Audit trail (local). A failed write must be reported, not assumed.
      const audit = appendAudit({
        consultId: record.id,
        action: 'consult_deleted',
        details: {
          patientInitials: `${(record.patient_first_name || '?')[0]}${(record.patient_last_name || '?')[0]}`,
          condition: record.condition_name,
          status: record.status,
        },
      });

      setRecords(prev => prev.filter(r => r.id !== record.id));
      if (audit.status === 'persisted') {
        toast.success('Consultation record deleted', { position: 'bottom-right' });
      } else {
        toast.warning('Record deleted, but the audit entry was not saved', {
          description: audit.error,
          position: 'bottom-right',
        });
      }
    } catch (err: any) {
      toast.error('Failed to delete record', { description: err?.message });
    }
    setDeleteTarget(null);
  };

  const handleArchive = async (record: ConsultRecord) => {
    try {
      const { error } = await (supabase.from('consultations') as any)
        .update({ status: 'archived' })
        .eq('id', record.id);

      if (error) throw error;

      const audit = appendAudit({
        consultId: record.id,
        action: 'consult_archived',
        details: {
          patientInitials: `${(record.patient_first_name || '?')[0]}${(record.patient_last_name || '?')[0]}`,
          previousStatus: record.status,
        },
      });

      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'archived' } : r));
      if (audit.status === 'persisted') {
        toast.success('Consultation archived', { position: 'bottom-right' });
      } else {
        toast.warning('Consultation archived, but the audit entry was not saved', {
          description: audit.error,
          position: 'bottom-right',
        });
      }
    } catch (err: any) {
      toast.error('Failed to archive record', { description: err?.message });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'finalised': return 'default';
      case 'archived': return 'outline';
      case 'draft': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <ClinicalLayout>
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Prescribing Log</h1>
            <p className="text-sm text-muted-foreground mt-1">Complete audit trail of all prescribing decisions</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRecords} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No prescribing records yet. Complete a consultation to generate entries.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/consultations/new')}>
                Start Consultation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <Card key={r.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {r.patient_first_name || ''} {r.patient_last_name || 'Unknown Patient'}
                        </span>
                        <Badge variant={statusColor(r.status) as any} className="text-[10px]">
                          {r.status}
                        </Badge>
                        {r.red_flag_triggered && (
                          <Badge variant="destructive" className="text-[10px]">Red Flag</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.condition_name || 'No condition'} · {r.working_diagnosis || 'No diagnosis'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        ID: {r.id.slice(0, 8)}… · {r.finalised_at
                          ? new Date(r.finalised_at).toLocaleString('en-AU')
                          : new Date(r.created_at).toLocaleString('en-AU')
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.status !== 'archived' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Archive"
                          onClick={() => handleArchive(r)}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-clinical-danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete consultation record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the consultation for{' '}
              <strong>{deleteTarget?.patient_first_name} {deleteTarget?.patient_last_name}</strong>.
              This action cannot be undone. An audit entry will be recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClinicalLayout>
  );
};

export default PrescribingLog;
