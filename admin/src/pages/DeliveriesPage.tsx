/**
 * Delivery board: filter by status, assign drivers, create stops. Status is read-only here (driver app updates it).
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DeliveriesMap } from '@/components/DeliveriesMap'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useDashboardData } from '@/contexts/DashboardDataContext'
import {
  DELIVERY_STATUS_HEX,
  DRIVER_VAN_HEX,
  WAREHOUSE_HEX,
  deliveryStatusLabel,
} from '@/lib/deliveryStatusStyle'
import {
  googleMapsOpenPinUrl,
  isShortMapsLink,
  parseLatLngFromGoogleMapsInput,
  resolveGoogleMapsInputToLatLng,
} from '@/lib/googleMapsUrl'
import type { Delivery, DeliveryStatus } from '@/types'

const STATUS_OPTIONS: DeliveryStatus[] = ['pending', 'accepted', 'in_progress', 'completed']

function statusPill(status: DeliveryStatus) {
  const map = {
    pending: 'bg-slate-100 text-slate-700',
    accepted: 'bg-blue-100 text-blue-900',
    in_progress: 'bg-amber-100 text-amber-900',
    completed: 'bg-emerald-100 text-emerald-900',
  } as const
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function DeliveriesPage() {
  const {
    deliveries,
    drivers,
    driverLocations,
    warehouse,
    isLoading,
    loadError,
    refresh,
    createDelivery,
    updateDelivery,
    deleteDelivery,
    assignDelivery,
    isMutating,
  } = useDashboardData()

  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    address: '',
    recipientName: '',
    recipientPhone: '',
    mapLinkOrCoords: '',
    notes: '',
  })
  const [locationHint, setLocationHint] = useState<string | null>(null)
  const [isResolvingMapLink, setIsResolvingMapLink] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null)

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return deliveries
    return deliveries.filter((d) => d.status === statusFilter)
  }, [deliveries, statusFilter])

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

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setLocationHint(null)
    const recipient = form.recipientName.trim()
    const address = form.address.trim()
    if (recipient.length < 2) {
      setLocationHint('Recipient name must be at least 2 characters.')
      return
    }
    if (address.length < 8) {
      setLocationHint('Address must be at least 8 characters.')
      return
    }
    setIsResolvingMapLink(true)
    let parsed: { lat: number; lng: number } | null = null
    try {
      parsed = await resolveGoogleMapsInputToLatLng(form.mapLinkOrCoords)
    } catch {
      parsed = null
    } finally {
      setIsResolvingMapLink(false)
    }
    if (!parsed) {
      setLocationHint(
        'Could not read coordinates from that link. Try the long URL from your browser’s address bar after opening the pin, or paste lat, lng (e.g. 52.37, 4.90).',
      )
      return
    }
    await createDelivery({
      address,
      lat: parsed.lat,
      lng: parsed.lng,
      recipientName: recipient,
      recipientPhone: form.recipientPhone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
    setShowCreate(false)
    setForm({
      address: '',
      recipientName: '',
      recipientPhone: '',
      mapLinkOrCoords: '',
      notes: '',
    })
  }

  async function onUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editingDelivery) return
    setLocationHint(null)
    const recipient = form.recipientName.trim()
    const address = form.address.trim()
    if (recipient.length < 2) {
      setLocationHint('Recipient name must be at least 2 characters.')
      return
    }
    if (address.length < 8) {
      setLocationHint('Address must be at least 8 characters.')
      return
    }

    let coords: { lat: number; lng: number } | null = {
      lat: editingDelivery.lat,
      lng: editingDelivery.lng,
    }

    if (form.mapLinkOrCoords && form.mapLinkOrCoords !== `${editingDelivery.lat}, ${editingDelivery.lng}`) {
      setIsResolvingMapLink(true)
      try {
        coords = await resolveGoogleMapsInputToLatLng(form.mapLinkOrCoords)
      } catch {
        coords = null
      } finally {
        setIsResolvingMapLink(false)
      }
    }

    if (!coords) {
      setLocationHint('Could not read coordinates. Keep the original or paste valid ones.')
      return
    }

    await updateDelivery(editingDelivery.id, {
      address,
      lat: coords.lat,
      lng: coords.lng,
      recipientName: recipient,
      recipientPhone: form.recipientPhone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
    setEditingDelivery(null)
    setForm({ address: '', recipientName: '', recipientPhone: '', mapLinkOrCoords: '', notes: '' })
  }

  async function onDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this delivery?')) return
    await deleteDelivery(id)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deliveries</h1>
          <p className="text-slate-600">
            {deliveries.length} stops — assign vans here. Delivery status is updated by drivers in the driver app
            when they finish a stop.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            The map uses the same status filter as the table: dot colors are pending (slate), accepted (blue),
            in progress (amber), and completed (green). Vans and warehouse have their own colors. For multi-driver route
            lines from the depot, open the{' '}
            <Link to="/assign" className="font-medium text-emerald-700 underline hover:text-emerald-900">
              Assign to drivers
            </Link>{' '}
            page.
          </p>
          <p className="mt-2 text-sm">
            <Link
              to="/assign"
              className="font-semibold text-emerald-700 underline decoration-emerald-300 hover:text-emerald-900"
            >
              Open the Assign to drivers page
            </Link>{' '}
            for a dedicated dispatch view (queue + per-driver boards).
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
          <button
            type="button"
            onClick={() => {
              setEditingDelivery(null)
              setForm({ address: '', recipientName: '', recipientPhone: '', mapLinkOrCoords: '', notes: '' })
              setShowCreate(true)
            }}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New delivery
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUS_OPTIONS] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={
              statusFilter === s
                ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50'
            }
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Map legend</span>
          <span className="text-slate-500">
            {statusFilter === 'all' ? 'All statuses' : deliveryStatusLabel(statusFilter)}
          </span>
          {STATUS_OPTIONS.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: DELIVERY_STATUS_HEX[s] }}
              />
              {deliveryStatusLabel(s)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: DRIVER_VAN_HEX }}
            />
            Van GPS
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: WAREHOUSE_HEX }}
            />
            Warehouse
          </span>
        </div>
        <DeliveriesMap
          key={statusFilter}
          deliveries={filtered}
          driverLocations={driverLocations}
          warehouse={warehouse}
          className="h-[300px] md:h-[400px]"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          {filtered.length} shown
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Recipient</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Seq</th>
                <th className="px-4 py-2">Google Maps pin</th>
                <th className="px-4 py-2">Assign</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <DeliveryRow
                  key={d.id}
                  delivery={d}
                  drivers={drivers}
                  disabled={isMutating}
                  onAssign={(driverId) => {
                    void assignDelivery(d.id, driverId)
                  }}
                  onEdit={(delivery) => {
                    setShowCreate(false)
                    setEditingDelivery(delivery)
                    setForm({
                      address: delivery.address,
                      recipientName: delivery.recipientName,
                      recipientPhone: delivery.recipientPhone ?? '',
                      mapLinkOrCoords: `${delivery.lat}, ${delivery.lng}`,
                      notes: delivery.notes ?? '',
                    })
                  }}
                  onDelete={() => void onDelete(d.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Create delivery</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use the large box for the full delivery address. One line for the Google Maps pin (browser URL
              with <code className="text-xs">@lat,lng</code>) or coordinates like{' '}
              <code className="text-xs">52.37, 4.90</code>.
            </p>
            <form onSubmit={onCreate} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Recipient</label>
                <input
                  required
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Contact Number</label>
                <input
                  required
                  value={form.recipientPhone}
                  onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                  placeholder="e.g. +1234567890"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Address</label>
                <textarea
                  required
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, number, postcode, city, instructions for the driver…"
                  rows={5}
                  className="mt-1 min-h-[120px] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Google Maps location (link or coordinates)
                </label>
                <input
                  type="text"
                  required
                  value={form.mapLinkOrCoords}
                  onChange={(e) => {
                    setLocationHint(null)
                    setForm((f) => ({ ...f, mapLinkOrCoords: e.target.value }))
                  }}
                  placeholder="https://www.google.com/maps/…/@52.37,4.90,17z or 52.37, 4.90"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                {locationHint ? (
                  <p className="mt-1 text-xs text-amber-800">{locationHint}</p>
                ) : form.mapLinkOrCoords.trim() ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {(() => {
                      const p = parseLatLngFromGoogleMapsInput(form.mapLinkOrCoords)
                      if (p) return `Using pin: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
                      if (isShortMapsLink(form.mapLinkOrCoords))
                        return 'Google share link — coordinates are resolved when you click Create (needs network).'
                      return 'No coordinates in this text yet — long maps URLs and lat, lng both work.'
                    })()}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLocationHint(null)
                    setShowCreate(false)
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating || isResolvingMapLink}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isResolvingMapLink
                    ? 'Resolving map…'
                    : isMutating
                      ? 'Saving…'
                      : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingDelivery ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Edit delivery</h2>
            <form onSubmit={onUpdate} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Recipient</label>
                <input
                  required
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Contact Number</label>
                <input
                  required
                  value={form.recipientPhone}
                  onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Address</label>
                <textarea
                  required
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Google Maps location (change only if needed)
                </label>
                <input
                  type="text"
                  required
                  value={form.mapLinkOrCoords}
                  onChange={(e) => setForm((f) => ({ ...f, mapLinkOrCoords: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                />
                {locationHint && <p className="mt-1 text-xs text-amber-800">{locationHint}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDelivery(null)
                    setForm({ address: '', recipientName: '', recipientPhone: '', mapLinkOrCoords: '', notes: '' })
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating || isResolvingMapLink}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isMutating ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DeliveryRow({
  delivery: d,
  drivers,
  disabled,
  onAssign,
  onEdit,
  onDelete,
}: {
  delivery: Delivery
  drivers: { id: string; name: string; isActive: boolean }[]
  disabled: boolean
  onAssign: (driverId: string) => void
  onEdit: (delivery: Delivery) => void
  onDelete: () => void
}) {
  const mapsUrl = googleMapsOpenPinUrl(d.lat, d.lng)
  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-4 py-3 font-medium text-slate-900">{d.recipientName}</td>
      <td className="px-4 py-3 text-slate-600">
        {d.recipientPhone ? (
          <a
            href={`tel:${d.recipientPhone}`}
            className="font-medium text-emerald-700 underline decoration-emerald-200 hover:text-emerald-900"
          >
            {d.recipientPhone}
          </a>
        ) : (
          <span className="text-slate-400 italic">No number</span>
        )}
      </td>
      <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={d.address}>
        {d.address}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {statusPill(d.status)}
          <span className="text-[10px] font-normal text-slate-400">Driver app</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">
        {d.assignedDriverId
          ? drivers.find((x) => x.id === d.assignedDriverId)?.name ?? '—'
          : '—'}
      </td>
      <td className="px-4 py-3 text-slate-600">{d.sequenceOrder ?? '—'}</td>
      <td className="max-w-[200px] px-4 py-3">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-xs font-medium text-emerald-700 underline decoration-emerald-200 hover:text-emerald-900"
          title={mapsUrl}
        >
          Open in Google Maps
        </a>
        <p className="mt-1 font-mono text-[10px] leading-tight text-slate-400">
          {d.lat.toFixed(5)}, {d.lng.toFixed(5)}
        </p>
      </td>
      <td className="px-4 py-3">
        <select
          key={`assign-${d.id}-${d.assignedDriverId ?? 'none'}`}
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value
            if (v) onAssign(v)
          }}
          className="w-full max-w-[180px] rounded border border-slate-200 px-2 py-1.5 text-xs"
        >
          <option value="">Assign driver…</option>
          {drivers
            .filter((dr) => dr.isActive)
            .map((dr) => (
              <option key={dr.id} value={dr.id}>
                {dr.name}
              </option>
            ))}
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(d)}
            disabled={disabled}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Edit"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
