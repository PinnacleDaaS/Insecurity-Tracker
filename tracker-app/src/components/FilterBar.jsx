import { Filter, X } from 'lucide-react'

const STATES = ['All', 'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara']

const EVENT_TYPES = ['All', 'Battles', 'Violence against civilians', 'Explosions/Remote violence', 'Strategic developments', 'Protests', 'Riots']

const YEARS = ['All', ...Array.from({ length: 2026 - 1998 }, (_, i) => String(1999 + i))]

const ADMINISTRATIONS = ['All', 'Obasanjo', "Yar'Adua", 'Jonathan', 'Buhari', 'Tinubu']

const CIVILIAN_OPTIONS = ['All', 'Civilians Targeted', 'Other Incidents']

const ZONES = ['All', 'North East', 'North West', 'North Central', 'South East', 'South South', 'South West']

export default function FilterBar({ filters, onChange, onReset }) {
  const activeCount = [filters.state, filters.eventType, filters.year, filters.administration, filters.civilianTargeting, filters.geopoliticalZone].filter(v => v && v !== 'All').length

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
    <div className="filter-bar">
      <Filter size={16} className="filter-icon" />
      <select
        value={filters.state || 'All'}
        onChange={e => onChange('state', e.target.value)}
        className="filter-select"
      >
        {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
      </select>
      <select
        value={filters.eventType || 'All'}
        onChange={e => onChange('eventType', e.target.value)}
        className="filter-select"
      >
        {EVENT_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'Event Type' : t}</option>)}
      </select>
      <select
        value={filters.year || 'All'}
        onChange={e => onChange('year', e.target.value)}
        className="filter-select"
      >
        {YEARS.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
      </select>
      <select
        value={filters.administration || 'All'}
        onChange={e => onChange('administration', e.target.value)}
        className="filter-select"
      >
        {ADMINISTRATIONS.map(a => <option key={a} value={a}>{a === 'All' ? 'President' : a}</option>)}
      </select>
      <select
        value={displayCivilian}
        onChange={e => handleChange('civilianTargeting', e.target.value)}
        className="filter-select"
      >
        {CIVILIAN_OPTIONS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Incidents' : c}</option>)}
      </select>
      <select
        value={filters.geopoliticalZone || 'All'}
        onChange={e => onChange('geopoliticalZone', e.target.value)}
        className="filter-select"
      >
        {ZONES.map(z => <option key={z} value={z}>{z === 'All' ? 'Geo Zone' : z}</option>)}
      </select>
      {activeCount > 0 && (
        <button className="filter-reset" onClick={onReset} title="Clear all filters">
          <X size={14} />
          <span>{activeCount}</span>
        </button>
      )}
    </div>
  )
}
