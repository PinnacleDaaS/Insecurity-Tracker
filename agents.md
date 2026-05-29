---
name: ui-ux-architect
description: Fixes UI bugs, resolves layout overlaps, builds components, and implements modern design systems. Use when the user asks to "fix a UI bug", "adjust layout", "make it responsive", "improve the design", or "fix interactive elements".
---

# Role & Persona
You are a Staff-Level UI/UX Frontend Engineer. Your expertise lies in building robust, interactive data dashboards, scrollytelling experiences, and modular application suites. You specialize in clean, minimalist design aesthetics (especially dark mode and charcoal themes) and flawless technical execution across modern frontend frameworks and visualization libraries (React, Tailwind, D3.js).

# System & Architectural Rules
1. **Stacking Context Mastery:** Treat `z-index` and visual overlaps as structural architecture, not an afterthought. When integrating third-party libraries (like web maps or complex charts), aggressively manage their bounds using `overflow: hidden` on wrappers. Ensure UI elements like data dictionaries, sidebars, tooltips, and headers have explicit `position` values (relative/absolute/fixed) and logical z-indexes to maintain authority over canvas layers.
2. **Event & State Integrity:** Interactive visual elements (data dots, markers, charts) must always map correctly to state. Ensure interactive layers have `pointer-events: auto` enabled. When writing `onClick` or `onHover` events, ensure they cleanly extract data properties to populate tooltips or side-panels without blocking adjacent UI interactions.
3. **Design System Execution:** Maintain high-contrast, editorial-style minimalism. Avoid visual clutter. Emphasize visual hierarchy using spacing, typography, and controlled color palettes (e.g., deep charcoal backgrounds with high-visibility accent colors for data points).
4. **Implementation Decoupling:** Keep styling and layout logic strictly separated from data-fetching and backend integration logic.

# Task Execution Workflow
1. **Diagnosis First:** Before writing code, briefly analyze the DOM structure and identify the root cause of the UI/UX issue (e.g., missing pointer events, unconstrained flexbox, global CSS collisions, or runaway z-indexes).
2. **Strategic Isolation:** Provide targeted, surgical fixes rather than rewriting entire components from scratch.
3. **Code Output:** Return clear, annotated code snippets with concise explanations of *why* the CSS or JavaScript change resolves the specific visual or interactive bug.

# 🏗 Nigeria Insecurity Tracker — Data Engineering Pipeline

**Supabase Project**: `pvguhssnvzldvnnhmoqk.supabase.co`

## System Architecture

```mermaid
graph TD
    Manual["You: Upload raw CSV to Supabase Storage"] -->|bucket: acled_raw_csv| StorageImport["storage_import.py"]
    StorageImport -->|read CSV + upsert| RawDB[(raw_incidents)]
    RawDB -->|GitHub Actions cron triggers| PythonETL["Python ETL Pipeline"]
    PythonETL -->|extract + clean + NLP + dedup| CleanDB[(clean_incidents)]
    CleanDB -->|pg_cron refreshes| MV[(Materialized Views)]
    MV -->|@supabase/supabase-js queries| Dashboard["React Dashboard"]
```

## Workflow

| Step | Who | What |
|------|-----|------|
| 1 | You (manual, 2 min) | Download ACLED CSV → upload to Supabase Storage bucket `acled_raw_csv` |
| 2 | Python ETL (auto) | Step 0: `storage_import.py` reads CSV from Storage → upserts to `raw_incidents` |
| 3 | Python ETL (auto) | Extract raw from `raw_incidents` → clean → NLP → dedup → upsert to `clean_incidents` |
| 4 | pg_cron (auto) | Refresh all materialized views |
| 5 | Dashboard (auto) | React queries views via Supabase API on load |

## Supabase Project

- URL: https://pvguhssnvzldvnnhmoqk.supabase.co
- Anon Key: in `.env` as `VITE_SUPABASE_ANON_KEY` (safe for frontend)
- Service Key: needed for pipeline (stored in GitHub Actions secrets)

## Database Schema (Medallion Architecture)

### Bronze: raw_incidents
Landing table for CSV uploads. All columns as VARCHAR initially, plus metadata. Mirrors actual ACLED CSV columns (31 fields).
- event_id_cnty (TEXT) — ACLED unique ID
- event_date, year, time_precision (TEXT)
- disorder_type (TEXT) — e.g. "Political violence", "Demonstrations"
- event_type, sub_event_type (TEXT)
- actor1, assoc_actor_1, inter1, actor2, assoc_actor_2, inter2 (TEXT)
- interaction (TEXT) — e.g. "State forces-Identity militia"
- civilian_targeting (TEXT)
- iso (TEXT) — country code (566 for Nigeria)
- region, country, admin1, admin2, admin3 (TEXT)
- location, latitude, longitude (TEXT for lat/lng)
- geo_precision (TEXT)
- source, source_scale, notes (TEXT)
- fatalities (TEXT)
- tags (TEXT)
- timestamp (TEXT)
- upload_batch (TEXT) — e.g. "2026-W21"
- uploaded_at (TIMESTAMPTZ DEFAULT NOW())

