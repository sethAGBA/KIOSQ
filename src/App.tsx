import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Tenant
import { TenantProvider } from '@/contexts/TenantContext';

// Auth
import LoginPage from '@/pages/LoginPage';
import AuthGuard from '@/components/auth/AuthGuard';
import SuperadminGuard from '@/components/auth/SuperadminGuard';

// Superadmin pages (lazy — loaded only when accessed by a superadmin)
const DashboardSuperadminPage = lazy(() => import('@/pages/superadmin/DashboardSuperadminPage'));
const BoutiquesPage            = lazy(() => import('@/pages/superadmin/BoutiquesPage'));
const CreerBoutiquePage        = lazy(() => import('@/pages/superadmin/CreerBoutiquePage'));
const BoutiqueDetailPage       = lazy(() => import('@/pages/superadmin/BoutiqueDetailPage'));
const ProfilPage               = lazy(() => import('@/pages/superadmin/ProfilPage'));

// Pages
import DashboardPage from '@/pages/DashboardPage';
import ClientsPage from '@/pages/clients/ClientsPage';
import ClientDetailPage from '@/pages/clients/ClientDetailPage';
import ProduitsPage from '@/pages/produits/ProduitsPage';
import ProduitDetailPage from '@/pages/produits/ProduitDetailPage';
import CommandesPage from '@/pages/commandes/CommandesPage';
import CommandeDetailPage from '@/pages/commandes/CommandeDetailPage';
import FacturationPage from '@/pages/facturation/FacturationPage';
import FactureDetailPage from '@/pages/facturation/FactureDetailPage';
import FournisseursPage from '@/pages/fournisseurs/FournisseursPage';
import FournisseurDetailPage from '@/pages/fournisseurs/FournisseurDetailPage';
import CommandeFournisseurDetailPage from '@/pages/fournisseurs/CommandeFournisseurDetailPage';
import RapportsPage from '@/pages/rapports/RapportsPage';
import UtilisateursPage from '@/pages/utilisateurs/UtilisateursPage';
import ConfigurationPage from '@/pages/configuration/ConfigurationPage';
import AbonnementPage from '@/pages/configuration/AbonnementPage';
import AuditPage from '@/pages/configuration/AuditPage';
import MagasinsPage from '@/pages/configuration/MagasinsPage';
import TemplatesPage from '@/pages/templates/TemplatesPage';
import ExporterCataloguePage from '@/pages/templates/ExporterCataloguePage';
import EtiquettesPage from '@/pages/produits/EtiquettesPage';
import MouvementsPage from '@/pages/stock/MouvementsPage';
import InventairePage from '@/pages/stock/InventairePage';
import POSPage from '@/pages/pos/POSPage';
import HistoriqueVentesPage from '@/pages/pos/HistoriqueVentesPage';
import SortiesCaissePage from '@/pages/pos/SortiesCaissePage';
import ClotureCaissePage from '@/pages/pos/ClotureCaissePage';
import RetourClientPage from '@/pages/pos/RetourClientPage';
import RetoursListPage from '@/pages/pos/RetoursListPage';
import LeadsPage from '@/pages/leads/LeadsPage';
import LeadDetailPage from '@/pages/leads/LeadDetailPage';

// Lightweight loading fallback used for lazy superadmin pages
function SuperadminFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Chargement…
    </div>
  );
}

export default function App() {
  return (
    <TenantProvider>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            borderRadius: '10px',
            border: '1px solid var(--color-cream-dark)',
          },
          success: { iconTheme: { primary: 'var(--color-gold)', secondary: 'white' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Superadmin backoffice — guarded by SuperadminGuard + SuperadminLayout */}
        <Route path="/superadmin" element={<SuperadminGuard />}>
          <Route index element={
            <Suspense fallback={<SuperadminFallback />}>
              <DashboardSuperadminPage />
            </Suspense>
          } />
          <Route path="boutiques" element={
            <Suspense fallback={<SuperadminFallback />}>
              <BoutiquesPage />
            </Suspense>
          } />
          <Route path="boutiques/new" element={
            <Suspense fallback={<SuperadminFallback />}>
              <CreerBoutiquePage />
            </Suspense>
          } />
          <Route path="boutiques/:id" element={
            <Suspense fallback={<SuperadminFallback />}>
              <BoutiqueDetailPage />
            </Suspense>
          } />
          <Route path="profil" element={
            <Suspense fallback={<SuperadminFallback />}>
              <ProfilPage />
            </Suspense>
          } />
        </Route>

        {/* Protected — wrapped in AuthGuard + AppLayout */}
        <Route element={<AuthGuard />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Clients */}
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />

          {/* Produits & Stock */}
          <Route path="/produits" element={<ProduitsPage />} />
          <Route path="/produits/etiquettes" element={<EtiquettesPage />} />
          <Route path="/produits/:id" element={<ProduitDetailPage />} />
          <Route path="/stock" element={<MouvementsPage />} />
          <Route path="/stock/mouvements" element={<MouvementsPage />} />
          <Route path="/stock/inventaire" element={<InventairePage />} />
          <Route path="/inventaire" element={<InventairePage />} />

          {/* Commandes & Devis */}
          <Route path="/commandes" element={<CommandesPage />} />
          <Route path="/commandes/:id" element={<CommandeDetailPage />} />

          {/* Facturation */}
          <Route path="/facturation" element={<FacturationPage />} />
          <Route path="/facturation/:id" element={<FactureDetailPage />} />

          {/* Fournisseurs */}
          <Route path="/fournisseurs" element={<FournisseursPage />} />
          <Route path="/fournisseurs/:id" element={<FournisseurDetailPage />} />
          <Route path="/fournisseurs/commande/:id" element={<CommandeFournisseurDetailPage />} />

          {/* POS & Caisse */}
          <Route path="/pos" element={<POSPage />} />
          <Route path="/pos/historique" element={<HistoriqueVentesPage />} />
          <Route path="/pos/sorties" element={<SortiesCaissePage />} />
          <Route path="/rapports/sorties" element={<SortiesCaissePage />} />
          <Route path="/pos/cloture" element={<ClotureCaissePage />} />
          <Route path="/pos/retour" element={<RetourClientPage />} />
          <Route path="/retours" element={<RetoursListPage />} />
          <Route path="/rapports/cloture" element={<ClotureCaissePage />} />

          {/* Leads */}
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />

          {/* Rapports */}
          <Route path="/rapports" element={<RapportsPage />} />

          {/* Admin & Config */}
          <Route path="/utilisateurs" element={<UtilisateursPage />} />
          <Route path="/configuration" element={<ConfigurationPage />} />
          <Route path="/configuration/abonnement" element={<AbonnementPage />} />
          <Route path="/configuration/audit" element={<AuditPage />} />
          <Route path="/configuration/magasins" element={<MagasinsPage />} />

          {/* Templates */}
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/exporter" element={<ExporterCataloguePage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </TenantProvider>
  );
}
