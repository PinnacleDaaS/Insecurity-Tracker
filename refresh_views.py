"""Refresh all materialized views. Called by GitHub Actions cron."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

VIEWS = [
    "mv_summary_stats",
    "mv_timeline_data",
    "mv_state_profiles",
    "mv_lga_profiles",
    "mv_actor_profiles",
    "mv_actor_yearly_trends",
    "mv_incident_explorer",
]

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

for view in VIEWS:
    print(f"Refreshing {view}...")
    supabase.rpc("exec_sql_refresh", {"view_name": view}).execute()

print("All views refreshed.")
