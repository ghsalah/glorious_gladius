import type { DeliveryStatus } from '@/types'

/** Marker / map dot colors aligned with dashboard status pills. */
export const DELIVERY_STATUS_HEX: Record<DeliveryStatus, string> = {
  pending: '#64748b',
  accepted: '#2563eb',
  in_progress: '#d97706',
  completed: '#059669',
}

export function deliveryStatusLabel(status: DeliveryStatus): string {
  return status.replace('_', ' ')
}

export const DRIVER_VAN_HEX = '#2563eb'
export const WAREHOUSE_HEX = '#7c3aed'

/** Distinct polyline colors for multi-driver route preview (assign map). */
export const ROUTE_PREVIEW_PALETTE = [
  '#059669',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#ca8a04',
  '#4f46e5',
] as const

/** Google Maps `Marker` symbol (classic Marker API). */
export function googleCircleMarkerSymbol(
  fillColor: string,
  options?: { scale?: number; strokeColor?: string; strokeWeight?: number },
): google.maps.Symbol {
  const scale = options?.scale ?? 9
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor,
    fillOpacity: 1,
    strokeColor: options?.strokeColor ?? '#ffffff',
    strokeWeight: options?.strokeWeight ?? 2,
    scale,
  }
}

export function googleSymbolForDeliveryStatus(status: DeliveryStatus): google.maps.Symbol {
  return googleCircleMarkerSymbol(DELIVERY_STATUS_HEX[status], { scale: 9 })
}
