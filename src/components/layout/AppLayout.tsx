import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Truck, BarChart3, Settings, Bell, LogOut, ChevronRight,
  Menu, X, TrendingUp, UserCog, Store, AlertTriangle, Crosshair, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore, selectUnreadCount } from '@/store/appStore';
import { useLeadsStore } from '@/store/leadsStore';
import { formatPrice } from '@/lib/format';
import NotificationDrawer from './NotificationDrawer';
import ImpersonationBanner from '@/components/superadmin/ImpersonationBanner';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { ShieldCheck, History, Layers } from 'lucide-react';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: readonly string[];
  badge?: 'leadsNouveau';
};

const NAV: NavItem[] = [
  { to: '/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin','commercial','gestionnaire','comptable','lecteur'] },
  { to: '/pos',          label: 'Caisse / POS',    icon: Store,           roles: ['admin','commercial','gestionnaire'] },
  { to: '/leads',        label: 'Capture de Leads', icon: Crosshair,      roles: ['admin','commercial','gestionnaire'], badge: 'leadsNouveau' },
  { to: '/clients',      label: 'Clients',          icon: Users,           roles: ['admin','commercial','gestionnaire','lecteur'] },
  { to: '/produits',     label: 'Catalogue & Stock', icon: Package,        roles: ['admin','commercial','gestionnaire','lecteur'] },
  { to: '/templates',    label: 'Templates Catalogue', icon: Layers,       roles: ['admin','gestionnaire'] },
  { to: '/commandes',    label: 'Commandes & Devis', icon: ShoppingCart,   roles: ['admin','commercial','gestionnaire','lecteur'] },
  { to: '/facturation',  label: 'Facturation',       icon: FileText,       roles: ['admin','comptable','gestionnaire','lecteur'] },
  { to: '/fournisseurs', label: 'Fournisseurs',      icon: Truck,          roles: ['admin','gestionnaire','comptable','lecteur'] },
  { to: '/rapports',     label: 'Rapports',          icon: BarChart3,      roles: ['admin','comptable','gestionnaire'] },
  { to: '/utilisateurs', label: 'Utilisateurs',      icon: UserCog,        roles: ['admin'] },
  { to: '/configuration/abonnement', label: 'Mon Abonnement', icon: ShieldCheck, roles: ['admin'] },
  { to: '/configuration/audit', label: 'Journal d\'Audit', icon: History,    roles: ['admin'] },
  { to: '/configuration',label: 'Configuration',     icon: Settings,       roles: ['admin'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const unread = useAppStore(selectUnreadCount);
  const commandes = useAppStore(s => s.commandes);
  const error = useAppStore(s => s.error);
  const leadsNouveauCount = useLeadsStore(s => s.leadsNouveauCount);
  const fetchLeadsNouveauCount = useLeadsStore(s => s.fetchLeadsNouveauCount);
  const [notifOpen, setNotifOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchLeadsNouveauCount();
    const interval = setInterval(fetchLeadsNouveauCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchLeadsNouveauCount]);

  // Live CA for current month
  const caMois = (() => {
    const now = new Date();
    return commandes
      .filter(c => {
        const d = new Date(c.createdAt);
        return c.type === 'commande'
          && d.getMonth() === now.getMonth()
          && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, c) => s + c.totalTTC, 0);
  })();

  const moisLabel = new Date().toLocaleDateString('fr-FR', { month: 'long' });
  const moisLabelCap = moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1);

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
              <img src="/icon.png" alt="Kiosq Logo" className="w-6 h-6 object-contain" />
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
          {navItems.map(({ to, label, icon: Icon, badge }) => (
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
                      {badge === 'leadsNouveau' && leadsNouveauCount > 0 && (
                        <span
                          className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                          style={{ backgroundColor: '#f97316' }}
                        >
                          {leadsNouveauCount > 99 ? '99+' : leadsNouveauCount}
                        </span>
                      )}
                      {isActive && !badge && <ChevronRight size={12} />}
                      {isActive && badge && leadsNouveauCount === 0 && <ChevronRight size={12} />}
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

        {/* Impersonation banner — shown above topbar when active */}
        <ImpersonationBanner />

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

          <div className="flex items-center gap-3">
            {/* Guide d'onboarding */}
            <button
              onClick={() => setOnboardingOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm border border-amber-200 hover:border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900"
              title="Relancer le guide de démarrage"
            >
              <Sparkles size={14} className="text-amber-600 animate-pulse" />
              <span className="hidden sm:inline">Guide de démarrage</span>
            </button>

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
              <span>CA {moisLabelCap} : {formatPrice(caMois)}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 shadow-sm animate-pulse">
              <AlertTriangle size={18} className="shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold">Problème de connexion à l'API</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <OnboardingWizard isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}
