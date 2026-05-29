import pandas as pd
from config import get_supabase, RAW_TABLE


def fetch_raw_records(batch: str | None = None) -> pd.DataFrame:
    supabase = get_supabase()
    if not supabase:
        return pd.DataFrame()

    all_data = []
    page_size = 1000
    offset = 0

    while True:
        query = supabase.table(RAW_TABLE).select("*").range(offset, offset + page_size - 1)

        if batch:
            query = query.eq("upload_batch", batch)

        response = query.execute()

        if not response.data:
            break

        all_data.extend(response.data)
        offset += page_size

        if len(response.data) < page_size:
            break

    print(f"Fetched {len(all_data)} raw records" + (f" for batch '{batch}'" if batch else ""))

    if not all_data:
        print(f"No raw records found" + (f" for batch '{batch}'" if batch else ""))
        return pd.DataFrame()

    df = pd.DataFrame(all_data)

    if "id" in df.columns:
        df = df.drop(columns=["id"])
    if "uploaded_at" in df.columns:
        df = df.drop(columns=["uploaded_at"])

    return df


def get_processed_ids(supabase) -> set:
    response = (
        supabase.table("clean_incidents")
        .select("event_id_cnty")
        .execute()
    )
    return {row["event_id_cnty"] for row in response.data}


def get_batches(supabase) -> list[str]:
    response = (
        supabase.table(RAW_TABLE)
        .select("upload_batch")
        .neq("upload_batch", None)
        .execute()
    )
    batches = sorted(set(row["upload_batch"] for row in response.data if row.get("upload_batch")))
    print(f"Available batches: {batches}")
    return batches
