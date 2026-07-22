import { ExternalLink } from 'lucide-react';
import type { Lead } from '@/types';
import LeadStatusBadge from './LeadStatusBadge';

interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  onLeadClick: (lead: Lead) => void;
}

export default function LeadsTable({ leads, loading, onLeadClick }: LeadsTableProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg" style={{ backgroundColor: 'var(--color-cream-dark)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--color-ink-light)' }}>Aucun lead trouvé</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>Ajustez les filtres ou attendez la prochaine capture</p>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th>Produit détecté</th>
            <th>Score</th>
            <th>Groupe source</th>
            <th>Statut</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr
              key={lead.id}
              onClick={() => onLeadClick(lead)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                <span className="font-medium" style={{ color: 'var(--color-ink)' }}>
                  {lead.produitDetecte ?? <span style={{ color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>Non détecté</span>}
                </span>
              </td>
              <td>
                {lead.scoreConfiance !== null ? (
                  <span className="font-mono text-xs">
                    {Math.round(lead.scoreConfiance * 100)}%
                  </span>
                ) : '—'}
              </td>
              <td>
                <span className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                  {(lead as Lead & { groupeNom?: string }).groupeNom ?? '—'}
                </span>
              </td>
              <td>
                <LeadStatusBadge statut={lead.statut} />
              </td>
              <td>
                <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                  {new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </td>
              <td>
                {lead.lienPost && (
                  <a
                    href={lead.lienPost}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: 'var(--color-gold)' }}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
