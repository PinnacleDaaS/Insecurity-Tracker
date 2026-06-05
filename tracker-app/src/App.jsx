import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase.js'
import DashboardLayout from './components/Layout/DashboardLayout.jsx'
import Header from './components/Layout/Header.jsx'
import Sidebar from './components/Layout/Sidebar.jsx'
import KpiCard from './components/Metrics/KpiCard.jsx'
import ActivityFeed from './components/Metrics/ActivityFeed.jsx'
import ConflictMap from './components/Map/ConflictMap.jsx'
import TrendChart from './components/Analytics/TrendChart.jsx'
import DataDictionary from './components/Layout/DataDictionary.jsx'
import SeasonalityHeatmap from './components/Charts/SeasonalityHeatmap.jsx'
import ZoneFatalityBreakdown from './components/Charts/ZoneFatalityBreakdown.jsx'

function matchesFilters(d, f) {
  if (f.state !== 'All' && d.state_clean !== f.state) return false
  if (f.eventType !== 'All' && d.event_type !== f.eventType) return false
  if (f.year !== 'All' && String(d.year) !== f.year) return false
  if (f.administration !== 'All' && d.presidential_admin !== f.administration) return false
  if (f.civilianTargeting === 'Civilian Targeting' && !d.civilian_targeting) return false
  if (f.civilianTargeting === 'Non-Civilian Targeting' && d.civilian_targeting) return false
  if (f.geopoliticalZone !== 'All' && d.geopolitical_zone !== f.geopoliticalZone) return false
  if (f.dateRange) {
    const ev = new Date(d.event_date)
    if (f.dateRange[0] && ev < new Date(f.dateRange[0])) return false
    if (f.dateRange[1] && ev > new Date(f.dateRange[1])) return false
  }
  return true
}

const PRESIDENT_DATES = {
  'Obasanjo': ['1999-05-29', '2007-05-29'],
  "Yar'Adua": ['2007-05-29', '2010-05-06'],
  'Jonathan': ['2010-05-06', '2015-05-29'],
  'Buhari': ['2015-05-29', '2023-05-29'],
  'Tinubu': ['2023-05-29', '2026-05-22'],
}

