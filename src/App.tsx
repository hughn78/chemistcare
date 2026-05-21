import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eager-load landing page for fast initial paint
import LandingPage from "./pages/LandingPage";

// Lazy-load everything else for code splitting
const Index = lazy(() => import("./pages/Index"));
const NewConsultation = lazy(() => import("./pages/NewConsultation"));
const ConsultationPicker = lazy(() => import("./pages/ConsultationPicker"));
const ConsultationRedirect = lazy(() => import("./pages/ConsultationRedirect"));
const UtiConsultation = lazy(() => import("./pages/UtiConsultation"));
const Patients = lazy(() => import("./pages/Patients"));
const ConditionsLibrary = lazy(() => import("./pages/ConditionsLibrary"));
const ConditionDetail = lazy(() => import("./pages/ConditionDetail"));
const PrescribingLog = lazy(() => import("./pages/PrescribingLog"));
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

function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-background text-foreground">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground font-medium">Loading PrescriberOS...</p>
    </div>
  );
}

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <LandingPage />, errorElement: <ErrorBoundary><NotFound /></ErrorBoundary> },
  { path: "/full-scope-of-practice", element: <Suspense fallback={<PageLoader />}><FullScopeOfPractice /></Suspense> },
  { path: "/dashboard", element: <Suspense fallback={<PageLoader />}><Index /></Suspense> },
  { path: "/consultations/new", element: <Suspense fallback={<PageLoader />}><ConsultationPicker /></Suspense> },
  { path: "/consultations/new/uncomplicated-uti", element: <Suspense fallback={<PageLoader />}><UtiConsultation /></Suspense> },
  { path: "/consultations/new/:conditionSlug", element: <Suspense fallback={<PageLoader />}><NewConsultation /></Suspense> },
  { path: "/consultation", element: <Suspense fallback={<PageLoader />}><ConsultationRedirect /></Suspense> },
  { path: "/patients", element: <Suspense fallback={<PageLoader />}><Patients /></Suspense> },
  { path: "/conditions", element: <Suspense fallback={<PageLoader />}><ConditionsLibrary /></Suspense> },
  { path: "/conditions/:id", element: <Suspense fallback={<PageLoader />}><ConditionDetail /></Suspense> },
  { path: "/prescribing-log", element: <Suspense fallback={<PageLoader />}><PrescribingLog /></Suspense> },
  { path: "/audit", element: <Suspense fallback={<PageLoader />}><Audit /></Suspense> },
  { path: "/calculators", element: <Suspense fallback={<PageLoader />}><CalculatorsPage /></Suspense> },
  { path: "/claims", element: <Suspense fallback={<PageLoader />}><ClaimsPage /></Suspense> },
  { path: "/ppa-settings", element: <Suspense fallback={<PageLoader />}><PPASettingsPage /></Suspense> },
  { path: "/eight-cpa", element: <Suspense fallback={<PageLoader />}><EightCpaDashboard /></Suspense> },
  { path: "/eight-cpa/new", element: <Suspense fallback={<PageLoader />}><EightCpaNewService /></Suspense> },
  { path: "/eight-cpa/edit/:id", element: <Suspense fallback={<PageLoader />}><EightCpaNewService /></Suspense> },
  { path: "/eight-cpa/history", element: <Suspense fallback={<PageLoader />}><EightCpaServiceHistory /></Suspense> },
  { path: "/settings", element: <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense> },
  { path: "/triage", element: <Suspense fallback={<PageLoader />}><PatientTriage /></Suspense> },
  { path: "/protocol-consultation", element: <Suspense fallback={<PageLoader />}><ProtocolConsultation /></Suspense> },
  { path: "/travel-consultation", element: <Suspense fallback={<PageLoader />}><TravelConsultation /></Suspense> },
  { path: "/calendar", element: <Suspense fallback={<PageLoader />}><CalendarPage /></Suspense> },
  { path: "/book/:pharmacySlug", element: <Suspense fallback={<PageLoader />}><BookingPage /></Suspense> },
  { path: "/admin/settings", element: <Suspense fallback={<PageLoader />}><AdminSettingsPage /></Suspense> },
  { path: "/scribe", element: <Suspense fallback={<PageLoader />}><ScribePage /></Suspense> },
  { path: "/messaging", element: <Suspense fallback={<PageLoader />}><PatientMessaging /></Suspense> },
  { path: "/pbs-lookup", element: <Suspense fallback={<PageLoader />}><PbsLookup /></Suspense> },
  { path: "/claims-demo", element: <Suspense fallback={<PageLoader />}><ClaimsDemo /></Suspense> },
  { path: "/fhir-demo", element: <Suspense fallback={<PageLoader />}><FhirDemo /></Suspense> },
  { path: "/integration-settings", element: <Suspense fallback={<PageLoader />}><IntegrationSettings /></Suspense> },
  { path: "*", element: <Suspense fallback={<PageLoader />}><NotFound /></Suspense> },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RouterProvider router={router} />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
