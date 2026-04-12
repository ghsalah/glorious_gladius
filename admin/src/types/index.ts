/** Shared domain types for the admin dashboard (mirrors future PostgreSQL entities). */

export type UserRole = 'admin' | 'driver'

export type DeliveryStatus = 'pending' | 'accepted' | 'in_progress' | 'completed'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface Driver {
  id: string
  userId: string
  name: string
  /** Login username (same as user email for the driver app). */
  email: string
  phone: string
  vehicleLabel: string
  isActive: boolean
  /** From driver app *on duty* toggle; informational for dispatch. */
  onDuty?: boolean
}

/** Admin creates a driver user + fleet row; password is set once (NestJS will hash server-side). */
export interface CreateDriverPayload {
  name: string
  email: string
  password: string
  phone: string
  vehicleLabel: string
  isActive: boolean
}

export interface UpdateDriverPayload {
  name?: string
  email?: string
  phone?: string
  vehicleLabel?: string
  isActive?: boolean
  onDuty?: boolean
  /** New password for the driver app; omit or empty to leave unchanged. */
  newPassword?: string
}

export interface Delivery {
  id: string
  address: string
  lat: number
  lng: number
  status: DeliveryStatus
  assignedDriverId: string | null
  /** Stop order after route optimization (null if unassigned). */
  sequenceOrder: number | null
  recipientName: string
  recipientPhone: string
  notes?: string
  createdAt: string
}

/** Latest GPS sample for live map tracking (maps to `tracking` table). */
export interface DriverLocation {
  driverId: string
  lat: number
  lng: number
  updatedAt: string
}

/** Warehouse / shop — single depot used as route start and map anchor. */
export interface WarehouseDepot {
  label: string
  address: string
  lat: number
  lng: number
  updatedAt: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
