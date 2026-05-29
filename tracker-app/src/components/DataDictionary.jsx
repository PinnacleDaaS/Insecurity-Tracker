import { X, BookOpen, ExternalLink, Shield, Crosshair, Swords, Users, Skull } from 'lucide-react'

const EVENT_TYPES = [
  { name: 'Battles', color: '#dc2626', desc: 'Armed clashes between two organized armed groups. Includes government forces vs rebels, militia clashes, and territorial battles.' },
  { name: 'Violence against civilians', color: '#f97316', desc: 'Organized armed groups targeting unarmed non-combatants. Includes attacks, abductions, and sexual violence.' },
  { name: 'Explosions/Remote violence', color: '#eab308', desc: 'Bombs, IEDs, landmines, artillery shelling, air/drone strikes, suicide bombs, and grenade attacks.' },
  { name: 'Strategic developments', color: '#22c55e', desc: 'Non-violent but significant events: peace talks, arrests, base establishments, looting, agreements, and territorial transfers.' },
  { name: 'Protests', color: '#3b82f6', desc: 'Peaceful public demonstrations by three or more people advocating for a shared cause.' },
  { name: 'Riots', color: '#a855f7', desc: 'Violent demonstrations or mob violence including property destruction, physical fights, and clashes.' },
]

const ACTOR_GROUPS = [
  { name: 'State Forces', icon: Shield, desc: 'Police, military, army, soldiers, troops, JTF, CJTF, vigilante, NSCDC' },
  { name: 'Boko Haram/ISWAP', icon: Crosshair, desc: 'Boko Haram (BH), ISWAP, ISWA, JAS — Islamist insurgent groups' },
  { name: 'Bandits & Armed Gangs', icon: Swords, desc: 'Criminal gangs, kidnappers, gunmen, armed men, hoodlums' },
  { name: 'Sectarian/Ethnic Militia', icon: Crosshair, desc: 'Fulani, herder militias, Mambilla, Tiv, Berom, Yoruba, Hausa militias' },
  { name: 'Civilians', icon: Users, desc: 'Farmers, villagers, residents, commuters, worshippers' },
  { name: 'Rioters/Protesters', icon: Users, desc: 'Students, youth, mob, protester groups' },
]

const FATALITY_LEGEND = [
  { label: '0 fatalities', color: '#22c55e', r: 2 },
  { label: '1–4 fatalities', color: '#eab308', r: 4 },
  { label: '5–9 fatalities', color: '#f97316', r: 7 },
  { label: '10–19 fatalities', color: '#dc2626', r: 10 },
  { label: '20+ fatalities', color: '#7f1d1d', r: 14 },
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
  { name: 'Obasanjo', period: '1999–2007' },
  { name: "Yar'Adua", period: '2007–2010' },
  { name: 'Jonathan', period: '2010–2015' },
  { name: 'Buhari', period: '2015–2023' },
  { name: 'Tinubu', period: '2023–present' },
]

export default function DataDictionary({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <>
      <div className="dict-overlay" onClick={onClose} />
      <div className="dict-panel">
        <div className="dict-header">
          <BookOpen size={18} />
          <h3>Data Dictionary</h3>
          <button className="dict-close" onClick={onClose} title="Close"><X size={16} /></button>
        </div>

        <div className="dict-body">
          <section className="dict-section">
            <h4>Event Types</h4>
            <p className="dict-section-desc">ACLED categorizes events into 6 types. Colors on the map match each category.</p>
            <div className="dict-event-list">
              {EVENT_TYPES.map(et => (
                <div key={et.name} className="dict-event-item">
                  <span className="dict-color-dot" style={{ background: et.color }} />
                  <div>
                    <strong>{et.name}</strong>
                    <p>{et.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="dict-section">
            <h4>Actor Groups</h4>
            <p className="dict-section-desc">Every incident is tagged with an actor category. Helps identify who is behind the violence.</p>
            <div className="dict-actor-list">
              {ACTOR_GROUPS.map(ag => {
                const Icon = ag.icon
                return (
                  <div key={ag.name} className="dict-actor-item">
                    <span className="dict-actor-badge"><Icon size={13} /> {ag.name}</span>
                    <p>{ag.desc}</p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="dict-section">
            <h4><Skull size={14} /> Fatality Levels</h4>
            <p className="dict-section-desc">Dot size and color indicate severity. Large-scale kidnappings also increase dot size.</p>
            <div className="dict-legend-list">
              {FATALITY_LEGEND.map(f => (
                <div key={f.label} className="dict-legend-item">
                  <svg width="28" height="28" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r={f.r} fill={f.color} opacity="0.6" stroke={f.color} strokeWidth="1" />
                  </svg>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dict-section">
            <h4>Civilian Targeting</h4>
            <p className="dict-section-desc">Incidents where civilians were the primary target.</p>
            <p>Marked with a <span className="dict-civ-badge" style={{ verticalAlign: 'middle' }}>Civilian Targeting</span> badge and a red ring on map markers. Includes violence by state forces, rebels, militias, and other armed groups against unarmed non-combatants.</p>
          </section>

          <section className="dict-section">
            <h4>Geopolitical Zones</h4>
            <p className="dict-section-desc">Nigeria's 36 states + FCT grouped into 6 geopolitical zones.</p>
            <div className="dict-zone-grid">
              {ZONES.map(z => (
                <div key={z.name}><strong>{z.name}:</strong> {z.states}</div>
              ))}
            </div>
          </section>

          <section className="dict-section">
            <h4>Presidential Administrations</h4>
            <p className="dict-section-desc">Events tagged by the administration in power at the time.</p>
            <ul className="dict-admin-list">
              {ADMINISTRATIONS.map(a => (
                <li key={a.name}><strong>{a.name}</strong> ({a.period})</li>
              ))}
            </ul>
          </section>

          <section className="dict-section">
            <h4>About the Data</h4>
            <p><strong>Source:</strong> Armed Conflict Location & Event Data Project (<a href="https://acleddata.com" target="_blank" rel="noopener">ACLED <ExternalLink size={10} /></a>)</p>
            <p><strong>Coverage:</strong> Nigeria, 1999 – 2026</p>
            <p><strong>Events tracked:</strong> Political violence, demonstrations, and strategic developments across all 37 states + FCT.</p>
            <p><strong>Deduplication:</strong> Near-identical incidents from multiple sources are flagged and excluded from counts.</p>
            <p><strong>Methodology:</strong> Data collected from local, national, and international sources across 75+ languages. Fatalities are the lowest reported estimate. Civilian targeting flagged when civilians are the primary target.</p>
          </section>
        </div>
      </div>
    </>
  )
}
