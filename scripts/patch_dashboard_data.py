"""One-off data repair for tracker-app/public/data.

Applies the canonical state aliases (Nassarawa -> Nasarawa, Federal Capital
Territory -> FCT), re-derives the geopolitical zone from the canonical state,
and adds the three fatality-breakdown fields (fatalities_civilians,
fatalities_security_forces, fatalities_combatants) to every incident using
the notes-based classifier.

Also regenerates meta.json from the updated incidents.json.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fatality_classifier import split_fatalities

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "tracker-app" / "public" / "data"

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


def main():
    incidents_path = DATA_DIR / "incidents.json"
    notes_path = DATA_DIR / "notes.json"

    with open(incidents_path, encoding="utf-8") as f:
        incidents = json.load(f)
    notes = {}
    if notes_path.exists():
        with open(notes_path, encoding="utf-8") as f:
            notes = json.load(f)
    print(f"Loaded {len(incidents)} incidents, {len(notes)} notes")

    changed_state = 0
    added_fields = 0
    for r in incidents:
        state = r.get("state_clean", "")
        canonical = STATE_ALIASES.get(state, state)
        if canonical != state:
            r["state_clean"] = canonical
            changed_state += 1
        zone = STATE_TO_ZONE.get(canonical)
        if zone:
            r["geopolitical_zone"] = zone
        n = notes.get(r["event_id_cnty"], "")
        civ, sec, comb = split_fatalities(
            r["fatalities"], r.get("event_type", ""), r["civilian_targeting"], n)
        r["fatalities_civilians"] = civ
        r["fatalities_security_forces"] = sec
        r["fatalities_combatants"] = comb
        added_fields += 1

    incidents.sort(key=lambda r: r["event_date"], reverse=True)

    # Ensure every row has all three fields even when notes were missing.
    missing = sum(1 for r in incidents if "fatalities_civilians" not in r)
    with open(incidents_path, "w", encoding="utf-8") as f:
        json.dump(incidents, f, ensure_ascii=False, separators=(",", ":"))

    zones = {}
    for r in incidents:
        zones[r["geopolitical_zone"]] = zones.get(r["geopolitical_zone"], 0) + 1
    states = {}
    for r in incidents:
        states[r["state_clean"]] = states.get(r["state_clean"], 0) + 1

    total_fat = sum(float(r["fatalities"]) for r in incidents)
    by_zone = {}
    for r in incidents:
        z = r["geopolitical_zone"]
        b = by_zone.setdefault(z, [0.0, 0.0, 0.0])
        b[0] += r["fatalities_civilians"]
        b[1] += r["fatalities_security_forces"]
        b[2] += r["fatalities_combatants"]

    print(f"State aliases applied: {changed_state} rows")
    print(f"Rows patched with fatality fields: {added_fields} (missing={missing})")
    print(f"Unspecified zone rows remaining: {zones.get('General/Unspecified', 0)}")
    print(f"State counts for Nasarawa: {states.get('Nasarawa', 0)}, FCT: {states.get('FCT', 0)}")
    print(f"Total fatalities: {total_fat:.0f}")
    for z, (c, s, b) in sorted(by_zone.items()):
        print(f"  {z}: civ={c:9.0f} sec={s:6.0f} comb={b:9.0f}")

    meta = {
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "row_count": len(incidents),
        "notes_count": len(notes),
        "file_size": incidents_path.stat().st_size,
        "date_min": incidents[-1]["event_date"] if incidents else None,
        "date_max": incidents[0]["event_date"] if incidents else None,
    }
    with open(DATA_DIR / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta.json written: {meta['row_count']} rows, {meta['date_min']} -> {meta['date_max']}")

    # Quick sanity: totals across zones must equal overall fatalities.
    total_by_zone = sum(float(by_zone[z][0]) + float(by_zone[z][1]) + float(by_zone[z][2]) for z in by_zone)
    print(f"Sanity check zone total vs total fatalities: {total_by_zone:.0f} == {total_fat:.0f} -> {abs(total_by_zone - total_fat) < 1}")


if __name__ == "__main__":
    main()