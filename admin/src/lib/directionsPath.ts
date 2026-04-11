/**
 * Split a path into chunks for Google Directions (waypoint limit per request).
 * Each chunk: [origin, ...waypoints..., destination] with at most `maxIntermediate` waypoints.
 */
export type LatLngLite = { lat: number; lng: number }

const DEFAULT_MAX_INTERMEDIATE = 23

export function splitPathForDirections(
  path: LatLngLite[],
  maxIntermediate = DEFAULT_MAX_INTERMEDIATE,
): LatLngLite[][] {
  if (path.length < 2) return []
  if (path.length === 2) return [[path[0]!, path[1]!]]

  const chunks: LatLngLite[][] = []
  let start = 0
  while (start < path.length - 1) {
    const maxEnd = Math.min(path.length - 1, start + maxIntermediate + 1)
    chunks.push(path.slice(start, maxEnd + 1))
    start = maxEnd
  }
  return chunks
}

/** Promisify DirectionsService.route (single chunk). */
export function fetchDirectionsPathForChunk(
  service: google.maps.DirectionsService,
  chunk: LatLngLite[],
): Promise<{ points: google.maps.LatLngLiteral[]; ok: boolean }> {
  if (chunk.length < 2) return Promise.resolve({ points: [], ok: false })
  const origin = chunk[0]!
  const destination = chunk[chunk.length - 1]!
  const middle = chunk.slice(1, -1)
  const waypoints =
    middle.length > 0
      ? middle.map((p) => ({
          location: { lat: p.lat, lng: p.lng },
          stopover: true,
        }))
      : undefined
  const fallback = chunk.map((p) => ({ lat: p.lat, lng: p.lng }))

  return new Promise((resolve) => {
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result?.routes[0]) {
          resolve({ points: fallback, ok: false })
          return
        }
        const pts = result.routes[0].overview_path?.map((ll) => ll.toJSON()) ?? []
        resolve({
          points: pts.length ? pts : fallback,
          ok: pts.length > 0,
        })
      },
    )
  })
}

export async function fetchFullDirectionsPath(
  service: google.maps.DirectionsService,
  path: LatLngLite[],
): Promise<{ points: google.maps.LatLngLiteral[]; fullyRouted: boolean }> {
  const chunks = splitPathForDirections(path)
  const merged: google.maps.LatLngLiteral[] = []
  let fullyRouted = true
  for (const chunk of chunks) {
    const { points: seg, ok } = await fetchDirectionsPathForChunk(service, chunk)
    if (!ok) fullyRouted = false
    if (merged.length && seg.length) {
      const a = merged[merged.length - 1]!
      const b = seg[0]!
      if (a.lat === b.lat && a.lng === b.lng) seg.shift()
    }
    merged.push(...seg)
  }
  return { points: merged, fullyRouted }
}
