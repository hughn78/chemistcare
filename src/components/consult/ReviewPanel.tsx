import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Condition } from '@/types/clinical';
import { ConsultStatus } from '@/lib/consultStateMachine';
import {
  CheckCircle, FileText, Send, Loader2, AlertTriangle, Download,
  Trash2, Copy, XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReviewPanelProps {
  formData: Record<string, string>;
  condition?: Condition;
  differentials: { diagnosis: string; reasonExcluded: string }[];
  hasRedFlagTriggered: boolean;
  consultStatus: ConsultStatus;
  consultId?: string;
  finalisedAt?: string;
  onFinalise: () => Promise<{ success: boolean; consultId?: string; error?: string }>;
  onDiscard: () => void;
  pinnedEvidence: { question: string; answer: string; sources: string[] }[];
}

export function ReviewPanel({
  formData, condition, differentials, hasRedFlagTriggered,
  consultStatus, consultId, finalisedAt, onFinalise, onDiscard, pinnedEvidence,
}: ReviewPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const { toast } = useToast();

  const fullNote = generateFullNote(formData, condition, differentials, hasRedFlagTriggered, pinnedEvidence);
  const gpLetter = generateGpLetter(formData, condition, differentials);
  const patientSummary = generatePatientSummary(formData, condition);

  const handleFinalise = async () => {
    setIsSubmitting(true);
    const result = await onFinalise();
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: '✅ Consultation Finalised',
        description: `Consult ID: ${result.consultId}`,
      });
    } else {
      toast({
        title: '❌ Finalisation Failed',
        description: result.error || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  const handleDiscard = () => {
    onDiscard();
    setShowDiscardConfirm(false);
    toast({ title: 'Draft discarded', description: 'All consultation data has been cleared.' });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  if (consultStatus === 'finalised') {
    return (
      <div className="space-y-4">
        <Card className="border-clinical-safe">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-clinical-safe flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-lg">Consultation Finalised</p>
                <p className="text-xs text-muted-foreground">
                  ID: <span className="font-mono">{consultId}</span>
                  {finalisedAt && <> · {new Date(finalisedAt).toLocaleString('en-AU')}</>}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/prescribing-log">View Prescribing Log</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/patients">View Patient</a>
              </Button>
              <Button size="sm" asChild>
                <a href="/consultations/new">New Consultation</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <ReviewTabs
          fullNote={fullNote}
          gpLetter={gpLetter}
          patientSummary={patientSummary}
          onCopy={copyToClipboard}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Review & Finalise</h2>
        <Badge variant="outline" className="gap-1">
          {consultStatus === 'submitting' ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Submitting...</>
          ) : consultStatus === 'validated' ? (
            <><CheckCircle className="h-3 w-3 text-clinical-safe" /> Ready</>
          ) : (
            <><AlertTriangle className="h-3 w-3 text-clinical-warning" /> Draft</>
          )}
        </Badge>
      </div>

      <ReviewTabs
        fullNote={fullNote}
        gpLetter={gpLetter}
        patientSummary={patientSummary}
        onCopy={copyToClipboard}
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {showDiscardConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-clinical-danger font-medium">Permanently discard this draft?</span>
              <Button variant="destructive" size="sm" onClick={handleDiscard} className="gap-1">
                <Trash2 className="h-3 w-3" /> Yes, discard
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDiscardConfirm(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-clinical-danger gap-1"
              onClick={() => setShowDiscardConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Discard Draft
            </Button>
          )}
        </div>

        <Button
          onClick={handleFinalise}
          disabled={isSubmitting || consultStatus === 'submitting'}
          className="gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Finalising...</>
          ) : (
            <><Send className="h-4 w-4" /> Finalise Consultation</>
          )}
        </Button>
      </div>
    </div>
  );
}

function ReviewTabs({ fullNote, gpLetter, patientSummary, onCopy }: {
  fullNote: string; gpLetter: string; patientSummary: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <Tabs defaultValue="full-note">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="full-note" className="gap-1 text-xs">
          <FileText className="h-3 w-3" /> Full Note
        </TabsTrigger>
        <TabsTrigger value="gp-letter" className="gap-1 text-xs">
          <Send className="h-3 w-3" /> GP Letter
        </TabsTrigger>
        <TabsTrigger value="patient-summary" className="gap-1 text-xs">
          <FileText className="h-3 w-3" /> Patient Summary
        </TabsTrigger>
      </TabsList>

      {[
        { key: 'full-note', content: fullNote, label: 'Full Note' },
        { key: 'gp-letter', content: gpLetter, label: 'GP Letter' },
        { key: 'patient-summary', content: patientSummary, label: 'Patient Summary' },
      ].map(tab => (
        <TabsContent key={tab.key} value={tab.key}>
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-end gap-2 mb-2">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onCopy(tab.content, tab.label)}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <Download className="h-3 w-3" /> PDF
                </Button>
              </div>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-[var(--font-mono)] text-foreground/80 max-h-[400px] overflow-auto">
                {tab.content}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function generateFullNote(
  formData: Record<string, string>,
  condition: Condition | undefined,
  differentials: { diagnosis: string; reasonExcluded: string }[],
  hasRedFlagTriggered: boolean,
  pinnedEvidence: { question: string; answer: string; sources: string[] }[],
): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════');
  lines.push('CLINICAL CONSULTATION NOTE');
  lines.push(`Date: ${new Date().toLocaleDateString('en-AU')}`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push('PATIENT DETAILS');
  lines.push(`Name: ${formData.firstName || ''} ${formData.lastName || ''}`);
  lines.push(`DOB: ${formData.dob || 'N/A'}  Sex: ${formData.sex || 'N/A'}`);
  if (formData.allergies) lines.push(`Allergies: ${formData.allergies}`);
  if (formData.medications) lines.push(`Current Medications: ${formData.medications}`);
  if (formData.comorbidities) lines.push(`Comorbidities: ${formData.comorbidities}`);
  lines.push('');
  lines.push('PRESENTING CONDITION');
  lines.push(`${condition?.name || 'Not specified'} (${condition?.classification || ''})`);
  lines.push('');
  lines.push('ASSESSMENT');
  condition?.assessmentFields.forEach(f => {
    if (formData[`assess_${f}`]) lines.push(`  ${f}: ${formData[`assess_${f}`]}`);
  });
  if (hasRedFlagTriggered) {
    lines.push('');
    lines.push('⚠ RED FLAGS: PRESCRIBING BLOCKED');
    if (formData.referralNotes) lines.push(`Referral: ${formData.referralNotes}`);
  }
  lines.push('');
  lines.push('CLINICAL REASONING');
  lines.push(`Working Diagnosis: ${formData.workingDiagnosis || 'N/A'}`);
  differentials.filter(d => d.diagnosis.trim()).forEach((d, i) => {
    lines.push(`  Differential ${i + 1}: ${d.diagnosis} — Excluded: ${d.reasonExcluded || 'N/A'}`);
  });
  if (formData.selectedTherapy && condition) {
    const t = condition.therapyOptions.find(t => t.id === formData.selectedTherapy);
    if (t) {
      lines.push('');
      lines.push('TREATMENT');
      lines.push(`${t.medicineName} ${t.dose} — ${t.frequency} for ${t.duration}`);
      lines.push(`Qty: ${t.maxQuantity} | Repeats: ${t.repeats} | PBS: ${t.pbsRestriction || 'N/A'}`);
      if (formData.deviationJustification) lines.push(`Deviation: ${formData.deviationJustification}`);
    }
  }
  if (formData.followUpPlan) { lines.push(''); lines.push(`FOLLOW-UP: ${formData.followUpPlan}`); }
  if (formData.safetyNet) { lines.push(`SAFETY NET: ${formData.safetyNet}`); }
  if (formData.clinicalNotes) { lines.push(''); lines.push(`NOTES: ${formData.clinicalNotes}`); }
  if (pinnedEvidence.length > 0) {
    lines.push('');
    lines.push('EVIDENCE REFERENCES');
    pinnedEvidence.forEach((e, i) => {
      lines.push(`  [${i + 1}] ${e.question}`);
      lines.push(`      Sources: ${e.sources.join(', ')}`);
    });
  }
  lines.push('');
  lines.push('═══════════════════════════════════════');
  lines.push('Generated by ChemistCare PrescriberOS');
  return lines.join('\n');
}

function generateGpLetter(
  formData: Record<string, string>,
  condition: Condition | undefined,
  differentials: { diagnosis: string; reasonExcluded: string }[],
): string {
  return [
    `Dear ${formData.gpName || 'Doctor'},`,
    '',
    `Re: ${formData.firstName || ''} ${formData.lastName || ''} (DOB: ${formData.dob || 'N/A'})`,
    '',
    `I am writing to inform you that the above patient presented to our pharmacy for management of ${condition?.name || 'a condition'} under the Victorian Community Pharmacist Prescribing Pilot.`,
    '',
    `Working Diagnosis: ${formData.workingDiagnosis || 'N/A'}`,
    '',
    differentials.filter(d => d.diagnosis.trim()).length > 0 ? 'Differentials considered and excluded:' : '',
    ...differentials.filter(d => d.diagnosis.trim()).map((d, i) => `  ${i + 1}. ${d.diagnosis} — ${d.reasonExcluded || 'N/A'}`),
    '',
    formData.selectedTherapy && condition ? (() => {
      const t = condition.therapyOptions.find(t => t.id === formData.selectedTherapy);
      return t ? `Treatment initiated: ${t.medicineName} ${t.dose}, ${t.frequency} for ${t.duration}` : '';
    })() : 'No pharmacological treatment was initiated.',
    '',
    formData.followUpPlan ? `Follow-up plan: ${formData.followUpPlan}` : '',
    '',
    'Please do not hesitate to contact me should you require further information.',
    '',
    'Kind regards,',
    'Pharmacist Prescriber',
    `${formData.gpClinic ? `\nCC: ${formData.gpClinic}` : ''}`,
  ].filter(Boolean).join('\n');
}

function generatePatientSummary(
  formData: Record<string, string>,
  condition: Condition | undefined,
): string {
  return [
    `Patient Information Sheet`,
    `Date: ${new Date().toLocaleDateString('en-AU')}`,
    '',
    `Dear ${formData.firstName || 'Patient'},`,
    '',
    `Today you visited the pharmacy for: ${condition?.name || 'your condition'}`,
    '',
    formData.selectedTherapy && condition ? (() => {
      const t = condition.therapyOptions.find(t => t.id === formData.selectedTherapy);
      return t ? [
        'Your medication:',
        `  • ${t.medicineName} ${t.dose}`,
        `  • Take: ${t.frequency}`,
        `  • Duration: ${t.duration}`,
      ].join('\n') : '';
    })() : '',
    '',
    formData.safetyNet ? `Important — when to seek help:\n${formData.safetyNet}` : '',
    '',
    formData.followUpPlan ? `Follow-up:\n${formData.followUpPlan}` : '',
    '',
    'If you have any concerns, contact your pharmacist or GP.',
  ].filter(Boolean).join('\n');
}
