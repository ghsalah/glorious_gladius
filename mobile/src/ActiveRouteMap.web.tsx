/**
 * Web stub: react-native-maps is native-only and must not be imported on web
 * (Metro would fail the bundle with MIME application/json → script refused in browser).
 */
import React from 'react';

export type MapCoord = { latitude: number; longitude: number };

type DeliveryLite = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  recipientName: string;
};

type WarehouseLite = { label: string; address: string; lat: number; lng: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  warehouse: WarehouseLite | null;
  activeDelivery: DeliveryLite | null;
  driverCoord: { lat: number; lng: number } | null;
  trailCoords: MapCoord[];
};

/** Live map is only available on iOS/Android builds. */
export function ActiveRouteMap(_props: Props) {
  return null;
}
