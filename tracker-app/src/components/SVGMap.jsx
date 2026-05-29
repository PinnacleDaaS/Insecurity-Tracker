import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { X, MapPin, Skull, Calendar, Swords } from 'lucide-react'

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

export default function SVGMap({ incidents, theme, onSelectIncident }) {
  const svgRef = useRef(null)
  const dotsRef = useRef(null)
  const containerRef = useRef(null)
  const zoomRef = useRef(null)
  const treeRef = useRef(null)

  const [features, setFeatures] = useState([])
  const [geoLoading, setGeoLoading] = useState(true)
  const [geoError, setGeoError] = useState(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [hoveredId, setHoveredId] = useState(null)
  const [hoverPoint, setHoverPoint] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [selectedIncident, setSelectedIncident] = useState(null)

  const isDark = theme === 'dark'

  useEffect(() => {
    setGeoLoading(true)
    setGeoError(null)
    fetch('/data/nigeria-states.geojson')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(gj => { setFeatures(gj.features); setGeoLoading(false) })
      .catch(err => { console.error('GeoJSON load failed:', err); setGeoError(err.message); setGeoLoading(false) })
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width && height) setDims({ w: width, h: height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const projection = useMemo(() => {
    if (!features.length || !dims.w || !dims.h) return null
    return d3.geoMercator().fitSize([dims.w, dims.h], { type: 'FeatureCollection', features })
  }, [features, dims.w, dims.h])

  const pathGen = useMemo(() => {
    if (!projection) return null
    return d3.geoPath().projection(projection)
  }, [projection])

  const points = useMemo(() => {
    if (!projection) return []
    return incidents.map(d => {
      try {
        const p = projection([d.longitude, d.latitude])
        if (!p || !isFinite(p[0]) || !isFinite(p[1])) return null
        return { ...d, cx: p[0], cy: p[1] }
      } catch { return null }
    }).filter(Boolean)
  }, [incidents, projection])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom().scaleExtent([1, 20]).on('zoom', (ev) => {
      svg.select('g.map-group').attr('transform', ev.transform)
    })
    svg.call(zoom)
    zoomRef.current = zoom
    return () => { svg.on('.zoom', null) }
  }, [])

  useEffect(() => {
    if (!dotsRef.current) return
    const g = d3.select(dotsRef.current)
    const dots = g.selectAll('circle').data(points, d => d.event_id_cnty)
    dots.exit().remove()
    const enter = dots.enter().append('circle')
    dots.merge(enter)
      .attr('cx', d => d.cx).attr('cy', d => d.cy)
      .attr('r', d => getRadius(d))
      .attr('fill', d => getColor(d.fatalities))
      .attr('opacity', d => d.is_duplicate ? 0.06 : 0.25)
      .attr('stroke', d => d.civilian_targeting ? '#ef4444' : 'none')
      .attr('stroke-width', d => d.civilian_targeting ? 2 : 0)
      .attr('stroke-opacity', 0.8)

    treeRef.current = d3.quadtree().x(d => d.cx).y(d => d.cy).addAll(points)
  }, [points])

  const handleMouseMove = useCallback((e) => {
    if (!treeRef.current || !svgRef.current) return
    const [mx, my] = d3.pointer(e)
    const nearest = treeRef.current.find(mx, my, isDark ? 10 : 8)
    if (nearest) {
      setHoveredId(nearest.event_id_cnty)
      setHoverPoint(nearest)
      setHoverPos({ x: e.clientX, y: e.clientY })
    } else {
      setHoveredId(null)
      setHoverPoint(null)
    }
  }, [isDark])

  const handleTouchStart = useCallback((e) => {
    if (!treeRef.current || !svgRef.current) return
    const touch = e.changedTouches?.[0]
    if (!touch) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = touch.clientX - rect.left
    const my = touch.clientY - rect.top
    const nearest = treeRef.current.find(mx, my, isDark ? 15 : 12)
    if (nearest) {
      setHoverPoint(nearest)
      if (onSelectIncident) {
        setSelectedIncident(nearest)
        onSelectIncident(nearest)
      }
    }
  }, [isDark, onSelectIncident])

  const handleClick = useCallback(() => {
    if (hoverPoint) {
      setSelectedIncident(hoverPoint)
      if (onSelectIncident) onSelectIncident(hoverPoint)
    } else {
      setSelectedIncident(null)
      if (onSelectIncident) onSelectIncident(null)
    }
  }, [hoverPoint, onSelectIncident])

  const closeDetail = useCallback(() => {
    setSelectedIncident(null)
    if (onSelectIncident) onSelectIncident(null)
  }, [onSelectIncident])

  const stateFill = isDark ? '#1e293b' : '#e2e8f0'
  const stateStroke = isDark ? '#64748b' : '#94a3b8'
  const bg = isDark ? '#0f172a' : '#f8fafc'

  return (
    <div ref={containerRef} className="svg-map-wrapper">
      <div className="svg-map-topbar">
        <span className="map-incident-count">{points.length.toLocaleString()} incidents shown</span>
        {!geoLoading && points.length > 0 && (
          <button className="map-reset-btn" onClick={() => {
            if (svgRef.current && zoomRef.current) {
              d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity)
            }
          }}>Reset Zoom</button>
        )}
        {selectedIncident && (
          <button className="map-detail-close" onClick={closeDetail}>
            <X size={14} /> Close
          </button>
        )}
      </div>

      {geoLoading ? (
        <div className="map-placeholder" style={{ width: dims.w, height: dims.h, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading map...
        </div>
      ) : geoError ? (
        <div className="map-placeholder" style={{ width: dims.w, height: dims.h, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 8 }}>
          <span>Failed to load map data</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{geoError}</span>
        </div>
      ) : (
      <svg ref={svgRef} width={dims.w} height={dims.h} className="svg-map"
        style={{ background: bg, touchAction: 'manipulation' }} onClick={handleClick}
        onMouseMove={handleMouseMove} onMouseLeave={() => { setHoveredId(null); setHoverPoint(null) }}
        onTouchStart={handleTouchStart}>
        <g className="map-group">
          {features.map(f => {
            const d = pathGen?.(f)
            if (!d) return null
            return <path key={f.properties.shapeID || f.properties.shapeName}
              d={d} fill={stateFill} stroke={stateStroke} strokeWidth={0.5} />
          })}
          <g ref={dotsRef} className="incident-dots" />
        </g>
      </svg>
      )}

      {hoverPoint && hoverPoint.event_id_cnty !== selectedIncident?.event_id_cnty && (
        <div className="svg-tooltip" style={{ left: hoverPos.x + 14, top: hoverPos.y - 12 }}>
          <div className="svg-tooltip-title">{hoverPoint.event_type}</div>
          <div className="svg-tooltip-sub">
            <MapPin size={10} /> {hoverPoint.location}{hoverPoint.state_clean ? `, ${hoverPoint.state_clean}` : ''}
          </div>
          <div className="svg-tooltip-row">
            <span><Calendar size={10} /> {hoverPoint.event_date?.slice(0, 10)}</span>
            <span><Skull size={10} /> {hoverPoint.fatalities > 0 ? `${formatNum(hoverPoint.fatalities)} killed` : '0 fatalities'}</span>
          </div>
          {hoverPoint.civilian_targeting && <div className="svg-tooltip-civilian">Civilian Targeting</div>}
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
