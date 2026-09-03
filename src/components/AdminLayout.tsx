import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { to: '/admin/agenda',        label: 'Agenda', icon: '📅' },
  { to: '/admin/historico',     label: 'Histórico', icon: '📜' },
  { to: '/admin/servicos',      label: 'Serviços & Combos', icon: '✂️' },
  { to: '/admin/bloqueios',     label: 'Bloqueios', icon: '🚫' },
  { to: '/admin/configuracoes', label: 'Configurações', icon: '⚙️' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="admin-layout">
      {/* Mobile topbar */}
      <div className="admin-topbar">
        <span className="admin-topbar__logo">Stay Beautiful</span>
        <button className="admin-topbar__menu" onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar */}
      <aside className="admin-sidebar" style={mobileOpen ? { display: 'flex', position: 'fixed', inset: 0, zIndex: 150 } : {}}>
        <div className="admin-sidebar__logo">Stay Beautiful</div>
        <nav className="admin-sidebar__nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar__logout">
          <button className="btn btn--ghost btn--sm" style={{ color: 'rgba(245,245,245,0.7)', width: '100%' }} onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}
