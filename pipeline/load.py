import pandas as pd
import numpy as np
from config import get_supabase, CLEAN_TABLE


def upsert_clean_records(df: pd.DataFrame, batch_size: int = 500) -> int:
    supabase = get_supabase()
    if not supabase or df.empty:
        return 0

    required_cols = [
        "event_id_cnty", "event_date", "year", "time_precision",
        "event_type", "sub_event_type", "state_clean", "geopolitical_zone",
        "lga_clean", "actor1", "actor2", "actor1_group", "actor2_group",
        "location", "latitude", "longitude", "fatalities", "notes",
        "target_category", "is_kidnap", "kidnapped_count",
        "fatalities_combatants", "fatalities_security_forces", "fatalities_civilians",
        "presidential_admin", "civilian_targeting", "is_duplicate", "is_reference",
        "review_status",
    ]

    records = df.to_dict(orient="records")

    total_upserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]

        clean_batch = []
        for row in batch:
            clean_row = {}
            for col in required_cols:
                val = row.get(col)
                if isinstance(val, float) and pd.isna(val):
                    clean_row[col] = None
                elif isinstance(val, pd.Timestamp):
                    clean_row[col] = val.strftime("%Y-%m-%d") if not pd.isna(val) else None
                else:
                    clean_row[col] = val

            for col in ["fatalities", "kidnapped_count",
                        "fatalities_combatants", "fatalities_security_forces",
                        "fatalities_civilians", "year", "time_precision"]:
                if col in clean_row and clean_row[col] is None:
                    clean_row[col] = 0
                elif col in clean_row and isinstance(clean_row[col], (float, np.floating)):
                    clean_row[col] = int(clean_row[col])

            for bool_col in ["is_kidnap", "is_duplicate", "is_reference", "civilian_targeting"]:
                if bool_col in clean_row:
                    clean_row[bool_col] = bool(clean_row[bool_col]) if clean_row[bool_col] is not None else False

            if clean_row.get("review_status") is None:
                clean_row["review_status"] = "pending"

            if clean_row.get("event_id_cnty") is None:
                continue

            clean_batch.append(clean_row)

        if not clean_batch:
            continue

        response = (
            supabase.table(CLEAN_TABLE)
            .upsert(clean_batch, on_conflict="event_id_cnty")
            .execute()
        )

        total_upserted += len(clean_batch)
        print(f"  Upserted batch {i // batch_size + 1}: {len(clean_batch)} records")

    print(f"Total upserted to {CLEAN_TABLE}: {total_upserted}")
    return total_upserted
