/**
 * Fleet state (drivers, deliveries, last known GPS) used across admin pages.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  CreateDriverPayload,
  Delivery,
  Driver,
  DriverLocation,
  UpdateDriverPayload,
  WarehouseDepot,
} from '@/types'
import { buildAutoRoutePlan } from '@/lib/routeOptimization'
import {
  assignDeliveryRemote,
  createDeliveryRemote,
  createDriverRemote,
  deleteDeliveryRemote,
  deleteDriverRemote,
  fetchDeliveries,
  fetchDriverLocations,
  fetchDrivers,
  fetchWarehouseDepot,
  unassignDeliveryRemote,
  updateDeliveryRemote,
  updateDriverRemote,
  updateWarehouseDepot,
} from '@/services/api'

interface DashboardDataValue {
  drivers: Driver[]
  deliveries: Delivery[]
  driverLocations: DriverLocation[]
  warehouse: WarehouseDepot | null
  isLoading: boolean
  loadError: string | null
  /** True while any mutation request is in flight */
  isMutating: boolean
  refresh: () => Promise<void>
  createDelivery: (input: {
    address: string
    lat: number
    lng: number
    recipientName: string
    recipientPhone?: string
    notes?: string
  }) => Promise<void>
  assignDelivery: (deliveryId: string, driverId: string, sequenceOrder?: number) => Promise<void>
  unassignDelivery: (deliveryId: string) => Promise<void>
  updateDelivery: (
    id: string,
    input: {
      address?: string
      lat?: number
      lng?: number
      recipientName?: string
      recipientPhone?: string
      notes?: string
    },
  ) => Promise<void>
  deleteDelivery: (id: string) => Promise<void>
  /**
   * Assign every unassigned stop to active drivers with load-aware balancing + greedy stop order.
   * @returns how many stops were assigned, or 0 if nothing to do / missing warehouse / no drivers.
   */
  optimizeUnassignedRoutes: () => Promise<number>
  createDriver: (input: CreateDriverPayload) => Promise<void>
  updateDriver: (id: string, input: UpdateDriverPayload) => Promise<void>
  deleteDriver: (id: string) => Promise<void>
  updateWarehouse: (input: {
    label?: string
    address?: string
    lat?: number
    lng?: number
  }) => Promise<void>
}

