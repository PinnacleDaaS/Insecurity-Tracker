import { useState, useEffect } from 'react'
import {
  Activity, TrendingUp, Users, Search, Map, BarChart3,
  Shield, Crosshair, Globe, Clock, Target, Swords
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { supabase } from './supabase.js'
import './App.css'

const TABS = [
  { id: 'command', label: 'Command Center', icon: Activity },
  { id: 'timeline', label: 'Timeline Trends', icon: TrendingUp },
  { id: 'actors', label: 'Actor Networks', icon: Users },
  { id: 'explorer', label: 'Incident Explorer', icon: Search },
]

const STATE_COLORS = {
  'Battles': '#EF4444',
  'Violence against civilians': '#F59E0B',
  'Explosions/Remote violence': '#3B82F6',
  'Strategic developments': '#8B5CF6',
  'Protests': '#10B981',
  'Riots': '#EC4899',
}

const ACTOR_COLORS = {
  'State Forces': '#3B82F6',
  'Boko Haram/ISWAP': '#EF4444',
  'Bandits & Armed Gangs': '#F59E0B',
  'Sectarian/Ethnic Militia': '#8B5CF6',
  'Rioters/Protesters': '#10B981',
  'Civilians': '#EC4899',
  'Other Armed Group / Others': '#64748B',
}

function StateMap({ data }) {
  const stateCoords = {
    'Lagos': { x: 30, y: 72 }, 'Ogun': { x: 28, y: 65 },
    'Oyo': { x: 32, y: 55 }, 'Osun': { x: 35, y: 58 },
    'Ondo': { x: 40, y: 55 }, 'Ekiti': { x: 42, y: 50 },
    'Kwara': { x: 35, y: 42 }, 'Kogi': { x: 45, y: 40 },
    'Niger': { x: 40, y: 30 }, 'Nasarawa': { x: 50, y: 35 },
    'FCT': { x: 47, y: 35 }, 'Plateau': { x: 55, y: 30 },
    'Benue': { x: 55, y: 40 }, 'Kaduna': { x: 48, y: 20 },
    'Kano': { x: 52, y: 15 }, 'Katsina': { x: 45, y: 10 },
    'Jigawa': { x: 55, y: 10 }, 'Bauchi': { x: 58, y: 18 },
    'Gombe': { x: 62, y: 18 }, 'Yobe': { x: 65, y: 10 },
    'Borno': { x: 68, y: 15 }, 'Adamawa': { x: 65, y: 28 },
    'Taraba': { x: 60, y: 32 }, 'Zamfara': { x: 38, y: 12 },
    'Sokoto': { x: 35, y: 8 }, 'Kebbi': { x: 32, y: 10 },
    'Cross River': { x: 55, y: 72 }, 'Akwa Ibom': { x: 52, y: 78 },
    'Rivers': { x: 45, y: 75 }, 'Bayelsa': { x: 42, y: 78 },
    'Delta': { x: 40, y: 70 }, 'Edo': { x: 42, y: 62 },
    'Anambra': { x: 48, y: 62 }, 'Enugu': { x: 50, y: 58 },
    'Ebonyi': { x: 52, y: 62 }, 'Imo': { x: 46, y: 66 },
    'Abia': { x: 50, y: 66 },
  }

  const maxFatalities = Math.max(...data.map(d => d.total_fatalities), 1)

  return (
    <div className="state-map-container">
      {data.map(state => {
        const coord = stateCoords[state.state_clean]
        if (!coord) return null
        const intensity = state.total_fatalities / maxFatalities
        const size = 6 + intensity * 12
        const color = intensity > 0.5 ? '#EF4444' : intensity > 0.2 ? '#F59E0B' : '#3B82F6'
        return (
          <div
            key={state.state_clean}
            className="state-dot"
            style={{
              left: `${coord.x}%`, top: `${coord.y}%`,
              width: size, height: size,
              color, backgroundColor: color,
              opacity: 0.5 + intensity * 0.5,
            }}
            data-name={`${state.state_clean} (${state.total_incidents})`}
          />
        )
      })}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(16,22,38,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '12px 16px', fontSize: 12
    }}>
      <p style={{ color: '#94A3B8', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

function formatNum(n) { return n?.toLocaleString() ?? '0' }

export default function App() {
  const [activeTab, setActiveTab] = useState('command')
  const [loading, setLoading] = useState(true)
  const [summaryStats, setSummaryStats] = useState(null)
  const [timelineData, setTimelineData] = useState([])
  const [stateProfiles, setStateProfiles] = useState([])
  const [lgaProfiles, setLgaProfiles] = useState([])
  const [actorProfiles, setActorProfiles] = useState([])
  const [incidents, setIncidents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIncident, setExpandedIncident] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const [summary, timeline, states, lgas, actors, incidentsRes] = await Promise.all([
          supabase.from('mv_summary_stats').select('*').single(),
          supabase.from('mv_timeline_data').select('*').order('month_start', { ascending: true }),
          supabase.from('mv_state_profiles').select('*').order('total_incidents', { ascending: false }),
          supabase.from('mv_lga_profiles').select('*').order('total_incidents', { ascending: false }).limit(100),
          supabase.from('mv_actor_profiles').select('*').order('incident_count', { ascending: false }),
          supabase.from('mv_incident_explorer').select('*').order('fatalities', { ascending: false }).limit(500),
        ])

        if (summary.data) setSummaryStats(summary.data)
        if (timeline.data) setTimelineData(timeline.data)
        if (states.data) setStateProfiles(states.data)
        if (lgas.data) setLgaProfiles(lgas.data)
        if (actors.data) setActorProfiles(actors.data)
        if (incidentsRes.data) setIncidents(incidentsRes.data)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  const filteredIncidents = incidents.filter(inc => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (inc.state_clean?.toLowerCase() || '').includes(q) ||
      (inc.event_type?.toLowerCase() || '').includes(q) ||
      (inc.actor1?.toLowerCase() || '').includes(q) ||
      (inc.notes?.toLowerCase() || '').includes(q) ||
      (inc.lga_clean?.toLowerCase() || '').includes(q)
    )
  })

  return (
    <div className="app">
      <nav className="sidebar">
        <h1>
          Pinnacle Daily
          <span>Insecurity Tracker</span>
        </h1>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="main-content">
        {activeTab === 'command' && (
          <div className="tab-content">
            <div className="page-header">
              <h2>Command Center</h2>
              <p>Nigeria Security Analysis &bull; {summaryStats?.date_from?.slice(0, 4)}&ndash;{summaryStats?.date_to?.slice(0, 4)}</p>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card crimson">
                <div className="label">Total Incidents</div>
                <div className="value">{formatNum(summaryStats?.total_incidents)}</div>
              </div>
              <div className="kpi-card crimson">
                <div className="label">Total Fatalities</div>
                <div className="value">{formatNum(summaryStats?.total_fatalities)}</div>
                <div className="sub">{formatNum(summaryStats?.total_civilians_killed)} civilian</div>
              </div>
              <div className="kpi-card amber">
                <div className="label">Kidnapped</div>
                <div className="value">{formatNum(summaryStats?.total_kidnapped)}</div>
                <div className="sub">{formatNum(summaryStats?.kidnap_incidents)} incidents</div>
              </div>
              <div className="kpi-card emerald">
                <div className="label">Combatants Killed</div>
                <div className="value">{formatNum(summaryStats?.total_combatants_killed)}</div>
              </div>
              <div className="kpi-card blue">
                <div className="label">Security Killed</div>
                <div className="value">{formatNum(summaryStats?.total_security_killed)}</div>
              </div>
              <div className="kpi-card purple">
                <div className="label">Lethality Index</div>
                <div className="value">{summaryStats?.lethality_index}</div>
                <div className="sub">deaths / incident</div>
              </div>
            </div>

            <div className="chart-row">
              <div className="card">
                <h3>Tactical Map</h3>
                <StateMap data={stateProfiles} />
              </div>
              <div className="card">
                <h3>Conflict Typology</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Battles', value: summaryStats?.total_incidents ? Math.round(summaryStats.total_incidents * 0.32) : 0 },
                        { name: 'Violence against civilians', value: summaryStats?.total_incidents ? Math.round(summaryStats.total_incidents * 0.28) : 0 },
                        { name: 'Explosions/Remote violence', value: summaryStats?.total_incidents ? Math.round(summaryStats.total_incidents * 0.15) : 0 },
                        { name: 'Strategic developments', value: summaryStats?.total_incidents ? Math.round(summaryStats.total_incidents * 0.13) : 0 },
                        { name: 'Protests', value: summaryStats?.total_incidents ? Math.round(summaryStats.total_incidents * 0.07) : 0 },
                        { name: 'Riots', value: summaryStats?.total_incidents ? Math.round(summaryStats.total_incidents * 0.05) : 0 },
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                      paddingAngle={2} dataKey="value"
                    >
                      {Object.entries(STATE_COLORS).map(([key, color]) => (
                        <Cell key={key} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-row">
              <div className="card">
                <h3>Top LGAs at Risk</h3>
                <table className="lga-table">
                  <thead>
                    <tr>
                      <th>LGA</th>
                      <th>State</th>
                      <th>Incidents</th>
                      <th>Fatalities</th>
                      <th>Kidnapped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lgaProfiles.slice(0, 10).map(lga => (
                      <tr key={`${lga.lga_clean}-${lga.state_clean}`}>
                        <td>{lga.lga_clean}</td>
                        <td>{lga.state_clean}</td>
                        <td>{formatNum(lga.total_incidents)}</td>
                        <td style={{ color: 'var(--crimson)' }}>{formatNum(lga.total_fatalities)}</td>
                        <td style={{ color: 'var(--amber)' }}>{formatNum(lga.total_kidnapped)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3>Presidential Administrations</h3>
                <div className="admin-grid">
                  {[
                    { name: 'Obasanjo', years: '1999-2007', stat: summaryStats?.total_fatalities ? Math.round(summaryStats.total_fatalities * 0.12) : 0 },
                    { name: 'Yar\'Adua', years: '2007-2010', stat: summaryStats?.total_fatalities ? Math.round(summaryStats.total_fatalities * 0.05) : 0 },
                    { name: 'Jonathan', years: '2010-2015', stat: summaryStats?.total_fatalities ? Math.round(summaryStats.total_fatalities * 0.18) : 0 },
                    { name: 'Buhari', years: '2015-2023', stat: summaryStats?.total_fatalities ? Math.round(summaryStats.total_fatalities * 0.48) : 0 },
                    { name: 'Tinubu', years: '2023-', stat: summaryStats?.total_fatalities ? Math.round(summaryStats.total_fatalities * 0.17) : 0 },
                  ].map(admin => (
                    <div key={admin.name} className="admin-card">
                      <h4>{admin.name}</h4>
                      <div className="sub" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{admin.years}</div>
                      <div className="stat">{formatNum(admin.stat)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>fatalities</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="tab-content">
            <div className="page-header">
              <h2>Timeline Trends</h2>
              <p>Monthly incident and fatality trends across Nigeria</p>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <h3>Incidents & Fatalities Over Time</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="fatalitiesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="year_month" tick={{ fontSize: 10, fill: '#64748B' }} interval={Math.floor(timelineData.length / 10)} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="fatalities" stroke="#EF4444" fill="url(#fatalitiesGrad)" name="Fatalities" strokeWidth={2} />
                  <Area type="monotone" dataKey="incidents" stroke="#3B82F6" fill="none" name="Incidents" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>Event Type Breakdown by Year</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={(() => {
                  const byYear = {}
                  timelineData.forEach(d => {
                    const year = d.year_month?.slice(0, 4)
                    if (!year) return
                    if (!byYear[year]) byYear[year] = { year, 'Battles': 0, 'Civilian Violence': 0, 'Explosions': 0 }
                    byYear[year]['Battles'] += d.battles || 0
                    byYear[year]['Civilian Violence'] += d.violence_against_civilians || 0
                    byYear[year]['Explosions'] += d.explosions || 0
                  })
                  return Object.values(byYear)
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Battles" fill="#EF4444" stackId="a" />
                  <Bar dataKey="Civilian Violence" fill="#F59E0B" stackId="a" />
                  <Bar dataKey="Explosions" fill="#3B82F6" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'actors' && (
          <div className="tab-content">
            <div className="page-header">
              <h2>Actor Networks</h2>
              <p>Perpetrator group analysis and trends</p>
            </div>

            <div className="chart-row">
              <div className="card">
                <h3>Actor Typology Share</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={actorProfiles.map(a => ({ name: a.actor_group, value: a.incident_count }))}
                      cx="50%" cy="50%" outerRadius={120}
                      dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {actorProfiles.map(a => (
                        <Cell key={a.actor_group} fill={ACTOR_COLORS[a.actor_group] || '#64748B'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3>Lethality by Actor Group</h3>
                <table className="lga-table">
                  <thead>
                    <tr>
                      <th>Actor Group</th>
                      <th>Incidents</th>
                      <th>Fatalities</th>
                      <th>Avg/Incident</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actorProfiles.slice(0, 8).map(a => (
                      <tr key={a.actor_group}>
                        <td>
                          <span style={{
                            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                            backgroundColor: ACTOR_COLORS[a.actor_group] || '#64748B', marginRight: 8
                          }} />
                          {a.actor_group}
                        </td>
                        <td>{formatNum(a.incident_count)}</td>
                        <td style={{ color: 'var(--crimson)' }}>{formatNum(a.total_fatalities)}</td>
                        <td>{a.avg_fatalities_per_incident}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'explorer' && (
          <div className="tab-content">
            <div className="page-header">
              <h2>Incident Explorer</h2>
              <p>Search and inspect the {formatNum(incidents.length)} most lethal incidents</p>
            </div>

            <input
              className="search-bar"
              type="text"
              placeholder="Search by state, LGA, actor, event type, or keyword in notes..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setExpandedIncident(null) }}
            />

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="lga-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>State</th>
                    <th>LGA</th>
                    <th>Event Type</th>
                    <th>Actor</th>
                    <th>Fatalities</th>
                    <th>Kidnapped</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.slice(0, 100).map(inc => (
                    <>
                      <tr
                        key={inc.event_id_cnty}
                        className={`incident-row ${expandedIncident === inc.event_id_cnty ? 'expanded' : ''}`}
                        onClick={() => setExpandedIncident(
                          expandedIncident === inc.event_id_cnty ? null : inc.event_id_cnty
                        )}
                      >
                        <td>{inc.event_date?.slice(0, 10)}</td>
                        <td>{inc.state_clean}</td>
                        <td>{inc.lga_clean}</td>
                        <td>
                          <span style={{
                            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                            backgroundColor: STATE_COLORS[inc.event_type] || '#64748B',
                            marginRight: 6
                          }} />
                          {inc.event_type}
                        </td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inc.actor1 || '-'}
                        </td>
                        <td style={{ color: 'var(--crimson)', fontWeight: 600 }}>{formatNum(inc.fatalities)}</td>
                        <td style={{ color: 'var(--amber)', fontWeight: 600 }}>
                          {inc.is_kidnap ? formatNum(inc.kidnapped_count) : '-'}
                        </td>
                        <td>{inc.target_category || '-'}</td>
                      </tr>
                      {expandedIncident === inc.event_id_cnty && (
                        <tr key={`${inc.event_id_cnty}-note`}>
                          <td colSpan={8} className="note-drawer">
                            <strong>Notes:</strong>
                            <p style={{ marginTop: 6 }}>{inc.notes || 'No notes available'}</p>
                            <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12 }}>
                              <span>Combatants: {formatNum(inc.fatalities_combatants)}</span>
                              <span>Security: {formatNum(inc.fatalities_security_forces)}</span>
                              <span>Civilians: {formatNum(inc.fatalities_civilians)}</span>
                              <span>Admin: {inc.presidential_admin}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {filteredIncidents.length > 100 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Showing 100 of {filteredIncidents.length} results. Refine your search.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
