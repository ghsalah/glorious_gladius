/**
 * Configure warehouse / shop coordinates. Persisted on the server; maps and auto-route use this as the start point.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { DeliveriesMap } from '@/components/DeliveriesMap'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useDashboardData } from '@/contexts/DashboardDataContext'
import { resolveGoogleMapsInputToLatLng } from '@/lib/googleMapsUrl'

export function WarehousePage() {
  const { warehouse, isLoading, loadError, refresh, updateWarehouse, isMutating } =
    useDashboardData()

  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [mapLinkOrCoords, setMapLinkOrCoords] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (!warehouse) return
    setLabel(warehouse.label)
    setAddress(warehouse.address)
    setMapLinkOrCoords(`${warehouse.lat}, ${warehouse.lng}`)
  }, [warehouse])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setHint(null)
    const name = label.trim()
    if (name.length < 2) {
      setHint('Name must be at least 2 characters.')
      return
    }
    setResolving(true)
    let parsed: { lat: number; lng: number } | null = null
    try {
      parsed = await resolveGoogleMapsInputToLatLng(mapLinkOrCoords)
    } catch {
      parsed = null
    } finally {
      setResolving(false)
    }
    if (!parsed) {
      setHint(
        'Could not read coordinates. Paste a full Google Maps pin URL or lat, lng (e.g. 52.37, 4.90).',
      )
      return
    }
    await updateWarehouse({
      label: name,
      address: address.trim(),
      lat: parsed.lat,
      lng: parsed.lng,
    })
    setHint(null)
  }

  if (isLoading) return <LoadingSpinner label="Loading warehouse…" />
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Warehouse / start point</h1>
        <p className="mt-1 text-slate-600">
          This is where routes begin on the map and when you use auto-assign. Update it whenever you move
          shop or depot — the new location is saved immediately after you save here.
        </p>
        {warehouse ? (
          <p className="mt-2 text-xs text-slate-500">
            Last updated: {new Date(warehouse.updatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">Details</h2>
          {hint ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {hint}
            </p>
          ) : null}
          <div>
            <label className="text-xs font-medium text-slate-600">Name (shown on map)</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main warehouse, Shop Amsterdam"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Address (optional, for your records)</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, postcode, city…"
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              Map pin (Google Maps link or coordinates)
            </label>
            <textarea
              required
              value={mapLinkOrCoords}
              onChange={(e) => setMapLinkOrCoords(e.target.value)}
              placeholder="Paste maps link or e.g. 52.3676, 4.9041"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isMutating || resolving}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {resolving || isMutating ? 'Saving…' : 'Save warehouse location'}
          </button>
        </form>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Preview</h2>
          <p className="mb-3 text-sm text-slate-600">
            Warehouse marker and map center use the saved coordinates (form above updates after save).
          </p>
          {warehouse ? (
            <DeliveriesMap
              deliveries={[]}
              driverLocations={[]}
              warehouse={warehouse}
              className="h-[360px] min-h-[320px]"
            />
          ) : (
            <p className="text-sm text-slate-500">No warehouse data yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
