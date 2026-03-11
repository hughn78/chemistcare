
-- Feature flags for external integrations
CREATE TABLE public.integration_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read feature flags" ON public.integration_feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert feature flags" ON public.integration_feature_flags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update feature flags" ON public.integration_feature_flags FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete feature flags" ON public.integration_feature_flags FOR DELETE TO authenticated USING (true);

INSERT INTO public.integration_feature_flags (feature_key, enabled, description) VALUES
  ('pbs_api', true, 'PBS Public API for medicine reference'),
  ('nih_clinical_tables', true, 'NIH Clinical Table Search for autocomplete'),
  ('medlineplus_connect', true, 'MedlinePlus Connect for patient education'),
  ('medlineplus_web', true, 'MedlinePlus Web Service for health topics'),
  ('rxnorm', true, 'RxNorm for drug normalization'),
  ('openfda', true, 'openFDA for safety/recall data'),
  ('open_meteo', true, 'Open-Meteo for travel weather'),
  ('nominatim', true, 'Nominatim for geocoding');

-- External API cache
CREATE TABLE public.external_api_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  provider text NOT NULL,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0
);
ALTER TABLE public.external_api_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service select api cache" ON public.external_api_cache FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service insert api cache" ON public.external_api_cache FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service update api cache" ON public.external_api_cache FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service delete api cache" ON public.external_api_cache FOR DELETE USING (auth.role() = 'service_role');
CREATE INDEX idx_api_cache_key ON public.external_api_cache (cache_key);
CREATE INDEX idx_api_cache_provider ON public.external_api_cache (provider);
CREATE INDEX idx_api_cache_expires ON public.external_api_cache (expires_at);

-- PBS medicines cache
CREATE TABLE public.pbs_medicines_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pbs_code text NOT NULL,
  item_code text,
  mp_pt text,
  tpuu_or_mpp_pt text,
  manufacturer text,
  pack_size text,
  max_qty integer,
  num_repeats integer,
  schedule_code text,
  program_code text,
  restriction_flag text,
  atc_code text,
  atc_name text,
  fee_amount numeric,
  benefit_type text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pbs_code, item_code)
);
ALTER TABLE public.pbs_medicines_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read pbs cache" ON public.pbs_medicines_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service insert pbs cache" ON public.pbs_medicines_cache FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service update pbs cache" ON public.pbs_medicines_cache FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service delete pbs cache" ON public.pbs_medicines_cache FOR DELETE USING (auth.role() = 'service_role');
CREATE INDEX idx_pbs_cache_code ON public.pbs_medicines_cache (pbs_code);
CREATE INDEX idx_pbs_cache_mp ON public.pbs_medicines_cache USING gin (to_tsvector('english', coalesce(mp_pt, '')));

-- Integration sync runs
CREATE TABLE public.integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  records_processed integer DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read sync runs" ON public.integration_sync_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service insert sync runs" ON public.integration_sync_runs FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service update sync runs" ON public.integration_sync_runs FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- External API logs
CREATE TABLE public.external_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  endpoint text NOT NULL,
  status_code integer,
  response_time_ms integer,
  cache_hit boolean DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.external_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read api logs" ON public.external_api_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service insert api logs" ON public.external_api_logs FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Medicine normalizations
CREATE TABLE public.medicine_normalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text text NOT NULL,
  matched_name text,
  rxnorm_rxcui text,
  ingredient text,
  strength text,
  dose_form text,
  brand_or_generic text,
  class_data jsonb DEFAULT '[]'::jsonb,
  pbs_code text,
  source text DEFAULT 'rxnorm',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicine_normalizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read normalizations" ON public.medicine_normalizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service insert normalizations" ON public.medicine_normalizations FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service update normalizations" ON public.medicine_normalizations FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE INDEX idx_med_norm_raw ON public.medicine_normalizations (raw_text);
CREATE INDEX idx_med_norm_rxcui ON public.medicine_normalizations (rxnorm_rxcui);

-- Patient education links
CREATE TABLE public.patient_education_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consult_id uuid,
  source text NOT NULL DEFAULT 'medlineplus',
  topic_title text NOT NULL,
  summary text,
  url text NOT NULL,
  code text,
  code_system text,
  category text,
  reviewed_by_pharmacist boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_education_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read education links" ON public.patient_education_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert education links" ON public.patient_education_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update education links" ON public.patient_education_links FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete education links" ON public.patient_education_links FOR DELETE TO authenticated USING (true);

-- Geocode cache
CREATE TABLE public.geocode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text NOT NULL UNIQUE,
  latitude numeric,
  longitude numeric,
  display_name text,
  country_code text,
  source text DEFAULT 'nominatim',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read geocode cache" ON public.geocode_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service insert geocode cache" ON public.geocode_cache FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service update geocode cache" ON public.geocode_cache FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE INDEX idx_geocode_query ON public.geocode_cache (query_text);

-- Travel context cache
CREATE TABLE public.travel_context_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  weather_data jsonb DEFAULT '{}'::jsonb,
  uv_index numeric,
  air_quality_data jsonb DEFAULT '{}'::jsonb,
  forecast_date date,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.travel_context_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read travel cache" ON public.travel_context_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service insert travel cache" ON public.travel_context_cache FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service update travel cache" ON public.travel_context_cache FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
