/**
 * Google Map: delivery pins, driver vans, optional warehouse marker.
 * - Overview mode (no `onlyDriverId`): markers only — no route lines (unless `showGreedyRoutesPerDriver`).
 * - Per-driver mode (`onlyDriverId`): that van, their stops, warehouse, and one greedy route from the depot.
 * Delivery markers use colors by status: pending / in_progress / completed.
 * With `VITE_GOOGLE_MAPS_API_KEY`: Google Maps (Maps JavaScript API in Google Cloud).
 * Without it: OpenStreetMap preview via Leaflet (same pins / route behavior).
 *
 * Overview mode centers / fits on every delivery coordinate (plus vans and warehouse), not only the depot.
 */
import { useEffect, useMemo } from 'react'
import { APIProvider, Map as GoogleMap, Marker, Polyline, useMap } from '@vis.gl/react-google-maps'
import { RoadRoutePolyline } from '@/components/RoadRoutePolyline'
import type { Delivery, DriverLocation, WarehouseDepot } from '@/types'
import { optimizeStopOrderFromDepot } from '@/lib/routePreview'
import { DeliveriesMapOsm } from '@/components/DeliveriesMapOsm'
import {
  DRIVER_VAN_HEX,
  ROUTE_PREVIEW_PALETTE,
  WAREHOUSE_HEX,
  googleCircleMarkerSymbol,
  googleSymbolForDeliveryStatus,
} from '@/lib/deliveryStatusStyle'
import {
  centroidOfPoints,
  collectOverviewPoints,
  formatLatLng,
  isDegeneratePointSet,
  leafletBoundsFromPoints,
} from '@/lib/mapOverview'

const defaultCenter = { lat: 52.3676, lng: 4.9041 }

type LatLng = { lat: number; lng: number }

function centroidOfStops(stops: Delivery[]): LatLng {
  if (!stops.length) return defaultCenter
  let sLat = 0
  let sLng = 0
  for (const d of stops) {
    sLat += d.lat
    sLng += d.lng
  }
  const n = stops.length
  return { lat: sLat / n, lng: sLng / n }
}

/** Fits the Google map to all overview points (deliveries, drivers, warehouse). */
function MapFitOverview({
  points,
  pointsKey,
}: {
  points: { lat: number; lng: number }[]
  pointsKey: string
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || points.length === 0) return
    const gm = google.maps
    if (!gm?.LatLngBounds) return

    if (isDegeneratePointSet(points)) {
      const c = centroidOfPoints(points)
      if (c) {
        map.setCenter(c)
        map.setZoom(14)
      }
      return
    }

    const bounds = new gm.LatLngBounds()
    for (const p of points) bounds.extend(p)
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
  }, [map, points, pointsKey])

  return null
}

interface DeliveriesMapProps {
  deliveries: Delivery[]
  driverLocations: DriverLocation[]
  /**
   * When set, map is scoped to this driver: their stops, van, warehouse, and a greedy route.
   * Omit for overview maps (pins only).
   */
  onlyDriverId?: string | null
  warehouse?: WarehouseDepot | null
  className?: string
  /**
   * Overview only: depot → stops path per driver (same order as auto-assign; Google draws along roads when Directions is enabled).
   */
  showGreedyRoutesPerDriver?: boolean
}

