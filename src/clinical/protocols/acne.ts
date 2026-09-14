/**
 * CANONICAL PROTOCOL — Mild acne (Victoria)
 * =========================================
 * Source: Victorian Department of Health, "Protocol for Management of Mild
 * Acne", The Victorian Community Pharmacist Program, July 2026.
 * ISBN/ISSN 978-1-76131-994-5. Retrieved 2026-09-13.
 *
 * Verified by reading the retrieved PDF, not inferred from the landing page.
 *
 * ── SCOPE IS NARROWER THAN THE PRODUCT ASSUMES ─────────────────────────────
 * 1. This is a MILD acne protocol. Moderate and severe acne are out of scope
 *    and must be referred.
 * 2. Supply is limited to a MAXIMUM OF 6 WEEKS of the appropriate medication.
 *    This is not a repeat-supply service.
 * 3. There are TWO distinct flowcharts: (A) INITIATE treatment and (B) REVIEW
 *    treatment after at least 6 weeks. They are different decision paths.
 * 4. Acne severity is classified per Therapeutic Guidelines: Acne. The
 *    protocol reproduces a severity table (Table 1) as supplementary
 *    information; see SEVERITY_NOTE below.
 *
 * ── WHAT THIS DOCUMENT DOES *NOT* CONTAIN ──────────────────────────────────
 * The protocol gives NO per-product contraindications, precautions or
 * interactions. It explicitly delegates all of them:
 *
 *   "Pharmacists must consult the Therapeutic Guidelines, Australian Medicines
 *    Handbook, and other relevant references to confirm the management is
 *    appropriate, including for: Contraindications and precautions · Medicine
 *    interactions · Pregnancy and lactation"
 *
 * Therefore the `contraindications` arrays below contain ONLY what the
 * protocol itself states (teratogenicity for retinoids; resistance limits and
 * the irritation restriction for clindamycin). They are deliberately NOT
 * padded with plausible-sounding content we have no source for. Do not "fill
 * them in" from general knowledge — that is exactly the failure mode this
 * architecture exists to prevent.
 *
 * ── LIFECYCLE ──────────────────────────────────────────────────────────────
 * 'source_verified': transcribed from the retrieved official document, awaiting
 * sign-off by a practising pharmacist prescriber. Renders in REFERENCE /
 * DEVELOPMENT mode.
 */

import type { ProtocolDefinition } from '../types';

const SOURCE_ID = 'VIC_CCN_ACNE_2026_08';

/** Applied to every medicine in this protocol — the protocol states it once. */
const SUPPLY_LIMIT = 'Supply is limited to a maximum of 6 weeks of the appropriate medication.';

const REVIEW_AT_6_WEEKS = 'Apply to affected area(s) once daily at night for 6 weeks, then review.';

/** Verbatim NB3 — retinoid initiation. */
const RETINOID_TITRATION =
  'For patients starting topical retinoids, introduce these gradually because they can ' +
  'irritate the skin initially. E.g. Apply to affected area(s) for 2 hours for the first ' +
  '2 nights, then increase to alternate nights for the first 2 weeks, then once daily at ' +
  'night as tolerated.';

/** Verbatim — topical retinoid teratogenicity. */
const RETINOID_TERATOGENIC = [
  'Topical retinoids are potentially teratogenic and should be avoided in patients who are planning to become pregnant or who are pregnant.',
  'Female patients of childbearing age provided a topical teratogenic agent must be advised to take appropriate measures to prevent pregnancy while using this medication.',
];

const SEVERITY_NOTE =
  'Severity is classified per Therapeutic Guidelines: Acne on morphology, extent and ' +
  'impact on quality of life. Protocol Table 1: MILD = few comedones, pustules and ' +
  'papules; no scarring including no family history of scarring (note: persistent mild ' +
  'acne can scar); lesions often confined to the forehead, nose and chin (T-section). ' +
  'MODERATE = numerous comedones, pustules and papules; some nodules; no scarring; ' +
  'lesions affect extensive areas of the face and sometimes the trunk. SEVERE = nodules, ' +
  'cysts and scarring. Note: impact on quality of life may categorise a patient into a ' +
  'higher severity category even if morphology and extent indicate lower severity.';

