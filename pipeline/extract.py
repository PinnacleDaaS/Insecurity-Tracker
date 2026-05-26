import pandas as pd
from config import get_supabase, RAW_TABLE


def fetch_raw_records(batch: str | None = None) -> pd.DataFrame:
    supabase = get_supabase()
    if not supabase:
        return pd.DataFrame()

    query = supabase.table(RAW_TABLE).select("*")

    if batch:
        query = query.eq("upload_batch", batch)

    response = query.execute()

    if not response.data:
        print(f"No raw records found" + (f" for batch '{batch}'" if batch else ""))
        return pd.DataFrame()

    df = pd.DataFrame(response.data)

    if "id" in df.columns:
        df = df.drop(columns=["id"])
    if "uploaded_at" in df.columns:
        df = df.drop(columns=["uploaded_at"])

    print(f"Fetched {len(df)} raw records" + (f" for batch '{batch}'" if batch else ""))
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
