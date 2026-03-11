/**
 * clinical-api-proxy — Unified server-side proxy for external clinical APIs.
 * Routes: POST with { action, params }
 *
 * Supported actions:
 *   pbs_search, pbs_sync, nih_search, medlineplus_connect,
 *   medlineplus_search, rxnorm_normalize, rxnorm_class,
 *   openfda_safety, weather_context, geocode
 *
 * All responses cached in external_api_cache with TTL.
 * Logs each call to external_api_logs.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function checkCache(sb: ReturnType<typeof createClient>, key: string) {
  const { data } = await sb
    .from("external_api_cache")
    .select("response_data, expires_at, id")
    .eq("cache_key", key)
    .single();
  if (data && new Date(data.expires_at) > new Date()) {
    await sb.from("external_api_cache").update({ hit_count: (data as any).hit_count + 1 }).eq("id", data.id);
    return data.response_data;
  }
  return null;
}

async function setCache(
  sb: ReturnType<typeof createClient>,
  key: string,
  provider: string,
  data: unknown,
  ttlMinutes: number
) {
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  await sb.from("external_api_cache").upsert(
    { cache_key: key, provider, response_data: data, expires_at: expires, hit_count: 0, created_at: new Date().toISOString() },
    { onConflict: "cache_key" }
  );
}

async function logApiCall(
  sb: ReturnType<typeof createClient>,
  provider: string,
  endpoint: string,
  statusCode: number | null,
  responseTimeMs: number,
  cacheHit: boolean,
  errorMessage?: string
) {
  await sb.from("external_api_logs").insert({
    provider,
    endpoint,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    cache_hit: cacheHit,
    error_message: errorMessage ?? null,
  });
}

async function fetchWithTimeout(url: string, timeoutMs = 10000, options?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function checkFeatureFlag(sb: ReturnType<typeof createClient>, key: string): Promise<boolean> {
  const { data } = await sb
    .from("integration_feature_flags")
    .select("enabled")
    .eq("feature_key", key)
    .single();
  return data?.enabled ?? false;
}

// ── Action handlers ──

async function handlePbsSearch(sb: ReturnType<typeof createClient>, params: { query: string }) {
  const cacheKey = `pbs_search:${params.query.toLowerCase().trim()}`;
  const cached = await checkCache(sb, cacheKey);
  if (cached) {
    await logApiCall(sb, "pbs", "search", 200, 0, true);
    return cached;
  }

  const start = Date.now();
  try {
    // PBS API v3 - search by drug name
    const url = `https://data.pbs.gov.au/publication/search?term=${encodeURIComponent(params.query)}&format=json`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    const elapsed = Date.now() - start;

    // Normalize results
    const items = Array.isArray(data?.data) ? data.data.slice(0, 50).map((item: any) => ({
      pbsCode: item.pbs_code || item.li_item_id || '',
      itemCode: item.item_code || '',
      mpPt: item.mp_pt || item.drug_name || '',
      tpuuOrMppPt: item.tpuu_or_mpp_pt || '',
      manufacturer: item.manufacturer_name || '',
      packSize: item.max_quantity ? `${item.max_quantity} units` : '',
      maxQty: item.max_quantity || null,
      numRepeats: item.number_of_repeats || null,
      scheduleCode: item.schedule_code || '',
      programCode: item.program_code || '',
      restrictionFlag: item.restriction_flag || 'Unrestricted',
      atcCode: item.atc_code || '',
      atcName: item.atc_level_name || '',
      feeAmount: item.dispensed_price_max_ex || null,
      benefitType: item.benefit_type_description || '',
    })) : [];

    await setCache(sb, cacheKey, "pbs", items, 60); // 1hr cache
    await logApiCall(sb, "pbs", "search", res.status, elapsed, false);
    return items;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "pbs", "search", null, elapsed, false, String(e));
    // Fallback: search local pbs_medicines_cache
    const { data: localData } = await sb
      .from("pbs_medicines_cache")
      .select("*")
      .ilike("mp_pt", `%${params.query}%`)
      .limit(50);
    return localData || [];
  }
}

async function handleNihSearch(sb: ReturnType<typeof createClient>, params: { query: string; type?: string }) {
  const searchType = params.type || "conditions"; // conditions | medications | codes
  const tableMap: Record<string, string> = {
    conditions: "icd10cm",
    medications: "rxterms",
    codes: "loinc",
  };
  const sf = tableMap[searchType] || "icd10cm";
  const cacheKey = `nih:${sf}:${params.query.toLowerCase().trim()}`;
  const cached = await checkCache(sb, cacheKey);
  if (cached) {
    await logApiCall(sb, "nih", sf, 200, 0, true);
    return cached;
  }

  const start = Date.now();
  try {
    const url = `https://clinicaltables.nlm.nih.gov/api/search?sf=${sf}&terms=${encodeURIComponent(params.query)}&maxList=20`;
    const res = await fetchWithTimeout(url);
    // Response format: [total, codes[], null, display_strings[][]]
    const raw = await res.json();
    const elapsed = Date.now() - start;

    const total = raw[0] || 0;
    const codes = raw[1] || [];
    const displays = raw[3] || [];

    const results = codes.map((code: string, i: number) => ({
      code,
      label: displays[i]?.[0] || code,
      system: sf,
      synonyms: displays[i]?.slice(1) || [],
    }));

    await setCache(sb, cacheKey, "nih", { total, results }, 1440); // 24hr cache
    await logApiCall(sb, "nih", sf, res.status, elapsed, false);
    return { total, results };
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "nih", sf, null, elapsed, false, String(e));
    return { total: 0, results: [], error: "Service temporarily unavailable" };
  }
}

async function handleMedlinePlusConnect(sb: ReturnType<typeof createClient>, params: { code: string; codeSystem?: string; type?: string }) {
  const codeSystem = params.codeSystem || "ICD-10-CM";
  const infoType = params.type || "health_topic";
  const cacheKey = `mlpc:${codeSystem}:${params.code}`;
  const cached = await checkCache(sb, cacheKey);
  if (cached) {
    await logApiCall(sb, "medlineplus_connect", params.code, 200, 0, true);
    return cached;
  }

  const start = Date.now();
  try {
    const url = `https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=${encodeURIComponent(codeSystem)}&mainSearchCriteria.v.c=${encodeURIComponent(params.code)}&informationRecipient.languageCode.c=en&knowledgeResponseType=application/json`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    const elapsed = Date.now() - start;

    const entries = (data?.feed?.entry || []).map((entry: any) => ({
      title: entry.title?._value || entry.title || '',
      summary: entry.summary?._value || '',
      url: entry.link?.[0]?.href || '',
      source: 'MedlinePlus',
      category: entry.category?.[0]?.term || '',
    }));

    await setCache(sb, cacheKey, "medlineplus_connect", entries, 1440);
    await logApiCall(sb, "medlineplus_connect", params.code, res.status, elapsed, false);
    return entries;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "medlineplus_connect", params.code, null, elapsed, false, String(e));
    return [];
  }
}

async function handleMedlinePlusSearch(sb: ReturnType<typeof createClient>, params: { query: string }) {
  const cacheKey = `mlps:${params.query.toLowerCase().trim()}`;
  const cached = await checkCache(sb, cacheKey);
  if (cached) {
    await logApiCall(sb, "medlineplus_web", "search", 200, 0, true);
    return cached;
  }

  const start = Date.now();
  try {
    const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(params.query)}&retmax=10`;
    const res = await fetchWithTimeout(url);
    const text = await res.text();
    const elapsed = Date.now() - start;

    // Parse XML response — extract key fields
    const topics: { title: string; snippet: string; url: string }[] = [];
    const docMatches = text.match(/<document[^>]*>[\s\S]*?<\/document>/g) || [];
    for (const doc of docMatches.slice(0, 10)) {
      const titleMatch = doc.match(/<content name="title">([\s\S]*?)<\/content>/);
      const snippetMatch = doc.match(/<content name="FullSummary">([\s\S]*?)<\/content>/) ||
                           doc.match(/<content name="snippet">([\s\S]*?)<\/content>/);
      const urlAttr = doc.match(/url="([^"]+)"/);
      if (titleMatch) {
        topics.push({
          title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
          snippet: (snippetMatch?.[1] || '').replace(/<[^>]+>/g, '').trim().slice(0, 300),
          url: urlAttr?.[1] || '',
        });
      }
    }

    await setCache(sb, cacheKey, "medlineplus_web", topics, 1440);
    await logApiCall(sb, "medlineplus_web", "search", res.status, elapsed, false);
    return topics;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "medlineplus_web", "search", null, elapsed, false, String(e));
    return [];
  }
}

async function handleRxNormNormalize(sb: ReturnType<typeof createClient>, params: { name: string }) {
  const cacheKey = `rxnorm:${params.name.toLowerCase().trim()}`;
  const cached = await checkCache(sb, cacheKey);
  if (cached) {
    await logApiCall(sb, "rxnorm", "normalize", 200, 0, true);
    return cached;
  }

  const start = Date.now();
  try {
    // Step 1: Find RXCUI
    const approxUrl = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(params.name)}&maxEntries=5`;
    const approxRes = await fetchWithTimeout(approxUrl);
    const approxData = await approxRes.json();
    const candidates = approxData?.approximateGroup?.candidate || [];
    const rxcui = candidates[0]?.rxcui;

    if (!rxcui) {
      const elapsed = Date.now() - start;
      await logApiCall(sb, "rxnorm", "normalize", 200, elapsed, false);
      return { matched: false, raw_text: params.name };
    }

    // Step 2: Get properties
    const propsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
    const propsRes = await fetchWithTimeout(propsUrl);
    const propsData = await propsRes.json();
    const props = propsData?.properties || {};

    const result = {
      matched: true,
      raw_text: params.name,
      matched_name: props.name || '',
      rxnorm_rxcui: rxcui,
      ingredient: props.name || '',
      strength: '',
      dose_form: '',
      brand_or_generic: props.tty === 'BN' ? 'brand' : 'generic',
      source: 'rxnorm',
      disclaimer: 'RxNorm is a US drug normalization system. Not an Australian regulatory source.',
    };

    // Step 3: Try to get related concepts for strength/form
    try {
      const relUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=SCD+SBD`;
      const relRes = await fetchWithTimeout(relUrl, 5000);
      const relData = await relRes.json();
      const groups = relData?.relatedGroup?.conceptGroup || [];
      for (const g of groups) {
        const concepts = g.conceptProperties || [];
        if (concepts.length > 0) {
          // Parse SCD name for strength/form (e.g., "Amoxicillin 500 MG Oral Capsule")
          const parts = concepts[0].name?.match(/(\d+\s*\w+)\s+(Oral|Injectable|Topical|Inhalant)?\s*(.+)/i);
          if (parts) {
            result.strength = parts[1] || '';
            result.dose_form = (parts[2] ? parts[2] + ' ' : '') + (parts[3] || '');
          }
        }
      }
    } catch { /* best effort */ }

    const elapsed = Date.now() - start;
    await setCache(sb, cacheKey, "rxnorm", result, 10080); // 7 day cache
    await logApiCall(sb, "rxnorm", "normalize", 200, elapsed, false);

    // Also persist to medicine_normalizations table
    await sb.from("medicine_normalizations").upsert(
      {
        raw_text: result.raw_text,
        matched_name: result.matched_name,
        rxnorm_rxcui: result.rxnorm_rxcui,
        ingredient: result.ingredient,
        strength: result.strength,
        dose_form: result.dose_form,
        brand_or_generic: result.brand_or_generic,
        source: 'rxnorm',
      },
      { onConflict: "raw_text" }
    ).then(() => {});

    return result;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "rxnorm", "normalize", null, elapsed, false, String(e));
    return { matched: false, raw_text: params.name, error: "Service temporarily unavailable" };
  }
}

