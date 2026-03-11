import { useState, useMemo, useCallback } from 'react';
import { SketchPad } from '@/components/consult/SketchPad';
import { Pen } from 'lucide-react';
import { ClinicalLayout } from '@/components/ClinicalLayout';
import { TravelWeatherCard } from '@/components/clinical-api/TravelWeatherCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CalculatorsDialog } from '@/components/CalculatorsDialog';
import { AnatomyDialog } from '@/components/AnatomyDialog';

import { ClinicalAlert } from '@/components/protocols/ClinicalAlert';
import { TagInput, parseTagString, tagsToString } from '@/components/ui/tag-input';
import {
  ArrowLeft, ArrowRight, AlertTriangle, Shield, Plane, Syringe,
  Pill, Package, FileText, Bell, Plus, Trash2, ExternalLink,
  Globe, User, Heart, CheckCircle, XCircle, Clock, Info,
} from 'lucide-react';
import type {
  TravelStep, TravelPatientForm, ItineraryLeg, VaccineHistoryEntry,
  TravelRiskFlag, PlannedVaccine, MedicalCondition, PrescribingModule,
  MedicalKitSection,
} from '@/types/travel';
import {
  TRAVEL_STEPS, MEDICAL_CONDITIONS, VACCINE_LIST,
  MALARIA_DRUGS, ALTITUDE_DRUGS, TD_ANTIBIOTICS,
} from '@/types/travel';

const CONDITION_LABELS: Partial<Record<MedicalCondition, string>> = {
  vte_dvt_history: 'DVT History',
};
import { evaluateTravelRisks, daysUntilDeparture, tripDuration } from '@/lib/travelRiskEngine';
import {
  TD_MEDICATIONS, ALTITUDE_MEDICATIONS, TRAVEL_VACCINES,
  VACCINE_SCHEDULING_RULES, VACCINE_REFER_FLAGS, VTE_COUNSELLING_ITEMS, VTE_REFER_NOTE,
  type TravelMedication, type TravelPrescriptionItem,
} from '@/data/travelPrescribingData';

// ── Helpers ──

const emptyLeg = (): ItineraryLeg => ({
  id: crypto.randomUUID(), destination: '', region: '', departureDate: '', returnDate: '',
  accommodation: 'hotel', purpose: 'holiday', ruralTravel: false, remoteTravel: false,
});

const emptyForm = (): TravelPatientForm => ({
  fullName: '', dob: '', gender: '', occupation: '', countryOfBirth: '', phone: '', email: '',
  itinerary: [emptyLeg()], companions: [],
  childhoodVaccinesComplete: null, currentMedications: '', allergies: '', eggAllergy: false,
  medicalConditions: [], bmi: '', pregnancyCurrent: false, pregnancyPlanned: false, breastfeeding: false,
  previousOverseasTravel: false, priorMalariaProphylaxis: '',
  faintingHistory: false,
  vaccineHistory: VACCINE_LIST.map(v => ({ vaccine: v, yearReceived: '', adverseReaction: '' })),
  airConsentGranted: false,
});

const STEP_ICONS: Record<TravelStep, typeof User> = {
  'patient-form': User, 'risk-assessment': Shield, 'vaccination': Syringe,
  'prescribing': Pill, 'medical-kit': Package, 'documentation': FileText, 'follow-up': Bell,
};

// ── Resource links ──

const RESOURCE_LINKS = [
  { label: 'Australian Immunisation Handbook', url: 'https://immunisationhandbook.health.gov.au/' },
  { label: 'CDC Yellow Book', url: 'https://wwwnc.cdc.gov/travel/yellowbook/2024/table-of-contents' },
  { label: 'Smartraveller', url: 'https://www.smartraveller.gov.au/' },
  { label: 'Travel Health Pro', url: 'https://travelhealthpro.org.uk/' },
  { label: 'WHO Disease Outbreak News', url: 'https://www.who.int/emergencies/disease-outbreak-news' },
];

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════

