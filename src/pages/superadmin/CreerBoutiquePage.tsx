/**
 * CreerBoutiquePage — form to create a new tenant boutique.
 *
 * Features:
 *  - Fields: nom, email admin, plan, devise, pays (Req 5.4)
 *  - Live slug preview from nom using generateSlug (Req 2.3)
 *  - Submits via POST /api/superadmin/tenants (Req 5.4)
 *  - Success panel showing generated credentials (Req 8.1)
 *  - No auto-navigation — user must manually go back after seeing credentials
 *
 * Requirements: 5.4, 8.1
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  Mail,
  Globe,
  CreditCard,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { superadminApi, type TenantDetail } from '@/lib/api';
import { generateSlug } from '@/lib/tenant';
import PlanBadge from '@/components/superadmin/PlanBadge';

// ── Types ─────────────────────────────────────────────────

interface FormState {
  nom: string;
  emailAdmin: string;
  plan: 'starter' | 'pro' | 'enterprise';
  devise: string;
  pays: string;
}

interface CreationResult {
  tenant: TenantDetail;
  adminEmail: string;
  adminPassword: string;
}

// ── Common currencies and countries ───────────────────────

const DEVISES = [
  { value: 'XOF', label: 'XOF — Franc CFA (BCEAO)' },
  { value: 'XAF', label: 'XAF — Franc CFA (BEAC)' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — Dollar américain' },
  { value: 'MAD', label: 'MAD — Dirham marocain' },
  { value: 'DZD', label: 'DZD — Dinar algérien' },
  { value: 'TND', label: 'TND — Dinar tunisien' },
  { value: 'GHS', label: 'GHS — Cedi ghanéen' },
  { value: 'NGN', label: 'NGN — Naira nigérian' },
  { value: 'KES', label: 'KES — Shilling kenyan' },
];

const PAYS = [
  'Sénégal', 'Côte d\'Ivoire', 'Mali', 'Burkina Faso', 'Guinée', 'Niger', 'Bénin', 'Togo',
  'Cameroun', 'Gabon', 'Congo', 'RDC', 'Maroc', 'Algérie', 'Tunisie', 'Ghana', 'Nigeria',
  'Kenya', 'Éthiopie', 'France', 'Belgique', 'Canada', 'Autre',
];

// ── Sub-components ────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-[#e94560] ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function inputClass(hasError?: boolean) {
  return `w-full px-3.5 py-2.5 text-sm border rounded-lg bg-white text-gray-800 placeholder-gray-400
    focus:outline-none focus:ring-2 transition-colors
    ${hasError
      ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
      : 'border-gray-200 focus:ring-[#e94560]/20 focus:border-[#e94560]'
    }`;
}

// ── Copy button ───────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      title="Copier"
    >
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
    </button>
  );
}

// ── Success panel ─────────────────────────────────────────

function SuccessPanel({
  result,
  onCreateAnother,
  onGoToDetail,
}: {
  result: CreationResult;
  onCreateAnother: () => void;
  onGoToDetail: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4 p-5 bg-emerald-50 border border-emerald-200 rounded-xl">
        <CheckCircle2 size={28} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-semibold text-emerald-800">
            Boutique créée avec succès&nbsp;!
          </h2>
          <p className="text-sm text-emerald-700 mt-0.5">
            <strong>{result.tenant.nom}</strong> est maintenant disponible sur la plateforme.
            Un email de bienvenue sera envoyé à l'administrateur.
          </p>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Mail size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">
            Credentials de l'administrateur
          </h3>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Notez ces identifiants maintenant. Le mot de passe ne sera plus affiché après avoir quitté cette page.
          </p>

          {/* Email */}
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">
              Email
            </p>
            <div className="flex items-center px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800">
              <span className="flex-1 break-all">{result.adminEmail}</span>
              <CopyButton value={result.adminEmail} />
            </div>
          </div>

          {/* Password */}
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">
              Mot de passe temporaire
            </p>
            <div className="flex items-center px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800">
              <span className="flex-1 tracking-wider">
                {showPassword ? result.adminPassword : '•'.repeat(result.adminPassword.length)}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-2 shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title={showPassword ? 'Masquer' : 'Afficher'}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <CopyButton value={result.adminPassword} />
            </div>
          </div>
        </div>
      </div>

      {/* Tenant summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Résumé de la boutique</h3>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Nom</p>
            <p className="text-gray-800 font-medium">{result.tenant.nom}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Slug</p>
            <p className="text-gray-800 font-mono">/{result.tenant.slug}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Plan</p>
            <PlanBadge plan={result.tenant.plan} size="sm" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Devise</p>
            <p className="text-gray-800">{result.tenant.devise}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onGoToDetail}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#e94560] hover:bg-[#d03550] text-white text-sm font-medium transition-colors"
        >
          Voir le détail de la boutique
        </button>
        <button
          type="button"
          onClick={onCreateAnother}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 font-medium transition-colors"
        >
          Créer une autre boutique
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function CreerBoutiquePage() {
  const navigate = useNavigate();

  // Form state
  const [form, setForm] = useState<FormState>({
    nom: '',
    emailAdmin: '',
    plan: 'starter',
    devise: 'XOF',
    pays: '',
  });

  // Validation errors
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Submission state
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [result, setResult]             = useState<CreationResult | null>(null);

  // Derived slug
  const slug = form.nom.trim() ? generateSlug(form.nom) : '';

  // ── Form helpers ──────────────────────────────────────

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // ── Validation ────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.nom.trim()) {
      newErrors.nom = 'Le nom de la boutique est requis.';
    }

    if (!form.emailAdmin.trim()) {
      newErrors.emailAdmin = "L'email de l'administrateur est requis.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAdmin)) {
      newErrors.emailAdmin = 'Adresse email invalide.';
    }

    if (!form.devise) {
      newErrors.devise = 'La devise est requise.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const data = await superadminApi.tenants.create({
        nom:        form.nom.trim(),
        emailAdmin: form.emailAdmin.trim(),
        plan:       form.plan,
        devise:     form.devise,
        ...(form.pays.trim() ? { pays: form.pays.trim() } : {}),
      });
      setResult(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ─────────────────────────────────────

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/superadmin/boutiques')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Retour aux boutiques"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Boutique créée</h1>
            <p className="text-sm text-gray-400">Conservez les credentials ci-dessous avant de continuer</p>
          </div>
        </div>

        <SuccessPanel
          result={result}
          onCreateAnother={() => {
            setResult(null);
            setForm({ nom: '', emailAdmin: '', plan: 'starter', devise: 'XOF', pays: '' });
            setErrors({});
            setSubmitError(null);
          }}
          onGoToDetail={() => navigate(`/superadmin/boutiques/${result.tenant.id}`)}
        />
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/superadmin/boutiques')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Retour aux boutiques"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Créer une boutique</h1>
          <p className="text-sm text-gray-400">Nouvelle boutique cliente sur la plateforme</p>
        </div>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Section: Boutique */}
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Store size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Informations de la boutique</h2>
          </div>

          <div className="p-5 space-y-5">

            {/* Nom */}
            <div>
              <FieldLabel required>Nom de la boutique</FieldLabel>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => update('nom', e.target.value)}
                placeholder="Ex : Boutique Amadou"
                className={inputClass(!!errors.nom)}
                autoFocus
              />
              {errors.nom && <FieldError message={errors.nom} />}

              {/* Live slug preview */}
              {slug && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  <Globe size={11} />
                  <span>Slug généré :</span>
                  <span className="font-mono text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                    {slug}
                  </span>
                </div>
              )}
            </div>

            {/* Plan */}
            <div>
              <FieldLabel required>Plan d'abonnement</FieldLabel>
              <div className="grid grid-cols-3 gap-3">
                {(['starter', 'pro', 'enterprise'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update('plan', p)}
                    className={`flex flex-col items-center gap-2 px-3 py-3.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                      form.plan === p
                        ? 'border-[#e94560] bg-[#e94560]/5'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <PlanBadge plan={p} size="sm" />
                    <span className="text-xs text-gray-500 capitalize">{p}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Devise */}
            <div>
              <FieldLabel required>Devise</FieldLabel>
              <div className="relative">
                <CreditCard size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={form.devise}
                  onChange={(e) => update('devise', e.target.value)}
                  className={`${inputClass(!!errors.devise)} pl-9`}
                >
                  {DEVISES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              {errors.devise && <FieldError message={errors.devise} />}
            </div>

            {/* Pays */}
            <div>
              <FieldLabel>Pays <span className="text-gray-400 font-normal text-xs">(optionnel)</span></FieldLabel>
              <div className="relative">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={form.pays}
                  onChange={(e) => update('pays', e.target.value)}
                  className={`${inputClass()} pl-9`}
                >
                  <option value="">Sélectionner un pays…</option>
                  {PAYS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Section: Admin */}
          <div className="px-5 py-4 border-t border-b border-gray-50 flex items-center gap-2 bg-gray-50/50">
            <Mail size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Compte administrateur</h2>
          </div>

          <div className="p-5 space-y-5">

            {/* Email admin */}
            <div>
              <FieldLabel required>Email de l'administrateur</FieldLabel>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={form.emailAdmin}
                  onChange={(e) => update('emailAdmin', e.target.value)}
                  placeholder="admin@boutique.com"
                  className={`${inputClass(!!errors.emailAdmin)} pl-9`}
                />
              </div>
              {errors.emailAdmin && <FieldError message={errors.emailAdmin} />}
              <p className="mt-1.5 text-xs text-gray-400">
                Un mot de passe temporaire sera généré automatiquement et vous sera affiché après la création.
              </p>
            </div>

          </div>

          {/* Submit error */}
          {submitError && (
            <div className="mx-5 mb-4 flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          {/* Footer / submit */}
          <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate('/superadmin/boutiques')}
              className="px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-white text-sm text-gray-600 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e94560] hover:bg-[#d03550] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-sm"
            >
              {submitting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Création en cours…
                </>
              ) : (
                <>
                  <Store size={14} />
                  Créer la boutique
                </>
              )}
            </button>
          </div>

        </div>
      </form>

    </div>
  );
}
