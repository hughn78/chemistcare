import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router-dom";
import RouteError from "@/components/RouteError";
import { AuditWriteWarning } from "@/components/AuditWriteWarning";
import { ErrorBoundary } from "@/components/ErrorBoundary";
/**
 * Every page is code-split. Previously a 2.7 MB single chunk was downloaded
 * before the first paint, including the whole landing page, the 8CPA billing
 * engine and the FHIR demo. Only the route you open is fetched now.
 */
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Index = lazy(() => import("./pages/Index"));
const NewConsultation = lazy(() => import("./pages/NewConsultation"));
const ConsultationPicker = lazy(() => import("./pages/ConsultationPicker"));
const ConsultationRedirect = lazy(() => import("./pages/ConsultationRedirect"));
const UtiConsultation = lazy(() => import("./pages/UtiConsultation"));
const Patients = lazy(() => import("./pages/Patients"));
const ConditionsLibrary = lazy(() => import("./pages/ConditionsLibrary"));
const ConditionDetail = lazy(() => import("./pages/ConditionDetail"));
const PrescribingLog = lazy(() => import("./pages/PrescribingLog"));
const Episodes = lazy(() => import("./pages/Episodes"));
const Audit = lazy(() => import("./pages/Audit"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const CalculatorsPage = lazy(() => import("./pages/Calculators"));
const ClaimsPage = lazy(() => import("./pages/Claims"));
const PPASettingsPage = lazy(() => import("./pages/PPASettings"));
const EightCpaDashboard = lazy(() => import("./pages/EightCpaDashboard"));
const EightCpaNewService = lazy(() => import("./pages/EightCpaNewService"));
const EightCpaServiceHistory = lazy(() => import("./pages/EightCpaServiceHistory"));
const PatientTriage = lazy(() => import("./pages/PatientTriage"));
const ProtocolConsultation = lazy(() => import("./pages/ProtocolConsultation"));
const TravelConsultation = lazy(() => import("./pages/TravelConsultation"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const ScribePage = lazy(() => import("./pages/ScribePage"));
const PatientMessaging = lazy(() => import("./pages/PatientMessaging"));
const PbsLookup = lazy(() => import("./pages/PbsLookup"));
const ClaimsDemo = lazy(() => import("./pages/ClaimsDemo"));
const FhirDemo = lazy(() => import("./pages/FhirDemo"));
const IntegrationSettings = lazy(() => import("./pages/IntegrationSettings"));
const FullScopeOfPractice = lazy(() => import("./pages/FullScopeOfPractice"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Shown while a route chunk downloads. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <span className="text-sm text-muted-foreground">Loading…</span>
    </div>
  );
}

const queryClient = new QueryClient();

const routes: RouteObject[] = [
  { path: "/", element: <LandingPage /> },
  { path: "/full-scope-of-practice", element: <FullScopeOfPractice /> },
  { path: "/dashboard", element: <Index /> },
  // Condition-aware consultation routing (single source of truth: conditionRegistry)
  { path: "/consultations/new", element: <ConsultationPicker /> },
  // UTI is the gold-standard, condition-driven pathway. Other 21 conditions
  // continue to use the generic NewConsultation engine until they are
  // migrated to the ConditionTemplate contract.
  { path: "/consultations/new/uncomplicated-uti", element: <UtiConsultation /> },
  { path: "/consultations/new/:conditionSlug", element: <NewConsultation /> },
  // Legacy: /consultation and /consultation?condition=<id> still link in from
  // Dashboard, ConditionDetail, PrescribingLog, ReviewPanel — redirect them.
  { path: "/consultation", element: <ConsultationRedirect /> },
  { path: "/patients", element: <Patients /> },
  { path: "/conditions", element: <ConditionsLibrary /> },
  { path: "/conditions/:id", element: <ConditionDetail /> },
  { path: "/prescribing-log", element: <PrescribingLog /> },
  { path: "/episodes", element: <Episodes /> },
  { path: "/audit", element: <Audit /> },
  { path: "/calculators", element: <CalculatorsPage /> },
  { path: "/claims", element: <ClaimsPage /> },
  { path: "/ppa-settings", element: <PPASettingsPage /> },
  { path: "/eight-cpa", element: <EightCpaDashboard /> },
  { path: "/eight-cpa/new", element: <EightCpaNewService /> },
  { path: "/eight-cpa/edit/:id", element: <EightCpaNewService /> },
  { path: "/eight-cpa/history", element: <EightCpaServiceHistory /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/triage", element: <PatientTriage /> },
  { path: "/protocol-consultation", element: <ProtocolConsultation /> },
  { path: "/travel-consultation", element: <TravelConsultation /> },
  { path: "/calendar", element: <CalendarPage /> },
  { path: "/book/:pharmacySlug", element: <BookingPage /> },
  { path: "/admin/settings", element: <AdminSettingsPage /> },
  { path: "/scribe", element: <ScribePage /> },
  { path: "/messaging", element: <PatientMessaging /> },
  { path: "/pbs-lookup", element: <PbsLookup /> },
  { path: "/claims-demo", element: <ClaimsDemo /> },
  { path: "/fhir-demo", element: <FhirDemo /> },
  { path: "/integration-settings", element: <IntegrationSettings /> },
  { path: "*", element: <NotFound /> },
];

/**
 * Every route gets a real error view. Previously the only errorElement in the
 * app wrapped <NotFound />, so a route exception rendered a 404 page and gave
 * the user no way to retry.
 */
const router = createBrowserRouter(
  routes.map(route => ({ ...route, errorElement: <RouteError /> })),
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<RouteFallback />}>
          <RouterProvider router={router} />
        </Suspense>
        <AuditWriteWarning />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
