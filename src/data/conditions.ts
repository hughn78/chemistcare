import { Condition } from '@/types/clinical';
import { utiProtocol } from '@/clinical/protocols/uti';

export const CONDITIONS: Condition[] = [
  {
    id: 'uti',
    name: 'Uncomplicated UTI',
    classification: 'acute',
    description: 'Uncomplicated lower urinary tract infection in non-pregnant women aged 18–65',
    scopeValidation: {
      minAge: 18,
      maxAge: 65,
      sexRestriction: 'female',
      pregnancyExcluded: true,
      breastfeedingExcluded: false,
      jurisdictionNotes: 'Victorian Community Pharmacist Prescriber program',
    },
    /**
     * UTI clinical content is OWNED by the canonical Victorian protocol
     * (src/clinical/protocols/uti.ts) and derived from it here so the same
     * fact cannot be represented twice with different values.
     *
     * Previously this block listed Trimethoprim first-line and Nitrofurantoin
     * second-line with "eGFR <30" — both contradicted the official protocol
     * and a third copy in types/protocols.ts.
     */
    canonicalProtocolId: utiProtocol.id,
    redFlags: utiProtocol.redFlags.map(f => ({
      id: `uti-rf-${f.id}`,
      description: f.label,
      action:
        f.outcome === 'emergency_department'
          ? ('urgent_referral' as const)
          : f.prescribingBlocked
            ? ('block_prescribing' as const)
            : ('referral_required' as const),
    })),
    exclusionCriteria: [
      { id: 'uti-ex1', description: 'Male patient', type: 'sex' },
      { id: 'uti-ex2', description: 'Pregnant or possibly pregnant', type: 'pregnancy' },
      { id: 'uti-ex3', description: 'Age <18 or >65', type: 'age' },
      { id: 'uti-ex4', description: 'Known urinary tract abnormality', type: 'comorbidity' },
      { id: 'uti-ex5', description: 'Indwelling catheter', type: 'other' },
    ],
    assessmentFields: ['Dysuria', 'Frequency', 'Urgency', 'Suprapubic pain', 'Duration of symptoms', 'Previous UTI history', 'Last menstrual period', 'Vaginal discharge'],
    therapyOptions: utiProtocol.medicines.map(m => ({
      id: `uti-t-${m.id}`,
      medicineName: m.medicineName,
      dose: m.dose,
      frequency: m.frequency,
      duration: m.duration,
      maxQuantity: m.quantity ?? 0,
      repeats: m.repeats ?? 0,
      // The Victorian program page states program medicines are not subsidised
      // under the PBS and the patient pays the full medication cost.
      pbsRestriction: 'Not PBS-subsidised under the Community Pharmacist Program — patient pays full cost',
      authorityRequired: false,
      line: m.line === 1 ? ('first' as const) : m.line === 2 ? ('second' as const) : ('third' as const),
      contraindications: m.contraindications,
      interactions: m.interactionFlags ?? [],
      monitoringRequired: 'Symptoms should respond within 48 hours of antibiotic treatment',
      specialPopulations: m.id === 'nitrofurantoin'
        ? 'Avoid in breastfeeding if the infant is under one month or has G6PD deficiency'
        : undefined,
    })),
    guidelineReference:
      'Victorian Department of Health, Protocol for Management of Urinary Tract Infections, ' +
      'Community Pharmacist Program (January 2026; updated 4 February 2026)',
    followUpInterval: '48 hours if no improvement; review if symptoms persist 48–72 hours after completing treatment',
  },
  {
    id: 'ocp-resupply',
    name: 'OCP Resupply + Hormonal Contraception',
    classification: 'resupply',
    description: 'Continued supply of oral contraceptive pill for women with established therapy',
    scopeValidation: {
      minAge: 16, sexRestriction: 'female', pregnancyExcluded: true, breastfeedingExcluded: false,
      jurisdictionNotes: 'Must have been on same OCP for ≥6 months with no change in health status',
    },
    redFlags: [
      { id: 'ocp-rf1', description: 'New onset severe headache or migraine with aura', action: 'urgent_referral' },
      { id: 'ocp-rf2', description: 'Calf pain, swelling, or signs of DVT', action: 'urgent_referral' },
      { id: 'ocp-rf3', description: 'Chest pain or shortness of breath', action: 'urgent_referral' },
      { id: 'ocp-rf4', description: 'Significant BP elevation (>140/90)', action: 'referral_required' },
      { id: 'ocp-rf5', description: 'New diagnosis of breast cancer or BRCA+', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'ocp-ex1', description: 'New to OCP (not established therapy)', type: 'other' },
      { id: 'ocp-ex2', description: 'Change in health status since last GP review', type: 'comorbidity' },
      { id: 'ocp-ex3', description: 'Not reviewed by GP in past 12 months', type: 'other' },
      { id: 'ocp-ex4', description: 'Pregnant', type: 'pregnancy' },
    ],
    assessmentFields: ['Current OCP name & strength', 'Duration on current OCP', 'Last GP review date', 'Blood pressure', 'Smoking status', 'BMI', 'Any new medications', 'Breakthrough bleeding'],
    therapyOptions: [
      {
        id: 'ocp-t1', medicineName: 'Continue current OCP', dose: 'As per current prescription', frequency: 'As directed', duration: 'Up to 6 months supply',
        maxQuantity: 6, repeats: 0, authorityRequired: false,
        line: 'first', contraindications: ['History of VTE', 'Active liver disease', 'Migraine with aura'],
        interactions: ['Rifampicin', 'Carbamazepine', 'St Johns Wort', 'Phenytoin'],
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Sexual & Reproductive Health',
    followUpInterval: '12 months – refer to GP for comprehensive review',
  },
  {
    id: 'herpes-zoster',
    name: 'Herpes Zoster',
    classification: 'acute',
    description: 'Shingles – reactivation of varicella-zoster virus presenting as unilateral dermatomal vesicular rash',
    scopeValidation: {
      minAge: 18, pregnancyExcluded: true, breastfeedingExcluded: true,
      temporalConstraint: 'Must present within 72 hours of rash onset for antiviral benefit',
    },
    redFlags: [
      { id: 'hz-rf1', description: 'Ophthalmic involvement (forehead, nose tip – Hutchinson sign)', action: 'urgent_referral' },
      { id: 'hz-rf2', description: 'Immunocompromised patient', action: 'urgent_referral' },
      { id: 'hz-rf3', description: 'Disseminated rash (>2 dermatomes)', action: 'urgent_referral' },
      { id: 'hz-rf4', description: 'Ramsay Hunt syndrome (ear involvement, facial palsy)', action: 'urgent_referral' },
      { id: 'hz-rf5', description: 'Neurological complications', action: 'urgent_referral' },
    ],
    exclusionCriteria: [
      { id: 'hz-ex1', description: 'Rash onset >72 hours ago', type: 'temporal' },
      { id: 'hz-ex2', description: 'Pregnant or breastfeeding', type: 'pregnancy' },
      { id: 'hz-ex3', description: 'Age <18', type: 'age' },
    ],
    assessmentFields: ['Rash onset date/time', 'Dermatomal distribution', 'Pain severity (0-10)', 'Vesicle stage', 'Fever', 'Prior varicella/zoster history', 'Vaccination status'],
    therapyOptions: [
      {
        id: 'hz-t1', medicineName: 'Valaciclovir', dose: '1000mg', frequency: 'Three times daily', duration: '7 days',
        maxQuantity: 21, repeats: 0, pbsRestriction: 'Authority required', authorityRequired: true,
        line: 'first', contraindications: ['Valaciclovir/aciclovir allergy'], interactions: ['Nephrotoxic drugs'],
        specialPopulations: 'Dose adjustment if eGFR <30', monitoringRequired: 'Renal function if elderly',
      },
      {
        id: 'hz-t2', medicineName: 'Famciclovir', dose: '500mg', frequency: 'Three times daily', duration: '7 days',
        maxQuantity: 21, repeats: 0, pbsRestriction: 'Authority required', authorityRequired: true,
        line: 'second', contraindications: ['Famciclovir allergy'], interactions: ['Probenecid'],
        specialPopulations: 'Dose adjustment if eGFR <40',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Antibiotic – Herpes zoster',
    followUpInterval: '7 days for treatment response; ongoing for post-herpetic neuralgia risk',
  },
  {
    id: 'hypertension',
    name: 'Hypertension',
    classification: 'chronic',
    description: 'Management of essential hypertension in adults',
    scopeValidation: { minAge: 18, pregnancyExcluded: true, breastfeedingExcluded: true },
    redFlags: [
      { id: 'htn-rf1', description: 'BP >180/120 – hypertensive urgency/emergency', action: 'urgent_referral' },
      { id: 'htn-rf2', description: 'Signs of end-organ damage', action: 'urgent_referral' },
      { id: 'htn-rf3', description: 'Secondary hypertension suspected', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'htn-ex1', description: 'Pregnant or planning pregnancy', type: 'pregnancy' },
      { id: 'htn-ex2', description: 'Age <18', type: 'age' },
    ],
    assessmentFields: ['BP reading (seated, both arms)', 'Home BP readings', 'CVD risk assessment', 'Smoking status', 'Diabetes status', 'Kidney function', 'Lipid profile', 'BMI', 'Family history'],
    therapyOptions: [
      {
        id: 'htn-t1', medicineName: 'Perindopril', dose: '4–8mg', frequency: 'Once daily', duration: 'Ongoing',
        maxQuantity: 30, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Bilateral renal artery stenosis', 'Angioedema history', 'Hyperkalaemia'],
        interactions: ['NSAIDs', 'Potassium-sparing diuretics', 'Lithium'], monitoringRequired: 'Renal function + K+ at 1–2 weeks',
      },
      {
        id: 'htn-t2', medicineName: 'Amlodipine', dose: '5–10mg', frequency: 'Once daily', duration: 'Ongoing',
        maxQuantity: 30, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Severe aortic stenosis'], interactions: ['Simvastatin >20mg'],
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Cardiovascular – Hypertension',
    followUpInterval: '2–4 weeks initially, then 3–6 monthly once stable',
    monitoringChecklist: ['Blood pressure', 'Renal function', 'Electrolytes', 'CVD risk reassessment'],
  },
  {
    id: 't2dm',
    name: 'Type 2 Diabetes',
    classification: 'chronic',
    description: 'Management of type 2 diabetes mellitus in adults',
    scopeValidation: { minAge: 18, pregnancyExcluded: true, breastfeedingExcluded: true },
    redFlags: [
      { id: 't2d-rf1', description: 'HbA1c >10% or symptomatic hyperglycaemia', action: 'referral_required' },
      { id: 't2d-rf2', description: 'DKA or HHS features', action: 'urgent_referral' },
      { id: 't2d-rf3', description: 'Active foot ulcer or infection', action: 'urgent_referral' },
    ],
    exclusionCriteria: [
      { id: 't2d-ex1', description: 'Type 1 diabetes', type: 'comorbidity' },
      { id: 't2d-ex2', description: 'Pregnant', type: 'pregnancy' },
    ],
    assessmentFields: ['HbA1c', 'Fasting glucose', 'BMI', 'Renal function', 'Lipid profile', 'BP', 'Foot examination', 'Eye review date', 'Smoking status'],
    therapyOptions: [
      {
        id: 't2d-t1', medicineName: 'Metformin', dose: '500–2000mg', frequency: 'Twice daily with meals', duration: 'Ongoing',
        maxQuantity: 60, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['eGFR <30', 'Metabolic acidosis'], interactions: ['Contrast media', 'Alcohol excess'],
        monitoringRequired: 'Renal function 3–6 monthly, HbA1c 3 monthly initially',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Endocrinology – Type 2 diabetes',
    followUpInterval: '3 months initially, then 3–6 monthly',
    monitoringChecklist: ['HbA1c', 'Renal function', 'Lipids', 'Blood pressure', 'Weight', 'Foot check'],
  },
  // ── Acute Nausea and Vomiting ──
  {
    id: 'nausea',
    name: 'Acute Nausea and Vomiting',
    classification: 'acute',
    description: 'Short-term management of acute nausea and vomiting in adults',
    scopeValidation: { minAge: 18, pregnancyExcluded: true, breastfeedingExcluded: true },
    redFlags: [
      { id: 'nv-rf1', description: 'Projectile vomiting or severe abdominal pain', action: 'urgent_referral' },
      { id: 'nv-rf2', description: 'Signs of dehydration (oliguria, tachycardia, hypotension)', action: 'urgent_referral' },
      { id: 'nv-rf3', description: 'Blood in vomitus (haematemesis)', action: 'urgent_referral' },
      { id: 'nv-rf4', description: 'Head injury or neurological symptoms', action: 'urgent_referral' },
      { id: 'nv-rf5', description: 'Duration >48 hours without improvement', action: 'referral_required' },
      { id: 'nv-rf6', description: 'Possible pregnancy', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'nv-ex1', description: 'Pregnant or possibly pregnant', type: 'pregnancy' },
      { id: 'nv-ex2', description: 'Age <18', type: 'age' },
      { id: 'nv-ex3', description: 'Suspected bowel obstruction', type: 'comorbidity' },
      { id: 'nv-ex4', description: 'Chemotherapy-induced nausea (specialist management)', type: 'other' },
    ],
    assessmentFields: ['Onset & duration', 'Frequency of vomiting', 'Associated diarrhoea', 'Abdominal pain location', 'Hydration status', 'Recent food/travel exposure', 'Current medications', 'Last menstrual period'],
    therapyOptions: [
      {
        id: 'nv-t1', medicineName: 'Metoclopramide', dose: '10mg', frequency: 'Three times daily (before meals)', duration: '3 days max',
        maxQuantity: 9, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Bowel obstruction', 'Phaeochromocytoma', 'Epilepsy', 'Parkinsons disease'],
        interactions: ['Antipsychotics', 'SSRIs (serotonin syndrome risk)'],
        specialPopulations: 'Max 5 days use; risk of tardive dyskinesia with prolonged use', monitoringRequired: 'Review at 48hrs if not improving',
      },
      {
        id: 'nv-t2', medicineName: 'Ondansetron', dose: '4–8mg', frequency: 'Every 8 hours as needed', duration: '3 days max',
        maxQuantity: 9, repeats: 0, authorityRequired: false, line: 'second',
        contraindications: ['Congenital long QT syndrome', 'Ondansetron allergy'],
        interactions: ['QT-prolonging drugs', 'Apomorphine'],
        monitoringRequired: 'ECG if cardiac history',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Gastrointestinal – Nausea and vomiting',
    followUpInterval: '48 hours if no improvement',
  },
  // ── Allergic and Non-allergic Rhinitis ──
  {
    id: 'rhinitis',
    name: 'Allergic and Non-allergic Rhinitis',
    classification: 'chronic',
    description: 'Management of allergic and non-allergic rhinitis in adults and adolescents',
    scopeValidation: { minAge: 12, pregnancyExcluded: false, breastfeedingExcluded: false, jurisdictionNotes: 'Intranasal corticosteroids are first-line per TG' },
    redFlags: [
      { id: 'rh-rf1', description: 'Unilateral nasal obstruction or bloodstained discharge', action: 'urgent_referral' },
      { id: 'rh-rf2', description: 'Recurrent epistaxis (non-minor)', action: 'referral_required' },
      { id: 'rh-rf3', description: 'Suspected nasal polyps or structural abnormality', action: 'referral_required' },
      { id: 'rh-rf4', description: 'Symptoms suggestive of sinusitis >10 days', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'rh-ex1', description: 'Age <12', type: 'age' },
      { id: 'rh-ex2', description: 'Recent nasal surgery or trauma', type: 'other' },
    ],
    assessmentFields: ['Symptom pattern (seasonal vs perennial)', 'Nasal obstruction severity', 'Rhinorrhoea (anterior/posterior)', 'Sneezing frequency', 'Eye symptoms', 'Impact on sleep/QoL', 'Known triggers', 'Previous treatments tried'],
    therapyOptions: [
      {
        id: 'rh-t1', medicineName: 'Mometasone nasal spray', dose: '2 sprays each nostril', frequency: 'Once daily', duration: 'Ongoing during symptomatic period',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Untreated nasal infection', 'Recent nasal surgery'],
        interactions: [], specialPopulations: 'Safe in pregnancy (Category B3)',
        monitoringRequired: 'Review efficacy at 2–4 weeks',
      },
      {
        id: 'rh-t2', medicineName: 'Cetirizine', dose: '10mg', frequency: 'Once daily', duration: 'As needed',
        maxQuantity: 30, repeats: 2, authorityRequired: false, line: 'second',
        contraindications: ['Severe renal impairment without dose adjustment'],
        interactions: ['CNS depressants', 'Alcohol'],
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Respiratory – Rhinitis',
    followUpInterval: '2–4 weeks for treatment response assessment',
  },
  // ── Asthma & Exercise-induced Bronchoconstriction ──
  {
    id: 'asthma',
    name: 'Asthma & Exercise-induced Bronchoconstriction',
    classification: 'chronic',
    description: 'Stepwise asthma management and exercise-induced bronchoconstriction in adults and adolescents',
    scopeValidation: { minAge: 12, pregnancyExcluded: false, breastfeedingExcluded: false, jurisdictionNotes: 'Pharmacist prescribers may initiate/adjust preventer therapy for mild–moderate asthma' },
    redFlags: [
      { id: 'ast-rf1', description: 'Acute severe exacerbation (unable to speak in sentences, SpO2 <92%)', action: 'urgent_referral' },
      { id: 'ast-rf2', description: 'Life-threatening features (cyanosis, silent chest, confusion)', action: 'urgent_referral' },
      { id: 'ast-rf3', description: 'Previous ICU admission for asthma', action: 'referral_required' },
      { id: 'ast-rf4', description: 'Frequent exacerbations (≥2 requiring OCS in 12 months)', action: 'referral_required' },
      { id: 'ast-rf5', description: 'Poor response to initial preventer therapy', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'ast-ex1', description: 'Age <12', type: 'age' },
      { id: 'ast-ex2', description: 'Severe or difficult-to-treat asthma', type: 'comorbidity' },
      { id: 'ast-ex3', description: 'Diagnostic uncertainty (no spirometry confirmation)', type: 'other' },
    ],
    assessmentFields: ['Symptom frequency (day/night)', 'Reliever use frequency', 'Exercise limitation', 'Peak flow / spirometry results', 'Current preventer regimen', 'Inhaler technique assessment', 'Trigger identification', 'Smoking status', 'Allergic history'],
    therapyOptions: [
      {
        id: 'ast-t1', medicineName: 'Budesonide/Formoterol (low dose)', dose: '200/6 mcg', frequency: '1 inhalation twice daily + as-needed reliever', duration: 'Ongoing',
        maxQuantity: 1, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Active pulmonary TB', 'Untreated fungal infections'],
        interactions: ['Beta-blockers (non-selective)', 'Strong CYP3A4 inhibitors'],
        monitoringRequired: 'Symptom review + inhaler technique at 4–8 weeks',
      },
      {
        id: 'ast-t2', medicineName: 'Fluticasone propionate (low dose)', dose: '125 mcg', frequency: '2 puffs twice daily', duration: 'Ongoing',
        maxQuantity: 1, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Hypersensitivity to fluticasone'],
        interactions: ['Ritonavir', 'Ketoconazole'],
        monitoringRequired: 'Oral candidiasis screening; rinse mouth after use',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Respiratory – Asthma in adults and adolescents',
    followUpInterval: '4–8 weeks initially, then 3–6 monthly when stable',
    monitoringChecklist: ['Symptom control', 'Reliever use', 'Peak flow trend', 'Inhaler technique', 'Exacerbation history'],
  },
  // ── Atopic Dermatitis ──
  {
    id: 'atopic-dermatitis',
    name: 'Atopic Dermatitis',
    classification: 'chronic',
    description: 'Management of mild-moderate atopic dermatitis/eczema in adults and children',
    scopeValidation: { minAge: 2, pregnancyExcluded: false, breastfeedingExcluded: false },
    redFlags: [
      { id: 'ad-rf1', description: 'Signs of secondary infection (weeping, crusting, pustules)', action: 'referral_required' },
      { id: 'ad-rf2', description: 'Eczema herpeticum (widespread vesicles, systemic illness)', action: 'urgent_referral' },
      { id: 'ad-rf3', description: 'Erythroderma (>90% BSA involvement)', action: 'urgent_referral' },
      { id: 'ad-rf4', description: 'Severe disease unresponsive to topical therapy', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'ad-ex1', description: 'Age <2 (requires paediatric assessment)', type: 'age' },
      { id: 'ad-ex2', description: 'Severe or widespread disease requiring systemic therapy', type: 'comorbidity' },
    ],
    assessmentFields: ['Distribution of lesions', 'Body surface area affected (%)', 'Itch severity (0-10)', 'Sleep disturbance', 'Signs of infection', 'Trigger identification', 'Emollient use', 'Previous topical steroid use', 'Atopic history (asthma, rhinitis)'],
    therapyOptions: [
      {
        id: 'ad-t1', medicineName: 'Methylprednisolone aceponate 0.1% cream', dose: 'Apply thin layer', frequency: 'Once daily to affected areas', duration: '1–2 weeks (body), 5–7 days (face)',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Infected skin', 'Rosacea', 'Perioral dermatitis'],
        interactions: [],
        monitoringRequired: 'Assess for skin atrophy with prolonged use',
      },
      {
        id: 'ad-t2', medicineName: 'Hydrocortisone 1% cream', dose: 'Apply thin layer', frequency: 'Twice daily to affected areas', duration: 'Up to 2 weeks',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Infected skin', 'Rosacea'],
        interactions: [],
        specialPopulations: 'Suitable for facial and intertriginous areas; safe in children ≥2',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Dermatology – Atopic dermatitis',
    followUpInterval: '2–4 weeks for treatment response',
  },
  // ── COPD ──
  {
    id: 'copd',
    name: 'COPD',
    classification: 'chronic',
    description: 'Chronic obstructive pulmonary disease management in adults',
    scopeValidation: { minAge: 40, pregnancyExcluded: true, breastfeedingExcluded: true, jurisdictionNotes: 'Spirometry-confirmed diagnosis required' },
    redFlags: [
      { id: 'copd-rf1', description: 'Acute exacerbation with respiratory failure (SpO2 <88%, severe dyspnoea)', action: 'urgent_referral' },
      { id: 'copd-rf2', description: 'Haemoptysis', action: 'urgent_referral' },
      { id: 'copd-rf3', description: 'Signs of cor pulmonale or right heart failure', action: 'urgent_referral' },
      { id: 'copd-rf4', description: 'Rapid decline in FEV1', action: 'referral_required' },
      { id: 'copd-rf5', description: 'Frequent exacerbations (≥2 per year)', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'copd-ex1', description: 'Age <40 (consider alternative diagnoses)', type: 'age' },
      { id: 'copd-ex2', description: 'No spirometry confirmation', type: 'other' },
      { id: 'copd-ex3', description: 'Severe COPD (GOLD stage III/IV)', type: 'comorbidity' },
    ],
    assessmentFields: ['Spirometry results (FEV1/FVC ratio)', 'FEV1 % predicted', 'mMRC dyspnoea grade', 'Exacerbation frequency', 'CAT score', 'Smoking status & pack-years', 'Oxygen saturation', 'Current inhaler regimen', 'Vaccination status (influenza, pneumococcal)'],
    therapyOptions: [
      {
        id: 'copd-t1', medicineName: 'Tiotropium (Spiriva)', dose: '18mcg', frequency: 'Once daily via HandiHaler', duration: 'Ongoing',
        maxQuantity: 1, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Hypersensitivity to tiotropium or atropine derivatives'],
        interactions: ['Other anticholinergics (additive effects)'],
        monitoringRequired: 'Symptom review + spirometry at 3 months',
      },
      {
        id: 'copd-t2', medicineName: 'Salbutamol MDI', dose: '100mcg per actuation', frequency: '1–2 puffs as needed', duration: 'Ongoing as reliever',
        maxQuantity: 1, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Hypersensitivity to salbutamol'],
        interactions: ['Non-selective beta-blockers'],
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Respiratory – COPD',
    followUpInterval: '4–8 weeks initially, then 3–6 monthly',
    monitoringChecklist: ['Spirometry', 'Symptom scores (CAT/mMRC)', 'Exacerbation rate', 'Inhaler technique', 'Smoking status', 'Vaccination currency'],
  },
  // ── Dyslipidaemia ──
  {
    id: 'dyslipidaemia',
    name: 'Dyslipidaemia',
    classification: 'chronic',
    description: 'Management of elevated cholesterol and triglycerides in adults',
    scopeValidation: { minAge: 18, pregnancyExcluded: true, breastfeedingExcluded: true },
    redFlags: [
      { id: 'dys-rf1', description: 'Suspected familial hypercholesterolaemia (TC >7.5 or LDL >5)', action: 'referral_required' },
      { id: 'dys-rf2', description: 'Triglycerides >10 mmol/L (pancreatitis risk)', action: 'urgent_referral' },
      { id: 'dys-rf3', description: 'Unexplained muscle pain/weakness on statin (rhabdomyolysis risk)', action: 'urgent_referral' },
      { id: 'dys-rf4', description: 'Existing CVD (secondary prevention – GP/specialist management)', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'dys-ex1', description: 'Pregnant or planning pregnancy', type: 'pregnancy' },
      { id: 'dys-ex2', description: 'Active liver disease or unexplained persistent ALT elevation', type: 'comorbidity' },
      { id: 'dys-ex3', description: 'Secondary prevention (existing CVD)', type: 'other' },
    ],
    assessmentFields: ['Fasting lipid panel (TC, LDL, HDL, TG)', 'CVD risk score (Aus CVD risk calculator)', 'Smoking status', 'Blood pressure', 'Diabetes status', 'Family history CVD', 'Liver function (ALT)', 'CK level (baseline)', 'Current medications'],
    therapyOptions: [
      {
        id: 'dys-t1', medicineName: 'Rosuvastatin', dose: '10–20mg', frequency: 'Once daily', duration: 'Ongoing',
        maxQuantity: 30, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Active liver disease', 'Pregnancy', 'Unexplained persistent CK elevation'],
        interactions: ['Cyclosporin', 'Gemfibrozil', 'Warfarin'],
        monitoringRequired: 'LFTs at baseline and 12 weeks; lipids at 6–8 weeks',
      },
      {
        id: 'dys-t2', medicineName: 'Atorvastatin', dose: '10–40mg', frequency: 'Once daily', duration: 'Ongoing',
        maxQuantity: 30, repeats: 5, authorityRequired: false, line: 'first',
        contraindications: ['Active liver disease', 'Pregnancy'],
        interactions: ['CYP3A4 inhibitors', 'Gemfibrozil', 'Macrolide antibiotics'],
        monitoringRequired: 'LFTs at baseline and 12 weeks; lipids at 6–8 weeks',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Cardiovascular – Lipid modification',
    followUpInterval: '6–8 weeks for lipid review, then 6–12 monthly',
    monitoringChecklist: ['Fasting lipids', 'LFTs', 'CK (if symptomatic)', 'CVD risk reassessment', 'Muscle symptoms'],
  },
  // ── Ear Infections (AOE, AOM) ──
  {
    id: 'ear-infections',
    name: 'Ear Infections (AOE, AOM)',
    classification: 'acute',
    description: 'Acute otitis externa and acute otitis media management',
    scopeValidation: { minAge: 2, pregnancyExcluded: false, breastfeedingExcluded: false },
    redFlags: [
      { id: 'ear-rf1', description: 'Mastoid tenderness or swelling (mastoiditis)', action: 'urgent_referral' },
      { id: 'ear-rf2', description: 'Facial nerve palsy', action: 'urgent_referral' },
      { id: 'ear-rf3', description: 'Persistent otorrhoea >2 weeks', action: 'referral_required' },
      { id: 'ear-rf4', description: 'Suspected cholesteatoma', action: 'referral_required' },
      { id: 'ear-rf5', description: 'Age <6 months with AOM', action: 'urgent_referral' },
      { id: 'ear-rf6', description: 'Bilateral AOM in child <2 years', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'ear-ex1', description: 'Age <2 (requires medical assessment)', type: 'age' },
      { id: 'ear-ex2', description: 'Tympanostomy tubes in situ', type: 'comorbidity' },
      { id: 'ear-ex3', description: 'Immunocompromised patient', type: 'comorbidity' },
    ],
    assessmentFields: ['Ear affected (left/right/bilateral)', 'Onset and duration', 'Pain severity (0-10)', 'Discharge present', 'Hearing change', 'Fever', 'Swimming/water exposure history', 'Previous ear infections', 'Otoscopic findings'],
    therapyOptions: [
      {
        id: 'ear-t1', medicineName: 'Ciprofloxacin 0.3%/Dexamethasone 0.1% ear drops (AOE)', dose: '4 drops', frequency: 'Twice daily to affected ear', duration: '7 days',
        maxQuantity: 1, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Perforated tympanic membrane (unless specialist directed)', 'Quinolone allergy'],
        interactions: [],
        monitoringRequired: 'Review at 7 days if not resolving',
      },
      {
        id: 'ear-t2', medicineName: 'Amoxicillin (AOM)', dose: '500mg (adult) or 25mg/kg (child)', frequency: 'Three times daily', duration: '5 days',
        maxQuantity: 15, repeats: 0, pbsRestriction: 'Restricted benefit', authorityRequired: false, line: 'first',
        contraindications: ['Penicillin allergy', 'Infectious mononucleosis'],
        interactions: ['Methotrexate', 'Warfarin'],
        specialPopulations: 'Most AOM resolves without antibiotics; watchful waiting preferred for mild cases in children >2',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Antibiotic – Ear infections',
    followUpInterval: '48–72 hours if no improvement; 2 weeks post-treatment',
  },
  // ── GORD ──
  {
    id: 'gord',
    name: 'GORD',
    classification: 'chronic',
    description: 'Gastro-oesophageal reflux disease management in adults',
    scopeValidation: { minAge: 18, pregnancyExcluded: false, breastfeedingExcluded: false },
    redFlags: [
      { id: 'gord-rf1', description: 'Dysphagia (progressive or persistent)', action: 'urgent_referral' },
      { id: 'gord-rf2', description: 'Unintentional weight loss', action: 'urgent_referral' },
      { id: 'gord-rf3', description: 'GI bleeding (haematemesis or melaena)', action: 'urgent_referral' },
      { id: 'gord-rf4', description: 'New onset >55 years (cancer risk)', action: 'referral_required' },
      { id: 'gord-rf5', description: 'Persistent symptoms despite 8 weeks PPI', action: 'referral_required' },
      { id: 'gord-rf6', description: 'Odynophagia (painful swallowing)', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'gord-ex1', description: 'Alarm features present (dysphagia, weight loss, bleeding)', type: 'comorbidity' },
      { id: 'gord-ex2', description: 'Age <18', type: 'age' },
    ],
    assessmentFields: ['Symptom description (heartburn, regurgitation)', 'Frequency and severity', 'Duration of symptoms', 'Aggravating factors (food, posture)', 'Weight and BMI', 'Medications causing reflux (NSAIDs, CCBs)', 'Previous endoscopy results', 'Alarm symptom screening'],
    therapyOptions: [
      {
        id: 'gord-t1', medicineName: 'Esomeprazole', dose: '20mg', frequency: 'Once daily before breakfast', duration: '4–8 weeks',
        maxQuantity: 30, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['PPI allergy'],
        interactions: ['Clopidogrel (reduced efficacy)', 'Methotrexate', 'Atazanavir'],
        monitoringRequired: 'Review at 4–8 weeks; step down to as-needed if controlled',
      },
      {
        id: 'gord-t2', medicineName: 'Pantoprazole', dose: '40mg', frequency: 'Once daily before breakfast', duration: '4–8 weeks',
        maxQuantity: 30, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['PPI allergy'],
        interactions: ['Methotrexate'],
        specialPopulations: 'Preferred PPI if on clopidogrel (less CYP2C19 interaction)',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Gastrointestinal – GORD',
    followUpInterval: '4–8 weeks; reassess need for ongoing PPI',
  },
  // ── Impetigo ──
  {
    id: 'impetigo',
    name: 'Impetigo',
    classification: 'acute',
    description: 'Management of superficial bacterial skin infection (impetigo) in children and adults',
    scopeValidation: { minAge: 1, pregnancyExcluded: false, breastfeedingExcluded: false },
    redFlags: [
      { id: 'imp-rf1', description: 'Extensive involvement (>5 lesions or >2% BSA)', action: 'referral_required' },
      { id: 'imp-rf2', description: 'Systemic symptoms (fever, lymphadenopathy)', action: 'referral_required' },
      { id: 'imp-rf3', description: 'Periorbital involvement', action: 'urgent_referral' },
      { id: 'imp-rf4', description: 'Suspected MRSA (recurrent, non-responsive)', action: 'referral_required' },
      { id: 'imp-rf5', description: 'Post-streptococcal complications suspected (haematuria, oedema)', action: 'urgent_referral' },
    ],
    exclusionCriteria: [
      { id: 'imp-ex1', description: 'Bullous impetigo in neonates', type: 'age' },
      { id: 'imp-ex2', description: 'Immunocompromised patient', type: 'comorbidity' },
    ],
    assessmentFields: ['Lesion type (crusted/bullous)', 'Number of lesions', 'Location', 'Duration', 'Spread pattern', 'Previous episodes', 'Close contact with infected person', 'Current skin conditions'],
    therapyOptions: [
      {
        id: 'imp-t1', medicineName: 'Mupirocin 2% ointment', dose: 'Apply thin layer', frequency: 'Three times daily', duration: '5–7 days',
        maxQuantity: 1, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Mupirocin allergy'],
        interactions: [],
        monitoringRequired: 'Review at 5–7 days; oral antibiotics if not improving',
      },
      {
        id: 'imp-t2', medicineName: 'Cefalexin', dose: '500mg (adult) or 25mg/kg/day (child)', frequency: 'Twice daily', duration: '5 days',
        maxQuantity: 10, repeats: 0, pbsRestriction: 'Restricted benefit', authorityRequired: false, line: 'second',
        contraindications: ['Cephalosporin allergy', 'Severe penicillin allergy (cross-reactivity)'],
        interactions: ['Probenecid', 'Warfarin'],
        specialPopulations: 'Use for widespread impetigo or failure of topical therapy',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Antibiotic – Skin and soft tissue infections',
    followUpInterval: '5–7 days for treatment response',
  },
  // ── Mild–Moderate Acne ──
  {
    id: 'acne',
    name: 'Mild–Moderate Acne',
    classification: 'chronic',
    description: 'Management of mild to moderate acne vulgaris',
    scopeValidation: { minAge: 12, pregnancyExcluded: true, breastfeedingExcluded: true, jurisdictionNotes: 'Isotretinoin is NOT within pharmacist prescriber scope' },
    redFlags: [
      { id: 'acne-rf1', description: 'Severe nodulocystic acne', action: 'referral_required' },
      { id: 'acne-rf2', description: 'Scarring acne', action: 'referral_required' },
      { id: 'acne-rf3', description: 'Acne fulminans (systemic symptoms)', action: 'urgent_referral' },
      { id: 'acne-rf4', description: 'Signs of hyperandrogenism (hirsutism, irregular menses)', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'acne-ex1', description: 'Pregnant or planning pregnancy (retinoid use)', type: 'pregnancy' },
      { id: 'acne-ex2', description: 'Severe acne requiring isotretinoin', type: 'comorbidity' },
      { id: 'acne-ex3', description: 'Age <12', type: 'age' },
    ],
    assessmentFields: ['Lesion types (comedones, papules, pustules, nodules)', 'Distribution (face, back, chest)', 'Severity grade (mild/moderate)', 'Duration', 'Scarring present', 'Psychosocial impact', 'Menstrual history (females)', 'Previous treatments tried', 'Current skincare routine'],
    therapyOptions: [
      {
        id: 'acne-t1', medicineName: 'Adapalene 0.1% gel', dose: 'Apply pea-sized amount', frequency: 'Once daily at night', duration: '12 weeks minimum',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Pregnancy', 'Eczema at application site'],
        interactions: [],
        monitoringRequired: 'Warn of initial irritation/purging (2–4 weeks); use sunscreen',
      },
      {
        id: 'acne-t2', medicineName: 'Benzoyl peroxide 2.5–5% gel', dose: 'Apply thin layer', frequency: 'Once daily (increase to twice if tolerated)', duration: 'Ongoing',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Benzoyl peroxide allergy'],
        interactions: [],
        specialPopulations: 'Can be combined with adapalene (apply at different times of day)',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Dermatology – Acne vulgaris',
    followUpInterval: '6–8 weeks for initial response; 12 weeks for full assessment',
  },
  // ── Mild Acute Musculoskeletal Pain ──
  {
    id: 'msk-pain',
    name: 'Mild Acute Musculoskeletal Pain',
    classification: 'acute',
    description: 'Short-term management of acute musculoskeletal pain including sprains, strains, and non-specific back pain',
    scopeValidation: { minAge: 16, pregnancyExcluded: true, breastfeedingExcluded: false },
    redFlags: [
      { id: 'msk-rf1', description: 'Suspected fracture or joint dislocation', action: 'urgent_referral' },
      { id: 'msk-rf2', description: 'Cauda equina symptoms (saddle anaesthesia, urinary retention)', action: 'urgent_referral' },
      { id: 'msk-rf3', description: 'History of significant trauma', action: 'referral_required' },
      { id: 'msk-rf4', description: 'Fever or signs of septic arthritis', action: 'urgent_referral' },
      { id: 'msk-rf5', description: 'Unexplained weight loss with back pain', action: 'referral_required' },
      { id: 'msk-rf6', description: 'Progressive neurological deficit', action: 'urgent_referral' },
      { id: 'msk-rf7', description: 'Pain duration >6 weeks', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'msk-ex1', description: 'Age <16', type: 'age' },
      { id: 'msk-ex2', description: 'Pregnant', type: 'pregnancy' },
      { id: 'msk-ex3', description: 'History of GI bleeding or peptic ulcer (for NSAID use)', type: 'comorbidity' },
      { id: 'msk-ex4', description: 'Chronic pain (>3 months)', type: 'other' },
    ],
    assessmentFields: ['Pain location', 'Mechanism of injury', 'Onset (sudden vs gradual)', 'Pain severity (0-10)', 'Functional limitation', 'Neurological symptoms', 'Previous episodes', 'Current analgesia', 'Relevant comorbidities (renal, GI, cardiac)'],
    therapyOptions: [
      {
        id: 'msk-t1', medicineName: 'Ibuprofen', dose: '200–400mg', frequency: 'Three times daily with food', duration: '5–7 days',
        maxQuantity: 21, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Active peptic ulcer', 'Severe renal impairment', 'Heart failure', 'Third trimester pregnancy', 'Aspirin-sensitive asthma'],
        interactions: ['Anticoagulants', 'SSRIs', 'Lithium', 'Methotrexate', 'ACEi/ARB'],
        specialPopulations: 'Use lowest effective dose for shortest duration',
        monitoringRequired: 'GI symptoms; renal function if risk factors',
      },
      {
        id: 'msk-t2', medicineName: 'Paracetamol', dose: '1000mg', frequency: 'Every 4–6 hours (max 4g/day)', duration: '5–7 days',
        maxQuantity: 20, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Severe hepatic impairment', 'Paracetamol allergy'],
        interactions: ['Warfarin (high doses)'],
        specialPopulations: 'Reduce max dose to 2g/day if <50kg, elderly, or hepatic impairment',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Analgesic – Musculoskeletal pain',
    followUpInterval: '7 days if no improvement; immediate if worsening',
  },
  // ── Minor Wound Management ──
  {
    id: 'wound',
    name: 'Minor Wound Management',
    classification: 'acute',
    description: 'Management of minor wounds, abrasions, lacerations, and superficial burns',
    scopeValidation: { minAge: 1, pregnancyExcluded: false, breastfeedingExcluded: false },
    redFlags: [
      { id: 'wnd-rf1', description: 'Deep wound or exposed tendon/bone', action: 'urgent_referral' },
      { id: 'wnd-rf2', description: 'Animal or human bite', action: 'referral_required' },
      { id: 'wnd-rf3', description: 'Signs of wound infection (spreading erythema, purulent discharge)', action: 'referral_required' },
      { id: 'wnd-rf4', description: 'Foreign body suspected', action: 'referral_required' },
      { id: 'wnd-rf5', description: 'Tetanus-prone wound without up-to-date vaccination', action: 'referral_required' },
      { id: 'wnd-rf6', description: 'Full-thickness or extensive burn (>5% BSA)', action: 'urgent_referral' },
    ],
    exclusionCriteria: [
      { id: 'wnd-ex1', description: 'Wound requiring suturing or surgical closure', type: 'other' },
      { id: 'wnd-ex2', description: 'Immunocompromised patient with wound infection', type: 'comorbidity' },
      { id: 'wnd-ex3', description: 'Diabetic foot ulcer', type: 'comorbidity' },
    ],
    assessmentFields: ['Wound type (laceration, abrasion, burn)', 'Location', 'Size and depth', 'Time since injury', 'Contamination level', 'Bleeding controlled', 'Tetanus vaccination status', 'Diabetes or vascular disease', 'Current medications (anticoagulants)'],
    therapyOptions: [
      {
        id: 'wnd-t1', medicineName: 'Chlorhexidine 0.05% wound wash', dose: 'Apply liberally', frequency: 'At initial presentation and dressing changes', duration: 'Until wound clean',
        maxQuantity: 1, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Chlorhexidine allergy'],
        interactions: [],
      },
      {
        id: 'wnd-t2', medicineName: 'Mupirocin 2% ointment (if early infection signs)', dose: 'Apply thin layer', frequency: 'Three times daily', duration: '5–7 days',
        maxQuantity: 1, repeats: 0, authorityRequired: false, line: 'second',
        contraindications: ['Mupirocin allergy'],
        interactions: [],
        monitoringRequired: 'Review at 48 hours; oral antibiotics if cellulitis developing',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Antibiotic – Skin and soft tissue; Wound management guidelines',
    followUpInterval: '48 hours for wound review; 5–7 days for dressing change',
  },
  // ── Oral Health Screening + Fluoride ──
  {
    id: 'oral-health',
    name: 'Oral Health Screening + Fluoride',
    classification: 'preventive',
    description: 'Oral health assessment, caries risk screening, and fluoride application',
    scopeValidation: { minAge: 2, pregnancyExcluded: false, breastfeedingExcluded: false },
    redFlags: [
      { id: 'oh-rf1', description: 'Suspected oral malignancy (non-healing ulcer >3 weeks)', action: 'urgent_referral' },
      { id: 'oh-rf2', description: 'Dental abscess (facial swelling, trismus, fever)', action: 'urgent_referral' },
      { id: 'oh-rf3', description: 'Oral mucosal lesions of unknown cause', action: 'referral_required' },
      { id: 'oh-rf4', description: 'Severe dental pain requiring intervention', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'oh-ex1', description: 'Active dental abscess (requires dental/medical management)', type: 'comorbidity' },
      { id: 'oh-ex2', description: 'Age <2 for fluoride varnish', type: 'age' },
    ],
    assessmentFields: ['Dental history', 'Last dental visit', 'Oral hygiene practices', 'Fluoride exposure (water, toothpaste)', 'Dietary risk factors (sugar intake)', 'Dry mouth symptoms', 'Current medications causing xerostomia', 'Visible caries or erosion', 'Gingival health'],
    therapyOptions: [
      {
        id: 'oh-t1', medicineName: 'Sodium fluoride 2.26% (22,600ppm) varnish', dose: 'Apply to teeth', frequency: 'Every 6 months', duration: 'Single application',
        maxQuantity: 1, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Fluoride allergy (rare)', 'Ulcerative gingivitis or stomatitis'],
        interactions: [],
        specialPopulations: 'Safe in pregnancy; supervise application in children',
      },
      {
        id: 'oh-t2', medicineName: 'Neutral sodium fluoride 0.05% mouth rinse', dose: '10mL', frequency: 'Once daily (do not swallow)', duration: 'Ongoing for high-risk patients',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'second',
        contraindications: ['Children <6 (swallowing risk)'],
        interactions: [],
      },
    ],
    guidelineReference: 'Australian Dental Association – Clinical guidelines for oral health screening',
    followUpInterval: '6 months for fluoride reapplication; refer to dentist for comprehensive care',
  },
  // ── Psoriasis ──
  {
    id: 'psoriasis',
    name: 'Psoriasis',
    classification: 'chronic',
    description: 'Management of mild plaque psoriasis in adults',
    scopeValidation: { minAge: 18, pregnancyExcluded: true, breastfeedingExcluded: true },
    redFlags: [
      { id: 'ps-rf1', description: 'Erythrodermic psoriasis (>90% BSA, systemic illness)', action: 'urgent_referral' },
      { id: 'ps-rf2', description: 'Pustular psoriasis', action: 'urgent_referral' },
      { id: 'ps-rf3', description: 'Joint symptoms (psoriatic arthritis)', action: 'referral_required' },
      { id: 'ps-rf4', description: 'Moderate-severe disease (>10% BSA or DLQI >10)', action: 'referral_required' },
      { id: 'ps-rf5', description: 'Failure of topical therapy after 8 weeks', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'ps-ex1', description: 'Moderate-severe psoriasis requiring systemic therapy', type: 'comorbidity' },
      { id: 'ps-ex2', description: 'Pregnant or breastfeeding', type: 'pregnancy' },
      { id: 'ps-ex3', description: 'Age <18', type: 'age' },
    ],
    assessmentFields: ['Body surface area affected (%)', 'Plaque locations', 'Severity (PASI or visual assessment)', 'Itch severity', 'Impact on quality of life (DLQI)', 'Nail involvement', 'Joint symptoms', 'Previous treatments', 'Family history'],
    therapyOptions: [
      {
        id: 'ps-t1', medicineName: 'Betamethasone dipropionate 0.05% ointment', dose: 'Apply thin layer', frequency: 'Once or twice daily to plaques', duration: '2–4 weeks',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Infected skin', 'Facial/intertriginous psoriasis (use weaker steroid)'],
        interactions: [],
        monitoringRequired: 'Monitor for skin atrophy; step down potency when controlled',
      },
      {
        id: 'ps-t2', medicineName: 'Calcipotriol 50mcg/g ointment', dose: 'Apply thin layer', frequency: 'Twice daily', duration: '8 weeks',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Hypercalcaemia', 'Calcium metabolism disorders'],
        interactions: [],
        specialPopulations: 'Max 100g per week; can combine with topical corticosteroid',
        monitoringRequired: 'Calcium levels if using extensively',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Dermatology – Psoriasis',
    followUpInterval: '4–8 weeks for treatment response; refer if no improvement',
  },
  // ── Smoking Cessation ──
  {
    id: 'smoking-cessation',
    name: 'Smoking Cessation',
    classification: 'preventive',
    description: 'Pharmacological and behavioural support for smoking cessation in adults',
    scopeValidation: { minAge: 18, pregnancyExcluded: false, breastfeedingExcluded: false, jurisdictionNotes: 'NRT available without prescription; varenicline requires prescriber authority' },
    redFlags: [
      { id: 'sc-rf1', description: 'Severe psychiatric illness (active psychosis, unstable bipolar)', action: 'referral_required' },
      { id: 'sc-rf2', description: 'Active suicidal ideation', action: 'urgent_referral' },
      { id: 'sc-rf3', description: 'Recent cardiovascular event (<2 weeks)', action: 'referral_required' },
      { id: 'sc-rf4', description: 'Seizure history (for varenicline/bupropion)', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'sc-ex1', description: 'Age <18', type: 'age' },
      { id: 'sc-ex2', description: 'Seizure disorder (for bupropion)', type: 'comorbidity' },
    ],
    assessmentFields: ['Cigarettes per day', 'Years of smoking', 'Time to first cigarette (Fagerström score)', 'Previous quit attempts', 'Previous pharmacotherapy used', 'Motivation to quit (readiness scale)', 'Psychiatric history', 'Current medications', 'Triggers and barriers'],
    therapyOptions: [
      {
        id: 'sc-t1', medicineName: 'Varenicline', dose: '0.5mg days 1–3, 0.5mg BD days 4–7, then 1mg BD', frequency: 'As per titration schedule', duration: '12 weeks (may extend to 24)',
        maxQuantity: 1, repeats: 2, pbsRestriction: 'Authority required (STREAMLINED)', authorityRequired: true, line: 'first',
        contraindications: ['Severe renal impairment without dose adjustment', 'Hypersensitivity'],
        interactions: ['Cimetidine'],
        monitoringRequired: 'Mood/behaviour changes; nausea management; quit date support',
      },
      {
        id: 'sc-t2', medicineName: 'Nicotine replacement therapy (patch + oral)', dose: '21mg patch + 2mg gum/lozenge', frequency: 'Patch daily; gum/lozenge as needed', duration: '8–12 weeks with taper',
        maxQuantity: 1, repeats: 2, authorityRequired: false, line: 'first',
        contraindications: ['Recent MI (<2 weeks)', 'Unstable angina'],
        interactions: [],
        specialPopulations: 'Safe in pregnancy (NRT preferred over smoking); combination NRT more effective than single form',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Psychotropic – Smoking cessation',
    followUpInterval: '1 week post quit date, then 2, 4, 8, 12 weeks',
    monitoringChecklist: ['Quit status', 'Withdrawal symptoms', 'Mood changes', 'Side effects', 'Relapse triggers'],
  },
  // ── Travel Medicine ──
  {
    id: 'travel-medicine',
    name: 'Travel Medicine',
    classification: 'preventive',
    description: 'Pre-travel health assessment, vaccination, and malaria prophylaxis',
    scopeValidation: { minAge: 18, pregnancyExcluded: false, breastfeedingExcluded: false, jurisdictionNotes: 'Pharmacist prescribers may provide travel vaccinations and antimalarials per jurisdictional authority' },
    redFlags: [
      { id: 'tm-rf1', description: 'Complex itinerary with high-risk destinations (specialist travel clinic advised)', action: 'referral_required' },
      { id: 'tm-rf2', description: 'Immunocompromised traveller (live vaccine contraindications)', action: 'referral_required' },
      { id: 'tm-rf3', description: 'Pregnant traveller to malaria-endemic area', action: 'referral_required' },
      { id: 'tm-rf4', description: 'Last-minute travel (<2 weeks before departure)', action: 'referral_required' },
    ],
    exclusionCriteria: [
      { id: 'tm-ex1', description: 'Age <18 (paediatric travel assessment)', type: 'age' },
      { id: 'tm-ex2', description: 'Complex medical history requiring specialist review', type: 'comorbidity' },
    ],
    assessmentFields: ['Destination(s) and regions', 'Travel dates and duration', 'Type of travel (urban/rural/adventure)', 'Accommodation type', 'Vaccination history', 'Current medications', 'Allergies', 'Pregnancy status', 'Medical history (epilepsy, cardiac, psychiatric)', 'Previous malaria prophylaxis'],
    therapyOptions: [
      {
        id: 'tm-t1', medicineName: 'Atovaquone/Proguanil (Malarone)', dose: '250/100mg', frequency: 'Once daily', duration: 'Start 1–2 days before, during, and 7 days after travel',
        maxQuantity: 30, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Severe renal impairment (eGFR <30)', 'Pregnancy', 'Atovaquone/proguanil allergy'],
        interactions: ['Metoclopramide (reduced absorption)', 'Rifampicin', 'Tetracycline'],
        monitoringRequired: 'Counsel on adherence; mosquito bite prevention measures',
      },
      {
        id: 'tm-t2', medicineName: 'Doxycycline', dose: '100mg', frequency: 'Once daily', duration: 'Start 1–2 days before, during, and 4 weeks after travel',
        maxQuantity: 60, repeats: 0, authorityRequired: false, line: 'second',
        contraindications: ['Pregnancy', 'Breastfeeding', 'Age <8', 'Tetracycline allergy'],
        interactions: ['Antacids', 'Iron', 'Oral retinoids', 'Warfarin'],
        specialPopulations: 'Photosensitivity warning; take with food/water and remain upright',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Antibiotic – Malaria prophylaxis; Australian Immunisation Handbook',
    followUpInterval: 'Pre-departure review if vaccines require multiple doses; post-travel if unwell',
  },
  // ── Weight Management (Obesity) ──
  {
    id: 'weight-management',
    name: 'Weight Management (Obesity)',
    classification: 'chronic',
    description: 'Pharmacological and lifestyle management of obesity in adults (BMI ≥30, or ≥27 with comorbidities)',
    scopeValidation: { minAge: 18, pregnancyExcluded: true, breastfeedingExcluded: true },
    redFlags: [
      { id: 'wm-rf1', description: 'BMI ≥40 or BMI ≥35 with severe comorbidities (bariatric surgery referral)', action: 'referral_required' },
      { id: 'wm-rf2', description: 'Suspected secondary obesity (Cushing syndrome, hypothyroidism untreated)', action: 'referral_required' },
      { id: 'wm-rf3', description: 'Eating disorder suspected', action: 'referral_required' },
      { id: 'wm-rf4', description: 'Uncontrolled hypertension or diabetes', action: 'referral_required' },
      { id: 'wm-rf5', description: 'Suicidal ideation or severe depression', action: 'urgent_referral' },
    ],
    exclusionCriteria: [
      { id: 'wm-ex1', description: 'Pregnant or planning pregnancy', type: 'pregnancy' },
      { id: 'wm-ex2', description: 'Age <18', type: 'age' },
      { id: 'wm-ex3', description: 'Eating disorder (anorexia, bulimia)', type: 'comorbidity' },
      { id: 'wm-ex4', description: 'Uncontrolled thyroid disease', type: 'comorbidity' },
    ],
    assessmentFields: ['Weight, height, BMI', 'Waist circumference', 'Weight history', 'Dietary assessment', 'Physical activity level', 'Comorbidities (T2DM, HTN, OSA, NAFLD)', 'Psychological factors', 'Current medications causing weight gain', 'Previous weight loss attempts', 'Motivation and goals'],
    therapyOptions: [
      {
        id: 'wm-t1', medicineName: 'Orlistat', dose: '120mg', frequency: 'Three times daily with meals containing fat', duration: '12 weeks initially; continue if ≥5% weight loss',
        maxQuantity: 84, repeats: 0, authorityRequired: false, line: 'first',
        contraindications: ['Chronic malabsorption syndrome', 'Cholestasis', 'Pregnancy'],
        interactions: ['Cyclosporin', 'Warfarin', 'Levothyroxine', 'Fat-soluble vitamins (separate dosing)'],
        monitoringRequired: 'Weight at 4, 8, 12 weeks; fat-soluble vitamin supplementation advice',
      },
      {
        id: 'wm-t2', medicineName: 'Phentermine', dose: '15–30mg', frequency: 'Once daily in the morning', duration: '12 weeks max',
        maxQuantity: 30, repeats: 0, pbsRestriction: 'Not PBS listed – private prescription', authorityRequired: false, line: 'second',
        contraindications: ['Cardiovascular disease', 'Uncontrolled HTN', 'Hyperthyroidism', 'Glaucoma', 'Drug abuse history', 'MAOIs within 14 days'],
        interactions: ['MAOIs', 'SSRIs (serotonin syndrome)', 'Antihypertensives'],
        specialPopulations: 'Short-term use only (max 12 weeks); not for BMI <30 unless comorbidities',
        monitoringRequired: 'BP and HR at each visit; mood assessment',
      },
    ],
    guidelineReference: 'Therapeutic Guidelines: Endocrinology – Obesity management; NHMRC Clinical Practice Guidelines for the Management of Overweight and Obesity',
    followUpInterval: '4 weeks initially, then monthly for 3 months; 3-monthly ongoing',
    monitoringChecklist: ['Weight/BMI', 'Waist circumference', 'Blood pressure', 'Fasting glucose/HbA1c', 'Lipids', 'Mood and motivation', 'Side effects'],
  },
];

export const getConditionById = (id: string): Condition | undefined =>
  CONDITIONS.find(c => c.id === id);

export const getConditionsByClassification = (classification: Condition['classification']) =>
  CONDITIONS.filter(c => c.classification === classification);
