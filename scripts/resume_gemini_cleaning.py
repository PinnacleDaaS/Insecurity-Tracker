"""Resume Gemini cleaning for rows left as pending by a previous interrupted/partial run.
Reads the existing _cleaned.csv, re-runs Gemini only on rows with review_status != 'ai_cleaned',
applies results, rewrites the cleaned CSV, and re-exports incidents.json / notes.json.
"""

import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

sys.path.insert(0, str(Path(__file__).parent))
from fatality_classifier import split_fatalities

STATE_TO_ZONE = {
    'Adamawa': 'North East', 'Bauchi': 'North East', 'Borno': 'North East', 'Gombe': 'North East', 'Taraba': 'North East', 'Yobe': 'North East',
    'Jigawa': 'North West', 'Kaduna': 'North West', 'Kano': 'North West', 'Katsina': 'North West', 'Kebbi': 'North West', 'Sokoto': 'North West', 'Zamfara': 'North West',
    'Benue': 'North Central', 'Kogi': 'North Central', 'Kwara': 'North Central', 'Nasarawa': 'North Central', 'Niger': 'North Central', 'Plateau': 'North Central', 'FCT': 'North Central',
    'Abia': 'South East', 'Anambra': 'South East', 'Ebonyi': 'South East', 'Enugu': 'South East', 'Imo': 'South East',
    'Akwa Ibom': 'South South', 'Bayelsa': 'South South', 'Cross River': 'South South', 'Delta': 'South South', 'Edo': 'South South', 'Rivers': 'South South',
    'Ekiti': 'South West', 'Lagos': 'South West', 'Ogun': 'South West', 'Ondo': 'South West', 'Osun': 'South West', 'Oyo': 'South West'
}
STATE_ALIASES = {
    'Nassarawa': 'Nasarawa',
    'Federal Capital Territory': 'FCT',
}


class RowCleanResult(BaseModel):
    id: str = Field(description="The event_id_cnty of the record.")
    is_kidnap: bool = Field(description="TRUE if any kidnapping or abduction of people occurred in this incident.")
    k: int = Field(description="The exact number of people kidnapped or abducted. 0 if none or unclear.")
    target_category: str = Field(description="The primary target category of the incident notes.")
    d: bool = Field(default=False, description="TRUE if this record is a duplicate of another event in this batch.")
    r: str | None = Field(default=None, description="If it is a duplicate, the event_id_cnty of the primary record it duplicates.")


def call_gemini(client: genai.Client, model_name: str, batch_rows: list[dict]) -> list[RowCleanResult]:
    system_instruction = f"""You are a data-cleaning assistant for the Nigerian Armed Conflict Location & Event Data (ACLED) database. Your task is to analyze incident notes and extract structured information.

Your output MUST be a JSON list of objects, where each object matches the schema defined in the response_schema.

RULES FOR target_category:
Classify the target of the incident into exactly one of these categories based on the notes:
- 'Place of Worship': church, mosque, shrine, worshippers, religious gathering.
- 'Educational Institution': school, university, college, teachers, students.
- 'Oil & Gas Infrastructure': oil pipeline, gas pipeline, refinery, flow station, oil company property.
- 'Financial/Bank': bank, ATM, bullion van, financial office.
- 'Agricultural/Farm': farm, crops, farmers working on farm, cattle rustling (livestock theft), pastoralists.
- 'Commercial/Market': market, shops, plaza, traders, business premises.
- 'Transport/Transit': highway, road, vehicle, bus, passenger, road block, travelers.
- 'Government/Police': police station, checkpoint, military base, INEC official, election venue, politician, palace (emir/king/monarch).
- 'Residential/Village': village raid, private house, community, residential neighborhood.
- 'General/Unspecified': default if none of the above are specifically targeted.

RULES FOR is_kidnap and k (kidnapped count):
- Set is_kidnap to true if the notes indicate ANY people were kidnapped, abducted, or held hostage.
- Extract the exact number of people kidnapped or abducted as k.
- Apply natural language understanding to interpret quantities (e.g., 'several' -> 5, 'dozens' -> 24, 'scores' -> 20, etc.).
- If a range is given (e.g. '20-30'), return the lower bound (20).
- If the incident describes cattle rustling (animals stolen) or property stolen rather than people, set k = 0, is_kidnap = false.
- If the incident describes a rescue, release, or escape operation (not a kidnapping event), set k = 0.
- If no people were kidnapped or the number is unclear, return 0.

RULES FOR d / r (duplicates):
- Compare incidents within this batch that share the same date, similar location, and similar notes.
- If two or more incidents appear to be the same event reported by different sources, flag all but one as duplicates.
- Set d = true for duplicates, and r to the event_id_cnty of the primary record it duplicates.
- Be conservative — only flag clear duplicates."""

    prompt_rows = []
    for r in batch_rows:
        prompt_rows.append({
            "event_id_cnty": r["event_id_cnty"],
            "event_date": r["event_date"],
            "location": r["location"],
            "state_clean": r["state_clean"],
            "event_type": r["event_type"],
            "notes": r["notes"],
        })

    prompt = json.dumps(prompt_rows, indent=2)

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=list[RowCleanResult],
        )
    )

    if not response.parsed:
        raise ValueError("Gemini returned an empty parsed response")

    return response.parsed


