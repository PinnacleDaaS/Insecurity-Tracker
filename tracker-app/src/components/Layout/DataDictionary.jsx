import { X, ExternalLink } from 'lucide-react'
import { EVENT_COLORS, FATALITY_SCALE } from '../../constants/colors.js'

const EVENT_TYPES = [
  { name: 'Battles', color: EVENT_COLORS['Battles'], desc: 'Armed clashes between two organized armed groups.' },
  { name: 'Violence against civilians', color: EVENT_COLORS['Violence against civilians'], desc: 'Organized armed groups targeting unarmed non-combatants.' },
  { name: 'Explosions/Remote violence', color: EVENT_COLORS['Explosions/Remote violence'], desc: 'Bombs, IEDs, landmines, artillery, air strikes.' },
  { name: 'Strategic developments', color: EVENT_COLORS['Strategic developments'], desc: 'Non-violent events: peace talks, arrests, looting.' },
  { name: 'Protests', color: EVENT_COLORS.Protests, desc: 'Peaceful demonstrations by three or more people.' },
  { name: 'Riots', color: EVENT_COLORS.Riots, desc: 'Violent demonstrations including property destruction.' },
]

const ACTOR_GROUPS = [
  { name: 'State Forces', desc: 'Police, military, army, soldiers, troops, JTF, vigilante, NSCDC' },
  { name: 'Boko Haram/ISWAP', desc: 'BH, ISWAP, ISWA, JAS, Lakurawa, ISSP — Islamist insurgent groups' },
  { name: 'Bandits & Armed Gangs', desc: 'Criminal gangs, kidnappers, gunmen, armed men, hoodlums' },
  { name: 'Sectarian/Ethnic Militia', desc: 'Fulani, herder militias, Tiv, Berom, Yoruba, Igbo militias' },
  { name: 'Rioters/Protesters', desc: 'Rioters, protesters, students, youths, mobs' },
  { name: 'Civilians', desc: 'Farmers, villagers, residents, commuters, worshippers' },
]

const ZONES = [
  { name: 'North East', states: 'Adamawa, Bauchi, Borno, Gombe, Taraba, Yobe' },
  { name: 'North West', states: 'Jigawa, Kaduna, Kano, Katsina, Kebbi, Sokoto, Zamfara' },
  { name: 'North Central', states: 'Benue, FCT, Kogi, Kwara, Nasarawa, Niger, Plateau' },
  { name: 'South East', states: 'Abia, Anambra, Ebonyi, Enugu, Imo' },
  { name: 'South South', states: 'Akwa Ibom, Bayelsa, Cross River, Delta, Edo, Rivers' },
  { name: 'South West', states: 'Ekiti, Lagos, Ogun, Ondo, Osun, Oyo' },
]

const ADMINISTRATIONS = [
  { name: 'Obasanjo', period: '1999 – 2007 (8 yrs)' },
  { name: "Yar'Adua", period: '2007 – 2010 (2.9 yrs)' },
  { name: 'Jonathan', period: '2010 – 2015 (5.1 yrs)' },
  { name: 'Buhari', period: '2015 – 2023 (8 yrs)' },
  { name: 'Tinubu', period: '2023 – Present' },
]