export default function TravelConsultation() {
  const [step, setStep] = useState<TravelStep>('patient-form');
  const [showSketchPad, setShowSketchPad] = useState(false);
  const [form, setForm] = useState<TravelPatientForm>(emptyForm());
  const [riskFlags, setRiskFlags] = useState<TravelRiskFlag[]>([]);
  const [plannedVaccines, setPlannedVaccines] = useState<PlannedVaccine[]>([]);
   const [prescribingTab, setPrescribingTab] = useState<PrescribingModule>('malaria');
  const [prescribedMeds, setPrescribedMeds] = useState<string[]>([]);
  const [travelRxItems, setTravelRxItems] = useState<TravelPrescriptionItem[]>([]);
  const [selectedDosing, setSelectedDosing] = useState<Record<string, string>>({});
  const [selectedMeds, setSelectedMeds] = useState<Record<string, boolean>>({});
  const [vaccineSelections, setVaccineSelections] = useState<Record<string, { selected: boolean; date: string; note: string }>>({});
  const [counsellingChecks, setCounsellingChecks] = useState<Record<string, boolean>>({});
  const [pharmacistName, setPharmacistName] = useState('');
  const [pharmacistCredentials, setPharmacistCredentials] = useState('');

  const stepIdx = TRAVEL_STEPS.findIndex(s => s.key === step);
  const blocked = riskFlags.some(f => f.blocksConsultation);
  const daysToDep = useMemo(() => daysUntilDeparture(form.itinerary), [form.itinerary]);
  const duration = useMemo(() => tripDuration(form.itinerary), [form.itinerary]);

  const updateForm = useCallback(<K extends keyof TravelPatientForm>(key: K, value: TravelPatientForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const goNext = () => {
    const nextIdx = stepIdx + 1;
    if (nextIdx < TRAVEL_STEPS.length) setStep(TRAVEL_STEPS[nextIdx].key);
  };
  const goBack = () => {
    const prevIdx = stepIdx - 1;
    if (prevIdx >= 0) setStep(TRAVEL_STEPS[prevIdx].key);
  };

  const handleEvaluateRisks = () => {
    setRiskFlags(evaluateTravelRisks(form));
    setStep('risk-assessment');
  };

  // ── Toggle a structured travel medication ──
  const toggleTravelMed = (med: TravelMedication, checked: boolean) => {
    setSelectedMeds(prev => ({ ...prev, [med.id]: checked }));
    if (checked) {
      const dosing = selectedDosing[med.id] || med.dosingOptions[0]?.value || '';
      const item: TravelPrescriptionItem = {
        id: med.id,
        drug: med.drug,
        strength: med.strength,
        dosing,
        indication: med.indication,
        notes: med.clinicalNotes.join(' '),
      };
      setTravelRxItems(prev => [...prev.filter(r => r.id !== med.id), item]);
      if (!prescribedMeds.includes(`${med.drug} ${med.strength}`)) {
        setPrescribedMeds(prev => [...prev, `${med.drug} ${med.strength} — ${dosing}`]);
      }
    } else {
      setTravelRxItems(prev => prev.filter(r => r.id !== med.id));
      setPrescribedMeds(prev => prev.filter(m => !m.startsWith(med.drug)));
    }
  };

  const updateTravelMedDosing = (med: TravelMedication, dosing: string) => {
    setSelectedDosing(prev => ({ ...prev, [med.id]: dosing }));
    setTravelRxItems(prev => prev.map(r => r.id === med.id ? { ...r, dosing } : r));
    setPrescribedMeds(prev => prev.map(m => m.startsWith(med.drug) ? `${med.drug} ${med.strength} — ${dosing}` : m));
  };

  // ── Generate default medical kit ──
  const generateKit = useCallback((): MedicalKitSection[] => {
    const sections: MedicalKitSection[] = [
      { title: 'Documentation', items: ['Immunisation record', 'Copies of prescriptions', 'Pharmacist travel letter', 'Travel insurance details'] },
      { title: 'First Aid', items: ['Bandaids', 'Elastoplast', 'Gauze & bandages', 'Thermometer', 'Sterile gloves', 'Scissors/tweezers', 'Steri-strips', 'Water purification tablets'] },
      { title: 'Medications', items: ['Oral rehydration salts (ORS)', 'Loperamide', 'Paracetamol', ...prescribedMeds] },
      { title: 'Topical Items', items: ['Antifungal cream', 'Chlorhexidine antiseptic', 'Corticosteroid cream', 'DEET ≥20% insect repellent', 'Permethrin for clothing/gear', 'Sunscreen SPF 50+'] },
      { title: 'Other', items: ['Condoms', 'Hand sanitiser', 'Face masks', 'Spare glasses/contacts'] },
    ];
    if (form.eggAllergy || form.allergies.toLowerCase().includes('anaphylaxis')) {
      sections[4].items.push('EpiPen (adrenaline auto-injector)');
    }
    return sections;
  }, [prescribedMeds, form.eggAllergy, form.allergies]);

  // ── Generate SOAP-style consultation summary ──
  const generateSummary = () => {
    const lines = [
      `TRAVEL HEALTH CONSULTATION RECORD`,
      `Date: ${new Date().toLocaleDateString('en-AU')}`,
      `Pharmacist: ${pharmacistName} — ${pharmacistCredentials}`,
      '',
      `PATIENT: ${form.fullName} | DOB: ${form.dob} | Gender: ${form.gender}`,
      `Occupation: ${form.occupation} | Country of Birth: ${form.countryOfBirth}`,
      '',
      '── ITINERARY ──',
      ...form.itinerary.map((l, i) => `${i + 1}. ${l.destination} (${l.region}) — ${l.departureDate} to ${l.returnDate} | ${l.purpose} | ${l.accommodation}${l.ruralTravel ? ' | Rural' : ''}${l.remoteTravel ? ' | Remote' : ''}`),
      '',
      `Days until departure: ${daysToDep ?? 'N/A'} | Trip duration: ${duration ?? 'N/A'} days`,
      '',
      '── RISK ASSESSMENT ──',
      ...riskFlags.map(f => `[${f.level.toUpperCase()}] ${f.title}: ${f.message}`),
      '',
      '── VACCINATIONS PLANNED ──',
      ...plannedVaccines.map(v => `${v.name} (${v.category}) — ${v.outsideScope ? 'REFERRED' : v.scheduledDate || 'TBD'}${v.contraindicated ? ' ⚠ CONTRAINDICATED: ' + v.contraindicationReason : ''}`),
      ...Object.entries(vaccineSelections).filter(([, v]) => v.selected).map(([id, v]) => {
        const vax = TRAVEL_VACCINES.find(tv => tv.id === id);
        return `${vax?.name || id} — ${v.date || 'Date TBD'}${v.note ? ' — ' + v.note : ''}`;
      }),
      '',
      '── MEDICATIONS PRESCRIBED ──',
      prescribedMeds.length ? prescribedMeds.join('\n') : 'None',
      ...travelRxItems.map(r => `  → ${r.drug} ${r.strength}: ${r.dosing} (${r.indication})`),
      '',
      '── COUNSELLING ──',
      ...Object.entries(counsellingChecks).filter(([, v]) => v).map(([k]) => `✓ ${k}`),
      '',
      '── POST-TRAVEL ADVICE ──',
      'If you feel unwell on return — especially fever — tell your doctor you have been overseas.',
      'Malaria symptoms can appear up to 2 years after travel.',
    ];
    return lines.join('\n');
  };

  const generateTravelLetter = () => {
    return `[Pharmacy Letterhead]
Date: ${new Date().toLocaleDateString('en-AU')}

To Whom It May Concern,

This letter certifies that ${form.fullName}, Date of Birth ${form.dob}, is under my care and requires the following medications for their health conditions during travel:

${prescribedMeds.map(m => `• ${m}`).join('\n') || '• No medications prescribed'}

${form.fullName} requires these medications to maintain health stability during travel. Some may be restricted in certain countries. I kindly request that my patient be permitted to carry these medications without restriction.

${pharmacistName}
${pharmacistCredentials}`;
  };

  return (
    <>
    <ClinicalLayout>
      <div className="p-4 lg:p-6 space-y-4 max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Plane className="h-5 w-5 text-accent" /> Travel Medicine Consultation</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Victorian Pharmacist Prescriber — Pre-Travel Health Assessment</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSketchPad(true)} className="gap-1.5 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent">
                  <Pen className="h-4 w-4" />
                  <span className="hidden sm:inline">Sketch Pad</span>
                </Button>
                <CalculatorsDialog />
                <AnatomyDialog />
            
            {daysToDep !== null && (
              <Badge variant={daysToDep < 14 ? 'destructive' : 'secondary'} className="tabular-nums">
                <Clock className="h-3 w-3 mr-1" /> {daysToDep}d to departure
              </Badge>
            )}
          </div>
        </div>

        {/* Step nav */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TRAVEL_STEPS.map((s, i) => {
            const Icon = STEP_ICONS[s.key];
            const isActive = step === s.key;
            const isDone = i < stepIdx;
            return (
              <div key={s.key} className="flex items-center">
                <button
                  onClick={() => setStep(s.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive ? 'bg-accent/10 text-accent' : isDone ? 'text-foreground/70 hover:bg-muted' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`step-indicator w-6 h-6 text-[10px] ${isActive ? 'step-active' : isDone ? 'step-complete' : 'step-pending'}`}>
                    {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className="hidden md:inline">{s.label}</span>
                </button>
                {i < TRAVEL_STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-0.5 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Resource links */}
        <div className="flex flex-wrap gap-2">
          {RESOURCE_LINKS.map(r => (
            <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline">
              <ExternalLink className="h-2.5 w-2.5" /> {r.label}
            </a>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* STEP 1: PATIENT FORM */}
        {/* ═══════════════════════════════════════════════ */}
        {step === 'patient-form' && (
          <div className="space-y-4">
            {/* Personal details */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Personal Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div><Label className="text-xs">Full Name <span className="text-destructive">*</span></Label><Input placeholder="Full name" value={form.fullName} onChange={e => updateForm('fullName', e.target.value)} /></div>
                  <div><Label className="text-xs">Date of Birth <span className="text-destructive">*</span></Label><Input type="date" value={form.dob} onChange={e => updateForm('dob', e.target.value)} /></div>
                  <div><Label className="text-xs">Gender</Label>
                    <Select value={form.gender} onValueChange={v => updateForm('gender', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Occupation</Label><Input placeholder="Occupation" value={form.occupation} onChange={e => updateForm('occupation', e.target.value)} /></div>
                  <div><Label className="text-xs">Country of Birth</Label><Input placeholder="e.g. Australia" value={form.countryOfBirth} onChange={e => updateForm('countryOfBirth', e.target.value)} /></div>
                  <div><Label className="text-xs">Phone</Label><Input placeholder="Phone" value={form.phone} onChange={e => updateForm('phone', e.target.value)} /></div>
                  <div className="md:col-span-2"><Label className="text-xs">Email</Label><Input placeholder="Email" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Itinerary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Travel Itinerary</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => updateForm('itinerary', [...form.itinerary, emptyLeg()])} className="gap-1"><Plus className="h-3 w-3" /> Add Leg</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.itinerary.map((leg, li) => (
                  <div key={leg.id} className="rounded-lg border p-3 space-y-3 relative">
                    {form.itinerary.length > 1 && (
                      <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0"
                        onClick={() => updateForm('itinerary', form.itinerary.filter((_, i) => i !== li))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    <p className="text-xs font-semibold text-muted-foreground">Leg {li + 1}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><Label className="text-xs">Destination Country</Label><Input placeholder="e.g. Thailand" value={leg.destination} onChange={e => {
                        const updated = [...form.itinerary]; updated[li] = { ...leg, destination: e.target.value }; updateForm('itinerary', updated);
                      }} /></div>
                      <div><Label className="text-xs">Region / City</Label><Input placeholder="e.g. Chiang Mai" value={leg.region} onChange={e => {
                        const updated = [...form.itinerary]; updated[li] = { ...leg, region: e.target.value }; updateForm('itinerary', updated);
                      }} /></div>
                      <div><Label className="text-xs">Departure Date</Label><Input type="date" value={leg.departureDate} onChange={e => {
                        const updated = [...form.itinerary]; updated[li] = { ...leg, departureDate: e.target.value }; updateForm('itinerary', updated);
                      }} /></div>
                      <div><Label className="text-xs">Return Date</Label><Input type="date" value={leg.returnDate} onChange={e => {
                        const updated = [...form.itinerary]; updated[li] = { ...leg, returnDate: e.target.value }; updateForm('itinerary', updated);
                      }} /></div>
                      <div><Label className="text-xs">Accommodation</Label>
                        <Select value={leg.accommodation} onValueChange={v => {
                          const updated = [...form.itinerary]; updated[li] = { ...leg, accommodation: v as any }; updateForm('itinerary', updated);
                        }}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="hotel">Hotel</SelectItem><SelectItem value="hostel">Hostel</SelectItem><SelectItem value="homestay">Homestay</SelectItem><SelectItem value="camping">Camping</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Purpose</Label>
                        <Select value={leg.purpose} onValueChange={v => {
                          const updated = [...form.itinerary]; updated[li] = { ...leg, purpose: v as any }; updateForm('itinerary', updated);
                        }}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="holiday">Holiday</SelectItem><SelectItem value="vfr">VFR</SelectItem><SelectItem value="business">Business</SelectItem>
                            <SelectItem value="volunteering">Volunteering</SelectItem><SelectItem value="medical_tourism">Medical Tourism</SelectItem><SelectItem value="aid_work">Aid Work</SelectItem><SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2"><Checkbox checked={leg.ruralTravel} onCheckedChange={v => {
                        const updated = [...form.itinerary]; updated[li] = { ...leg, ruralTravel: !!v }; updateForm('itinerary', updated);
                      }} /><Label className="text-xs">Rural / wilderness travel</Label></div>
                      <div className="flex items-center gap-2"><Checkbox checked={leg.remoteTravel} onCheckedChange={v => {
                        const updated = [...form.itinerary]; updated[li] = { ...leg, remoteTravel: !!v }; updateForm('itinerary', updated);
                      }} /><Label className="text-xs">Remote area travel</Label></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Health details */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4" /> Health Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2"><Checkbox checked={form.childhoodVaccinesComplete === true} onCheckedChange={v => updateForm('childhoodVaccinesComplete', !!v || null)} /><Label className="text-xs">Childhood vaccinations complete</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.eggAllergy} onCheckedChange={v => updateForm('eggAllergy', !!v)} /><Label className="text-xs">Egg allergy</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.pregnancyCurrent} onCheckedChange={v => updateForm('pregnancyCurrent', !!v)} /><Label className="text-xs">Currently pregnant</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.pregnancyPlanned} onCheckedChange={v => updateForm('pregnancyPlanned', !!v)} /><Label className="text-xs">Planning pregnancy during travel</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.breastfeeding} onCheckedChange={v => updateForm('breastfeeding', !!v)} /><Label className="text-xs">Breastfeeding</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.faintingHistory} onCheckedChange={v => updateForm('faintingHistory', !!v)} /><Label className="text-xs">History of fainting after injection</Label></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.previousOverseasTravel} onCheckedChange={v => updateForm('previousOverseasTravel', !!v)} /><Label className="text-xs">Previous overseas travel</Label></div>
                </div>
                <div><Label className="text-xs">BMI</Label><Input type="number" placeholder="e.g. 25.4" value={form.bmi} onChange={e => updateForm('bmi', e.target.value)} className="max-w-[120px]" /></div>
                <div><Label className="text-xs">Current Medications</Label><TagInput placeholder="Type medication and press Enter…" value={parseTagString(form.currentMedications)} onChange={tags => updateForm('currentMedications', tagsToString(tags))} /></div>
                <div><Label className="text-xs">Allergies</Label><TagInput placeholder="Type allergy and press Enter…" value={parseTagString(form.allergies)} onChange={tags => updateForm('allergies', tagsToString(tags))} /></div>
                <div><Label className="text-xs">Prior Malaria Prophylaxis</Label><Input placeholder="e.g. Malarone — well tolerated" value={form.priorMalariaProphylaxis} onChange={e => updateForm('priorMalariaProphylaxis', e.target.value)} /></div>

                <Separator />
                <p className="text-xs font-semibold">Past Medical History</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {MEDICAL_CONDITIONS.map(c => (
                    <div key={c} className="flex items-center gap-2">
                      <Checkbox checked={form.medicalConditions.includes(c)} onCheckedChange={v => {
                        updateForm('medicalConditions', v ? [...form.medicalConditions, c] : form.medicalConditions.filter(x => x !== c));
                      }} />
                      <Label className="text-xs capitalize">{CONDITION_LABELS[c] || c.replace(/_/g, ' ')}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Vaccination history */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Syringe className="h-4 w-4" /> Vaccination History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_80px_1fr] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                    <span>Vaccine</span><span>Year</span><span>Adverse Reaction</span>
                  </div>
                  <ScrollArea className="max-h-[300px]">
                    {form.vaccineHistory.map((vh, i) => (
                      <div key={vh.vaccine} className="grid grid-cols-[1fr_80px_1fr] gap-2 py-1 items-center">
                        <span className="text-xs">{vh.vaccine}</span>
                        <Input className="h-7 text-xs" placeholder="Year" value={vh.yearReceived} onChange={e => {
                          const updated = [...form.vaccineHistory]; updated[i] = { ...vh, yearReceived: e.target.value }; updateForm('vaccineHistory', updated);
                        }} />
                        <Input className="h-7 text-xs" placeholder="None" value={vh.adverseReaction} onChange={e => {
                          const updated = [...form.vaccineHistory]; updated[i] = { ...vh, adverseReaction: e.target.value }; updateForm('vaccineHistory', updated);
                        }} />
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.airConsentGranted} onCheckedChange={v => updateForm('airConsentGranted', !!v)} />
                  <Label className="text-xs">Permission granted to access Australian Immunisation Register (AIR) record</Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleEvaluateRisks} className="gap-2">Evaluate Risks & Continue <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* STEP 2: RISK ASSESSMENT DASHBOARD */}
        {/* ═══════════════════════════════════════════════ */}
        {step === 'risk-assessment' && (
          <div className="space-y-4">
            {/* Risk flags */}
            <div className="space-y-2">
              {riskFlags.map(f => (
                <ClinicalAlert key={f.id} alert={{
                  level: f.level === 'red' ? 'red' : f.level === 'amber' ? 'amber' : 'green',
                  title: f.title,
                  message: f.message,
                  action: f.action,
                  blocksPrescribing: f.blocksConsultation,
                }} />
              ))}
            </div>

            {/* This Person / This Trip / This Time */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">This Person</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>{form.fullName}</strong> ({form.gender}, DOB: {form.dob})</p>
                  {form.medicalConditions.length > 0 && <p className="text-xs text-muted-foreground">Conditions: {form.medicalConditions.map(c => c.replace(/_/g, ' ')).join(', ')}</p>}
                  {form.eggAllergy && <Badge variant="outline" className="text-[10px]">Egg allergy</Badge>}
                  {form.pregnancyCurrent && <Badge variant="destructive" className="text-[10px]">Pregnant</Badge>}
                  {form.currentMedications && <p className="text-xs text-muted-foreground">Meds: {form.currentMedications.substring(0, 100)}</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">This Trip</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  {form.itinerary.map((l, i) => (
                    <p key={i} className="text-xs">{l.destination} ({l.region}) — {l.purpose}{l.ruralTravel ? ' • Rural' : ''}{l.remoteTravel ? ' • Remote' : ''}</p>
                  ))}
                  {duration !== null && <p className="text-xs text-muted-foreground">Duration: {duration} days</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">This Time</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  {daysToDep !== null && (
                    <p className={`text-xs font-semibold ${daysToDep < 14 ? 'text-destructive' : ''}`}>
                      {daysToDep} days until departure
                    </p>
                  )}
                  <a href="https://www.smartraveller.gov.au/" target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><ExternalLink className="h-2.5 w-2.5" />Smartraveller alerts</a>
                  <a href="https://www.who.int/emergencies/disease-outbreak-news" target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><ExternalLink className="h-2.5 w-2.5" />WHO outbreak news</a>
                  <a href="https://wwwnc.cdc.gov/travel/notices" target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><ExternalLink className="h-2.5 w-2.5" />CDC travel notices</a>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={goNext} disabled={blocked}>
                {blocked ? 'Consultation Blocked — Referral Required' : 'Continue to Vaccinations'} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* STEP 3: VACCINATION PLANNING */}
        {/* ═══════════════════════════════════════════════ */}
        {step === 'vaccination' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">The 3Rs — Vaccine Organiser</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(['routine', 'recommended', 'required'] as const).map(cat => {
                  const catVaccines = cat === 'routine'
                    ? ['MMR', 'Tetanus/dTpa', 'Influenza', 'Varicella', 'COVID-19', 'Polio', 'Zoster/Shingles', 'RSV']
                    : cat === 'recommended'
                    ? ['Hep A', 'Hep B', 'Typhoid', 'Japanese Encephalitis', 'Cholera', 'Meningococcal ACWY', 'Rabies', 'Mpox']
                    : ['Yellow Fever', 'Meningococcal ACWY'];
                  const outsideScope = ['Yellow Fever', 'Rabies', 'BCG'];
                  const liveVaccines = ['MMR', 'Varicella', 'Yellow Fever', 'BCG'];

                  return (
                    <div key={cat}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 capitalize">{cat}</p>
                      <div className="space-y-1">
                        {catVaccines.map(vName => {
                          const isOutside = outsideScope.includes(vName);
                          const isLive = liveVaccines.includes(vName);
                          const isContraindicated = isLive && form.medicalConditions.includes('immunocompromise');
                          const existing = plannedVaccines.find(p => p.name === vName);
                          const isSelected = !!existing;

                          return (
                            <div key={vName} className={`flex items-center justify-between rounded-md border px-3 py-2 ${isContraindicated ? 'border-destructive/40 bg-destructive/5' : isOutside ? 'border-amber-500/30 bg-amber-50/30' : ''}`}>
                              <div className="flex items-center gap-2">
                                <Checkbox checked={isSelected} disabled={isContraindicated} onCheckedChange={v => {
                                  if (v) {
                                    setPlannedVaccines(prev => [...prev, { name: vName, category: cat, isLive, outsideScope: isOutside, contraindicated: false }]);
                                  } else {
                                    setPlannedVaccines(prev => prev.filter(p => p.name !== vName));
                                  }
                                }} />
                                <span className="text-sm">{vName}</span>
                                {isLive && <Badge variant="outline" className="text-[9px]">LIVE</Badge>}
                              </div>
                              <div className="flex items-center gap-2">
                                {isOutside && <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600">REFER</Badge>}
                                {isContraindicated && <Badge variant="destructive" className="text-[9px]">CONTRAINDICATED</Badge>}
                                {isSelected && !isOutside && (
                                  <Input type="date" className="h-7 text-xs w-[130px]" placeholder="Date" value={existing?.scheduledDate || ''} onChange={e => {
                                    setPlannedVaccines(prev => prev.map(p => p.name === vName ? { ...p, scheduledDate: e.target.value } : p));
                                  }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* AIR panel */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">AIR & AEFI Reporting</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.airConsentGranted} disabled /><span>AIR consent: {form.airConsentGranted ? 'Obtained' : 'Not obtained'}</span>
                </div>
                <a href="https://www.health.vic.gov.au/immunisation/adverse-events-following-immunisation-reporting" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                  <ExternalLink className="h-2.5 w-2.5" /> SAEFVIC AEFI reporting (Victoria)
                </a>
              </CardContent>
            </Card>

            {daysToDep !== null && daysToDep < 14 && (
              <ClinicalAlert alert={{ level: 'amber', title: 'Late Presenter', message: `Only ${daysToDep} days until departure. Some vaccine courses may not be completable. Note: a single dose of Hep A provides protection even on day of departure. Yellow Fever certificates valid 10 days post-vaccination.` }} />
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={goNext}>Continue to Prescribing <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* STEP 4: PRESCRIBING MODULES */}
        {/* ═══════════════════════════════════════════════ */}
        {step === 'prescribing' && (
          <div className="space-y-4">
            <Tabs value={prescribingTab} onValueChange={v => setPrescribingTab(v as PrescribingModule)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="malaria">Malaria</TabsTrigger>
                <TabsTrigger value="altitude">Altitude</TabsTrigger>
                <TabsTrigger value="travellers-diarrhoea">TD</TabsTrigger>
                <TabsTrigger value="vte">VTE</TabsTrigger>
              </TabsList>

              {/* 4A: Malaria (unchanged structure) */}
              <TabsContent value="malaria" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Malaria Prevention — ABCD Framework</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-muted text-left"><th className="p-2 font-medium">Drug</th><th className="p-2 font-medium">Dose</th><th className="p-2 font-medium">Start Before</th><th className="p-2 font-medium">Continue After</th><th className="p-2 font-medium">Notes</th><th className="p-2"></th></tr></thead>
                        <tbody>
                          {MALARIA_DRUGS.map(d => (
                            <tr key={d.drug} className="border-t">
                              <td className="p-2 font-medium">{d.drug}</td>
                              <td className="p-2 tabular-nums">{d.dose}</td>
                              <td className="p-2 tabular-nums">{d.startBefore}</td>
                              <td className="p-2 tabular-nums">{d.continueAfter}</td>
                              <td className="p-2 text-muted-foreground">{d.keyNotes}</td>
                              <td className="p-2">
                                <Button size="sm" variant="outline" className="h-6 text-[10px]"
                                  onClick={() => { if (!prescribedMeds.includes(d.drug)) setPrescribedMeds(prev => [...prev, `${d.drug} — ${d.dose}`]); }}>
                                  Prescribe
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <p className="text-xs font-semibold">Mosquito Avoidance Counselling</p>
                      {['DEET ≥20% repellent on exposed skin', 'Permethrin-treated clothing & gear', 'Bed nets (insecticide-treated)', 'Cover arms/legs at dusk/dawn', 'Avoid dusk/dawn outdoor exposure'].map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <Checkbox checked={counsellingChecks[`malaria_${item}`] || false} onCheckedChange={v => setCounsellingChecks(prev => ({ ...prev, [`malaria_${item}`]: !!v }))} />
                          <span className="text-xs">{item}</span>
                        </div>
                      ))}
                    </div>
                    <ClinicalAlert alert={{ level: 'amber', title: 'Post-Travel Warning', message: 'Advise patient to seek urgent medical attention for fever during OR after travel — symptoms can appear up to 2 years post-exposure.' }} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 4B: Altitude – Structured */}
              <TabsContent value="altitude" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Altitude Illness (AMS) Prevention</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <ClinicalAlert alert={{ level: 'amber', title: 'Scope Limitation', message: 'Pharmacist can only prescribe for LOW-RISK travellers to elevations ≥2500 m. Moderate/high risk → REFER.' }} />

                    {ALTITUDE_MEDICATIONS.map(med => (
                      <div key={med.id} className={`rounded-lg border p-3 space-y-2 ${selectedMeds[med.id] ? 'border-accent bg-accent/5' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={selectedMeds[med.id] || false} onCheckedChange={v => toggleTravelMed(med, !!v)} />
                            <div>
                              <p className="text-sm font-semibold">{med.drug} <span className="font-normal text-muted-foreground">{med.strength}</span></p>
                              <Badge variant="outline" className="text-[9px] mt-0.5">{med.group}</Badge>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{med.indication}</p>
                        {med.dosingOptions.length > 1 ? (
                          <RadioGroup value={selectedDosing[med.id] || med.dosingOptions[0].value} onValueChange={v => updateTravelMedDosing(med, v)}>
                            {med.dosingOptions.map(opt => (
                              <div key={opt.label} className="flex items-center gap-2">
                                <RadioGroupItem value={opt.value} id={`${med.id}-${opt.label}`} />
                                <Label htmlFor={`${med.id}-${opt.label}`} className="text-xs"><strong>{opt.label}:</strong> {opt.value}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        ) : (
                          <p className="text-xs bg-muted/50 rounded px-2 py-1"><strong>Dosing:</strong> {med.dosingOptions[0]?.value}</p>
                        )}
                        {med.clinicalNotes.length > 0 && (
                          <div className="text-xs space-y-0.5">
                            {med.clinicalNotes.map((n, i) => (
                              <p key={i} className="flex items-start gap-1.5 text-muted-foreground"><Info className="h-3 w-3 mt-0.5 shrink-0 text-accent" />{n}</p>
                            ))}
                          </div>
                        )}
                        {med.contraindications.length > 0 && (
                          <div className="text-xs space-y-0.5">
                            <p className="font-semibold text-destructive">Contraindications:</p>
                            {med.contraindications.map((c, i) => (
                              <p key={i} className="flex items-start gap-1.5 text-destructive"><XCircle className="h-3 w-3 mt-0.5 shrink-0" />{c}</p>
                            ))}
                          </div>
                        )}
                        {med.referFlags && med.referFlags.length > 0 && (
                          <div className="text-xs space-y-0.5 rounded bg-destructive/5 p-2 border border-destructive/20">
                            <p className="font-semibold text-destructive">🔴 Refer if:</p>
                            {med.referFlags.map((r, i) => <p key={i} className="text-destructive ml-4">• {r}</p>)}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                      <p className="text-xs font-semibold text-destructive mb-1">⚠ Critical</p>
                      <p className="text-xs">Most important treatment for altitude illness is <strong>DESCENT</strong>. Never ascend with symptoms.</p>
                    </div>

                    <p className="text-xs font-semibold">HACE/HAPE Warning Signs Counselling</p>
                    {['Severe headache unresponsive to analgesics', 'Ataxia or confusion (HACE)', 'Persistent cough, breathlessness at rest, pink frothy sputum (HAPE)', 'Descend immediately if symptoms worsen'].map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <Checkbox checked={counsellingChecks[`altitude_${item}`] || false} onCheckedChange={v => setCounsellingChecks(prev => ({ ...prev, [`altitude_${item}`]: !!v }))} />
                        <span className="text-xs">{item}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 4C: Travellers' Diarrhoea – Structured */}
              <TabsContent value="travellers-diarrhoea" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Travellers' Diarrhoea — Structured Prescribing</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {TD_MEDICATIONS.map(med => (
                      <div key={med.id} className={`rounded-lg border p-3 space-y-2 ${selectedMeds[med.id] ? 'border-accent bg-accent/5' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={selectedMeds[med.id] || false} onCheckedChange={v => toggleTravelMed(med, !!v)} />
                            <div>
                              <p className="text-sm font-semibold">{med.drug} <span className="font-normal text-muted-foreground">{med.strength}</span></p>
                              <Badge variant="outline" className="text-[9px] mt-0.5">{med.group}</Badge>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{med.indication}</p>
                        {med.dosingOptions.length > 1 ? (
                          <RadioGroup value={selectedDosing[med.id] || med.dosingOptions[0].value} onValueChange={v => updateTravelMedDosing(med, v)}>
                            {med.dosingOptions.map(opt => (
                              <div key={opt.label} className="flex items-center gap-2">
                                <RadioGroupItem value={opt.value} id={`${med.id}-${opt.label}`} />
                                <Label htmlFor={`${med.id}-${opt.label}`} className="text-xs"><strong>{opt.label}:</strong> {opt.value}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        ) : (
                          <p className="text-xs bg-muted/50 rounded px-2 py-1"><strong>Dosing:</strong> {med.dosingOptions[0]?.value}</p>
                        )}
                        {med.clinicalNotes.length > 0 && (
                          <div className="text-xs space-y-0.5">
                            {med.clinicalNotes.map((n, i) => (
                              <p key={i} className="flex items-start gap-1.5 text-muted-foreground"><Info className="h-3 w-3 mt-0.5 shrink-0 text-accent" />{n}</p>
                            ))}
                          </div>
                        )}
                        {med.contraindications.length > 0 && (
                          <div className="text-xs space-y-0.5">
                            <p className="font-semibold text-destructive">Contraindications / Warnings:</p>
                            {med.contraindications.map((c, i) => (
                              <p key={i} className="flex items-start gap-1.5 text-destructive"><XCircle className="h-3 w-3 mt-0.5 shrink-0" />{c}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <p className="text-xs font-semibold">Prevention Counselling</p>
                    {['"Peel it, boil it, cook it — or forget it"', 'Hand hygiene (soap/sanitiser)', 'Avoid ice, tap water, raw foods', 'Avoid peeled fruit from street stalls'].map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <Checkbox checked={counsellingChecks[`td_${item}`] || false} onCheckedChange={v => setCounsellingChecks(prev => ({ ...prev, [`td_${item}`]: !!v }))} />
                        <span className="text-xs">{item}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 4D: VTE – Counselling Only */}
              <TabsContent value="vte" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">VTE Prevention — Counselling Only</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs font-semibold">Non-Pharmacological Advice (all flights &gt;4 hours)</p>
                    {VTE_COUNSELLING_ITEMS.map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <Checkbox checked={counsellingChecks[`vte_${item}`] || false} onCheckedChange={v => setCounsellingChecks(prev => ({ ...prev, [`vte_${item}`]: !!v }))} />
                        <span className="text-xs">{item}</span>
                      </div>
                    ))}

                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                      <p className="text-xs font-semibold text-destructive">{VTE_REFER_NOTE}</p>
                    </div>

                    <a href="https://www.mdcalc.com/calc/2023/padua-prediction-score-risk-vte" target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">
                      <ExternalLink className="h-2.5 w-2.5" /> Padua Prediction Score Calculator
                    </a>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Travel Vaccinations sub-module */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Syringe className="h-4 w-4" /> Travel Vaccinations</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 space-y-1">
                  <p className="text-xs font-semibold flex items-center gap-1"><Info className="h-3 w-3" /> Scheduling Rules</p>
                  {VACCINE_SCHEDULING_RULES.map((r, i) => <p key={i} className="text-xs text-muted-foreground ml-4">• {r}</p>)}
                </div>

                {TRAVEL_VACCINES.map(vax => {
                  const sel = vaccineSelections[vax.id] || { selected: false, date: '', note: '' };
                  return (
                    <div key={vax.id} className={`rounded-lg border p-3 space-y-2 ${sel.selected ? 'border-accent bg-accent/5' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={sel.selected} onCheckedChange={v => setVaccineSelections(prev => ({ ...prev, [vax.id]: { ...sel, selected: !!v } }))} />
                          <span className="text-sm font-medium">{vax.name}</span>
                          <Badge variant="outline" className="text-[9px]">{vax.type === 'live' ? 'LIVE' : 'INACTIVATED'}</Badge>
                        </div>
                        {sel.selected && (
                          <Input type="date" className="h-7 text-xs w-[130px]" value={sel.date} onChange={e => setVaccineSelections(prev => ({ ...prev, [vax.id]: { ...sel, date: e.target.value } }))} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{vax.notes}</p>
                      {sel.selected && (
                        <Input className="h-7 text-xs" placeholder="Additional notes…" value={sel.note} onChange={e => setVaccineSelections(prev => ({ ...prev, [vax.id]: { ...sel, note: e.target.value } }))} />
                      )}
                    </div>
                  );
                })}

                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-0.5">
                  <p className="text-xs font-semibold text-destructive">🔴 Refer for:</p>
                  {VACCINE_REFER_FLAGS.map((f, i) => <p key={i} className="text-xs text-destructive ml-4">• {f}</p>)}
                </div>
              </CardContent>
            </Card>

            {/* Prescribed meds summary */}
            {prescribedMeds.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Prescribed Medications</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {prescribedMeds.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{m}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPrescribedMeds(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={goNext}>Continue to Medical Kit <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* STEP 5: MEDICAL KIT BUILDER */}
        {/* ═══════════════════════════════════════════════ */}
        {step === 'medical-kit' && (
          <div className="space-y-4">
            {generateKit().map(section => (
              <Card key={section.title}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{section.title}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    {section.items.map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <Checkbox checked={counsellingChecks[`kit_${item}`] || false} onCheckedChange={v => setCounsellingChecks(prev => ({ ...prev, [`kit_${item}`]: !!v }))} />
                        <span className="text-xs">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <ClinicalAlert alert={{ level: 'amber', title: 'Restricted Medications', message: 'Check with the embassy or consulate of your destination country before travelling with restricted medications (narcotics, psychotropics, pseudoephedrine, codeine). Japan has strict restrictions on many common medications.' }} />

            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={goNext}>Continue to Documentation <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* STEP 6: DOCUMENTATION */}
        {/* ═══════════════════════════════════════════════ */}
        {step === 'documentation' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Pharmacist Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Pharmacist Name</Label><Input value={pharmacistName} onChange={e => setPharmacistName(e.target.value)} placeholder="Full name" /></div>
                <div><Label className="text-xs">Credentials</Label><Input value={pharmacistCredentials} onChange={e => setPharmacistCredentials(e.target.value)} placeholder="e.g. BPharm, GradCertClinPharm" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Consultation Record</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-[11px] whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed bg-muted/30 rounded-lg p-4 max-h-[400px] overflow-auto">{generateSummary()}</pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Pharmacist Travel Letter</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-[11px] whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed bg-muted/30 rounded-lg p-4">{generateTravelLetter()}</pre>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button variant="outline" onClick={() => alert('PDF export (demo)')}><FileText className="mr-2 h-4 w-4" /> Export PDF</Button>
              <Button variant="outline" onClick={() => alert('GP notification (demo)')}><ExternalLink className="mr-2 h-4 w-4" /> Notify GP</Button>
              <Button onClick={goNext}>Continue to Follow-up <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* STEP 7: FOLLOW-UP */}
        {/* ═══════════════════════════════════════════════ */}
        {step === 'follow-up' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Follow-up & Recall</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {plannedVaccines.filter(v => !v.outsideScope && !v.contraindicated).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Outstanding Vaccine Doses</p>
                    {plannedVaccines.filter(v => !v.outsideScope && !v.contraindicated).map(v => (
                      <div key={v.name} className="flex items-center justify-between rounded-md border px-3 py-2 mb-1">
                        <span className="text-sm">{v.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{v.scheduledDate || 'Date TBD'}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Post-Travel Follow-up</p>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <p>Auto-send reminder <strong>2 weeks after return date</strong>:</p>
                    <p className="text-muted-foreground italic">"Welcome home! If you have any symptoms including fever, diarrhoea, rash or fatigue, please contact us or your GP and mention your recent travel."</p>
                  </div>
                </div>

                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Reporting Confirmations</p>
                  <div className="flex items-center gap-2"><Checkbox checked={counsellingChecks['air_reported'] || false} onCheckedChange={v => setCounsellingChecks(prev => ({ ...prev, air_reported: !!v }))} /><span className="text-xs">AIR reporting completed for all vaccines administered</span></div>
                  <div className="flex items-center gap-2"><Checkbox checked={counsellingChecks['saefvic_nil'] || false} onCheckedChange={v => setCounsellingChecks(prev => ({ ...prev, saefvic_nil: !!v }))} /><span className="text-xs">No AEFI observed — or SAEFVIC report submitted</span></div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={() => alert('Consultation finalised (demo)')}>Finalise Consultation <CheckCircle className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* Footer disclaimer */}
        <div className="text-[10px] text-muted-foreground border-t pt-3 space-y-0.5">
          <p className="font-medium">Clinical disclaimer</p>
          <p>This travel health module is a clinical decision support tool aligned with the Australian Immunisation Handbook, eTG, and Victorian pharmacist prescriber scope. All decisions must be verified independently. This tool does not replace specialist travel medicine consultation.</p>
        </div>
      </div>
    </ClinicalLayout>
    <SketchPad open={showSketchPad} onOpenChange={setShowSketchPad} />
    </>
  );
}
