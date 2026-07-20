import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, Clock, AlertTriangle, Edit } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import toast from 'react-hot-toast';

export default function CommandeFournisseurDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { commandesFournisseurs, updateCommandeFournisseur } = useAppStore();
  const { user } = useAuthStore();

  const commande = commandesFournisseurs.find(c => c.id === id);
  const canEdit = user?.role === 'admin' || user?.role === 'gestionnaire';

  if (!commande) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Commande introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/fournisseurs')}>Retour</button>
    </div>
  );

  const totalRecu = commande.lignes.reduce((s, l) => s + l.quantiteRecue, 0);
  const totalCmd  = commande.lignes.reduce((s, l) => s + l.quantite, 0);
  const pctRecu   = totalCmd > 0 ? Math.round((totalRecu / totalCmd) * 100) : 0;

  const handleMarquerRecu = () => {
    if (!confirm('Marquer toute la commande comme reçue ?')) return;
    const lignesRecues = commande.lignes.map(l => ({ ...l, quantiteRecue: l.quantite }));
    updateCommandeFournisseur(commande.id, {
      statut: 'recu',
      lignes: lignesRecues,
      dateReception: new Date(),
      updatedAt: new Date(),
    });
    toast.success('Commande marquée comme reçue');
  };

  const handleMarquerCommandee = () => {
    updateCommandeFournisseur(commande.id, { statut: 'commandee', updatedAt: new Date() });
    toast.success('Statut mis à jour : Commandée');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-muted)' }} onClick={() => navigate('/fournisseurs')}>
        <ArrowLeft size={15} /> Retour aux fournisseurs
      </button>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
              <Package size={26} />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Commande fournisseur</p>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{commande.numero}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={clsx('badge', statutColor(commande.statut))}>{statutLabel(commande.statut)}</span>
                <span className="badge badge-neutral">{commande.fournisseurNom}</span>
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2 flex-wrap justify-end">
              {commande.statut === 'brouillon' && (
                <button className="btn-secondary" onClick={handleMarquerCommandee}>
                  <Truck size={14} /> Marquer commandée
                </button>
              )}
              {['commandee', 'recu_partiel'].includes(commande.statut) && (
                <button className="btn-primary" onClick={handleMarquerRecu}>
                  <CheckCircle size={14} /> Tout reçu
                </button>
              )}
              <button className="btn-secondary" onClick={() => navigate(`/fournisseurs?tab=commandes`)}>
                <Edit size={14} /> Modifier
              </button>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
          <div>
            <p className="label">Date commande</p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{formatDate(commande.dateCommande)}</p>
          </div>
          {commande.dateLivraisonPrevue && (
            <div>
              <p className="label">Livraison prévue</p>
              <p className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--color-ink)' }}>
                <Clock size={12} /> {formatDate(commande.dateLivraisonPrevue)}
              </p>
            </div>
          )}
          {commande.dateReception && (
            <div>
              <p className="label">Date réception</p>
              <p className="text-sm font-medium flex items-center gap-1 text-green-600">
                <CheckCircle size={12} /> {formatDate(commande.dateReception)}
              </p>
            </div>
          )}
          <div>
            <p className="label">Créée par</p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{commande.createdBy}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Total TTC</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(commande.totalTTC)}</p>
          {commande.fraisLivraison > 0 && <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>dont {formatPrice(commande.fraisLivraison)} transport</p>}
        </div>
        <div className="card p-4">
          <p className="label">Payé</p>
          <p className="text-xl font-bold text-green-600">{formatPrice(commande.montantPaye)}</p>
        </div>
        <div className="card p-4" style={commande.resteAPayer > 0 ? { borderLeft: '2px solid #f59e0b' } : {}}>
          <p className="label">Reste à payer</p>
          <p className="text-xl font-bold" style={{ color: commande.resteAPayer > 0 ? '#d97706' : '#16a34a' }}>
            {commande.resteAPayer > 0 ? formatPrice(commande.resteAPayer) : 'Soldé ✓'}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Réception</p>
          <p className="text-xl font-bold" style={{ color: pctRecu === 100 ? '#16a34a' : pctRecu > 0 ? '#d97706' : 'var(--color-ink)' }}>
            {pctRecu}%
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{totalRecu} / {totalCmd} unités</p>
        </div>
      </div>

      {/* Barre de progression réception */}
      {totalCmd > 0 && (
        <div className="card p-4">
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--color-ink-muted)' }}>
            <span>Avancement réception</span>
            <span>{pctRecu}% ({totalRecu}/{totalCmd} unités)</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pctRecu}%`,
                backgroundColor: pctRecu === 100 ? '#16a34a' : pctRecu > 50 ? '#d97706' : 'var(--color-gold)',
              }}
            />
          </div>
        </div>
      )}

      {/* Lignes de commande */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
          <Package size={15} style={{ color: 'var(--color-gold)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
            Articles commandés ({commande.lignes.length})
          </h2>
        </div>
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Qté commandée</th>
              <th>Qté reçue</th>
              <th>Prix achat</th>
              <th>Total</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {commande.lignes.map((l, i) => {
              const resteRecue = l.quantite - l.quantiteRecue;
              return (
                <tr key={i}>
                  <td><span className="font-mono text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{l.produitRef}</span></td>
                  <td style={{ color: 'var(--color-ink)' }}>{l.produitNom}</td>
                  <td className="text-center font-medium" style={{ color: 'var(--color-ink)' }}>{l.quantite}</td>
                  <td className="text-center font-semibold" style={{ color: l.quantiteRecue === l.quantite ? '#16a34a' : l.quantiteRecue > 0 ? '#d97706' : 'var(--color-ink-muted)' }}>
                    {l.quantiteRecue}
                  </td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(l.prixAchat)}</td>
                  <td className="font-medium" style={{ color: 'var(--color-gold)' }}>{formatPrice(l.total)}</td>
                  <td>
                    {l.quantiteRecue === l.quantite
                      ? <span className="badge badge-success">Reçu</span>
                      : l.quantiteRecue > 0
                        ? <span className="badge badge-warning flex items-center gap-1"><AlertTriangle size={10} />Partiel ({resteRecue} restant)</span>
                        : <span className="badge badge-neutral">En attente</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: 'var(--color-cream)' }}>
              <td colSpan={5} className="font-semibold text-right pr-4 py-3" style={{ color: 'var(--color-ink)' }}>Total HT</td>
              <td className="font-bold py-3" style={{ color: 'var(--color-ink)' }}>{formatPrice(commande.totalHT)}</td>
              <td />
            </tr>
            {commande.fraisLivraison > 0 && (
              <tr style={{ backgroundColor: 'var(--color-cream)' }}>
                <td colSpan={5} className="text-right pr-4 py-2" style={{ color: 'var(--color-ink-muted)' }}>Frais de livraison</td>
                <td className="py-2" style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(commande.fraisLivraison)}</td>
                <td />
              </tr>
            )}
            <tr style={{ backgroundColor: 'var(--color-cream)' }}>
              <td colSpan={5} className="font-bold text-right pr-4 py-3" style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)' }}>Total TTC</td>
              <td className="font-bold py-3 text-lg" style={{ color: 'var(--color-gold)' }}>{formatPrice(commande.totalTTC)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {commande.notes && (
        <div className="card p-5">
          <p className="label mb-2">Notes</p>
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{commande.notes}</p>
        </div>
      )}
    </div>
  );
}
