#!/usr/bin/env python3
"""
Batch Review System — Process N records, export for human review, import corrections.

Usage:
    python pipeline/review_batch.py [--batch-size 1000] [--offset 0] [--output review_batch_001.csv]
    python pipeline/review_batch.py --import review_batch_001.csv
    python pipeline/review_batch.py --status
"""

import argparse
import sys
import os
import csv
import pandas as pd
from datetime import datetime

from config import get_supabase, RAW_TABLE, CLEAN_TABLE
from extract import fetch_raw_records
from clean import run_cleaning
from nlp_parsers import extract_kidnappings, partition_fatalities, extract_target_category
from dedup import run_dedup
from load import upsert_clean_records
from run import run_nlp


REVIEW_COLS = [
    "event_id_cnty", "event_date", "state_clean", "location",
    "event_type", "notes_short",
    "fatalities", "kidnapped_count",
    "fatalities_combatants", "fatalities_security_forces", "fatalities_civilians",
    "civilian_targeting", "is_duplicate",
    "corrected_kidnapped_count", "corrected_fatalities",
    "corrected_combatants", "corrected_security", "corrected_civilians",
    "corrected_duplicate", "review_note",
]


def get_review_status_counts() -> dict:
    supabase = get_supabase()
    if not supabase:
        return {}
    response = supabase.table(CLEAN_TABLE).select("review_status").execute()
    if not response.data:
        return {}
    counts = {}
    for row in response.data:
        s = row.get("review_status", "pending")
        counts[s] = counts.get(s, 0) + 1
    return counts


def export_batch(batch_size: int = 1000, offset: int = 0, output: str = None) -> str:
    supabase = get_supabase()
    if not supabase:
        sys.exit(1)

    all_raw = fetch_raw_records()
    if all_raw.empty:
        print("No raw records found.")
        return None

    supabase = get_supabase()
    response = supabase.table(CLEAN_TABLE).select("event_id_cnty").execute()
    processed_ids = {row["event_id_cnty"] for row in response.data}

    response_r = supabase.table(CLEAN_TABLE).select("event_id_cnty").eq("review_status", "reviewed").execute()
    verified_ids = {row["event_id_cnty"] for row in response_r.data}

    unprocessed = all_raw[~all_raw["event_id_cnty"].isin(processed_ids)]
    pending = all_raw[all_raw["event_id_cnty"].isin(processed_ids - verified_ids)]

    batch_df = pd.concat([unprocessed, pending])
    if batch_df.empty:
        print("No unverified records to process.")
        rc = get_review_status_counts()
        print(f"  Reviewed: {rc.get('reviewed', 0)}  Pending: {rc.get('pending', 0)}")
        return None

    batch_df = batch_df.head(batch_size)
    print(f"Processing batch: {len(batch_df)} records (offset {offset})")

    df = run_cleaning(batch_df)
    print(f"  Cleaned: {len(df)} records")

    df = run_nlp(df)
    print(f"  NLP done")

    df["_orig_fatalities"] = df["fatalities"].copy()
    df["_orig_kidnapped"] = df["kidnapped_count"].copy()
    df["_orig_combatants"] = df["fatalities_combatants"].copy()
    df["_orig_security"] = df["fatalities_security_forces"].copy()
    df["_orig_civilians"] = df["fatalities_civilians"].copy()
    df["_orig_duplicate"] = df["is_duplicate"].copy() if "is_duplicate" in df.columns else False

    df = run_dedup(df)
    print(f"  Dedup done")

    def trunc(n, limit=120):
        if not isinstance(n, str):
            return ""
        return n[:limit] + "..." if len(n) > limit else n

    rows = []
    for _, row in df.iterrows():
        is_dup = row.get("is_duplicate", False)
        orig_dup = row.get("_orig_duplicate", False)
        duplicate_status = "Yes" if is_dup else "No"
        if is_dup and not orig_dup:
            duplicate_status = "Flagged by dedup"

        rows.append({
            "event_id_cnty": row.get("event_id_cnty", ""),
            "event_date": str(row.get("event_date", ""))[:10] if pd.notna(row.get("event_date")) else "",
            "state_clean": row.get("state_clean", ""),
            "location": row.get("location", ""),
            "event_type": row.get("event_type", ""),
            "notes_short": trunc(row.get("notes", "")),
            "fatalities": row.get("_orig_fatalities", row.get("fatalities", 0)),
            "kidnapped_count": row.get("_orig_kidnapped", row.get("kidnapped_count", 0)),
            "fatalities_combatants": row.get("_orig_combatants", row.get("fatalities_combatants", 0)),
            "fatalities_security_forces": row.get("_orig_security", row.get("fatalities_security_forces", 0)),
            "fatalities_civilians": row.get("_orig_civilians", row.get("fatalities_civilians", 0)),
            "civilian_targeting": "Yes" if row.get("civilian_targeting") else "No",
            "is_duplicate": duplicate_status,
            "corrected_kidnapped_count": "",
            "corrected_fatalities": "",
            "corrected_combatants": "",
            "corrected_security": "",
            "corrected_civilians": "",
            "corrected_duplicate": "",
            "review_note": "",
        })

    out_df = pd.DataFrame(rows)

    if not output:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = f"review_batch_{ts}.csv"

    out_df.to_csv(output, index=False)
    print(f"\nReview CSV written to: {output}")
    print(f"  Records: {len(out_df)}")
    print(f"\nInstructions:")
    print(f"  1. Open {output} in Excel or Google Sheets")
    print(f"  2. For each row, enter corrections in the corrected_* columns")
    print(f"  3. Leave blank if the NLP result is correct")
    print(f"  4. Save the CSV")
    print(f"  5. Run: python pipeline/review_batch.py --import {output}")
    return output


