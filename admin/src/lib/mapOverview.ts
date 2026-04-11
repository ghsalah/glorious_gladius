/** Helpers to center / fit the fleet overview map on delivery coordinates. */

export type MapPoint = { lat: number; lng: number }

export function collectOverviewPoints(
  deliveries: MapPoint[],
  driverLocs: MapPoint[],
  warehouse: MapPoint | null | undefined,
): MapPoint[] {
  const out: MapPoint[] = []
  for (const d of deliveries) {
    if (Number.isFinite(d.lat) && Number.isFinite(d.lng)) out.push({ lat: d.lat, lng: d.lng })
  }
  for (const l of driverLocs) {
    if (Number.isFinite(l.lat) && Number.isFinite(l.lng)) out.push({ lat: l.lat, lng: l.lng })
  }
  if (warehouse && Number.isFinite(warehouse.lat) && Number.isFinite(warehouse.lng)) {
    out.push({ lat: warehouse.lat, lng: warehouse.lng })
  }
  return out
}

export function centroidOfPoints(pts: MapPoint[]): MapPoint | null {
  if (!pts.length) return null
  let sLat = 0
  let sLng = 0
  for (const p of pts) {
    sLat += p.lat
    sLng += p.lng
  }
  const n = pts.length
  return { lat: sLat / n, lng: sLng / n }
}

/** True when every point is the same (or nearly), so bounds fitting would collapse. */
export function isDegeneratePointSet(pts: MapPoint[]): boolean {
  if (pts.length < 2) return true
  let minLat = pts[0].lat
  let maxLat = pts[0].lat
  let minLng = pts[0].lng
  let maxLng = pts[0].lng
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  }
  return maxLat - minLat < 1e-7 && maxLng - minLng < 1e-7
}

/** Leaflet `bounds` prop: [[south, west], [north, east]]; null if use center+zoom instead. */
export function leafletBoundsFromPoints(pts: MapPoint[]): [[number, number], [number, number]] | null {
  if (!pts.length || isDegeneratePointSet(pts)) return null
  let minLat = pts[0].lat
  let maxLat = pts[0].lat
  let minLng = pts[0].lng
  let maxLng = pts[0].lng
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  }
  const latSpan = Math.max(maxLat - minLat, 1e-6)
  const lngSpan = Math.max(maxLng - minLng, 1e-6)
  const padLat = Math.max(latSpan * 0.12, 0.002)
  const padLng = Math.max(lngSpan * 0.12, 0.002)
  return [
    [minLat - padLat, minLng - padLng],
    [maxLat + padLat, maxLng + padLng],
  ]
}

export function formatLatLng(lat: number, lng: number, decimals = 5): string {
  return `${lat.toFixed(decimals)}, ${lng.toFixed(decimals)}`
}
