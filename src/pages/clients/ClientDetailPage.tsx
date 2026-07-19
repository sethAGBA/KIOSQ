import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Building2, User, Edit, ShoppingCart, FileText } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, commandes, factures } = useAppStore();

  const client = clients.find((c) => c.id === id);
  if (!client) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Client introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/clients')}>Retour</button>
    </div>
  );

  const cmdClient = commandes.filter((c) => c.clientId === id);
  const facClient = factures.filter((f) => f.clientId === id);

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
          <button className="btn-secondary" onClick={() => navigate(`/clients/${id}/modifier`)}>
            <Edit size={14} /> Modifier
          </button>
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
          <p className="text-xl font-bold" style={{ color: client.soldeCredit > 0 ? '#d97706' : '#16a34a' }}>
            {formatPrice(client.soldeCredit)}
          </p>
        </div>
      </div>

      {/* Commandes */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
          <ShoppingCart size={15} style={{ color: 'var(--color-gold)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Commandes ({cmdClient.length})</h2>
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
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
          <FileText size={15} style={{ color: 'var(--color-gold)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Factures ({facClient.length})</h2>
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
    </div>
  );
}
