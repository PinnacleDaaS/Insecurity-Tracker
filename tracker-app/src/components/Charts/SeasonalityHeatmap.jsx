import { useMemo, useState, useCallback } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CELL = 14
const GAP = 2
const STEP = CELL + GAP
const MONTH_LABEL_W = STEP * 12
const YEAR_LABEL_W = 36

function getIntensity(val, max) {
  if (!max || !val) return 0
  return Math.min(1, val / max)
}

function heatColor(t) {
  if (t === 0) return 'rgba(251,146,60,0.04)'
  if (t < 0.15) return 'rgba(251,146,60,0.15)'
  if (t < 0.35) return 'rgba(251,146,60,0.35)'
  if (t < 0.55) return 'rgba(251,146,60,0.55)'
  if (t < 0.75) return 'rgba(220,38,38,0.65)'
  return 'rgba(127,29,29,0.85)'
}

export default function SeasonalityHeatmap({ incidents }) {
  const [tooltip, setTooltip] = useState(null)

  const { grid, maxVal, years } = useMemo(() => {
    const cells = {}
    let mx = 0
    const yrSet = new Set()
    for (const inc of incidents) {
      if (!inc.event_date) continue
      const d = new Date(inc.event_date + (inc.event_date.includes('T') ? '' : 'T00:00:00'))
      const y = d.getFullYear()
      const m = d.getMonth()
      yrSet.add(y)
      const key = `${y}-${m}`
      cells[key] = (cells[key] || 0) + 1
      if (cells[key] > mx) mx = cells[key]
    }
    const sortedYears = [...yrSet].sort((a, b) => a - b)
    return { grid: cells, maxVal: mx, years: sortedYears }
  }, [incidents])

  const handleMouseEnter = useCallback((e, y, m) => {
    const key = `${y}-${m}`
    const count = grid[key] || 0
    const rect = e.target.getBoundingClientRect()
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      count,
      label: `${MONTHS[m]} ${y}`,
    })
  }, [grid])

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  const h = years.length * STEP + 4
  const w = MONTH_LABEL_W + YEAR_LABEL_W + 16

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-display font-bold text-sm text-foreground">Seasonal conflict pattern (events by month)</h4>
      </div>
      <p className="text-xs text-slate-500 mb-4">Event counts by month across all years.</p>
      <div className="relative overflow-x-auto">
        <svg width={w} height={h} className="block">
          {/* Year labels */}
          {years.map((y, i) => (
            <text
              key={y}
              x={YEAR_LABEL_W - 4}
              y={i * STEP + CELL / 2 + 1}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-muted-foreground"
              fontSize={10}
              fontFamily="Inter, sans-serif"
            >
              {y}
            </text>
          ))}
          {/* Month labels */}
          {MONTHS.map((m, i) => (
            <text
              key={m}
              x={YEAR_LABEL_W + i * STEP + CELL / 2}
              y={-4}
              textAnchor="middle"
              dominantBaseline="baseline"
              className="fill-muted-foreground"
              fontSize={9}
              fontFamily="Inter, sans-serif"
            >
              {m}
            </text>
          ))}
          {/* Cells */}
          {years.map((y, ri) =>
            MONTHS.map((_, ci) => {
              const key = `${y}-${ci}`
              const val = grid[key] || 0
              const t = getIntensity(val, maxVal)
              return (
                <rect
                  key={key}
                  x={YEAR_LABEL_W + ci * STEP}
                  y={ri * STEP + 2}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={heatColor(t)}
                  className="cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(e, y, ci)}
                  onMouseLeave={handleMouseLeave}
                />
              )
            })
          )}
        </svg>
        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-[10000] pointer-events-none bg-card border border-border rounded-lg shadow-xl shadow-black/20 px-3 py-2 text-xs"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          >
            <div className="font-semibold text-foreground">{tooltip.label}</div>
            <div className="text-muted-foreground">{tooltip.count.toLocaleString()} events</div>
          </div>
        )}
      </div>
    </div>
  )
}