/**
 * SuperadminLayout — dedicated layout for the /superadmin backoffice.
 *
 * Dark sidebar (bg #1a1a2e) with platform logo and navigation links to
 * Dashboard and Boutiques. Uses React Router's <Outlet /> for page content.
 *
 * Requirements: 4.1, 4.2
 */

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Store,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: '/superadmin',          label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/superadmin/boutiques', label: 'Boutiques',  icon: Store },
];

// Sidebar background — very dark navy, distinct from the regular app sidebar (#111)
const SIDEBAR_BG = '#1a1a2e';
const SIDEBAR_ACCENT = '#e94560';   // red-ish accent for the superadmin brand

export default function SuperadminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={clsx(
          'flex flex-col shrink-0 transition-all duration-300 overflow-hidden',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        {/* Logo / brand */}
        <div
          className="px-4 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: SIDEBAR_ACCENT }}
            >
              <Shield size={16} className="text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Kiosq</p>
                <p
                  className="text-xs font-mono tracking-widest uppercase"
                  style={{ color: SIDEBAR_ACCENT }}
                >
                  Superadmin
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                  isActive
                    ? 'text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )
              }
              style={({ isActive }) =>
                isActive ? { backgroundColor: SIDEBAR_ACCENT } : {}
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className="shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 truncate">{label}</span>
                      {isActive && <ChevronRight size={12} />}
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div
          className="px-3 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3 mb-3 px-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${SIDEBAR_ACCENT}33` }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: SIDEBAR_ACCENT }}
                >
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">
                  {user?.prenom} {user?.nom}
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Superadmin
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${SIDEBAR_ACCENT}33` }}
              >
                <span className="text-xs font-bold" style={{ color: SIDEBAR_ACCENT }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut size={13} className="shrink-0" />
            {sidebarOpen && 'Déconnexion'}
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header
          className="h-14 bg-white border-b px-6 flex items-center justify-between shrink-0"
          style={{ borderColor: '#e5e7eb' }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex items-center gap-2">
              <Shield size={14} style={{ color: SIDEBAR_ACCENT }} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Backoffice Plateforme
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-400 font-mono">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
