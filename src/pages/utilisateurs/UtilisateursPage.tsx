import { useState, useEffect } from 'react';
import { Plus, Search, Shield, Mail, Phone, CheckCircle, XCircle, Edit, X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/format';
import { utilisateursApi } from '@/lib/api';
import { mockUsers } from '@/data/mock';
import { useAuthStore } from '@/store/authStore';
import type { AppUser, UserRole } from '@/types';

const ROLE_COLORS: Record<string, string> = {
  admin: 'badge-danger',
  commercial: 'badge-info',
  gestionnaire: 'badge-warning',
  comptable: 'badge-gold',
  lecteur: 'badge-neutral',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  commercial: 'Commercial',
  gestionnaire: 'Gestionnaire',
  comptable: 'Comptable',
  lecteur: 'Lecteur',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Accès complet',
  commercial: 'Clients, commandes, devis',
  gestionnaire: 'Stock, produits, rapports',
  comptable: 'Facturation, rapports',
  lecteur: 'Lecture seule',
};

const EMPTY_FORM = { nom: '', prenom: '', email: '', password: '', telephone: '', role: 'lecteur' as UserRole };
const USE_API = Boolean(import.meta.env.VITE_API_URL);

export default function UtilisateursPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  // Load users
  useEffect(() => {
    if (USE_API) {
      setLoadingData(true);
      utilisateursApi.list()
        .then(setUsers)
        .catch(() => toast.error('Impossible de charger les utilisateurs'))
        .finally(() => setLoadingData(false));
    } else {
      setUsers(mockUsers);
    }
  }, []);

  const reload = () => {
    if (!USE_API) return;
    utilisateursApi.list().then(setUsers).catch(() => {});
  };

  const filtered = users.filter(u =>
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.prenom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ nom: u.nom, prenom: u.prenom, email: u.email, password: '', telephone: u.telephone ?? '', role: u.role });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        // Don't send password on edit unless provided
        const patch: Record<string, unknown> = { nom: form.nom, prenom: form.prenom, telephone: form.telephone, role: form.role };
        if (USE_API) {
          const updated = await utilisateursApi.update(editing.id, patch as Partial<AppUser>);
          setUsers(prev => prev.map(u => u.id === editing.id ? updated : u));
        } else {
          setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...patch } : u));
        }
        toast.success('Utilisateur modifié');
      } else {
        if (!form.password) return toast.error('Mot de passe requis');
        if (USE_API) {
          const created = await utilisateursApi.create({ ...form });
          setUsers(prev => [...prev, created]);
        } else {
          const newUser: AppUser = {
            id: `u-${Date.now()}`, email: form.email, nom: form.nom, prenom: form.prenom,
            role: form.role, actif: true, telephone: form.telephone, createdAt: new Date(),
          };
          setUsers(prev => [...prev, newUser]);
        }
        toast.success('Utilisateur créé');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (u: AppUser) => {
    const action = u.actif ? 'désactiver' : 'réactiver';
    if (!confirm(`Voulez-vous ${action} cet utilisateur ?`)) return;
    try {
      if (USE_API) {
        if (u.actif) {
          await utilisateursApi.remove(u.id);
          setUsers(prev => prev.map(x => x.id === u.id ? { ...x, actif: false } : x));
        } else {
          const updated = await utilisateursApi.update(u.id, { actif: true });
          setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
        }
      } else {
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, actif: !x.actif } : x));
      }
      toast.success(`Utilisateur ${u.actif ? 'désactivé' : 'réactivé'}`);
    } catch {
      toast.error('Erreur lors de la modification');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Administration</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Utilisateurs & Rôles</h1>
        </div>
        <div className="flex gap-2">
          {USE_API && (
            <button className="btn-secondary" onClick={reload} title="Actualiser">
              <RefreshCw size={14} />
            </button>
          )}
          {isAdmin && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={15} /> Nouvel utilisateur
            </button>
          )}
        </div>
      </div>

      {/* Role legend */}
      <div className="card p-4">
        <p className="label mb-3">Rôles disponibles</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-cream)' }}>
              <span className={clsx('badge', ROLE_COLORS[role])}>{label}</span>
              <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{ROLE_DESCRIPTIONS[role]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
        <input className="input pl-9" placeholder="Rechercher un utilisateur…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Users grid */}
      {loadingData ? (
        <div className="text-center py-20" style={{ color: 'var(--color-ink-muted)' }}>Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-2 text-center py-20" style={{ color: 'var(--color-ink-muted)' }}>Aucun utilisateur trouvé</div>
          ) : filtered.map(u => (
            <div key={u.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
                  >
                    {u.prenom[0]}{u.nom[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>{u.prenom} {u.nom}</p>
                    <span className={clsx('badge text-xs', ROLE_COLORS[u.role])}>{ROLE_LABELS[u.role]}</span>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs">
                  {u.actif
                    ? <><CheckCircle size={13} className="text-green-500" /><span className="text-green-600">Actif</span></>
                    : <><XCircle size={13} className="text-red-500" /><span className="text-red-600">Inactif</span></>
                  }
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                  <Mail size={12} /> {u.email}
                </p>
                {u.telephone && (
                  <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                    <Phone size={12} /> {u.telephone}
                  </p>
                )}
                <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                  <Shield size={12} /> Créé le {formatDate(u.createdAt)}
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
                  <button className="btn-secondary text-xs py-1.5" onClick={() => openEdit(u)}>
                    <Edit size={12} /> Modifier
                  </button>
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={clsx('text-xs py-1.5 px-3 rounded-lg font-medium border transition-colors', u.actif
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                      )}
                    >
                      {u.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Create / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                {editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom *</label>
                  <input required value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    className="input" placeholder="Prénom" />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    className="input" placeholder="Nom" />
                </div>
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  required
                  type="email"
                  disabled={!!editing}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="input"
                  placeholder="email@exemple.com"
                />
                {editing && <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>L'email ne peut pas être modifié.</p>}
              </div>
              {!editing && (
                <div>
                  <label className="label">Mot de passe * (min. 6 caractères)</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="input"
                    placeholder="••••••••"
                  />
                </div>
              )}
              <div>
                <label className="label">Rôle *</label>
                <select
                  required
                  className="input"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                >
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v} — {ROLE_DESCRIPTIONS[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Téléphone (optionnel)</label>
                <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                  className="input" placeholder="+221 77 000 00 00" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
