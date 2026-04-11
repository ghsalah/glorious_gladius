/**
 * Optional driving route on Google Maps (Directions API). When disabled or on failure, shows the same
 * path as a solid geodesic line (reliable).
 */
import { useEffect, useMemo, useState } from 'react'
import { Polyline, useMapsLibrary } from '@vis.gl/react-google-maps'
import { fetchFullDirectionsPath } from '@/lib/directionsPath'

type LatLng = { lat: number; lng: number }

function pathSignature(path: LatLng[]): string {
  return path.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')
}

export interface RoadRoutePolylineProps {
  path: LatLng[]
  strokeColor: string
  strokeOpacity?: number
  strokeWeight?: number
  patternIndex?: number
}

export function RoadRoutePolyline({
  path,
  strokeColor,
  strokeOpacity = 0.9,
  strokeWeight = 5,
  patternIndex = 0,
}: RoadRoutePolylineProps) {
  const routesLib = useMapsLibrary('routes')
  const sig = useMemo(() => pathSignature(path), [path])
  const [roadPath, setRoadPath] = useState<google.maps.LatLngLiteral[] | null>(null)
  const [fullyRouted, setFullyRouted] = useState(false)

  useEffect(() => {
    if (path.length < 2) {
      setRoadPath(null)
      setFullyRouted(false)
      return
    }
    if (!routesLib) {
      setRoadPath(path.map((p) => ({ lat: p.lat, lng: p.lng })))
      setFullyRouted(false)
      return
    }
    const service = new routesLib.DirectionsService()
    let cancelled = false
    void (async () => {
      try {
        const { points, fullyRouted: ok } = await fetchFullDirectionsPath(service, path)
        if (cancelled) return
        const safe = points.length >= 2 ? points : path.map((p) => ({ lat: p.lat, lng: p.lng }))
        setRoadPath(safe)
        setFullyRouted(ok)
      } catch {
        if (!cancelled) {
          setRoadPath(path.map((p) => ({ lat: p.lat, lng: p.lng })))
          setFullyRouted(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` encodes path coordinates
  }, [routesLib, sig])

  const displayPath = roadPath ?? path.map((p) => ({ lat: p.lat, lng: p.lng }))
  const weight = fullyRouted ? strokeWeight + (patternIndex % 2) : strokeWeight

  if (path.length < 2) return null

  return (
    <Polyline
      key={sig}
      path={displayPath}
      strokeColor={strokeColor}
      strokeOpacity={strokeOpacity}
      strokeWeight={weight}
      geodesic={!fullyRouted}
      zIndex={2 + patternIndex}
    />
  )
}
