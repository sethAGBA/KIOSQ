import { Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GroupeSurveille } from '@/types';

interface GroupesSurveillésTableProps {
  groupes: GroupeSurveille[];
  loading: boolean;
  leadsCountByGroupe?: Record<string, number>;
  onEdit: (groupe: GroupeSurveille) => void;
  onDelete: (id: string) => void;
}

const STATUT_LABEL: Record<GroupeSurveille['statut'], string> = {
  actif:   'Actif',
  inactif: 'Inactif',
  erreur:  'Erreur',
};

const STATUT_CLASS: Record<GroupeSurveille['statut'], string> = {
  actif:   'badge-success',
  inactif: 'badge-neutral',
  erreur:  'badge-warning',
};

export default function GroupesSurveillésTable({
  groupes,
  loading,
  leadsCountByGroupe = {},
  onEdit,
  onDelete,
}: GroupesSurveillésTableProps) {
  const handleDelete = async (groupe: GroupeSurveille) => {
    if (!window.confirm(`Supprimer le groupe « ${groupe.nomGroupe} » ?`)) return;
    try {
      await onDelete(groupe.id);
      toast.success('Groupe supprimé');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg" style={{ backgroundColor: 'var(--color-cream-dark)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (groupes.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--color-ink-light)' }}>Aucun groupe surveillé</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>Ajoutez un groupe Facebook pour démarrer la capture</p>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th>Nom</th>
            <th>URL</th>
            <th>Statut</th>
            <th>Leads</th>
            <th>Créé le</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {groupes.map(groupe => (
            <tr key={groupe.id}>
              <td>
                <span className="font-medium" style={{ color: 'var(--color-ink)' }}>{groupe.nomGroupe}</span>
              </td>
              <td>
                <a
                  href={groupe.urlGroupe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs truncate block max-w-[200px]"
                  style={{ color: 'var(--color-gold)' }}
                >
                  {groupe.urlGroupe}
                </a>
              </td>
              <td>
                <span className={`badge ${STATUT_CLASS[groupe.statut]}`}>{STATUT_LABEL[groupe.statut]}</span>
              </td>
              <td>
                <span className="text-sm font-mono" style={{ color: 'var(--color-ink-muted)' }}>
                  {leadsCountByGroupe[groupe.id] ?? 0}
                </span>
              </td>
              <td>
                <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                  {new Date(groupe.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </td>
              <td>
                <div className="flex items-center gap-1 justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(groupe)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-ink-muted)' }}
                    title="Modifier"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(groupe)}
                    className="p-1.5 rounded-lg transition-colors hover:text-red-600"
                    style={{ color: 'var(--color-ink-muted)' }}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
