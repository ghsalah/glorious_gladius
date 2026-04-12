/**
 * HTTP client for the Django REST API (JWT).
 */
import axios, { type AxiosError } from 'axios'
import type {
  AuthUser,
  CreateDriverPayload,
  Delivery,
  Driver,
  DriverLocation,
  LoginResponse,
  UpdateDriverPayload,
  WarehouseDepot,
} from '@/types'

const TOKEN_KEY = 'flower_distribution_admin_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const t = getStoredToken()
  if (t) {
    config.headers.Authorization = `Bearer ${t}`
  }
  return config
})

function messageFromBody(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed.'
  const o = data as Record<string, unknown>
  if (typeof o.message === 'string') return o.message
  if (typeof o.detail === 'string') return o.detail
  if (Array.isArray(o.detail)) return String(o.detail[0] ?? 'Request failed.')
  const parts: string[] = []
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v) && v.length) parts.push(`${k}: ${String(v[0])}`)
    else if (typeof v === 'string') parts.push(`${k}: ${v}`)
  }
  return parts.length ? parts.join(' ') : 'Request failed.'
}

function wrapAxiosError(e: unknown, fallback: string): Error {
  const err = e as AxiosError<{ message?: string; detail?: string }>
  const msg = err.response?.data
    ? messageFromBody(err.response.data)
    : err.message || fallback
  return new Error(msg)
}

export async function fetchAuthMe(): Promise<AuthUser> {
  try {
    const { data } = await api.get<AuthUser>('/auth/me')
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not load session.')
  }
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  try {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    })
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Login failed.')
  }
}

export async function changePasswordRequest(input: {
  currentPassword: string
  newPassword: string
  newPasswordConfirm: string
}): Promise<void> {
  try {
    await api.post('/auth/change-password', {
      current_password: input.currentPassword,
      new_password: input.newPassword,
      new_password_confirm: input.newPasswordConfirm,
    })
  } catch (e) {
    throw wrapAxiosError(e, 'Could not change password.')
  }
}

export async function fetchDrivers(): Promise<Driver[]> {
  try {
    const { data } = await api.get<Driver[]>('/drivers')
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Failed to load drivers.')
  }
}

export async function fetchDeliveries(): Promise<Delivery[]> {
  try {
    const { data } = await api.get<Delivery[]>('/deliveries')
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Failed to load deliveries.')
  }
}

export async function fetchDriverLocations(): Promise<DriverLocation[]> {
  try {
    const { data } = await api.get<DriverLocation[]>('/tracking/drivers/latest')
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Failed to load driver locations.')
  }
}

export async function fetchWarehouseDepot(): Promise<WarehouseDepot> {
  try {
    const { data } = await api.get<WarehouseDepot>('/settings/warehouse')
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Failed to load warehouse location.')
  }
}

export async function updateWarehouseDepot(payload: {
  label?: string
  address?: string
  lat?: number
  lng?: number
}): Promise<WarehouseDepot> {
  try {
    const { data } = await api.patch<WarehouseDepot>('/settings/warehouse', payload)
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not update warehouse location.')
  }
}

export async function createDriverRemote(payload: CreateDriverPayload): Promise<Driver> {
  try {
    const { data } = await api.post<Driver>('/drivers', {
      name: payload.name,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      vehicleLabel: payload.vehicleLabel,
      isActive: payload.isActive,
    })
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not create driver.')
  }
}

export async function updateDriverRemote(
  id: string,
  payload: UpdateDriverPayload,
): Promise<Driver> {
  try {
    const body: Record<string, unknown> = {}
    if (payload.name !== undefined) body.name = payload.name
    if (payload.email !== undefined) body.email = payload.email
    if (payload.phone !== undefined) body.phone = payload.phone
    if (payload.vehicleLabel !== undefined) body.vehicleLabel = payload.vehicleLabel
    if (payload.isActive !== undefined) body.isActive = payload.isActive
    if (payload.onDuty !== undefined) body.onDuty = payload.onDuty
    if (payload.newPassword && payload.newPassword.length > 0) {
      body.new_password = payload.newPassword
    }
    const { data } = await api.patch<Driver>(`/drivers/${id}`, body)
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not update driver.')
  }
}

export async function deleteDriverRemote(id: string): Promise<void> {
  try {
    await api.delete(`/drivers/${id}`)
  } catch (e) {
    throw wrapAxiosError(e, 'Could not delete driver.')
  }
}

export async function createDeliveryRemote(payload: {
  address: string
  lat: number
  lng: number
  recipientName: string
  recipientPhone?: string
  notes?: string
}): Promise<Delivery> {
  try {
    const { data } = await api.post<Delivery>('/deliveries', {
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      recipient_name: payload.recipientName,
      recipient_phone: payload.recipientPhone ?? '',
      notes: payload.notes ?? '',
    })
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not create delivery.')
  }
}

export async function updateDeliveryRemote(
  id: string,
  payload: {
    address?: string
    lat?: number
    lng?: number
    recipientName?: string
    recipientPhone?: string
    notes?: string
  },
): Promise<Delivery> {
  try {
    const { data } = await api.patch<Delivery>(`/deliveries/${id}`, payload)
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not update delivery.')
  }
}

export async function deleteDeliveryRemote(id: string): Promise<void> {
  try {
    await api.delete(`/deliveries/${id}`)
  } catch (e) {
    throw wrapAxiosError(e, 'Could not delete delivery.')
  }
}

export async function assignDeliveryRemote(
  deliveryId: string,
  driverId: string,
  sequenceOrder?: number,
): Promise<Delivery> {
  const seq = sequenceOrder ?? 1
  try {
    const { data } = await api.patch<Delivery>(`/deliveries/${deliveryId}/assign`, {
      driverId,
      sequenceOrder: seq,
    })
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not assign delivery.')
  }
}

export async function unassignDeliveryRemote(deliveryId: string): Promise<Delivery> {
  try {
    const { data } = await api.patch<Delivery>(`/deliveries/${deliveryId}/unassign`, {})
    return data
  } catch (e) {
    throw wrapAxiosError(e, 'Could not unassign delivery.')
  }
}
