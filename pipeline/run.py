#!/usr/bin/env python3
"""
Nigeria Insecurity Tracker — Data Engineering Pipeline
CLI entry point.

Usage:
    python pipeline/run.py                         # Step 0: import from storage + process all
    python pipeline/run.py --import-only           # Step 0 only: import CSV from storage to raw
    python pipeline/run.py --batch 2026-W21        # Process specific batch
    python pipeline/run.py --rebuild               # Rebuild clean_incidents from all raw data
    python pipeline/run.py --refresh-only          # Only refresh materialized views
"""

import argparse
import sys
import pandas as pd

from config import get_supabase
from storage_import import storage_to_raw
from extract import fetch_raw_records, get_processed_ids, get_batches
from clean import run_cleaning
from nlp_parsers import extract_kidnappings, partition_fatalities, extract_target_category
from dedup import run_dedup
from load import upsert_clean_records
from refresh_views import refresh_all_views


def run_nlp(df: pd.DataFrame) -> pd.DataFrame:
    print("Running NLP extraction...")
    for idx, row in df.iterrows():
        note = row.get("notes", "")
        total_fatalities = row.get("fatalities", 0)

        if not isinstance(total_fatalities, (int, float)):
            total_fatalities = 0
        total_fatalities = int(total_fatalities)

        is_kidnap, count = extract_kidnappings(note)
        df.at[idx, "is_kidnap"] = is_kidnap
        df.at[idx, "kidnapped_count"] = count

        df.at[idx, "target_category"] = extract_target_category(note)

        combatants, security, civilians = partition_fatalities(note, total_fatalities)
        df.at[idx, "fatalities_combatants"] = combatants
        df.at[idx, "fatalities_security_forces"] = security
        df.at[idx, "fatalities_civilians"] = civilians

    print(f"NLP extraction complete for {len(df)} records")
    return df


def run_pipeline(batch: str | None = None, rebuild: bool = False,
                 refresh_only: bool = False, import_only: bool = False) -> None:
    supabase = get_supabase()
    if not supabase:
        sys.exit(1)

    if import_only:
        print("Import-only mode: CSV from Storage -> raw_incidents...")
        storage_to_raw()
        return

    if refresh_only:
        print("Refreshing materialized views...")
        refresh_all_views()
        return

    if not rebuild and not batch:
        print("Step 0: Importing latest CSV from Storage...")
        storage_to_raw()

    if rebuild:
        print("Rebuild mode: fetching ALL raw records...")
        raw_df = fetch_raw_records()
    elif batch:
        print(f"Batch mode: fetching raw records for batch '{batch}'...")
        raw_df = fetch_raw_records(batch)
    else:
        print("Auto mode: fetching unprocessed batches...")
        processed_ids = get_processed_ids(supabase)

        all_raw = fetch_raw_records()
        if all_raw.empty:
            print("No raw records found.")
            return

        new_records = all_raw[~all_raw["event_id_cnty"].isin(processed_ids)] if not all_raw.empty else all_raw

        if new_records.empty:
            print("No new records to process.")
            refresh_all_views()
            return

        raw_df = new_records
        print(f"Found {len(raw_df)} new records to process.")

    if raw_df.empty:
        print("No raw data to process.")
        return

    print("Step 1: Cleaning data...")
    df = run_cleaning(raw_df)
    print(f"  Cleaned {len(df)} records")

    print("Step 2: Running NLP extraction...")
    df = run_nlp(df)

    print("Step 3: Running deduplication...")
    df = run_dedup(df)

    df["is_reference"] = False

    print("Step 4: Loading to clean_incidents...")
    upsert_clean_records(df)

    print("Step 5: Refreshing materialized views...")
    refresh_all_views()

    print("Pipeline complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nigeria Insecurity Tracker Pipeline")
    parser.add_argument("--batch", type=str, help="Process specific upload batch only")
    parser.add_argument("--rebuild", action="store_true", help="Rebuild from all raw data")
    parser.add_argument("--refresh-only", action="store_true", help="Only refresh materialized views")
    parser.add_argument("--import-only", action="store_true", help="Step 0 only: import CSV from Storage to raw_incidents")
    args = parser.parse_args()

    run_pipeline(batch=args.batch, rebuild=args.rebuild, refresh_only=args.refresh_only, import_only=args.import_only)
