import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { checkDeviation, optimizeRoute } from '@/lib/geoUtils';
import type { LatLng } from '@/lib/geoUtils';
import type { Delivery, DriverLocation, WarehouseDepot } from '@/types';
import { useDashboardData } from '@/contexts/DashboardDataContext';

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

interface ProductionRouteMapProps {
  driverDeliveries: Delivery[];
  driverLocation?: DriverLocation;
  warehouse: WarehouseDepot | null;
  activeDeliveryId?: string;
  className?: string;
}

const routeCache = new Map<string, [number, number][]>();

function MapController({ center, follow }: { center: [number, number]; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, follow, map]);
  return null;
}

function RoadSnappedMarker({ position, isOffRoute }: { position: LatLng, isOffRoute: boolean }) {
  const [currentPos, setCurrentPos] = useState<LatLng>(position);
  const [heading, setHeading] = useState(0);
  const prevPosRef = useRef<LatLng>(position);

  useEffect(() => {
    const startPos = prevPosRef.current;
    const endPos = position;

    if (Math.abs(endPos.lat - startPos.lat) > 0.0001 || Math.abs(endPos.lng - startPos.lng) > 0.0001) {
      const angle = (Math.atan2(endPos.lng - startPos.lng, endPos.lat - startPos.lat) * 180) / Math.PI;
      setHeading(angle);
    }

    let startTime: number | null = null;
    const duration = 1500;
    function animate(currentTime: number) {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCurrentPos({
        lat: startPos.lat + (endPos.lat - startPos.lat) * progress,
        lng: startPos.lng + (endPos.lng - startPos.lng) * progress
      });
      if (progress < 1) requestAnimationFrame(animate);
      else prevPosRef.current = endPos;
    }
    const frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [position]);

  const icon = L.divIcon({
    className: 'production-driver-icon',
    html: `
      <div style="transform: rotate(${heading}deg); transition: transform 0.4s ease-out;">
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-4 ${isOffRoute ? 'bg-red-500/20' : 'bg-emerald-500/20'} rounded-full animate-pulse"></div>
          <div class="w-10 h-10 bg-emerald-600 rounded-full shadow-2xl border-2 border-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" class="w-6 h-6 text-white" fill="currentColor">
              <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
            </svg>
          </div>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return <Marker position={[currentPos.lat, currentPos.lng]} icon={icon} />;
}

export function ProductionRouteMap({ 
  driverDeliveries, 
  driverLocation, 
  warehouse, 
  activeDeliveryId,
  className = '' 
}: ProductionRouteMapProps) {
  const { updateDelivery } = useDashboardData();
  const [followDriver, setFollowDriver] = useState(true);
  const [routeSegments, setRouteSegments] = useState<[number, number][][]>([]);
  const [actualHistory, setActualHistory] = useState<[number, number][]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const sortedStops = useMemo(() => {
    return [...driverDeliveries].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  }, [driverDeliveries]);

  const finishedStops = sortedStops.filter(s => s.status === 'completed');
  const remainingStops = sortedStops.filter(s => s.status !== 'completed');
  const completedCount = finishedStops.length;

  const handleSmartOptimization = async () => {
    if (!warehouse || remainingStops.length < 2 || !GEOAPIFY_API_KEY) return;
    setIsOptimizing(true);
    
    try {
      const optimizedIds = await optimizeRoute(
        { lat: warehouse.lat, lng: warehouse.lng },
        remainingStops.map(s => ({ lat: s.lat, lng: s.lng, id: s.id })),
        GEOAPIFY_API_KEY
      );

      // Update sequence orders in background
      await Promise.all(optimizedIds.map((id, index) => {
        return updateDelivery(id, { sequenceOrder: index + 1 + completedCount });
      }));
    } catch (err) {
      console.error('Optimization failed:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const stopsForRouting = useMemo(() => {
    if (!warehouse) return [];
    return [
      { lat: warehouse.lat, lng: warehouse.lng, id: 'warehouse-start' },
      ...sortedStops.map(s => ({ lat: s.lat, lng: s.lng, id: s.id })),
      { lat: warehouse.lat, lng: warehouse.lng, id: 'warehouse-end' }
    ];
  }, [warehouse, sortedStops]);

  useEffect(() => {
    if (stopsForRouting.length < 2 || !GEOAPIFY_API_KEY) return;
    
    let active = true;
    (async () => {
      try {
        const waypointsStr = stopsForRouting.map(w => `${w.lat},${w.lng}`).join('|');
        const res = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${waypointsStr}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`);
        const data = await res.json();
        
        if (data.features?.length > 0 && active) {
          const feature = data.features[0];
          const legs: [number, number][][] = [];
          
          let flatCoords: [number, number][] = [];
          feature.geometry.coordinates.forEach((line: any) => {
             if (Array.isArray(line[0])) {
               line.forEach((p: any) => flatCoords.push([p[1], p[0]]));
             } else {
               flatCoords.push([line[1], line[0]]);
             }
          });

          const segmentSize = Math.floor(flatCoords.length / (stopsForRouting.length - 1));
          for (let i = 0; i < stopsForRouting.length - 1; i++) {
             const start = i * segmentSize;
             const end = i === stopsForRouting.length - 2 ? flatCoords.length : (i + 1) * segmentSize + 1;
             legs.push(flatCoords.slice(start, end));
          }
          setRouteSegments(legs);
        }
      } catch (err) {
        console.error('Routing error:', err);
      }
    })();
    return () => { active = false; };
  }, [stopsForRouting]);

  const driverPos: LatLng | null = useMemo(() => {
    if (driverLocation) return { lat: driverLocation.lat, lng: driverLocation.lng };
    return null;
  }, [driverLocation]);

  useEffect(() => {
    if (driverPos) {
      setActualHistory(prev => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const dist = Math.sqrt(Math.pow(driverPos.lat - last[0], 2) + Math.pow(driverPos.lng - last[1], 2));
          if (dist < 0.0001) return prev;
        }
        return [...prev, [driverPos.lat, driverPos.lng]];
      });
    }
  }, [driverPos]);

  const { isOffRoute, distance } = useMemo(() => {
    if (!driverPos || routeSegments.length === 0) return { isOffRoute: false, distance: 0 };
    const fullPath: LatLng[] = routeSegments.flat().map(p => ({ lat: p[0], lng: p[1] }));
    return checkDeviation(driverPos, fullPath, 60);
  }, [driverPos, routeSegments]);

  return (
    <div className={`relative group ${className}`}>
      {/* HUD Overview */}
      <div className="absolute top-8 left-8 z-[1000] flex flex-col gap-4">
        <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-[32px] shadow-2xl border border-slate-200 flex flex-col gap-4 min-w-[300px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Mission Intelligence</span>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 ${isOffRoute ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'} border rounded-full`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isOffRoute ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`}></div>
              <span className={`text-[9px] font-black uppercase ${isOffRoute ? 'text-red-700' : 'text-emerald-700'}`}>
                {isOffRoute ? 'Deviation Alert' : 'On Schedule'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex-1">
                <p className="text-3xl font-black text-slate-900 leading-none tracking-tighter">
                   {completedCount} / {sortedStops.length} 
                </p>
                <p className="text-slate-400 text-[10px] font-bold uppercase mt-1 tracking-widest">Deliveries Completed</p>
             </div>
             <button 
               onClick={handleSmartOptimization}
               disabled={isOptimizing || remainingStops.length < 2}
               className="w-12 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 flex items-center justify-center border border-white shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
               title="Smart Route Re-Order"
             >
                {isOptimizing ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                )}
             </button>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000" 
              style={{ width: `${(completedCount / sortedStops.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
             <p className="text-[9px] font-bold text-slate-400 uppercase">Return Efficiency</p>
             <p className="text-xs font-black text-slate-900">{isOptimizing ? 'Recalculating...' : 'Optimized Path active'}</p>
          </div>
        </div>
      </div>

      <MapContainer
        center={driverPos ? [driverPos.lat, driverPos.lng] : [52.3676, 4.9041]}
        zoom={14}
        className="h-full w-full rounded-[48px]"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {driverPos && <MapController center={[driverPos.lat, driverPos.lng]} follow={followDriver} />}

        {routeSegments.map((segment, index) => {
          const isCompleted = index < completedCount;
          const isActive = index === completedCount;
          
          return (
            <Polyline 
              key={`seg-${index}`}
              positions={segment} 
              pathOptions={{ 
                color: isCompleted ? '#94a3b8' : isActive ? '#f59e0b' : '#10b981', 
                weight: isActive ? 8 : 5, 
                opacity: isCompleted ? 0.3 : isActive ? 0.9 : 0.6,
                dashArray: isCompleted ? '10, 10' : undefined,
                lineCap: 'round', 
                lineJoin: 'round',
              }}
            />
          );
        })}

        <Polyline 
          positions={actualHistory} 
          pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.5, lineCap: 'round' }}
        />

        {warehouse && (
          <Marker position={[warehouse.lat, warehouse.lng]} icon={L.divIcon({
            className: 'w-marker',
            html: `<div class="w-12 h-12 bg-emerald-900 rounded-2xl flex items-center justify-center border-4 border-white shadow-2xl">
                     <svg class="text-white w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L4 9V21H20V9L12 3M12 12.5C11.17 12.5 10.5 11.83 10.5 11C10.5 10.17 11.17 9.5 12 9.5C12.83 9.5 13.5 10.17 13.5 11C13.5 11.83 12.83 12.5 12 12.5Z"/></svg>
                   </div>`
          })}>
            <Popup>Warehouse Depot</Popup>
          </Marker>
        )}

        {sortedStops.map((d, i) => (
          <Marker 
            key={d.id} 
            position={[d.lat, d.lng]} 
            icon={L.divIcon({
              className: 's-marker',
              html: `<div class="flex flex-col items-center">
                       <div class="w-10 h-10 rounded-full border-4 border-white shadow-xl flex items-center justify-center font-black text-xs
                         ${d.status === 'completed' ? 'bg-slate-400 text-white' : i === completedCount ? 'bg-orange-500 text-white scale-125' : 'bg-emerald-500 text-white'} transition-all">
                         ${d.sequenceOrder}
                       </div>
                       ${d.status === 'completed' ? '<div class="mt-1 px-2 py-0.5 bg-slate-100 rounded text-[8px] font-bold text-slate-500">DONE</div>' : ''}
                     </div>`,
              iconAnchor: [20, 20]
            })}
          />
        ))}

        {driverPos && (
          <RoadSnappedMarker 
            position={driverPos} 
            isOffRoute={isOffRoute} 
          />
        )}
      </MapContainer>

      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { background: #f1f5f9; }
        .w-marker, .s-marker { background: transparent !important; border: none !important; }
      `}} />
    </div>
  );
}
