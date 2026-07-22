import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi } from '@/lib/api';
import { useLeadsStore } from '@/store/leadsStore';
import LeadStatusBadge from '@/components/leads/LeadStatusBadge';
import LeadConvertButton from '@/components/leads/LeadConvertButton';
import type { Lead, StatutLead, Client } from '@/types';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const updateLeadStatut = useLeadsStore(s => s.updateLeadStatut);

  const [lead, setLead] = useState<(Lead & { groupeNom?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [statutLoading, setStatutLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    leadsApi.getById(id)
      .then(setLead)
      .catch(err => {
        toast.error(err instanceof Error ? err.message : 'Lead introuvable');
        navigate('/leads');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleStatutChange = async (newStatut: StatutLead) => {
    if (!lead || newStatut === lead.statut) return;
    setStatutLoading(true);
    try {
      await updateLeadStatut(lead.id, newStatut);
      setLead(prev => prev ? { ...prev, statut: newStatut } : prev);
      toast.success('Statut mis à jour');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setStatutLoading(false);
    }
  };

  const handleConverted = (client: Client) => {
    setLead(prev => prev ? {
      ...prev,
      clientId: client.id,
      clientNom: client.nom,
      statut: 'envoye',
    } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-sm" style={{ color: 'var(--color-ink-muted)' }}>Chargement…</div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <button
        type="button"
        onClick={() => navigate('/leads')}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: 'var(--color-ink-muted)' }}
      >
        <ArrowLeft size={16} />
        Retour aux leads
      </button>

      <div className="card space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              {lead.produitDetecte ?? `Lead #${lead.id.slice(0, 8)}`}
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
              Créé le {new Date(lead.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          <LeadStatusBadge statut={lead.statut} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label">Score de confiance</p>
            <p className="text-2xl font-mono font-semibold" style={{ color: 'var(--color-gold)' }}>
              {lead.scoreConfiance !== null ? `${Math.round(lead.scoreConfiance * 100)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="label">Groupe source</p>
            <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{lead.groupeNom ?? '—'}</p>
          </div>
        </div>

        <div>
          <p className="label">Texte original</p>
          <p className="text-sm whitespace-pre-wrap p-4 rounded-xl" style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-ink)' }}>
            {lead.texteOriginal}
          </p>
        </div>

        {lead.lienPost && (
          <div>
            <p className="label">Post Facebook</p>
            <a
              href={lead.lienPost}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm"
              style={{ color: 'var(--color-gold)' }}
            >
              Voir le post <ExternalLink size={14} />
            </a>
          </div>
        )}

        {lead.clientId && (
          <div>
            <p className="label">Client associé</p>
            <Link
              to={`/clients/${lead.clientId}`}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--color-gold)' }}
            >
              {lead.clientNom ?? 'Voir la fiche client'}
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4 pt-4 border-t" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <div>
            <label className="label">Statut</label>
            <select
              className="input w-auto"
              value={lead.statut}
              disabled={statutLoading}
              onChange={e => handleStatutChange(e.target.value as StatutLead)}
            >
              <option value="nouveau">Nouveau</option>
              <option value="envoye">Envoyé</option>
              <option value="ignore">Ignoré</option>
            </select>
          </div>

          <LeadConvertButton
            leadId={lead.id}
            clientId={lead.clientId}
            onConverted={handleConverted}
          />
        </div>
      </div>
    </div>
  );
}
