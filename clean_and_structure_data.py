"""ACLED Data Structuring & Agentic Cleaning Script.
Conforms data to the Supabase clean_incidents schema, performs agentic cleaning with Gemini, and exports/uploads results.
"""

import argparse
import csv
import json
import os
import sys
import glob
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
import openpyxl


# Materialised views to refresh after upload
MATERIALIZED_VIEWS = [
    "mv_summary_stats",
    "mv_timeline_data",
    "mv_state_profiles",
    "mv_lga_profiles",
    "mv_actor_profiles",
    "mv_actor_yearly_trends",
    "mv_incident_explorer",
]

# ─── Config & Constants ────────────────────────────────────────────
STATE_TO_ZONE = {
    'Adamawa': 'North East', 'Bauchi': 'North East', 'Borno': 'North East', 'Gombe': 'North East', 'Taraba': 'North East', 'Yobe': 'North East',
    'Jigawa': 'North West', 'Kaduna': 'North West', 'Kano': 'North West', 'Katsina': 'North West', 'Kebbi': 'North West', 'Sokoto': 'North West', 'Zamfara': 'North West',
    'Benue': 'North Central', 'Kogi': 'North Central', 'Kwara': 'North Central', 'Nasarawa': 'North Central', 'Niger': 'North Central', 'Plateau': 'North Central', 'Federal Capital Territory': 'North Central',
    'Abia': 'South East', 'Anambra': 'South East', 'Ebonyi': 'South East', 'Enugu': 'South East', 'Imo': 'South East',
    'Akwa Ibom': 'South South', 'Bayelsa': 'South South', 'Cross River': 'South South', 'Delta': 'South South', 'Edo': 'South South', 'Rivers': 'South South',
    'Ekiti': 'South West', 'Lagos': 'South West', 'Ogun': 'South West', 'Ondo': 'South West', 'Osun': 'South West', 'Oyo': 'South West'
}

# Supported categories for target_category column
TARGET_CATEGORIES = [
    'Place of Worship', 'Educational Institution', 'Oil & Gas Infrastructure', 
    'Financial/Bank', 'Agricultural/Farm', 'Commercial/Market', 
    'Transport/Transit', 'Government/Police', 'Residential/Village', 'General/Unspecified'
]

# ─── Pydantic Schema for Gemini Output ────────────────────────────
class RowCleanResult(BaseModel):
    id: str = Field(description="The event_id_cnty of the record.")
    is_kidnap: bool = Field(description="TRUE if any kidnapping or abduction of people occurred in this incident.")
    k: int = Field(description="The exact number of people kidnapped or abducted. 0 if none or unclear.")
    target_category: str = Field(description="The primary target category of the incident notes.")
    d: bool = Field(default=False, description="TRUE if this record is a duplicate of another event in this batch.")
    r: str | None = Field(default=None, description="If it is a duplicate, the event_id_cnty of the primary record it duplicates.")

# ─── Helper Functions ──────────────────────────────────────────────
def get_presidential_admin(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return "Unknown"
        
    pre_demo_end = datetime(1999, 5, 29)
    obasanjo_end = datetime(2007, 5, 29)
    yaradua_end = datetime(2010, 5, 6)
    jonathan_end = datetime(2015, 5, 29)
    buhari_end = datetime(2023, 5, 29)
    
    if dt < pre_demo_end:
        return "Pre-Democracy"
    elif dt < obasanjo_end:
        return "Obasanjo"
    elif dt < yaradua_end:
        return "Yar'Adua"
    elif dt < jonathan_end:
        return "Jonathan"
    elif dt < buhari_end:
        return "Buhari"
    else:
        return "Tinubu"

def download_from_storage(supabase_client, bucket: str) -> str | None:
    """Download the newest CSV file from Supabase Storage, return local path."""
    try:
        objects = supabase_client.storage.from_(bucket).list()
        csv_objects = [o for o in objects if o.get("name", "").endswith(".csv")]
        if not csv_objects:
            print(f"Error: No CSV files found in Storage bucket '{bucket}'.")
            return None
        csv_objects.sort(key=lambda o: o.get("updated_at", o.get("created_at", "")), reverse=True)
        newest = csv_objects[0]["name"]
        print(f"Downloading newest CSV from Storage: {newest}")
        data = supabase_client.storage.from_(bucket).download(newest)
        tmp = tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False)
        tmp.write(data)
        tmp.close()
        print(f"Saved to temporary file: {tmp.name}")
        return tmp.name
    except Exception as e:
        print(f"Error downloading from Storage: {e}")
        return None


