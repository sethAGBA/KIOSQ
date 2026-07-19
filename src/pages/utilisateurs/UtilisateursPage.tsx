import { useState } from 'react';
import { Plus, Search, Shield, User, Mail, Phone, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { formatDate } from '@/lib/format';
import { mockUsers } from '@/data/mock';

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

export default function UtilisateursPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const users = mockUsers.filter(u =>
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.prenom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Administration</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Utilisateurs & Rôles</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Nouvel utilisateur
        </button>
      </div>

      {/* Role legend */}
      <div className="card p-4">
        <p className="label mb-3">Rôles disponibles</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-cream)' }}>
              <span className={clsx('badge', ROLE_COLORS[role])}>{label}</span>
              <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                {role === 'admin' ? 'Accès complet' :
                 role === 'commercial' ? 'Clients, commandes, devis' :
                 role === 'gestionnaire' ? 'Stock, produits, rapports' :
                 role === 'comptable' ? 'Facturation, rapports' :
                 'Lecture seule'}
              </span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(u => (
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
            <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
              <button className="btn-secondary text-xs py-1.5">
                <User size={12} /> Modifier
              </button>
              {u.actif && (
                <button className="btn-danger text-xs py-1.5">
                  Désactiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal placeholder */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-ink)' }}>Nouvel utilisateur</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prénom</label><input className="input" placeholder="Prénom" /></div>
                <div><label className="label">Nom</label><input className="input" placeholder="Nom" /></div>
              </div>
              <div><label className="label">Email</label><input type="email" className="input" placeholder="email@exemple.com" /></div>
              <div>
                <label className="label">Rôle</label>
                <select className="input">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Téléphone (optionnel)</label><input className="input" placeholder="+221 77…" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={() => setShowModal(false)}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
