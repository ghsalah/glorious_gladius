/**
 * Geometry and geographic utilities for intelligent route tracking.
 */

export type LatLng = {
  lat: number;
  lng: number;
}

/**
 * Calculates the distance between two coordinates in meters using Haversine formula.
 */
export function getDistance(p1: LatLng, p2: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * (Math.PI / 180)) *
      Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest point on a line segment defined by two points.
 */
export function getNearestPointOnSegment(p: LatLng, a: LatLng, b: LatLng): LatLng {
  const atob = { lat: b.lat - a.lat, lng: b.lng - a.lng };
  const atop = { lat: p.lat - a.lat, lng: p.lng - a.lng };
  const lenSq = atob.lat * atob.lat + atob.lng * atob.lng;
  let t = (atop.lat * atob.lat + atop.lng * atob.lng) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    lat: a.lat + t * atob.lat,
    lng: a.lng + t * atob.lng,
  };
}

/**
 * Checks if a point deviates significantly from a polyline.
 * Returns the record containing nearest point and distance.
 */
export function checkDeviation(point: LatLng, polyline: LatLng[], thresholdMeters: number = 30) {
  if (polyline.length < 2) return { isOffRoute: false, distance: 0, nearest: point };

  let minDistance = Infinity;
  let nearestPoint = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const near = getNearestPointOnSegment(point, polyline[i], polyline[i+1]);
    const d = getDistance(point, near);
    if (d < minDistance) {
      minDistance = d;
      nearestPoint = near;
    }
  }

  return {
    isOffRoute: minDistance > thresholdMeters,
    distance: minDistance,
    nearest: nearestPoint
  };
}

/**
 * Uses Geoapify Route Planner API to solve the Traveling Salesman Problem (TSP).
 * Returns the optimized sequence of stops.
 */
export async function optimizeRoute(
  warehouse: LatLng,
  stops: (LatLng & { id: string })[],
  apiKey: string
): Promise<string[]> {
  if (stops.length < 2) return stops.map(s => s.id);

  try {
    const body = {
      mode: 'drive',
      agents: [{
        start_location: [warehouse.lng, warehouse.lat],
        end_location: [warehouse.lng, warehouse.lat],
        pickup_capacity: 100
      }],
      shipments: stops.map(s => ({
        id: s.id,
        pickup: {
          location: [s.lng, s.lat],
          duration: 120 // 2 minute stop duration
        }
      }))
    };

    const res = await fetch(`https://api.geoapify.com/v1/routeplanner?apiKey=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    
    if (data.features?.[0]?.properties?.actions) {
      // Extract IDs in optimized order
      return data.features[0].properties.actions
        .filter((a: any) => a.type === 'pickup')
        .map((a: any) => a.shipment_id);
    }
  } catch (err) {
    console.error('Route Planner error:', err);
  }

  return stops.map(s => s.id); // Fallback to current order
}

/**
 * Interpolates coordinates along a polyline based on a progress value (0 to 1).
 */
export function interpolateAlongPath(path: LatLng[], progress: number): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1) return path[0];
  if (progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];

  const targetDist = progress * path.length; // Simplified; ideally should use actual distance
  const index = Math.floor(targetDist);
  const remainder = targetDist - index;

  if (index >= path.length - 1) return path[path.length - 1];

  const p1 = path[index];
  const p2 = path[index + 1];

  return {
    lat: p1.lat + (p2.lat - p1.lat) * remainder,
    lng: p1.lng + (p2.lng - p1.lng) * remainder,
  };
}