### Silver: clean_incidents
After Python pipeline processes raw data.
- event_id_cnty (TEXT PRIMARY KEY) — ACLED unique ID
- event_date (DATE), year (INT), time_precision (INT)
- event_type, sub_event_type (TEXT)
- state_clean (TEXT) — standardized via STATE_MAP
- geopolitical_zone (TEXT) — via ZONE_MAP
- lga_clean (TEXT) — title-cased
- actor1, actor2 (TEXT)
- actor1_group, actor2_group (TEXT) — classified via classify_actor()
- location, latitude (FLOAT), longitude (FLOAT)
- fatalities (INT)
- notes (TEXT)
- target_category (TEXT) — extracted via extract_target_category()
- is_kidnap (BOOLEAN), kidnapped_count (INT)
- fatalities_combatants (INT), fatalities_security_forces (INT), fatalities_civilians (INT)
- presidential_admin (TEXT) — mapped from date
- civilian_targeting (BOOLEAN DEFAULT FALSE) — from raw `civilian_targeting` column
- is_duplicate (BOOLEAN DEFAULT FALSE)
- is_reference (BOOLEAN DEFAULT FALSE)
- updated_at (TIMESTAMPTZ DEFAULT NOW())

### Gold: Materialized Views
1. mv_summary_stats — total incidents, fatalities, distributions (new: civilian_targeting stats)
2. mv_timeline_data — monthly/yearly aggregations (new: civilian targeting breakdown)
3. mv_state_profiles — per-state with coordinate centroids (new: civilian_targeting filters)
4. mv_lga_profiles — top 100 LGAs (new: civilian_targeting filters)
5. mv_actor_profiles — actor group summaries
6. mv_actor_yearly_trends — actor group year-over-year trends
7. mv_incident_explorer — top 500 lethal incidents (new: civilian_targeting column)

## Nigerian State Standardization (STATE_MAP)

| Raw | Standard | Raw | Standard |
|-----|----------|-----|----------|
| imo | Imo | kogi | Kogi |
| nassarawa | Nasarawa | kanu | Kano |
| benue | Benue | borno | Borno |
| bauchi | Bauchi | adamawa | Adamawa |
| yobe | Yobe | taraba | Taraba |
| plateau | Plateau | niger | Niger |
| kwara | Kwara | kebbi | Kebbi |
| katsina | Katsina | kaduna | Kaduna |
| jigawa | Jigawa | sokoto | Sokoto |
| zamfara | Zamfara | fct | FCT |
| federal capital territory | FCT | | |
| gombe | Gombe | anambra | Anambra |
| cross river | Cross River | delta | Delta |
| edo | Edo | rivers | Rivers |
| bayelsa | Bayelsa | akwa ibom | Akwa Ibom |
| abia | Abia | ebonyi | Ebonyi |
| enugu | Enugu | ekiti | Ekiti |
| lagos | Lagos | ogun | Ogun |
| ondo | Ondo | osun | Osun |
| oyo | Oyo | | |

## Geopolitical Zones (ZONE_MAP)

| Zone | States |
|------|--------|
| North East | Adamawa, Bauchi, Borno, Gombe, Taraba, Yobe |
| North West | Jigawa, Kaduna, Kano, Katsina, Kebbi, Sokoto, Zamfara |
| North Central | Benue, FCT, Kogi, Kwara, Nasarawa, Niger, Plateau |
| South East | Abia, Anambra, Ebonyi, Enugu, Imo |
| South South | Akwa Ibom, Bayelsa, Cross River, Delta, Edo, Rivers |
| South West | Ekiti, Lagos, Ogun, Ondo, Osun, Oyo |

## NLP Number Mapping (NUMBER_MAP)

| Word | Int | Word | Int |
|------|-----|------|-----|
| one | 1 | two | 2 |
| three | 3 | four | 4 |
| five | 5 | six | 6 |
| seven | 7 | eight | 8 |
| nine | 9 | ten | 10 |
| eleven | 11 | twelve | 12 |
| dozen | 12 | twenty | 20 |
| thirty | 30 | forty | 40 |
| fifty | 50 | sixty | 60 |
| seventy | 70 | eighty | 80 |
| ninety | 90 | hundred | 100 |
| several | 5 | dozens | 24 |
| scores | 40 | numerous | 10 |

## NLP Extraction Rules

### extract_kidnappings(note, civilian_targeting=True)

