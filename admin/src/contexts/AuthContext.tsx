/**
 * JWT auth state for the admin SPA. Token is persisted; `/auth/me` restores the user after refresh.
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
import type { AuthUser } from '@/types'
import {
  fetchAuthMe,
  getStoredToken,
  loginRequest,
  setStoredToken,
} from '@/services/api'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isReady: boolean
  isSubmitting: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [isReady, setIsReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshUser = useCallback(async () => {
    const t = getStoredToken()
    if (!t) {
      setUser(null)
      setToken(null)
      return
    }
    setToken(t)
    try {
      const me = await fetchAuthMe()
      if (me.role !== 'admin') {
        setStoredToken(null)
        setToken(null)
        setUser(null)
        return
      }
      setUser(me)
    } catch {
      setStoredToken(null)
      setToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void refreshUser().finally(() => setIsReady(true))
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await loginRequest(email, password)
      if (res.user.role !== 'admin') {
        throw new Error('Administrator role required for this application.')
      }
      setStoredToken(res.accessToken)
      setToken(res.accessToken)
      setUser(res.user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo(
    () => ({
      user,
      token,
      isReady,
      isSubmitting,
      error,
      login,
      logout,
      clearError,
      refreshUser,
    }),
    [user, token, isReady, isSubmitting, error, login, logout, clearError, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- paired hook for AuthProvider
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
