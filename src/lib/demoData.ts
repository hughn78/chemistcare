/** Demo data seed for investor demos.
 * Call seedDemoData() to populate localStorage with realistic
 * mock data. All data is synthetic and clearly labeled as DEMO.
 */

export interface DemoPatient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  medicare: string;
  gender: string;
  allergies: string[];
  conditions: string[];
}

export interface DemoConsultation {
  id: string;
  patientId: string;
  patientName: string;
  condition: string;
  status: 'completed' | 'in-progress' | 'draft';
  date: string;
  medications: string[];
  notes: string;
  durationMinutes: number;
}

export interface DemoMetrics {
  todayConsults: number;
  activePatients: number;
  pendingFollowups: number;
  scriptsThisMonth: number;
  trendUp: number;
}

const DEMO_FLAG_KEY = 'chemistcare_demo_mode';
const DEMO_PATIENTS_KEY = 'chemistcare_demo_patients';
const DEMO_CONSULTS_KEY = 'chemistcare_demo_consults';
const DEMO_METRICS_KEY = 'chemistcare_demo_metrics';

const demoPatients: DemoPatient[] = [
  {
    id: 'demo-pat-001',
    firstName: 'Sarah',
    lastName: 'Chen',
    dob: '1985-03-12',
    phone: '0412 345 678',
    email: 'sarah.chen@email.com',
    medicare: '12345678901',
    gender: 'Female',
    allergies: ['Penicillin'],
    conditions: ['Asthma', 'Hypertension'],
  },
  {
    id: 'demo-pat-002',
    firstName: 'James',
    lastName: 'Martinez',
    dob: '1992-07-24',
    phone: '0423 456 789',
    email: 'j.martinez@email.com',
    medicare: '23456789012',
    gender: 'Male',
    allergies: [],
    conditions: ['Type 2 Diabetes'],
  },
  {
    id: 'demo-pat-003',
    firstName: 'Emily',
    lastName: 'Thompson',
    dob: '1978-11-05',
    phone: '0434 567 890',
    email: 'emily.t@email.com',
    medicare: '34567890123',
    gender: 'Female',
    allergies: ['Sulfa drugs'],
    conditions: ['Hypothyroidism'],
  },
  {
    id: 'demo-pat-004',
    firstName: 'Michael',
    lastName: 'Park',
    dob: '1990-01-18',
    phone: '0445 678 901',
    email: 'm.park@email.com',
    medicare: '45678901234',
    gender: 'Male',
    allergies: [],
    conditions: ['GORD', 'Seasonal Rhinitis'],
  },
  {
    id: 'demo-pat-005',
    firstName: 'Olivia',
    lastName: 'Nguyen',
    dob: '1988-09-30',
    phone: '0456 789 012',
    email: 'olivia.n@email.com',
    medicare: '56789012345',
    gender: 'Female',
    allergies: ['Shellfish'],
    conditions: ['UTI history'],
  },
];

const demoConsultations: DemoConsultation[] = [
  {
    id: 'demo-consult-001',
    patientId: 'demo-pat-005',
    patientName: 'Olivia Nguyen',
    condition: 'Uncomplicated UTI',
    status: 'completed',
    date: new Date().toISOString(),
    medications: ['Cefalexin 500mg capsules, 21 caps — take 1 cap BD for 7 days'],
    notes: 'Patient presented with dysuria and urgency. No fever or flank pain. Urine dipstick positive for nitrites and leukocytes. No allergies to cephalexin. BP 118/76. Suitable for community pharmacy prescribing under 8CPA. Safety checklist completed. Patient counselled on hydration and follow-up if symptoms persist.',
    durationMinutes: 18,
  },
  {
    id: 'demo-consult-002',
    patientId: 'demo-pat-004',
    patientName: 'Michael Park',
    condition: 'GORD — Reflux Resupply',
    status: 'completed',
    date: new Date(Date.now() - 86400000).toISOString(), // yesterday
    medications: ['Esomeprazole 20mg gastro-resistant tablets, 30 tabs — take 1 tablet daily before breakfast'],
    notes: 'Repeat prescription for established GORD. Patient stable on current therapy. No alarm symptoms (dysphagia, odynophagia, weight loss, melena). Last PPI filled 75 days ago — compliant with therapy. BP 124/78. Referred to GP if new symptoms develop.',
    durationMinutes: 12,
  },
  {
    id: 'demo-consult-003',
    patientId: 'demo-pat-001',
    patientName: 'Sarah Chen',
    condition: 'Seasonal Allergic Rhinitis',
    status: 'in-progress',
    date: new Date().toISOString(),
    medications: [],
    notes: 'Reviewing symptoms and eligibility for intranasal corticosteroid supply.',
    durationMinutes: 0,
  },
];

const demoMetrics: DemoMetrics = {
  todayConsults: 3,
  activePatients: 5,
  pendingFollowups: 2,
  scriptsThisMonth: 47,
  trendUp: 12, // +12% vs last month
};

export function seedDemoData(): boolean {
  try {
    localStorage.setItem(DEMO_FLAG_KEY, 'true');
    localStorage.setItem(DEMO_PATIENTS_KEY, JSON.stringify(demoPatients));
    localStorage.setItem(DEMO_CONSULTS_KEY, JSON.stringify(demoConsultations));
    localStorage.setItem(DEMO_METRICS_KEY, JSON.stringify(demoMetrics));
    return true;
  } catch {
    return false;
  }
}

export function clearDemoData(): void {
  try {
    localStorage.removeItem(DEMO_FLAG_KEY);
    localStorage.removeItem(DEMO_PATIENTS_KEY);
    localStorage.removeItem(DEMO_CONSULTS_KEY);
    localStorage.removeItem(DEMO_METRICS_KEY);
  } catch {
    // ignore
  }
}

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function getDemoMetrics(): DemoMetrics | null {
  try {
    const raw = localStorage.getItem(DEMO_METRICS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoMetrics;
  } catch {
    return null;
  }
}

export function getDemoPatients(): DemoPatient[] {
  try {
    const raw = localStorage.getItem(DEMO_PATIENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DemoPatient[];
  } catch {
    return [];
  }
}

export function getDemoConsultations(): DemoConsultation[] {
  try {
    const raw = localStorage.getItem(DEMO_CONSULTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DemoConsultation[];
  } catch {
    return [];
  }
}
