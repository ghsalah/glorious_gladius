/**
 * Dispatch heuristic:
 * 1) **Angular wedges** from the warehouse: unassigned stops are sorted by bearing, rotated at the
 *    largest empty gap, then split into contiguous arcs — each driver gets one geographic “slice” so
 *    vans are not interleaved on the same corridors (unlike farthest-first + load balancing).
 * 2) **Match** each wedge to a driver by score = distance(wedge centroid, effective depot) +
 *    a small penalty for drivers who already carry many open stops.
 * 3) **Refine** by moving single stops when total open-path km from the warehouse drops, load skew
 *    stays within bounds, and the move does not pull a stop far from the receiving van’s territory.
 * 4) **Order** each driver’s list with **greedy + 2-opt** from the warehouse.
 */
import { openPathLengthKm, optimizeStopOrderFromDepot } from '@/lib/routePreview'
import type { Delivery, Driver, DriverLocation } from '@/types'

function euclidKmApprox(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = (a.lat - b.lat) * 111
  const dy = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

/** Reference point for “which driver is closest” when a van has no live GPS yet. */
function depotForDriver(
  driver: Driver,
  locByDriver: Map<string, { lat: number; lng: number }>,
  warehouse: { lat: number; lng: number },
  driverIndex: number,
): { lat: number; lng: number } {
  const hit = locByDriver.get(driver.id)
  if (hit) return hit
  const k = driverIndex + 1
  return {
    lat: warehouse.lat + Math.sin(k * 1.4) * 0.02,
    lng: warehouse.lng + Math.cos(k * 1.1) * 0.02,
  }
}

function centroidOfDeliveries(stops: Delivery[], fallback: { lat: number; lng: number }) {
  if (!stops.length) return fallback
  let sLat = 0
  let sLng = 0
  for (const d of stops) {
    sLat += d.lat
    sLng += d.lng
  }
  const n = stops.length
  return { lat: sLat / n, lng: sLng / n }
}

/**
 * Bearing from warehouse (radians), stable for sorting around the depot.
 * Uses Δlng / Δlat like `Math.atan2` for a monotonic angle around the depot.
 */
function bearingFromWarehouse(d: Delivery, warehouse: { lat: number; lng: number }) {
  return Math.atan2(d.lng - warehouse.lng, d.lat - warehouse.lat)
}

/**
 * Sort by angle and rotate so the largest angular gap (sparse direction) sits between the end and
 * start of the list — each driver wedge stays one contiguous occupied arc on the map.
 */
function orderStopsAroundWarehouse(unassigned: Delivery[], warehouse: { lat: number; lng: number }) {
  const n = unassigned.length
  if (n <= 1) return [...unassigned]

  const tagged = unassigned.map((d) => ({ d, ang: bearingFromWarehouse(d, warehouse) }))
  tagged.sort((a, b) => a.ang - b.ang)

  let maxGap = -1
  let start = 0
  for (let i = 0; i < n; i++) {
    const a = tagged[i]!.ang
    const b = i + 1 < n ? tagged[i + 1]!.ang : tagged[0]!.ang + 2 * Math.PI
    const gap = b - a
    if (gap > maxGap) {
      maxGap = gap
      start = (i + 1) % n
    }
  }
  return [...tagged.slice(start), ...tagged.slice(0, start)].map((x) => x.d)
}

/** Split `items` into `m` consecutive chunks; sizes differ by at most one. */
function splitIntoBalancedChunks<T>(items: T[], m: number): T[][] {
  if (m <= 0) return []
  if (m === 1) return [items]
  const n = items.length
  const base = Math.floor(n / m)
  const rem = n % m
  const out: T[][] = []
  let i = 0
  for (let k = 0; k < m; k++) {
    const sz = base + (k < rem ? 1 : 0)
    out.push(items.slice(i, i + sz))
    i += sz
  }
  return out
}

/** Tie-break for equal matching scores (deterministic). */
function isBetterMatch(
  score: number,
  rowIdx: number,
  drId: string,
  bestScore: number,
  bestRowIdx: number,
  bestDrId: string,
): boolean {
  if (score < bestScore) return true
  if (score > bestScore) return false
  if (drId < bestDrId) return true
  if (drId > bestDrId) return false
  return rowIdx < bestRowIdx
}

/**
 * One-to-one: each wedge (contiguous arc of stops) goes to the driver with the best
 * geography + existing-load score. Greedy global minimum each round is fine for typical fleet sizes.
 */
function assignWedgesToNearestDrivers(
  wedges: Delivery[][],
  activeDrivers: Driver[],
  locByDriver: Map<string, { lat: number; lng: number }>,
  warehouse: { lat: number; lng: number },
  currentOpenLoadByDriver: ReadonlyMap<string, number>,
): Map<string, Delivery[]> {
  const byDriver = new Map<string, Delivery[]>()
  for (const dr of activeDrivers) {
    byDriver.set(dr.id, [])
  }

  const m = activeDrivers.length
  type Row = { idx: number; stops: Delivery[]; centroid: { lat: number; lng: number } }
  const rows: Row[] = wedges.map((stops, idx) => ({
    idx,
    stops,
    centroid: centroidOfDeliveries(stops, warehouse),
  }))

  const usedWedge = new Set<number>()
  const usedDriver = new Set<string>()

  const LOAD_PENALTY_KM = 3.5

  for (let round = 0; round < m; round++) {
    let bestScore = Number.POSITIVE_INFINITY
    let bestRow: Row | null = null
    let bestDriver: Driver | null = null

    for (const row of rows) {
      if (usedWedge.has(row.idx)) continue
      for (let di = 0; di < activeDrivers.length; di++) {
        const dr = activeDrivers[di]!
        if (usedDriver.has(dr.id)) continue
        const depot = depotForDriver(dr, locByDriver, warehouse, di)
        const distKm = row.stops.length ? euclidKmApprox(row.centroid, depot) : 0
        const openLoad = currentOpenLoadByDriver.get(dr.id) ?? 0
        const score = distKm + LOAD_PENALTY_KM * openLoad
        if (
          bestRow == null ||
          bestDriver == null ||
          isBetterMatch(score, row.idx, dr.id, bestScore, bestRow.idx, bestDriver.id)
        ) {
          bestScore = score
          bestRow = row
          bestDriver = dr
        }
      }
    }

    if (bestRow && bestDriver) {
      usedWedge.add(bestRow.idx)
      usedDriver.add(bestDriver.id)
      byDriver.set(bestDriver.id, bestRow.stops)
    }
  }

  return byDriver
}

function maxLoadSkew(byDriver: Map<string, Delivery[]>, driverIds: string[]): number {
  if (driverIds.length < 2) return 0
  const counts = driverIds.map((id) => (byDriver.get(id) ?? []).length)
  return Math.max(...counts) - Math.min(...counts)
}

/** Extra km slack when comparing stop to receiving vs sending cluster — blocks two vans sharing one corridor. */
const REFINE_GEO_SLACK_KM = 2.5

/**
 * Try moving stops between drivers to reduce **sum of optimized route lengths** from the warehouse,
 * while strictly respecting geographic clusters.
 */
function refineAssignmentByTotalKm(
  byDriver: Map<string, Delivery[]>,
  activeDrivers: Driver[],
  warehouse: { lat: number; lng: number },
  totalNewStops: number,
): void {
  const driverIds = activeDrivers.map((d) => d.id)
  const m = activeDrivers.length
  if (m < 2 || totalNewStops < 2) return

  const maxSkew = Math.max(4, Math.ceil(totalNewStops / m) + 3)

  refine: while (true) {
    let improved = false
    for (const drA of activeDrivers) {
      const listA = byDriver.get(drA.id) ?? []
      if (!listA.length) continue

      const optA = optimizeStopOrderFromDepot(warehouse, listA)
      const costA = openPathLengthKm(warehouse, optA)

      for (let idx = 0; idx < listA.length; idx++) {
        const d = listA[idx]!
        const listAEx = listA.filter((x) => x.id !== d.id)

        for (const drB of activeDrivers) {
          if (drB.id === drA.id) continue
          const listB = byDriver.get(drB.id) ?? []
          const nextB = [...listB, d]

          // 1. Geography check: Is this stop ridiculously far from Driver B's current cluster compared to A's?
          const centroidAEx = centroidOfDeliveries(listAEx, warehouse)
          const centroidB = centroidOfDeliveries(listB, warehouse)
          const distToOldCluster = euclidKmApprox(d, centroidAEx)
          const distToRecvCluster = euclidKmApprox(d, centroidB)

          // Strict cluster check: don't move across the city
          if (listB.length > 0 && distToRecvCluster > distToOldCluster + REFINE_GEO_SLACK_KM) {
            continue
          }

          // 2. Efficiency check: Does it reduce total optimized km?
          const optAEx = optimizeStopOrderFromDepot(warehouse, listAEx)
          const optBNext = optimizeStopOrderFromDepot(warehouse, nextB)

          const costB = openPathLengthKm(warehouse, optimizeStopOrderFromDepot(warehouse, listB))
          const costAfter = openPathLengthKm(warehouse, optAEx) + openPathLengthKm(warehouse, optBNext)
          const costBefore = costA + costB

          if (costAfter >= costBefore - 1e-4) continue

          // 3. Load balance check
          byDriver.set(drA.id, listAEx)
          byDriver.set(drB.id, nextB)
          if (maxLoadSkew(byDriver, driverIds) > maxSkew) {
            byDriver.set(drA.id, listA)
            byDriver.set(drB.id, listB)
            continue
          }

          improved = true
          continue refine
        }
      }
    }
    if (!improved) break refine
  }
}

export interface RouteAssignmentStep {
  deliveryId: string
  driverId: string
  sequenceOrder: number
}

/**
 * Builds assign + sequence steps for all unassigned deliveries.
 *
 * Assignment: **angular wedges** from the warehouse + scored matching to drivers (see module doc).
 * Refinement: optional swaps that lower total km without breaking light geographic cohesion.
 * Ordering: **greedy + 2-opt** open path from the warehouse per driver.
 */
export function buildAutoRoutePlan(
  unassignedRaw: Delivery[],
  activeDrivers: Driver[],
  driverLocations: DriverLocation[],
  warehouse: { lat: number; lng: number },
  currentOpenLoadByDriver: ReadonlyMap<string, number>,
): RouteAssignmentStep[] {
  const unassigned = unassignedRaw.filter(
    (d) =>
      Number.isFinite(d.lat) &&
      Number.isFinite(d.lng) &&
      (d.lat !== 0 || d.lng !== 0),
  )
  if (!unassigned.length || !activeDrivers.length) return []

  const locByDriver = new Map<string, { lat: number; lng: number }>()
  for (const l of driverLocations) {
    locByDriver.set(l.driverId, { lat: l.lat, lng: l.lng })
  }

  const byDriver = new Map<string, Delivery[]>()
  for (const dr of activeDrivers) {
    byDriver.set(dr.id, [])
  }

  const orderedAround = orderStopsAroundWarehouse(unassigned, warehouse)
  const wedgeSlices = splitIntoBalancedChunks(orderedAround, activeDrivers.length)
  const assigned = assignWedgesToNearestDrivers(
    wedgeSlices,
    activeDrivers,
    locByDriver,
    warehouse,
    currentOpenLoadByDriver,
  )
  for (const dr of activeDrivers) {
    byDriver.set(dr.id, assigned.get(dr.id) ?? [])
  }

  const sorted = [...unassigned].sort((a, b) => {
    const da = euclidKmApprox(a, warehouse)
    const db = euclidKmApprox(b, warehouse)
    return db - da
  })
  refineAssignmentByTotalKm(byDriver, activeDrivers, warehouse, sorted.length)

  const steps: RouteAssignmentStep[] = []
  for (let i = 0; i < activeDrivers.length; i++) {
    const dr = activeDrivers[i]!
    const group = byDriver.get(dr.id) ?? []
    if (!group.length) continue
    const ordered = optimizeStopOrderFromDepot(warehouse, group)
    ordered.forEach((del, idx) => {
      steps.push({
        deliveryId: del.id,
        driverId: dr.id,
        sequenceOrder: idx + 1,
      })
    })
  }

  return steps
}
