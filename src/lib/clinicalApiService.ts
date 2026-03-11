/**
 * Clinical API Service — Typed frontend wrappers for the clinical-api-proxy edge function.
 * All calls go through server-side proxy. Never calls external APIs directly.
 *
 * Each function: validates input, handles errors, returns typed results.
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface PbsCacheItem {
  pbsCode: string;
  itemCode: string;
  mpPt: string;
  tpuuOrMppPt: string;
  manufacturer: string;
  packSize: string;
  maxQty: number | null;
  numRepeats: number | null;
  scheduleCode: string;
  programCode: string;
  restrictionFlag: string;
  atcCode: string;
  atcName: string;
  feeAmount: number | null;
  benefitType: string;
}

export interface ClinicalSearchResult {
  code: string;
  label: string;
  system: string;
  synonyms: string[];
}

export interface ClinicalSearchResponse {
  total: number;
  results: ClinicalSearchResult[];
  error?: string;
}

export interface PatientEducationLink {
  title: string;
  summary: string;
  url: string;
  source: string;
  category?: string;
}

export interface MedlineTopicResult {
  title: string;
  snippet: string;
  url: string;
}

export interface NormalizedMedicine {
  matched: boolean;
  raw_text: string;
  matched_name?: string;
  rxnorm_rxcui?: string;
  ingredient?: string;
  strength?: string;
  dose_form?: string;
  brand_or_generic?: string;
  source?: string;
  disclaimer?: string;
  error?: string;
}

export interface DrugClassInfo {
  className: string;
  classType: string;
  classId: string;
}

export interface OpenFdaRecall {
  recallNumber: string;
  reason: string;
  status: string;
  classification: string;
  recallDate: string;
  product: string;
}

export interface OpenFdaAdverseReaction {
  term: string;
  count: number;
}

export interface OpenFdaSafetyResult {
  type: string;
  items?: OpenFdaRecall[];
  reactions?: OpenFdaAdverseReaction[];
  indications?: string;
  warnings?: string;
  contraindications?: string;
  adverseReactions?: string;
  disclaimer: string;
  error?: string;
}

export interface WeatherCurrent {
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
}

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  uvIndexMax: number;
  precipitationSum: number;
  weatherCode: number;
}

export interface TravelWeatherContext {
  current?: WeatherCurrent;
  daily?: WeatherDay[];
  destination?: string;
  alerts?: string[];
  error?: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  countryCode: string;
  error?: string;
}

// ── Proxy call helper ──

async function callProxy<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'moyonkosvvufpzxxjlle';
  const url = `https://${projectId}.supabase.co/functions/v1/clinical-api-proxy`;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1veW9ua29zdnZ1ZnB6eHhqbGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MjQ1MzcsImV4cCI6MjA4ODAwMDUzN30.uEh_a37t1O67v53Iu5WHLeL8nTbyD9txxUvf9YeFMBs',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, params }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API call failed: ${res.status}`);
  }

  return res.json();
}

// ── Public API ──

/** Search PBS medicines via server-side cached proxy */
export async function searchPbsMedicines(query: string): Promise<PbsCacheItem[]> {
  if (!query || query.trim().length < 2) return [];
  return callProxy<PbsCacheItem[]>('pbs_search', { query: query.trim() });
}

/**
 * Search clinical terms via NIH Clinical Tables.
 * type: 'conditions' | 'medications' | 'codes'
 */
export async function searchClinicalTerms(
  query: string,
  type: 'conditions' | 'medications' | 'codes' = 'conditions'
): Promise<ClinicalSearchResponse> {
  if (!query || query.trim().length < 2) return { total: 0, results: [] };
  return callProxy<ClinicalSearchResponse>('nih_search', { query: query.trim(), type });
}

/** Get patient education links from MedlinePlus Connect by diagnosis code */
export async function getPatientEducationLinks(
  code: string,
  codeSystem = 'ICD-10-CM'
): Promise<PatientEducationLink[]> {
  if (!code) return [];
  return callProxy<PatientEducationLink[]>('medlineplus_connect', { code, codeSystem });
}

/** Search MedlinePlus health topics by keyword */
export async function searchMedlineTopics(query: string): Promise<MedlineTopicResult[]> {
  if (!query || query.trim().length < 2) return [];
  return callProxy<MedlineTopicResult[]>('medlineplus_search', { query: query.trim() });
}

/** Normalize a medicine name via RxNorm (US — supplementary use only) */
export async function normalizeMedicine(name: string): Promise<NormalizedMedicine> {
  if (!name || name.trim().length < 2) return { matched: false, raw_text: name };
  return callProxy<NormalizedMedicine>('rxnorm_normalize', { name: name.trim() });
}

/** Get drug class information via RxClass */
export async function getDrugClasses(rxcui: string): Promise<DrugClassInfo[]> {
  if (!rxcui) return [];
  return callProxy<DrugClassInfo[]>('rxnorm_class', { rxcui });
}

/** Get medicine safety data from openFDA */
export async function getMedicineSafetyData(
  drugName: string,
  type: 'recall' | 'adverse' | 'label' = 'recall'
): Promise<OpenFdaSafetyResult> {
  if (!drugName) return { type, disclaimer: 'No drug specified', error: 'No drug name' };
  return callProxy<OpenFdaSafetyResult>('openfda_safety', { drugName: drugName.trim(), type });
}

/** Get travel weather context from Open-Meteo (requires coordinates) */
export async function getTravelWeatherContext(
  lat: number,
  lng: number,
  destination?: string
): Promise<TravelWeatherContext> {
  return callProxy<TravelWeatherContext>('weather_context', { lat, lng, destination });
}

/** Geocode a location name via server-side Nominatim (throttled, cached) */
export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  if (!query || query.trim().length < 2) return { latitude: 0, longitude: 0, displayName: '', countryCode: '', error: 'Query too short' };
  return callProxy<GeocodeResult>('geocode', { query: query.trim() });
}
