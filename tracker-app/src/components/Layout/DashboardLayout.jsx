import { useState } from 'react'
import { Menu, X, PanelLeftClose, PanelLeft, BarChart3 } from 'lucide-react'

function formatDate(ts) {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(ts))
}

export default function DashboardLayout({
  header,
  sidebar,
  kpiCards,
  activityPanel,
  dictionaryPanel,
  children,
  activeFilterCount = 0,
  lastUpdated = null,
  dateBounds = null,
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [showMobileKPIs, setShowMobileKPIs] = useState(false)

  const sidebarWidth = desktopSidebarOpen ? '240px' : '0px'

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground font-sans antialiased selection:bg-cyan-500/20">

      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ===== DESKTOP LAYOUT (lg+) ===== */}
      <div
        className="hidden lg:grid h-full"
        style={{
          gridTemplateColumns: `${sidebarWidth} 1fr`,
          gridTemplateRows: 'auto 1fr auto',
          transition: 'grid-template-columns 0.25s ease',
        }}
      >
        {/* Header — col-span-2 */}
        <header className="col-span-2 flex items-center border-b border-border bg-background/80 px-5 backdrop-blur-sm z-10 h-16">
          {header}
        </header>

        {/* Sidebar — col-1, row-2 */}
        <aside className={`overflow-hidden border-r border-border bg-muted ${desktopSidebarOpen ? 'p-4' : 'p-0'}`}>
          {desktopSidebarOpen && sidebar}
        </aside>

        {/* Sidebar toggle button */}
        {desktopSidebarOpen ? (
          <button
            onClick={() => setDesktopSidebarOpen(false)}
            className="absolute left-[240px] top-1/2 z-[1001] -translate-x-1/2 hidden lg:flex h-8 w-5 items-center justify-center rounded-r-md border border-border bg-card text-muted-foreground hover:text-foreground shadow-sm transition-all"
            title="Collapse filters"
          >
            <PanelLeftClose size={12} />
          </button>
        ) : (
          <button
            onClick={() => setDesktopSidebarOpen(true)}
            className="absolute left-0 top-1/2 z-[1001] -translate-y-1/2 hidden lg:flex items-center gap-2 rounded-r-xl border border-l-0 border-border bg-card/90 backdrop-blur-sm px-3 py-3 text-xs font-semibold text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400 shadow-md hover:shadow-lg transition-all hover:pr-4"
            title="Expand filters"
          >
            <PanelLeft size={14} />
            <span>Filters</span>
          </button>
        )}

        {/* Main — col-2, row-2 */}
        <main className="flex min-h-0 flex-col overflow-hidden">
          {kpiCards && (
            <div className="flex flex-shrink-0 gap-3 border-b border-border px-5 py-4 bg-background [&>*]:flex-1">
              {kpiCards}
            </div>
          )}
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 min-h-0">{children}</div>
            {activityPanel && (
              <aside className="w-80 flex-shrink-0 overflow-y-auto border-l border-border bg-muted">
                {activityPanel}
              </aside>
            )}
          </div>
        </main>

        {/* Footer — col-span-2, row-3 */}
        <footer className="col-span-2 flex items-center justify-center border-t border-border bg-muted h-8 text-[11px] text-muted-foreground">
          <span>Data updated: <time>{formatDate(lastUpdated)}</time></span>
          <span className="mx-3 opacity-30">|</span>
          <span>Coverage: {dateBounds ? `${dateBounds.min?.split('-')[0]} – ${new Date(dateBounds.max + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '—'}</span>
          <span className="mx-3 opacity-30">|</span>
          <span>Source: <a href="https://acleddata.com" target="_blank" rel="noreferrer" className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground">ACLED</a></span>
          <span className="mx-3 opacity-30">|</span>
          <span className="opacity-70">Created by{' '}
            <a href="https://www.joshuaakintayo.me" target="_blank" rel="noreferrer" className="opacity-100 underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground transition-colors">
              Joshua Akintayo
            </a>
          </span>
        </footer>
      </div>

      {/* ===== MOBILE LAYOUT (< lg) ===== */}
      <div className="flex lg:hidden h-full flex-col">
        {/* Mobile Header */}
        <header className="flex h-14 flex-shrink-0 items-center border-b border-border bg-background/80 px-2 backdrop-blur-sm z-10 gap-1">
          <button
            className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground active:bg-accent"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-white shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border transition-colors ${
              showMobileKPIs ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30' : 'text-muted-foreground active:bg-accent'
            }`}
            onClick={() => setShowMobileKPIs(s => !s)}
            aria-label="Toggle KPIs"
          >
            <BarChart3 size={16} />
          </button>
          <div className="flex-1 min-w-0">{header}</div>
        </header>

        {/* Mobile drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-[1001] w-72 border-r border-border bg-background p-4 shadow-2xl transition-transform duration-300 ease-out ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <span className="font-display text-sm font-bold text-foreground">Menu</span>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          {sidebar}
        </aside>

        {/* KPIs — hidden by default on mobile, toggled via button */}
        {kpiCards && showMobileKPIs && (
          <div className="grid flex-shrink-0 grid-cols-2 gap-2 border-b border-border p-3 bg-background">
            {kpiCards}
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>

        {/* Mobile Footer */}
        <footer className="flex flex-shrink-0 items-center justify-center border-t border-border bg-muted h-8 text-[10px] text-muted-foreground">
          <span>Updated: <time>{formatDate(lastUpdated)}</time></span>
          <span className="mx-2 opacity-30">|</span>
          <span><a href="https://acleddata.com" target="_blank" rel="noreferrer" className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground">ACLED</a></span>
          <span className="mx-2 opacity-30">|</span>
          <a href="https://www.joshuaakintayo.me" target="_blank" rel="noreferrer" className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground transition-colors">
            Joshua Akintayo
          </a>
        </footer>
      </div>

      {/* Dictionary overlay panel */}
      {dictionaryPanel}
    </div>
  )
}
