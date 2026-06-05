import { Activity, Skull, Users } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { ACCENT_MAP } from '../../constants/colors.js'

const ICONS = { Activity, Skull, Users }

export default function KpiCard({ label, value, color = 'cyan', icon = 'Activity', delta = null, prevAdminLabel = null, sparklineData = null, deltaIsAbsolute = false }) {
  const Icon = ICONS[icon] || Activity
  const a = ACCENT_MAP[color] || ACCENT_MAP.cyan

  return (
    <div className={`flex items-center gap-2.5 rounded-xl border ${a.border} ${a.glow} bg-background px-3 py-2.5 sm:px-4 sm:py-3 min-w-[110px] sm:min-w-[140px] flex-shrink-0 shadow-sm`}>
      <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg ${a.bg}`}>
        <Icon size={15} className={`${a.icon} sm:size-[18px]`} />
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="font-display text-base sm:text-xl font-bold text-foreground leading-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {delta !== null && prevAdminLabel && (
          <p className={`text-xs mt-0.5 ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(deltaIsAbsolute ? 2 : 1)}{deltaIsAbsolute ? '' : '%'} vs {prevAdminLabel}
          </p>
        )}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="ml-auto flex-shrink-0">
          <ResponsiveContainer width={60} height={28}>
            <LineChart data={sparklineData}>
              <Line type="monotone" dataKey="rate" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
