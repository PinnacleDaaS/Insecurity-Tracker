-- ============================================================
-- Gold Layer: Materialized Views for Dashboard
-- ============================================================

-- 1. Summary Statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_summary_stats AS
SELECT
  COUNT(*) AS total_incidents,
  COALESCE(SUM(fatalities), 0) AS total_fatalities,
  COALESCE(SUM(fatalities_combatants), 0) AS total_combatants_killed,
  COALESCE(SUM(fatalities_security_forces), 0) AS total_security_killed,
  COALESCE(SUM(fatalities_civilians), 0) AS total_civilians_killed,
  COALESCE(SUM(kidnapped_count), 0) AS total_kidnapped,
  COUNT(*) FILTER (WHERE is_kidnap) AS kidnap_incidents,
  ROUND(COALESCE(SUM(fatalities) * 1.0 / NULLIF(COUNT(*), 0), 0), 2) AS lethality_index,
  COUNT(DISTINCT state_clean) AS states_affected,
  MIN(event_date) AS date_from,
  MAX(event_date) AS date_to
FROM clean_incidents
WHERE NOT is_duplicate AND NOT is_reference;

-- 2. Timeline Data (monthly aggregation)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_timeline_data AS
SELECT
  TO_CHAR(event_date, 'YYYY-MM') AS year_month,
  DATE_TRUNC('month', event_date) AS month_start,
  COUNT(*) AS incidents,
  COALESCE(SUM(fatalities), 0) AS fatalities,
  COALESCE(SUM(kidnapped_count), 0) AS kidnapped,
  COALESCE(SUM(fatalities_combatants), 0) AS combatants_killed,
  COALESCE(SUM(fatalities_security_forces), 0) AS security_killed,
  COALESCE(SUM(fatalities_civilians), 0) AS civilians_killed,
  COUNT(*) FILTER (WHERE event_type = 'Battles') AS battles,
  COUNT(*) FILTER (WHERE event_type = 'Violence against civilians') AS violence_against_civilians,
  COUNT(*) FILTER (WHERE event_type = 'Explosions/Remote violence') AS explosions,
  COUNT(*) FILTER (WHERE event_type = 'Strategic developments') AS strategic_dev,
  COUNT(*) FILTER (WHERE event_type = 'Protests') AS protests,
  COUNT(*) FILTER (WHERE event_type = 'Riots') AS riots
FROM clean_incidents
WHERE NOT is_duplicate AND NOT is_reference
GROUP BY year_month, month_start
ORDER BY month_start ASC;

-- 3. State Profiles
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_state_profiles AS
SELECT
  state_clean,
  geopolitical_zone,
  COUNT(*) AS total_incidents,
  COALESCE(SUM(fatalities), 0) AS total_fatalities,
  COALESCE(SUM(kidnapped_count), 0) AS total_kidnapped,
  COALESCE(SUM(fatalities_combatants), 0) AS combatants_killed,
  COALESCE(SUM(fatalities_security_forces), 0) AS security_killed,
  COALESCE(SUM(fatalities_civilians), 0) AS civilians_killed,
  ROUND(AVG(latitude)::numeric, 4) AS centroid_lat,
  ROUND(AVG(longitude)::numeric, 4) AS centroid_lon,
  MODE() WITHIN GROUP (ORDER BY event_type) AS top_event_type,
  MODE() WITHIN GROUP (ORDER BY actor1_group) AS top_actor_group,
  COUNT(*) FILTER (WHERE target_category = 'Place of Worship') AS places_of_worship,
  COUNT(*) FILTER (WHERE target_category = 'Educational Institution') AS educational,
  COUNT(*) FILTER (WHERE target_category = 'Oil & Gas Infrastructure') AS oil_gas,
  COUNT(*) FILTER (WHERE target_category = 'Agricultural/Farm') AS agricultural,
  COUNT(*) FILTER (WHERE target_category = 'Transport/Transit') AS transport,
  COUNT(*) FILTER (WHERE target_category = 'Government/Police') AS government,
  MAX(event_date) AS latest_incident_date,
  COALESCE(SUM(fatalities) FILTER (WHERE event_date >= CURRENT_DATE - INTERVAL '90 days'), 0) AS recent_fatalities_90d
