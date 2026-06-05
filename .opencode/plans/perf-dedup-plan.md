# Performance + Dedup Visibility Plan

## 1. App.jsx — Parallel fetches + server-side dedup filter

### Add state (after line 43):
```js
const [suppressedCount, setSuppressedCount] = useState(0)
```

### Replace the fetchData function (lines 63-117) with:
```js
useEffect(() => {
  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const PAGE = 1000

      // Count both total and non-duplicate rows
      const countAll = supabase.from('clean_incidents').select('*', { count: 'exact', head: true })
      const countClean = supabase.from('clean_incidents').select('*', { count: 'exact', head: true }).neq('is_duplicate', true)
      const [{ count: allCount }, { count: cleanCount, error: countErr }] = await Promise.all([countAll, countClean])
      if (countErr) throw new Error(countErr.message)
      setSuppressedCount((allCount || 0) - (cleanCount || 0))

      const total = cleanCount || 49000
      const pages = Math.ceil(total / PAGE)
      let latestTs = null

      // Parallel page fetches
      const promises = []
      for (let i = 0; i < pages; i++) {
        const from = i * PAGE
        const to = Math.min(from + PAGE - 1, total - 1)
        promises.push(
          supabase
            .from('clean_incidents')
            .select('*')
            .neq('is_duplicate', true)
            .order('event_date', { ascending: false })
            .range(from, to)
        )
      }

      const results = await Promise.all(promises)
      const allData = []
      for (const { data, error } of results) {
        if (error) throw new Error(error.message)
        if (data) {
          allData.push(...data)
          for (const row of data) {
            if (row.updated_at && (!latestTs || row.updated_at > latestTs)) {
              latestTs = row.updated_at
            }
          }
        }
      }

      setIncidents(allData)
      if (latestTs) setLastUpdated(latestTs)

      if (allData.length) {
        const dates = allData.map(d => d.event_date).filter(Boolean).sort()
        if (dates.length) {
          setDateBounds({ min: dates[0], max: dates[dates.length - 1] })
          if (!filters.dateRange) {
            setFilters(prev => ({ ...prev, dateRange: [dates[0], dates[dates.length - 1]] }))
          }
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  fetchData()
}, [])
```

### Pass suppressedCount to ConflictMap (line 216):
```jsx
<ConflictMap
  incidents={filteredIncidents}
  theme={theme}
  onSelectIncident={setSelectedIncident}
  suppressedCount={suppressedCount}
/>
```

## 2. ConflictMap.jsx — Cache GeoJSON + smarter theme + dedup count

### Add module-level cache at top (after imports):
```js
let geoJsonCache = null
```

### Replace the GeoJSON fetch (inside the second useEffect, lines 131-164):
Replace the entire fetch block with:
```js
const loadGeoJSON = async () => {
  if (!geoJsonCache) {
    const resp = await fetch('/data/nigeria-states.geojson')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    geoJsonCache = await resp.json()
  }
  const gj = geoJsonCache
  // ... rest of the GeoJSON layer code (same as current lines 134-162)
}
loadGeoJSON().catch(err => console.error('GeoJSON load failed:', err))
```

### Replace the map init effect (lines 66-118) to not depend on isDark:
Change the dependency array from `[isDark]` to `[]` (empty — only runs once on mount).

### Add a new effect for theme-based tile swapping:
```js
useEffect(() => {
  if (!mapRef.current) return
  const map = mapRef.current
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

  // Remove existing tile layers
  map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) {
      map.removeLayer(layer)
    }
  })
  L.tileLayer(tileUrl, { maxZoom: 18 }).addTo(map)
}, [isDark])
```

### Update GeoJSON style effect to depend on isDark (lines 120-167):
In the GeoJSON effect that currently depends on `[isDark]`, the style objects already reference `isDark`, so the dependency array `[isDark]` is fine. No changes needed there.

### Add dedup count to the map header bar (line 252):
```jsx
<div className="absolute top-2 left-2 z-[1000] flex items-center gap-2">
  <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 shadow-sm">
    {incidents.length.toLocaleString()} incidents
    {suppressedCount > 0 && (
      <span className="ml-1.5 text-[10px] text-slate-500 dark:text-slate-500">
        ({suppressedCount.toLocaleString()} dup. suppressed)
      </span>
    )}
  </div>
</div>
```

### Add suppressedCount prop (line 49):
```js
export default function ConflictMap({ incidents, theme, onSelectIncident, suppressedCount = 0 }) {
```

## 3. TrendChart.jsx — Single-pass aggregation

### Replace all 4 useMemo blocks (lines 34-84) with a single one:

```js
const { eventTypeData, topStatesData, monthlyData, kidnapData } = useMemo(() => {
  const eventTypeCounts = {}
  const stateMap = {}
  const months = {}
  let totalKidnapped = 0
  let civilianIncidents = 0
  let kidnapIncidents = 0

  incidents.forEach(d => {
    const et = d.event_type || 'Unknown'
    eventTypeCounts[et] = (eventTypeCounts[et] || 0) + 1

    const s = d.state_clean || 'Unknown'
    if (!stateMap[s]) stateMap[s] = { incidents: 0, fatalities: 0, kidnapped: 0 }
    stateMap[s].incidents++
    stateMap[s].fatalities += d.fatalities || 0
    stateMap[s].kidnapped += d.kidnapped_count || 0

    const m = (d.event_date || '').slice(0, 7)
    if (m) {
      if (!months[m]) months[m] = { month: m, incidents: 0, fatalities: 0, kidnapped: 0, civilianTargeting: 0 }
      months[m].incidents++
      months[m].fatalities += d.fatalities || 0
      months[m].kidnapped += d.kidnapped_count || 0
      if (d.civilian_targeting) months[m].civilianTargeting++
    }

    totalKidnapped += d.kidnapped_count || 0
    if (d.civilian_targeting) civilianIncidents++
    if (d.is_kidnap) kidnapIncidents++
  })

  const total = incidents.length
  const eventTypeData = Object.entries(eventTypeCounts)
    .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }))
    .sort((a, b) => b.value - a.value)

  const topStatesData = Object.entries(stateMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.fatalities - a.fatalities)
    .slice(0, 10)

  const monthlyData = Object.values(months)
    .sort((a, b) => a.month.localeCompare(b.month))

  const kidnapData = [
    { name: 'Civilian Targeting', value: civilianIncidents, pct: total ? ((civilianIncidents / total) * 100).toFixed(1) : '0' },
    { name: 'Kidnapped (victims)', value: totalKidnapped, pct: '' },
    { name: 'Kidnap Incidents', value: kidnapIncidents, pct: '' },
  ]

  return { eventTypeData, topStatesData, monthlyData, kidnapData }
}, [incidents])
```