async function handleRxNormClass(sb: ReturnType<typeof createClient>, params: { rxcui: string }) {
  const cacheKey = `rxclass:${params.rxcui}`;
  const cached = await checkCache(sb, cacheKey);
  if (cached) {
    await logApiCall(sb, "rxclass", "lookup", 200, 0, true);
    return cached;
  }

  const start = Date.now();
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=${params.rxcui}`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    const elapsed = Date.now() - start;

    const classes = (data?.rxclassDrugInfoList?.rxclassDrugInfo || []).map((info: any) => ({
      className: info.rxclassMinConceptItem?.className || '',
      classType: info.rxclassMinConceptItem?.classType || '',
      classId: info.rxclassMinConceptItem?.classId || '',
    }));

    await setCache(sb, cacheKey, "rxclass", classes, 10080);
    await logApiCall(sb, "rxclass", "lookup", res.status, elapsed, false);
    return classes;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "rxclass", "lookup", null, elapsed, false, String(e));
    return [];
  }
}

async function handleOpenFdaSafety(sb: ReturnType<typeof createClient>, params: { drugName: string; type?: string }) {
  const queryType = params.type || "recall"; // recall | adverse | label
  const cacheKey = `openfda:${queryType}:${params.drugName.toLowerCase().trim()}`;
  const cached = await checkCache(sb, cacheKey);
  if (cached) {
    await logApiCall(sb, "openfda", queryType, 200, 0, true);
    return cached;
  }

  const start = Date.now();
  const endpoints: Record<string, string> = {
    recall: `https://api.fda.gov/drug/enforcement.json?search=openfda.brand_name:"${encodeURIComponent(params.drugName)}"+openfda.generic_name:"${encodeURIComponent(params.drugName)}"&limit=10`,
    adverse: `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.brand_name:"${encodeURIComponent(params.drugName)}"+patient.drug.openfda.generic_name:"${encodeURIComponent(params.drugName)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`,
    label: `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(params.drugName)}"+openfda.generic_name:"${encodeURIComponent(params.drugName)}"&limit=1`,
  };

  try {
    const url = endpoints[queryType];
    if (!url) throw new Error(`Unknown openFDA query type: ${queryType}`);
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    const elapsed = Date.now() - start;

    let result: any;
    if (queryType === "recall") {
      result = {
        type: "recall",
        items: (data?.results || []).map((r: any) => ({
          recallNumber: r.recall_number || '',
          reason: r.reason_for_recall || '',
          status: r.status || '',
          classification: r.classification || '',
          recallDate: r.recall_initiation_date || '',
          product: r.product_description || '',
        })),
        disclaimer: "Source: openFDA. US data — may not reflect Australian recalls. Supplementary reference only.",
      };
    } else if (queryType === "adverse") {
      result = {
        type: "adverse",
        reactions: (data?.results || []).map((r: any) => ({
          term: r.term || '',
          count: r.count || 0,
        })),
        disclaimer: "Source: openFDA FAERS. US adverse event reports. Supplementary reference only.",
      };
    } else {
      const label = data?.results?.[0] || {};
      result = {
        type: "label",
        indications: label.indications_and_usage?.[0] || '',
        warnings: label.warnings?.[0]?.slice(0, 500) || '',
        contraindications: label.contraindications?.[0]?.slice(0, 500) || '',
        adverseReactions: label.adverse_reactions?.[0]?.slice(0, 500) || '',
        disclaimer: "Source: openFDA drug labelling. US data. Supplementary reference only.",
      };
    }

    await setCache(sb, cacheKey, "openfda", result, 1440); // 24hr
    await logApiCall(sb, "openfda", queryType, res.status, elapsed, false);
    return result;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "openfda", queryType, null, elapsed, false, String(e));
    return { type: queryType, items: [], error: "Service temporarily unavailable", disclaimer: "openFDA data unavailable." };
  }
}

