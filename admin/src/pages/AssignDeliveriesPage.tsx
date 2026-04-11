/**
 * Dispatch desk: clearly assign unassigned stops to drivers and reassign or unassign existing loads.
 * Complements the main Deliveries table with a workflow-focused layout.
 */
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DeliveriesMap } from '@/components/DeliveriesMap'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useDashboardData } from '@/contexts/DashboardDataContext'
import { ROUTE_PREVIEW_PALETTE } from '@/lib/deliveryStatusStyle'
import type { Delivery, DeliveryStatus } from '@/types'

function statusPill(status: DeliveryStatus) {
  const map = {
    pending: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-amber-100 text-amber-900',
    completed: 'bg-emerald-100 text-emerald-900',
  } as const
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

/** Open stops that still need a van (not completed, no driver yet). */
function isAwaitingDriver(d: Delivery) {
  return !d.assignedDriverId && d.status !== 'completed'
}

export function AssignDeliveriesPage() {
  const {
    deliveries,
    drivers,
    driverLocations,
    warehouse,
    isLoading,
    loadError,
    refresh,
    assignDelivery,
    optimizeUnassignedRoutes,
    unassignDelivery,
    isMutating,
  } = useDashboardData()

  /** Per delivery: which driver is selected before clicking Assign / Move. */
  const [pickDriver, setPickDriver] = useState<Record<string, string>>({})
  const [autoAssignBanner, setAutoAssignBanner] = useState<string | null>(null)
  const routeMapRef = useRef<HTMLElement>(null)

  const activeDrivers = useMemo(() => drivers.filter((d) => d.isActive), [drivers])

  const awaiting = useMemo(
    () => deliveries.filter(isAwaitingDriver),
    [deliveries],
  )

  const assignedOpen = useMemo(
    () =>
      deliveries.filter(
        (d) => d.assignedDriverId && d.status !== 'completed',
      ),
    [deliveries],
  )

  /** Open work only — map and route preview stay dispatch-focused. */
  const openDeliveriesForMap = useMemo(
    () => deliveries.filter((d) => d.status !== 'completed'),
    [deliveries],
  )

  if (isLoading) return <LoadingSpinner label="Loading deliveries…" />
  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 text-sm font-medium text-red-900 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  function selectedFor(id: string) {
    return pickDriver[id] ?? ''
  }

  function setSelectedFor(id: string, driverId: string) {
    setPickDriver((prev) => ({ ...prev, [id]: driverId }))
  }

  async function runAssign(deliveryId: string) {
    const driverId = selectedFor(deliveryId)
    if (!driverId) return
    await assignDelivery(deliveryId, driverId)
    setPickDriver((prev) => {
      const next = { ...prev }
      delete next[deliveryId]
      return next
    })
  }

  async function unassign(deliveryId: string) {
    await unassignDelivery(deliveryId)
  }

  async function runAutoAssign() {
    setAutoAssignBanner(null)
    const n = await optimizeUnassignedRoutes()
    if (n > 0) {
      setAutoAssignBanner(`Assigned ${n} stop${n === 1 ? '' : 's'} across drivers. Routes are updated below.`)
      requestAnimationFrame(() => {
        routeMapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assign to drivers</h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Choose a driver for each stop, then click <strong>Assign delivery</strong>. Use the
            sections below to balance vans or move stops between drivers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
          <Link
            to="/deliveries"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            All deliveries
          </Link>
        </div>
      </div>

      {/* Unassigned queue */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-amber-950">Needs a driver</h2>
            <p className="text-sm text-amber-900/80">
              {awaiting.length} stop{awaiting.length === 1 ? '' : 's'} waiting for assignment
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <button
              type="button"
              disabled={
                isMutating ||
                awaiting.length === 0 ||
                activeDrivers.length === 0 ||
                !warehouse
              }
              onClick={() => void runAutoAssign()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMutating ? 'Planning…' : 'Auto-assign routes'}
            </button>
            <p className="max-w-xs text-xs text-amber-900/80 sm:text-right">
              Uses {activeDrivers.length} active driver{activeDrivers.length === 1 ? '' : 's'} and last
              known GPS. Stops are grouped into <strong>directional wedges</strong> around the warehouse so
              vans are not zig-zagged on the same streets, then light swaps may{' '}
              <strong>lower total km</strong>. Each route is <strong>greedy + 2-opt</strong> from the
              warehouse.
              {!warehouse && awaiting.length > 0 ? (
                <span className="mt-1 block font-medium text-amber-950">
                  Set a warehouse first — required for routing.
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {awaiting.length === 0 ? (
          <p className="rounded-xl border border-dashed border-amber-300 bg-white/80 px-4 py-8 text-center text-sm text-amber-900">
            Nothing in the queue. Create a delivery on the{' '}
            <Link to="/deliveries" className="font-semibold text-emerald-800 underline">
              Deliveries
            </Link>{' '}
            page or wait for new imports from the API.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {awaiting.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{d.recipientName}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{d.address}</p>
                  </div>
                  {statusPill(d.status)}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <select
                    disabled={isMutating}
                    value={selectedFor(d.id)}
                    onChange={(e) => setSelectedFor(d.id, e.target.value)}
                    className="min-h-[42px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    aria-label={`Select driver for ${d.recipientName}`}
                  >
                    <option value="">Select driver…</option>
                    {activeDrivers.map((dr) => (
                      <option key={dr.id} value={dr.id}>
                        {dr.name} · {dr.vehicleLabel}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={isMutating || !selectedFor(d.id)}
                    onClick={() => void runAssign(d.id)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isMutating ? 'Saving…' : 'Assign delivery'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        ref={routeMapRef}
        id="assign-route-map"
        className="scroll-mt-24 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Route map</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            All open stops (by status color), van GPS, and warehouse. Each colored line is one driver’s
            <strong> optimized stop order</strong> (greedy + 2-opt, same as auto-assign). On Google Maps,
            lines are <strong>straight geodesic segments</strong> by default (always visible). Set{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[10px]">VITE_USE_ROAD_DIRECTIONS=true</code>{' '}
            in <code className="font-mono text-[10px]">.env</code> and enable the <strong>Directions API</strong> to
            snap routes to roads. OSM preview always uses straight lines. After <strong>Auto-assign routes</strong>,
            this section scrolls into view.
          </p>
          <p className="mt-2 max-w-3xl text-xs text-slate-500">
            <strong>Lines still cross?</strong> After auto-assign, each van owns a different compass slice
            from the depot; overlaps are usually separate streets or a refinement that saved a few km.
            Different colors / dash patterns help when paths sit on top of each other.
          </p>
          {!warehouse ? (
            <p className="mt-2 text-sm text-amber-900">
              Set a <Link to="/warehouse" className="font-semibold underline">warehouse</Link> so routes
              start from your depot.
            </p>
          ) : null}
        </div>
        {autoAssignBanner ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200">
            {autoAssignBanner}
          </p>
        ) : null}
        <DeliveriesMap
          deliveries={openDeliveriesForMap}
          driverLocations={driverLocations}
          warehouse={warehouse}
          showGreedyRoutesPerDriver
          className="h-[320px] min-h-[300px] md:h-[400px]"
        />
        {warehouse ? (
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
            <span className="font-medium text-slate-700">Route line colors (per driver):</span>
            {ROUTE_PREVIEW_PALETTE.slice(0, 6).map((c, i) => (
              <span key={c} className="inline-flex items-center gap-1">
                <span className="h-1 w-6 rounded-full" style={{ backgroundColor: c }} />
                Driver {i + 1}
              </span>
            ))}
            <span className="text-slate-500">…then repeats for more vans.</span>
          </div>
        ) : null}
      </section>

      {/* Per-driver boards */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">By driver</h2>
        <p className="mb-4 text-sm text-slate-600">
          Reassign to another active driver or clear the van for a stop (unassign is saved to the server).
        </p>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {activeDrivers.map((dr) => {
            const stops = assignedOpen.filter((x) => x.assignedDriverId === dr.id)
            return (
              <div
                key={dr.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">{dr.name}</p>
                  <p className="text-xs text-slate-500">
                    {dr.vehicleLabel} · {stops.length} active stop
                    {stops.length === 1 ? '' : 's'}
                  </p>
                </div>
                {stops.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">No active stops</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {stops.map((d) => (
                      <li key={d.id} className="space-y-2 px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{d.recipientName}</p>
                            <p className="line-clamp-1 text-xs text-slate-500">{d.address}</p>
                          </div>
                          {statusPill(d.status)}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            disabled={isMutating}
                            value={selectedFor(d.id)}
                            onChange={(e) => setSelectedFor(d.id, e.target.value)}
                            className="min-h-[38px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            aria-label={`Move ${d.recipientName} to another driver`}
                          >
                            <option value="">Move to driver…</option>
                            {activeDrivers
                              .filter((x) => x.id !== dr.id)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            disabled={isMutating || !selectedFor(d.id)}
                            onClick={() => void runAssign(d.id)}
                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                          >
                            Move
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => void unassign(d.id)}
                          className="text-xs font-medium text-red-700 underline decoration-red-300 hover:text-red-900"
                        >
                          Unassign
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
