import { useState, useCallback, useRef, useEffect, useId, useMemo } from 'react'
import { Map, useMap, MapControls } from '@/components/ui/map'
import { HoverTooltip, DetailPanel } from './MapTooltip.jsx'
import { X } from 'lucide-react'
import bbox from '@turf/bbox'

let geoJsonCache = null
let lgaGeoJsonCache = null

const LEGEND_ITEMS = [
  { label: '1-4 fatalities', color: '#eab308', r: 3 },
  { label: '5-19 fatalities', color: '#f97316', r: 4 },
  { label: '20-99 fatalities', color: '#dc2626', r: 7 },
  { label: '100+ fatalities', color: '#7f1d1d', r: 10 },
]

const NIGERIA_BOUNDS = [2.5, 3.5, 14.5, 14]

const darkMapStyle = {
  version: 8,
  name: 'Dark',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
    { id: 'carto-tiles', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.6 } },
  ],
}

const lightMapStyle = {
  version: 8,
  name: 'Light',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f8fafc' } },
    { id: 'carto-tiles', type: 'raster', source: 'carto', paint: { 'raster-opacity': 1 } },
  ],
}

function buildFilterExpr(filters) {
  const conds = []
  if (filters.state && filters.state !== 'All')
    conds.push(['==', ['get', 'state_clean'], filters.state])
  if (filters.eventType && filters.eventType !== 'All')
    conds.push(['==', ['get', 'event_type'], filters.eventType])
  if (filters.year && filters.year !== 'All')
    conds.push(['==', ['get', 'year'], parseInt(filters.year)])
  if (filters.civilianTargeting === 'Civilian Targeting')
    conds.push(['==', ['get', 'civilian_targeting'], true])
  if (filters.civilianTargeting === 'Non-Civilian Targeting')
    conds.push(['==', ['get', 'civilian_targeting'], false])
  if (filters.geopoliticalZone && filters.geopoliticalZone !== 'All')
    conds.push(['==', ['get', 'geopolitical_zone'], filters.geopoliticalZone])
  if (filters.administration && filters.administration !== 'All')
    conds.push(['==', ['get', 'presidential_admin'], filters.administration])
  if (filters.dateRange?.[0])
    conds.push(['>=', ['get', 'event_date'], filters.dateRange[0]])
  if (filters.dateRange?.[1])
    conds.push(['<=', ['get', 'event_date'], filters.dateRange[1]])
  if (filters.victimType && filters.victimType !== 'All') {
    const col = filters.victimType === 'Civilians' ? 'fatalities_civilians' : filters.victimType === 'Security Forces' ? 'fatalities_security_forces' : 'fatalities_combatants'
    conds.push(['>', ['get', col], 0])
  }
  return conds.length ? ['all', ...conds] : null
}

