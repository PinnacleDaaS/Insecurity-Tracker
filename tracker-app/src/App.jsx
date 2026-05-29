import { useState, useEffect, useCallback, useMemo } from 'react'
import { Sun, Moon, MapPin, BookOpen, BarChart3, MapIcon, Clock } from 'lucide-react'
import { supabase } from './supabase.js'
import KPIBanner from './components/KPIBanner.jsx'
import FilterBar from './components/FilterBar.jsx'
import LeafletMap from './components/LeafletMap.jsx'
import CalendarPicker from './components/CalendarPicker.jsx'
import DataDictionary from './components/DataDictionary.jsx'
import ChartsSection from './components/ChartsSection.jsx'
import './App.css'

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

const LATEST_KNOWN_CUTOFF = '2026-05-08'

const PRESIDENT_DATES = {
  'Obasanjo': ['1999-05-29', '2007-05-29'],
  "Yar'Adua": ['2007-05-29', '2010-05-06'],
  'Jonathan': ['2010-05-06', '2015-05-29'],
  'Buhari': ['2015-05-29', '2023-05-29'],
  'Tinubu': ['2023-05-29', '2026-05-22'],
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [activeTab, setActiveTab] = useState('map')
  const [showDictionary, setShowDictionary] = useState(false)
  const [filters, setFilters] = useState({ state: 'All', eventType: 'All', year: 'All', administration: 'All', civilianTargeting: 'All', geopoliticalZone: 'All', dateRange: null })
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [dateBounds, setDateBounds] = useState({ min: '1999-01-01', max: '2026-05-08' })

  const filteredIncidents = useMemo(() => {
    return incidents.filter(d => !d.is_duplicate && matchesFilters(d, filters))
  }, [incidents, filters])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const PAGE = 1000
        const [{ count, error: countErr }] = await Promise.all([
          supabase.from('clean_incidents').select('*', { count: 'exact', head: true }),
        ])
        if (countErr) throw new Error(countErr.message)

        const total = count || 49000
        const pages = Math.ceil(total / PAGE)

        const allData = []
        let latestTs = null
        for (let i = 0; i < pages; i++) {
          const from = i * PAGE
          const to = Math.min(from + PAGE - 1, total - 1)
          const { data, error } = await supabase
            .from('clean_incidents')
            .select('*')
            .order('event_date', { ascending: false })
            .range(from, to)
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

  const fmtLastUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  if (loading || error) {
    return (
      <div className="app">
        <div className="loading-container">
          {error ? (
            <div className="error-message">
              <p>Failed to load dashboard data</p>
              <span>{error}</span>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : (
            <div className="loading-spinner" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <MapPin size={20} className="header-icon" />
          <h1>Insecurity Tracker</h1>
          <span className="header-badge">Nigeria</span>
        </div>
        <div className="header-right">
          <button
            className={`header-btn ${showDictionary ? 'active' : ''}`}
            onClick={() => setShowDictionary(true)}
            title="Data dictionary"
          >
            <BookOpen size={16} />
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <KPIBanner incidents={filteredIncidents} />

      <div className="calendar-wrapper">
        <CalendarPicker
          minDate={dateBounds.min}
          maxDate={dateBounds.max}
          value={filters.dateRange || [dateBounds.min, dateBounds.max]}
          onChange={handleDateRangeChange}
        />
      </div>

      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <MapIcon size={14} /> Map View
        </button>
        <button
          className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <BarChart3 size={14} /> Charts & Summary
        </button>
      </div>

      {activeTab === 'map' ? (
        <div className="map-wrapper">
          <LeafletMap
            incidents={filteredIncidents}
            theme={theme}
            onSelectIncident={setSelectedIncident}
          />
        </div>
      ) : (
        <div className="charts-wrapper">
          <ChartsSection incidents={filteredIncidents} />
        </div>
      )}

      <footer className="app-footer">
        <span><Clock size={12} /> Data updated: {fmtLastUpdated || 'Unknown'}</span>
        <span>Coverage: 1999 – {LATEST_KNOWN_CUTOFF}</span>
        <span>Source: <a href="https://acleddata.com" target="_blank" rel="noopener">ACLED</a></span>
      </footer>

      <DataDictionary isOpen={showDictionary} onClose={() => setShowDictionary(false)} />
    </div>
  )
}
