import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useParams, useNavigate } from 'react-router-dom';
import { getConditionById } from '@/data/conditions';
import { getSlugForConditionId } from '@/lib/conditionRegistry';
import { getProtocol } from '@/clinical/registry';
import {
  ProtocolProvenancePopover,
  ProtocolReferenceModeBanner,
  ProtocolStatusBadge,
} from '@/components/clinical/ProtocolProvenance';
import { AlertTriangle, ArrowLeft, Ban, Shield, Pill, FileText, Clock, XCircle, CheckCircle } from 'lucide-react';

const ConditionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const condition = getConditionById(id || '');
  // Canonical protocol, when this condition has one. Conditions without a
  // canonical protocol show no provenance rather than an invented one.
  const protocol = condition?.canonicalProtocolId
    ? getProtocol(condition.canonicalProtocolId)
    : undefined;

  if (!condition) {
    return (
      <ClinicalLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Condition not found.</p>
          <Button variant="ghost" onClick={() => navigate('/conditions')} className="mt-2">← Back to library</Button>
        </div>
      </ClinicalLayout>
    );
  }

  return (
    <ClinicalLayout>
      <div className="p-6 space-y-6 animate-fade-in max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/conditions')} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to Conditions Library
        </Button>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{condition.name}</h1>
            <span className={`clinical-badge ${
              condition.classification === 'acute' ? 'clinical-badge-danger' :
              condition.classification === 'chronic' ? 'clinical-badge-info' :
              condition.classification === 'preventive' ? 'clinical-badge-safe' : 'clinical-badge-warning'
            }`}>
              {condition.classification}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{condition.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {protocol ? (
              <>
                <ProtocolStatusBadge
                  status={protocol.lifecycle}
                  needsClinicalReview={protocol.needsClinicalReview}
                />
                <ProtocolProvenancePopover protocol={protocol} />
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No protocol in the registry yet — this condition is not traceable to a retrieved
                source.
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 italic">Reference: {condition.guidelineReference}</p>
        </div>

        {protocol && <ProtocolReferenceModeBanner protocol={protocol} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Scope Validation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" /> Scope Validation Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {condition.scopeValidation.minAge && <div className="flex justify-between"><span className="text-muted-foreground">Minimum Age</span><span className="font-medium">{condition.scopeValidation.minAge} years</span></div>}
              {condition.scopeValidation.maxAge && <div className="flex justify-between"><span className="text-muted-foreground">Maximum Age</span><span className="font-medium">{condition.scopeValidation.maxAge} years</span></div>}
              {condition.scopeValidation.sexRestriction && <div className="flex justify-between"><span className="text-muted-foreground">Sex Restriction</span><span className="font-medium capitalize">{condition.scopeValidation.sexRestriction} only</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Pregnancy Excluded</span><span className="font-medium">{condition.scopeValidation.pregnancyExcluded ? 'Yes' : 'No'}</span></div>
              {condition.scopeValidation.temporalConstraint && <div className="flex justify-between"><span className="text-muted-foreground">Temporal</span><span className="font-medium">{condition.scopeValidation.temporalConstraint}</span></div>}
              {condition.scopeValidation.jurisdictionNotes && (
                <>
                  <Separator />
                  <p className="text-muted-foreground italic">{condition.scopeValidation.jurisdictionNotes}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Red Flags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-clinical-danger" /> Red Flags ({condition.redFlags.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {condition.redFlags.map((rf) => (
                <div key={rf.id} className="flex items-start gap-2 text-xs">
                  <XCircle className="h-3.5 w-3.5 text-clinical-danger shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{rf.description}</p>
                    <p className="text-muted-foreground capitalize">{rf.action.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Assessment Fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" /> Assessment Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {condition.assessmentFields.map(f => (
                  <Badge key={f} variant="secondary" className="text-xs font-normal">{f}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Follow-up */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-clinical-warning" /> Follow-up & Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p><span className="text-muted-foreground">Interval:</span> <span className="font-medium">{condition.followUpInterval}</span></p>
              {condition.monitoringChecklist && (
                <div className="space-y-1 mt-2">
                  {condition.monitoringChecklist.map(m => (
                    <div key={m} className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-clinical-safe" />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Therapy Options */}
        {condition.therapyOptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Pill className="h-4 w-4 text-accent" /> Therapeutic Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {condition.therapyOptions.map((t) => (
                <div key={t.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{t.medicineName}</h4>
                      <span className={`clinical-badge ${t.line === 'first' ? 'clinical-badge-safe' : t.line === 'second' ? 'clinical-badge-info' : 'clinical-badge-warning'}`}>
                        {t.line}-line
                      </span>
                      {t.authorityRequired && <span className="clinical-badge clinical-badge-danger">Authority Required</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground block">Dose</span><span className="font-medium">{t.dose}</span></div>
                    <div><span className="text-muted-foreground block">Frequency</span><span className="font-medium">{t.frequency}</span></div>
                    <div><span className="text-muted-foreground block">Duration</span><span className="font-medium">{t.duration}</span></div>
                    <div><span className="text-muted-foreground block">Max Qty / Repeats</span><span className="font-medium">{t.maxQuantity} / {t.repeats}</span></div>
                  </div>
                  {t.pbsRestriction && <p className="text-xs text-muted-foreground">PBS: {t.pbsRestriction}</p>}
                  {t.contraindications.length > 0 && (
                    <div className="text-xs"><span className="text-clinical-danger font-medium">Contraindications: </span>{t.contraindications.join(', ')}</div>
                  )}
                  {t.interactions.length > 0 && (
                    <div className="text-xs"><span className="text-clinical-warning font-medium">Interactions: </span>{t.interactions.join(', ')}</div>
                  )}
                  {t.specialPopulations && <p className="text-xs italic text-muted-foreground">{t.specialPopulations}</p>}
                  {t.monitoringRequired && <p className="text-xs"><span className="font-medium">Monitoring: </span>{t.monitoringRequired}</p>}
                  {protocol && (
                    <p className="border-t pt-2 text-[11px] text-muted-foreground">
                      Source: {protocol.title} ({protocol.jurisdiction}) ·{' '}
                      {protocol.effectiveDate ? `effective ${protocol.effectiveDate}` : 'date not stated'}{' '}
                      · status <span className="font-medium">{protocol.lifecycle.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Medicines the protocol explicitly EXCLUDES — as clinically
            important as the ones it lists, and previously invisible. */}
        {protocol?.excludedMedicines && protocol.excludedMedicines.length > 0 && (
          <Card className="border-amber-500/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ban className="h-4 w-4 text-amber-700" /> Excluded by protocol
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {protocol.excludedMedicines.map(ex => (
                <div key={ex.medicineName} className="text-xs">
                  <p className="font-semibold">{ex.medicineName}</p>
                  <p className="text-muted-foreground">{ex.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Start Consultation */}
        <div className="flex justify-end">
          <Button onClick={() => {
            const slug = getSlugForConditionId(condition.id);
            navigate(slug ? `/consultations/new/${slug}` : '/consultations/new');
          }} className="gap-2">
            Start Consultation for {condition.name}
          </Button>
        </div>
      </div>
    </ClinicalLayout>
  );
};

export default ConditionDetail;