const DashboardDataContext = createContext<DashboardDataValue | null>(null)

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([])
  const [warehouse, setWarehouse] = useState<WarehouseDepot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    setIsLoading(true)
    try {
      const [d, del, loc, wh] = await Promise.all([
        fetchDrivers(),
        fetchDeliveries(),
        fetchDriverLocations(),
        fetchWarehouseDepot(),
      ])
      setDrivers(d)
      setDeliveries(del)
      setDriverLocations(loc)
      setWarehouse(wh)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load data.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchDriverLocations()
        .then(setDriverLocations)
        .catch(() => {})
    }, 5_000)
    return () => window.clearInterval(id)
  }, [])

  const createDelivery = useCallback(
    async (input: {
      address: string
      lat: number
      lng: number
      recipientName: string
      recipientPhone?: string
      notes?: string
    }) => {
      setIsMutating(true)
      try {
        const created = await createDeliveryRemote(input)
        setDeliveries((prev) => [created, ...prev])
      } finally {
        setIsMutating(false)
      }
    },
    [],
  )

  const assignDelivery = useCallback(
    async (deliveryId: string, driverId: string, sequenceOrder?: number) => {
      setIsMutating(true)
      try {
        const updated = await assignDeliveryRemote(deliveryId, driverId, sequenceOrder)
        setDeliveries((prev) =>
          prev.map((d) => (d.id === deliveryId ? { ...d, ...updated } : d)),
        )
      } finally {
        setIsMutating(false)
      }
    },
    [],
  )

  const unassignDelivery = useCallback(async (deliveryId: string) => {
    setIsMutating(true)
    try {
      const updated = await unassignDeliveryRemote(deliveryId)
      setDeliveries((prev) =>
        prev.map((d) => (d.id === deliveryId ? { ...d, ...updated } : d)),
      )
    } finally {
      setIsMutating(false)
    }
  }, [])

  const updateDelivery = useCallback(
    async (
      id: string,
      input: {
        address?: string
        lat?: number
        lng?: number
        recipientName?: string
        recipientPhone?: string
        notes?: string
      },
    ) => {
      setIsMutating(true)
      try {
        const updated = await updateDeliveryRemote(id, input)
        setDeliveries((prev) => prev.map((d) => (d.id === id ? updated : d)))
      } finally {
        setIsMutating(false)
      }
    },
    [],
  )

  const deleteDelivery = useCallback(async (id: string) => {
    setIsMutating(true)
    try {
      await deleteDeliveryRemote(id)
      setDeliveries((prev) => prev.filter((d) => d.id !== id))
    } finally {
      setIsMutating(false)
    }
  }, [])

  const optimizeUnassignedRoutes = useCallback(async (): Promise<number> => {
    const activeDrivers = drivers.filter((d) => d.isActive)
    const unassigned = deliveries.filter((d) => !d.assignedDriverId && d.status !== 'completed')
    if (!activeDrivers.length || !unassigned.length || !warehouse) return 0

    const currentOpenLoad = new Map<string, number>()
    for (const dr of activeDrivers) {
      currentOpenLoad.set(
        dr.id,
        deliveries.filter((d) => d.assignedDriverId === dr.id && d.status !== 'completed').length,
      )
    }

    const plan = buildAutoRoutePlan(unassigned, activeDrivers, driverLocations, {
      lat: warehouse.lat,
      lng: warehouse.lng,
    }, currentOpenLoad)
    if (!plan.length) return 0

    setIsMutating(true)
    try {
      for (const step of plan) {
        const updated = await assignDeliveryRemote(
          step.deliveryId,
          step.driverId,
          step.sequenceOrder,
        )
        setDeliveries((prev) =>
          prev.map((d) => (d.id === step.deliveryId ? { ...d, ...updated } : d)),
        )
      }
      return plan.length
    } finally {
      setIsMutating(false)
    }
  }, [deliveries, drivers, driverLocations, warehouse])

  const updateWarehouse = useCallback(
    async (input: { label?: string; address?: string; lat?: number; lng?: number }) => {
      setIsMutating(true)
      try {
        const updated = await updateWarehouseDepot(input)
        setWarehouse(updated)
      } finally {
        setIsMutating(false)
      }
    },
    [],
  )

  const createDriver = useCallback(async (input: CreateDriverPayload) => {
    setIsMutating(true)
    try {
      const created = await createDriverRemote(input)
      setDrivers((prev) => [...prev, created])
    } finally {
      setIsMutating(false)
    }
  }, [])

  const updateDriver = useCallback(async (id: string, input: UpdateDriverPayload) => {
    setIsMutating(true)
    try {
      const updated = await updateDriverRemote(id, input)
      setDrivers((prev) => prev.map((d) => (d.id === id ? updated : d)))
    } finally {
      setIsMutating(false)
    }
  }, [])

  const deleteDriver = useCallback(async (id: string) => {
    setIsMutating(true)
    try {
      await deleteDriverRemote(id)
      setDrivers((prev) => prev.filter((d) => d.id !== id))
      setDeliveries((prev) =>
        prev.map((d) =>
          d.assignedDriverId === id
            ? { ...d, assignedDriverId: null, sequenceOrder: null }
            : d,
        ),
      )
    } finally {
      setIsMutating(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      drivers,
      deliveries,
      driverLocations,
      warehouse,
      isLoading,
      loadError,
      isMutating,
      refresh,
      createDelivery,
      updateDelivery,
      deleteDelivery,
      assignDelivery,
      unassignDelivery,
      optimizeUnassignedRoutes,
      createDriver,
      updateDriver,
      deleteDriver,
      updateWarehouse,
    }),
    [
      drivers,
      deliveries,
      driverLocations,
      warehouse,
      isLoading,
      loadError,
      isMutating,
      refresh,
      createDelivery,
      updateDelivery,
      deleteDelivery,
      assignDelivery,
      unassignDelivery,
      optimizeUnassignedRoutes,
      createDriver,
      updateDriver,
      deleteDriver,
      updateWarehouse,
    ],
  )

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- paired hook for DashboardDataProvider
export function useDashboardData() {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) {
    throw new Error('useDashboardData must be used within DashboardDataProvider')
  }
  return ctx
}
