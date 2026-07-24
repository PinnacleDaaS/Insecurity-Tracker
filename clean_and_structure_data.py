"""ACLED Data Structuring & Agentic Cleaning Script.
Conforms data to the clean schema, performs agentic cleaning with Gemini, and exports/uploads results to Cloudflare R2.
"""

import argparse
import csv
import json
import os
import sys
import glob
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
import openpyxl

import boto3
from botocore.config import Config


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

def download_from_r2() -> str | None:
    """Download the newest CSV file from the R2 bucket, return local path."""
    try:
        acct = os.environ.get("R2_ACCOUNT_ID")
        access_key = os.environ.get("R2_ACCESS_KEY")
        secret_key = os.environ.get("R2_SECRET_KEY")
        bucket = os.environ.get("R2_BUCKET", "insecurity-tracker")
        if not all([acct, access_key, secret_key]):
            print("Error: R2 credentials required for --from-r2.")
            return None
        endpoint = f"https://{acct}.r2.cloudflarestorage.com"
        s3 = boto3.client('s3', endpoint_url=endpoint, aws_access_key_id=access_key, aws_secret_access_key=secret_key, config=Config(signature_version='s3v4'), region_name='auto')
        objects = s3.list_objects_v2(Bucket=bucket)
        csv_objects = [o for o in objects.get('Contents', []) if o['Key'].endswith('.csv') and 'cleaned' not in o['Key']]
        if not csv_objects:
            print(f"Error: No raw CSV files found in R2 bucket '{bucket}'.")
            return None
        csv_objects.sort(key=lambda o: o['LastModified'], reverse=True)
        newest = csv_objects[0]['Key']
        print(f"Downloading newest CSV from R2: {newest}")
        resp = s3.get_object(Bucket=bucket, Key=newest)
        data = resp['Body'].read()
        tmp = tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False)
        tmp.write(data)
        tmp.close()
        print(f"Saved to temporary file: {tmp.name}")
        return tmp.name
    except Exception as e:
        print(f"Error downloading from R2: {e}")
        return None


def export_dashboard_json(rows: list[dict]):
    """Export non-duplicate rows as incidents.json for the dashboard (from in-memory data, no DB)."""
    cols = ['event_id_cnty', 'event_date', 'year', 'event_type', 'sub_event_type',
            'state_clean', 'lga_clean', 'geopolitical_zone', 'actor1', 'actor2',
            'location', 'latitude', 'longitude', 'fatalities', 'kidnapped_count',
            'civilian_targeting', 'presidential_admin', 'updated_at']
    filtered = [r for r in rows if not r.get('is_duplicate')]
    exported = [{c: r[c] for c in cols} for r in filtered]
    exported.sort(key=lambda r: r['event_date'], reverse=True)
    out = Path(__file__).parent / 'tracker-app' / 'public' / 'data' / 'incidents.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(exported, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Dashboard data exported: {len(exported)} rows to {out}")


def export_notes_json(rows: list[dict]):
    """Export notes as a JSON map (event_id_cnty -> notes) from in-memory data."""
    notes = {}
    for r in rows:
        if r.get('is_duplicate'):
            continue
        n = r.get('notes', '')
        if n:
            notes[r['event_id_cnty']] = n
    out = Path(__file__).parent / 'tracker-app' / 'public' / 'data' / 'notes.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(notes, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Notes exported: {len(notes)} entries to {out}")


