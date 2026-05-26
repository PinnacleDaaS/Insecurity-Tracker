from config import get_supabase

VIEWS = [
    "mv_summary_stats",
    "mv_timeline_data",
    "mv_state_profiles",
    "mv_lga_profiles",
    "mv_actor_profiles",
    "mv_actor_yearly_trends",
    "mv_incident_explorer",
]


def refresh_all_views() -> None:
    supabase = get_supabase()
    if not supabase:
        return

    for view in VIEWS:
        sql = f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view};"
        try:
            supabase.rpc("exec_sql", {"query": sql}).execute()
            print(f"  Refreshed: {view}")
        except Exception as e:
            try:
                supabase.table(view).select("*").limit(1).execute()
                print(f"  Attempting direct refresh for: {view}")
                supabase.rpc("exec_sql_refresh", {"view_name": view}).execute()
                print(f"  Refreshed: {view}")
            except Exception as e2:
                print(f"  WARNING: Could not refresh {view}: {e2}")

    print("Materialized view refresh complete.")


def refresh_single_view(view_name: str) -> None:
    if view_name not in VIEWS:
        print(f"Unknown view: {view_name}. Available: {VIEWS}")
        return

    supabase = get_supabase()
    if not supabase:
        return

    sql = f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view_name};"
    try:
        supabase.rpc("exec_sql", {"query": sql}).execute()
        print(f"Refreshed: {view_name}")
    except Exception as e:
        print(f"Could not refresh {view_name}: {e}")
