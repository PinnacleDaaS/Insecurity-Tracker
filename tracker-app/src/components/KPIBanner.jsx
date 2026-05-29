import { Activity, Skull, Users } from 'lucide-react'

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

export default function KPIBanner({ incidents }) {
  if (!incidents) return null
  const totalIncidents = incidents.length
  const totalFatalities = incidents.reduce((s, d) => s + (d.fatalities || 0), 0)
  const totalKidnapped = incidents.reduce((s, d) => s + (d.kidnapped_count || 0), 0)
  return (
    <div className="kpi-banner">
      <div className="kpi-item">
        <Activity className="kpi-icon kpi-icon-red" size={20} />
        <div>
          <div className="kpi-label">Total Incidents</div>
          <div className="kpi-value">{formatNum(totalIncidents)}</div>
        </div>
      </div>
      <div className="kpi-item">
        <Skull className="kpi-icon kpi-icon-red" size={20} />
        <div>
          <div className="kpi-label">Total Fatalities</div>
          <div className="kpi-value">{formatNum(totalFatalities)}</div>
        </div>
      </div>
      <div className="kpi-item">
        <Users className="kpi-icon kpi-icon-amber" size={20} />
        <div>
          <div className="kpi-label">Total Kidnapped</div>
          <div className="kpi-value">{formatNum(totalKidnapped)}</div>
        </div>
      </div>
    </div>
  )
}