function MapLayers({ allIncidents, onPointClick, onHover, onHoverEnd, isDark, filters }) {
  const { map, isLoaded } = useMap()
  const id = useId()
  const incSourceId = `inc-${id}`
  const incLayerId = `inc-pt-${id}`
  const stateSourceId = `state-${id}`
  const stateFillId = `state-fill-${id}`
  const stateLineId = `state-line-${id}`
  const stateLabelId = `state-label-${id}`
  const stateOuterId = `state-outer-${id}`
  const lgaSourceId = `lga-${id}`
  const lgaLineId = `lga-line-${id}`
  const lgaLabelId = `lga-label-${id}`

  const onPointClickRef = useRef(onPointClick)
  onPointClickRef.current = onPointClick
  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover
  const onHoverEndRef = useRef(onHoverEnd)
  onHoverEndRef.current = onHoverEnd
  const lastMoveRef = useRef(0)

  const initialFitDoneRef = useRef(false)
  const prevStateActiveRef = useRef(false)
  const prevZoneActiveRef = useRef(false)

  const geojson = useMemo(() => ({
    type: 'FeatureCollection',
    features: allIncidents.map(inc => ({
      type: 'Feature',
      properties: {
        event_id_cnty: inc.event_id_cnty,
        fatalities: inc.fatalities || 0,
        fatalities_civilians: inc.fatalities_civilians || 0,
        fatalities_combatants: inc.fatalities_combatants || 0,
        fatalities_security_forces: inc.fatalities_security_forces || 0,
        kidnapped_count: inc.kidnapped_count || 0,
        civilian_targeting: inc.civilian_targeting || false,
        state_clean: inc.state_clean,
        event_type: inc.event_type,
        event_date: inc.event_date,
        geopolitical_zone: inc.geopolitical_zone,
        presidential_admin: inc.presidential_admin,
        year: inc.year,
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(inc.longitude), Number(inc.latitude)],
      },
    })),
  }), [allIncidents])

  useEffect(() => {
    if (!map || !isLoaded) return
    let cancelled = false

    const loadGeo = () => {
      if (geoJsonCache) return Promise.resolve(geoJsonCache)
      return fetch('/data/nigeria-states.geojson')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(gj => { geoJsonCache = gj; return gj })
    }

    loadGeo().then(gj => {
      if (cancelled) return

      map.addSource(stateSourceId, { type: 'geojson', data: gj })

      map.addLayer({
        id: stateFillId, type: 'fill', source: stateSourceId,
        paint: { 'fill-color': isDark ? '#1e293b' : '#e2e8f0', 'fill-opacity': 0.2 },
      })

      map.addLayer({
        id: stateLineId, type: 'line', source: stateSourceId,
        paint: { 'line-color': isDark ? '#334155' : '#cbd5e1', 'line-width': 0.8, 'line-opacity': 0.6 },
      })

      map.addLayer({
        id: stateLabelId, type: 'symbol', source: stateSourceId,
        layout: {
          'text-field': ['get', 'shapeName'],
          'text-size': ['step', ['zoom'], 10, 5, 11, 8, 13],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, 0.5],
          'text-anchor': 'center',
        },
        paint: {
          'text-color': isDark ? '#cbd5e1' : '#1e293b',
          'text-halo-color': isDark ? '#020617' : '#ffffff',
          'text-halo-width': 2,
          'text-halo-blur': 1,
          'text-opacity': 1,
        },
      })

      // Load LGA boundaries
      const loadLga = () => {
        if (lgaGeoJsonCache) return Promise.resolve(lgaGeoJsonCache)
        return fetch('/data/nigeria-lga-boundaries.geojson')
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
          .then(gj => { lgaGeoJsonCache = gj; return gj })
      }

      loadLga().then(lgaGj => {
        if (cancelled) return

        map.addSource(lgaSourceId, { type: 'geojson', data: lgaGj })

        map.addLayer({
          id: lgaLineId, type: 'line', source: lgaSourceId,
          minzoom: 9,
          paint: {
            'line-color': isDark ? '#1e293b' : '#cbd5e1',
            'line-width': 0.5,
            'line-opacity': isDark ? 0.3 : 0.4,
          },
        }, incLayerId)

        map.addLayer({
          id: lgaLabelId, type: 'symbol', source: lgaSourceId,
          minzoom: 10,
          layout: {
            'text-field': ['get', 'admin2Name'],
            'text-size': 9,
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-offset': [0, 0.3],
            'text-anchor': 'center',
          },
          paint: {
            'text-color': isDark ? '#cbd5e1' : '#1e293b',
            'text-halo-color': isDark ? '#020617' : '#ffffff',
            'text-halo-width': 1.5,
            'text-halo-blur': 0.5,
            'text-opacity': 1,
          },
        }, incLayerId)
      }).catch(err => console.warn('LGA GeoJSON load failed:', err))

      const outerRing = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]
      const holes = []
      gj.features.forEach(f => {
        const geom = f.geometry
        if (geom.type === 'Polygon') holes.push(geom.coordinates[0])
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => holes.push(poly[0]))
      })
      if (holes.length) {
        map.addSource(stateOuterId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outerRing, ...holes] } },
        })
        map.addLayer({
          id: stateOuterId, type: 'fill', source: stateOuterId,
          paint: { 'fill-color': isDark ? '#000000' : '#475569', 'fill-opacity': isDark ? 0.35 : 0.12 },
        },
        stateLabelId)
      }

      if (cancelled) return

      map.addSource(incSourceId, { type: 'geojson', data: geojson })

      map.addLayer({
        id: incLayerId, type: 'circle', source: incSourceId,
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'civilian_targeting'], false],
            '#e11d48',
            ['step', ['get', 'fatalities'], '#eab308', 5, '#f97316', 20, '#dc2626', 100, '#7f1d1d'],
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'fatalities'],
            0, 3, 5, 3.5, 20, 5, 100, 8, 350, 13,
          ],
          'circle-stroke-width': 0.8,
          'circle-stroke-color': isDark ? '#1e293b' : '#ffffff',
          'circle-opacity': 0.9,
        },
      })

      const handlePointClick = (e) => {
        if (!e.features?.length) return
        onPointClickRef.current(e.features[0].properties)
      }

      const handleMouseEnter = () => { map.getCanvas().style.cursor = 'pointer' }
      const handlePointLeave = () => {
        map.getCanvas().style.cursor = ''
        onHoverEndRef.current()
      }
      const handlePointMove = (e) => {
        if (!e.features?.length) return
        const now = Date.now()
        if (now - lastMoveRef.current < 50) return
        lastMoveRef.current = now
        onHoverRef.current(e.features[0].properties, {
          x: e.originalEvent.clientX, y: e.originalEvent.clientY,
        })
      }

      map.on('click', incLayerId, handlePointClick)
      map.on('mouseenter', incLayerId, handleMouseEnter)
      map.on('mouseleave', incLayerId, handlePointLeave)
      map.on('mousemove', incLayerId, handlePointMove)

      // Apply current filter after rebuild (survives theme toggle)
      const filterExpr = buildFilterExpr(filters)
      map.setFilter(incLayerId, filterExpr)
    }).catch(err => console.error('Layer setup failed:', err))

    return () => {
      cancelled = true
      try {
        [lgaLabelId, lgaLineId, lgaSourceId, incLayerId, incSourceId, stateOuterId, stateLabelId, stateLineId, stateFillId, stateSourceId].forEach(lid => {
          try { if (map.getLayer(lid)) map.removeLayer(lid) } catch { }
        })
        const sources = [lgaSourceId, incSourceId, stateOuterId, stateSourceId]
        sources.forEach(sid => {
          try { if (map.getSource(sid)) map.removeSource(sid) } catch { }
        })
      } catch { }
    }
  }, [map, isLoaded])

  useEffect(() => {
    if (!map || !isLoaded) return
    const expr = buildFilterExpr(filters)
    if (map.getLayer(incLayerId)) {
      map.setFilter(incLayerId, expr)
    }
  }, [map, isLoaded, filters])

  useEffect(() => {
    if (!map || !isLoaded) return
    const source = map.getSource(incSourceId)
    if (source) source.setData(geojson)
  }, [map, isLoaded, geojson, incSourceId])

  useEffect(() => {
    if (!map || !isLoaded) return
    const stateActive = filters?.state && filters.state !== 'All'
    const zoneActive = filters?.geopoliticalZone && filters.geopoliticalZone !== 'All'
    const wasActive = prevStateActiveRef.current || prevZoneActiveRef.current
    const nowActive = stateActive || zoneActive

    prevStateActiveRef.current = stateActive
    prevZoneActiveRef.current = zoneActive

    if (nowActive) {
      const subset = allIncidents.filter(inc =>
        (!stateActive || inc.state_clean === filters.state) &&
        (!zoneActive || inc.geopolitical_zone === filters.geopoliticalZone)
      )
      if (!subset.length) return
      const subsetGeojson = {
        type: 'FeatureCollection',
        features: subset.map(inc => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(inc.longitude), Number(inc.latitude)] },
        })),
      }
      const [minLng, minLat, maxLng, maxLat] = bbox(subsetGeojson)
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 80, duration: 1200, maxZoom: 10, essential: true }
      )
    } else if (wasActive && !nowActive) {
      map.fitBounds(NIGERIA_BOUNDS, { padding: 40, duration: 1000, maxZoom: 6.5, essential: true })
    } else if (!initialFitDoneRef.current) {
      map.fitBounds(NIGERIA_BOUNDS, { padding: 40, duration: 1000, maxZoom: 6.5, essential: true })
      initialFitDoneRef.current = true
    }
  }, [map, isLoaded, filters?.state, filters?.geopoliticalZone, filters?.administration, filters?.dateRange, allIncidents])

  useEffect(() => {
    if (!map || !isLoaded) return
    try {
      if (map.getLayer(stateFillId)) {
        map.setPaintProperty(stateFillId, 'fill-color', isDark ? '#1e293b' : '#e2e8f0')
        map.setPaintProperty(stateFillId, 'fill-opacity', 0.2)
      }
      if (map.getLayer(stateLineId)) {
        map.setPaintProperty(stateLineId, 'line-color', isDark ? '#334155' : '#cbd5e1')
        map.setPaintProperty(stateLineId, 'line-opacity', 0.6)
      }
      if (map.getLayer(stateLabelId)) {
        map.setPaintProperty(stateLabelId, 'text-color', isDark ? '#cbd5e1' : '#1e293b')
        map.setPaintProperty(stateLabelId, 'text-halo-color', isDark ? '#020617' : '#ffffff')
        map.setPaintProperty(stateLabelId, 'text-opacity', 0.9)
      }
      if (map.getLayer(stateOuterId)) {
        map.setPaintProperty(stateOuterId, 'fill-color', isDark ? '#000000' : '#475569')
        map.setPaintProperty(stateOuterId, 'fill-opacity', isDark ? 0.35 : 0.12)
      }
      if (map.getLayer(incLayerId)) {
        map.setPaintProperty(incLayerId, 'circle-stroke-color', isDark ? '#1e293b' : '#ffffff')
      }
      if (map.getLayer(lgaLineId)) {
        map.setPaintProperty(lgaLineId, 'line-color', isDark ? '#1e293b' : '#cbd5e1')
        map.setPaintProperty(lgaLineId, 'line-opacity', isDark ? 0.3 : 0.4)
      }
      if (map.getLayer(lgaLabelId)) {
        map.setPaintProperty(lgaLabelId, 'text-color', isDark ? '#cbd5e1' : '#1e293b')
        map.setPaintProperty(lgaLabelId, 'text-halo-color', isDark ? '#020617' : '#ffffff')
        map.setPaintProperty(lgaLabelId, 'text-opacity', 0.85)
      }
    } catch { }
  }, [isDark, map, isLoaded])

  return null
}

