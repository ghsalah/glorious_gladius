import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/LoadingSpinner'

/** Restricts nested routes to authenticated admin sessions. */
export function ProtectedRoute() {
  const { token, user, isReady } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return <LoadingSpinner label="Restoring session…" />
  }

  if (!token || !user || user.role !== 'admin') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
