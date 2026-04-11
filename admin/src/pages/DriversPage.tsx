/**
 * Driver roster with admin CRUD: create login (email + password), edit profile/password, remove driver.
 * Only admins reach this page (see ProtectedRoute). Backend will enforce the same with JWT + roles.
 */
import { useState, type FormEvent } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useDashboardData } from '@/contexts/DashboardDataContext'
import type { Driver } from '@/types'

export function DriversPage() {
  const {
    drivers,
    deliveries,
    isLoading,
    loadError,
    refresh,
    createDriver,
    updateDriver,
    deleteDriver,
    isMutating,
  } = useDashboardData()

  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null)
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function showBanner(type: 'ok' | 'err', text: string) {
    setBanner({ type, text })
    window.setTimeout(() => setBanner(null), 6000)
  }

  if (isLoading) return <LoadingSpinner label="Loading drivers…" />
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Drivers</h1>
          <p className="text-slate-600">
            Create driver accounts (email = login). Share the password you set so they can sign in
            to the <strong>driver application</strong>.
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
              setEditing(null)
              setModal('create')
            }}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Add driver
          </button>
        </div>
      </div>

      {banner ? (
        <div
          role="status"
          className={
            banner.type === 'ok'
              ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
              : 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name / login</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Deliveries</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drivers.map((d) => {
              const n = deliveries.filter((x) => x.assignedDriverId === d.id).length
              return (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.vehicleLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{d.phone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        d.isActive
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
                          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                      }
                    >
                      {d.isActive ? 'Active' : 'Off duty'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{n}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => {
                          setEditing(d)
                          setModal('edit')
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => setDeleteTarget(d)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal === 'create' ? (
        <DriverModal
          title="Add driver"
          submitLabel="Create driver"
          isMutating={isMutating}
          onClose={() => setModal(null)}
          onSubmit={async (values) => {
            try {
              await createDriver(values)
              setModal(null)
              showBanner(
                'ok',
                `Driver created. They can log in with ${values.email} and the password you set.`,
              )
            } catch (e) {
              showBanner('err', e instanceof Error ? e.message : 'Could not create driver.')
            }
          }}
        />
      ) : null}

      {modal === 'edit' && editing ? (
        <DriverModal
          title="Edit driver"
          submitLabel="Save changes"
          isMutating={isMutating}
          initial={editing}
          isEdit
          onClose={() => {
            setModal(null)
            setEditing(null)
          }}
          onSubmit={async (values) => {
            try {
              await updateDriver(editing.id, {
                name: values.name,
                email: values.email,
                phone: values.phone,
                vehicleLabel: values.vehicleLabel,
                isActive: values.isActive,
                newPassword: values.password || undefined,
              })
              setModal(null)
              setEditing(null)
              showBanner('ok', 'Driver updated.')
            } catch (e) {
              showBanner('err', e instanceof Error ? e.message : 'Could not update driver.')
            }
          }}
        />
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Remove driver?</h2>
            <p className="mt-2 text-sm text-slate-600">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) will be removed. Their
              assigned stops will be unassigned.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={async () => {
                  try {
                    await deleteDriver(deleteTarget.id)
                    setDeleteTarget(null)
                    showBanner('ok', 'Driver removed.')
                  } catch (e) {
                    showBanner(
                      'err',
                      e instanceof Error ? e.message : 'Could not remove driver.',
                    )
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isMutating ? 'Removing…' : 'Remove driver'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type DriverFormValues = {
  name: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  vehicleLabel: string
  isActive: boolean
}

function emptyCreateForm(): DriverFormValues {
  return {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    vehicleLabel: '',
    isActive: true,
  }
}

function driverToForm(d: Driver): DriverFormValues {
  return {
    name: d.name,
    email: d.email,
    password: '',
    confirmPassword: '',
    phone: d.phone,
    vehicleLabel: d.vehicleLabel,
    isActive: d.isActive,
  }
}

function DriverModal({
  title,
  submitLabel,
  isMutating,
  initial,
  isEdit,
  onClose,
  onSubmit,
}: {
  title: string
  submitLabel: string
  isMutating: boolean
  initial?: Driver
  isEdit?: boolean
  onClose: () => void
  onSubmit: (values: {
    name: string
    email: string
    password: string
    phone: string
    vehicleLabel: string
    isActive: boolean
  }) => Promise<void>
}) {
  const [form, setForm] = useState<DriverFormValues>(() =>
    initial ? driverToForm(initial) : emptyCreateForm(),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (!isEdit) {
      if (form.password.length < 6) {
        setLocalError('Password must be at least 6 characters.')
        return
      }
      if (form.password !== form.confirmPassword) {
        setLocalError('Passwords do not match.')
        return
      }
    } else if (form.password.length > 0 && form.password.length < 6) {
      setLocalError('New password must be at least 6 characters, or leave both blank.')
      return
    } else if (form.password !== form.confirmPassword) {
      setLocalError('Password fields do not match.')
      return
    }
    await onSubmit({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim(),
      vehicleLabel: form.vehicleLabel.trim(),
      isActive: form.isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {isEdit ? (
          <p className="mt-1 text-sm text-slate-500">
            Leave password fields empty to keep the current password.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            The driver uses <strong>email</strong> and <strong>password</strong> in the mobile
            app.
          </p>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
          {localError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</p>
          ) : null}
          <div>
            <label className="text-xs font-medium text-slate-600">Full name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Email (login username)</label>
            <input
              required
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              {isEdit ? 'New password (optional)' : 'Password'}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required={!isEdit}
              minLength={isEdit ? 0 : 6}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              {isEdit ? 'Confirm new password' : 'Confirm password'}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required={!isEdit}
              minLength={isEdit ? 0 : 6}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Phone</label>
            <input
              required
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Vehicle label</label>
            <input
              required
              placeholder="e.g. VAN-12"
              value={form.vehicleLabel}
              onChange={(e) => setForm((f) => ({ ...f, vehicleLabel: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active (can receive assignments)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isMutating ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
