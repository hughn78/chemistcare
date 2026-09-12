/**
 * CANONICAL PROTOCOL — Uncomplicated urinary tract infection (Victoria)
 * =====================================================================
 * Source: Victorian Department of Health, "Protocol for Management of
 * Urinary Tract Infections", The Victorian Community Pharmacist Program,
 * January 2026 (landing page states updated 4 February 2026).
 * ISBN 978-1-76131-955-6. Retrieved 2026-09-13.
 *
 * This file is the SINGLE SOURCE OF TRUTH for UTI clinical content.
 * The conflicting duplicates identified in the 12 Sep 2026 audit
 * (conditions.ts, types/protocols.ts) must derive from here or be deleted.
 *
 * ── IMPORTANT CHANGES versus the previous implementation ──────────────────
 * The app previously recommended trimethoprim FIRST LINE and offered
 * cefalexin. The Victorian protocol is explicit that this is wrong:
 *
 *   • Nitrofurantoin is 1st line (100 mg every 6 hours for 5 days, 20 caps).
 *   • Fosfomycin is 2nd line (3 g single dose) — previously missing entirely.
 *   • Trimethoprim is 3rd line, and only where no trimethoprim exposure or
 *     trimethoprim-resistant E. coli in the last 3 months. The protocol notes
 *     this aligns with Therapeutic Guidelines: Antibiotic March 2025, which
 *     moved away from trimethoprim as first-line empirical therapy.
 *   • Cefalexin is EXPLICITLY EXCLUDED from the medicines list "to limit
 *     potential overuse and the emergence of cefalexin resistance".
 *   • Nitrofurantoin renal wording is "severe renal impairment". The protocol
 *     states NO numeric eGFR threshold. The app previously used two
 *     conflicting invented values (eGFR <30 and eGFR <45); both are removed.
 *
 * ── LIFECYCLE ────────────────────────────────────────────────────────────
 * 'source_verified': transcribed from the retrieved official document, but NOT
 * yet reviewed and signed off by a practising pharmacist prescriber. It is
 * therefore presented in REFERENCE / DEVELOPMENT mode, not as a live
 * prescribing pathway. Flip to 'clinically_reviewed' then 'active' after
 * pharmacist sign-off.
 */

import type { ProtocolDefinition } from '../types';

const SOURCE_ID = 'VIC_CCN_UTI_2026_01';

/**
 * The protocol states "severe renal impairment" without a numeric threshold and
 * directs prescribers to Therapeutic Guidelines / AMH to confirm. We must not
 * invent an eGFR number.
 */
const SEVERE_RENAL_IMPAIRMENT = 'Severe renal impairment';