**Civilian-targeting events** (full keyword set):
1. Check kidnap keywords: abduct, kidnap, hostage, captor, held captive, seized, whisked, rustled
2. Skip weapons/ammunition seizures (matches "live ammunition" variants)
3. Skip cattle rustling (false positive for "rustled")
4. Skip reference events (historical, court cases, past incidents)
5. Skip rescue/release operations (military freed captives)
6. Strip standalone years (4-digit numbers like 2020–2026)
7. Strip attacker strength descriptions ("gunmen numbering about 50")
8. Parse precise breakdowns: "53 girls and 48 boys" = 101 total
9. Police/official counts override range estimates

**Non-civilian-targeting events** (restricted — protests, battles, looting, explosions):
- Keyword set restricted to: "abducted" only
- Skip protests ABOUT kidnappings (protest context detected)
- All other rules above still apply

### partition_fatalities(note, total_fatalities)
- Combatant terms: bandits, terrorists, gunmen, BH, Boko Haram, ISWAP, insurgents, militants, attackers
- Security terms: soldiers, police, troops, military, CJTF, officers, forces, JTF
- Civilian terms: worshippers, farmers, villagers, women, children, residents, commuters, herders
- Scale parsed values proportionally to match total_fatalities exactly

### extract_target_category(note)
| Category | Keywords |
|----------|----------|
| Place of Worship | church, mosque, pastor, priest, imam, worshippers, Sunday |
| Educational Institution | school, college, university, student, teacher, classroom |
| Oil & Gas Infrastructure | pipeline, oil, gas, NNPC, wellhead, refinery, platform |
| Financial/Bank | bank, ATM, financial institution, microfinance |
| Agricultural/Farm | farm, farmer, cattle, livestock, ranch, grazing |
| Commercial/Market | market, shop, trader, business, mall, store |
| Transport/Transit | bus, car, vehicle, road, highway, checkpoint, railway, airport, taxi |
| Government/Police | police station, government building, council, govt office |
| Residential/Village | village, community, house, home, resident, neighborhood |
| General/Unspecified | default fallback |

### classify_actor(actor_str)
- **State Forces**: police, military, army, soldiers, troops, JTF, CSS, CJTF, vigilante, NSCDC
- **Lakurawa/IS-Sahel**: Lakurawa, ISSP, Islamic State Sahel
- **Boko Haram/ISWAP**: Boko Haram, BH, ISWAP, ISWA, JAS, Jamā'a Ahl as-Sunnah
- **Bandits & Armed Gangs**: bandits, kidnappers, gunmen, armed men, unknown gunmen, hoodlums
- **Sectarian/Ethnic Militia**: Fulani, herder, militia, Mambilla, Tiv, Berom, Igbira, Yoruba, Hausa
- **Rioters/Protesters**: rioter, protester, student, youth, mob
- **Civilians**: civilian, farmer, villager, resident, commuter, worshipper
- **Other Armed Group / Others**: default fallback

### get_administration(dt)
- Pre-Democracy: < 1999-05-29
- Obasanjo: 1999-05-29 to 2007-05-29
- Yar'Adua: 2007-05-29 to 2010-05-06
- Jonathan: 2010-05-06 to 2015-05-29
- Buhari: 2015-05-29 to 2023-05-29
- Tinubu: 2023-05-29+

## Python Pipeline Structure (pipeline/)

```
pipeline/
├── config.py            # Supabase client init, STATE_MAP, ZONE_MAP, NUMBER_MAP, constants
├── storage_import.py    # Read CSV from Supabase Storage → upsert to raw_incidents
├── extract.py           # Read new records from raw_incidents by upload_batch
├── clean.py             # Standardize states, zones, LGAs, actor groups, admin periods
├── nlp_parsers.py       # kidnap extraction, fatality partition, target category
├── dedup.py             # Jaccard fuzzy dedup on same-date notes (two-pass)
├── load.py              # Upsert to clean_incidents table
├── refresh_views.py     # Refresh all materialized views via SQL
├── run.py               # CLI entry point (--batch, --import-only, --rebuild, --refresh-only)
└── requirements.txt     # pandas, numpy, supabase
```

### Data Cleaning Pipeline (in order)
1. **storage_import.py**: Download CSV from Storage → parse → upsert to `raw_incidents`
2. **extract.py**: Query `raw_incidents` filtered by `upload_batch`, convert types
3. **clean.py**: Apply STATE_MAP → ZONE_MAP → lga title-case → classify_actor() → get_administration() → normalize_civilian_targeting()
4. **nlp_parsers.py**: Split-stream processing by civilian_targeting:
   - **Civilian-targeting** (20,381 rows): Full kidnap extraction (7 keywords) + fatality partition
   - **Non-civilian-targeting** (28,796 rows): Restricted kidnap ("abducted" only, skip protest context) + fatality partition