const ADMIN_ORDER = ['OBJ', 'YAR', 'GEJ', 'PMB', 'BAT']

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [activeTab, setActiveTab] = useState('map')
  const [filters, setFilters] = useState({ state: 'All', eventType: 'All', year: 'All', administration: 'All', civilianTargeting: 'All', geopoliticalZone: 'All', dateRange: null })
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [dictionaryOpen, setDictionaryOpen] = useState(false)
  const [dateBounds, setDateBounds] = useState({ min: '1999-01-01', max: '2026-05-08' })

  const filteredIncidents = useMemo(() => {
    return incidents.filter(d => matchesFilters(d, filters))
  }, [incidents, filters])

  const kpiMetrics = useMemo(() => ({
    totalFatalities: filteredIncidents.reduce((s, d) => s + (d.fatalities || 0), 0),
    totalKidnapped: filteredIncidents.reduce((s, d) => s + (d.kidnapped_count || 0), 0),
  }), [filteredIncidents])

  const adminBaselines = useMemo(() => {
    const groups = {}
    for (const inc of incidents) {
      const admin = inc.presidential_admin
      if (!admin) continue
      if (!groups[admin]) groups[admin] = { events: 0, fatalities: 0, kidnapped: 0 }
      groups[admin].events++
      groups[admin].fatalities += inc.fatalities || 0
      groups[admin].kidnapped += inc.kidnapped_count || 0
    }
    for (const admin of Object.keys(groups)) {
      groups[admin].fatalityPerEvent = groups[admin].events ? +(groups[admin].fatalities / groups[admin].events).toFixed(2) : 0
    }
    return groups
  }, [incidents])

  const prevAdminTotals = useMemo(() => {
    if (filters.administration === 'All') return null
    const idx = ADMIN_ORDER.indexOf(filters.administration)
    if (idx <= 0) return null
    return adminBaselines[ADMIN_ORDER[idx - 1]] || null
  }, [filters.administration, adminBaselines])

  const currentAdminLabel = filters.administration !== 'All' ? filters.administration : null

  const yearlyFatalityRates = useMemo(() => {
    const years = {}
    for (const inc of filteredIncidents) {
      const y = inc.year
      if (!y) continue
      if (!years[y]) years[y] = { events: 0, fatalities: 0 }
      years[y].events++
      years[y].fatalities += inc.fatalities || 0
    }
    return Object.entries(years)
      .sort(([a], [b]) => a - b)
      .map(([year, data]) => ({
        year,
        rate: data.events ? +(data.fatalities / data.events).toFixed(2) : 0,
      }))
  }, [filteredIncidents])

  const currentFatalityRate = useMemo(() => {
    const totalEvents = filteredIncidents.length
    return totalEvents ? +(kpiMetrics.totalFatalities / totalEvents).toFixed(2) : 0
  }, [filteredIncidents, kpiMetrics])

  const activeFilterCount = useMemo(() => {
    return [filters.state, filters.eventType, filters.year, filters.administration, filters.civilianTargeting, filters.geopoliticalZone]
      .filter(v => v && v !== 'All').length
  }, [filters])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    let active = true
    let initialSetupDone = false

    async function fetchData() {
      setError(null)
      try {
        const { count: cleanCount, error: countErr } = await supabase
          .from('clean_incidents')
          .select('*', { count: 'exact', head: true })
          .neq('is_duplicate', true)
        if (countErr) throw new Error(countErr.message)
        if (!active) return

        const PAGE = 1000
        const total = cleanCount || 49000
        const pages = Math.ceil(total / PAGE)
        let latestTs = null

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
        if (!active) return

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

        if (!initialSetupDone && allData.length) {
          initialSetupDone = true
          const dates = allData.map(d => d.event_date).filter(Boolean).sort()
          if (dates.length) {
            setDateBounds({ min: dates[0], max: dates[dates.length - 1] })
            setFilters(prev => {
              if (!prev.dateRange) {
                return { ...prev, dateRange: [dates[0], dates[dates.length - 1]] }
              }
              return prev
            })
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError(err.message)
      }
    }

    setLoading(true)
    fetchData().finally(() => {
      if (active) setLoading(false)
    })

    const interval = setInterval(fetchData, 300000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const handleFilterChange = useCallback((key, value) => {
    if (key === 'administration' && value !== 'All') {
      const dr = PRESIDENT_DATES[value] || null
      setFilters(prev => ({
        ...prev,
        administration: value,
        dateRange: dr ? [dr[0], dr[1]] : [dateBounds.min, dateBounds.max],
      }))
      setSelectedIncident(null)
    } else {
      setFilters(prev => ({ ...prev, [key]: value }))
      setSelectedIncident(null)
    }
  }, [dateBounds])

  const handleResetFilters = useCallback(() => {
    setFilters({ state: 'All', eventType: 'All', year: 'All', administration: 'All', civilianTargeting: 'All', geopoliticalZone: 'All', dateRange: [dateBounds.min, dateBounds.max] })
    setSelectedIncident(null)
  }, [dateBounds])

  const handleDateRangeChange = useCallback((range) => {
    setFilters(prev => ({
      ...prev,
      dateRange: range,
      administration: 'All',
    }))
  }, [])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const handleExportCSV = useCallback((data) => {
    const headers = ['event_date', 'event_type', 'sub_event_type', 'location', 'state_clean', 'lga_clean', 'actor1', 'actor2', 'fatalities', 'kidnapped_count', 'civilian_targeting', 'geopolitical_zone', 'presidential_admin', 'notes']
    const rows = data.map(d => headers.map(h => {
      const v = d[h]
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nigeria-conflict-data-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const fmtLastUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  if (loading || error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-foreground font-sans antialiased">
        {error ? (
          <div className="text-center max-w-md px-6">
            <div className="mb-4 mx-auto h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-red-400 text-xl font-bold">!</span>
            </div>
            <p className="text-lg font-bold text-red-500 dark:text-red-400">Failed to load dashboard data</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg border border-cyan-500/30 px-5 py-2.5 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-cyan-500 dark:border-t-cyan-400" />
            <p className="text-sm text-muted-foreground">Loading Nigeria Conflict Data...</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <DashboardLayout
      lastUpdated={lastUpdated}
      activeFilterCount={activeFilterCount}
      header={
        <Header
          dateRange={filters.dateRange || [dateBounds.min, dateBounds.max]}
          onDateRangeChange={handleDateRangeChange}
          minDate={dateBounds.min}
          maxDate={dateBounds.max}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenDictionary={() => setDictionaryOpen(true)}
        />
      }
      sidebar={
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      }
      kpiCards={
        <>
          <KpiCard
            label="Total Incidents"
            value={filteredIncidents.length}
            color="amber"
            icon="Activity"
            delta={prevAdminTotals ? ((filteredIncidents.length - prevAdminTotals.events) / prevAdminTotals.events * 100) : null}
            prevAdminLabel={currentAdminLabel}
          />
          <KpiCard
            label="Total Fatalities"
            value={kpiMetrics.totalFatalities}
            color="rose"
            icon="Skull"
            delta={prevAdminTotals ? ((kpiMetrics.totalFatalities - prevAdminTotals.fatalities) / prevAdminTotals.fatalities * 100) : null}
            prevAdminLabel={currentAdminLabel}
          />
          <KpiCard
            label="Total Kidnapped"
            value={kpiMetrics.totalKidnapped}
            color="violet"
            icon="Users"
            delta={prevAdminTotals ? ((kpiMetrics.totalKidnapped - prevAdminTotals.kidnapped) / prevAdminTotals.kidnapped * 100) : null}
            prevAdminLabel={currentAdminLabel}
          />
          <KpiCard
            label="Fatality rate / incident"
            value={currentFatalityRate}
            color="cyan"
            icon="Activity"
            sparklineData={yearlyFatalityRates}
            delta={prevAdminTotals ? currentFatalityRate - prevAdminTotals.fatalityPerEvent : null}
            prevAdminLabel={currentAdminLabel}
            deltaIsAbsolute
          />
        </>
      }
      activityPanel={<ActivityFeed incidents={filteredIncidents} onSelect={setSelectedIncident} filters={filters} />}
      dictionaryPanel={<DataDictionary open={dictionaryOpen} onClose={() => setDictionaryOpen(false)} />}
    >
      {activeTab === 'map' ? (
        <ConflictMap
          allIncidents={incidents}
          filters={filters}
          theme={theme}
          onSelectIncident={setSelectedIncident}
        />
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <TrendChart incidents={filteredIncidents} selectedYear={filters.year} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
              <SeasonalityHeatmap incidents={filteredIncidents} />
              <ZoneFatalityBreakdown incidents={filteredIncidents} />
            </div>
          </div>

        </div>
      )}
    </DashboardLayout>
  )
}
