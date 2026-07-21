import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Building2, User, Edit, ShoppingCart, FileText, X, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { clientsApi, USE_API } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { Client } from '@/types';
import ReglementDetteModal from '@/components/clients/ReglementDetteModal';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, commandes, factures, updateClient } = useAppStore();
  const { user } = useAuthStore();

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [showReglement, setShowReglement] = useState(false);
  const [annulLoading, setAnnulLoading] = useState(false);
  const { reglerDetteClient, annulerDernierReglement } = useAppStore();

  const canEdit = user?.role === 'admin' || user?.role === 'commercial' || user?.role === 'gestionnaire';

  const client = clients.find((c) => c.id === id);

  if (!client) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Client introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/clients')}>Retour</button>
    </div>
  );

  const cmdClient = commandes.filter((c) => c.clientId === id);
  const facClient = factures.filter((f) => f.clientId === id);

  const openEdit = () => {
    setForm({
      nom: client.nom,
      prenom: client.prenom,
      email: client.email,
      telephone: client.telephone,
      adresse: client.adresse,
      ville: client.ville,
      pays: client.pays,
      secteurActivite: client.secteurActivite,
      typeClient: client.typeClient,
      notes: client.notes,
    });
    setShowEdit(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (USE_API) {
        const updated = await clientsApi.update(client.id, form);
        updateClient(client.id, updated);
      } else {
        updateClient(client.id, { ...form, updatedAt: new Date() });
      }
      toast.success('Client modifié');
      setShowEdit(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleReglement = async (montant: number, modePaiement: string) => {
    try {
      await reglerDetteClient(client.id, montant, modePaiement);
      toast.success('Règlement enregistré');
      setShowReglement(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du règlement');
    }
  };

  const handleAnnulerDernierReglement = async () => {
    if (!window.confirm('Annuler le dernier r\u00e8glement de dette de ce client ?')) return;
    setAnnulLoading(true);
    try {
      await annulerDernierReglement(client.id);
      toast.success('Dernier r\u00e8glement annul\u00e9');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'annulation');
    } finally {
      setAnnulLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <button
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: 'var(--color-ink-muted)' }}
        onClick={() => navigate('/clients')}
      >
        <ArrowLeft size={15} /> Retour aux clients
      </button>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
            >
              {client.typeClient === 'entreprise' ? <Building2 size={24} /> : client.nom[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  {client.nom}
                </h1>
                <span className={clsx('badge', client.typeClient === 'entreprise' ? 'badge-info' : 'badge-neutral')}>
                  {client.typeClient === 'entreprise' ? <Building2 size={11} /> : <User size={11} />}
                  {client.typeClient}
                </span>
                <span className={clsx('badge', client.actif ? 'badge-success' : 'badge-danger')}>
                  {client.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-sm font-mono mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{client.code}</p>
            </div>
          </div>
          {canEdit && (
            <button className="btn-secondary" onClick={openEdit}>
              <Edit size={14} /> Modifier
            </button>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
          {client.email && (
            <div>
              <p className="label">Email</p>
              <a href={`mailto:${client.email}`} className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-gold)' }}>
                <Mail size={13} />{client.email}
              </a>
            </div>
          )}
          {client.telephone && (
            <div>
              <p className="label">Téléphone</p>
              <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
                <Phone size={13} />{client.telephone}
              </p>
            </div>
          )}
          {(client.ville || client.pays) && (
            <div>
              <p className="label">Localisation</p>
              <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
                <MapPin size={13} />{[client.ville, client.pays].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {client.secteurActivite && (
            <div>
              <p className="label">Secteur</p>
              <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{client.secteurActivite}</p>
            </div>
          )}
        </div>

        {client.notes && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
            <p className="label mb-1">Notes</p>
            <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{client.notes}</p>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="label text-center">CA total</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(client.totalAchats)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="label text-center">Commandes</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{client.nombreCommandes}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="label text-center">Créance</p>
          <div className="flex flex-col items-center gap-2 mt-1">
            <p className="text-xl font-bold" style={{ color: client.soldeCredit > 0 ? '#d97706' : '#16a34a' }}>
              {formatPrice(client.soldeCredit)}
            </p>
            {client.soldeCredit > 0 && canEdit && (
              <div className="flex flex-col gap-1.5 w-full">
                <button 
                  onClick={() => setShowReglement(true)} 
                  className="btn-primary text-xs py-1 px-3 w-full"
                >
                  Régler
                </button>
                <button
                  onClick={handleAnnulerDernierReglement}
                  disabled={annulLoading}
                  className="text-xs py-1 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
                  style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                >
                  <RotateCcw size={11} />
                  {annulLoading ? '...' : 'Annuler dernier'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commandes */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={15} style={{ color: 'var(--color-gold)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Commandes ({cmdClient.length})</h2>
          </div>
          {canEdit && (
            <button
              className="text-xs font-medium"
              style={{ color: 'var(--color-gold)' }}
              onClick={() => navigate('/commandes')}
            >
              + Nouvelle commande
            </button>
          )}
        </div>
        <table className="table-auto w-full">
          <thead>
            <tr><th>Numéro</th><th>Type</th><th>Total TTC</th><th>Statut</th><th>Date</th></tr>
          </thead>
          <tbody>
            {cmdClient.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Aucune commande</td></tr>
            ) : cmdClient.map((c) => (
              <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/commandes/${c.id}`)}>
                <td><span className="font-mono text-xs font-medium">{c.numero}</span></td>
                <td><span className={clsx('badge', c.type === 'commande' ? 'badge-info' : 'badge-gold')}>{c.type}</span></td>
                <td className="font-medium">{formatPrice(c.totalTTC)}</td>
                <td><span className={clsx('badge', statutColor(c.statut))}>{statutLabel(c.statut)}</span></td>
                <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Factures */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: 'var(--color-gold)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Factures ({facClient.length})</h2>
          </div>
          {canEdit && (
            <button
              className="text-xs font-medium"
              style={{ color: 'var(--color-gold)' }}
              onClick={() => navigate('/facturation')}
            >
              + Nouvelle facture
            </button>
          )}
        </div>
        <table className="table-auto w-full">
          <thead>
            <tr><th>Numéro</th><th>Total TTC</th><th>Payé</th><th>Reste</th><th>Statut</th><th>Échéance</th></tr>
          </thead>
          <tbody>
            {facClient.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Aucune facture</td></tr>
            ) : facClient.map((f) => (
              <tr key={f.id} className="cursor-pointer" onClick={() => navigate(`/facturation/${f.id}`)}>
                <td><span className="font-mono text-xs font-medium">{f.numero}</span></td>
                <td className="font-medium">{formatPrice(f.totalTTC)}</td>
                <td style={{ color: '#16a34a' }}>{formatPrice(f.montantPaye)}</td>
                <td style={{ color: f.resteAPayer > 0 ? '#d97706' : '#16a34a' }}>{formatPrice(f.resteAPayer)}</td>
                <td><span className={clsx('badge', statutColor(f.statut))}>{statutLabel(f.statut)}</span></td>
                <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(f.dateEcheance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                Modifier le client
              </h3>
              <button onClick={() => setShowEdit(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nom / Raison sociale *</label>
                  <input required className="input" value={form.nom ?? ''} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </div>
                {client.typeClient === 'particulier' && (
                  <div className="col-span-2">
                    <label className="label">Prénom</label>
                    <input className="input" value={form.prenom ?? ''} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
                  </div>
                )}
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <input className="input" value={form.telephone ?? ''} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Adresse</label>
                  <input className="input" value={form.adresse ?? ''} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Ville</label>
                  <input className="input" value={form.ville ?? ''} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Pays</label>
                  <input className="input" value={form.pays ?? ''} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))} />
                </div>
                {client.typeClient === 'entreprise' && (
                  <div className="col-span-2">
                    <label className="label">Secteur d'activité</label>
                    <input className="input" value={form.secteurActivite ?? ''} onChange={e => setForm(f => ({ ...f, secteurActivite: e.target.value }))} />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Enregistrement…' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReglement && (
        <ReglementDetteModal
          client={client}
          onClose={() => setShowReglement(false)}
          onSubmit={handleReglement}
        />
      )}
    </div>
  );
}
