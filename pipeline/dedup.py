import pandas as pd
import numpy as np
import re


def run_exact_dedup(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    dup_cols = [c for c in ["event_date", "latitude", "longitude", "actor1", "event_type", "notes"]
                if c in df.columns]

    if len(dup_cols) < 3:
        return df

    df["_exact_dup"] = df.duplicated(subset=dup_cols, keep="first")
    exact_count = df["_exact_dup"].sum()
    print(f"Exact duplicates found: {exact_count}")

    df.loc[df["_exact_dup"], "is_duplicate"] = True
    df.loc[df["_exact_dup"], "fatalities"] = 0
    if "kidnapped_count" in df.columns:
        df.loc[df["_exact_dup"], "kidnapped_count"] = 0

    return df


def jaccard_similarity(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    intersection = a & b
    union = a | b
    return len(intersection) / len(union)


def tokenize_notes(note: str) -> set:
    if not isinstance(note, str) or not note:
        return set()
    tokens = re.findall(r"\b\w+\b", note.lower())
    return set(tokens)


def has_shared_large_number(a: str, b: str) -> bool:
    if not isinstance(a, str) or not isinstance(b, str):
        return False
    nums_a = set(re.findall(r"\b(\d{3,})\b", a))
    nums_b = set(re.findall(r"\b(\d{3,})\b", b))
    return len(nums_a & nums_b) > 0


def first_40_overlap(a: str, b: str) -> bool:
    if not isinstance(a, str) or not isinstance(b, str):
        return False
    return a[:40].strip().lower() == b[:40].strip().lower()


def run_fuzzy_dedup(df: pd.DataFrame, threshold: float = 0.6) -> pd.DataFrame:
    if df.empty or "notes" not in df.columns or "event_date" not in df.columns:
        return df

    not_dup_mask = df["is_duplicate"] != True
    candidates = df[not_dup_mask].copy()
    fuzzy_flagged = set()

    date_groups = candidates.groupby(
        candidates["event_date"].dt.date if hasattr(candidates["event_date"], "dt") else "event_date"
    )

    for date_val, group in date_groups:
        if len(group) < 2:
            continue

        indices = group.index.tolist()
        notes_list = group["notes"].tolist()
        tokens_list = [tokenize_notes(n) for n in notes_list]

        for i in range(len(indices)):
            if indices[i] in fuzzy_flagged:
                continue
            for j in range(i + 1, len(indices)):
                if indices[j] in fuzzy_flagged:
                    continue

                sim = jaccard_similarity(tokens_list[i], tokens_list[j])
                if sim >= threshold:
                    num_overlap = has_shared_large_number(notes_list[i], notes_list[j])
                    prefix_overlap = first_40_overlap(notes_list[i], notes_list[j])

                    if num_overlap or prefix_overlap:
                        fuzzy_flagged.add(indices[j])

    print(f"Fuzzy duplicates found: {len(fuzzy_flagged)}")

    for idx in fuzzy_flagged:
        df.loc[idx, "is_duplicate"] = True
        df.loc[idx, "fatalities"] = 0
        if "kidnapped_count" in df.columns:
            df.loc[idx, "kidnapped_count"] = 0

    return df


def run_dedup(df: pd.DataFrame, threshold: float = 0.6) -> pd.DataFrame:
    if df.empty:
        return df

    if "is_duplicate" not in df.columns:
        df["is_duplicate"] = False

    df = run_exact_dedup(df)
    df = run_fuzzy_dedup(df, threshold)

    if "_exact_dup" in df.columns:
        df = df.drop(columns=["_exact_dup"])

    return df
