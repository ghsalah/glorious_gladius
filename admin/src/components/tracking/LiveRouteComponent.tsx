import { useState, useEffect, useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import L from 'leaflet';

interface LatLng {
  lat: number;
  lng: number;
}

interface LiveRouteComponentProps {
  start: LatLng;
  end: LatLng;
  status: 'active' | 'completed';
}

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

export function LiveRouteComponent({ start, end, status }: LiveRouteComponentProps) {
  const [route, setRoute] = useState<LatLng[]>([]);
  const [lastRequestedPoints, setLastRequestedPoints] = useState<string>('');

  useEffect(() => {
    if (status === 'completed') return;

    // Only update if points moved significantly (approx 20 meters)
    const pointsKey = `${start.lat.toFixed(4)},${start.lng.toFixed(4)}|${end.lat.toFixed(4)},${end.lng.toFixed(4)}`;
    if (pointsKey === lastRequestedPoints) return;

    let active = true;
    async function fetchRoute() {
      if (!GEOAPIFY_API_KEY || !start.lat || !end.lat) return;

      try {
        const url = `https://api.geoapify.com/v1/routing?waypoints=${start.lat},${start.lng}|${end.lat},${end.lng}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.features && data.features.length > 0) {
          // Requirement: Use ONLY the primary route (first feature)
          const feature = data.features[0];
          const geometry = feature.geometry;
          const coords: LatLng[] = [];

          if (geometry.type === 'LineString') {
            geometry.coordinates.forEach((pt: number[]) => {
              coords.push({ lat: pt[1], lng: pt[0] });
            });
          } else if (geometry.type === 'MultiLineString') {
            geometry.coordinates.forEach((line: number[][]) => {
              line.forEach((pt: number[]) => {
                coords.push({ lat: pt[1], lng: pt[0] });
              });
            });
          }

          if (active) {
            setRoute(coords);
            setLastRequestedPoints(pointsKey);
          }
        }
      } catch (error) {
        console.error('Geoapify routing error:', error);
      }
    }

    fetchRoute();
    return () => { active = false; };
  }, [start, end, status, lastRequestedPoints]);

  // If completed, we show a direct dashed gray line or the last known route if available
  // But requirement says: "Route becomes gray and dashed"
  const pathOptions = useMemo(() => {
    if (status === 'completed') {
      return {
        color: '#64748b', // slate-500
        weight: 4,
        opacity: 0.6,
        dashArray: '10, 10',
        lineCap: 'round',
        lineJoin: 'round',
      };
    }
    return {
      color: '#10b981', // emerald-500
      weight: 6,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round',
      // Subtle glow effect using shadow
      className: 'route-active-glow'
    };
  }, [status]);

  if (route.length < 2 && status === 'active') return null;

  // Use direct line if route is not fetched yet or it's completed
  const displayPositions = route.length >= 2 ? route : [start, end];

  return (
    <Polyline 
      positions={displayPositions.map(p => [p.lat, p.lng] as [number, number])} 
      pathOptions={pathOptions as any}
    />
  );
}
