/**
 * OpenStreetMap fallback when VITE_GOOGLE_MAPS_API_KEY is unset (Leaflet + OSM tiles).
 */
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  DELIVERY_STATUS_HEX,
  DRIVER_VAN_HEX,
  WAREHOUSE_HEX,
  deliveryStatusLabel,
} from '@/lib/deliveryStatusStyle'
import { formatLatLng } from '@/lib/mapOverview'
import type { Delivery, DriverLocation, WarehouseDepot } from '@/types'

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = defaultIcon

type LatLng = { lat: number; lng: number }

export interface ExtraPolyline {
  key: string
  positions: [number, number][]
  color: string
  weight?: number
  opacity?: number
  dashArray?: string
}

export interface DeliveriesMapOsmProps {
  mapKey: string
  mapCenter: LatLng
  mapZoom: number
  leafletBounds?: [[number, number], [number, number]] | null
  visibleDeliveries: Delivery[]
  visibleDriverLocs: DriverLocation[]
  warehouse?: WarehouseDepot | null
  path: LatLng[]
  extraPolylines?: ExtraPolyline[]
  className: string
}

export function DeliveriesMapOsm({
  mapKey,
  mapCenter,
  mapZoom,
  leafletBounds = null,
  visibleDeliveries,
  visibleDriverLocs,
  warehouse,
  path,
  extraPolylines = [],
  className,
}: DeliveriesMapOsmProps) {
  const fitOverview = leafletBounds != null

  return (
    <div
      className={`flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm ${className}`}
    >
      <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-2 py-1.5 text-center text-[11px] leading-snug text-amber-900">
        <p>
          Preview map (OpenStreetMap). Routes are <strong>straight lines</strong> between stops. Use a Google
          Maps key for the full map; optional{' '}
          <code className="rounded bg-amber-100/80 px-0.5 font-mono text-[10px]">VITE_USE_ROAD_DIRECTIONS=true</code>{' '}
          for road-shaped routes on Google.
        </p>
      </div>
      <div className="relative min-h-[220px] w-full flex-1">
        <MapContainer
          key={mapKey}
          {...(fitOverview
            ? {
                bounds: leafletBounds,
                boundsOptions: { padding: [28, 28] as [number, number] },
              }
            : {
                center: [mapCenter.lat, mapCenter.lng] as [number, number],
                zoom: mapZoom,
              })}
          className="z-0 h-full w-full min-h-[220px]"
          style={{ minHeight: 220 }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {visibleDeliveries
            .filter((d) => d.lat !== 0 || d.lng !== 0)
            .map((d) => (
              <CircleMarker
                key={d.id}
                center={[d.lat, d.lng]}
                radius={9}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: DELIVERY_STATUS_HEX[d.status],
                  fillOpacity: 0.95,
                  opacity: 1,
                }}
              >
                <Popup>
                  <strong>{d.recipientName}</strong>
                  <br />
                  <span className="font-mono text-xs text-slate-600">{formatLatLng(d.lat, d.lng)}</span>
                  <br />
                  <span className="text-xs capitalize text-slate-700">{deliveryStatusLabel(d.status)}</span>
                  {d.sequenceOrder != null ? ` · seq #${d.sequenceOrder}` : ''}
                </Popup>
              </CircleMarker>
            ))}
          {visibleDriverLocs
            .filter((l) => l.lat !== 0 || l.lng !== 0)
            .map((l) => (
              <CircleMarker
                key={l.driverId}
                center={[l.lat, l.lng]}
                radius={8}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: DRIVER_VAN_HEX,
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  Driver (last reported position)
                  <br />
                  <span className="font-mono text-xs text-slate-600">{formatLatLng(l.lat, l.lng)}</span>
                </Popup>
              </CircleMarker>
            ))}
          {warehouse ? (
            <CircleMarker
              key="warehouse-depot"
              center={[warehouse.lat, warehouse.lng]}
              radius={11}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: WAREHOUSE_HEX,
                fillOpacity: 1,
              }}
            >
              <Popup>
                {warehouse.label} (start)
                <br />
                <span className="font-mono text-xs text-slate-600">
                  {formatLatLng(warehouse.lat, warehouse.lng)}
                </span>
              </Popup>
            </CircleMarker>
          ) : null}
          {path.length > 1 ? (
            <Polyline
              positions={path.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color: '#059669',
                weight: 5,
                opacity: 0.88,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          ) : null}
          {extraPolylines.map((pl) => (
            <Polyline
              key={pl.key}
              positions={pl.positions}
              pathOptions={{
                color: pl.color,
                weight: pl.weight ?? 5,
                opacity: pl.opacity ?? 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: pl.dashArray,
              }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