export default function ConflictMap({ allIncidents, theme, onSelectIncident, filters }) {
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [hoveredIncident, setHoveredIncident] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [legendOpen, setLegendOpen] = useState(true)

  const closeDetail = useCallback(() => {
    setSelectedIncident(null)
    if (onSelectIncident) onSelectIncident(null)
  }, [onSelectIncident])

  const handlePointClick = useCallback((props) => {
    const full = allIncidents.find(i => i.event_id_cnty === props.event_id_cnty) ?? props
    setSelectedIncident(full)
    if (onSelectIncident) onSelectIncident(full)
  }, [allIncidents, onSelectIncident])

  const handleHover = useCallback((incident, pos) => {
    setHoveredIncident(incident)
    if (pos) setHoverPos(pos)
  }, [])

  const handleHoverEnd = useCallback(() => {
    setHoveredIncident(null)
  }, [])

  const isDark = theme === 'dark'
  const bg = isDark ? '#000000' : '#f8fafc'

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: bg }}>
      <Map theme={theme} styles={{ dark: darkMapStyle, light: lightMapStyle }} className="w-full h-full" backgroundColor={bg}>
        <MapLayers
          allIncidents={allIncidents}
          onPointClick={handlePointClick}
          onHover={handleHover}
          onHoverEnd={handleHoverEnd}
          isDark={isDark}
          filters={filters}
        />
        <MapControls position="bottom-right" showZoom showCompass />
      </Map>

      <div className="absolute bottom-2 left-2 z-[1000]">
        <button
          onClick={() => setLegendOpen(l => !l)}
          className="bg-background/80 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground shadow-sm transition-colors"
        >
          {legendOpen ? 'Legend ▾' : 'Legend ▸'}
        </button>
        {legendOpen && (
          <div className="mt-1 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-2.5 shadow-xl min-w-[160px] space-y-1.5">
            {LEGEND_ITEMS.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0 border border-border" style={{ background: item.color }} />
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-red-500 bg-red-500/20" />
              <span className="text-[11px] text-muted-foreground">Civilian targeting</span>
            </div>
          </div>
        )}
      </div>

      {selectedIncident && (
        <button
          onClick={closeDetail}
          className="hidden lg:flex absolute top-2 right-2 z-[1000] bg-background/80 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground shadow-sm transition-colors"
        >
          Close
        </button>
      )}

      {hoveredIncident && hoveredIncident.event_id_cnty !== selectedIncident?.event_id_cnty && (
        <HoverTooltip incident={hoveredIncident} position={hoverPos} />
      )}

      {selectedIncident && (
        <>
          <div className="hidden lg:block absolute top-10 right-3 w-[320px] max-h-[calc(100%-70px)] overflow-y-auto z-[1000]">
            <DetailPanel incident={selectedIncident} onClose={closeDetail} />
          </div>
          <div className="lg:hidden fixed inset-0 z-[3000] flex flex-col bg-background animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted flex-shrink-0">
              <h4 className="font-display font-bold text-sm text-foreground truncate">
                {selectedIncident.event_type}
              </h4>
              <button
                onClick={closeDetail}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground active:bg-accent"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DetailPanel incident={selectedIncident} onClose={closeDetail} mobile />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
