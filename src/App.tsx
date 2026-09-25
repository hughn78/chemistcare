import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import NewConsultation from "./pages/NewConsultation";
import ConsultationPicker from "./pages/ConsultationPicker";
import ConsultationRedirect from "./pages/ConsultationRedirect";
import UtiConsultation from "./pages/UtiConsultation";
import Patients from "./pages/Patients";
import ConditionsLibrary from "./pages/ConditionsLibrary";
import ConditionDetail from "./pages/ConditionDetail";
import PrescribingLog from "./pages/PrescribingLog";
import Episodes from "./pages/Episodes";
import Audit from "./pages/Audit";
import SettingsPage from "./pages/Settings";
import CalculatorsPage from "./pages/Calculators";
import ClaimsPage from "./pages/Claims";
import PPASettingsPage from "./pages/PPASettings";
import EightCpaDashboard from "./pages/EightCpaDashboard";
import EightCpaNewService from "./pages/EightCpaNewService";
import EightCpaServiceHistory from "./pages/EightCpaServiceHistory";
import PatientTriage from "./pages/PatientTriage";
import ProtocolConsultation from "./pages/ProtocolConsultation";
import ProtocolCorpusPage from "./pages/ProtocolCorpusPage";
import TemplateConsultation from "./pages/TemplateConsultation";
import TravelConsultation from "./pages/TravelConsultation";
import CalendarPage from "./pages/CalendarPage";
import BookingPage from "./pages/BookingPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ScribePage from "./pages/ScribePage";
import PatientMessaging from "./pages/PatientMessaging";
import PbsLookup from "./pages/PbsLookup";
import ClaimsDemo from "./pages/ClaimsDemo";
import FhirDemo from "./pages/FhirDemo";
import IntegrationSettings from "./pages/IntegrationSettings";
import FullScopeOfPractice from "./pages/FullScopeOfPractice";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <LandingPage />, errorElement: <ErrorBoundary><NotFound /></ErrorBoundary> },
  { path: "/full-scope-of-practice", element: <FullScopeOfPractice /> },
  { path: "/dashboard", element: <Index /> },
  // Condition-aware consultation routing (single source of truth: conditionRegistry)
  { path: "/consultations/new", element: <ConsultationPicker /> },
  // UTI is the gold-standard, condition-driven pathway. Other 21 conditions
  // continue to use the generic NewConsultation engine until they are
  // migrated to the ConditionTemplate contract.
  { path: "/consultations/new/uncomplicated-uti", element: <UtiConsultation /> },
  // Corpus-driven condition pathways (TemplateConsultation over corpus templates)
  { path: "/consultations/new/acute-nausea-and-vomiting", element: <TemplateConsultation /> },
  { path: "/consultations/new/psoriasis", element: <TemplateConsultation /> },
  { path: "/consultations/new/gord", element: <TemplateConsultation /> },
  { path: "/consultations/new/atopic-dermatitis", element: <TemplateConsultation /> },
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
  { path: "/protocol-corpus", element: <ProtocolCorpusPage /> },
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