async function handleWeatherContext(sb: ReturnType<typeof createClient>, params: { lat: number; lng: number; destination?: string }) {
  const key = `weather:${params.lat.toFixed(2)}:${params.lng.toFixed(2)}`;
  const cached = await checkCache(sb, key);
  if (cached) {
    await logApiCall(sb, "open_meteo", "weather", 200, 0, true);
    return cached;
  }

  const start = Date.now();
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${params.lat}&longitude=${params.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,weather_code&timezone=auto&forecast_days=7`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    const elapsed = Date.now() - start;

    const result = {
      current: {
        temperature: data.current?.temperature_2m,
        humidity: data.current?.relative_humidity_2m,
        apparentTemperature: data.current?.apparent_temperature,
        weatherCode: data.current?.weather_code,
        windSpeed: data.current?.wind_speed_10m,
      },
      daily: (data.daily?.time || []).map((date: string, i: number) => ({
        date,
        tempMax: data.daily.temperature_2m_max?.[i],
        tempMin: data.daily.temperature_2m_min?.[i],
        uvIndexMax: data.daily.uv_index_max?.[i],
        precipitationSum: data.daily.precipitation_sum?.[i],
        weatherCode: data.daily.weather_code?.[i],
      })),
      destination: params.destination || `${params.lat}, ${params.lng}`,
      alerts: [] as string[],
    };

    // Generate contextual health alerts
    const maxUv = Math.max(...(data.daily?.uv_index_max || [0]));
    const maxTemp = Math.max(...(data.daily?.temperature_2m_max || [0]));
    const minTemp = Math.min(...(data.daily?.temperature_2m_min || [99]));

    if (maxUv >= 8) result.alerts.push(`Very high UV index (${maxUv}) — advise sun protection, SPF 50+, protective clothing.`);
    else if (maxUv >= 6) result.alerts.push(`High UV index (${maxUv}) — advise sunscreen SPF 30+.`);
    if (maxTemp >= 35) result.alerts.push(`Extreme heat forecast (${maxTemp}°C) — advise hydration, heat illness awareness.`);
    if (minTemp <= 0) result.alerts.push(`Freezing conditions (${minTemp}°C) — advise cold-weather precautions.`);
    if ((data.current?.relative_humidity_2m || 0) >= 85) result.alerts.push("High humidity — increased risk of heat-related illness.");

    await setCache(sb, key, "open_meteo", result, 180); // 3hr cache
    await logApiCall(sb, "open_meteo", "weather", res.status, elapsed, false);
    return result;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "open_meteo", "weather", null, elapsed, false, String(e));
    return { error: "Weather data unavailable" };
  }
}

// Nominatim: strict throttle — 1 req/sec, cache aggressively
let lastNominatimCall = 0;
async function handleGeocode(sb: ReturnType<typeof createClient>, params: { query: string }) {
  // Check geocode_cache first
  const { data: cachedGeo } = await sb
    .from("geocode_cache")
    .select("*")
    .eq("query_text", params.query.toLowerCase().trim())
    .single();

  if (cachedGeo) {
    await logApiCall(sb, "nominatim", "geocode", 200, 0, true);
    return {
      latitude: cachedGeo.latitude,
      longitude: cachedGeo.longitude,
      displayName: cachedGeo.display_name,
      countryCode: cachedGeo.country_code,
    };
  }

  // Throttle
  const now = Date.now();
  const timeSinceLast = now - lastNominatimCall;
  if (timeSinceLast < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - timeSinceLast));
  }
  lastNominatimCall = Date.now();

  const start = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(params.query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetchWithTimeout(url, 8000, {
      headers: { "User-Agent": "ChemistCare-PrescribeOS/1.0 (clinical-pharmacy-app)" },
    });
    const data = await res.json();
    const elapsed = Date.now() - start;

    if (!data || data.length === 0) {
      await logApiCall(sb, "nominatim", "geocode", 200, elapsed, false, "No results");
      return { error: "Location not found" };
    }

    const result = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name || '',
      countryCode: data[0].address?.country_code || '',
    };

    // Cache result
    await sb.from("geocode_cache").upsert({
      query_text: params.query.toLowerCase().trim(),
      latitude: result.latitude,
      longitude: result.longitude,
      display_name: result.displayName,
      country_code: result.countryCode,
    }, { onConflict: "query_text" });

    await logApiCall(sb, "nominatim", "geocode", res.status, elapsed, false);
    return result;
  } catch (e) {
    const elapsed = Date.now() - start;
    await logApiCall(sb, "nominatim", "geocode", null, elapsed, false, String(e));
    return { error: "Geocoding service unavailable" };
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = supabaseAdmin();

    // Feature flag check
    const featureMap: Record<string, string> = {
      pbs_search: "pbs_api",
      pbs_sync: "pbs_api",
      nih_search: "nih_clinical_tables",
      medlineplus_connect: "medlineplus_connect",
      medlineplus_search: "medlineplus_web",
      rxnorm_normalize: "rxnorm",
      rxnorm_class: "rxnorm",
      openfda_safety: "openfda",
      weather_context: "open_meteo",
      geocode: "nominatim",
    };

    const flagKey = featureMap[action];
    if (flagKey) {
      const enabled = await checkFeatureFlag(sb, flagKey);
      if (!enabled) {
        return new Response(
          JSON.stringify({ error: "Integration disabled", feature: flagKey }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let result: unknown;
    switch (action) {
      case "pbs_search":
        result = await handlePbsSearch(sb, params);
        break;
      case "nih_search":
        result = await handleNihSearch(sb, params);
        break;
      case "medlineplus_connect":
        result = await handleMedlinePlusConnect(sb, params);
        break;
      case "medlineplus_search":
        result = await handleMedlinePlusSearch(sb, params);
        break;
      case "rxnorm_normalize":
        result = await handleRxNormNormalize(sb, params);
        break;
      case "rxnorm_class":
        result = await handleRxNormClass(sb, params);
        break;
      case "openfda_safety":
        result = await handleOpenFdaSafety(sb, params);
        break;
      case "weather_context":
        result = await handleWeatherContext(sb, params);
        break;
      case "geocode":
        result = await handleGeocode(sb, params);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clinical-api-proxy error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
