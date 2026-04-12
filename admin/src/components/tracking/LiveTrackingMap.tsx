import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LiveRouteComponent } from './LiveRouteComponent';
import { SmoothDriverMarker } from './SmoothDriverMarker';
import type { Delivery, DriverLocation, WarehouseDepot } from '@/types';

// Standard icons fallback for Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LiveTrackingMapProps {
  delivery: Delivery;
  driverLocation?: DriverLocation;
  warehouse?: WarehouseDepot | null;
  className?: string;
}

function MapController({ center, follow }: { center: [number, number]; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, follow, map]);
  return null;
}

export function LiveTrackingMap({ delivery, driverLocation, warehouse, className = '' }: LiveTrackingMapProps) {
  const [followDriver, setFollowDriver] = useState(true);
  
  const status = delivery.status === 'completed' ? 'completed' : 'active';
  
  const driverPos = useMemo(() => {
    if (driverLocation) return { lat: driverLocation.lat, lng: driverLocation.lng };
    return warehouse ? { lat: warehouse.lat, lng: warehouse.lng } : { lat: delivery.lat, lng: delivery.lng };
  }, [driverLocation, warehouse, delivery]);

  // Icons for Warehouse and Customer
  const warehouseIcon = L.divIcon({
    className: 'custom-warehouse-icon',
    html: `
      <div class="flex items-center justify-center w-10 h-10 bg-slate-800 rounded-xl shadow-lg border-2 border-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  const customerIcon = L.divIcon({
    className: 'custom-customer-icon',
    html: `
      <div class="flex items-center justify-center w-10 h-10 ${status === 'completed' ? 'bg-slate-400' : 'bg-orange-500'} rounded-full shadow-lg border-2 border-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <div className={`relative group ${className}`}>
      {/* Map UI Overlay */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === 'completed' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`}></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none">Status</p>
            <p className="text-sm font-bold text-slate-900 capitalize leading-tight">
              {delivery.status.replace('_', ' ')}
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => setFollowDriver(!followDriver)}
          className={`px-4 py-2 rounded-xl shadow-lg border text-xs font-bold transition-all flex items-center gap-2 ${
            followDriver 
            ? 'bg-emerald-600 text-white border-emerald-500' 
            : 'bg-white/90 backdrop-blur-md text-slate-700 border-white/20'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          {followDriver ? 'Following Driver' : 'Manual Pan'}
        </button>
      </div>

      <MapContainer
        center={[driverPos.lat, driverPos.lng]}
        zoom={15}
        className="h-full w-full rounded-3xl"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" // Cleaner CartoDB Positron theme
        />
        
        <MapController center={[driverPos.lat, driverPos.lng]} follow={followDriver} />
        
        {warehouse && (
          <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
            <Popup>
              <p className="font-bold">Warehouse</p>
              <p className="text-xs text-slate-500">{warehouse.address}</p>
            </Popup>
          </Marker>
        )}

        <Marker position={[delivery.lat, delivery.lng]} icon={customerIcon}>
          <Popup>
            <p className="font-bold">{delivery.recipientName}</p>
            <p className="text-xs text-slate-500">{delivery.address}</p>
          </Popup>
        </Marker>

        <LiveRouteComponent start={driverPos} end={delivery} status={status} />
        
        <SmoothDriverMarker position={driverPos} status={status} />
      </MapContainer>

      <style dangerouslySetInnerHTML={{ __html: `
        .route-active-glow {
          filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4));
        }
        .leaflet-container {
          background: #f8fafc;
        }
        .custom-warehouse-icon, .custom-customer-icon {
          background: transparent !important;
          border: none !important;
        }
      `}} />
    </div>
  );
}
