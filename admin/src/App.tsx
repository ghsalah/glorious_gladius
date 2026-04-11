/**
 * Root routing: public login vs. protected admin area wrapped in fleet data provider.
 */
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminShell } from '@/components/AdminShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardDataProvider } from '@/contexts/DashboardDataContext'
import { AssignDeliveriesPage } from '@/pages/AssignDeliveriesPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DeliveriesPage } from '@/pages/DeliveriesPage'
import { DriversPage } from '@/pages/DriversPage'
import { LoginPage } from '@/pages/LoginPage'
import { WarehousePage } from '@/pages/WarehousePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <DashboardDataProvider>
              <AdminShell />
            </DashboardDataProvider>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="assign" element={<AssignDeliveriesPage />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="map" element={<Navigate to="/deliveries" replace />} />
          <Route path="warehouse" element={<WarehousePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
