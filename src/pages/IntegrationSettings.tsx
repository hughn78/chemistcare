import { ClinicalLayout } from '@/components/ClinicalLayout';
import { IntegrationDashboard } from '@/components/clinical-api/IntegrationDashboard';

export default function IntegrationSettings() {
  return (
    <ClinicalLayout>
      <div className="p-4 md:p-6 space-y-4 animate-fade-in max-w-4xl">
        <h1 className="text-2xl font-bold">Integration Settings</h1>
        <p className="text-sm text-muted-foreground">Manage external API integrations, feature flags, cache health, and usage</p>
        <IntegrationDashboard />
      </div>
    </ClinicalLayout>
  );
}
