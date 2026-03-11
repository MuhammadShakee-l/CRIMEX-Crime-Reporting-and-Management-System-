import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

/**
 * React-leaflet wrapper around leaflet.heat.
 * Re-renders when points or options change.
 */
const HeatmapLayer = ({ points, options = {} }) => {
  const map = useMap()

  useEffect(() => {
    if (!points || points.length === 0) return

    const heat = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 16,
      max: 1.0,
      minOpacity: 0.35,
      gradient: {
        0.1: '#064e3b',
        0.25: '#059669',
        0.45: '#06C167',
        0.6: '#FBBF24',
        0.75: '#F97316',
        0.9: '#EF4444',
        1.0: '#991B1B',
      },
      ...options,
    })

    heat.addTo(map)
    return () => map.removeLayer(heat)
  }, [map, points, options])

  return null
}

export default HeatmapLayer
