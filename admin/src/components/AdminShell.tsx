/**
 * Persistent chrome: sidebar navigation + top bar with change password and logout.
 */
import { useState, type FormEvent } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { PasswordInput } from '@/components/PasswordInput'
import { useAuth } from '@/contexts/AuthContext'
import { changePasswordRequest } from '@/services/api'

/** Served from `public/glorious-gladius-logo.png`. */
const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}glorious-gladius-logo.png`

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-emerald-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError('New password and confirmation do not match.')
      return
    }
    setPending(true)
    try {
      await changePasswordRequest({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use a strong password. Your current session stays signed in.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <PasswordInput
            id="cp-current"
            label="Current password"
            labelClassName="text-xs font-medium text-slate-600"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            required
            inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 pr-11 text-sm"
          />
          <PasswordInput
            id="cp-new"
            label="New password"
            labelClassName="text-xs font-medium text-slate-600"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            required
            minLength={6}
            inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 pr-11 text-sm"
          />
          <PasswordInput
            id="cp-confirm"
            label="Confirm new password"
            labelClassName="text-xs font-medium text-slate-600"
            value={newPasswordConfirm}
            onChange={setNewPasswordConfirm}
            autoComplete="new-password"
            required
            minLength={6}
            inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 pr-11 text-sm"
          />
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
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AdminShell() {
  const { user, logout } = useAuth()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {/* Sidebar - Desktop: sticky, Mobile: overlay/drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
          <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-6 py-6 md:justify-start md:gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={BRAND_LOGO_SRC}
                alt=""
                width={140}
                height={56}
                className="h-14 w-auto max-w-[9.5rem] shrink-0 object-contain object-left"
                decoding="async"
              />
              <div className="min-w-0">
                <p className="font-serif text-sm font-semibold leading-tight text-[#1B3022]">Glorious Gladius</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Admin console
                </p>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 md:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-1.5 px-4 pb-4 overflow-y-auto">
            <NavLink to="/" end className={navClass} onClick={() => setIsMobileMenuOpen(false)}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Overview
            </NavLink>
            <NavLink to="/assign" className={navClass} onClick={() => setIsMobileMenuOpen(false)}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Assign to drivers
            </NavLink>
            <NavLink to="/deliveries" className={navClass} onClick={() => setIsMobileMenuOpen(false)}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Deliveries
            </NavLink>
            <NavLink to="/drivers" className={navClass} onClick={() => setIsMobileMenuOpen(false)}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Drivers
            </NavLink>
            <NavLink to="/warehouse" className={navClass} onClick={() => setIsMobileMenuOpen(false)}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Warehouse
            </NavLink>
          </nav>

        </div>
      </aside>

      {/* Mobile background overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            {/* Hamburger menu */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden md:block">
              <h1 className="text-sm font-semibold text-slate-900">Operations dashboard</h1>
              <p className="mt-0.5 text-xs text-slate-500">Glorious Gladius</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-semibold text-slate-900 leading-none">{user?.name}</p>
              <p className="mt-1 truncate text-xs text-slate-500 leading-none">{user?.email}</p>
            </div>
            
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                title="Account Settings"
                className="rounded-full bg-white p-2 text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-emerald-700 transition-all outline-none"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-all active:scale-95"
              >
                <span>Logout</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  )
}