export default function DataDictionary({ open, onClose }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[2000] bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 z-[2001] h-full w-[380px] max-w-[calc(100vw-3rem)] bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
          <h3 className="font-display font-bold text-sm text-foreground">Data Dictionary</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="h-full overflow-y-auto pb-24">
          <div className="p-4 space-y-5 text-sm text-muted-foreground">

            {/* Event Types */}
            <div>
              <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                Event Types
              </h4>
              {EVENT_TYPES.map(et => (
                <div key={et.name} className="flex gap-2 py-1.5 items-start">
                  <span className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: et.color }} />
                  <div>
                    <span className="font-semibold text-foreground">{et.name}</span>
                    <p className="text-xs mt-0.5">{et.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Fatality Scale */}
            <div>
              <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Fatality Scale
              </h4>
              <p className="text-xs mb-2">Map markers are sized by the larger of fatalities or half of kidnapped count (√value × 0.6 + 1). Color reflects fatality count. The <strong className="text-foreground">Fatality rate / incident</strong> KPI shows the average fatalities per event for the current filter period, with a yearly sparkline trend.</p>
              {FATALITY_SCALE.map(fs => (
                <div key={fs.label} className="flex items-center gap-2.5 py-1">
                  <span className={`w-3 h-3 rounded-full ${fs.fill} ${fs.glow ? 'shadow-[0_0_6px_rgba(127,29,29,0.6)]' : ''}`} />
                  <span className="text-xs text-muted-foreground">{fs.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2.5 py-1 mt-1">
                <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-500" />
                <span className="text-xs text-muted-foreground">Red border = civilian targeting incident</span>
              </div>
            </div>

            {/* Actor Groups */}
            <div>
              <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Actor Groups
              </h4>
              {ACTOR_GROUPS.map(ag => (
                <div key={ag.name} className="py-1">
                  <span className="font-semibold text-foreground">{ag.name}</span>
                  <p className="text-xs mt-0.5">{ag.desc}</p>
                </div>
              ))}
            </div>

            {/* Geopolitical Zones */}
            <div>
              <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Geopolitical Zones
              </h4>
              {ZONES.map(z => (
                <div key={z.name} className="py-1">
                  <span className="font-semibold text-foreground">{z.name}</span>
                  <p className="text-xs mt-0.5 text-muted-foreground">{z.states}</p>
                </div>
              ))}
            </div>

            {/* Presidential Administrations */}
            <div>
              <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Presidential Administrations
              </h4>
              {ADMINISTRATIONS.map(a => (
                <div key={a.name} className="flex items-center justify-between py-1">
                  <span className="font-semibold text-foreground">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.period}</span>
                </div>
              ))}
            </div>

            {/* Analytics & Charts */}
            <div>
              <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                Analytics & Charts
              </h4>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-foreground text-xs">Incident & Fatality Timeline</span>
                  <p className="text-xs">Monthly/yearly counts of incidents and fatalities with period drill-down (by year, quarter, or month).</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">Event Type Breakdown</span>
                  <p className="text-xs">Horizontal bar chart showing the distribution of incidents across the six ACLED event types.</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">Top States by Fatalities</span>
                  <p className="text-xs">Ranked bar chart of the ten states with the highest total fatalities in the current filter period.</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">Activity Feed</span>
                  <p className="text-xs">Numbered list of the top 10 incidents by combined casualties, shown in the right-side panel. Click any row for full detail view with notes, actor info, and fatality breakdown.</p>
                </div>

                <div>
                  <span className="font-semibold text-foreground text-xs">Seasonal Conflict Pattern</span>
                  <p className="text-xs">Heatmap of event counts by month across all years. Each cell intensity represents the concentration of conflict events in that month-year, normalized against the global maximum.</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">Fatality Breakdown by Zone</span>
                  <p className="text-xs">Horizontal stacked bar chart showing combatant, security forces, and civilian fatalities for each geopolitical zone. Hover for exact breakdown values.</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">KPI Deltas</span>
                  <p className="text-xs">When a presidential administration filter is active, each KPI card shows a percentage change (↑/↓) versus the previous administration. Fatality rate shows the absolute difference.</p>
                </div>
              </div>
            </div>

            {/* Data Sources & Methodology */}
            <div>
              <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                About the Data
              </h4>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-foreground text-xs">Source</span>
                  <p className="text-xs">Armed Conflict Location & Event Data Project (<a href="https://acleddata.com" target="_blank" rel="noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline">ACLED <ExternalLink size={10} className="inline" /></a>)</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">Coverage</span>
                  <p className="text-xs">Nigeria, January 1999 – May 2026</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">Scope</span>
                  <p className="text-xs">Political violence and protest data across all 36 Nigerian states and the Federal Capital Territory. The map displays state boundaries, state/LGA labels, and LGA boundaries at higher zoom levels for geographic context.</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">Deduplication</span>
                  <p className="text-xs">Near-identical incidents from multiple sources are detected via Jaccard similarity on same-date notes and flagged as duplicates. Flagged incidents are excluded from all counts.</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs">NLP Extraction</span>
                  <p className="text-xs">Kidnap counts, fatality breakdowns (combatants, security forces, civilians), and target categories are extracted from incident notes using pattern matching and keyword classification.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
