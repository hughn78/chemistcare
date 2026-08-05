import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { VoiceTranscriptionSettings } from '@/components/settings/VoiceTranscriptionSettings';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const SettingsPage = () => (
  <ClinicalLayout>
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Practice Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clinic profile, prescriber credentials, integrations and notifications.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Clinic profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Pharmacy" value="—" />
          <Row label="Address" value="—" />
          <Separator />
          <Row label="Jurisdiction" value="Victoria" />
          <Row label="Prescribing authority" value="Community Pharmacist Prescriber" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prescriber credentials</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Name" value="—" />
          <Row label="Ahpra registration" value="—" />
          <Row label="Endorsements" value="—" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Integrations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="MediSecure" value="Connected" />
          <Row label="PBS Online" value="Connected" />
          <Row label="My Health Record" value="Not connected" />
        </CardContent>
      </Card>

      <VoiceTranscriptionSettings />

      <Card>
        <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Follow-up reminders" value="On" />
          <Row label="Red-flag alerts" value="On" />
          <Row label="Weekly summary email" value="On" />
        </CardContent>
      </Card>
    </div>
  </ClinicalLayout>
);

export default SettingsPage;