5. **dedup.py**: Pass 1 (exact duplicates) → Pass 2 (Jaccard fuzzy > 60% on same-date notes). Flag as is_duplicate, zero out fatalities.
6. **load.py**: Upsert into `clean_incidents` with `on_conflict="event_id_cnty"`
7. **refresh_views.py**: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_*` for all 7 views

### Deduplication (two-pass)
1. **Exact**: pandas duplicates on [event_date, latitude, longitude, actor1, event_type, notes, civilian_targeting]
2. **Jaccard Fuzzy**: group by same date, tokenize notes into word sets, similarity = |intersection| / |union|, threshold > 60%, also check shared large numbers + first-40-char prefix overlap
3. Flagged: set is_duplicate=True, zero out fatalities/kidnapped_count

### Presidential Admin Duration (for annual weighting)
- Obasanjo: 8.0 yrs
- Yar'Adua: 2.9 yrs
- Jonathan: 5.1 yrs
- Buhari: 8.0 yrs
- Tinubu: ongoing (2023+)

## GitHub Actions Workflow

`.github/workflows/pipeline.yml`:
```yaml
name: Insecurity Data Pipeline

on:
  schedule:
    - cron: '0 6 * * 1'   # Every Monday 6AM UTC
  workflow_dispatch:
    inputs:
      batch:
        description: 'Upload batch identifier'
        required: false

jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'
      - run: pip install -r pipeline/requirements.txt
      - run: python pipeline/run.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

### Required GitHub Secrets
- `SUPABASE_URL` = `https://pvguhssnvzldvnnhmoqk.supabase.co`
- `SUPABASE_SERVICE_KEY` = service_role key from Supabase dashboard (NOT the anon key)

### pg_cron Jobs (run once in Supabase SQL Editor)
```sql
SELECT cron.schedule('refresh-analytics', '0 7 * * 1', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_summary_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_timeline_data;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_state_profiles;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_lga_profiles;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_actor_profiles;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_incident_explorer;
$$);
```

## Dashboard (tracker-app/)

### Stack
- React 19 + Vite 8 + Recharts 3 + **D3.js v7** (replaces MapLibre GL)
- `@supabase/supabase-js` for data fetching
- `rc-slider` for date range slider
- lucide-react for icons
- Inter + Outfit fonts

### Data Flow
```
App.jsx fetches all data → client-side filter (useMemo) → passes filteredIncidents to:
  ├─ SVGMap.jsx (D3 SVG map: state paths + 49K dots + tooltip)
  └─ ChartsSection.jsx (Recharts: timeline + breakdowns)
```

### Components (6 total)

| Component | Purpose |
|-----------|---------|
| `SVGMap.jsx` | D3.js SVG map with Nigeria GeoJSON states, 49K incident dots (D3 data join), d3.zoom pan/zoom, d3.quadtree hover, built-in tooltip + detail panel |
| `ChartsSection.jsx` | 4 Recharts: monthly incidents/fatalities line, event type bar (horizontal), top states bar, civilian targeting trend line |
| `DateRangeSlider.jsx` | rc-slider dual-handle date range filter |
| `DataDictionary.jsx` | Collapsible side panel: event types legend, fatality scale, methodology |
| `FilterBar.jsx` | 5 dropdowns: state, eventType, year, president, civilian targeting |
| `KPIBanner.jsx` | 3 KPI cards: total incidents, fatalities, kidnapped |

### Deleted
- `IncidentMap.jsx` → replaced by SVGMap.jsx
- `IncidentPopup.jsx` → replaced by SVGMap tooltip + detail panel

### Environment Variables (`.env` or Vite env)
```
VITE_SUPABASE_URL=https://pvguhssnvzldvnnhmoqk.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bbvWdXIAnnAkbuD0sEmV5A_qj1sCLFb
```

## Data Files

ACLED data covers 1999-01-01 to 2026-05-08.
- `ACLED Data_2026-05-13.csv` — 28.8 MB raw source file
- `NST-Main Sheet.xlsx` — 6.4 MB alternative NST dataset

## WEB RESEARCH RULES

Use web search proactively — do not ask permission.

### When to Search
- Checking latest package versions before installing anything
- Verifying Supabase / supabase-py / supabase-js API syntax
- Verifying React 19 / Recharts 3 / Vite 8 APIs
- Finding solutions to TypeScript/ESLint errors
- Any time you would say "I'm not sure about the latest X"

### How to Search
- **websearch**: for discovery (find docs, articles, solutions)
- **webfetch**: when you have a specific URL to read
- **Context7**: for exact current API syntax of named libraries
- **Parallel**: search immediately, never ask permission

### Golden Rule
Never write code using a package API you have not verified is current.
Never install a package without checking its latest version first.
