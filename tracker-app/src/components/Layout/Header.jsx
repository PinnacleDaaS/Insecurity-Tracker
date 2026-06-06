import { Calendar, Sun, Moon, BookOpen } from 'lucide-react'

export default function Header({
  dateRange,
  onDateRangeChange,
  minDate,
  maxDate,
  theme,
  onToggleTheme,
  onOpenDictionary,
}) {
  function handleFromChange(e) {
    const val = e.target.value
    onDateRangeChange([val, dateRange[1]])
  }

  function handleToChange(e) {
    const val = e.target.value
    onDateRangeChange([dateRange[0], val])
  }

  return (
    <div className="flex w-full items-center justify-between gap-4">
      {/* Left section — brand */}
      <div className="flex items-center gap-3">
        <img src="/Pinnacle Logo.png" alt="Pinnacle" className="h-9 w-9 object-contain rounded-lg" />
        <h1 className="font-display text-lg font-bold text-foreground tracking-tight">
          Nigeria Conflict Tracker
        </h1>
      </div>

      {/* Center section — inline date inputs */}
      <div className="hidden md:flex items-center gap-2">
        <Calendar size={14} className="text-muted-foreground flex-shrink-0" />
        <input
          type="date"
          value={dateRange?.[0] || minDate}
          min={minDate}
          max={dateRange?.[1] || maxDate}
          onChange={handleFromChange}
          className="rounded-lg border border-border bg-card/50 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/40 w-[130px] cursor-pointer"
        />
        <span className="text-muted-foreground text-xs">—</span>
        <input
          type="date"
          value={dateRange?.[1] || maxDate}
          min={dateRange?.[0] || minDate}
          max={maxDate}
          onChange={handleToChange}
          className="rounded-lg border border-border bg-card/50 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/40 w-[130px] cursor-pointer"
        />
      </div>

      {/* Right section — actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOpenDictionary?.()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          title="Data dictionary"
        >
          <BookOpen size={15} />
        </button>
        <button
          onClick={onToggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-muted-foreground transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </div>
  )
}
