import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PageTransition } from '@/components/PageTransition';
import { Shield } from 'lucide-react';

interface ClinicalLayoutProps {
  children: ReactNode;
}

export function ClinicalLayout({ children }: ClinicalLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b bg-card px-3 sm:px-4 shrink-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <SidebarTrigger className="text-muted-foreground" />
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-accent" />
                <span className="text-[0.6875rem] font-medium text-muted-foreground">Clinical Mode</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] text-muted-foreground hidden sm:inline">Jurisdiction: <span className="font-medium text-foreground">Victoria</span></span>
              <div className="h-1.5 w-1.5 rounded-full bg-clinical-safe" />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
