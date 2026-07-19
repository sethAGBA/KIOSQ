import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Auth
import LoginPage from '@/pages/LoginPage';
import AuthGuard from '@/components/auth/AuthGuard';

// Pages
import DashboardPage from '@/pages/DashboardPage';
import ClientsPage from '@/pages/clients/ClientsPage';
import ClientDetailPage from '@/pages/clients/ClientDetailPage';
import ProduitsPage from '@/pages/produits/ProduitsPage';
import CommandesPage from '@/pages/commandes/CommandesPage';
import FacturationPage from '@/pages/facturation/FacturationPage';
import FactureDetailPage from '@/pages/facturation/FactureDetailPage';
import FournisseursPage from '@/pages/fournisseurs/FournisseursPage';
import RapportsPage from '@/pages/rapports/RapportsPage';
import UtilisateursPage from '@/pages/utilisateurs/UtilisateursPage';
import ConfigurationPage from '@/pages/configuration/ConfigurationPage';

export default function App() {
  return (
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

        {/* Protected — wrapped in AuthGuard + AppLayout */}
        <Route element={<AuthGuard />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Clients */}
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />

          {/* Produits */}
          <Route path="/produits" element={<ProduitsPage />} />

          {/* Commandes & Devis */}
          <Route path="/commandes" element={<CommandesPage />} />

          {/* Facturation */}
          <Route path="/facturation" element={<FacturationPage />} />
          <Route path="/facturation/:id" element={<FactureDetailPage />} />

          {/* Fournisseurs */}
          <Route path="/fournisseurs" element={<FournisseursPage />} />

          {/* Rapports */}
          <Route path="/rapports" element={<RapportsPage />} />

          {/* Admin */}
          <Route path="/utilisateurs" element={<UtilisateursPage />} />
          <Route path="/configuration" element={<ConfigurationPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
