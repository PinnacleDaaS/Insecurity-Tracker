import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { EVENT_COLORS } from '../../constants/colors.js'

function parseEventDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(iso) {
  if (!iso) return ''
  const d = parseEventDate(iso)
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

function IncidentRow({ incident, onClick, index }) {
  const color = EVENT_COLORS[incident.event_type] || '#64748b'
  const severity = (incident.fatalities || 0) + (incident.kidnapped_count || 0)

  return (
    <button
      onClick={() => onClick?.(incident)}
      className="w-full text-left px-4 py-2.5 border-b border-border hover:bg-accent transition-colors last:border-0"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center text-[9px] font-bold">{index + 1}</span>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[11px] font-medium text-muted-foreground">{formatDate(incident.event_date)}</span>
        {incident.civilian_targeting && (
          <span className="ml-auto rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">Civilian</span>
        )}
      </div>
      <div className="text-sm font-semibold text-foreground truncate">{incident.event_type}</div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
        <span>{incident.location}{incident.state_clean ? `, ${incident.state_clean}` : ''}</span>
        <span className="font-semibold text-rose-500 dark:text-rose-400">{severity.toLocaleString()} casualties</span>
      </div>
    </button>
  )
}

function DetailView({ incident, onBack }) {
  if (!incident) return null
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted flex-shrink-0">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <h4 className="font-display font-bold text-sm text-foreground truncate">{incident.event_type}</h4>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground min-w-[80px]">Location</span>
          <span>{incident.location}{incident.state_clean ? `, ${incident.state_clean}` : ''}{incident.lga_clean ? ` / ${incident.lga_clean}` : ''}</span>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground min-w-[80px]">Actors</span>
          <span>{incident.actor1 || '-'}{incident.actor2 ? ` vs ${incident.actor2}` : ''}</span>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground min-w-[80px]">Date</span>
          <span>{incident.event_date?.slice(0, 10)}{incident.presidential_admin ? ` — ${incident.presidential_admin}` : ''}</span>
        </div>
        <div className="flex gap-4 pt-1 border-t border-border">
          <span className="flex items-center gap-1.5 text-sm">
            <strong className="font-bold text-rose-500">{formatNum(incident.fatalities)}</strong>
            <span className="text-muted-foreground">fatalities</span>
          </span>
          {incident.kidnapped_count > 0 && (
            <span className="flex items-center gap-1.5 text-sm">
              <strong className="font-bold text-violet-500">{formatNum(incident.kidnapped_count)}</strong>
              <span className="text-muted-foreground">kidnapped</span>
            </span>
          )}
        </div>
        {incident.civilian_targeting && (
          <span className="inline-block rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
            Civilian Targeting
          </span>
        )}
        {incident.event_type && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground min-w-[80px]">Type</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: EVENT_COLORS[incident.event_type] || '#64748b' }} />
              {incident.event_type}
            </span>
          </div>
        )}
        {incident.sub_event_type && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground min-w-[80px]">Sub-type</span>
            <span>{incident.sub_event_type}</span>
          </div>
        )}
        {incident.notes && (
          <div className="rounded-lg bg-muted border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">{incident.notes}</p>
          </div>
        )}
        {(incident.fatalities_combatants > 0 || incident.fatalities_security_forces > 0 || incident.fatalities_civilians > 0) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            {incident.fatalities_combatants > 0 && <span>Combatants: {formatNum(incident.fatalities_combatants)}</span>}
            {incident.fatalities_security_forces > 0 && <span>Security: {formatNum(incident.fatalities_security_forces)}</span>}
            {incident.fatalities_civilians > 0 && <span>Civilians: {formatNum(incident.fatalities_civilians)}</span>}
          </div>
        )}
        {incident.geopolitical_zone && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground min-w-[80px]">Geo Zone</span>
            <span>{incident.geopolitical_zone}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function getFeedTitle(filters) {
  const parts = []
  if (filters.state && filters.state !== 'All') parts.push(filters.state)
  if (filters.geopoliticalZone && filters.geopoliticalZone !== 'All') parts.push(filters.geopoliticalZone)
  if (filters.eventType && filters.eventType !== 'All') parts.push(filters.eventType)
  if (filters.administration && filters.administration !== 'All') parts.push(filters.administration)
  if (filters.civilianTargeting === 'Civilian Targeting') parts.push('civilian targeting')
  if (filters.year && filters.year !== 'All') parts.push(filters.year)
  if (parts.length) return `Top 10 incidents — ${parts.join(' · ')}`
  return 'Top 10 incidents by casualties'
}

export default function ActivityFeed({ incidents, onSelect, filters = {} }) {
  const [selected, setSelected] = useState(null)

  const topIncidents = useMemo(
    () => [...incidents]
      .sort((a, b) => (b.fatalities || 0) + (b.kidnapped_count || 0) - (a.fatalities || 0) - (a.kidnapped_count || 0))
      .slice(0, 10),
    [incidents]
  )

  const suggestions = useMemo(() => {
    const tips = []
    if (filters.state && filters.state !== 'All') tips.push('all states')
    if (filters.eventType && filters.eventType !== 'All') tips.push('all event types')
    if (filters.administration && filters.administration !== 'All') tips.push('all administrations')
    if (filters.civilianTargeting && filters.civilianTargeting !== 'All') tips.push('both civilian & non-civilian')
    if (filters.geopoliticalZone && filters.geopoliticalZone !== 'All') tips.push('all zones')
    return tips
  }, [filters])

  const handleSelect = (inc) => {
    setSelected(inc)
    onSelect?.(inc)
  }

  const handleBack = () => {
    setSelected(null)
    onSelect?.(null)
  }

  if (selected) {
    return (
      <div className="flex h-full flex-col">
        <DetailView incident={selected} onBack={handleBack} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <h3 className="font-display font-bold text-sm text-foreground">{getFeedTitle(filters)}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Click any row for full details</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {topIncidents.length > 0 ? (
          topIncidents.map((inc, i) => (
            <IncidentRow key={inc.event_id_cnty} incident={inc} onClick={handleSelect} index={i} />
          ))
        ) : (
          <div className="p-6 text-center">
            <div className="mx-auto mb-3 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm font-bold">!</span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No incidents match these filters</p>
            {suggestions.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Try {suggestions.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
