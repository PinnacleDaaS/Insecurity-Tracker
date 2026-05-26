import csv
import io
import urllib.request
import urllib.parse
from config import get_supabase, RAW_TABLE, STORAGE_BUCKET, CSV_FILENAME, SUPABASE_URL, SUPABASE_SERVICE_KEY


def read_csv_from_storage(batch_tag: str = None) -> list[dict]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
        return []

    encoded_fn = urllib.parse.quote(CSV_FILENAME)
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{encoded_fn}"
    headers = {"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY}

    req = urllib.request.Request(url, headers=headers)
    r = urllib.request.urlopen(req)
    content = r.read().decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(content))
    rows = []
    for row in reader:
        rows.append(row)
        if len(rows) % 10000 == 0:
            print(f"  Parsed {len(rows)} rows...")

    print(f"Total CSV rows parsed: {len(rows)}")
    return rows


def insert_to_raw(rows: list[dict], batch_tag: str, batch_size: int = 1000) -> int:
    supabase = get_supabase()
    if not supabase or not rows:
        return 0

    total = 0
    for i in range(0, len(rows), batch_size):
        batch_rows = rows[i : i + batch_size]
        records = []
        for row in batch_rows:
            rec = {}
            for col in [
                "event_id_cnty", "event_date", "year", "time_precision",
                "disorder_type", "event_type", "sub_event_type",
                "actor1", "assoc_actor_1", "inter1",
                "actor2", "assoc_actor_2", "inter2",
                "interaction", "civilian_targeting", "iso",
                "region", "country", "admin1", "admin2", "admin3",
                "location", "latitude", "longitude", "geo_precision",
                "source", "source_scale", "notes", "fatalities",
                "tags", "timestamp",
            ]:
                val = row.get(col, "").strip()
                rec[col] = val if val else None

            rec["upload_batch"] = batch_tag
            records.append(rec)

        response = (
            supabase.table(RAW_TABLE)
            .upsert(records, on_conflict="event_id_cnty")
            .execute()
        )

        total += len(records)
        print(f"  Inserted/upserted batch {i // batch_size + 1}: {len(records)} records")

    print(f"Total records in {RAW_TABLE}: {total}")
    return total


def storage_to_raw(batch_tag: str = None) -> int:
    if not batch_tag:
        from datetime import datetime
        batch_tag = datetime.utcnow().strftime("%Y-W%V")

    print(f"Importing CSV from Storage bucket '{STORAGE_BUCKET}'...")
    rows = read_csv_from_storage(batch_tag)
    if not rows:
        return 0

    print(f"Inserting {len(rows)} rows into {RAW_TABLE} (batch: {batch_tag})...")
    return insert_to_raw(rows, batch_tag)
