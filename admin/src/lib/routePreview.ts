/**
 * Client-side route preview: greedy nearest-neighbor from the depot, then **2-opt** to shorten the
 * open path (warehouse → stops, no return leg). Uses the same km metric as auto-assign.
 * Replace with Distance Matrix + VRP on the backend for production.
 */
import type { Delivery } from '@/types'

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = a.lat - b.lat
  const dy = a.lng - b.lng
  return Math.hypot(dx, dy)
}

/** Haversine-style flat-earth km. */
export function euclidKmApprox(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  if (
    !Number.isFinite(a.lat) ||
    !Number.isFinite(a.lng) ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng)
  ) {
    return 1e9 // Large penalty for invalid coords
  }
  const dx = (a.lat - b.lat) * 111
  const dy = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

/** Returns delivery IDs in visit order (not persisted — visual aid only). */
export function greedyOrderStops(
  deliveries: Delivery[],
  start: { lat: number; lng: number },
): Delivery[] {
  const pending = deliveries.filter(
    (d) =>
      d.status !== 'completed' &&
      Number.isFinite(d.lat) &&
      Number.isFinite(d.lng) &&
      (d.lat !== 0 || d.lng !== 0),
  )
  const ordered: Delivery[] = []
  let current = { ...start }
  while (pending.length) {
    let bestI = 0
    let bestD = Number.POSITIVE_INFINITY
    pending.forEach((d, i) => {
      const d0 = euclidKmApprox(current, d)
      if (d0 < bestD) {
        bestD = d0
        bestI = i
      }
    })
    const [next] = pending.splice(bestI, 1)
    if (next) {
      ordered.push(next)
      current = { lat: next.lat, lng: next.lng }
    }
  }
  return ordered
}

/** Total km along warehouse → each stop in order (open path). */
export function openPathLengthKm(
  warehouse: { lat: number; lng: number },
  ordered: Delivery[],
): number {
  if (!ordered.length) return 0
  const pts = [warehouse, ...ordered.map((d) => ({ lat: d.lat, lng: d.lng }))]
  let s = 0
  for (let k = 0; k < pts.length - 1; k++) s += euclidKmApprox(pts[k]!, pts[k + 1]!)
  return s
}

/**
 * Greedy tour from `start`, then **2-opt** on the open path to reduce total travel km (local optimum).
 * For open paths from a fixed depot, we check:
 * 1. Standard 2-opt swaps (middle segment reversals).
 * 2. Tail reversals (reversing everything from some point to the end).
 */
export function optimizeStopOrderFromDepot(
  start: { lat: number; lng: number },
  deliveries: Delivery[],
): Delivery[] {
  let order = greedyOrderStops(deliveries, start)
  const n = order.length
  if (n <= 1) return order

  let improved = true
  while (improved) {
    improved = false
    const pts: { lat: number; lng: number }[] = [start, ...order.map((d) => ({ lat: d.lat, lng: d.lng }))]
    const m = pts.length // m = n + 1

    // 1. Standard internal 2-opt swaps
    // Swaps edge (i-1, i) and (j, j+1) for (i-1, j) and (i, j+1)
    scan: for (let i = 1; i < m - 2; i++) {
      for (let j = i + 1; j < m - 1; j++) {
        const delta =
          euclidKmApprox(pts[i - 1]!, pts[j]!) +
          euclidKmApprox(pts[i]!, pts[j + 1]!) -
          euclidKmApprox(pts[i - 1]!, pts[i]!) -
          euclidKmApprox(pts[j]!, pts[j + 1]!)
        if (delta < -1e-6) {
          const i0 = i - 1
          const j0 = j - 1
          const rev = order.slice(i0, j0 + 1).reverse()
          order = [...order.slice(0, i0), ...rev, ...order.slice(j0 + 1)]
          improved = true
          break scan
        }
      }
    }

    if (improved) continue

    // 2. Tail reversals (since the end point is not fixed)
    // Replaces edge (i-1, i) with (i-1, last) and reverses the tail
    for (let i = 1; i < m - 1; i++) {
      const delta = euclidKmApprox(pts[i - 1]!, pts[m - 1]!) - euclidKmApprox(pts[i - 1]!, pts[i]!)
      if (delta < -1e-6) {
        const i0 = i - 1
        const rev = order.slice(i0).reverse()
        order = [...order.slice(0, i0), ...rev]
        improved = true
        break
      }
    }
  }
  return order
}
