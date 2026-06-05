import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl px-3 py-2 text-xs">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          {p.name}: <strong className="text-foreground">{formatNum(p.value)}</strong>
        </div>
      ))}
      <div className="border-t border-border mt-1 pt-1 flex justify-between text-foreground font-semibold">
        <span>Total</span>
        <span>{formatNum(total)}</span>
      </div>
    </div>
  )
}

const ZONE_ABBR = {
  'North East': 'NE',
  'North West': 'NW',
  'North Central': 'NC',
  'South East': 'SE',
  'South South': 'SS',
  'South West': 'SW',
}

const COLORS = {
  civilians: '#ef4444',
  security_forces: '#3b82f6',
  combatants: '#d97706',
}

export default function ZoneFatalityBreakdown({ incidents }) {
  const data = useMemo(() => {
    const groups = {}
    for (const inc of incidents) {
      const zone = inc.geopolitical_zone
      if (!zone) continue
      if (!groups[zone]) groups[zone] = { civilians: 0, security_forces: 0, combatants: 0 }
      groups[zone].civilians += inc.fatalities_civilians || 0
      groups[zone].security_forces += inc.fatalities_security_forces || 0
      groups[zone].combatants += inc.fatalities_combatants || 0
    }
    return Object.entries(groups)
      .map(([zone, vals]) => ({
        name: ZONE_ABBR[zone] || zone,
        zone,
        civilians: vals.civilians,
        security: vals.security_forces,
        combatants: vals.combatants,
        total: vals.civilians + vals.security_forces + vals.combatants,
      }))
      .sort((a, b) => b.total - a.total)
  }, [incidents])

  if (!data.length) return null

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h4 className="font-display font-bold text-sm text-foreground mb-1">Fatality breakdown by zone</h4>
      <p className="text-xs text-slate-500 mb-4">Civilians, security forces, and combatants by geopolitical zone.</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} layout="vertical" barSize={20}>
          <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={40} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={30} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#64748b' }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="combatants" name="Combatants" stackId="a" fill={COLORS.combatants} radius={[0, 0, 0, 0]} />
          <Bar dataKey="security" name="Security forces" stackId="a" fill={COLORS.security_forces} radius={[0, 0, 0, 0]} />
          <Bar dataKey="civilians" name="Civilians" stackId="a" fill={COLORS.civilians} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}