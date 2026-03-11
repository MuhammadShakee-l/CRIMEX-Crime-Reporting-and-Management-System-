import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase.js'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import HeatmapLayer from '../../components/HeatmapLayer'
import 'leaflet/dist/leaflet.css'
import {
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  FireIcon,
  MapPinIcon,
  ChartBarIcon,
  GlobeAltIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

/* ───────── haversine distance calculation ───────── */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/* ───────── constants ───────── */

const CATEGORY_COLORS = {
  THEFT:              { bg: '#F59E0B', ring: 'rgba(245,158,11,.3)' },
  ROBBERY:            { bg: '#EF4444', ring: 'rgba(239,68,68,.3)' },
  HARASSMENT:         { bg: '#8B5CF6', ring: 'rgba(139,92,246,.3)' },
  DOMESTIC_VIOLENCE:  { bg: '#EC4899', ring: 'rgba(236,72,153,.3)' },
  FRAUD:              { bg: '#06B6D4', ring: 'rgba(6,182,212,.3)' },
  BURGLARY:           { bg: '#F97316', ring: 'rgba(249,115,22,.3)' },
  ASSAULT:            { bg: '#DC2626', ring: 'rgba(220,38,38,.3)' },
  OTHER:              { bg: '#6B7280', ring: 'rgba(107,114,128,.3)' },
}

const catColor = (cat) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.OTHER

const PUNJAB_CENTER = [31.1704, 72.7097]
const CITY_COORDS = {
  Lahore:       [31.5204, 74.3587],
  Faisalabad:   [31.4504, 73.135],
  Gujranwala:   [32.1877, 74.1945],
  Multan:       [30.1575, 71.5249],
  Sheikhupura:  [31.7167, 73.985],
  Sialkot:      [32.4945, 74.5229],
}

const MAP_TILES = [
  { id: 'street',  label: 'Street',    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                              attr: '&copy; OpenStreetMap' },
  { id: 'sat',     label: 'Satellite',  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri' },
  { id: 'topo',    label: 'Terrain',    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                               attr: '&copy; OpenTopoMap' },
  { id: 'dark',    label: 'Dark',       url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                  attr: '&copy; CARTO' },
]

/* ───────── helpers ───────── */

function getStationId() {
  try {
    const p = JSON.parse(localStorage.getItem('crimex_profile'))
    return p?.station_id || null
  } catch { return null }
}

function getUserRole() {
  return localStorage.getItem('crimex_role') || null
}

/* auto-fit map to data bounds */
function AutoFit({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    const bounds = L.latLngBounds(points.map(p => [p[0], p[1]]))
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 14 })
  }, [map, points])
  return null
}

/* ───────── component ───────── */

