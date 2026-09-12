/**
 * CANONICAL PROTOCOL — Acute exacerbation of mild to moderate atopic dermatitis (Victoria)
 * ========================================================================================
 * Source: Victorian Department of Health, "Protocol for Management of Acute
 * Exacerbations of Mild to Moderate Atopic Dermatitis", The Victorian
 * Community Pharmacist Program, July 2026. ISBN/ISSN 978-1-76131-993-8.
 * Retrieved 2026-09-13.
 *
 * Verified by reading the retrieved PDF.
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────
 * This is a FLARE protocol. It covers acute exacerbations of mild to moderate
 * atopic dermatitis only. It is NOT a maintenance-management protocol, and it
 * is not a protocol for undiagnosed rash: the patient must already have been
 * diagnosed with atopic dermatitis by a medical or nurse practitioner.
 *
 * Supply is capped at approximately 7 days of topical corticosteroid (TCS).
 * Anything needing longer belongs with a medical practitioner.
 *
 * ── WHAT THIS DOCUMENT DOES *NOT* CONTAIN ──────────────────────────────────
 * The Medicines List has exactly two columns: "Dose" and "Pack size examples".
 * There are NO per-product contraindications, precautions or interactions.
 * The protocol delegates all of them:
 *
 *   "Pharmacists must consult the Therapeutic Guidelines, Australian Medicines
 *    Handbook, and other relevant references to confirm the management is
 *    appropriate, including for: Contraindications and precautions ·
 *    Medication interactions · Pregnancy and lactation"
 *
 * So the arrays below are deliberately empty rather than populated with
 * plausible content we cannot cite. A safety engine must treat these products
 * as "no protocol-stated contraindications — pharmacist must confirm against
 * TG/AMH", never as "no contraindications".
 *
 * ── LIFECYCLE ──────────────────────────────────────────────────────────────
 * 'source_verified': transcribed from the retrieved official document, awaiting
 * sign-off by a practising pharmacist prescriber. Renders in REFERENCE /
 * DEVELOPMENT mode.
 */

import type { ProtocolDefinition } from '../types';

const SOURCE_ID = 'VIC_CCN_DERMATITIS_2026_08';

/** Applied to every TCS in this protocol. */
const SUPPLY_LIMIT =
  'The quantity of TCS supplied should be sufficient for 7 days of treatment. ' +
  'This may require several packs, depending on the affected body surface area.';

const UNTIL_CLEAR = 'Apply to affected areas until skin is clear';

/**
 * The protocol gives no product-specific cautions, so this is the one safety
 * statement it makes about all TCS, plus the delegation to external references.
 */
const DELEGATED_SAFETY =
  'This protocol states no product-specific contraindications, precautions or ' +
  'interactions. Pharmacists must consult the Therapeutic Guidelines, Australian ' +
  'Medicines Handbook and other relevant references to confirm suitability.';

