import React, { useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { MapStyleElement } from 'react-native-maps';
import { THEME } from './theme';

/** Light map — slate tones to match admin dashboard maps. */
const MAP_STYLE_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
];

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
  /** Current in-progress stop (destination). */
  activeDelivery: DeliveryLite | null;
  /** Latest GPS fix for the van marker. */
  driverCoord: { lat: number; lng: number } | null;
  /** Recorded path while on the route (optional). */
  trailCoords: MapCoord[];
};

function regionFromPoints(points: MapCoord[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  if (points.length === 0) {
    return {
      latitude: 52.3676,
      longitude: 4.9041,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const latPad = Math.max((maxLat - minLat) * 0.35, 0.02);
  const lngPad = Math.max((maxLng - minLng) * 0.35, 0.02);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat + latPad, 0.04),
    longitudeDelta: Math.max(maxLng - minLng + lngPad, 0.04),
  };
}

function warehouseValid(w: WarehouseLite | null): w is WarehouseLite {
  if (!w) return false;
  return Math.abs(w.lat) > 1e-5 || Math.abs(w.lng) > 1e-5;
}

export function ActiveRouteMap({
  visible,
  onClose,
  warehouse,
  activeDelivery,
  driverCoord,
  trailCoords,
}: Props) {
  const mapRef = useRef<MapView>(null);

  const destCoord = useMemo<MapCoord | null>(() => {
    if (!activeDelivery) return null;
    return { latitude: activeDelivery.lat, longitude: activeDelivery.lng };
  }, [activeDelivery]);

  const driverLL = useMemo<MapCoord | null>(() => {
    if (!driverCoord) return null;
    return { latitude: driverCoord.lat, longitude: driverCoord.lng };
  }, [driverCoord]);

  const depotLL = useMemo<MapCoord | null>(() => {
    if (!warehouseValid(warehouse)) return null;
    return { latitude: warehouse.lat, longitude: warehouse.lng };
  }, [warehouse]);

  const polylineCoords = useMemo(() => {
    const parts: MapCoord[] = [];
    if (depotLL) parts.push(depotLL);
    for (const t of trailCoords) parts.push(t);
    if (destCoord) parts.push(destCoord);
    if (parts.length < 2 && driverLL && destCoord) {
      return [driverLL, destCoord];
    }
    if (parts.length < 2 && driverLL) return [driverLL];
    return parts;
  }, [depotLL, trailCoords, destCoord, driverLL]);

  const fitPoints = useMemo(() => {
    const pts: MapCoord[] = [];
    if (depotLL) pts.push(depotLL);
    for (const t of trailCoords) pts.push(t);
    if (driverLL) pts.push(driverLL);
    if (destCoord) pts.push(destCoord);
    if (pts.length === 0 && destCoord) return [destCoord];
    return pts;
  }, [depotLL, trailCoords, driverLL, destCoord]);

  const initialRegion = useMemo(() => regionFromPoints(fitPoints), [fitPoints]);

  useEffect(() => {
    if (!visible || !mapRef.current || fitPoints.length === 0) return;
    const pts = fitPoints;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 100, right: 40, bottom: 280, left: 40 },
        animated: true,
      });
    }, 450);
    return () => clearTimeout(t);
  }, [
    visible,
    activeDelivery?.id,
    destCoord?.latitude,
    destCoord?.longitude,
    depotLL?.latitude,
    depotLL?.longitude,
    driverLL?.latitude,
    driverLL?.longitude,
  ]);

  const openExternalNav = () => {
    if (!destCoord) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destCoord.latitude},${destCoord.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Live route</Text>
            <TouchableOpacity onPress={openExternalNav} style={styles.iconBtn} disabled={!destCoord}>
              <Text style={styles.iconBtnText}>↗</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          customMapStyle={Platform.OS === 'android' ? MAP_STYLE_LIGHT : undefined}
        >
          {depotLL ? (
            <Marker coordinate={depotLL} title="Depot" description={warehouse?.label}>
              <View style={[styles.marker, styles.markerDepot]}>
                <Text style={styles.markerGlyph}>⌂</Text>
              </View>
            </Marker>
          ) : null}
          {destCoord ? (
            <Marker coordinate={destCoord} title="Stop" description={activeDelivery?.address}>
              <View style={[styles.marker, styles.markerStop]}>
                <Text style={styles.markerGlyph}>◎</Text>
              </View>
            </Marker>
          ) : null}
          {driverLL ? (
            <Marker coordinate={driverLL} title="You">
              <View style={[styles.marker, styles.markerVan]}>
                <Text style={styles.markerGlyph}>▶</Text>
              </View>
            </Marker>
          ) : null}
          {polylineCoords.length >= 2 ? (
            <Polyline coordinates={polylineCoords} strokeColor={THEME.map.routeLine} strokeWidth={3} />
          ) : null}
        </MapView>

        <SafeAreaView style={styles.sheet}>
          {!activeDelivery ? (
            <View style={styles.sheetBlock}>
              <Text style={styles.sheetTitle}>No active delivery</Text>
              <Text style={styles.sheetMuted}>
                Accept a stop to see the depot, your path, and the destination here. Your position still updates if
                location is on.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.sheetBlock}>
                <Text style={styles.sheetTitle}>On the way</Text>
                <Text style={styles.sheetMuted}>
                  {activeDelivery.status === 'in_progress'
                    ? 'Location is shared with dispatch while this stop is in progress.'
                    : 'Start this stop to share live location with dispatch.'}
                </Text>
              </View>
              <View style={[styles.sheetBlock, styles.sheetRow]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.k}>Stop</Text>
                  <Text style={styles.v}>{activeDelivery.address}</Text>
                  <Text style={styles.sheetMuted}>Recipient: {activeDelivery.recipientName}</Text>
                </View>
              </View>
            </>
          )}
          <TouchableOpacity style={styles.primary} onPress={openExternalNav} disabled={!destCoord}>
            <Text style={styles.primaryText}>Open in Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Back to list</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerSafe: {
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.textMain,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 18,
    color: THEME.textMain,
    fontWeight: '600',
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.card,
  },
  markerDepot: { backgroundColor: THEME.map.warehouse },
  markerStop: { backgroundColor: THEME.map.destination },
  markerVan: { backgroundColor: THEME.map.driver },
  markerGlyph: {
    color: THEME.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sheet: {
    marginTop: 'auto',
    backgroundColor: THEME.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
    maxHeight: 320,
    zIndex: 2,
  },
  sheetBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  sheetRow: {
    flexDirection: 'row',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textMain,
    marginBottom: 4,
  },
  sheetMuted: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  k: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textMuted,
    marginBottom: 4,
  },
  v: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textMain,
    marginBottom: 4,
  },
  primary: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: {
    color: THEME.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: THEME.link,
    fontSize: 16,
    fontWeight: '600',
  },
});
