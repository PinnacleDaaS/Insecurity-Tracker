export const EVENT_COLORS = {
  'Battles': '#dc2626',
  'Violence against civilians': '#f97316',
  'Explosions/Remote violence': '#eab308',
  'Strategic developments': '#22c55e',
  'Protests': '#3b82f6',
  'Riots': '#a855f7',
}

export const FATALITY_COLORS = {
  0: '#22c55e',
  1: '#eab308',
  5: '#f97316',
  10: '#dc2626',
  20: '#7f1d1d',
}

export function getFatalityColor(fatalities) {
  if (fatalities >= 20) return FATALITY_COLORS[20]
  if (fatalities >= 10) return FATALITY_COLORS[10]
  if (fatalities >= 5) return FATALITY_COLORS[5]
  if (fatalities >= 1) return FATALITY_COLORS[1]
  return FATALITY_COLORS[0]
}

export function getMarkerRadius(d) {
  const f = d.fatalities || 0
  const k = d.kidnapped_count || 0
  const value = Math.max(f, Math.ceil(k / 2))
  if (value <= 0) return 2
  return Math.max(2, Math.min(12, Math.sqrt(value) * 0.6 + 1))
}

export const ACCENT_MAP = {
  amber: { bg: 'bg-amber-500/10', icon: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/5' },
  rose: { bg: 'bg-rose-500/10', icon: 'text-rose-500 dark:text-rose-400', border: 'border-rose-500/20', glow: 'shadow-rose-500/5' },
  violet: { bg: 'bg-violet-500/10', icon: 'text-violet-500 dark:text-violet-400', border: 'border-violet-500/20', glow: 'shadow-violet-500/5' },
  cyan: { bg: 'bg-cyan-500/10', icon: 'text-cyan-500 dark:text-cyan-400', border: 'border-cyan-500/20', glow: 'shadow-cyan-500/5' },
}

export const FATALITY_SCALE = [
  { label: '1 – 4 fatalities', color: FATALITY_COLORS[1], fill: 'bg-yellow-500' },
  { label: '5 – 19 fatalities', color: FATALITY_COLORS[5], fill: 'bg-orange-500' },
  { label: '20 – 99 fatalities', color: FATALITY_COLORS[10], fill: 'bg-red-600' },
  { label: '100+ fatalities', color: FATALITY_COLORS[20], fill: 'bg-red-950', glow: true },
]
