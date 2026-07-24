"""Export ALL data from Supabase to R2 - one-time migration script.
Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... R2_ACCOUNT_ID=... R2_ACCESS_KEY=... R2_SECRET_KEY=... python scripts/migrate_to_r2.py
"""
import os, sys, json, time
from pathlib import Path
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

R2_ACCOUNT_ID = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY = os.environ["R2_ACCESS_KEY"]
R2_SECRET_KEY = os.environ["R2_SECRET_KEY"]
R2_BUCKET = os.environ.get("R2_BUCKET", "insecurity-tracker")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

print("Connecting to Supabase...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

COLS = 'event_id_cnty,event_date,year,event_type,sub_event_type,state_clean,lga_clean,geopolitical_zone,actor1,actor2,location,latitude,longitude,fatalities,kidnapped_count,civilian_targeting,presidential_admin,updated_at'

def fetch_all():
    all_rows = []
    PAGE = 1000
    i = 0
    while True:
        # Only non-duplicate records for the dashboard
        resp = supabase.table('clean_incidents').select(COLS).neq('is_duplicate', True).order('event_date', desc=True).range(i, i + PAGE - 1).execute()
        batch = resp.data or []
        if not batch:
            break
        all_rows.extend(batch)
        if len(batch) < PAGE:
            break
        i += PAGE
        print(f"  Fetched {len(all_rows)} rows...")
    return all_rows

def fetch_notes():
    notes = {}
    PAGE = 1000
    i = 0
    while True:
        resp = supabase.table('clean_incidents').select('event_id_cnty,notes').neq('is_duplicate', True).order('event_date', desc=True).range(i, i + PAGE - 1).execute()
        batch = resp.data or []
        if not batch:
            break
        for row in batch:
            n = row.get('notes')
            if n and n != '':
                notes[row['event_id_cnty']] = n
        if len(batch) < PAGE:
            break
        i += PAGE
        print(f"  Fetched {len(notes)} notes...")
    return notes

# Fetch incidents
print("\nFetching incidents from Supabase...")
incidents = fetch_all()
print(f"Total incidents: {len(incidents)}")

# Write incidents.json locally
local_path = Path('tracker-app/public/data/incidents.json')
local_path.parent.mkdir(parents=True, exist_ok=True)
with open(local_path, 'w', encoding='utf-8') as f:
    json.dump(incidents, f, ensure_ascii=False, separators=(',', ':'))
print(f"Written to {local_path} ({local_path.stat().st_size / 1e6:.1f} MB)")

# Fetch notes
print("\nFetching notes from Supabase...")
notes_map = fetch_notes()
print(f"Total notes: {len(notes_map)}")

# Write notes.json locally
notes_path = Path('tracker-app/public/data/notes.json')
with open(notes_path, 'w', encoding='utf-8') as f:
    json.dump(notes_map, f, ensure_ascii=False, separators=(',', ':'))
print(f"Written to {notes_path} ({notes_path.stat().st_size / 1e6:.1f} MB)")

# Create meta.json
meta = {
    'updated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'row_count': len(incidents),
    'notes_count': len(notes_map),
    'file_size': local_path.stat().st_size,
    'date_min': incidents[-1]['event_date'] if incidents else None,
    'date_max': incidents[0]['event_date'] if incidents else None,
}
meta_path = Path('tracker-app/public/data/meta.json')
with open(meta_path, 'w') as f:
    json.dump(meta, f)
print(f"meta.json written: {json.dumps(meta)}")

# Upload all to R2
print("\nUploading to R2...")
import boto3
from botocore.config import Config

s3 = boto3.client('s3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    config=Config(signature_version='s3v4'),
    region_name='auto')

for name, path in [('incidents.json', local_path), ('notes.json', notes_path), ('meta.json', meta_path)]:
    ct = 'application/json'
    cc = 'no-cache' if name == 'meta.json' else 'max-age=3600'
    s3.upload_file(str(path), R2_BUCKET, name, ExtraArgs={'ContentType': ct, 'CacheControl': cc})
    print(f"  Uploaded {name} ({path.stat().st_size / 1e6:.1f} MB)")

print("\nDone! All data migrated from Supabase to R2.")
print(f"Public base URL: https://pub-6822fbb2a7bf4318838ad6be0300175a.r2.dev")