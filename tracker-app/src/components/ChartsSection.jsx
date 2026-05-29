import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Cell, ComposedChart, Area } from 'recharts'

const EVENT_COLORS = {
  'Battles': '#dc2626',
  'Violence against civilians': '#f97316',
  'Explosions/Remote violence': '#eab308',
  'Strategic developments': '#22c55e',
  'Protests': '#3b82f6',
  'Riots': '#a855f7',
}

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{formatNum(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function ChartsSection({ incidents }) {
  const eventTypeData = useMemo(() => {
    const counts = {}
    incidents.forEach(d => {
      const et = d.event_type || 'Unknown'
      counts[et] = (counts[et] || 0) + 1
    })
    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }))
      .sort((a, b) => b.value - a.value)
  }, [incidents])

  const topStatesData = useMemo(() => {
    const stateMap = {}
    incidents.forEach(d => {
      const s = d.state_clean || 'Unknown'
      if (!stateMap[s]) stateMap[s] = { incidents: 0, fatalities: 0, kidnapped: 0 }
      stateMap[s].incidents++
      stateMap[s].fatalities += d.fatalities || 0
      stateMap[s].kidnapped += d.kidnapped_count || 0
    })
    return Object.entries(stateMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.fatalities - a.fatalities)
      .slice(0, 10)
  }, [incidents])

  const monthlyData = useMemo(() => {
    const months = {}
    incidents.forEach(d => {
      const m = (d.event_date || '').slice(0, 7)
      if (!m) return
      if (!months[m]) months[m] = { month: m, incidents: 0, fatalities: 0, kidnapped: 0, civilianTargeting: 0 }
      months[m].incidents++
      months[m].fatalities += d.fatalities || 0
      months[m].kidnapped += d.kidnapped_count || 0
      if (d.civilian_targeting) months[m].civilianTargeting++
    })
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
  }, [incidents])

  const kidnapData = useMemo(() => {
    const totalKidnapped = incidents.reduce((s, d) => s + (d.kidnapped_count || 0), 0)
    const civilianIncidents = incidents.filter(d => d.civilian_targeting).length
    const totalIncidents = incidents.length
    return [
      { name: 'Civilian Targeting', value: civilianIncidents, pct: totalIncidents ? ((civilianIncidents / totalIncidents) * 100).toFixed(1) : '0' },
      { name: 'Kidnapped (victims)', value: totalKidnapped, pct: '' },
      { name: 'Kidnap Incidents', value: incidents.filter(d => d.is_kidnap).length, pct: '' },
    ]
  }, [incidents])

  return (
    <div className="charts-section">
      <div className="charts-grid">
        <div className="chart-card chart-card-wide">
          <h4 className="chart-title">Timeline: Monthly Incidents & Fatalities</h4>
          <p className="chart-subtitle">Nigeria has seen a dramatic rise in political violence since 2010, with fatalities peaking in recent years under the Tinubu administration.</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={v => v.slice(5, 7) === '01' ? v.slice(0, 4) : ''} interval={0} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="incidents" fill="#3b82f6" opacity={0.4} name="Incidents" barSize={4} />
              <Line yAxisId="right" type="monotone" dataKey="fatalities" stroke="#ef4444" strokeWidth={2} dot={false} name="Fatalities" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h4 className="chart-title">Event Type Breakdown</h4>
          <p className="chart-subtitle">Battles and violence against civilians make up the majority of incidents.</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={eventTypeData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text)' }} width={110} />
              <Tooltip content={<CustomTooltip />} formatter={(value, name, props) => [`${formatNum(value)} (${props.payload.pct}%)`, 'Incidents']} />
              <Bar dataKey="value" name="Incidents" radius={[0, 3, 3, 0]} maxBarSize={20}>
                {eventTypeData.map((d, i) => (
                  <Cell key={i} fill={EVENT_COLORS[d.name] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h4 className="chart-title">Top 10 States by Fatalities</h4>
          <p className="chart-subtitle">Borno, Kaduna, and Zamfara account for the highest fatality tolls.</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topStatesData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text)' }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="fatalities" name="Fatalities" fill="#dc2626" radius={[0, 3, 3, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h4 className="chart-title">Human Cost: Kidnappings & Civilian Targeting</h4>
          <p className="chart-subtitle">Over 33,000 people kidnapped and 19,000+ civilian-targeting incidents recorded.</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kidnapData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={90} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Count" radius={[3, 3, 0, 0]} maxBarSize={40}>
                <Cell fill="#ef4444" />
                <Cell fill="#f59e0b" />
                <Cell fill="#f97316" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
