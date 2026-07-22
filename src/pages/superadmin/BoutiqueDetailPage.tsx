/**
 * BoutiqueDetailPage — full detail view + management actions for a single tenant.
 *
 * Features:
 *  - Displays all tenant columns + user list (Req 5.5)
 *  - Plan selector (Req 5.6)
 *  - Suspend / reactivate (Req 5.7, 5.8)
 *  - Maintenance toggle with custom message (Req 16.1, 16.3)
 *  - Impersonation (Req 6.3)
 *
 * Requirements: 5.5, 5.6, 5.7, 5.8, 6.3, 16.1, 16.3
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCcw,
  AlertCircle,
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Wrench,
  Power,
  UserCheck,
  CheckCircle2,
  XCircle,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { superadminApi, type TenantDetail } from '@/lib/api';
import PlanBadge from '@/components/superadmin/PlanBadge';
import { useTenantStore } from '@/store/tenantStore';

// ── Helpers ───────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Statut badge ──────────────────────────────────────────

const STATUT_CONFIG = {
  actif:     { label: 'Actif',     className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  essai:     { label: 'Essai',     className: 'bg-amber-50 text-amber-700 border border-amber-200'       },
  suspendu:  { label: 'Suspendu',  className: 'bg-red-50 text-red-700 border border-red-200'             },
} as const;

function StatutBadge({ statut }: { statut: 'actif' | 'essai' | 'suspendu' }) {
  const cfg = STATUT_CONFIG[statut];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Info row ──────────────────────────────────────────────

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-b-0">
      {icon && (
        <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-gray-800 break-all">{value ?? '—'}</div>
      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────

function SectionCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-1">
        {children}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function BoutiqueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tenant, setTenant]     = useState<TenantDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // ── Action states ─────────────────────────────────────
  const [saving, setSaving]                 = useState(false);
  const [actionError, setActionError]       = useState<string | null>(null);
  const [actionSuccess, setActionSuccess]   = useState<string | null>(null);

  // Plan selector
  const [editingPlan, setEditingPlan]       = useState(false);
  const [newPlan, setNewPlan]               = useState<'starter' | 'pro' | 'enterprise'>('starter');

  // Maintenance
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [editingMaint, setEditingMaint]     = useState(false);

  // Impersonation
  const [impersonating, setImpersonating]   = useState(false);

  // ── Load tenant ───────────────────────────────────────

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await superadminApi.tenants.get(id);
      setTenant(data);
      setNewPlan(data.plan);
      setMaintenanceMsg(data.messageMaintenance ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Flash helper ──────────────────────────────────────

  function flash(msg: string, isError = false) {
    if (isError) {
      setActionError(msg);
      setActionSuccess(null);
    } else {
      setActionSuccess(msg);
      setActionError(null);
    }
    setTimeout(() => {
      setActionError(null);
      setActionSuccess(null);
    }, 4000);
  }

  // ── Plan change ───────────────────────────────────────

  async function handlePlanChange() {
    if (!id || !tenant || newPlan === tenant.plan) {
      setEditingPlan(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await superadminApi.tenants.update(id, { plan: newPlan });
      setTenant(updated);
      setEditingPlan(false);
      flash(`Plan mis à jour → ${newPlan}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Erreur lors du changement de plan', true);
    } finally {
      setSaving(false);
    }
  }

  // ── Suspend / reactivate ──────────────────────────────

  async function handleToggleSuspend() {
    if (!id || !tenant) return;
    const nextStatut = tenant.statut === 'suspendu' ? 'actif' : 'suspendu';
    setSaving(true);
    try {
      const updated = await superadminApi.tenants.update(id, { statut: nextStatut });
      setTenant(updated);
      flash(nextStatut === 'suspendu' ? 'Boutique suspendue' : 'Boutique réactivée');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Erreur', true);
    } finally {
      setSaving(false);
    }
  }

  // ── Maintenance toggle ────────────────────────────────

  async function handleMaintenanceToggle() {
    if (!id || !tenant) return;

    if (!tenant.enMaintenance && !editingMaint) {
      // Show the message field before activating
      setEditingMaint(true);
      return;
    }

    const enable = !tenant.enMaintenance;
    setSaving(true);
    try {
      const updated = await superadminApi.tenants.update(id, {
        enMaintenance: enable,
        messageMaintenance: enable ? (maintenanceMsg || 'Maintenance en cours. Revenez bientôt.') : null,
      });
      setTenant(updated);
      setEditingMaint(false);
      flash(enable ? 'Mode maintenance activé' : 'Mode maintenance désactivé');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Erreur', true);
    } finally {
      setSaving(false);
    }
  }

  // ── Impersonation ─────────────────────────────────────

  async function handleImpersonate() {
    if (!id || !tenant) return;
    setImpersonating(true);
    setActionError(null);
    try {
      const { token, boutique } = await superadminApi.tenants.impersonate(id);
      // Store the impersonation JWT
      try {
        localStorage.setItem('kiosq-impersonation-token', token);
      } catch {
        // localStorage unavailable — silently ignore
      }
      // Update tenant store to reflect active impersonation session
      useTenantStore.setState({
        isImpersonating: true,
        impersonatedTenantNom: boutique,
      });
      // Navigate to the boutique dashboard
      navigate('/dashboard');
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur lors de l'impersonation", true);
    } finally {
      setImpersonating(false);
    }
  }

  // ── Loading state ──────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/superadmin/boutiques')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="h-6 bg-gray-100 rounded w-48 animate-pulse mb-1" />
            <div className="h-3 bg-gray-100 rounded w-32 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────

  if (error || !tenant) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/superadmin/boutiques')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Retour aux boutiques
        </button>
        <div className="bg-white rounded-xl border border-red-100 p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-gray-700 font-medium">{error ?? 'Boutique introuvable'}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors"
          >
            <RefreshCcw size={14} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/superadmin/boutiques')}
            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Retour aux boutiques"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-800">{tenant.nom}</h1>
              <PlanBadge plan={tenant.plan} size="md" />
              <StatutBadge statut={tenant.statut} />
              {tenant.enMaintenance && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                  <Wrench size={10} />
                  Maintenance
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 font-mono mt-0.5">/{tenant.slug}</p>
          </div>
        </div>

        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-600 transition-colors shadow-sm"
        >
          <RefreshCcw size={13} />
          Actualiser
        </button>
      </div>

      {/* ── Action feedback ───────────────────────────── */}
      {actionSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle2 size={15} />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={15} />
          {actionError}
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left column: tenant info ─────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tenant details */}
          <SectionCard title="Informations de la boutique">
            <InfoRow
              label="Email"
              value={tenant.email}
              icon={<Mail size={14} />}
            />
            <InfoRow
              label="Téléphone"
              value={tenant.telephone}
              icon={<Phone size={14} />}
            />
            <InfoRow
              label="Adresse"
              value={tenant.adresse}
              icon={<MapPin size={14} />}
            />
            <InfoRow
              label="Pays"
              value={tenant.pays}
              icon={<Globe size={14} />}
            />
            <InfoRow
              label="Devise"
              value={tenant.devise}
              icon={<Globe size={14} />}
            />
            {tenant.domaine && (
              <InfoRow
                label="Domaine personnalisé"
                value={<span className="font-mono">{tenant.domaine}</span>}
                icon={<Globe size={14} />}
              />
            )}
            <InfoRow
              label="Créée le"
              value={formatDate(tenant.createdAt)}
              icon={<Calendar size={14} />}
            />
            <InfoRow
              label="Mise à jour le"
              value={formatDate(tenant.updatedAt)}
              icon={<Calendar size={14} />}
            />
            {tenant.dateEssaiFin && (
              <InfoRow
                label="Fin d'essai"
                value={formatDate(tenant.dateEssaiFin)}
                icon={<Calendar size={14} />}
              />
            )}
          </SectionCard>

          {/* Users list */}
          {(() => {
            const utilisateursList = tenant.utilisateurs ?? [];
            return (
              <SectionCard title={`Utilisateurs (${utilisateursList.length})`}>
                {utilisateursList.length === 0 ? (
                  <p className="py-4 text-sm text-gray-400 text-center">Aucun utilisateur</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {utilisateursList.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 py-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-gray-500">
                            {u.prenom?.[0]}{u.nom?.[0]}
                          </span>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {u.prenom} {u.nom}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                        {/* Role */}
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                          {u.role}
                        </span>
                        {/* Actif indicator */}
                        {u.actif ? (
                          <span title="Actif" className="shrink-0">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          </span>
                        ) : (
                          <span title="Inactif" className="shrink-0">
                            <XCircle size={14} className="text-gray-300" />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            );
          })()}
        </div>

        {/* ── Right column: actions ────────────────────── */}
        <div className="space-y-4">

          {/* Plan */}
          <SectionCard title="Plan d'abonnement" className="!pb-4">
            <div className="py-3">
              {editingPlan ? (
                <div className="space-y-3">
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value as typeof newPlan)}
                    className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] bg-white text-gray-700"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePlanChange}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#e94560] hover:bg-[#d03550] disabled:opacity-50 text-white text-sm font-medium transition-colors"
                    >
                      <Save size={13} />
                      {saving ? 'Sauvegarde…' : 'Confirmer'}
                    </button>
                    <button
                      onClick={() => { setEditingPlan(false); setNewPlan(tenant.plan); }}
                      className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <PlanBadge plan={tenant.plan} size="md" />
                  <button
                    onClick={() => setEditingPlan(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-600 transition-colors"
                  >
                    <Edit2 size={11} />
                    Modifier
                  </button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Status actions */}
          <SectionCard title="Statut" className="!pb-4">
            <div className="py-3 space-y-3">
              <div className="flex items-center justify-between">
                <StatutBadge statut={tenant.statut} />
              </div>

              <button
                onClick={handleToggleSuspend}
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  tenant.statut === 'suspendu'
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                }`}
              >
                {tenant.statut === 'suspendu' ? (
                  <><Power size={13} /> Réactiver la boutique</>
                ) : (
                  <><Power size={13} /> Suspendre la boutique</>
                )}
              </button>
            </div>
          </SectionCard>

          {/* Maintenance */}
          <SectionCard title="Mode maintenance" className="!pb-4">
            <div className="py-3 space-y-3">
              {tenant.enMaintenance && tenant.messageMaintenance && (
                <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                  {tenant.messageMaintenance}
                </p>
              )}

              {!tenant.enMaintenance && editingMaint && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 font-medium">Message de maintenance</label>
                  <textarea
                    value={maintenanceMsg}
                    onChange={(e) => setMaintenanceMsg(e.target.value)}
                    placeholder="Maintenance en cours. Revenez bientôt."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 resize-none"
                  />
                </div>
              )}

              <button
                onClick={handleMaintenanceToggle}
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  tenant.enMaintenance
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                    : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
                }`}
              >
                <Wrench size={13} />
                {tenant.enMaintenance ? 'Désactiver la maintenance' : (editingMaint ? 'Activer la maintenance' : 'Activer la maintenance')}
              </button>

              {editingMaint && !tenant.enMaintenance && (
                <button
                  onClick={() => setEditingMaint(false)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              )}
            </div>
          </SectionCard>

          {/* Impersonation */}
          <SectionCard title="Assistance" className="!pb-4">
            <div className="py-3 space-y-3">
              <p className="text-xs text-gray-400">
                Prenez temporairement l'identité d'un administrateur de cette boutique pour fournir un support technique.
              </p>
              <button
                onClick={handleImpersonate}
                disabled={impersonating || saving || tenant.statut === 'suspendu'}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#e94560] hover:bg-[#d03550] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {impersonating ? (
                  <>
                    <UserCheck size={14} />
                    Connexion en cours…
                  </>
                ) : (
                  <>
                    <Shield size={14} />
                    Impersonner cette boutique
                  </>
                )}
              </button>
              {tenant.statut === 'suspendu' && (
                <p className="text-xs text-red-400 text-center">
                  Réactivez la boutique avant d'impersonner
                </p>
              )}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