FROM clean_incidents
WHERE NOT is_duplicate AND NOT is_reference
GROUP BY state_clean, geopolitical_zone
ORDER BY total_incidents DESC;

-- 4. LGA Profiles (top 100)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_lga_profiles AS
SELECT
  lga_clean,
  state_clean,
  geopolitical_zone,
  COUNT(*) AS total_incidents,
  COALESCE(SUM(fatalities), 0) AS total_fatalities,
  COALESCE(SUM(kidnapped_count), 0) AS total_kidnapped,
  ROUND(AVG(latitude)::numeric, 4) AS centroid_lat,
  ROUND(AVG(longitude)::numeric, 4) AS centroid_lon,
  MAX(event_date) AS latest_incident_date
FROM clean_incidents
WHERE NOT is_duplicate AND NOT is_reference
  AND lga_clean IS NOT NULL
GROUP BY lga_clean, state_clean, geopolitical_zone
ORDER BY total_incidents DESC
LIMIT 100;

-- 5. Actor Profiles
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_actor_profiles AS
WITH actor_union AS (
  SELECT actor1_group AS actor_group, event_date, fatalities, event_type, target_category FROM clean_incidents WHERE NOT is_duplicate AND NOT is_reference AND actor1_group IS NOT NULL
  UNION ALL
  SELECT actor2_group AS actor_group, event_date, fatalities, event_type, target_category FROM clean_incidents WHERE NOT is_duplicate AND NOT is_reference AND actor2_group IS NOT NULL
)
SELECT
  actor_group,
  COUNT(*) AS incident_count,
  COALESCE(SUM(fatalities), 0) AS total_fatalities,
  ROUND(AVG(fatalities)::numeric, 2) AS avg_fatalities_per_incident,
  TO_CHAR(MIN(event_date), 'YYYY') AS first_year,
  TO_CHAR(MAX(event_date), 'YYYY') AS last_year
FROM actor_union
GROUP BY actor_group
ORDER BY incident_count DESC;

-- 5b. Actor Yearly Trends
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_actor_yearly_trends AS
WITH actor_union AS (
  SELECT actor1_group AS actor_group, event_date, fatalities FROM clean_incidents WHERE NOT is_duplicate AND NOT is_reference AND actor1_group IS NOT NULL
  UNION ALL
  SELECT actor2_group AS actor_group, event_date, fatalities FROM clean_incidents WHERE NOT is_duplicate AND NOT is_reference AND actor2_group IS NOT NULL
)
SELECT
  actor_group,
  EXTRACT(YEAR FROM event_date) AS year,
  COUNT(*) AS incidents,
  COALESCE(SUM(fatalities), 0) AS fatalities
FROM actor_union
GROUP BY actor_group, year
ORDER BY actor_group, year;

-- 6. Incident Explorer (top 500 most lethal)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_incident_explorer AS
SELECT
  event_id_cnty,
  event_date,
  event_type,
  sub_event_type,
  state_clean,
  geopolitical_zone,
  lga_clean,
  actor1,
  actor2,
  actor1_group,
  actor2_group,
  location,
  latitude,
  longitude,
  fatalities,
  notes,
  target_category,
  is_kidnap,
  kidnapped_count,
  fatalities_combatants,
  fatalities_security_forces,
  fatalities_civilians,
  presidential_admin
FROM clean_incidents
WHERE NOT is_duplicate AND NOT is_reference
ORDER BY fatalities DESC, event_date DESC
LIMIT 500;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_summary_stats ON mv_summary_stats (total_incidents);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_timeline_data ON mv_timeline_data (year_month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_state_profiles ON mv_state_profiles (state_clean);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_lga_profiles ON mv_lga_profiles (lga_clean, state_clean);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_actor_profiles ON mv_actor_profiles (actor_group);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_actor_yearly_trends ON mv_actor_yearly_trends (actor_group, year);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_incident_explorer ON mv_incident_explorer (event_id_cnty);