export const dermatitisProtocol: ProtocolDefinition = {
  id: SOURCE_ID,
  conditionId: 'atopic-dermatitis-flare',
  conditionName: 'Acute exacerbation of mild to moderate atopic dermatitis (eczema)',
  title: 'Protocol for Management of Acute Exacerbations of Mild to Moderate Atopic Dermatitis',
  jurisdiction: 'VIC',
  authorityName: 'Victorian Department of Health',
  sourceId: SOURCE_ID,
  sourceType: 'government',
  lifecycle: 'source_verified',
  effectiveDate: '2026-07-01',
  needsClinicalReview: true,
  reviewNote:
    'Transcribed from the retrieved official Victorian protocol (July 2026, ' +
    'ISBN/ISSN 978-1-76131-993-8). Awaiting sign-off by a practising pharmacist ' +
    'prescriber. Four open items MUST be resolved before this drives a live ' +
    'consultation: (1) one red-flag criterion appears to have been lost in PDF ' +
    'extraction at page 7 and must be recovered from the source; (2) the protocol ' +
    'states NO per-product contraindications, cautions or interactions — they are ' +
    'delegated to TG/AMH and must not be invented; (3) the methylprednisolone ' +
    'aceponate 0.1% lotion site differs between page 8 ("Scalp (children)") and ' +
    'page 16 ("Scalp (children or adults)"); (4) severity bands have gaps — EASI ' +
    '7.0–7.1 and SCORAD exactly 50 are unclassified.',

  eligibility: [
    {
      id: 'age_2_to_65',
      label: 'Patient is aged between 2 and 65 years inclusive',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'previously_diagnosed',
      label:
        'Patient has been previously diagnosed with atopic dermatitis (eczema) by a ' +
        'medical or nurse practitioner. Only such patients can be managed under this ' +
        'Protocol.',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'acute_flare_under_2_weeks',
      label:
        'Suspected recent flare up (less than 2 weeks) of mild to moderate atopic ' +
        'dermatitis following stable/intermittent symptoms, with typical features ' +
        'including BOTH itch and rash (e.g. itchy, dry, erythematous patches, ' +
        'typically on the face, flexures, wrists, ankles, neck and groin). Both rash ' +
        'and itch must be present for a diagnosis of atopic dermatitis.',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'skin_examination_performed',
      label:
        'A physical skin examination has been performed to confirm the presenting signs ' +
        'and symptoms and to assess and classify severity',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'face_not_involved',
      label:
        'Dermatitis does NOT involve the face (including periorbital or perioral ' +
        'regions). Patients with facial dermatitis are not eligible and should be ' +
        'referred to a medical practitioner for assessment.',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'consent_and_present',
      label:
        'Patient/parent/caregiver consents and the patient is physically present at ' +
        'the pharmacy',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'pharmacist_training_current',
      label:
        'Pharmacist has completed the current training requirements specified in the ' +
        'departmental guidance',
      ifUnmet: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
  ],

  redFlags: [
    // ── Immediate emergency medical care ────────────────────────────────────
    {
      id: 'severe_widespread_painful_rash',
      label: 'Severe, widespread, or painful rash',
      action: 'Refer for immediate emergency medical care',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'non_blanching_purple_rash',
      label: 'Non-blanching purple rash',
      action: 'Refer for immediate emergency medical care',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'widespread_erythema',
      label: 'Widespread erythema involving most of the body or multiple body regions',
      action: 'Refer for immediate emergency medical care',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'systemic_illness',
      label:
        'Signs of sepsis, systemic illness or other complications, including fever, ' +
        'lethargy, nausea, vomiting, or headache',
      action: 'Refer for immediate emergency medical care',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'blistering',
      label: 'Blistering of the skin, mucous membranes, or eyes',
      action: 'Refer for immediate emergency medical care',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'eczema_herpeticum',
      label:
        'Suspected eczema herpeticum (secondary infection of atopic dermatitis with ' +
        'herpes simplex virus), particularly with eye involvement — including ' +
        'ophthalmology assessment where relevant',
      action: 'Refer for immediate emergency medical care',
      outcome: 'emergency_department',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },

    // ── Routine GP referral, supply NOT permitted ───────────────────────────
    {
      id: 'unclear_or_atypical',
      label: 'Unclear diagnosis or atypical presentation of atopic dermatitis, different to historical flares',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'insufficient_response',
      label: 'Insufficient response to treatments in the Medicines List, despite appropriate trial',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'severe_disease',
      label:
        'Severe atopic dermatitis (e.g. intense persistent itch with widespread rash or ' +
        'severe lesions, or SCORAD >50 or EASI >21)',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'bsa_over_30',
      label: 'Significant body surface area involvement (greater than 30% body surface area)',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'secondary_infection',
      label:
        'Complex or complicated presentation, such as signs of secondary viral or ' +
        'bacterial infection — weeping, yellow crusts or pustules, grouped vesicles, ' +
        'punched-out erosions, or persistent dermatitis despite appropriate topical therapy',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'chronic_broken_skin',
      label: 'Non-healing broken skin, sores, ulcers, or crusts that are chronic (more than 4 weeks)',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'paediatric_concerns',
      label:
        'Paediatric patient with a history of immediate or delayed-type hypersensitivity ' +
        'to food, poor feeding or sleep, or concerns about failure to thrive',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'pregnant_or_planning',
      label: 'Pregnant or planning a pregnancy',
      action: 'Refer to General Practitioner. (Note: breastfeeding is NOT listed as an exclusion criterion — see reviewNote.)',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'immunocompromised',
      label:
        'Immunocompromised — due to underlying medical condition (e.g. transplant ' +
        'recipients, malignancies, chemotherapy, HIV infection, uncontrolled diabetes, ' +
        'advanced age) or due to medication (such as immunomodulatory therapy, extended ' +
        'prednisolone therapy)',
      action: 'Refer to General Practitioner',
      outcome: 'refer_routine',
      prescribingBlocked: true,
      sourceId: SOURCE_ID,
    },
    {
      id: 'all_treatments_contraindicated',
      label:
        'Where therapy is considered the appropriate treatment option but all ' +
        'recommended treatments under this protocol are contraindicated',
      action: 'Refer to General Practitioner',
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
      action: 'Proceed to pharmacotherapy AND/OR refer to General Practitioner for immediate review and follow up',
      outcome: 'treat_and_refer',
      prescribingBlocked: false,
      sourceId: SOURCE_ID,
    },
    {
      id: 'no_eczema_care_plan',
      label:
        'The patient does not have an eczema care plan, OR the patient/carer is ' +
        'uncertain about their long-term management approach (e.g. symptoms are ' +
        'recurrent, not well controlled, or changing in pattern)',
      action:
        'Proceed to pharmacotherapy AND/OR refer to General Practitioner. Patients ' +
        'without an existing eczema care plan should be referred to a medical ' +
        'practitioner and provided with information on how to access one.',
      outcome: 'treat_and_refer',
      prescribingBlocked: false,
      sourceId: SOURCE_ID,
    },
  ],

  nonDrugManagement: [
    'Everyday skin care, including bathing/showering in lukewarm water for up to 5 minutes, using a non-soap cleanser and/or bath oil.',
    'Regular moisturiser use — pat skin dry after washing (or swimming) and, using clean hands, apply a generous or thick amount of moisturiser to the entire body (top-to-toe, not just areas affected by atopic dermatitis). Apply moisturiser after TCS.',
    'Advise use of emollient soap substitutes or fragrance-free bath oils.',
    'Avoid aggravating factors: topical products containing soap, fragrances, food-related ingredients (e.g. nuts, coconut, dairy), essential oils, aqueous cream, methylchloroisothiazolinone, methylisothiazolinone, or benzalkonium chloride (in laundry sanitisers, nappy wipes and creams).',
    'Avoid overheating (e.g. due to clothing, bath temperature, waterproof mattress protectors, hot cars or classrooms).',
    'Avoid prickly fabrics (e.g. thick fibres or wool) or synthetics (e.g. nylon, polyester, viscose). Cut off clothing tags; use cotton clothing and bed linen.',
    'Avoid scratching (keep fingernails short).',
    'Ensure the patient has access to an Eczema Care Plan and other written resources (e.g. a self-care fact card), and support them to identify when a review or update of the plan may be required with their medical practitioner.',
    'Severity assessment: consider extent of affected skin, intensity of signs (erythema, swelling, oozing/crusting, excoriation, lichenification, dryness) and effect on quality of life. Conventional scoring systems may underestimate severity and erythema in people with darker skin tones — where there is uncertainty, use EASI and upgrade the score by 1 grade or more for heavily pigmented skin (e.g. mild to moderate).',
    'Body surface area may be estimated with the Palmar Method: the palmar surface of the patient’s own hand, from the distal wrist crease to the closed tips of all five digits, equals 1% of total BSA.',
  ],

  /**
   * NOTE ON "LINE": this protocol does not rank medicines by line of therapy.
   * Selection is by BODY SITE. `line` is therefore set to 1 for all entries and
   * must not be read as a preference order — the `cautions` site field carries
   * the actual selection rule.
   */
  medicines: [
    {
      id: 'moisturiser',
      medicineName: 'Moisturisers (emollients, soap substitutes, fragrance-free bath oils)',
      line: 1,
      dose: 'Generous or thick amount',
      frequency: 'Regularly, particularly after bathing or showering',
      duration: 'Ongoing',
      contraindications: [],
      cautions: [DELEGATED_SAFETY],
      counsellingPoints: [
        'Encourage regular use, particularly after bathing or showering, to reduce water loss from the skin.',
        'Pat skin dry after washing and apply a generous or thick amount to the entire body, not just affected areas.',
        'Apply moisturiser AFTER topical corticosteroid.',
      ],
      needsClinicalReview: true,
      reviewNote:
        'The protocol specifies no product, strength, frequency or quantity for ' +
        'moisturisers — only "generous" use. Do not add quantities without a source.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'betamethasone_dipropionate_lotion',
      medicineName: 'Betamethasone dipropionate 0.05% lotion',
      activeIngredient: 'betamethasone dipropionate',
      line: 1,
      dose: '0.05%',
      frequency: 'Once to twice daily',
      duration: 'Until skin is clear; supply sufficient for 7 days',
      quantity: 30,
      contraindications: [],
      cautions: [
        'Site: scalp (adults).',
        UNTIL_CLEAR + '.',
        SUPPLY_LIMIT,
        DELEGATED_SAFETY,
      ],
      counsellingPoints: [
        'Apply once to twice daily to affected areas until skin is clear.',
        SUPPLY_LIMIT,
        'Apply TCS generously (not sparingly) to all areas of active atopic dermatitis, not just the worst areas, including cracked or open skin.',
        'Apply moisturiser after TCS.',
        'Some improvement would be expected within 7 days of starting TCS.',
      ],
      needsClinicalReview: true,
      reviewNote: 'No product-specific contraindications, cautions or interactions are stated in the protocol — delegated to TG/AMH.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'hydrocortisone_1_ointment',
      medicineName: 'Hydrocortisone 1% ointment',
      activeIngredient: 'hydrocortisone',
      line: 1,
      dose: '1%',
      frequency: 'Once to twice daily',
      duration: 'Until skin is clear; supply sufficient for 7 days',
      quantity: 30,
      contraindications: [],
      cautions: [
        'Site: sensitive areas (neck, axillae, or groin).',
        UNTIL_CLEAR + '.',
        SUPPLY_LIMIT,
        DELEGATED_SAFETY,
      ],
      counsellingPoints: [
        'Apply once to twice daily to affected areas until skin is clear.',
        'For sensitive areas: neck, axillae or groin.',
        SUPPLY_LIMIT,
        'Apply TCS generously (not sparingly) to all areas of active atopic dermatitis, not just the worst areas.',
        'Apply moisturiser after TCS.',
      ],
      needsClinicalReview: true,
      reviewNote: 'No product-specific contraindications, cautions or interactions are stated in the protocol — delegated to TG/AMH.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'methylprednisolone_aceponate_ointment',
      medicineName: 'Methylprednisolone aceponate 0.1% ointment or fatty ointment',
      activeIngredient: 'methylprednisolone aceponate',
      line: 1,
      dose: '0.1%',
      frequency: 'Once daily',
      duration: 'Until skin is clear; supply sufficient for 7 days',
      quantity: 15,
      contraindications: [],
      cautions: [
        'Site: trunk, limbs, flexures, palms, soles, or thickened lichenified areas.',
        UNTIL_CLEAR + '.',
        SUPPLY_LIMIT,
        DELEGATED_SAFETY,
      ],
      counsellingPoints: [
        'Apply once daily to affected areas until skin is clear.',
        'For trunk, limbs, flexures, palms, soles or thickened lichenified areas.',
        SUPPLY_LIMIT,
        'Apply TCS generously (not sparingly) to all areas of active atopic dermatitis.',
      ],
      needsClinicalReview: true,
      reviewNote: 'No product-specific contraindications, cautions or interactions are stated in the protocol — delegated to TG/AMH.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'methylprednisolone_aceponate_lotion',
      medicineName: 'Methylprednisolone aceponate 0.1% lotion',
      activeIngredient: 'methylprednisolone aceponate',
      line: 1,
      dose: '0.1%',
      frequency: 'Once daily',
      duration: 'Until skin is clear; supply sufficient for 7 days',
      quantity: 20,
      contraindications: [],
      cautions: [
        'Site: scalp. ⚠️ The protocol is inconsistent — page 8 says "Scalp (children)", page 16 says "Scalp (children or adults)". Resolve before encoding an age rule.',
        UNTIL_CLEAR + '.',
        SUPPLY_LIMIT,
        DELEGATED_SAFETY,
      ],
      counsellingPoints: [
        'Apply once daily to affected areas until skin is clear.',
        'For the scalp.',
        SUPPLY_LIMIT,
      ],
      needsClinicalReview: true,
      reviewNote:
        'Site conflict between page 8 ("Scalp (children)") and page 16 ("Scalp ' +
        '(children or adults)"). Pack size is printed as "20g" for a lotion while all ' +
        'other lotions use mL — likely 20mL but NOT stated. No product-specific ' +
        'contraindications, cautions or interactions are given.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'mometasone_furoate_ointment',
      medicineName: 'Mometasone furoate 0.1% ointment',
      activeIngredient: 'mometasone furoate',
      line: 1,
      dose: '0.1%',
      frequency: 'Once daily',
      duration: 'Until skin is clear; supply sufficient for 7 days',
      quantity: 15,
      contraindications: [],
      cautions: [
        'Site: trunk, limbs, flexures, palms, soles, or thickened lichenified areas.',
        UNTIL_CLEAR + '.',
        SUPPLY_LIMIT,
        DELEGATED_SAFETY,
      ],
      counsellingPoints: [
        'Apply once daily to affected areas until skin is clear.',
        'For trunk, limbs, flexures, palms, soles or thickened lichenified areas.',
        SUPPLY_LIMIT,
        'Apply TCS generously (not sparingly) to all areas of active atopic dermatitis.',
      ],
      needsClinicalReview: true,
      reviewNote: 'No product-specific contraindications, cautions or interactions are stated in the protocol — delegated to TG/AMH.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'mometasone_furoate_lotion',
      medicineName: 'Mometasone furoate 0.1% lotion',
      activeIngredient: 'mometasone furoate',
      line: 1,
      dose: '0.1%',
      frequency: 'Once daily',
      duration: 'Until skin is clear; supply sufficient for 7 days',
      quantity: 30,
      contraindications: [],
      cautions: ['Site: scalp (adults).', UNTIL_CLEAR + '.', SUPPLY_LIMIT, DELEGATED_SAFETY],
      counsellingPoints: [
        'Apply once daily to affected areas until skin is clear.',
        'For the scalp (adults).',
        SUPPLY_LIMIT,
      ],
      needsClinicalReview: true,
      reviewNote: 'No product-specific contraindications, cautions or interactions are stated in the protocol — delegated to TG/AMH.',
      sourceId: SOURCE_ID,
    },
    {
      id: 'mometasone_furoate_hydrogel',
      medicineName: 'Mometasone furoate 0.1% hydrogel',
      activeIngredient: 'mometasone furoate',
      line: 1,
      dose: '0.1%',
      frequency: 'Once daily',
      duration: 'Until skin is clear; supply sufficient for 7 days',
      quantity: 15,
      contraindications: [],
      cautions: ['Site: scalp (adults).', UNTIL_CLEAR + '.', SUPPLY_LIMIT, DELEGATED_SAFETY],
      counsellingPoints: [
        'Apply once daily to affected areas until skin is clear.',
        'For the scalp (adults).',
        SUPPLY_LIMIT,
      ],
      needsClinicalReview: true,
      reviewNote: 'No product-specific contraindications, cautions or interactions are stated in the protocol — delegated to TG/AMH.',
      sourceId: SOURCE_ID,
    },
  ],

  excludedMedicines: [
    {
      medicineName: 'Pimecrolimus',
      reason:
        'Pimecrolimus, crisaborole, and liquor picis carbonis (LPC, or coal tar ' +
        'solution) +/- keratolytics (e.g. salicylic acid) are also treatment options ' +
        'for atopic dermatitis. These are not included for supply under the Program, ' +
        'which has focused on supply of TCS.',
    },
    {
      medicineName: 'Crisaborole',
      reason: 'Not included for supply under the Program, which has focused on supply of TCS.',
    },
    {
      medicineName: 'Liquor picis carbonis (coal tar solution) +/- keratolytics',
      reason: 'Not included for supply under the Program, which has focused on supply of TCS.',
    },
  ],

  followUp: [
    'Some improvement would be expected within 7 days of starting TCS.',
    'Advise the patient to seek review with a medical practitioner if: no improvement or worsening of symptoms within 7 days; further supply of TCS is required; or symptoms are recurrent, worsening, or not well controlled.',
    'If more than 7 days supply of TCS is required, the patient should see a medical practitioner for review and further prescriptions. A medical practitioner may prescribe TCS at higher quantities with PBS subsidised authority prescriptions.',
    'Advise the patient to seek care for signs and symptoms that suggest infection of atopic dermatitis.',
    'Continue TCS use until the skin is clear. TCS may be restarted at the beginning of a new flare of atopic dermatitis.',
    'Pharmacist follow up or clinical review should only occur where there has been clear improvement in symptoms, and where care can be appropriately managed within usual pharmacist care. If there is no improvement, worsening, or need for ongoing TCS treatment beyond 7 days, the patient should be referred to a medical practitioner.',
    'Discuss whether the patient may be eligible for a PBS authority prescription through a medical practitioner, which may allow supply of larger quantities of TCS at reduced cost, particularly for concession card holders.',
    'The agreed management plan should be shared with members of the patient’s multidisciplinary healthcare team, with the patient’s consent.',
  ],

  safetyNetting: [
    'No improvement or worsening of symptoms within 7 days of commencing TCS treatment',
    'Need for TCS beyond 7 days',
    'Signs and symptoms that suggest infection of atopic dermatitis (weeping, yellow crusts or pustules, grouped vesicles, punched-out erosions)',
    'Fever, lethargy, nausea, vomiting or headache with a widespread or painful rash',
    'Blistering of the skin, mucous membranes or eyes',
    'Non-blanching purple rash',
  ],

  documentationRequirements: [
    'Sufficient information to identify the patient (Medicare number and date of birth are usually recorded when dispensing prescriptions)',
    'Date of treatment',
    'Name of the pharmacist who undertook the consultation and their Healthcare Provider Identifier Individual (HPI-I) number',
    'Consent given by the patient regarding: program participation, costs, pharmacist communication with other healthcare practitioners (e.g. patient’s usual treating general practitioner) and access to the patient’s My Health Record for the purpose of checking inclusion/exclusion criteria and uploading information relating to the consultation as required',
    'Any information known to the pharmacist that is relevant to the patient’s diagnosis or treatment (including TCS preparations used previously to treat atopic dermatitis) and any observations and assessments including allergies and adverse drug reactions',
    'Any clinical opinion reached by the pharmacist',
    'Actions taken by the pharmacist (including any medications supplied or referrals made to a medical practitioner)',
    'Particulars of any medications supplied to the patient (such as form, strength and amount)',
    'Information or advice given to the patient in relation to any treatment proposed by the pharmacist who is treating the patient',
    'The pharmacist must share a copy of the record of the service with the patient and, if the patient consents, with the patient’s usual treating medical practitioner or medical practice, where the patient has one',
    'The pharmacist must make a record in the pharmacy software, and an IT system approved by the Victorian Department of Health, regarding the supply',
  ],
};
