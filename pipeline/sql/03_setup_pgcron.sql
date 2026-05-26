-- ============================================================
-- pg_cron Setup: Refresh all materialized views weekly
-- Run this ONCE in Supabase SQL Editor after views exist.
-- Schedule: Every Monday at 7:00 AM UTC
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('refresh-analytics', '0 7 * * 1', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_summary_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_timeline_data;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_state_profiles;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_lga_profiles;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_actor_profiles;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_actor_yearly_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_incident_explorer;
$$);

-- To verify:
-- SELECT * FROM cron.job;

-- To remove:
-- SELECT cron.unschedule('refresh-analytics');
