# Nigeria Insecurity Tracker: Phase 2 Dashboard Implementation Prompt

You are tasked with building a premium, visually stunning, and highly interactive **React + Vite Dashboard** that serves as the frontend for the **Nigeria Insecurity Tracker** (modeled after the *HumAngle Insecurity Tracker*). 

This frontend will read directly from the static, highly cleaned, and structured JSON data payloads produced in Phase 1 (located at `tracker-app/src/data/`). The dashboard must present a command-center feel, featuring custom dark themes, rich micro-animations, and multi-dimensional analysis.

Below is the complete blueprint of what we have achieved in Phase 1 (the data pipeline) and the exact specifications of what needs to be built next.

---

## 🏛️ Part 1: Phase 1 Accomplishments (What We Have Built)

We have successfully engineered and executed a production-grade, highly performant, and fully automated **Modular Python Data Pipeline** (located at `pipeline/`) that processes **49,177 raw ACLED conflict rows** (covering 1999 to May 2026) and outputs a validated database alongside optimized JSON payloads.

### 🛡️ Core Pipeline Capabilities
1. **Advanced Fuzzy Jaccard Deduplication**: Combines cross-row text set Jaccard overlaps (>60% similarity) and checks for shared large unique numbers on matching dates to identify **9,295 duplicates**. The engine sets active fatalities/abductions of duplicates to `0` and flags them as `is_duplicate = True` in `acled_clean.csv`, ensuring we count unique events without double-counting casualties.
2. **Context-Aware NLP Note Parsers**:
   - *Date/Year Stripper*: Strips calendar years and standalone dates (e.g. `2024`, `2026`) before parsing so they are not mistaken for kidnap counts.
   - *Attacker Strength Filter*: Isolates perpetrator counts (e.g., `pirates numbering over 700`) to avoid matching them as abductees.
   - *Rescue Context Solver*: Distinguishes military rescue/release/escape operations and zeroes out active kidnappings when no new abductions occurred.
   - *Math and Credibility Resolver*: Sums exact gender/demographic breakdowns (e.g., `53 girls and 48 boys = 101`) and prioritizes verified official police reports over speculative media ranges.
3. **Nigeria Geopolitical Mapping**: Spelling-corrects and standardizes 36 states and the FCT, mapping them to the 6 Geopolitical Zones:
   - **North West**, **North East**, **North Central**, **South West**, **South East**, **South South**.
4. **Casualty Partitioning**: Mathematically attributes direct fatalities into three mutually exclusive categories:
   - **Security Forces Killed** (Soldiers, Police, CJTF, Troops)
   - **Combatants/Terrorists Killed** (Bandits, Gunmen, Boko Haram, ISWAP)
   - **Civilians/Innocents Killed** (Worshippers, Farmers, Villagers, Residents)
5. **Tactical Target Classification**: Categorizes incidents targeting vital civilian and economic infrastructure, extracting:
   - **Educational Institutions** (Schools, Universities)
   - **Places of Worship** (Churches, Mosques)
   - **Agricultural Fields** (Farms, Cattle grazing)
   - **Oil & Gas Pipeline Infrastructure**
   - **Financial Banks / ATMs**
   - **Commercial Markets / Plazas**

### 📊 Cleaned Baseline Metrics (1999–2026 Source of Truth)
- **Total Unique Active Incidents**: `39,882` (excluding the `9,295` narrative duplicates)
- **Total Conflict Fatalities**: `118,848` (perfectly partitioned mathematically)
  - 🧑‍🌾 *Civilians / Innocents Killed*: `83,641`
  - 🥷 *Combatants / Terrorists Killed*: `25,380`
  - 🛡️ *Security Forces Killed*: `9,827`
- **Total Victims Kidnapped**: `37,437` inside `7,776` distinct kidnap events.
- **Infrastructure Target Counts (Active events)**:
  - *Schools/Universities*: `2,289` | *Churches*: `2,212` | *Mosques*: `400` | *Farms*: `2,147` | *Oil Pipelines*: `435` | *Banks/ATMs*: `460` | *Markets*: `1,808`