def fetch_existing_ids(supabase_client, table: str) -> set:
    """Return set of all event_id_cnty values already in the table."""
    existing = set()
    PAGE = 1000
    i = 0
    while True:
        resp = supabase_client.table(table).select("event_id_cnty").range(i, i + PAGE - 1).execute()
        batch = resp.data or []
        if not batch:
            break
        existing.update(r["event_id_cnty"] for r in batch)
        if len(batch) < PAGE:
            break
        i += PAGE
    print(f"Found {len(existing)} existing rows in {table}")
    return existing


def refresh_materialized_views(supabase_client):
    """Refresh all materialized views concurrently."""
    for view in MATERIALIZED_VIEWS:
        try:
            supabase_client.rpc("exec_sql_refresh", {"view_name": view}).execute()
            print(f"  Refreshed {view}")
        except Exception as e:
            print(f"  Warning: Could not refresh {view}: {e}")
    print("All views refreshed.")


def load_actor_mappings() -> dict:
    mapping_file = Path(__file__).parent / "actor_groups_mapping.json"
    if mapping_file.exists():
        try:
            with open(mapping_file, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load actor mappings: {e}")
    return {}

def classify_actor_fallback(actor_name: str) -> str:
    if not actor_name:
        return "Other Armed Group / Others"
        
    actor_lower = actor_name.lower()
    
    # State Forces
    if any(k in actor_lower for k in ["military", "police", "army", "navy", "air force", "state forces", "vigilante service", "watch corps", "civilian jtf", "cjtf"]):
        return "State Forces"
    # Boko Haram / ISWAP
    if any(k in actor_lower for k in ["boko haram", "iswap", "islamic state west africa"]):
        return "Boko Haram/ISWAP"
    # Rioters/Protesters
    if any(k in actor_lower for k in ["protesters", "rioters"]):
        return "Rioters/Protesters"
    # Civilians
    if any(k in actor_lower for k in ["civilians", "farmers", "pastoralists", "worshippers", "political party", "pdp", "apc", "anpp", "labor group"]):
        return "Civilians"
    # Sectarian/Ethnic Militia
    if any(k in actor_lower for k in ["militia", "ethnic"]):
        return "Sectarian/Ethnic Militia"
    # Default fallback
    return "Other Armed Group / Others"

# ─── Gemini Calling Function ──────────────────────────────────────
def call_gemini(client: genai.Client, model_name: str, batch_rows: list[dict]) -> list[RowCleanResult]:
    system_instruction = f"""You are a data-cleaning assistant for the Nigerian Armed Conflict Location & Event Data (ACLED) database. Your task is to analyze incident notes and extract structured information.

Your output MUST be a JSON list of objects, where each object matches the schema defined in the response_schema.

RULES FOR target_category:
Classify the target of the incident into exactly one of these categories based on the notes:
- 'Place of Worship': church, mosque, shrine, worshippers, religious gathering.
- 'Educational Institution': school, university, college, teachers, students.
- 'Oil & Gas Infrastructure': oil pipeline, gas pipeline, refinery, flow station, oil company property.
- 'Financial/Bank': bank, ATM, bullion van, financial office.
- 'Agricultural/Farm': farm, crops, farmers working on farm, cattle rustling (livestock theft), pastoralists.
- 'Commercial/Market': market, shops, plaza, traders, business premises.
- 'Transport/Transit': highway, road, vehicle, bus, passenger, road block, travelers.
- 'Government/Police': police station, checkpoint, military base, INEC official, election venue, politician, palace (emir/king/monarch).
- 'Residential/Village': village raid, private house, community, residential neighborhood.
- 'General/Unspecified': default if none of the above are specifically targeted.

RULES FOR is_kidnap and k (kidnapped count):
- Set is_kidnap to true if the notes indicate ANY people were kidnapped, abducted, or held hostage.
- Extract the exact number of people kidnapped or abducted as k.
- Apply natural language understanding to interpret quantities (e.g., 'several' -> 5, 'dozens' -> 24, 'scores' -> 20, etc.).
- If a range is given (e.g. '20-30'), return the lower bound (20).
- If the incident describes cattle rustling (animals stolen) or property stolen rather than people, set k = 0, is_kidnap = false.
- If the incident describes a rescue, release, or escape operation (not a kidnapping event), set k = 0.
- If no people were kidnapped or the number is unclear, return 0.

RULES FOR d / r (duplicates):
- Compare incidents within this batch that share the same date, similar location, and similar notes.
- If two or more incidents appear to be the same event reported by different sources, flag all but one as duplicates.
- Set d = true for duplicates, and r to the event_id_cnty of the primary record it duplicates.
- Be conservative — only flag clear duplicates."""

    prompt_rows = []
    for r in batch_rows:
        prompt_rows.append({
            "event_id_cnty": r["event_id_cnty"],
            "event_date": r["event_date"],
            "location": r["location"],
            "state_clean": r["state_clean"],
            "event_type": r["event_type"],
            "notes": r["notes"]
        })
        
    prompt = json.dumps(prompt_rows, indent=2)
    
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=list[RowCleanResult]
        )
    )
    
    if not response.parsed:
        raise ValueError("Gemini returned an empty parsed response")
        
    return response.parsed