def import_corrections(csv_path: str):
    if not os.path.exists(csv_path):
        print(f"ERROR: File not found: {csv_path}")
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f"Reading corrections from: {csv_path} ({len(df)} records)")

    supabase = get_supabase()
    if not supabase:
        sys.exit(1)

    corrected = 0
    unchanged = 0
    for _, row in df.iterrows():
        eid = row.get("event_id_cnty")
        if not eid or pd.isna(eid):
            continue

        has_correction = False
        update_data = {"review_status": "reviewed", "review_note": ""}

        for src_field, dst_field in [
            ("corrected_kidnapped_count", "kidnapped_count"),
            ("corrected_fatalities", "fatalities"),
            ("corrected_combatants", "fatalities_combatants"),
            ("corrected_security", "fatalities_security_forces"),
            ("corrected_civilians", "fatalities_civilians"),
        ]:
            val = row.get(src_field)
            if pd.notna(val) and str(val).strip() != "":
                update_data[dst_field] = int(float(val))
                has_correction = True

        dup_val = row.get("corrected_duplicate")
        if pd.notna(dup_val) and str(dup_val).strip().lower() in ("yes", "y", "true", "1"):
            update_data["is_duplicate"] = True
            update_data["fatalities"] = 0
            update_data["kidnapped_count"] = 0
            has_correction = True
        elif pd.notna(dup_val) and str(dup_val).strip().lower() in ("no", "n", "false", "0"):
            update_data["is_duplicate"] = False
            has_correction = True

        note_val = row.get("review_note")
        if pd.notna(note_val) and str(note_val).strip() != "":
            update_data["review_note"] = str(note_val).strip()

        if has_correction:
            corrected += 1
        else:
            update_data["review_status"] = "auto_ok"
            unchanged += 1

        supabase.table(CLEAN_TABLE).upsert(update_data, on_conflict="event_id_cnty").execute()

    print(f"\nImport complete:")
    print(f"  Auto-verified (no correction needed): {unchanged}")
    print(f"  Corrected: {corrected}")
    print(f"  Total: {unchanged + corrected}")

    rc = get_review_status_counts()
    print(f"\nOverall review progress:")
    print(f"  Reviewed: {rc.get('reviewed', 0) + rc.get('auto_ok', 0)}")
    print(f"  Pending: {rc.get('pending', 0)}")


def show_status():
    rc = get_review_status_counts()
    if not rc:
        print("No records in clean_incidents.")
        return
    total = sum(rc.values())
    reviewed = rc.get("reviewed", 0) + rc.get("auto_ok", 0)
    pending = rc.get("pending", 0)
    print(f"Review Status:")
    print(f"  Total: {total}")
    print(f"  Verified: {reviewed} ({reviewed/total*100:.1f}%)")
    print(f"  Pending: {pending} ({pending/total*100:.1f}%)")
    for status, count in sorted(rc.items()):
        print(f"    {status}: {count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch Review System for Nigeria Insecurity Tracker")
    parser.add_argument("--batch-size", type=int, default=1000, help="Records per batch (default: 1000)")
    parser.add_argument("--offset", type=int, default=0, help="Skip first N processed records")
    parser.add_argument("--output", type=str, help="Output CSV path")
    parser.add_argument("--import", dest="import_path", type=str, help="Import corrections from CSV")
    parser.add_argument("--status", action="store_true", help="Show review progress")
    args = parser.parse_args()

    if args.status:
        show_status()
    elif args.import_path:
        import_corrections(args.import_path)
    else:
        export_batch(batch_size=args.batch_size, offset=args.offset, output=args.output)
