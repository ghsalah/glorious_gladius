/**
 * Operational overview: counts and per-driver maps (routes only on those cards).
 */
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useDashboardData } from '@/contexts/DashboardDataContext'
import { FleetControlCenter } from '@/components/dashboard/FleetControlCenter'
import type { DeliveryStatus } from '@/types'

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100/50 transition-all hover:shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-4xl font-black text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p> : null}
    </div>
  )
}

function countByStatus(deliveries: { status: DeliveryStatus }[]) {
  return deliveries.reduce(
    (acc, d) => {
      acc[d.status] += 1
      return acc
    },
    { pending: 0, accepted: 0, in_progress: 0, completed: 0 } as Record<DeliveryStatus, number>,
  )
}

export function DashboardPage() {
  const { deliveries, drivers, driverLocations, warehouse, isLoading, loadError, refresh } =
    useDashboardData()

  if (isLoading) {
    return <LoadingSpinner label="Loading today’s operations…" />
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p className="font-medium">{loadError}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    )
  }

  const activeDrivers = drivers.filter((d) => d.isActive).length
  const assigned = deliveries.filter((d) => d.assignedDriverId).length
  const status = countByStatus(deliveries)
  const awaitingDriver = deliveries.filter(
    (d) => !d.assignedDriverId && d.status !== 'completed',
  ).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Operations overview</h1>
        <p className="text-slate-600">
          Flower Distribution — see every driver’s route on their own map below. For a single map with
          all stop pins (no lines), use the{' '}
          <Link to="/deliveries" className="font-medium text-emerald-700 underline hover:text-emerald-900">
            Deliveries
          </Link>{' '}
          page with filter “All”.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to="/assign"
            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Assign deliveries to drivers
          </Link>
          {awaitingDriver > 0 ? (
            <span className="text-sm text-amber-800">
              {awaitingDriver} stop{awaitingDriver === 1 ? '' : 's'} still need a driver
            </span>
          ) : (
            <span className="text-sm text-slate-500">All open stops have a driver</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Deliveries today" value={deliveries.length} />
        <StatCard label="Assigned stops" value={assigned} hint="Linked to a driver van" />
        <StatCard label="Active drivers" value={activeDrivers} />
        <StatCard
          label="In progress"
          value={status.in_progress}
          hint={`${status.pending} pending · ${status.accepted} accepted · ${status.completed} done`}
        />
      </div>

      <section className="mt-8">
        <FleetControlCenter 
          drivers={drivers}
          deliveries={deliveries}
          driverLocations={driverLocations}
          warehouse={warehouse}
        />
      </section>
    </div>
  )
}
