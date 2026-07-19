import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Truck, BarChart3, Settings, Bell, LogOut, ChevronRight,
  Menu, X, TrendingUp, UserCog, Building2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore, selectUnreadCount } from '@/store/appStore';
import NotificationDrawer from './NotificationDrawer';

const NAV = [
  { to: '/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin','commercial','gestionnaire','comptable','lecteur'] },
  { to: '/clients',      label: 'Clients',          icon: Users,           roles: ['admin','commercial','gestionnaire','lecteur'] },
  { to: '/produits',     label: 'Catalogue & Stock', icon: Package,        roles: ['admin','commercial','gestionnaire','lecteur'] },
  { to: '/commandes',    label: 'Commandes & Devis', icon: ShoppingCart,   roles: ['admin','commercial','gestionnaire','lecteur'] },
  { to: '/facturation',  label: 'Facturation',       icon: FileText,       roles: ['admin','comptable','gestionnaire','lecteur'] },
  { to: '/fournisseurs', label: 'Fournisseurs',      icon: Truck,          roles: ['admin','gestionnaire','comptable','lecteur'] },
  { to: '/rapports',     label: 'Rapports',          icon: BarChart3,      roles: ['admin','comptable','gestionnaire'] },
  { to: '/utilisateurs', label: 'Utilisateurs',      icon: UserCog,        roles: ['admin'] },
  { to: '/configuration',label: 'Configuration',     icon: Settings,       roles: ['admin'] },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const unread = useAppStore(selectUnreadCount);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = NAV.filter((n) => user && n.roles.includes(user.role as never));

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-cream)' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={clsx(
          'flex flex-col shrink-0 transition-all duration-300 overflow-hidden',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
        style={{ backgroundColor: '#111' }}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--color-gold)' }}
            >
              <Building2 size={16} className="text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Kiosq</p>
                <p className="text-xs font-mono tracking-widest uppercase" style={{ color: 'var(--color-gold)' }}>
                  Commercial
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                  isActive
                    ? 'text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )
              }
              style={({ isActive }) =>
                isActive ? { backgroundColor: 'var(--color-gold)' } : {}
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

        {/* User */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 mb-3 px-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(184,147,90,0.2)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--color-gold)' }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">
                  {user?.prenom} {user?.nom}
                </p>
                <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {user?.role}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(184,147,90,0.2)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--color-gold)' }}>
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

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header
          className="h-14 bg-white border-b px-6 flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--color-cream-dark)' }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-ink-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-cream)';
                e.currentTarget.style.color = 'var(--color-ink)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-ink-muted)';
              }}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <p className="text-xs font-mono" style={{ color: 'var(--color-ink-muted)' }}>
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              onClick={() => setNotifOpen(true)}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-ink-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-cream)';
                e.currentTarget.style.color = 'var(--color-ink)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-ink-muted)';
              }}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white bg-red-500" />
              )}
            </button>

            {/* Quick stat pill */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
            >
              <TrendingUp size={12} />
              <span>CA Juin : 8 200 000 F</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
