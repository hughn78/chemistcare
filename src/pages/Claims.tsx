import { useState } from 'react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EligibleCases } from '@/components/claims/EligibleCases';
import { ClaimBatches } from '@/components/claims/ClaimBatches';
import { ClaimHistory } from '@/components/claims/ClaimHistory';
import { FileText, Package, History } from 'lucide-react';

const ClaimsPage = () => {
  const [activeTab, setActiveTab] = useState('eligible');

  return (
    <ClinicalLayout>
      <div className="p-6 space-y-6 animate-fade-in max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PBS claims &amp; reimbursements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assess eligibility, generate monthly claim batches and export summaries for funded community pharmacist programs.
          </p>
        </div>

        {/* Summary bar — TODO wire to live claim aggregates */}
        <div className="grid grid-cols-3 divide-x rounded-md border bg-card">
          <div className="px-4 py-3">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">Total claimable</p>
            <p className="text-xl font-semibold tabular-nums mt-1">$4,820.50</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">Total paid</p>
            <p className="text-xl font-semibold tabular-nums mt-1">$3,612.00</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">Discrepancies</p>
            <p className="text-xl font-semibold tabular-nums mt-1 text-clinical-warning">2</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="eligible" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Eligible Cases
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" /> Batches
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="eligible" className="mt-4">
            <EligibleCases />
          </TabsContent>
          <TabsContent value="batches" className="mt-4">
            <ClaimBatches />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <ClaimHistory />
          </TabsContent>
        </Tabs>
      </div>
    </ClinicalLayout>
  );
};

export default ClaimsPage;
