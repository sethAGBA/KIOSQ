import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShoppingCart, CheckCircle, Package, ArrowRight, CreditCard, Receipt } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { commandesApi, USE_API } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { Commande } from '@/types';

const STATUTS_COMMANDE: Array<Commande['statut']> = [
  'brouillon', 'envoye', 'confirme', 'en_preparation', 'expedie', 'livre',
];
const STATUTS_DEVIS: Array<Commande['statut']> = [
  'brouillon', 'envoye', 'accepte', 'refuse', 'expire',
];

export default function CommandeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { commandes, updateCommande } = useAppStore();
  const { user } = useAuthStore();

  const commande = commandes.find(c => c.id === id);
  const canEdit = user?.role === 'admin' || user?.role === 'commercial' || user?.role === 'gestionnaire';
  const [updating, setUpdating] = useState(false);

  if (!commande) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Commande introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/commandes')}>Retour</button>
    </div>
  );

  const isDevis = commande.type === 'devis';
  const statutsList = isDevis ? STATUTS_DEVIS : STATUTS_COMMANDE;

  const handleUpdateStatut = async (newStatut: Commande['statut']) => {
    if (newStatut === commande.statut) return;
    setUpdating(true);
    try {
      if (USE_API) {
        const updated = await commandesApi.update(commande.id, { statut: newStatut });
        updateCommande(commande.id, updated);
      } else {
        updateCommande(commande.id, { statut: newStatut, updatedAt: new Date() });
      }
      toast.success(`Statut mis à jour : ${statutLabel(newStatut)}`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  const nextStatut = (): Commande['statut'] | null => {
    const idx = statutsList.indexOf(commande.statut as typeof statutsList[number]);
    if (idx === -1 || idx >= statutsList.length - 1) return null;
    return statutsList[idx + 1];
  };

  const next = nextStatut();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--color-ink-muted)' }}
        onClick={() => navigate('/commandes')}
      >
        <ArrowLeft size={15} /> Retour aux {isDevis ? 'devis' : 'commandes'}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
          >
            {isDevis ? <FileText size={18} /> : <ShoppingCart size={18} />}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono" style={{ color: 'var(--color-ink)' }}>{commande.numero}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={clsx('badge', statutColor(commande.statut))}>{statutLabel(commande.statut)}</span>
              <span className="badge badge-neutral capitalize">{commande.type}</span>
            </div>
          </div>
        </div>
        {canEdit && next && !['annule', 'livre', 'accepte', 'refuse', 'expire'].includes(commande.statut) && (
          <button
            className="btn-primary"
            disabled={updating}
            onClick={() => handleUpdateStatut(next)}
          >
            <ArrowRight size={14} />
            {updating ? '…' : `→ ${statutLabel(next)}`}
          </button>
        )}
      </div>

      {/* Statut stepper */}
      <div className="card p-4">
        <p className="label mb-3">Progression</p>
        <div className="flex items-center gap-1 overflow-x-auto">
          {statutsList.map((s, i) => {
            const currentIdx = statutsList.indexOf(commande.statut as typeof statutsList[number]);
            const isDone = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => canEdit && handleUpdateStatut(s)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    isCurrent ? 'text-white' : isDone ? '' : ''
                  )}
                  style={
                    isCurrent ? { backgroundColor: 'var(--color-gold)', color: 'white' }
                    : isDone ? { backgroundColor: '#dcfce7', color: '#16a34a' }
                    : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
                  }
                  disabled={!canEdit}
                >
                  {isDone && <CheckCircle size={10} className="inline mr-1" />}
                  {statutLabel(s)}
                </button>
                {i < statutsList.length - 1 && (
                  <div className="w-4 h-0.5 shrink-0" style={{ backgroundColor: isDone ? '#16a34a' : 'var(--color-cream-dark)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>Informations</h2>
          <div className="space-y-3">
            {[
              { label: 'Client', value: commande.clientNom },
              { label: 'Commercial', value: commande.commercial ?? '—' },
              { label: isDevis ? 'Date du devis' : 'Date commande', value: formatDate(commande.dateCommande) },
              ...(isDevis
                ? [{ label: 'Validité', value: formatDate(commande.dateValidite) }]
                : [{ label: 'Livraison prévue', value: formatDate(commande.dateLivraison) }]
              ),
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{row.label}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{row.value}</span>
              </div>
            ))}
            {commande.adresseLivraison && (
              <div>
                <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Adresse de livraison</p>
                <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{commande.adresseLivraison}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>Récapitulatif financier</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-ink-muted)' }}>Total HT</span>
              <span style={{ color: 'var(--color-ink)' }}>{formatPrice(commande.totalHT)}</span>
            </div>
            {commande.remiseGlobale > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-ink-muted)' }}>Remise ({commande.remiseGlobale}%)</span>
                <span style={{ color: '#dc2626' }}>- {formatPrice(commande.totalHT * commande.remiseGlobale / 100)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-ink-muted)' }}>TVA ({commande.tva}%)</span>
              <span style={{ color: 'var(--color-ink)' }}>{formatPrice(commande.totalTTC - commande.totalHT)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2" style={{ borderTop: '2px solid var(--color-gold)' }}>
              <span style={{ color: 'var(--color-ink)' }}>Total TTC</span>
              <span style={{ color: 'var(--color-gold)' }}>{formatPrice(commande.totalTTC)}</span>
            </div>
            {commande.acompte > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#16a34a' }}>Acompte versé</span>
                <span style={{ color: '#16a34a' }}>- {formatPrice(commande.acompte)}</span>
              </div>
            )}
            {commande.resteAPayer > 0 && (
              <div className="flex justify-between text-sm font-bold">
                <span style={{ color: '#d97706' }}>Reste à payer</span>
                <span style={{ color: '#d97706' }}>{formatPrice(commande.resteAPayer)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
          <Package size={15} style={{ color: 'var(--color-gold)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
            Produits ({commande.lignes.length} ligne{commande.lignes.length > 1 ? 's' : ''})
          </h2>
        </div>
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th className="text-right">Qté</th>
              <th className="text-right">P.U.</th>
              <th className="text-right">Remise</th>
              <th className="text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {commande.lignes.map((l, i) => (
              <tr key={i}>
                <td><span className="font-mono text-xs">{l.produitRef}</span></td>
                <td style={{ color: 'var(--color-ink)' }}>{l.produitNom}</td>
                <td className="text-right" style={{ color: 'var(--color-ink-muted)' }}>{l.quantite}</td>
                <td className="text-right">{formatPrice(l.prixUnitaire)}</td>
                <td className="text-right">{l.remise > 0 ? `${l.remise}%` : '—'}</td>
                <td className="text-right font-medium" style={{ color: 'var(--color-ink)' }}>{formatPrice(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {commande.notes && (
        <div className="card p-5">
          <p className="label mb-2">Notes</p>
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{commande.notes}</p>
        </div>
      )}

      {/* Actions contextualles */}
      {canEdit && commande.statut === 'annule' && (
        <div className="card p-4 border-l-4" style={{ borderLeftColor: '#ef4444' }}>
          <p className="text-sm font-medium text-red-600">Cette commande a été annulée.</p>
        </div>
      )}

      {/* ── Envoyer en caisse ou en facturation ────────────── */}
      {!isDevis && canEdit && ['confirme', 'en_preparation', 'expedie', 'livre'].includes(commande.statut) && (
        <div className="card p-5 border-l-4" style={{ borderLeftColor: 'var(--color-gold)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-ink)' }}>
            Traitement de la commande
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-ink-muted)' }}>
            Envoyez cette commande en caisse pour un encaissement immédiat, ou créez une facture formelle avec délai de paiement.
          </p>
          <div className="flex flex-wrap gap-3">
            {/* Envoyer en caisse */}
            <button
              className="btn-primary flex items-center gap-2 text-sm"
              disabled={updating}
              onClick={async () => {
                // Verrouiller la commande
                try {
                  if (USE_API) {
                    const updated = await commandesApi.update(commande.id, { statut: 'en_caisse' as Commande['statut'] });
                    updateCommande(commande.id, updated);
                  } else {
                    updateCommande(commande.id, { statut: 'en_caisse' as Commande['statut'], updatedAt: new Date() });
                  }
                } catch { /* non bloquant */ }
                navigate('/pos', {
                  state: {
                    commandeId: commande.id,
                    commandeNumero: commande.numero,
                    statutPrecedent: commande.statut,
                    clientId: commande.clientId,
                    clientNom: commande.clientNom,
                    lignes: commande.lignes,
                    remiseGlobale: commande.remiseGlobale,
                    tva: commande.tva,
                  },
                });
              }}
            >
              <CreditCard size={15} />
              Envoyer en caisse
            </button>

            {/* Créer la facture */}
            <button
              className="btn-secondary flex items-center gap-2 text-sm"
              disabled={updating}
              onClick={async () => {
                try {
                  if (USE_API) {
                    const updated = await commandesApi.update(commande.id, { statut: 'en_facturation' as Commande['statut'] });
                    updateCommande(commande.id, updated);
                  } else {
                    updateCommande(commande.id, { statut: 'en_facturation' as Commande['statut'], updatedAt: new Date() });
                  }
                } catch { /* non bloquant */ }
                navigate('/facturation', {
                  state: {
                    commandeId: commande.id,
                    statutPrecedent: commande.statut,
                  },
                });
              }}
            >
              <Receipt size={15} />
              Créer la facture
            </button>
          </div>
        </div>
      )}

      {/* Commande verrouillée en caisse par un autre utilisateur */}
      {!isDevis && commande.statut === 'en_caisse' && (
        <div className="card p-5 border-l-4" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#d97706' }}>🔒 Commande en cours d'encaissement</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
                Cette commande est actuellement ouverte en caisse.
              </p>
            </div>
            {canEdit && (
              <button
                className="btn-secondary text-xs"
                disabled={updating}
                onClick={() => handleUpdateStatut('confirme')}
              >
                Libérer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Commande verrouillée en facturation */}
      {!isDevis && commande.statut === 'en_facturation' && (
        <div className="card p-5 border-l-4" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#2563eb' }}>🔒 Commande en cours de facturation</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
                Cette commande est actuellement ouverte dans le module facturation.
              </p>
            </div>
            {canEdit && (
              <button
                className="btn-secondary text-xs"
                disabled={updating}
                onClick={() => handleUpdateStatut('confirme')}
              >
                Libérer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Devis accepté → créer commande ou facture */}
      {isDevis && canEdit && commande.statut === 'accepte' && (
        <div className="card p-5 border-l-4" style={{ borderLeftColor: '#16a34a' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#16a34a' }}>
            Devis accepté
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-ink-muted)' }}>
            Le client a accepté le devis. Vous pouvez maintenant créer la facture correspondante.
          </p>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => navigate('/facturation', { state: { commandeId: commande.id } })}
          >
            <Receipt size={15} />
            Créer la facture
          </button>
        </div>
      )}
    </div>
  );
}