---

## 🎯 Part 2: Phase 2 Dashboard Requirements (What You Need to Build)

You must build a high-fidelity React Single-Page Application (SPA) using **Vite**, **Recharts**, and **Lucide React** (packages are already configured inside `tracker-app/package.json`).

### 🎨 Design System & Aesthetics (Strict Constraints)
- **Theme**: Curated dark-military command center console. Absolutely no generic bright white backgrounds or simple grey boxes.
- **Harmonious Palette**:
  - **Background**: Deep Slate / Dark Navy (`#090D16` to `#0F172A`)
  - **Panels**: Semi-transparent Glassmorphism cards with fine borders (`border: 1px solid rgba(255,255,255,0.06)`, `backdrop-filter: blur(12px)`)
  - **Incident Color Codes**:
    - *Violence Against Civilians / Crimson*: `#EF4444` (Fatalities)
    - *Battles / Amber*: `#F59E0B` (Armed clashes)
    - *Protests / Blue*: `#3B82F6` (Public unrest)
    - *Riots / Purple*: `#8B5CF6` (Civil disorder)
    - *Strategic Developments / Emerald*: `#10B981` (Arrests/Rescues)
    - *Explosions & Remote Violence / Pink*: `#EC4899` (Bombings/Air strikes)
- **Typography**: Modern typography (e.g. `Inter`, `Outfit`, or `Rajdhani`) instead of system defaults, with highly clear visual hierarchies.
- **Interactivity**: Micro-animations on card hovers, smooth pulse animations on maps, and sleek page transition fades.

---

## 💻 Part 3: Dashboard Sections & Components Blueprint

The dashboard should feature a **unified layout** with a persistent command sidebar for navigation and global filtering (State, Zone, Era, Date Range). The main screen will render one of the following four primary tabs:

```
[PERSISTENT FILTER SIDEBAR: State | Geopolitical Zone | President Era | Date Range Picker]
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TAB NAVBAR:  [1. Command Center]  [2. Timeline Trends]  [3. Actor Networks]  [4. Explorer]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  TAB 1: COMMAND CENTER (Hotspots & Targets)                                            │
│  ┌──────────────────────────────────────────────┐ ┌──────────────────────────────────┐  │
│  │                                              │ │  SELECTED STATE/ZONE PROFILE     │  │
│  │   TACTICAL SPATIAL SCATTER MAP               │ │  - Danger Rating & Top Actor     │  │
│  │   - Bounding-box coordinates mapped as nodes │ │  - Target Category Breakdown     │  │
│  │   - Glowing size = Incident frequency        │ │  - Top 10 High-Risk LGAs         │  │
│  │   - Clickable states to slice dashboard      │ │                                  │  │
│  │                                              │ │  🕌⛪🏫 INFRASTRUCTURE RATIO      │  │
│  └──────────────────────────────────────────────┘ └──────────────────────────────────┘  │
│                                                                                        │
│  TAB 2: TIMELINE TRENDS (Democracy & Eras)                                             │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  - Interactive Monthly Insecurity Index Chart (AreaChart: Incidents vs Fatalities)│  │
│  │  - Presidential Eras Comparison Cards (Obasanjo, Yar'Adua, Jonathan, Buhari, Tinubu)│  │
│  │  - Yearly Event Typologies Stacked Bar Charts                                    │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  TAB 3: ACTOR NETWORKS (Lethality & Profiles)                                          │
│  ┌──────────────────────────────────────────────┐ ┌──────────────────────────────────┐  │
│  │  ACTOR TYPOLOGY PIE SHARE                    │ │  LETHALITY RATING SCALE          │  │
│  │  (State Forces vs BH/ISWAP vs Bandits)        │ │  - Avg deaths per group clash    │  │
│  └──────────────────────────────────────────────┘ └──────────────────────────────────┘  │
│                                                                                        │
│  TAB 4: INCIDENT EXPLORER (Full Database Search)                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  - Full text search input (regex-capable, instant client-side query)             │  │
│  │  - Clean interactive data grid (Date | LGA | State | Category | Casualties | Note)  │  │
│  │  - Collapsible narrative drawer showing raw ACLED notes context                  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1️⃣ Persistent KPI Header (Always Visible)
Directly updates based on selected state, zone, or presidential era filters:
- **Total Logged Incidents** (with an active icon e.g. `ShieldAlert`)
- **Reported Fatalities** (with a `Skull` icon, styled in glow-crimson)
- **Lethality Index** (average deaths per event `fatalities / incidents`)
- **Total Abducted Victims** (showing context-aware parsed kidnappings)

### 2️⃣ Tab 1: Command Center (Spatial Hotspots & Tactical Targets)
- **Tactical Spatial Scatter Map**: Create a lightweight, high-performance mock geospatial canvas using SVG or CSS absolute coordinate layouts. Coordinate centimers from `state_profile_data.json` are bounded to Nigeria's physical latitudes/longitudes:
  - *Lat Bound*: `4.0` (South) to `14.0` (North)
  - *Lng Bound*: `2.5` (West) to `15.0` (East)
  - Nodes must glow and pulse, sized relative to incident frequency and color-coded by their dominant conflict type. Clicking a state node dynamically filters the entire page view.
- **Target Category breakdown**: Visualizes attacks against Schools, Churches, Mosques, Farms, and Oil pipelines. Use highly customized icon rows with active percentage gauges (e.g. `9.2% of Borno incidents targeted Schools`).
- **High-Risk LGAs**: Ranks the top 10 most lethal local government areas for the selected scope.

### 3️⃣ Tab 2: Timeline Trends & Leadership Eras
- **Democracy Administrations Comparison Grid**: Displays customized metric cards comparing major Nigerian presidential periods:
  - *Olusegun Obasanjo* (1999-2007)
  - *Umaru Musa Yar'Adua* (2007-2010)
  - *Goodluck Jonathan* (2010-2015)
  - *Muhammadu Buhari* (2015-2023)
  - *Bola Ahmed Tinubu* (2023-2026)
  - Card elements must show: total incidents, total fatalities, and **Annual Average Casualties** (`total fatalities / duration in years`) to provide an objective relative risk factor.
- **Interactive Recharts AreaChart**: Plots the long-term trend of monthly incidents vs. monthly fatalities with customized gradient fills.
- **Yearly Typology Stacking**: Shows how violence transitioned from riots/protests to armed battles and bandit abductions over the last 27 years.

### 4️⃣ Tab 3: Actor Networks & Lethality Profiles
- **Typology Shares**: A dynamic donut chart visualizing the incident shares of State Forces vs Boko Haram/ISWAP vs Bandits & Armed Gangs vs Sectoral/Ethnic Militias.
- **Lethality Rating Scale**: Ranks the deadliness of each group.
- **Actor Target Profiles**: Interactive sub-cards illustrating the preferred target structures of each actor (e.g., Bandits targeting agricultural farms and schools vs. Boko Haram targeting military posts and places of worship).

### 5️⃣ Tab 4: Tactical Incident Explorer
- **High-Speed Search**: Instant client-side search indexing the top 500 significant incidents stored in `incident_explorer_index.json`. Filters entries by keyword, LGA, state, zone, or specific actor.
- **Interactive Table Grid**: Columns show Date, Location (LGA, State), Conflict Type (badge), Primary Actor, and Fatalities.
- **Collapsible Notes Drawer**: Clicking a row smoothly slides down a detailed drawer showing secondary actors, duplicate flags, target infrastructure, and the full raw ACLED descriptive narrative note.

---

## 💾 Part 4: Static Data Payloads Reference (Use As Input)

The data pipeline has pre-compiled and exported the following highly compact JSON assets inside `tracker-app/src/data/`. Do not run expensive array filters on raw CSVs in React. Simply import and map these pre-aggregated structures:

### 1. `summary_stats.json`
```json
{
    "total_incidents": 39882,
    "total_fatalities": 118848,
    "total_combatants_killed": 25380,
    "total_security_killed": 9827,
    "total_civilians_killed": 83641,
    "total_kidnapped": 37437,
    "total_kidnap_incidents": 7776,
    "min_date": "1999-01-01",
    "max_date": "2026-05-13",
    "event_types": { ... },
    "target_categories": { ... },
    "lethality_index": 2.97
}
```

### 2. `state_profile_data.json`
Contains centroid coordinates for tactical map plotting, along with overall aggregates:
```json
[
    {
        "state": "Borno",
        "lat": 11.8311,
        "lng": 13.151,
        "incidents": 7241,
        "fatalities": 41203,
        "combatants_killed": 12890,
        "security_killed": 3410,
        "civilians_killed": 24903,
        "kidnapped": 12450,
        "top_event": "Battles",
        "top_actor": "Boko Haram / ISWAP",
        "recent_fatalities": 1052,
        "target_categories": {
            "Places of Worship (Churches)": 412,
            "Educational Institutions (Schools/Universities)": 395
        }
    },
    ...
]
```

### 3. `timeline_data.json`
Contains pre-aggregated arrays for Recharts trend plotting:
- `monthly`: An array of objects `{"year_month": "2024-03", "incidents": 210, "fatalities": 512, "kidnapped": 89}`
- `yearly_event_types`: Array of event type shares grouped by calendar years.
- `administrations`: Array of presidential records with pre-computed annual fatality weights.

### 4. `actor_profile_data.json`
Contains summary metrics and target breakdowns for combatant categories:
- `summary`: `[{"actor1_group": "Bandits & Armed Gangs", "incidents": 8412, "fatalities": 19412, "avg_lethality": 2.31}]`
- `yearly_trends`: Annual timeline trends for lines/areas.
- `actor_targets`: Dictionary mapping actor groups to their target infra aggregates.

### 5. `incident_explorer_index.json`
Array of the top 500 significant insecurity events in Nigeria:
```json
[
    {
        "event_date": "2024-03-07",
        "state_clean": "Kaduna",
        "lga_clean": "Chikun",
        "geopolitical_zone": "North West",
        "event_type": "Violence against civilians",
        "actor1": "Bandits & Armed Gangs",
        "actor2": "Civilians",
        "fatalities": 0,
        "fatalities_civilians": 0,
        "kidnapped_count": 287,
        "is_kidnap": true,
        "is_reference": false,
        "target_category": "Educational Institutions (Schools/Universities)",
        "notes": "On 7 March 2024, bandits abducted 287 students and teachers from a primary school in Kuriga...",
        "id": 0
    },
    ...
]
```

---

## 🛠️ Part 5: Implementation Roadmap for Frontend Developers

1. **Setup Dashboard Canvas**: Standardize theme tokens and glassy styles inside `tracker-app/src/index.css`.
2. **State Management**:
   - Establish reactive state variables at the root `App.jsx` level: `activeTab` ('dashboard' | 'timeline' | 'actors' | 'explorer'), `selectedState` (null for entire country), `selectedZone` (null), `selectedEra` (null), and `searchQuery` (string).
3. **Map and Coordinates**:
   - Build the custom absolute coordinate system to represent the spatial hotspots scatter plot in CSS/SVG. Ensure nodes have high-fidelity hover tooltips and interactive click handlers that trigger `setSelectedState`.
4. **Responsive Charts**:
   - Bind imported JSON data feeds to Recharts `AreaChart`, `BarChart`, and `LineChart`. Add custom styled HTML tooltips matching the dashboard theme (semi-transparent dark background, rounded borders, crisp colored indicators).
5. **Explorer Search Indexing**:
   - Hook up `searchQuery` to filter `incident_explorer_index.json` instantly. Include pagination or lazy scrolling to ensure super-smooth performance when displaying high-narrative text drawers.
6. **Verify Build**:
   - Validate performance in development using `npm run dev`. Run production bundling using `npm run build` to confirm zero static compilation or module import errors.