def export_dashboard_json(rows: list[dict]):
    cols = ['event_id_cnty', 'event_date', 'year', 'event_type', 'sub_event_type',
            'state_clean', 'lga_clean', 'geopolitical_zone', 'actor1', 'actor2',
            'location', 'latitude', 'longitude', 'fatalities', 'kidnapped_count',
            'civilian_targeting', 'fatalities_civilians', 'fatalities_security_forces',
            'fatalities_combatants', 'presidential_admin', 'updated_at']
    filtered = [r for r in rows if r.get('is_duplicate') != 'True' and r.get('is_duplicate') is not True]
    exported = []
    for r in filtered:
        state = STATE_ALIASES.get(r.get('state_clean', ''), r.get('state_clean', ''))
        zone = STATE_TO_ZONE.get(state, r.get('geopolitical_zone', ''))
        civilian_targeting = str(r.get('civilian_targeting', '')).strip().lower() == 'true'
        try:
            fatalities = int(r.get('fatalities', 0) or 0)
        except (ValueError, TypeError):
            fatalities = 0
        notes_text = (r.get('notes') or '')
        civ, sec, comb = split_fatalities(fatalities, r.get('event_type', ''),
                                           civilian_targeting, notes_text)
        row = {}
        for c in cols:
            v = r.get(c)
            if c == 'civilian_targeting':
                row[c] = civilian_targeting
            elif c == 'state_clean':
                row[c] = state
            elif c == 'geopolitical_zone':
                row[c] = zone
            elif c in ('year', 'fatalities', 'kidnapped_count'):
                try:
                    row[c] = int(v)
                except (ValueError, TypeError):
                    row[c] = 0
            elif c in ('latitude', 'longitude'):
                try:
                    row[c] = float(v)
                except (ValueError, TypeError):
                    row[c] = 0.0
            elif c == 'fatalities_civilians':
                row[c] = civ
            elif c == 'fatalities_security_forces':
                row[c] = sec
            elif c == 'fatalities_combatants':
                row[c] = comb
            else:
                row[c] = v
        exported.append(row)
    exported.sort(key=lambda r: r['event_date'], reverse=True)
    out = Path(__file__).parent.parent / 'tracker-app' / 'public' / 'data' / 'incidents.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(exported, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Dashboard data exported: {len(exported)} rows to {out}")


def export_notes_json(rows: list[dict]):
    notes = {}
    for r in rows:
        if r.get('is_duplicate') == 'True' or r.get('is_duplicate') is True:
            continue
        n = (r.get('notes') or '').strip()
        if n:
            notes[r['event_id_cnty']] = n
    out = Path(__file__).parent.parent / 'tracker-app' / 'public' / 'data' / 'notes.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(notes, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Notes exported: {len(notes)} entries to {out}")


def main():
    load_dotenv()

    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        print("Error: GEMINI_API_KEY environment variable not found.")
        sys.exit(1)
    client = genai.Client(api_key=gemini_key)

    cleaned_paths = sorted(Path('.').glob('*_cleaned.csv'))
    if not cleaned_paths:
        print("Error: no *_cleaned.csv found in project root.")
        sys.exit(1)
    cleaned_path = cleaned_paths[-1]
    print(f"Using cleaned CSV: {cleaned_path}")

    with open(cleaned_path, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    pending = [r for r in rows if r.get('review_status') != 'ai_cleaned']
    if not pending:
        print("All rows already cleaned — nothing to do.")
        sys.exit(0)

    print(f"Total rows: {len(rows)} | Already cleaned: {len(rows) - len(pending)} | Pending: {len(pending)}")

    GEMINI_CHUNK = 100
    success = 0
    failed = 0
    results_map = {}

    for i in range(0, len(pending), GEMINI_CHUNK):
        chunk = pending[i:i + GEMINI_CHUNK]
        chunk_num = i // GEMINI_CHUNK + 1
        total_chunks = (len(pending) - 1) // GEMINI_CHUNK + 1
        last_err = None
        for attempt in range(4):
            try:
                chunk_results = call_gemini(client, "gemini-2.5-flash", chunk)
                for res in chunk_results:
                    results_map[res.id] = res
                success += len(chunk_results)
                print(f"  Gemini resume-chunk {chunk_num}/{total_chunks} (attempt {attempt + 1}): cleaned {len(chunk_results)} events")
                break
            except Exception as e:
                last_err = e
                print(f"  Gemini resume-chunk {chunk_num}/{total_chunks} attempt {attempt + 1} failed: {e}")
                time.sleep(5 * (attempt + 1))
        else:
            failed += len(chunk)
            print(f"  SKIPPING resume-chunk {chunk_num}/{total_chunks} after retries ({len(chunk)} rows)")

    print(f"Extra cleaned: {success} events, failed: {failed} rows")

    applied = 0
    total_kidnapped = 0
    total_duplicates = 0
    for r in pending:
        res = results_map.get(r['event_id_cnty'])
        if res:
            r['is_kidnap'] = 'True' if res.is_kidnap else 'False'
            r['kidnapped_count'] = res.k
            r['target_category'] = res.target_category
            r['is_duplicate'] = 'True' if res.d else 'False'
            if res.d and res.r:
                r['duplicate_of'] = res.r
                r['review_note'] = f"AI: duplicate of {res.r}"
                total_duplicates += 1
            else:
                r['duplicate_of'] = ''
                r['review_note'] = ''
            r['review_status'] = 'ai_cleaned'
            applied += 1
            total_kidnapped += res.k

    print(f"Applied AI results to {applied} rows | total kidnapped {total_kidnapped} | duplicates {total_duplicates}")

    fieldnames = list(rows[0].keys())
    with open(cleaned_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Rewrote {cleaned_path}")

    not_cleaned = [r for r in rows if r.get('review_status') != 'ai_cleaned']
    if not_cleaned:
        print(f"WARNING: {len(not_cleaned)} rows still pending — check API key/quota.")

    export_dashboard_json(rows)
    export_notes_json(rows)
    print("Resume cleaning complete!")


if __name__ == "__main__":
    main()