import pandas as pd
import numpy as np
from datetime import datetime
from config import STATE_MAP, ZONE_MAP
from nlp_parsers import classify_actor, get_administration


def standardize_states(df: pd.DataFrame) -> pd.DataFrame:
    admin1_col = None
    for col in ["admin1", "admin_1", "state", "state_name"]:
        if col in df.columns:
            admin1_col = col
            break

    if not admin1_col:
        df["state_clean"] = "Unknown"
        return df

    df["state_clean"] = (
        df[admin1_col]
        .astype(str)
        .str.lower()
        .str.strip()
        .map(lambda x: STATE_MAP.get(x, x.title() if x != "nan" else "Unknown"))
    )
    df["state_clean"] = df["state_clean"].fillna("Unknown")
    return df


def assign_zones(df: pd.DataFrame) -> pd.DataFrame:
    df["geopolitical_zone"] = (
        df["state_clean"]
        .map(ZONE_MAP)
        .fillna("Unknown")
    )
    return df


def clean_lgas(df: pd.DataFrame) -> pd.DataFrame:
    admin2_col = None
    for col in ["admin2", "admin_2", "lga", "lga_name"]:
        if col in df.columns:
            admin2_col = col
            break

    if not admin2_col:
        df["lga_clean"] = None
        return df

    df["lga_clean"] = (
        df[admin2_col]
        .astype(str)
        .str.strip()
        .str.title()
        .replace("Nan", None)
        .replace("", None)
    )
    return df


def clean_coordinates(df: pd.DataFrame) -> pd.DataFrame:
    lat_col = None
    lon_col = None
    for col in ["latitude", "lat"]:
        if col in df.columns:
            lat_col = col
            break
    for col in ["longitude", "lon", "lng", "long"]:
        if col in df.columns:
            lon_col = col
            break

    if lat_col:
        df["latitude"] = pd.to_numeric(df[lat_col], errors="coerce")
    else:
        df["latitude"] = np.nan

    if lon_col:
        df["longitude"] = pd.to_numeric(df[lon_col], errors="coerce")
    else:
        df["longitude"] = np.nan

    return df


def clean_fatalities(df: pd.DataFrame) -> pd.DataFrame:
    fat_col = None
    for col in ["fatalities", "fatal", "deaths"]:
        if col in df.columns:
            fat_col = col
            break

    if fat_col:
        df["fatalities"] = (
            pd.to_numeric(df[fat_col], errors="coerce")
            .fillna(0)
            .astype(int)
        )
    else:
        df["fatalities"] = 0

    return df


def parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    date_col = None
    for col in ["event_date", "date"]:
        if col in df.columns:
            date_col = col
            break

    if date_col:
        df["event_date"] = pd.to_datetime(df[date_col], errors="coerce")
    else:
        df["event_date"] = pd.NaT

    df["year"] = df["event_date"].dt.year.fillna(0).astype(int)
    return df


def clean_actors(df: pd.DataFrame) -> pd.DataFrame:
    for col, out_col in [("actor1", "actor1_group"), ("actor2", "actor2_group")]:
        if col in df.columns:
            df[out_col] = df[col].astype(str).apply(classify_actor)
        else:
            df[out_col] = "Other Armed Group / Others"
    return df


def assign_admin_periods(df: pd.DataFrame) -> pd.DataFrame:
    df["presidential_admin"] = df["event_date"].apply(get_administration)
    return df


def convert_types(df: pd.DataFrame) -> pd.DataFrame:
    int_fields = ["year", "time_precision"]
    for field in int_fields:
        if field in df.columns:
            df[field] = pd.to_numeric(df[field], errors="coerce").fillna(0).astype(int)

    str_fields = [
        "event_id_cnty", "event_type", "sub_event_type",
        "disorder_type", "actor1", "actor2", "location", "notes",
        "region", "country", "source", "source_scale",
    ]
    for field in str_fields:
        if field in df.columns:
            df[field] = df[field].astype(str).replace("nan", None).replace("", None)

    return df


def normalize_civilian_targeting(df: pd.DataFrame) -> pd.DataFrame:
    if "civilian_targeting" in df.columns:
        df["civilian_targeting"] = df["civilian_targeting"].apply(
            lambda x: True if isinstance(x, str) and x.strip().lower() == "civilian targeting" else False
        )
    else:
        df["civilian_targeting"] = False
    return df


def run_cleaning(df: pd.DataFrame) -> pd.DataFrame:
    df = convert_types(df)
    df = standardize_states(df)
    df = assign_zones(df)
    df = clean_lgas(df)
    df = clean_coordinates(df)
    df = clean_fatalities(df)
    df = parse_dates(df)
    df = clean_actors(df)
    df = assign_admin_periods(df)
    df = normalize_civilian_targeting(df)

    if "event_id_cnty" not in df.columns:
        df["event_id_cnty"] = df.index.astype(str)

    return df
