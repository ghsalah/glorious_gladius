import { useEffect, useState, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

interface LatLng {
  lat: number;
  lng: number;
}

interface SmoothDriverMarkerProps {
  position: LatLng;
  status: 'active' | 'completed';
  rotation?: number;
}

export function SmoothDriverMarker({ position, status, rotation = 0 }: SmoothDriverMarkerProps) {
  const [currentPos, setCurrentPos] = useState<LatLng>(position);
  const [currentHeading, setCurrentHeading] = useState(rotation);
  const prevPosRef = useRef<LatLng>(position);
  const map = useMap();

  // Interpolation logic
  useEffect(() => {
    if (status === 'completed') {
      setCurrentPos(position);
      return;
    }

    const startPos = prevPosRef.current;
    const endPos = position;

    // Calculate heading based on movement if not provided
    if (Math.abs(endPos.lat - startPos.lat) > 0.0001 || Math.abs(endPos.lng - startPos.lng) > 0.0001) {
      const heading = (Math.atan2(endPos.lng - startPos.lng, endPos.lat - startPos.lat) * 180) / Math.PI;
      setCurrentHeading(heading);
    }

    let startTime: number | null = null;
    const duration = 2000; // 2 seconds interpolation for a 5 second update interval

    function animate(currentTime: number) {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const lat = startPos.lat + (endPos.lat - startPos.lat) * progress;
      const lng = startPos.lng + (endPos.lng - startPos.lng) * progress;

      setCurrentPos({ lat, lng });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevPosRef.current = endPos;
      }
    }

    const animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [position, status]);

  // Marker icon based on status
  const icon = L.divIcon({
    className: 'driver-marker-container',
    html: `
      <div style="transform: rotate(${currentHeading}deg); transition: transform 0.3s ease-out;">
        ${status === 'active' ? `
          <div class="relative">
            <div class="absolute -inset-1 bg-emerald-500 rounded-full blur opacity-40 animate-pulse"></div>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 10L12 3L19 10M5 14L12 21L19 14" stroke="#064e3b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="4" fill="#10b981" stroke="white" stroke-width="2"/>
            </svg>
          </div>
        ` : `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#64748b" stroke="white" stroke-width="2"/>
            <path d="M8 12L11 15L16 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

  return <Marker position={[currentPos.lat, currentPos.lng]} icon={icon} />;
}
