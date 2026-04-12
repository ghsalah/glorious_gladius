import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SmoothDriverMarker } from './SmoothDriverMarker';
import type { Delivery, DriverLocation, WarehouseDepot } from '@/types';

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

interface IntelligentRouteMapProps {
  driverDeliveries: Delivery[];
  driverLocation?: DriverLocation;
  warehouse: WarehouseDepot | null;
  activeDeliveryId?: string;
  className?: string;
}

function MapController({ center, follow }: { center: [number, number]; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, follow, map]);
  return null;
}

/**
 * Component to fetch and display a multi-stop route.
 */
function RoutePath({ 
  waypoints, 
  color, 
  dashed = false, 
  bold = false,
  glow = false 
}: { 
  waypoints: { lat: number, lng: number }[], 
  color: string, 
  dashed?: boolean, 
  bold?: boolean,
  glow?: boolean
}) {
  const [path, setPath] = useState<[number, number][]>([]);

  useEffect(() => {
    if (waypoints.length < 2) {
      setPath([]);
      return;
    }

    if (!GEOAPIFY_API_KEY) return;

    let active = true;
    const fetchRoute = async () => {
      try {
        const waypointsStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
        const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsStr}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.features && data.features.length > 0 && active) {
          const coords: [number, number][] = [];
          const geometry = data.features[0].geometry;
          
          if (geometry.type === 'LineString') {
            geometry.coordinates.forEach((pt: number[]) => coords.push([pt[1], pt[0]]));
          } else if (geometry.type === 'MultiLineString') {
            geometry.coordinates.forEach((line: number[][]) => {
              line.forEach((pt: number[]) => coords.push([pt[1], pt[0]]));
            });
          }
          setPath(coords);
        }
      } catch (err) {
        console.error('Routing error:', err);
      }
    };

    fetchRoute();
    return () => { active = false; };
  }, [waypoints]);

  if (path.length === 0) return null;

  return (
    <Polyline 
      positions={path}
      pathOptions={{
        color,
        weight: bold ? 6 : 4,
        opacity: dashed ? 0.4 : 0.8,
        dashArray: dashed ? '10, 10' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
        className: glow ? 'route-active-glow' : undefined
      }}
    />
  );
}

