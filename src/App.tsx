import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

// Public pages
import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'
import ConfirmationPage from './pages/ConfirmationPage'
import CancelPage from './pages/CancelPage'

// Admin pages
import AdminLoginPage from './pages/admin/LoginPage'
import AdminAgendaPage from './pages/admin/AgendaPage'
import AdminHistoryPage from './pages/admin/HistoryPage'
import AdminServicesPage from './pages/admin/ServicesPage'
import AdminBlocksPage from './pages/admin/BlocksPage'
import AdminSettingsPage from './pages/admin/SettingsPage'
import AdminLayout from './components/AdminLayout'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return session ? <>{children}</> : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/agendar" element={<BookingPage />} />
      <Route path="/confirmacao" element={<ConfirmationPage />} />
      <Route path="/cancelar/:token" element={<CancelPage />} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/admin/agenda" replace />} />
        <Route path="agenda" element={<AdminAgendaPage />} />
        <Route path="historico" element={<AdminHistoryPage />} />
        <Route path="servicos" element={<AdminServicesPage />} />
        <Route path="bloqueios" element={<AdminBlocksPage />} />
        <Route path="configuracoes" element={<AdminSettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
