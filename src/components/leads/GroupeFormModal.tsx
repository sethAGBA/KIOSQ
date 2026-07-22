import { useState } from 'react';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLeadsStore } from '@/store/leadsStore';
import type { GroupeSurveille, StatutGroupe } from '@/types';

interface GroupeFormModalProps {
  groupe?: GroupeSurveille;
  onSave: () => void;
  onClose: () => void;
}

const STATUTS: { value: StatutGroupe; label: string }[] = [
  { value: 'actif',   label: 'Actif' },
  { value: 'inactif', label: 'Inactif' },
  { value: 'erreur',  label: 'Erreur' },
];

export default function GroupeFormModal({ groupe, onSave, onClose }: GroupeFormModalProps) {
  const createGroupe = useLeadsStore(s => s.createGroupe);
  const updateGroupe = useLeadsStore(s => s.updateGroupe);

  const [nomGroupe, setNomGroupe] = useState(groupe?.nomGroupe ?? '');
  const [urlGroupe, setUrlGroupe] = useState(groupe?.urlGroupe ?? '');
  const [cookieSession, setCookieSession] = useState('');
  const [statut, setStatut] = useState<StatutGroupe>(groupe?.statut ?? 'actif');
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(groupe);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomGroupe.trim()) {
      toast.error('Le nom du groupe est obligatoire');
      return;
    }
    if (!urlGroupe.trim()) {
      toast.error("L'URL du groupe est obligatoire");
      return;
    }
    try {
      new URL(urlGroupe);
    } catch {
      toast.error('URL invalide');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        nomGroupe: nomGroupe.trim(),
        urlGroupe: urlGroupe.trim(),
        statut,
        ...(cookieSession.trim() ? { cookieSession: cookieSession.trim() } : {}),
      };

      if (isEdit && groupe) {
        await updateGroupe(groupe.id, payload);
        toast.success('Groupe mis à jour');
      } else {
        await createGroupe(payload);
        toast.success('Groupe créé');
      }
      onSave();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            {isEdit ? 'Modifier le groupe' : 'Ajouter un groupe surveillé'}
          </h3>
          <button onClick={onClose} type="button" style={{ color: 'var(--color-ink-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Nom du groupe *</label>
            <input
              type="text"
              className="input"
              value={nomGroupe}
              onChange={e => setNomGroupe(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">URL Facebook *</label>
            <input
              type="url"
              className="input"
              value={urlGroupe}
              onChange={e => setUrlGroupe(e.target.value)}
              placeholder="https://www.facebook.com/groups/..."
              required
            />
          </div>

          <div>
            <label className="label">Cookie de session (optionnel)</label>
            <input
              type="password"
              className="input font-mono text-xs"
              value={cookieSession}
              onChange={e => setCookieSession(e.target.value)}
              placeholder={isEdit ? 'Laisser vide pour conserver' : ''}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="label">Statut</label>
            <select className="input" value={statut} onChange={e => setStatut(e.target.value as StatutGroupe)}>
              {STATUTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? 'Enregistrement…' : <><Check size={16} /> {isEdit ? 'Enregistrer' : 'Créer'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