export const acneProtocol: ProtocolDefinition = {
  id: SOURCE_ID,
  conditionId: 'mild-acne',
  conditionName: 'Mild acne',
  title: 'Protocol for Management of Mild Acne',
  jurisdiction: 'VIC',
  authorityName: 'Victorian Department of Health',
  sourceId: SOURCE_ID,
  sourceType: 'government',
  lifecycle: 'source_verified',
  effectiveDate: '2026-07-01',
  needsClinicalReview: true,
  reviewNote:
    'Transcribed from the retrieved official Victorian protocol (July 2026, ' +
    'ISBN/ISSN 978-1-76131-994-5). Awaiting sign-off by a practising pharmacist ' +
    'prescriber. The source document supplies NO per-product contraindications, ' +
    'precautions or interactions — it delegates these to Therapeutic Guidelines and the ' +
    'AMH — so none have been invented here. Two flowcharts (INITIATE and REVIEW) are ' +
    'modelled as shared eligibility plus a review pathway; confirm this decomposition ' +
    'with a pharmacist before it drives a live consultation.',

  eligibility: [
    {
      id: 'age_12_plus',
      label: 'Patient is aged 12 years or older',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'mild_acne_confirmed',
      label:
        'Patient has MILD acne. Comedones +/- pustules and papules must be present for a ' +
        'diagnosis of acne; if the patient has pustules or papules but no comedones, acne ' +
        'is unlikely — consider differential diagnoses (folliculitis, rosacea, acneiform ' +
        'eruptions, keratosis pilaris, milia).',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'seeking_supply_after_appropriate_trial',
      label:
        'Patient is seeking supply of a topical treatment for mild acne after one of: ' +
        '(a) using an OTC acne treatment (e.g. azelaic acid) without sufficient clinical ' +
        'improvement, or relapsed after initial response; (b) previously using a topical ' +
        'acne treatment on the Medicines List and relapsed after initial response; or ' +
        '(c) using a topical acne treatment on the Medicines List continuously for the ' +
        'past 6 weeks and requiring review.',
      ifUnmet: 'no_treatment',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'not_6_months_without_review',
      label:
        'Patient has NOT been using any Schedule 4 topical acne treatment on the Medicines ' +
        'List continuously for 6 months or more without medical practitioner review. ' +
        '(Short interruptions in use, e.g. due to symptom improvement, are not considered ' +
        'continuous use.)',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'consent_and_present',
      label:
        'Patient/parent/caregiver consents to participate in the Program and the patient ' +
        'is physically present at the pharmacy',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
  ],

  redFlags: [
    // ── Immediate referral, supply NOT permitted ────────────────────────────
    {
      id: 'unclear_diagnosis',
      label: 'Unable to make a clear diagnosis of mild acne',
      action: 'Refer to General Practitioner for treatment',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'severe_or_scarring',
      label:
        'Acne is painful, severe, cystic or scarring; acne excoriée is present; or the ' +
        'patient has a family history of scarring acne (note: even persistent mild acne can scar)',
      action: 'Refer to General Practitioner for treatment',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'pregnant_or_planning',
      label:
        'Patient is pregnant or planning pregnancy — there are medicines in this protocol ' +
        'which are Schedule D (planning pregnancy = actively trying to conceive or ' +
        'intending to conceive in the next 1–3 months)',
      action: 'Refer to General Practitioner for treatment',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'medicine_induced_acne',
      label: 'Patient is taking a medicine that can cause or aggravate acne',
      action: 'Refer to General Practitioner for treatment',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'androgenisation_or_pcos',
      label:
        'Female patient has PMOS/PCOS, or presents with signs of androgenisation ' +
        '(hirsutism, obesity and/or menstrual irregularity)',
      action: 'Refer to General Practitioner for treatment',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'treatment_failure',
      label:
        'Acne has worsened, repeatedly relapsed, or not responded despite use of ' +
        'appropriate topical treatment',
      action: 'Refer to General Practitioner for treatment',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'poorly_tolerated',
      label: 'Topical treatments within this protocol have been poorly tolerated',
      action: 'Refer to General Practitioner for treatment',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },

    // ── Treat AND refer ─────────────────────────────────────────────────────
    {
      id: 'marked_psychosocial_impact',
      label:
        'The condition is having a marked negative emotional and social effect on the ' +
        'patient (quality of life is significantly affected)',
      action:
        'Proceed with treatment AND/OR refer to General Practitioner for immediate ' +
        'review and follow up. A referral to a medical practitioner may be appropriate to ' +
        'escalate treatment and refer to other support services (e.g. counselling and ' +
        'psychology).',
      outcome: 'treat_and_refer',
      prescribingBlocked: false,
      sourceId: SOURCE_ID,
    },
  ],

  nonDrugManagement: [
    'Identify and minimise factors that may aggravate acne or irritate skin.',
    'Apply topical acne treatment to clean, dry skin at night (or as directed), using a pea size amount.',
    'Use a gentle, hydrating cleanser twice daily.',
    'Avoid soap-based cleansers, as their alkaline pH may contribute to skin dryness and irritation. Instead use a soap substitute or gentle pH-balanced cleanser.',
    'Moisturiser can be applied before or after the acne treatment, depending on individual tolerance.',
    'Wash hair regularly and use a non-comedogenic sunscreen daily.',
    'Aggravating factors to consider: systemic drugs (anabolic steroids, corticosteroids, phenytoin, lithium, fluconazole, COCP with higher dose of levonorgestrel or progesterone-only contraceptives); topical products (skincare, cosmetics including cosmeceuticals with retinols, sunscreen); diet (high glycaemic index foods, dairy products); occupational or leisure activities (halogens e.g. chlorine at swimming pools, grease at fast-food outlets, hot humid environments, mask wearing).',
    SEVERITY_NOTE,
  ],

  medicines: [
    // ── A) Mainly comedonal with minimal inflammation ───────────────────────
    {
      id: 'adapalene_0_1',
      medicineName: 'Adapalene 0.1% (cream or gel)',
      activeIngredient: 'adapalene',
      line: 1,
      dose: '0.1%',
      frequency: 'Once daily at night',
      duration: '6 weeks, then review',
      repeats: 0,
      contraindications: [...RETINOID_TERATOGENIC],
      cautions: [
        RETINOID_TITRATION,
        'Adapalene is available as a Schedule 3 formulation.',
        'Cream formulations are preferred for patients with dry or sensitive skin; gel formulations for those with oily skin.',
        SUPPLY_LIMIT,
      ],
      allergyConflicts: ['adapalene'],
      counsellingPoints: [
        'Apply to affected area(s) once daily at night for 6 weeks, then review.',
        'Use only a pea size amount for the whole face.',
        RETINOID_TITRATION,
        'Most treatments take between 6 and 12 weeks of consistent, correct use to start to be visibly effective.',
        'Comprehensive contraceptive counselling MUST be provided to any female of child-bearing age supplied a topical retinoid.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'The protocol states teratogenicity and the Schedule 3 availability but gives no ' +
        'other contraindications, precautions or interactions — these are delegated to ' +
        'Therapeutic Guidelines / AMH and must not be invented here.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'tretinoin_0_05',
      medicineName: 'Tretinoin 0.05% cream',
      activeIngredient: 'tretinoin',
      line: 1,
      dose: '0.05%',
      frequency: 'Once daily at night',
      duration: '6 weeks, then review',
      repeats: 0,
      contraindications: [...RETINOID_TERATOGENIC],
      cautions: [
        RETINOID_TITRATION,
        'Cream formulations are preferred for patients with dry or sensitive skin.',
        SUPPLY_LIMIT,
      ],
      allergyConflicts: ['tretinoin'],
      counsellingPoints: [
        REVIEW_AT_6_WEEKS,
        'Use only a pea size amount for the whole face.',
        RETINOID_TITRATION,
        'Most treatments take between 6 and 12 weeks of consistent, correct use to start to be visibly effective.',
        'Comprehensive contraceptive counselling MUST be provided to any female of child-bearing age supplied a topical retinoid.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'No contraindications, precautions or interactions are stated in the protocol ' +
        'beyond teratogenicity — delegated to Therapeutic Guidelines / AMH.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'trifarotene_0_005',
      medicineName: 'Trifarotene 0.005% cream',
      activeIngredient: 'trifarotene',
      line: 1,
      dose: '0.005%',
      frequency: 'Once daily at night',
      duration: '6 weeks, then review',
      repeats: 0,
      contraindications: [...RETINOID_TERATOGENIC],
      cautions: [RETINOID_TITRATION, SUPPLY_LIMIT],
      allergyConflicts: ['trifarotene'],
      counsellingPoints: [
        REVIEW_AT_6_WEEKS,
        'Use only a pea size amount for the whole face.',
        RETINOID_TITRATION,
        'Most treatments take between 6 and 12 weeks of consistent, correct use to start to be visibly effective.',
        'Comprehensive contraceptive counselling MUST be provided to any female of child-bearing age supplied a topical retinoid.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'No contraindications, precautions or interactions are stated in the protocol ' +
        'beyond teratogenicity — delegated to Therapeutic Guidelines / AMH.',
      sourceId: SOURCE_ID,
    },

    // ── B) Mainly comedonal with some inflammatory papules and pustules ─────
    {
      id: 'adapalene_bpo',
      medicineName: 'Adapalene with benzoyl peroxide (0.1%/2.5% or 0.3%/2.5% gel)',
      activeIngredient: 'adapalene + benzoyl peroxide',
      line: 1,
      dose: '0.1%/2.5% or 0.3%/2.5%',
      frequency: 'Once daily at night',
      duration: '6 weeks, then review',
      repeats: 0,
      contraindications: [...RETINOID_TERATOGENIC],
      cautions: [
        RETINOID_TITRATION,
        'Benzoyl peroxide can stain pillows and clothing (as per Product Information).',
        SUPPLY_LIMIT,
      ],
      allergyConflicts: ['adapalene', 'benzoyl peroxide'],
      counsellingPoints: [
        REVIEW_AT_6_WEEKS,
        'Use only a pea size amount for the whole face.',
        RETINOID_TITRATION,
        'Benzoyl peroxide can stain pillows and clothing.',
        'Comprehensive contraceptive counselling MUST be provided to any female of child-bearing age supplied a topical retinoid.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'The review flowchart introduces adapalene 0.3%/benzoyl peroxide 2.5% as an ' +
        'escalation from the 0.1%/2.5% product. The initiation flowchart lists only the ' +
        'combination class. Confirm with a pharmacist which strengths may be used at ' +
        'initiation versus at review.',
      sourceId: SOURCE_ID,
    },

    // ── C) Mainly inflammatory papules and pustules, with some comedones ────
    {
      id: 'clindamycin_bpo',
      medicineName: 'Clindamycin 1% with benzoyl peroxide 5% gel',
      activeIngredient: 'clindamycin + benzoyl peroxide',
      line: 1,
      dose: '1%/5%',
      frequency: 'Once daily at night',
      duration: '6 weeks, then review',
      repeats: 0,
      contraindications: [],
      cautions: [
        'Use of topical clindamycin should be limited to a total of 3 months to limit development of resistance.',
        'Benzoyl peroxide can stain pillows and clothing (as per Product Information).',
        SUPPLY_LIMIT,
      ],
      allergyConflicts: ['clindamycin', 'benzoyl peroxide'],
      interactionFlags: [],
      counsellingPoints: [
        REVIEW_AT_6_WEEKS,
        'Use only a pea size amount for the whole face.',
        'Benzoyl peroxide can stain pillows and clothing.',
        'Most treatments take between 6 and 12 weeks of consistent, correct use to start to be visibly effective.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'No contraindications, precautions or interactions are stated in the protocol — ' +
        'delegated to Therapeutic Guidelines / AMH. The 3-month limit and the ' +
        '"discontinue when inflammatory lesions have resolved" rule are antimicrobial ' +
        'stewardship requirements and are stated verbatim in the source.',
      sourceId: SOURCE_ID,
    },

    // ── D) Mix of comedonal and inflammatory papules and pustules ───────────
    {
      id: 'clindamycin_tretinoin',
      medicineName: 'Clindamycin 1% with tretinoin 0.025% gel',
      activeIngredient: 'clindamycin + tretinoin',
      line: 1,
      dose: '1%/0.025%',
      frequency: 'Once daily at night',
      duration: '6 weeks, then review',
      repeats: 0,
      contraindications: [...RETINOID_TERATOGENIC],
      cautions: [
        'Use of topical clindamycin should be limited to a total of 3 months to limit development of resistance.',
        RETINOID_TITRATION,
        SUPPLY_LIMIT,
      ],
      allergyConflicts: ['clindamycin', 'tretinoin'],
      counsellingPoints: [
        REVIEW_AT_6_WEEKS,
        'Use only a pea size amount for the whole face.',
        RETINOID_TITRATION,
        'Comprehensive contraceptive counselling MUST be provided to any female of child-bearing age supplied a topical retinoid.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'No contraindications, precautions or interactions are stated in the protocol ' +
        'beyond teratogenicity and the clindamycin resistance limit — delegated to ' +
        'Therapeutic Guidelines / AMH.',
      sourceId: SOURCE_ID,
    },

    // ── Second line: single-agent topical clindamycin ───────────────────────
    {
      id: 'clindamycin_single',
      medicineName: 'Clindamycin 1% topical liquid or lotion',
      activeIngredient: 'clindamycin',
      line: 2,
      dose: '1%',
      frequency: 'Twice daily',
      duration: '6 weeks, then review',
      repeats: 0,
      contraindications: [],
      cautions: [
        'As a single agent preparation, clindamycin should only be provided if the patient’s skin is prone to irritation (e.g. patients with atopic skin conditions).',
        'Use of topical clindamycin should be limited to a total of 3 months to limit development of resistance. Topical clindamycin should be discontinued when inflammatory lesions have adequately resolved, but may be resumed if inflammation recurs.',
        SUPPLY_LIMIT,
      ],
      allergyConflicts: ['clindamycin'],
      counsellingPoints: [
        'Apply to the affected area(s) twice daily for 6 weeks, then review.',
        'Discontinue once inflammatory lesions have adequately resolved.',
        'Do not use for more than 3 months continuously — this limits the development of resistance.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'Second-line and restricted to patients whose skin is prone to irritation. No ' +
        'contraindications, precautions or interactions are stated in the protocol — ' +
        'delegated to Therapeutic Guidelines / AMH.',
      sourceId: SOURCE_ID,
    },
  ],

  excludedMedicines: [
    {
      medicineName: 'Schedule 2 and Schedule 3 acne treatments',
      reason:
        'There are no changes to the scope for pharmacists to supply other Schedule 2 ' +
        'and 3 treatments for mild acne — these are excluded from the Program. ' +
        '(Note: adapalene is available as a Schedule 3 formulation.)',
    },
    {
      medicineName: 'Oral isotretinoin',
      reason:
        'Not on the Medicines List. This protocol authorises supply of TOPICAL ' +
        'medications only. Severe, cystic or scarring acne must be referred to a ' +
        'medical practitioner.',
    },
    {
      medicineName: 'Oral antibiotics',
      reason:
        'Not on the Medicines List. This protocol authorises supply of TOPICAL ' +
        'medications only. Where acne is widespread, systemic treatment may be ' +
        'warranted — refer to a medical practitioner.',
    },
  ],

  followUp: [
    'Topical treatment for mild acne should be reviewed every 6 weeks to assess effectiveness and tolerance.',
    'Earlier review can be considered, especially if the patient is unable to tolerate treatment (sensitivity or reaction).',
    'Where feasible, follow-up reviews should be conducted by the same pharmacist to enable continuity of care.',
    'Advise the patient to review treatment in 6 weeks with a medical practitioner or pharmacist, and to return earlier if required (e.g. intolerance to treatment).',
    'It is recommended that acne treatments are reviewed for efficacy after 6 weeks, but continued for at least 3–4 months of daily use before being labelled as not effective. Treatment failure is most often associated with issues with adherence and incorrect use.',
    'Patients should be changed to maintenance treatment with a single agent (e.g. topical retinoid or benzoyl peroxide) once papular inflammation has resolved or inflammatory acne is under control.',
    'The use of topical antibiotics (e.g. topical clindamycin) should be limited to a total of 3 months to limit development of resistance. Topical clindamycin should be discontinued when inflammatory lesions have adequately resolved, but may be resumed if inflammation recurs, with regular review for ongoing need.',
    'Provide a patient handout outlining the consultation and remind the patient to present it at their next follow-up/review.',
  ],

  safetyNetting: [
    'Acne worsens',
    'The condition has a marked negative emotional and social effect on the patient',
    'Any adverse effects or intolerance of treatment cannot be managed in the pharmacy setting',
    'Inadequate response to treatment despite appropriate use and good adherence to the recommended treatment',
  ],

  documentationRequirements: [
    'Sufficient information to identify the patient (Medicare number and date of birth are usually recorded when dispensing prescriptions)',
    'Date of treatment',
    'Name of the pharmacist who undertook the consultation and their Healthcare Provider Identifier-Individual (HPI-I) number',
    'Consent given by the patient regarding: Program participation, costs, pharmacist communication with other healthcare practitioners (e.g. patient’s usual treating GP) and access to the patient’s My Health Record for the purpose of checking inclusion/exclusion criteria and uploading information relating to the consultation as required',
    'Any information known to the pharmacist that is relevant to the patient’s diagnosis or treatment and any observations and assessments including allergies and adverse reactions',
    'Any clinical opinion reached by the pharmacist',
    'Actions taken by the pharmacist, including management plan and/or referrals made to a medical practitioner or other healthcare professionals',
    'The particulars of any medications supplied to the patient, such as formulation, strength and amount',
    'Information or advice given to the patient in relation to any treatment proposed by the pharmacist such as counselling on side effects',
    'The pharmacist must share a copy of the record of the service with the patient and with the patient’s usual treating medical practitioner or medical practice, where the patient has one',
    'The pharmacist must make a record in the pharmacy software and an IT system approved by the Victorian Department of Health, regarding the supply',
  ],
};