const StationHotspot = () => {
  /* ── state ── */
  const [crimeReports, setCrimeReports]     = useState([])
  const [datasetReports, setDatasetReports] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [stationId]             = useState(() => getStationId())
  const [stationName, setStationName] = useState('')
  const [stationCoords, setStationCoords] = useState(null)
  const [userRole]              = useState(() => getUserRole())

  const [selectedCity, setSelectedCity]     = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [viewMode, setViewMode] = useState('both')
  const [tileId, setTileId]     = useState('street')
  const [showFilters, setShowFilters] = useState(true)
  const [maxDistance, setMaxDistance] = useState(15) // km radius filter

  const activeTile = MAP_TILES.find(t => t.id === tileId) || MAP_TILES[0]

  /* ── fetch station name and coordinates ── */
  useEffect(() => {
    if (!stationId) return
    supabase.from('police_stations').select('station_name, city, latitude, longitude, jurisdiction_radius_km').eq('id', stationId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStationName(`${data.station_name}, ${data.city}`)
          setStationCoords({ lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) })
          if (data.jurisdiction_radius_km) setMaxDistance(data.jurisdiction_radius_km)
        }
      })
  }, [stationId])

  /* ── paginated fetch helper (bypasses Supabase 1000-row default limit) ── */
  async function fetchAllRows(table, selectCols, filters = []) {
    const PAGE_SIZE = 1000
    let allData = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      let q = supabase
        .from(table)
        .select(selectCols)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .range(from, from + PAGE_SIZE - 1)

      for (const f of filters) q = q.eq(f.col, f.val)

      const { data, error } = await q
      if (error) throw error

      const rows = data || []
      allData = allData.concat(rows)
      from += PAGE_SIZE
      hasMore = rows.length === PAGE_SIZE
    }
    return allData
  }

  /* ── fetch crime data (always loads both sources) ── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const filters = stationId ? [{ col: 'assigned_station_id', val: stationId }] : []

      const [liveData, datasetData] = await Promise.all([
        fetchAllRows(
          'crime_reports',
          'id, case_number, category, description, city, latitude, longitude, incident_date, status, location_address, assigned_station_id',
          filters
        ),
        fetchAllRows(
          'crime_dataset',
          'id, case_number, category, description, city, latitude, longitude, incident_date, location_address'
        ),
      ])

      setCrimeReports(liveData)
      setDatasetReports(datasetData)
    } catch (e) {
      console.error('Hotspot fetch error:', e)
      setError(typeof e === 'string' ? e : e?.message || 'Failed to load crime data')
    } finally {
      setLoading(false)
    }
  }, [stationId])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── combine + filter ── */
  const allReports = useMemo(() => {
    let combined = [
      ...crimeReports.map(r => ({ ...r, _source: 'Live' })),
      ...datasetReports.map(r => ({ ...r, _source: 'Dataset' })),
    ]
    
    // Filter by distance from station if LEO is assigned to a specific station
    if (stationId && stationCoords && (userRole === 'leo' || userRole === 'law_enforcement_officer')) {
      combined = combined.filter(r => {
        const rLat = parseFloat(r.latitude)
        const rLng = parseFloat(r.longitude)
        if (isNaN(rLat) || isNaN(rLng)) return false
        const distance = haversineDistance(stationCoords.lat, stationCoords.lng, rLat, rLng)
        return distance <= maxDistance
      })
    }
    
    return combined.filter(r => {
      if (selectedCity !== 'all' && r.city !== selectedCity) return false
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false
      if (dateFrom && r.incident_date && new Date(r.incident_date) < new Date(dateFrom)) return false
      if (dateTo   && r.incident_date && new Date(r.incident_date) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [crimeReports, datasetReports, selectedCity, selectedCategory, dateFrom, dateTo, stationId, stationCoords, maxDistance, userRole])

  /* ── heat points ── */
  const heatPoints = useMemo(() =>
    allReports
      .map(r => [parseFloat(r.latitude), parseFloat(r.longitude), 0.8])
      .filter(p => !isNaN(p[0]) && !isNaN(p[1])),
  [allReports])

  /* ── stats ── */
  const stats = useMemo(() => {
    const byCat = {}, byCity = {}, byStatus = {}
    allReports.forEach(r => {
      byCat[r.category] = (byCat[r.category] || 0) + 1
      byCity[r.city]    = (byCity[r.city] || 0) + 1
      if (r.status) byStatus[r.status] = (byStatus[r.status] || 0) + 1
    })
    const topCategory = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
    const topCity     = Object.entries(byCity).sort((a, b) => b[1] - a[1])[0]
    return { total: allReports.length, categories: Object.keys(byCat).length,
      topCategory: topCategory ? `${topCategory[0]} (${topCategory[1]})` : '—',
      topCity:     topCity     ? `${topCity[0]} (${topCity[1]})`         : '—',
      byCat, byCity, byStatus }
  }, [allReports])

  /* ── filter options ── */
  const cities     = useMemo(() => [...new Set([...crimeReports, ...datasetReports].map(r => r.city).filter(Boolean))].sort(), [crimeReports, datasetReports])
  const categories = useMemo(() => [...new Set([...crimeReports, ...datasetReports].map(r => r.category).filter(Boolean))].sort(), [crimeReports, datasetReports])

  /* ── cluster icon builder ── */
  const createClusterIcon = (cluster) => {
    const count = cluster.getChildCount()
    let size = 36, cls = 'bg-greenbrand-primary/90'
    if (count > 50)  { size = 48; cls = 'bg-semantic-danger/90' }
    else if (count > 20) { size = 42; cls = 'bg-semantic-warning/90' }
    return L.divIcon({
      html: `<div class="flex items-center justify-center rounded-full text-white text-xs font-bold shadow-lg ${cls} border-2 border-white/30" style="width:${size}px;height:${size}px;">${count}</div>`,
      className: '',
      iconSize: [size, size],
    })
  }

  /* ───────── render ───────── */
  return (
    <Layout>
      {/* ── Header ── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-semantic-danger/30 to-semantic-warning/20 flex items-center justify-center shadow-soft">
              <FireIcon className="h-6 w-6 text-semantic-danger" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">Crime Hotspot Map</h1>
              <p className="text-xs text-base-muted mt-0.5 flex items-center gap-1.5">
                {stationName ? (
                  <>
                    <ShieldCheckIcon className="h-3.5 w-3.5 text-greenbrand-primary" />
                    <span>Showing cases for <strong className="text-greenbrand-primary">{stationName}</strong></span>
                  </>
                ) : (
                  'Visualize crime density — heatmap, clusters & interactive markers'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(f => !f)} className="btn btn-sm btn-ghost gap-1.5">
              {showFilters ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
            <button onClick={fetchData} className="btn btn-sm btn-ghost gap-1.5" disabled={loading}>
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="card p-4 mb-6 text-sm text-semantic-danger border border-semantic-danger/40 bg-semantic-danger/10 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Incidents', value: stats.total.toLocaleString(), icon: GlobeAltIcon, accent: 'text-greenbrand-primary' },
          { label: 'Categories',      value: stats.categories,             icon: ChartBarIcon,  accent: 'text-semantic-info' },
          { label: 'Top Crime',       value: stats.topCategory,            icon: FireIcon,       accent: 'text-semantic-danger' },
          { label: 'Hottest City',    value: stats.topCity,                icon: MapPinIcon,     accent: 'text-semantic-warning' },
        ].map((s, i) => (
          <div key={i} className="card p-4 flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg bg-base-panelAlt flex items-center justify-center ${s.accent}`}>
              <s.icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-base-muted uppercase tracking-widest">{s.label}</p>
              <p className="text-lg font-display font-bold mt-0.5 truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      {showFilters && (
        <div className="card p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">City</label>
              <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="input input-sm w-full" style={{ color: '#182B25' }}>
                <option value="all">All Cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">Category</label>
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="input input-sm w-full" style={{ color: '#182B25' }}>
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input input-sm w-full" style={{ color: '#182B25' }} />
            </div>
            <div>
              <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input input-sm w-full" style={{ color: '#182B25' }} />
            </div>
            <div>
              <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">View</label>
              <select value={viewMode} onChange={e => setViewMode(e.target.value)} className="input input-sm w-full" style={{ color: '#182B25' }}>
                <option value="heatmap">Heatmap</option>
                <option value="clusters">Clusters</option>
                <option value="both">Heat + Clusters</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-base-muted uppercase tracking-wider mb-1">Map Style</label>
              <select value={tileId} onChange={e => setTileId(e.target.value)} className="input input-sm w-full" style={{ color: '#182B25' }}>
                {MAP_TILES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* city quick-select pills */}
          <div className="flex flex-wrap gap-2">
            {['all', ...Object.keys(CITY_COORDS)].map(city => (
              <button key={city} onClick={() => setSelectedCity(city)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedCity === city
                    ? 'bg-greenbrand-primary text-white shadow-borderGlow'
                    : 'bg-base-panelAlt text-base-muted hover:text-base-text hover:bg-base-panel'
                }`}>
                {city === 'all' ? 'All Punjab' : city}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MAP ── */}
      <div className="card overflow-hidden mb-6 shadow-depth" style={{ minHeight: '560px' }}>
        {loading ? (
          <div className="h-[560px] bg-base-panelAlt flex items-center justify-center">
            <div className="flex items-center gap-3 text-base-muted animate-pulse">
              <ArrowPathIcon className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading crime data…</span>
            </div>
          </div>
        ) : (
          <MapContainer
            key={tileId}
            center={selectedCity !== 'all' && CITY_COORDS[selectedCity] ? CITY_COORDS[selectedCity] : PUNJAB_CENTER}
            zoom={selectedCity !== 'all' ? 12 : 7}
            className="h-[560px] z-0"
            zoomControl={true}
            scrollWheelZoom={true}
          >
            <TileLayer attribution={activeTile.attr} url={activeTile.url} />

            {heatPoints.length > 0 && <AutoFit points={heatPoints} />}

            {/* Heatmap */}
            {(viewMode === 'heatmap' || viewMode === 'both') && heatPoints.length > 0 && (
              <HeatmapLayer points={heatPoints} />
            )}

            {/* Clustered circle markers with HOVER tooltips */}
            {(viewMode === 'clusters' || viewMode === 'both') && (
              <MarkerClusterGroup
                chunkedLoading
                maxClusterRadius={45}
                spiderfyOnMaxZoom
                showCoverageOnHover={false}
                iconCreateFunction={createClusterIcon}
              >
                {allReports.map(r => {
                  const lat = parseFloat(r.latitude)
                  const lng = parseFloat(r.longitude)
                  if (isNaN(lat) || isNaN(lng)) return null
                  const cc = catColor(r.category)
                  return (
                    <CircleMarker
                      key={`${r._source}-${r.id}`}
                      center={[lat, lng]}
                      radius={7}
                      pathOptions={{
                        fillColor: cc.bg,
                        fillOpacity: 0.85,
                        color: '#fff',
                        weight: 1.5,
                      }}
                    >
                      {/* ── HOVER tooltip ── */}
                      <Tooltip
                        direction="top"
                        offset={[0, -8]}
                        opacity={0.95}
                        className="!p-0 !border-0 !shadow-depth !rounded-lg !max-w-xs"
                        sticky={true}
                      >
                        <div className="px-3 py-2 rounded-lg text-xs leading-relaxed break-words overflow-hidden" style={{ background: '#182B25', color: '#E9F7F0', maxWidth: '300px' }}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-sm truncate" style={{ color: cc.bg }}>{r.case_number}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap" style={{ background: cc.bg }}>{r.category?.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="text-[11px] opacity-70 mb-1 truncate">{r.city}{r.location_address ? ` - ${r.location_address.slice(0, 50)}` : ''}</div>
                          {r.incident_date && <div className="text-[11px] opacity-60">{new Date(r.incident_date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</div>}
                          {r.description && <div className="text-[11px] opacity-50 mt-1 line-clamp-2">{r.description.slice(0, 100)}{r.description.length > 100 ? '…' : ''}</div>}
                          <div className="text-[9px] opacity-30 mt-1">{r._source} - Click for details</div>
                        </div>
                      </Tooltip>

                      {/* ── CLICK popup (more detail) ── */}
                      <Popup closeButton={true} maxWidth={320} className="!rounded-lg">
                        <div className="text-xs leading-relaxed" style={{ color: '#1a1a1a', minWidth: 240 }}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-bold text-base">{r.case_number}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: cc.bg }}>{r.category?.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="space-y-1.5 text-[11px]">
                            <p><strong>City:</strong> {r.city}</p>
                            {r.location_address && <p><strong>Address:</strong> {r.location_address.slice(0, 120)}{r.location_address.length > 120 ? '…' : ''}</p>}
                            {r.incident_date && <p><strong>Date:</strong> {new Date(r.incident_date).toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                            {r.status && <p><strong>Status:</strong> <span className="uppercase">{r.status}</span></p>}
                            {r.description && (
                              <div className="mt-2 p-2 rounded bg-gray-50 text-[11px] text-gray-600 leading-snug">
                                {r.description.slice(0, 250)}{r.description.length > 250 ? '…' : ''}
                              </div>
                            )}
                            <p className="text-[9px] text-gray-400 mt-1">Source: {r._source} | Lat: {lat.toFixed(4)}, Lng: {lng.toFixed(4)}</p>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MarkerClusterGroup>
            )}
          </MapContainer>
        )}
      </div>

      {/* ── Breakdown cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* by category */}
        <div className="card p-5">
          <h3 className="text-sm font-display font-semibold flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-4 w-4 text-greenbrand-primary" />
            Incidents by Category
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byCat).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
              const cc = catColor(cat)
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: cc.bg }} />
                      <span className="font-medium">{cat.replace(/_/g, ' ')}</span>
                    </span>
                    <span className="text-base-muted font-mono">{count} <span className="opacity-50">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-base-panelAlt overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cc.bg}, ${cc.bg}dd)` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* by city */}
        <div className="card p-5">
          <h3 className="text-sm font-display font-semibold flex items-center gap-2 mb-4">
            <MapPinIcon className="h-4 w-4 text-greenbrand-primary" />
            Incidents by City
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byCity).sort((a, b) => b[1] - a[1]).map(([city, count]) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={city}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{city}</span>
                    <span className="text-base-muted font-mono">{count} <span className="opacity-50">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-base-panelAlt overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-greenbrand-primary to-greenbrand-light transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="card p-5">
        <h3 className="text-sm font-display font-semibold mb-3">Legend</h3>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {Object.entries(CATEGORY_COLORS).map(([cat, cc]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs text-base-muted">
              <span className="w-3 h-3 rounded-full border border-white/20 shadow-sm" style={{ background: cc.bg }} />
              {cat.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-base-muted">
          <span>Heatmap: </span>
          <span className="flex items-center gap-1">
            <span className="w-24 h-2.5 rounded" style={{ background: 'linear-gradient(to right, #064e3b, #059669, #06C167, #FBBF24, #F97316, #EF4444, #991B1B)' }} />
            <span className="text-[10px]">Low → High</span>
          </span>
          <span className="ml-4">Clusters: </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-greenbrand-primary/90 border border-white/30 inline-flex items-center justify-center text-[8px] text-white font-bold">5</span>
            <span className="w-5 h-5 rounded-full bg-semantic-warning/90 border border-white/30 inline-flex items-center justify-center text-[8px] text-white font-bold">25</span>
            <span className="w-6 h-6 rounded-full bg-semantic-danger/90 border border-white/30 inline-flex items-center justify-center text-[8px] text-white font-bold">50+</span>
          </span>
        </div>
      </div>
    </Layout>
  )
}

export default StationHotspot