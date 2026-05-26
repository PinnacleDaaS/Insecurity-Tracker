-- ============================================================
-- Helper Functions for Pipeline
-- Run these ONCE in Supabase SQL Editor
-- ============================================================

-- Allow pipeline to execute arbitrary SQL via RPC
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- Grant execute to service_role (used by pipeline service key)
REVOKE EXECUTE ON FUNCTION exec_sql(TEXT) FROM PUBLIC, ANON, AUTHENTICATED;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO SERVICE_ROLE;

-- Specific refresh function (safer than generic exec_sql)
CREATE OR REPLACE FUNCTION exec_sql_refresh(view_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I;', view_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION exec_sql_refresh(TEXT) FROM PUBLIC, ANON, AUTHENTICATED;
GRANT EXECUTE ON FUNCTION exec_sql_refresh(TEXT) TO SERVICE_ROLE;