export function DeliveriesMap({
  deliveries,
  driverLocations,
  onlyDriverId,
  warehouse,
  className = '',
  showGreedyRoutesPerDriver = false,
}: DeliveriesMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID
  /** Off by default: Directions needs extra API + billing; straight geodesic routes always render. */
  const useRoadDirections = import.meta.env.VITE_USE_ROAD_DIRECTIONS === 'true'

  const visibleDeliveries = useMemo(() => {
    if (!onlyDriverId) return deliveries
    return deliveries.filter((d) => d.assignedDriverId === onlyDriverId)
  }, [deliveries, onlyDriverId])

  const visibleDriverLocs = useMemo(() => {
    if (!onlyDriverId) return driverLocations
    return driverLocations.filter((l) => l.driverId === onlyDriverId)
  }, [driverLocations, onlyDriverId])

  const routeStart = useMemo(
    () => (warehouse ? { lat: warehouse.lat, lng: warehouse.lng } : defaultCenter),
    [warehouse],
  )

  const path = useMemo(() => {
    if (!onlyDriverId || !warehouse) return [] as LatLng[]
    const loc = visibleDriverLocs[0]
    // If we have a driver location, start there. Otherwise start from warehouse.
    const startPos = loc ? { lat: loc.lat, lng: loc.lng } : { lat: warehouse.lat, lng: warehouse.lng }
    
    // Filter for deliveries that are NOT completed yet for route planning
    const openDeliveries = visibleDeliveries.filter(d => d.status !== 'completed')
    if (!openDeliveries.length) return [] as LatLng[]
    
    const ordered = optimizeStopOrderFromDepot(startPos, openDeliveries)
    if (!ordered.length) return [] as LatLng[]
    
    const pts: LatLng[] = [startPos]
    ordered.forEach((d) => pts.push({ lat: d.lat, lng: d.lng }))
    return pts.length > 1 ? pts : []
  }, [onlyDriverId, visibleDriverLocs, visibleDeliveries, warehouse])

  const perDriverPaths = useMemo(() => {
    if (!showGreedyRoutesPerDriver || onlyDriverId || !warehouse) return [] as { key: string; path: LatLng[]; color: string }[]
    const routeStart = { lat: warehouse.lat, lng: warehouse.lng }
    const byDriver = new Map<string, Delivery[]>()
    for (const d of deliveries) {
      if (!d.assignedDriverId || d.status === 'completed') continue
      const list = byDriver.get(d.assignedDriverId) ?? []
      list.push(d)
      byDriver.set(d.assignedDriverId, list)
    }
    let idx = 0
    const out: { key: string; path: LatLng[]; color: string }[] = []
    for (const [driverId, stops] of byDriver) {
      const ordered = optimizeStopOrderFromDepot(routeStart, stops)
      if (!ordered.length) continue
      const pts: LatLng[] = [routeStart]
      ordered.forEach((d) => pts.push({ lat: d.lat, lng: d.lng }))
      if (pts.length < 2) continue
      out.push({
        key: driverId,
        path: pts,
        color: ROUTE_PREVIEW_PALETTE[idx % ROUTE_PREVIEW_PALETTE.length]!,
      })
      idx += 1
    }
    return out
  }, [showGreedyRoutesPerDriver, onlyDriverId, warehouse, deliveries])

  const extraPolylinesForOsm = useMemo(
    () =>
      perDriverPaths.map((p, idx) => ({
        key: p.key,
        positions: p.path.map((x) => [x.lat, x.lng] as [number, number]),
        color: p.color,
        weight: 4 as const,
        opacity: 0.82 as const,
      })),
    [perDriverPaths],
  )

  const overviewPoints = useMemo(() => {
    if (onlyDriverId) return []
    return collectOverviewPoints(visibleDeliveries, visibleDriverLocs, warehouse)
  }, [onlyDriverId, visibleDeliveries, visibleDriverLocs, warehouse])

  const overviewPointsKey = useMemo(
    () =>
      [
        ...visibleDeliveries.map((d) => `${d.id}:${d.lat},${d.lng}:${d.status}`),
        ...visibleDriverLocs.map((l) => `${l.driverId}:${l.lat},${l.lng}`),
        warehouse ? `w:${warehouse.lat},${warehouse.lng}` : 'w:',
      ].join('|'),
    [visibleDeliveries, visibleDriverLocs, warehouse],
  )

  const leafletBounds = useMemo(
    () => (!onlyDriverId ? leafletBoundsFromPoints(overviewPoints) : null),
    [onlyDriverId, overviewPoints],
  )

  const mapCenter = useMemo(() => {
    if (onlyDriverId) {
      const loc = visibleDriverLocs[0]
      if (visibleDeliveries.length) {
        const c = centroidOfStops(visibleDeliveries)
        if (loc) {
          return {
            lat: (c.lat + loc.lat) / 2,
            lng: (c.lng + loc.lng) / 2,
          }
        }
        return c
      }
      if (loc) return { lat: loc.lat, lng: loc.lng }
      return routeStart
    }
    const c = centroidOfPoints(overviewPoints)
    return c ?? routeStart
  }, [onlyDriverId, visibleDeliveries, visibleDriverLocs, routeStart, overviewPoints])

  const mapZoom = useMemo(() => {
    if (onlyDriverId) return visibleDeliveries.length > 4 ? 8 : 9
    if (overviewPoints.length === 0) return 11
    if (isDegeneratePointSet(overviewPoints)) return 14
    return 11
  }, [onlyDriverId, visibleDeliveries.length, overviewPoints])

  const mapKey = onlyDriverId
    ? `driver-${onlyDriverId}`
    : showGreedyRoutesPerDriver
      ? `assign-${perDriverPaths.map((p) => p.key).join('-')}-${overviewPointsKey.slice(0, 80)}`
      : warehouse
        ? `fleet-${warehouse.lat}-${warehouse.lng}`
        : 'fleet'

  if (!apiKey) {
    return (
      <DeliveriesMapOsm
        mapKey={mapKey}
        mapCenter={mapCenter}
        mapZoom={mapZoom}
        leafletBounds={leafletBounds}
        visibleDeliveries={visibleDeliveries}
        visibleDriverLocs={visibleDriverLocs}
        warehouse={warehouse}
        path={path}
        extraPolylines={extraPolylinesForOsm}
        className={className}
      />
    )
  }

  const mapProps = mapId ? ({ mapId } as const) : ({} as Record<string, never>)

  const showFitOverview = !onlyDriverId && overviewPoints.length > 0

  return (
    <div
      className={`flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm ${className}`}
    >
      <APIProvider apiKey={apiKey} {...(useRoadDirections ? { libraries: ['routes'] as const } : {})}>
        <GoogleMap
          key={mapKey}
          defaultCenter={mapCenter}
          defaultZoom={mapZoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="h-full w-full min-h-[300px]"
          style={{ width: '100%', height: '100%', minHeight: 300 }}
          {...mapProps}
        >
          {showFitOverview ? (
            <MapFitOverview points={overviewPoints} pointsKey={overviewPointsKey} />
          ) : null}
          {visibleDeliveries
            .filter((d) => d.lat !== 0 || d.lng !== 0)
            .map((d) => (
              <Marker
                key={d.id}
                position={{ lat: d.lat, lng: d.lng }}
                icon={googleSymbolForDeliveryStatus(d.status)}
                title={`${d.recipientName} — ${formatLatLng(d.lat, d.lng)} — ${d.status.replace('_', ' ')}${d.sequenceOrder != null ? ` (#${d.sequenceOrder})` : ''}`}
              />
            ))}
          {visibleDriverLocs
            .filter((l) => l.lat !== 0 || l.lng !== 0)
            .map((l) => (
              <Marker
                key={l.driverId}
                position={{ lat: l.lat, lng: l.lng }}
                icon={googleCircleMarkerSymbol(DRIVER_VAN_HEX, { scale: 8 })}
                title={`Driver — ${formatLatLng(l.lat, l.lng)}`}
              />
            ))}
          {warehouse ? (
            <Marker
              key="warehouse-depot"
              position={{ lat: warehouse.lat, lng: warehouse.lng }}
              icon={googleCircleMarkerSymbol(WAREHOUSE_HEX, { scale: 11 })}
              title={`${warehouse.label} (start) — ${formatLatLng(warehouse.lat, warehouse.lng)}`}
            />
          ) : null}
          {path.length > 1 ? (
            useRoadDirections ? (
              <RoadRoutePolyline
                path={path}
                strokeColor="#059669"
                strokeOpacity={0.92}
                strokeWeight={5}
                patternIndex={0}
              />
            ) : (
              <Polyline
                path={path}
                strokeColor="#059669"
                strokeOpacity={0.92}
                strokeWeight={5}
                geodesic
                zIndex={2}
              />
            )
          ) : null}
          {perDriverPaths.map((pl, idx) =>
            useRoadDirections ? (
              <RoadRoutePolyline
                key={`route-${pl.key}`}
                path={pl.path}
                strokeColor={pl.color}
                strokeOpacity={0.9}
                strokeWeight={5}
                patternIndex={idx + 1}
              />
            ) : (
              <Polyline
                key={`route-${pl.key}`}
                path={pl.path}
                strokeColor={pl.color}
                strokeOpacity={0.9}
                strokeWeight={5}
                geodesic
                zIndex={3 + idx}
              />
            ),
          )}
        </GoogleMap>
      </APIProvider>
    </div>
  )
}
