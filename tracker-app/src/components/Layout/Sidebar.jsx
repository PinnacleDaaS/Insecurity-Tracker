import { MapIcon, BarChart3, X } from 'lucide-react'

const STATES = ['All', 'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara']

const EVENT_TYPES = ['All', 'Battles', 'Violence against civilians', 'Explosions/Remote violence', 'Strategic developments', 'Protests', 'Riots']

const YEARS = ['All', ...Array.from({ length: 2026 - 1998 }, (_, i) => String(1999 + i))]

const ADMINISTRATIONS = ['All', 'Obasanjo', "Yar'Adua", 'Jonathan', 'Buhari', 'Tinubu']

const CIVILIAN_OPTIONS = ['All', 'Civilians Targeted', 'Other Incidents']

const ZONES = ['All', 'North East', 'North West', 'North Central', 'South East', 'South South', 'South West']

const filterStyle = 'w-full rounded-lg border border-border bg-card/80 px-3 py-2 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-colors'
const chevronStyle = "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-9"

export default function Sidebar({ activeTab, onTabChange, filters, onChange, onReset }) {
  const activeCount = [filters.state, filters.eventType, filters.year, filters.administration, filters.civilianTargeting, filters.geopoliticalZone, filters.victimType].filter(v => v && v !== 'All').length

  const handleChange = (key, value) => {
    if (key === 'civilianTargeting') {
      const mapped = value === 'Civilians Targeted' ? 'Civilian Targeting' : value === 'Other Incidents' ? 'Non-Civilian Targeting' : 'All'
      onChange(key, mapped)
    } else {
      onChange(key, value)
    }
  }

  const displayCivilian = filters.civilianTargeting === 'Civilian Targeting' ? 'Civilians Targeted' : filters.civilianTargeting === 'Non-Civilian Targeting' ? 'Other Incidents' : 'All'

  return (
    <div className="flex h-full flex-col gap-5">
      {/* View navigation */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">View</h2>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onTabChange('map')}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === 'map'
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <MapIcon size={15} />
            Map View
          </button>
          <button
            onClick={() => onTabChange('charts')}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === 'charts'
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <BarChart3 size={15} />
            Analytics
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Filters</h2>
          {activeCount > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <X size={12} />
              Clear {activeCount}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <select value={filters.state || 'All'} onChange={e => onChange('state', e.target.value)} className={`${filterStyle} ${chevronStyle}`}>
            {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
          </select>

          <select value={filters.eventType || 'All'} onChange={e => onChange('eventType', e.target.value)} className={`${filterStyle} ${chevronStyle}`}>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'Event Type' : t}</option>)}
          </select>

          <select value={filters.year || 'All'} onChange={e => onChange('year', e.target.value)} className={`${filterStyle} ${chevronStyle}`}>
            {YEARS.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
          </select>

          <select value={filters.administration || 'All'} onChange={e => onChange('administration', e.target.value)} className={`${filterStyle} ${chevronStyle}`}>
            {ADMINISTRATIONS.map(a => <option key={a} value={a}>{a === 'All' ? 'President' : a}</option>)}
          </select>

          <select value={displayCivilian} onChange={e => handleChange('civilianTargeting', e.target.value)} className={`${filterStyle} ${chevronStyle}`}>
            {CIVILIAN_OPTIONS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Incidents' : c}</option>)}
          </select>

          <select value={filters.geopoliticalZone || 'All'} onChange={e => onChange('geopoliticalZone', e.target.value)} className={`${filterStyle} ${chevronStyle}`}>
            {ZONES.map(z => <option key={z} value={z}>{z === 'All' ? 'Geo Zone' : z}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