def upload_to_r2():
    """Upload incidents.json, notes.json, meta.json to Cloudflare R2."""
    acct = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY")
    secret_key = os.environ.get("R2_SECRET_KEY")
    bucket = os.environ.get("R2_BUCKET", "insecurity-tracker")

    if not all([acct, access_key, secret_key]):
        print("Missing R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY), skipping R2 upload.")
        return

    endpoint = f"https://{acct}.r2.cloudflarestorage.com"
    s3 = boto3.client('s3', endpoint_url=endpoint, aws_access_key_id=access_key, aws_secret_access_key=secret_key, config=Config(signature_version='s3v4'), region_name='auto')

    data_dir = Path(__file__).parent / 'tracker-app' / 'public' / 'data'
    incidents_path = data_dir / 'incidents.json'
    notes_path = data_dir / 'notes.json'

    if incidents_path.exists():
        s3.upload_file(str(incidents_path), bucket, 'incidents.json', ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'max-age=3600'})
        print(f"Uploaded incidents.json ({incidents_path.stat().st_size / 1e6:.1f} MB)")

        meta = {
            'updated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'row_count': None,
            'file_size': incidents_path.stat().st_size,
        }
        with open(incidents_path) as f:
            rows = json.load(f)
            meta['row_count'] = len(rows)
            meta['date_min'] = rows[-1]['event_date'] if rows else None
            meta['date_max'] = rows[0]['event_date'] if rows else None
        s3.put_object(Bucket=bucket, Key='meta.json', Body=json.dumps(meta).encode(), ContentType='application/json', CacheControl='no-cache')
        print(f"Uploaded meta.json ({meta['row_count']} rows, {meta['date_min']} - {meta['date_max']})")

    if notes_path.exists():
        s3.upload_file(str(notes_path), bucket, 'notes.json', ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'max-age=3600'})
        print(f"Uploaded notes.json ({notes_path.stat().st_size / 1e6:.1f} MB)")

    # Upload the cleaned CSV for traceability
    csv_files = [f for f in Path(__file__).parent.glob("*_cleaned.csv")]
    if csv_files:
        latest_csv = max(csv_files, key=lambda p: p.stat().st_mtime)
        r2_key = f"cleaned/{latest_csv.name}"
        s3.upload_file(str(latest_csv), bucket, r2_key, ExtraArgs={'ContentType': 'text/csv'})
        print(f"Uploaded {latest_csv.name} to R2 ({latest_csv.stat().st_size / 1e6:.1f} MB)")

    print("R2 upload complete!")


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

    
    parser = argparse.ArgumentParser(description="Clean and structure ACLED data and upload dashboard files to R2.")
    parser.add_argument("--csv", help="Path to input CSV file. Defaults to latest ACLED CSV in directory.")
    parser.add_argument("--from-r2", action="store_true", help="Download newest raw CSV from R2 bucket.")
    parser.add_argument("--upload-to-r2", action="store_true", help="Upload dashboard data files to Cloudflare R2")
    
    args = parser.parse_args()
    
    load_dotenv()
    
    # 1. Resolve CSV path
    csv_path = args.csv
    if args.from_r2:
        csv_path = download_from_r2()
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
                "target_category": "General/Unspecified",
                "is_kidnap": False,
                "kidnapped_count": 0,
                "is_duplicate": False,
                "duplicate_of": None,
                "review_status": "pending",
                "review_note": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            
    print(f"Structured {len(structured_rows)} rows. Running agentic cleaning via Gemini...")
    
    # 5. Call Gemini for agentic cleaning (chunked to avoid timeouts)
    GEMINI_CHUNK = 100
    gemini_results = []
    for i in range(0, len(structured_rows), GEMINI_CHUNK):
        chunk = structured_rows[i:i+GEMINI_CHUNK]
        try:
            chunk_results = call_gemini(gemini_client, "gemini-2.5-flash", chunk)
            gemini_results.extend(chunk_results)
            print(f"  Gemini chunk {i//GEMINI_CHUNK + 1}/{(len(structured_rows)-1)//GEMINI_CHUNK + 1}: cleaned {len(chunk_results)} events")
        except Exception as e:
            print(f"  Gemini chunk {i//GEMINI_CHUNK + 1} failed: {e}")
            if i == 0:
                print(f"Fatal Error calling Gemini API on first chunk: {e}")
                sys.exit(1)
            print(f"  Skipping chunk — continuing with remaining rows")
    print(f"Successfully cleaned {len(gemini_results)} events with Gemini.")
        
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
    base_name = Path(csv_path).stem
    out_csv = f"{base_name}_cleaned.csv"
    out_xlsx = f"{base_name}_cleaned.xlsx"
    
    headers = list(structured_rows[0].keys())
    
    print(f"Writing structured outputs to {out_csv}...")
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(structured_rows)
        
    print(f"Writing structured outputs to {out_xlsx}...")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "clean_incidents_rows"
    ws.append(headers)
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
    
    # 8. Generate dashboard JSON files directly from in-memory data
    export_dashboard_json(structured_rows)
    export_notes_json(structured_rows)

    # 9. Upload to R2
    if args.upload_to_r2:
        upload_to_r2()
            
    print("All tasks completed successfully!")

if __name__ == "__main__":
    main()
