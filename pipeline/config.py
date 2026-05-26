import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

RAW_TABLE = "raw_incidents"
CLEAN_TABLE = "clean_incidents"

STORAGE_BUCKET = "acled_raw_csv"
CSV_FILENAME = "ACLED Data_2026-05-13.csv"

def get_supabase() -> Client | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env or environment")
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

STATE_MAP = {
    "imo": "Imo", "kogi": "Kogi", "nassarawa": "Nasarawa",
    "kanu": "Kano", "benue": "Benue", "borno": "Borno",
    "bauchi": "Bauchi", "adamawa": "Adamawa", "yobe": "Yobe",
    "taraba": "Taraba", "plateau": "Plateau", "niger": "Niger",
    "kwara": "Kwara", "kebbi": "Kebbi", "katsina": "Katsina",
    "kaduna": "Kaduna", "jigawa": "Jigawa", "sokoto": "Sokoto",
    "zamfara": "Zamfara", "fct": "FCT", "federal capital territory": "FCT", "gombe": "Gombe",
    "anambra": "Anambra", "cross river": "Cross River",
    "delta": "Delta", "edo": "Edo", "rivers": "Rivers",
    "bayelsa": "Bayelsa", "akwa ibom": "Akwa Ibom",
    "abia": "Abia", "ebonyi": "Ebonyi", "enugu": "Enugu",
    "ekiti": "Ekiti", "lagos": "Lagos", "ogun": "Ogun",
    "ondo": "Ondo", "osun": "Osun", "oyo": "Oyo",
}

ZONE_MAP = {
    "Adamawa": "North East", "Bauchi": "North East",
    "Borno": "North East", "Gombe": "North East",
    "Taraba": "North East", "Yobe": "North East",
    "Jigawa": "North West", "Kaduna": "North West",
    "Kano": "North West", "Katsina": "North West",
    "Kebbi": "North West", "Sokoto": "North West",
    "Zamfara": "North West",
    "Benue": "North Central", "FCT": "North Central",
    "Kogi": "North Central", "Kwara": "North Central",
    "Nasarawa": "North Central", "Niger": "North Central",
    "Plateau": "North Central",
    "Abia": "South East", "Anambra": "South East",
    "Ebonyi": "South East", "Enugu": "South East",
    "Imo": "South East",
    "Akwa Ibom": "South South", "Bayelsa": "South South",
    "Cross River": "South South", "Delta": "South South",
    "Edo": "South South", "Rivers": "South South",
    "Ekiti": "South West", "Lagos": "South West",
    "Ogun": "South West", "Ondo": "South West",
    "Osun": "South West", "Oyo": "South West",
}

NUMBER_MAP = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "dozen": 12, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60,
    "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100,
    "several": 5, "dozens": 24, "scores": 40, "numerous": 10,
}

KIDNAP_KEYWORDS = [
    "abduct", "kidnap", "hostage", "captor",
    "held captive", "seized", "whisked", "rustled",
]

COMBATANT_TERMS = [
    "bandits", "terrorists", "gunmen", "bh", "boko haram",
    "iswap", "insurgents", "militants", "attackers",
]

SECURITY_TERMS = [
    "soldiers", "police", "troops", "military", "cjtf",
    "officers", "forces", "jtf",
]

CIVILIAN_TERMS = [
    "worshippers", "farmers", "villagers", "women",
    "children", "residents", "commuters", "herders",
]