export function IntelligentRouteMap({ 
  driverDeliveries, 
  driverLocation, 
  warehouse, 
  activeDeliveryId,
  className = '' 
}: IntelligentRouteMapProps) {
  const [followDriver, setFollowDriver] = useState(true);

  // 1. Sort and filter deliveries
  const sortedDeliveries = useMemo(() => {
    return [...driverDeliveries].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  }, [driverDeliveries]);

  const completedStops = sortedDeliveries.filter(d => d.status === 'completed');
  const remainingStops = sortedDeliveries.filter(d => d.status !== 'completed');

  // 2. Define Route Segments
  
  // Completed History: Warehouse -> Completed Stops -> Driver
  const historyWaypoints = useMemo(() => {
    if (!warehouse) return [];
    const pts = [{ lat: warehouse.lat, lng: warehouse.lng }];
    completedStops.forEach(s => pts.push({ lat: s.lat, lng: s.lng }));
    if (driverLocation) pts.push({ lat: driverLocation.lat, lng: driverLocation.lng });
    return pts;
  }, [warehouse, completedStops, driverLocation]);

  // Future Logic: Driver -> Remaining Stops -> Warehouse
  const futureWaypoints = useMemo(() => {
    const pts: { lat: number, lng: number }[] = [];
    if (driverLocation) {
      pts.push({ lat: driverLocation.lat, lng: driverLocation.lng });
    } else if (warehouse) {
      pts.push({ lat: warehouse.lat, lng: warehouse.lng });
    }

    remainingStops.forEach(s => pts.push({ lat: s.lat, lng: s.lng }));
    
    // Closed Loop: Always back to warehouse
    if (warehouse) {
      pts.push({ lat: warehouse.lat, lng: warehouse.lng });
    }
    
    return pts;
  }, [driverLocation, remainingStops, warehouse]);

  const driverPos = useMemo(() => {
    if (driverLocation) return { lat: driverLocation.lat, lng: driverLocation.lng };
    return warehouse ? { lat: warehouse.lat, lng: warehouse.lng } : null;
  }, [driverLocation, warehouse]);

  // Icons
  const warehouseIcon = L.divIcon({
    className: 'custom-warehouse-icon',
    html: `
      <div class="flex items-center justify-center w-12 h-12 bg-slate-900 rounded-2xl shadow-2xl border-2 border-white transform hover:scale-110 transition-transform">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <div class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

  const getStopIcon = (delivery: Delivery, isNext: boolean) => {
    const isCompleted = delivery.status === 'completed';
    const isActive = delivery.id === activeDeliveryId;
    
    let bgColor = 'bg-slate-400'; // Default completed
    if (!isCompleted) {
      bgColor = isNext ? 'bg-orange-500' : 'bg-emerald-600';
    }
    if (isActive) bgColor = 'bg-orange-600 ring-4 ring-orange-200';

    return L.divIcon({
      className: 'custom-stop-icon',
      html: `
        <div class="flex flex-col items-center">
          <div class="flex items-center justify-center w-10 h-10 ${bgColor} rounded-full shadow-lg border-2 border-white transition-all">
            <span class="text-white font-black text-xs">${delivery.sequenceOrder || ''}</span>
          </div>
          ${!isCompleted ? `<div class="mt-1 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-slate-200">
            <p class="text-[8px] font-black uppercase text-slate-700 whitespace-nowrap">${delivery.recipientName.split(' ')[0]}</p>
          </div>` : ''}
        </div>
      `,
      iconSize: [40, 60],
      iconAnchor: [20, 20],
    });
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Map Controls */}
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-3">
        <div className="bg-white/95 backdrop-blur-md px-5 py-4 rounded-3xl shadow-2xl border border-white/20 flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Route Progress</p>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
              {completedStops.length} / {sortedDeliveries.length}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000" 
              style={{ width: `${(completedStops.length / sortedDeliveries.length) * 100}%` }}
            />
          </div>
          <p className="text-sm font-bold text-slate-900 mt-1">
            {remainingStops.length > 0 
              ? `Next: ${remainingStops[0].recipientName}` 
              : 'Heading to Warehouse'}
          </p>
        </div>
        
        <button 
          onClick={() => setFollowDriver(!followDriver)}
          className={`px-5 py-3 rounded-2xl shadow-xl border text-xs font-black transition-all flex items-center gap-2 ${
            followDriver 
            ? 'bg-emerald-600 text-white border-emerald-500' 
            : 'bg-white/95 backdrop-blur-md text-slate-700 border-white/20'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${followDriver ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
          {followDriver ? 'LIVE TRACKING ON' : 'MANUAL CONTROL'}
        </button>
      </div>

      <MapContainer
        center={driverPos ? [driverPos.lat, driverPos.lng] : [52.3676, 4.9041]}
        zoom={14}
        className="h-full w-full rounded-[40px]"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {driverPos && <MapController center={[driverPos.lat, driverPos.lng]} follow={followDriver} />}
        
        {/* Warehouse Marker */}
        {warehouse && (
          <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
            <Popup className="custom-popup">
              <div className="p-2">
                <p className="font-black text-slate-900 leading-none mb-1">Central Warehouse</p>
                <p className="text-[10px] text-slate-500">{warehouse.address}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Delivery Markers */}
        {sortedDeliveries.map((d, index) => (
          <Marker 
            key={d.id} 
            position={[d.lat, d.lng]} 
            icon={getStopIcon(d, d.id === remainingStops[0]?.id)}
          >
            <Popup>
              <div className="p-1">
                <p className="font-bold">{d.recipientName}</p>
                <p className="text-xs text-slate-500">{d.address}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    d.status === 'completed' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {d.status}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Route: History (Dashed Slate) */}
        <RoutePath 
          waypoints={historyWaypoints} 
          color="#64748b" 
          dashed={true} 
        />

        {/* Route: Future (Solid Emerald with Glow) */}
        <RoutePath 
          waypoints={futureWaypoints} 
          color="#10b981" 
          bold={true}
          glow={true}
        />
        
        {driverPos && (
          <SmoothDriverMarker 
            position={driverPos} 
            status={remainingStops.length > 0 ? 'active' : 'completed'} 
          />
        )}
      </MapContainer>

      <style dangerouslySetInnerHTML={{ __html: `
        .route-active-glow {
          filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.6));
        }
        .leaflet-container {
          background: #f8fafc;
        }
        .custom-warehouse-icon, .custom-stop-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          padding: 4px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        }
      `}} />
    </div>
  );
}
