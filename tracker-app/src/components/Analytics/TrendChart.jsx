import { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, Cell } from 'recharts'
import { EVENT_COLORS } from '../../constants/colors.js'

const CHART_ANIMATION = { animationBegin: 0, animationDuration: 400 }

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl px-3 py-2 text-xs">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          {p.name}: <strong className="text-foreground">{formatNum(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

function aggToPeriod(months, period) {
  const arr = Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
  if (period === 'monthly') return arr

  const grouped = {}
  for (const m of arr) {
    const key = period === 'quarterly'
      ? `${m.month.slice(0, 5)}Q${Math.ceil(parseInt(m.month.slice(5, 7)) / 3)}`
      : m.month.slice(0, 4)
    if (!grouped[key]) grouped[key] = { month: key, incidents: 0, fatalities: 0, kidnapped: 0 }
    grouped[key].incidents += m.incidents
    grouped[key].fatalities += m.fatalities
    grouped[key].kidnapped += m.kidnapped
  }
  return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month))
}

export default function TrendChart({ incidents, selectedYear = 'All' }) {
  const [drillPeriod, setDrillPeriod] = useState('monthly')
  const isYearDrill = selectedYear !== 'All'

  useEffect(() => {
    if (!isYearDrill) setDrillPeriod('monthly')
  }, [selectedYear])

  const { eventTypeData, topStatesData, monthlyData } = useMemo(() => {
    const eventTypeCounts = {}
    const stateMap = {}
    const months = {}

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
        if (!months[m]) months[m] = { month: m, incidents: 0, fatalities: 0, kidnapped: 0 }
        months[m].incidents++
        months[m].fatalities += d.fatalities || 0
        months[m].kidnapped += d.kidnapped_count || 0
      }
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

    return { eventTypeData, topStatesData, monthlyData }
  }, [incidents])

  const period = isYearDrill ? drillPeriod : 'yearly'
  const timelineData = useMemo(() => aggToPeriod(
    Object.fromEntries(monthlyData.map(m => [m.month, m])),
    period
  ), [monthlyData, period])

  const isDense = period === 'monthly'

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="max-w-[1200px] mx-auto space-y-5">
        {/* Timeline — elevated card */}
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-display font-bold text-sm text-foreground">
              Incidents & Fatalities Over Time
              {isYearDrill && <span className="font-normal text-slate-500"> — {selectedYear}</span>}
            </h4>
            {isYearDrill && (
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                {['monthly', 'quarterly'].map(p => (
                  <button
                    key={p}
                    onClick={() => setDrillPeriod(p)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                      drillPeriod === p
                        ? 'bg-card dark:bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">Political violence has risen sharply since 2010, with fatalities peaking under recent administrations.</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={timelineData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#64748b', angle: -45, textAnchor: 'end' }}
                    tickFormatter={v => {
                      if (period === 'yearly') return v
                      if (period === 'quarterly') return v
                      return v.slice(5, 7) === '01' ? v.slice(0, 4) : ''
                    }}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                    height={50}
                  />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} width={32} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} width={32} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar yAxisId="left" dataKey="incidents" fill="#3b82f6" opacity={0.25} name="Incidents" barSize={isDense ? 3 : 12} {...CHART_ANIMATION} />
              <Line yAxisId="right" type="monotone" dataKey="fatalities" stroke="#f43f5e" strokeWidth={1.5} dot={false} name="Fatalities" {...CHART_ANIMATION} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Event Type Breakdown */}
          <div className="rounded-xl border border-border bg-background p-4">
            <h4 className="font-display font-bold text-sm text-foreground mb-1">Event Type Breakdown</h4>
            <p className="text-xs text-slate-500 mb-4">Battles and violence against civilians dominate.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={eventTypeData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} layout="vertical" {...CHART_ANIMATION}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={100} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} formatter={(value, name, props) => [`${formatNum(value)} (${props.payload.pct}%)`, 'Incidents']} />
                <Bar dataKey="value" name="Incidents" radius={[0, 2, 2, 0]} maxBarSize={18}>
                  {eventTypeData.map((d, i) => (
                    <Cell key={i} fill={EVENT_COLORS[d.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top States */}
          <div className="rounded-xl border border-border bg-background p-4">
            <h4 className="font-display font-bold text-sm text-foreground mb-1">Top 10 States by Fatalities</h4>
            <p className="text-xs text-slate-500 mb-4">Borno, Kaduna, and Zamfara lead in conflict deaths.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topStatesData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} layout="vertical" {...CHART_ANIMATION}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="fatalities" name="Fatalities" fill="#f43f5e" radius={[0, 2, 2, 0]} maxBarSize={18} {...CHART_ANIMATION} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  )
}