# ─── Main Program ──────────────────────────────────────────────────
def main():

    
    parser = argparse.ArgumentParser(description="Clean and structure ACLED data to fit Supabase schema.")
    parser.add_argument("--csv", help="Path to input CSV file. Defaults to latest ACLED CSV in directory.")
    parser.add_argument("--from-storage", action="store_true", help="Download newest CSV from Supabase Storage bucket.")
    parser.add_argument("--bucket", default="acled_raw_csv", help="Supabase Storage bucket name (default: acled_raw_csv).")
    parser.add_argument("--upload", action="store_true", help="Upsert results to Supabase clean_incidents table.")
    
    args = parser.parse_args()
    
    load_dotenv()
    
    # Early Supabase client setup if needed for storage download or upload
    supabase = None
    if args.from_storage or args.upload:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY required for --from-storage or --upload.")
            sys.exit(1)
        from supabase import create_client
        supabase = create_client(url, key)
    
    # 1. Resolve CSV path
    csv_path = args.csv
    if args.from_storage:
        csv_path = download_from_storage(supabase, args.bucket)
        if not csv_path:
            sys.exit(1)
    elif not csv_path:
        csv_files = [f for f in glob.glob("ACLED Data*.csv") if not f.endswith("_cleaned.csv") and not f.endswith("_cleaned_cleaned.csv")]
        if not csv_files:
            print("Error: No CSV file specified and no raw 'ACLED Data*.csv' files found in current directory.")
            sys.exit(1)
        csv_files.sort(reverse=True)
        csv_path = csv_files[0]
        print(f"Auto-detected latest CSV: {csv_path}")
        
    if not os.path.exists(csv_path):
        print(f"Error: File not found at {csv_path}")
        sys.exit(1)
        
    # 2. Setup Gemini client
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        print("Error: GEMINI_API_KEY environment variable not found.")
        sys.exit(1)
    gemini_client = genai.Client(api_key=gemini_key)
    
    # 3. Load actor mappings
    actor_mappings = load_actor_mappings()
    
    # 4. Parse CSV and structure initial fields
    print(f"Parsing and structuring data from: {csv_path}...")
    structured_rows = []
    
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            event_id = row.get("event_id_cnty")
            if not event_id:
                print(f"Warning: Skipping row {i} due to missing event_id_cnty")
                continue
                
            event_date = row.get("event_date", "")
            year_val = int(event_date[:4]) if event_date else datetime.now().year
            
            # Map state
            admin1 = row.get("admin1", "").strip()
            state_clean = admin1
            
            # Geopolitical Zone
            geo_zone = STATE_TO_ZONE.get(state_clean, "General/Unspecified")
            
            # LGA Clean (admin2)
            lga_clean = row.get("admin2", "").strip()
            
            # Actors
            actor1 = row.get("actor1", "").strip()
            actor2 = row.get("actor2", "").strip() or None
            
            # Actor groups
            actor1_group = actor_mappings.get(actor1)
            if not actor1_group:
                actor1_group = classify_actor_fallback(actor1)
                # print(f"  [fallback] actor1: '{actor1}' -> '{actor1_group}'")
                
            actor2_group = None
            if actor2:
                actor2_group = actor_mappings.get(actor2)
                if not actor2_group:
                    actor2_group = classify_actor_fallback(actor2)
            else:
                actor2_group = "Other Armed Group / Others"
                
            # Civilian Targeting
            civ_tar = row.get("civilian_targeting", "")
            civilian_targeting = True if civ_tar == "Civilian targeting" else False
            
            # Fatalities
            try:
                fatalities = int(row.get("fatalities", 0))
            except ValueError:
                fatalities = 0
                
            # Sub-event Type
            sub_event_type = row.get("sub_event_type", "").strip()
            
            # Latitude & Longitude
            try:
                lat = float(row.get("latitude", 0.0))
                lng = float(row.get("longitude", 0.0))
            except ValueError:
                lat, lng = 0.0, 0.0
                
            # Time Precision
            try:
                time_precision = int(row.get("time_precision", 1))
            except ValueError:
                time_precision = 1
                
            # Notes & Location
            notes = row.get("notes", "").strip()
            location = row.get("location", "").strip()
            event_type = row.get("event_type", "").strip()
            
            # Calculations
            pres_admin = get_presidential_admin(event_date)
            fat_civilians = float(fatalities) if civilian_targeting else 0.0
            
            structured_rows.append({
                "event_id_cnty": event_id,
                "event_date": event_date,
                "year": year_val,
                "time_precision": time_precision,
                "event_type": event_type,
                "sub_event_type": sub_event_type,
                "state_clean": state_clean,
                "geopolitical_zone": geo_zone,
                "lga_clean": lga_clean,
                "actor1": actor1,
                "actor2": actor2,
                "actor1_group": actor1_group,
                "actor2_group": actor2_group,
                "location": location,
                "latitude": lat,
                "longitude": lng,
                "fatalities": fatalities,
                "notes": notes,
                "civilian_targeting": civilian_targeting,
                "fatalities_combatants": 0,
                "fatalities_security_forces": 0,
                "fatalities_civilians": fat_civilians,
                "presidential_admin": pres_admin,
                "is_reference": False,
                # Placeholders updated by Gemini
                "target_category": "General/Unspecified",
                "is_kidnap": False,
                "kidnapped_count": 0,
                "is_duplicate": False,
                "duplicate_of": None,
                "review_status": "pending",
                "review_note": None,
                # Current execution timestamp (updated_at)
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            
    print(f"Structured {len(structured_rows)} rows. Running agentic cleaning via Gemini...")
    
    # 4a. If uploading, skip rows already in the database
    if args.upload:
        existing_ids = fetch_existing_ids(supabase, "clean_incidents")
        before = len(structured_rows)
        structured_rows = [r for r in structured_rows if r["event_id_cnty"] not in existing_ids]
        skipped = before - len(structured_rows)
        if skipped:
            print(f"Skipping {skipped} already-processed rows (saving Gemini costs).")
        if not structured_rows:
            print("All rows already exist in database. Nothing to process.")
            # Still refresh views and exit cleanly
            refresh_materialized_views(supabase)
            return

    # 5. Call Gemini for agentic cleaning
    # Process in a single batch (122 is well within batch limits)
    try:
        gemini_results = call_gemini(gemini_client, "gemini-2.5-flash", structured_rows)
        print(f"Successfully cleaned {len(gemini_results)} events with Gemini.")
    except Exception as e:
        print(f"Fatal Error calling Gemini API: {e}")
        sys.exit(1)
        
    # 6. Apply Gemini cleaned values to structured rows
    results_map = {res.id: res for res in gemini_results}
    
    total_kidnapped = 0
    total_duplicates = 0
    category_counts = {}
    
    for r in structured_rows:
        e_id = r["event_id_cnty"]
        res = results_map.get(e_id)
        if res:
            r["is_kidnap"] = res.is_kidnap
            r["kidnapped_count"] = res.k
            r["target_category"] = res.target_category
            r["is_duplicate"] = res.d
            r["duplicate_of"] = res.r
            r["review_status"] = "ai_cleaned"
            
            if res.d and res.r:
                r["review_note"] = f"AI: duplicate of {res.r}"
                total_duplicates += 1
            else:
                r["review_note"] = None
                
            total_kidnapped += res.k
            category_counts[res.target_category] = category_counts.get(res.target_category, 0) + 1
        else:
            print(f"Warning: No Gemini cleaning results returned for ID {e_id}")
            
    # 7. Save to CSV and XLSX
    # Determine base name for output files
    base_name = Path(csv_path).stem
    out_csv = f"{base_name}_cleaned.csv"
    out_xlsx = f"{base_name}_cleaned.xlsx"
    
    headers = list(structured_rows[0].keys())
    
    # Write CSV
    print(f"Writing structured outputs to {out_csv}...")
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(structured_rows)
        
    # Write Excel
    print(f"Writing structured outputs to {out_xlsx}...")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "clean_incidents_rows"
    
    # Headers
    ws.append(headers)
    
    # Rows
    for r in structured_rows:
        row_values = []
        for h in headers:
            val = r[h]
            if val is None:
                row_values.append("")
            else:
                row_values.append(val)
        ws.append(row_values)
        
    wb.save(out_xlsx)
    wb.close()
    
    print("\n" + "="*50)
    print("  Data Cleaning & Structuring Summary")
    print("="*50)
    print(f"  Processed Rows   : {len(structured_rows)}")
    print(f"  Total Kidnapped  : {total_kidnapped}")
    print(f"  Duplicates Found : {total_duplicates}")
    print("\n  Target Categories classified:")
    for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"    - {cat:<25}: {count}")
    print("="*50 + "\n")
    
    # 8. Optional Supabase upload
    if args.upload:
        if not structured_rows:
            print("No new rows to upload.")
        else:
            print(f"Uploading {len(structured_rows)} new rows to Supabase table 'clean_incidents'...")
            try:
                chunk_size = 500
                for i in range(0, len(structured_rows), chunk_size):
                    chunk = structured_rows[i:i+chunk_size]
                    supabase.table("clean_incidents").upsert(chunk, on_conflict="event_id_cnty").execute()
                    print(f"  Upserted rows {i+1} to {min(i+chunk_size, len(structured_rows))}")
                print("Successfully uploaded all data to Supabase!")
            except Exception as e:
                print(f"Error during Supabase upload: {e}")
                sys.exit(1)
        
        # Refresh materialised views
        print("Refreshing materialized views...")
        refresh_materialized_views(supabase)
            
    print("All tasks completed successfully!")

if __name__ == "__main__":
    main()
