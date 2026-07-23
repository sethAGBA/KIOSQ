import { useState } from 'react';
import {
  Store, Plus, MapPin, Phone, Edit, Trash2, X,
  CheckCircle, XCircle
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { magasinsApi, USE_API } from '@/lib/api';
import type { Magasin } from '@/types';

export default function MagasinsPage() {
  const { magasins, addMagasin, updateMagasin, deleteMagasin } = useAppStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // ── States ────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMagasin, setEditingMagasin] = useState<Magasin | null>(null);

  const [form, setForm] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    actif: true,
  });

  const [saving, setSaving] = useState(false);

  // ── Modal Handlers ────────────────────────────────────────
  const openCreateModal = () => {
    setEditingMagasin(null);
    setForm({ nom: '', adresse: '', telephone: '', actif: true });
    setShowModal(true);
  };

  const openEditModal = (m: Magasin) => {
    setEditingMagasin(m);
    setForm({
      nom: m.nom,
      adresse: m.adresse || '',
      telephone: m.telephone || '',
      actif: m.actif ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) {
      toast.error('Le nom du magasin est obligatoire');
      return;
    }
    setSaving(true);

    try {
      if (editingMagasin) {
        if (USE_API) {
          const updated = await magasinsApi.update(editingMagasin.id, form);
          updateMagasin(editingMagasin.id, updated);
        } else {
          updateMagasin(editingMagasin.id, form);
        }
        toast.success('Magasin mis à jour avec succès');
      } else {
        if (USE_API) {
          const created = await magasinsApi.create(form);
          addMagasin(created);
        } else {
          const newMagasin: Magasin = {
            id: `mag-${Date.now()}`,
            nom: form.nom,
            adresse: form.adresse,
            telephone: form.telephone,
            actif: form.actif,
            createdAt: new Date(),
          };
          addMagasin(newMagasin);
        }
        toast.success('Nouveau magasin créé');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: Magasin) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le magasin "${m.nom}" ?`)) return;
    try {
      if (USE_API) {
        await magasinsApi.delete(m.id);
      }
      deleteMagasin(m.id);
      toast.success('Magasin supprimé');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  const toggleStatut = async (m: Magasin) => {
    const nextState = !m.actif;
    try {
      if (USE_API) {
        await magasinsApi.update(m.id, { actif: nextState });
      }
      updateMagasin(m.id, { actif: nextState });
      toast.success(`Magasin ${nextState ? 'activé' : 'désactivé'}`);
    } catch (err: any) {
      toast.error('Impossible de modifier le statut');
    }
  };

  // ── Filtrage ──────────────────────────────────────────────
  const magasinsFiltres = magasins.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.nom.toLowerCase().includes(q) ||
      (m.adresse && m.adresse.toLowerCase().includes(q)) ||
      (m.telephone && m.telephone.toLowerCase().includes(q))
    );
  });

  const countActifs = magasins.filter(m => m.actif !== false).length;
  const countInactifs = magasins.filter(m => m.actif === false).length;

  return (
    <div className="space-y-6">
      {/* ── En-tête ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store size={22} style={{ color: 'var(--color-gold)' }} />
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              Gestion Multi-Magasins
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
            Gérez vos points de vente, succursales et affectations du personnel
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Ajouter un magasin
          </button>
        )}
      </div>

      {/* ── Cartes Statistiques ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border flex items-center gap-3 shadow-sm" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
            <Store size={20} />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>Total Points de Vente</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{magasins.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border flex items-center gap-3 shadow-sm" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>Magasins Actifs</p>
            <p className="text-xl font-bold text-emerald-700">{countActifs}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border flex items-center gap-3 shadow-sm" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>Magasins Inactifs</p>
            <p className="text-xl font-bold text-gray-700">{countInactifs}</p>
          </div>
        </div>
      </div>

      {/* ── Recherche & Grille des Magasins ───────────────────── */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4" style={{ borderColor: 'var(--color-cream-dark)' }}>
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            className="input max-w-sm text-sm"
            placeholder="Rechercher par nom, adresse ou téléphone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {magasinsFiltres.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto text-gray-400">
              <Store size={24} />
            </div>
            <p className="text-sm font-medium text-gray-500">Aucun magasin trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {magasinsFiltres.map(m => {
              const isActif = m.actif !== false;
              return (
                <div
                  key={m.id}
                  className={clsx(
                    'p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4',
                    isActif ? 'bg-white hover:shadow-md' : 'bg-gray-50/70 opacity-75'
                  )}
                  style={{ borderColor: 'var(--color-cream-dark)' }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: isActif ? 'var(--color-gold-pale)' : '#f3f4f6',
                            color: isActif ? 'var(--color-gold)' : '#9ca3af',
                          }}
                        >
                          <Store size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-base" style={{ color: 'var(--color-ink)' }}>{m.nom}</h3>
                          <span
                            className={clsx(
                              'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider inline-block mt-0.5',
                              isActif ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                            )}
                          >
                            {isActif ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
                      {m.adresse ? (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-400 shrink-0" />
                          <span className="truncate">{m.adresse}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-400 italic">
                          <MapPin size={14} className="shrink-0" />
                          <span>Adresse non spécifiée</span>
                        </div>
                      )}

                      {m.telephone ? (
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-gray-400 shrink-0" />
                          <span>{m.telephone}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-400 italic">
                          <Phone size={14} className="shrink-0" />
                          <span>Téléphone non renseigné</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                      <button
                        onClick={() => toggleStatut(m)}
                        className={clsx(
                          'font-semibold px-2.5 py-1 rounded-lg transition-colors',
                          isActif ? 'hover:bg-amber-50 text-amber-700' : 'hover:bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {isActif ? 'Désactiver' : 'Activer'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(m)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Création / Édition ──────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <div className="flex items-center gap-2">
                <Store size={18} style={{ color: 'var(--color-gold)' }} />
                <h3 className="font-bold text-base" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  {editingMagasin ? 'Modifier le magasin' : 'Nouveau magasin / Succursale'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nom du magasin *</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="Ex: Succursale Akwa, Boutique Centrale…"
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Adresse</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Boulevard de la Liberté, Douala"
                  value={form.adresse}
                  onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Téléphone</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: +237 600 000 000"
                  value={form.telephone}
                  onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="magasin-actif-cb"
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                  checked={form.actif}
                  onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                />
                <label htmlFor="magasin-actif-cb" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                  Magasin actif et ouvert aux opérations
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {saving ? 'Enregistrement…' : editingMagasin ? 'Enregistrer' : 'Créer le magasin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
