import { MapPin, Calendar, Skull, Swords } from 'lucide-react'
import { EVENT_COLORS } from '../../constants/colors.js'

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

export function HoverTooltip({ incident, position }) {
  if (!incident) return null

  return (
    <div
      className="fixed z-[10000] pointer-events-none bg-card border border-border rounded-lg shadow-xl shadow-black/20 px-3 py-2.5 min-w-[200px] animate-fade-in"
      style={{ left: position.x + 14, top: position.y - 12 }}
    >
      <div className="font-display font-bold text-sm text-foreground mb-1">
        {incident.event_type}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <MapPin size={10} />
        {incident.location}{incident.state_clean ? `, ${incident.state_clean}` : ''}
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={10} />
          {incident.event_date?.slice(0, 10)}
        </span>
        <span className="flex items-center gap-1">
          <Skull size={10} className="text-rose-500" />
          {incident.fatalities > 0 ? `${formatNum(incident.fatalities)} killed` : '0 fatalities'}
        </span>
        {incident.kidnapped_count > 0 && (
          <span className="font-medium text-violet-500">{formatNum(incident.kidnapped_count)} kidnapped</span>
        )}
      </div>
      {incident.civilian_targeting && (
        <span className="mt-1.5 inline-block rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
          Civilian Targeting
        </span>
      )}
    </div>
  )
}

export function DetailPanel({ incident, onClose, mobile }) {
  if (!incident) return null

  return (
    <div
      className={`bg-card border-border border overflow-hidden ${
        mobile ? '' : 'rounded-xl shadow-2xl shadow-black/20 animate-fade-in'
      }`}
    >
      {/* Header — hidden on mobile since the parent overlay has its own header */}
      {!mobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
          <h4 className="font-display font-bold text-sm text-foreground">{incident.event_type}</h4>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className={`${mobile ? 'p-4' : 'px-4 py-3'} space-y-2.5 text-sm`}>
        <div className="flex items-start gap-2 text-muted-foreground">
          <MapPin size={13} className="mt-0.5 flex-shrink-0" />
          <span>{incident.location}{incident.state_clean ? `, ${incident.state_clean}` : ''}{incident.lga_clean ? ` / ${incident.lga_clean}` : ''}</span>
        </div>

        <div className="flex items-start gap-2 text-muted-foreground">
          <Swords size={13} className="mt-0.5 flex-shrink-0" />
          <span>{incident.actor1 || '-'}{incident.actor2 ? ` vs ${incident.actor2}` : ''}</span>
        </div>

        <div className="flex items-start gap-2 text-muted-foreground">
          <Calendar size={13} className="mt-0.5 flex-shrink-0" />
          <span>{incident.event_date?.slice(0, 10)}{incident.presidential_admin ? ` — ${incident.presidential_admin}` : ''}</span>
        </div>

        <div className="flex gap-4 pt-1 border-t border-border">
          <span className="flex items-center gap-1.5 text-sm">
            <Skull size={13} className="text-rose-500" />
            <strong className="font-bold text-foreground">{formatNum(incident.fatalities)}</strong>
            <span className="text-muted-foreground">fatalities</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <strong className="font-bold text-violet-500">{formatNum(incident.kidnapped_count)}</strong>
            <span className="text-muted-foreground">kidnapped</span>
          </span>
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