export const utiProtocol: ProtocolDefinition = {
  id: 'VIC_CCN_UTI_2026_01',
  conditionId: 'uncomplicated-uti',
  conditionName: 'Uncomplicated urinary tract infection (cystitis)',
  title: 'Protocol for Management of Urinary Tract Infections',
  jurisdiction: 'VIC',
  authorityName: 'Victorian Department of Health',
  sourceId: SOURCE_ID,
  sourceType: 'government',
  lifecycle: 'source_verified',
  effectiveDate: '2026-02-04',
  needsClinicalReview: true,
  reviewNote:
    'Transcribed from the retrieved official Victorian protocol (January 2026). ' +
    'Awaiting sign-off by a practising pharmacist prescriber before it may be ' +
    'presented as an active prescribing pathway. Quantitative renal thresholds are ' +
    'deliberately NOT specified — the protocol says "severe renal impairment" and ' +
    'directs prescribers to Therapeutic Guidelines / AMH.',

  eligibility: [
    {
      id: 'sex_female',
      label: 'Patient is female',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'age_18_to_65',
      label: 'Aged between 18 and 65 years',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'consent_and_present',
      label: 'Patient consents and is physically present in the pharmacy',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'two_or_more_cystitis_symptoms',
      label:
        'Two or more symptoms of acute cystitis (dysuria, urinary frequency, ' +
        'urinary urgency, suprapubic pain or discomfort)',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
  ],

  redFlags: [
    {
      id: 'pyelonephritis_suspected',
      label: 'Signs/symptoms suggesting pyelonephritis (fever >38°C, chills, nausea, vomiting, flank pain)',
      action: 'Immediate referral to Emergency Department',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'fever_rigors',
      label: 'Fever >38°C or rigors',
      action: 'Immediate referral to Emergency Department',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'flank_pain',
      label: 'Flank / loin pain',
      action: 'Immediate referral to Emergency Department',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'pregnant',
      label: 'Pregnancy or less than 6 weeks post-partum',
      action: 'Immediate referral to GP',
      outcome: 'refer_same_day',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'visible_haematuria',
      label: 'Gross (visible) haematuria',
      action: 'Immediate referral to GP',
      outcome: 'refer_same_day',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'neurological_bladder',
      label: 'Cerebral palsy or other neurological disease affecting bladder function',
      action: 'Immediate referral to GP',
      outcome: 'refer_same_day',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'recent_iud',
      label: 'IUD inserted within the last 3 months',
      action: 'Immediate referral to GP',
      outcome: 'refer_same_day',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'catheter_related',
      label:
        'Urinary catheterisation in situ or within the last 48 hours, nephrostomy tube or ureteral stent',
      action: 'Immediate referral to GP',
      outcome: 'refer_same_day',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'tract_abnormality',
      label:
        'Anatomical/functional urinary tract abnormality, obstruction or urolithiasis, or spinal cord injury',
      action: 'Immediate referral to GP',
      outcome: 'refer_same_day',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },

    // ── Antibiotic may still be supplied alongside GP referral ─────────────
    {
      id: 'diabetes_or_sglt2',
      label: 'Diabetes, or medicine that increases UTI risk (e.g. SGLT2 inhibitor)',
      action: 'Refer to GP following provisional treatment by pharmacist',
      outcome: 'treat_and_refer',
      prescribingBlocked: false,
      sourceId: SOURCE_ID,
    },
    {
      id: 'recurrent_pattern',
      label: '2 or more symptomatic UTIs in 6 months, or 3 or more in 12 months',
      action: 'Refer to GP following provisional treatment by pharmacist',
      outcome: 'treat_and_refer',
      prescribingBlocked: false,
      sourceId: SOURCE_ID,
    },
    {
      id: 'recent_treatment_failure',
      label:
        'Recurrence within 2 weeks of completing appropriate antimicrobial treatment, ' +
        'or symptoms persisting 48–72 hours after starting appropriate antibiotic',
      action: 'Refer to GP following provisional treatment by pharmacist',
      outcome: 'treat_and_refer',
      prescribingBlocked: false,
      sourceId: SOURCE_ID,
    },
    {
      id: 'long_term_inpatient',
      label: 'Long-term inpatient care (including residential aged care)',
      action: 'Refer to GP following provisional treatment by pharmacist',
      outcome: 'treat_and_refer',
      prescribingBlocked: false,
      sourceId: SOURCE_ID,
    },

    // ── Refer for investigation; supply not authorised under protocol ──────
    {
      id: 'std_concern',
      label:
        'STI risk factors (age <30, previous STI, condomless sex outside a mutually ' +
        'monogamous relationship, new partner in last 60 days, partner recently treated ' +
        'for STI, sexual contact with a sex worker)',
      action: 'Refer to GP; refer for STI testing where risk factors identified',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'immunocompromised',
      label: 'Immunocompromised or taking immunosuppressant medicines',
      action: 'Refer to GP — patient may benefit from laboratory investigations',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'known_renal_disease',
      label: 'Renal disease or impairment',
      action: 'Refer to GP — patient may benefit from laboratory investigations',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'asplenia',
      label: 'Asplenia',
      action: 'Refer to GP — patient may benefit from laboratory investigations',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'history_pyelonephritis',
      label: 'History of pyelonephritis',
      action: 'Refer to GP — patient may benefit from laboratory investigations',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'iud_in_situ_over_3_months',
      label: 'IUD in situ for greater than 3 months',
      action: 'Refer to GP — patient may benefit from laboratory investigations',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'atypical_symptoms',
      label: 'Vaginal discharge or vulval/vaginal discomfort suggesting a cause other than acute cystitis',
      action: 'Consider S3 thrush treatment or refer to GP for investigation of other causes',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'male_patient',
      label: 'Male patient, or individual who has undergone gender reassignment surgery',
      action: 'Usual care with symptomatic treatment and self-care advice, and/or refer to GP',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'paediatric',
      label: 'Patient under 18 years',
      action: 'Refer to GP',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
  ],

  nonDrugManagement: [
    'Offer analgesia, including ibuprofen, to patients with symptoms of acute cystitis.',
    'Provide non-pharmacological and self-care advice, including a Self-Care Fact Card and/or Consumer Medicines Information.',
    'Increasing water intake (up to 1.5 L daily) may reduce the risk of recurrent UTI in pre-menopausal females with inadequate fluid intake (<1.5 L per day).',
    'Cranberry products, ascorbic acid and methenamine hippurate are NOT effective for treatment of acute cystitis.',
    'The efficacy of urinary alkalinising agents has not been established; patients taking nitrofurantoin or fosfomycin should avoid them as they may significantly reduce antibiotic efficacy.',
    'Non-antibiotic therapy may be discussed as an option for mild acute cystitis in non-pregnant females under 65 without immune compromise.',
  ],

  medicines: [
    {
      id: 'nitrofurantoin',
      medicineName: 'Nitrofurantoin',
      activeIngredient: 'nitrofurantoin',
      line: 1,
      dose: '100 mg',
      frequency: 'Every 6 hours',
      duration: '5 days',
      quantity: 20,
      repeats: 0,
      contraindications: [
        'Previous serious adverse reaction to nitrofurantoin',
        'Glucose-6-phosphate dehydrogenase (G6PD), enolase, or glutathione peroxidase deficiency (may lead to haemolytic anaemia)',
        SEVERE_RENAL_IMPAIRMENT,
        'Avoid in breastfeeding if the infant is under one month or has G6PD deficiency',
      ],
      cautions: [
        'Take with food to reduce nausea.',
        'Avoid urinary alkalinising agents — they significantly reduce nitrofurantoin efficacy.',
      ],
      allergyConflicts: ['nitrofurantoin'],
      interactionFlags: ['urinary alkalinising agents', 'magnesium antacid', 'probenecid'],
      counsellingPoints: [
        'Take one capsule four times a day (every 6 hours) for 5 days.',
        'Take with food to reduce nausea.',
        'Urine may darken — this is harmless.',
        'Avoid urinary alkalinising agents while taking this antibiotic.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'Protocol states "severe renal impairment" with no numeric eGFR threshold and ' +
        'directs prescribers to Therapeutic Guidelines / AMH. Do not add an eGFR number ' +
        'without a source. (Previous app versions used conflicting eGFR <30 and eGFR <45.)',
      sourceId: SOURCE_ID,
    },
    {
      id: 'fosfomycin',
      medicineName: 'Fosfomycin',
      activeIngredient: 'fosfomycin',
      line: 2,
      dose: '3 g',
      frequency: 'Single dose (at night)',
      duration: 'Single dose',
      quantity: 1,
      repeats: 0,
      contraindications: [
        'Previous serious adverse reaction or hypersensitivity to fosfomycin',
        SEVERE_RENAL_IMPAIRMENT,
        'Not recommended in fructose intolerance, glucose-galactose malabsorption or sucrase-isomaltose insufficiency',
      ],
      cautions: ['Avoid urinary alkalinising agents — they significantly reduce fosfomycin efficacy.'],
      allergyConflicts: ['fosfomycin'],
      interactionFlags: ['urinary alkalinising agents'],
      counsellingPoints: [
        'Single 3 g sachet dose, taken at night.',
        'Dissolve the sachet contents in water before taking.',
        'Avoid urinary alkalinising agents while taking this antibiotic.',
      ],
      sourceId: SOURCE_ID,
    },
    {
      id: 'trimethoprim',
      medicineName: 'Trimethoprim',
      activeIngredient: 'trimethoprim',
      line: 3,
      dose: '300 mg',
      frequency: 'Once daily at night',
      duration: '3 nights',
      quantity: 3,
      repeats: 0,
      contraindications: [
        'Treated with trimethoprim in the previous 3 months, or trimethoprim-resistant E. coli isolate during this time',
        'Previous serious adverse reaction to trimethoprim-containing medicines',
        'Megaloblastic anaemia due to folate deficiency',
        'Other causes of folate deficiency',
        'Other severe blood disorders',
        'Porphyria',
        'Hyperkalaemia',
        'Treatment with methotrexate',
        'Treatment with phenytoin',
        'Treatment with lamivudine',
      ],
      cautions: [
        'Third-line only. The protocol notes this aligns with Therapeutic Guidelines: Antibiotic March 2025, which no longer recommends trimethoprim as first-line empirical therapy for acute cystitis (E. coli resistance ~20%, AURA 2023).',
      ],
      allergyConflicts: ['trimethoprim'],
      interactionFlags: ['methotrexate', 'phenytoin', 'lamivudine', 'warfarin', 'spironolactone', 'ace inhibitor'],
      counsellingPoints: [
        'One tablet each night for 3 nights.',
        'Only suitable if no trimethoprim use and no trimethoprim-resistant E. coli in the last 3 months.',
      ],
      sourceId: SOURCE_ID,
    },
  ],

  excludedMedicines: [
    {
      medicineName: 'Cefalexin',
      reason:
        'Cefalexin has been excluded from the Medicines List of this Protocol to limit ' +
        'potential overuse and the emergence of cefalexin resistance.',
    },
  ],

  followUp: [
    'Symptoms should respond to appropriate antibiotic treatment within 48 hours.',
    'If symptoms persist 48–72 hours after finishing antibiotic treatment, or symptoms develop that are not symptoms of acute cystitis, advise the patient to see a GP.',
    'If the patient continues to have symptoms after 48 hours of conservative management, advise them to return to the pharmacy for review and consider antibiotic therapy.',
  ],

  safetyNetting: [
    'Fever 38°C or higher',
    'Rigors',
    'Loin or back pain',
    'Vomiting',
    'Any symptom that is not a symptom of acute cystitis',
  ],

  documentationRequirements: [
    'Sufficient information to identify the patient',
    'Date of treatment',
    'Name of the pharmacist who undertook the consultation and their HPI-I number',
    'Consent given by the patient regarding program participation, costs, pharmacist communication with other healthcare practitioners, and access to the patient’s My Health Record',
    'Any information known to the pharmacist relevant to the patient’s diagnosis or treatment, and any observations and assessments including allergies and adverse drug reactions',
    'Any clinical opinion reached by the pharmacist',
    'Actions taken by the pharmacist (including any medications supplied or referrals made)',
    'Particulars of any medications supplied (form, strength and amount)',
    'Information or advice given to the patient',
    'The record must be shared with the patient and with the patient’s usual treating medical practitioner or practice, where the patient has one',
  ],
};
