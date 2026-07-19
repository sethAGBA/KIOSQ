import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Truck, Package, Edit, ArrowUpRight, Clock } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';

export default function FournisseurDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fournisseurs, commandesFournisseurs } = useAppStore();

  const fournisseur = fournisseurs.find(f => f.id === id);

  if (!fournisseur) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Fournisseur introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/fournisseurs')}>Retour</button>
    </div>
  );

  const cmds = commandesFournisseurs.filter(c => c.fournisseurId === id);
  const totalCommandé = cmds.reduce((s, c) => s + c.totalTTC, 0);
  const cmdEnCours = cmds.filter(c => ['commandee', 'recu_partiel'].includes(c.statut)).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <button
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--color-ink-muted)' }}
        onClick={() => navigate('/fournisseurs')}
      >
        <ArrowLeft size={15} /> Retour aux fournisseurs
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
            >
              <Truck size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                {fournisseur.nom}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {fournisseur.pays && (
                  <span className="badge badge-neutral">{fournisseur.pays}</span>
                )}
                <span className={clsx('badge', fournisseur.actif ? 'badge-success' : 'badge-neutral')}>
                  {fournisseur.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/fournisseurs')}>
            <Edit size={14} /> Modifier
          </button>
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
          {fournisseur.contact && (
            <div>
              <p className="label">Contact</p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{fournisseur.contact}</p>
            </div>
          )}
          {fournisseur.email && (
            <div>
              <p className="label">Email</p>
              <a href={`mailto:${fournisseur.email}`} className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-gold)' }}>
                <Mail size={13} />{fournisseur.email}
              </a>
            </div>
          )}
          {fournisseur.telephone && (
            <div>
              <p className="label">Téléphone</p>
              <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
                <Phone size={13} />{fournisseur.telephone}
              </p>
            </div>
          )}
          {fournisseur.adresse && (
            <div>
              <p className="label">Adresse</p>
              <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
                <MapPin size={13} />{fournisseur.adresse}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Total achats</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(fournisseur.totalAchats)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Commandes passées</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{cmds.length}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{cmdEnCours} en cours</p>
        </div>
        <div className="card p-4">
          <p className="label">Dette actuelle</p>
          <p className="text-xl font-bold" style={{ color: fournisseur.soldeDette > 0 ? '#d97706' : '#16a34a' }}>
            {formatPrice(fournisseur.soldeDette)}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Délai livraison</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>
            {fournisseur.delaiLivraison ? `${fournisseur.delaiLivraison}j` : '—'}
          </p>
          {fournisseur.conditionsPaiement && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
              Paiement : {fournisseur.conditionsPaiement}
            </p>
          )}
        </div>
      </div>

      {/* Commandes fournisseur */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
          <div className="flex items-center gap-2">
            <Package size={15} style={{ color: 'var(--color-gold)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
              Commandes d'achat ({cmds.length})
            </h2>
          </div>
          <button
            className="btn-primary text-xs py-1.5"
            onClick={() => navigate('/fournisseurs')}
          >
            Nouvelle commande
          </button>
        </div>
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Total TTC</th>
              <th>Payé</th>
              <th>Reste</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Livraison prévue</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cmds.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>
                  Aucune commande pour ce fournisseur
                </td>
              </tr>
            ) : cmds.map(c => (
              <tr key={c.id}>
                <td><span className="font-mono text-xs font-medium">{c.numero}</span></td>
                <td className="font-medium">{formatPrice(c.totalTTC)}</td>
                <td style={{ color: '#16a34a' }}>{formatPrice(c.montantPaye)}</td>
                <td style={{ color: c.resteAPayer > 0 ? '#d97706' : '#16a34a' }}>
                  {c.resteAPayer > 0 ? formatPrice(c.resteAPayer) : <span className="badge badge-success">soldé</span>}
                </td>
                <td><span className={clsx('badge', statutColor(c.statut))}>{statutLabel(c.statut)}</span></td>
                <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(c.dateCommande)}</td>
                <td style={{ color: 'var(--color-ink-muted)' }}>
                  {c.dateLivraisonPrevue ? (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />{formatDate(c.dateLivraisonPrevue)}
                    </span>
                  ) : '—'}
                </td>
                <td><ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {fournisseur.notes && (
        <div className="card p-5">
          <p className="label mb-2">Notes internes</p>
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{fournisseur.notes}</p>
        </div>
      )}
    </div>
  );
}
