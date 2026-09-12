/**
 * Shared clinical primitives
 * --------------------------
 * Small, testable, reusable clinical facts that several protocols need.
 *
 * Deliberately conservative: anything that would require a clinical judgement
 * or a threshold we cannot cite is NOT implemented here. Inventing a renal
 * threshold or a weight-band dose is exactly what this sprint is meant to
 * stop.
 */

/** Whole years between a date of birth and a reference date. */
export function ageFromDob(dob: string | undefined | null, at: Date = new Date()): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  let age = at.getFullYear() - born.getFullYear();
  const monthDiff = at.getMonth() - born.getMonth();
  // Adjust when the birthday has not yet occurred this year.
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < born.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

/** Inclusive age band check. Null age is "unknown", not "in band". */
export function isWithinAgeBand(
  age: number | null,
  minYears: number,
  maxYears: number,
): boolean | null {
  if (age === null) return null;
  return age >= minYears && age <= maxYears;
}

/**
 * Pregnancy status as the protocols model it.
 * `possibly_pregnant` is treated the same as `pregnant` for every exclusion we
 * have seen: the protocols say "pregnant or possibly pregnant".
 */
export type PregnancyStatus =
  | 'not_pregnant'
  | 'pregnant'
  | 'possibly_pregnant'
  | 'not_applicable'
  | 'unknown';

export function isPregnancyExcluded(status: PregnancyStatus | string | undefined): boolean | null {
  if (!status) return null;
  return status === 'pregnant' || status === 'possibly_pregnant';
}
