import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, MapPin, Calendar, Skull, Swords } from 'lucide-react'

function getColor(f) {
  if (f >= 20) return '#7f1d1d'
  if (f >= 10) return '#dc2626'
  if (f >= 5) return '#f97316'
  if (f >= 1) return '#eab308'
  return '#22c55e'
}

function getRadius(d) {
  const f = d.fatalities || 0
  const k = d.kidnapped_count || 0
  const s = Math.max(f, Math.ceil(k / 3))
  if (s >= 50) return 20
  if (s >= 20) return 14
  if (s >= 10) return 9
  if (s >= 5) return 6
  if (s >= 1) return 4
  return 1.5
}

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

function findNearest(latlng, pts, threshold) {
  let nearest = null
  let minDist = Infinity
  for (const p of pts) {
    const dx = p.lng - latlng.lng
    const dy = p.lat - latlng.lat
    const dist = dx * dx + dy * dy
    if (dist < minDist) {
      minDist = dist
      nearest = p
    }
  }
  if (nearest && minDist < threshold * threshold) return nearest
  return null
}

export default function LeafletMap({ incidents, theme, onSelectIncident }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerLayerRef = useRef(null)
  const geoLayerRef = useRef(null)
  const pointsRef = useRef([])
  const hoverTimeoutRef = useRef(null)

  const onSelectRef = useRef(onSelectIncident)
  useEffect(() => { onSelectRef.current = onSelectIncident }, [onSelectIncident])

  const [selectedIncident, setSelectedIncident] = useState(null)
  const [hoveredIncident, setHoveredIncident] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const isDark = theme === 'dark'

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    })

    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map)

    const handleMapClick = (e) => {
      const nearest = findNearest(e.latlng, pointsRef.current, 0.1)
      if (nearest) {
        setSelectedIncident(nearest.data)
        if (onSelectRef.current) onSelectRef.current(nearest.data)
      }
    }

    const handleTouchEnd = (e) => {
      if (!e.originalEvent) return
      const touch = e.originalEvent.changedTouches?.[0]
      if (!touch) return
      const latlng = map.containerPointToLatLng([touch.clientX, touch.clientY])
      const nearest = findNearest(latlng, pointsRef.current, 0.08)
      if (nearest) {
        setSelectedIncident(nearest.data)
        setHoveredIncident(null)
        if (onSelectRef.current) onSelectRef.current(nearest.data)
      }
    }

    map.on('click', handleMapClick)
    map.on('touchend', handleTouchEnd)

    requestAnimationFrame(() => {
      map.invalidateSize()
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current)
    }

    const NIGERIA_BOUNDS = L.latLngBounds(L.latLng(3.5, 2.5), L.latLng(14, 15))

    fetch('/data/nigeria-states.geojson')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(gj => {
        const layer = L.geoJSON(gj, {
          style: {
            color: isDark ? '#64748b' : '#94a3b8',
            weight: 0.8,
            fillColor: isDark ? '#1e293b' : '#e2e8f0',
            fillOpacity: 0.25,
          }
        }).addTo(map)
        geoLayerRef.current = layer

        // Mask overlay: dark semi-transparent polygon covering map with Nigeria as hole
        const outerRing = [[-90, -180], [90, -180], [90, 180], [-90, 180], [-90, -180]]
        const holes = []
        gj.features.forEach(f => {
          const geom = f.geometry
          if (geom.type === 'Polygon') {
            holes.push(geom.coordinates[0])
          } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => holes.push(poly[0]))
          }
        })
        if (holes.length) {
          L.polygon([outerRing, ...holes], {
            color: 'transparent',
            fillColor: isDark ? '#000' : '#475569',
            fillOpacity: isDark ? 0.35 : 0.15,
            interactive: false,
            pane: 'overlayPane',
          }).addTo(map)
        }
      })
      .catch(err => console.error('GeoJSON load failed:', err))

    map.setMaxBounds(NIGERIA_BOUNDS.pad(0.2))
  }, [isDark])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (markerLayerRef.current) {
      map.removeLayer(markerLayerRef.current)
    }

    const group = L.featureGroup()
    const pts = []

    incidents.forEach(d => {
      const lat = parseFloat(d.latitude)
      const lng = parseFloat(d.longitude)
      if (!isFinite(lat) || !isFinite(lng)) return

      pts.push({ lat, lng, data: d })

      const r = getRadius(d)
      const c = getColor(d.fatalities)

      L.circleMarker([lat, lng], {
        radius: r,
        fillColor: c,
        color: d.civilian_targeting ? '#ef4444' : c,
        weight: d.civilian_targeting ? 2 : 0.8,
        opacity: 0.7,
        fillOpacity: 0.2,
      }).addTo(group)
    })

    group.addTo(map)
    markerLayerRef.current = group
    pointsRef.current = pts
    
    if (group.getBounds().isValid()) {
      map.fitBounds(group.getBounds(), { padding: [10, 10] })
    }
  }, [incidents, isDark])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    const handleMouseMove = (e) => {
      const pts = pointsRef.current
      if (!pts || !pts.length) return

      const nearest = findNearest(e.latlng, pts, 0.07)

      if (nearest) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        setHoveredIncident(nearest.data)
        setHoverPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY })
      } else {
        hoverTimeoutRef.current = setTimeout(() => {
          setHoveredIncident(null)
        }, 60)
      }
    }

    map.on('mousemove', handleMouseMove)
    map.on('mouseout', () => setHoveredIncident(null))

    return () => {
      map.off('mousemove', handleMouseMove)
      map.off('mouseout')
    }
  }, [])

  const closeDetail = useCallback(() => {
    setSelectedIncident(null)
    if (onSelectIncident) onSelectIncident(null)
  }, [onSelectIncident])

  const bg = isDark ? '#0f172a' : '#f8fafc'

  return (
    <div className="leaflet-map-wrapper" style={{ background: bg }}>
      <div className="map-incident-count" style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000 }}>
        {incidents.length.toLocaleString()} incidents shown
      </div>
      {selectedIncident && (
        <button className="map-detail-close" onClick={closeDetail}
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 1000 }}>
          <X size={14} /> Close
        </button>
      )}
      <div
        ref={containerRef}
        className="leaflet-map-container"
        style={{ width: '100%', height: '100%' }}
      />
      {hoveredIncident && hoveredIncident.event_id_cnty !== selectedIncident?.event_id_cnty && (
        <div className="svg-tooltip" style={{ left: hoverPos.x + 14, top: hoverPos.y - 12, position: 'fixed', zIndex: 10000 }}>
          <div className="svg-tooltip-title">{hoveredIncident.event_type}</div>
          <div className="svg-tooltip-sub">
            <MapPin size={10} /> {hoveredIncident.location}{hoveredIncident.state_clean ? `, ${hoveredIncident.state_clean}` : ''}
          </div>
          <div className="svg-tooltip-row">
            <span><Calendar size={10} /> {hoveredIncident.event_date?.slice(0, 10)}</span>
            <span><Skull size={10} /> {hoveredIncident.fatalities > 0 ? `${formatNum(hoveredIncident.fatalities)} killed` : '0 fatalities'}</span>
            {hoveredIncident.kidnapped_count > 0 && <span>{formatNum(hoveredIncident.kidnapped_count)} kidnapped</span>}
          </div>
          {hoveredIncident.civilian_targeting && <div className="svg-tooltip-civilian">Civilian Targeting</div>}
        </div>
      )}
      {selectedIncident && (
        <div className="svg-detail-panel">
          <div className="svg-detail-header">
            <h4>{selectedIncident.event_type}</h4>
            <button className="svg-detail-x" onClick={closeDetail}><X size={14} /></button>
          </div>
          <div className="svg-detail-body">
            <div className="svg-detail-field">
              <MapPin size={12} />
              <span>{selectedIncident.location}{selectedIncident.state_clean ? `, ${selectedIncident.state_clean}` : ''}{selectedIncident.lga_clean ? ` / ${selectedIncident.lga_clean}` : ''}</span>
            </div>
            <div className="svg-detail-field">
              <Swords size={12} />
              <span>{selectedIncident.actor1 || '-'}</span>
            </div>
            <div className="svg-detail-field">
              <Calendar size={12} />
              <span>{selectedIncident.event_date?.slice(0, 10)} — {selectedIncident.presidential_admin || '-'}</span>
            </div>
            <div className="svg-detail-row">
              <span><Skull size={12} /> <strong>{formatNum(selectedIncident.fatalities)}</strong> fatalities</span>
              {selectedIncident.kidnapped_count > 0 && <span><strong>{formatNum(selectedIncident.kidnapped_count)}</strong> kidnapped</span>}
            </div>
            {selectedIncident.civilian_targeting && <div className="svg-tooltip-civilian">Civilian Targeting</div>}
            {selectedIncident.notes && (
              <div className="svg-detail-notes">
                <p>{selectedIncident.notes}</p>
              </div>
            )}
            <div className="svg-detail-breakdown">
              Combatants: {formatNum(selectedIncident.fatalities_combatants)} &middot;
              Security: {formatNum(selectedIncident.fatalities_security_forces)} &middot;
              Civilians: {formatNum(selectedIncident.fatalities_civilians)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
