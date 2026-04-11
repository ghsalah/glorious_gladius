/**
 * Admin sign-in against Django `/auth/login` (JWT).
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}glorious-gladius-logo.png`

export function LoginPage() {
  const { user, login, isSubmitting, error, clearError, isReady } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from
    ?.pathname

  const [email, setEmail] = useState('admin@glorious-gladius.local')
  const [password, setPassword] = useState('')

  useEffect(() => {
    clearError()
  }, [email, password, clearError])

  if (!isReady) return null
  if (user?.role === 'admin') {
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await login(email, password)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <img
            src={BRAND_LOGO_SRC}
            alt=""
            width={200}
            height={100}
            className="mx-auto h-24 w-auto max-w-full object-contain"
            decoding="async"
          />
          <h1 className="mt-4 font-serif text-xl font-semibold text-[#1B3022]">Glorious Gladius</h1>
          <p className="mt-1 text-sm text-slate-500">Administrator console</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-600">
          Default admin: <strong>admin@glorious-gladius.local</strong> /{' '}
          <strong>admin@123</strong> (seeded on the server with{' '}
          <code className="text-xs">seed_admin</code>). Driver accounts cannot use this console.
        </p>
      </div>
    </div>
  )
}
