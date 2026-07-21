import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Truck, ArrowUpRight, Mail, Phone, Package, X, Edit } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { fournisseursApi, USE_API } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { Fournisseur } from '@/types';
import { useTableControls } from '@/hooks/useTableControls';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Pagination } from '@/components/ui/Pagination';

const EMPTY_FORM = {
  nom: '',
  contact: '',
  email: '',
  telephone: '',
  adresse: '',
  pays: '',
  delaiLivraison: 7,
  conditionsPaiement: '',
  notes: '',
};

export default function FournisseursPage() {
  const { fournisseurs, commandesFournisseurs, addFournisseur, updateFournisseur } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'fournisseurs' | 'commandes'>('fournisseurs');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Fournisseur | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'gestionnaire';

  // Auto-open edit modal if ?edit=<id> is in URL (from FournisseurDetailPage)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      const f = fournisseurs.find(x => x.id === editId);
      if (f) {
        setEditing(f);
        setForm({
          nom: f.nom, contact: f.contact ?? '', email: f.email ?? '',
          telephone: f.telephone ?? '', adresse: f.adresse ?? '',
          pays: f.pays ?? '', delaiLivraison: f.delaiLivraison ?? 7,
          conditionsPaiement: f.conditionsPaiement ?? '', notes: f.notes ?? '',
        });
        setShowModal(true);
        setSearchParams({}, { replace: true }); // clean up URL
      }
    }
  }, [fournisseurs, searchParams, setSearchParams]);

  const filteredF = useMemo(() =>
    fournisseurs.filter(f =>
      f.nom.toLowerCase().includes(search.toLowerCase()) ||
      f.email?.toLowerCase().includes(search.toLowerCase())
    ), [fournisseurs, search]);

  const filteredCF = useMemo(() =>
    commandesFournisseurs.filter(c =>
      c.fournisseurNom.toLowerCase().includes(search.toLowerCase()) ||
      c.numero.toLowerCase().includes(search.toLowerCase())
    ), [commandesFournisseurs, search]);

  const tableF  = useTableControls(filteredF,  { defaultSort: 'nom',          defaultDirection: 'asc'  });
  const tableCF = useTableControls(filteredCF, { defaultSort: 'dateCommande', defaultDirection: 'desc' });

  const totalDettes = fournisseurs.reduce((s, f) => s + f.soldeDette, 0);
  const totalAchats = fournisseurs.reduce((s, f) => s + f.totalAchats, 0);
  const cmdEnCours = commandesFournisseurs.filter(c => ['commandee', 'recu_partiel'].includes(c.statut)).length;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (f: Fournisseur, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(f);
    setForm({
      nom: f.nom,
      contact: f.contact ?? '',
      email: f.email ?? '',
      telephone: f.telephone ?? '',
      adresse: f.adresse ?? '',
      pays: f.pays ?? '',
      delaiLivraison: f.delaiLivraison ?? 7,
      conditionsPaiement: f.conditionsPaiement ?? '',
      notes: f.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        if (USE_API) {
          const updated = await fournisseursApi.update(editing.id, form);
          updateFournisseur(editing.id, updated);
        } else {
          updateFournisseur(editing.id, { ...form, updatedAt: new Date() });
        }
        toast.success('Fournisseur modifié');
      } else {
        if (USE_API) {
          const created = await fournisseursApi.create(form);
          addFournisseur(created);
        } else {
          addFournisseur({
            ...form,
            id: `f-${Date.now()}`,
            soldeDette: 0,
            totalAchats: 0,
            actif: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        toast.success('Fournisseur créé');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Achats</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Fournisseurs</h1>
        </div>
        <div className="flex gap-2">
          {tab === 'fournisseurs' && canEdit && (
            <button className="btn-primary" onClick={openCreate}><Plus size={15} /> Nouveau fournisseur</button>
          )}
          {tab === 'commandes' && canEdit && (
            <button className="btn-primary" onClick={() => navigate('/fournisseurs/commande/nouvelle')}><Plus size={15} /> Nouvelle commande</button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="label">Fournisseurs</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{fournisseurs.length}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{fournisseurs.filter(f => f.actif).length} actifs</p>
        </div>
        <div className="card p-4">
          <p className="label">Total achats</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(totalAchats)}</p>
        </div>
        <div className="card p-4 border-l-2" style={{ borderLeftColor: '#f59e0b' }}>
          <p className="label">Dettes fournisseurs</p>
          <p className="text-xl font-bold" style={{ color: '#d97706' }}>{formatPrice(totalDettes)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{cmdEnCours} commande(s) en cours</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
        {([['fournisseurs', 'Fournisseurs', Truck], ['commandes', 'Commandes achat', Package]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === key
              ? { backgroundColor: 'white', color: 'var(--color-ink)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--color-ink-muted)' }}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
        <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {tab === 'fournisseurs' ? (
        <div className="card p-0 overflow-hidden">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <SortableHeader column="nom" label="Fournisseur" sort={tableF.sort} onSort={tableF.setSort} />
                <SortableHeader column="email" label="Contact" sort={tableF.sort} onSort={tableF.setSort} />
                <SortableHeader column="delaiLivraison" label="Délai livraison" sort={tableF.sort} onSort={tableF.setSort} align="right" />
                <SortableHeader column="totalAchats" label="Total achats" sort={tableF.sort} onSort={tableF.setSort} align="right" />
                <SortableHeader column="soldeDette" label="Dette" sort={tableF.sort} onSort={tableF.setSort} align="right" />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tableF.paginatedData.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucun fournisseur</td></tr>
              ) : tableF.paginatedData.map(f => (
                <tr key={f.id} className="cursor-pointer" onClick={() => navigate(`/fournisseurs/${f.id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
                        <Truck size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{f.nom}</p>
                        {f.pays && <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{f.pays}</p>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-0.5">
                      {f.email && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-ink-muted)' }}><Mail size={10} />{f.email}</p>}
                      {f.telephone && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-ink-muted)' }}><Phone size={10} />{f.telephone}</p>}
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{f.delaiLivraison ? `${f.delaiLivraison}j` : '—'}</td>
                  <td className="font-medium" style={{ color: 'var(--color-gold)' }}>{formatPrice(f.totalAchats)}</td>
                  <td>
                    {f.soldeDette > 0
                      ? <span className="badge badge-warning font-semibold">{formatPrice(f.soldeDette)}</span>
                      : <span className="badge badge-success">soldé</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={(e) => openEdit(f, e)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gold/10"
                          style={{ color: 'var(--color-ink-muted)' }}
                          title="Modifier"
                        >
                          <Edit size={13} />
                        </button>
                      )}
                      <ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={tableF.page}
            totalPages={tableF.totalPages}
            totalItems={tableF.totalItems}
            pageSize={tableF.pageSize}
            onPageChange={tableF.setPage}
            onPageSizeChange={tableF.setPageSize}
          />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <SortableHeader column="numero" label="Numéro" sort={tableCF.sort} onSort={tableCF.setSort} />
                <SortableHeader column="fournisseurNom" label="Fournisseur" sort={tableCF.sort} onSort={tableCF.setSort} />
                <SortableHeader column="totalTTC" label="Total TTC" sort={tableCF.sort} onSort={tableCF.setSort} align="right" />
                <SortableHeader column="montantPaye" label="Payé" sort={tableCF.sort} onSort={tableCF.setSort} align="right" />
                <SortableHeader column="resteAPayer" label="Reste" sort={tableCF.sort} onSort={tableCF.setSort} align="right" />
                <SortableHeader column="statut" label="Statut" sort={tableCF.sort} onSort={tableCF.setSort} />
                <SortableHeader column="dateCommande" label="Date" sort={tableCF.sort} onSort={tableCF.setSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tableCF.paginatedData.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucune commande</td></tr>
              ) : tableCF.paginatedData.map(c => (
                <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/fournisseurs/commande/${c.id}`)}>
                  <td><span className="font-mono text-xs font-medium">{c.numero}</span></td>
                  <td style={{ color: 'var(--color-ink)' }}>{c.fournisseurNom}</td>
                  <td className="font-medium">{formatPrice(c.totalTTC)}</td>
                  <td style={{ color: '#16a34a' }}>{formatPrice(c.montantPaye)}</td>
                  <td style={{ color: c.resteAPayer > 0 ? '#d97706' : '#16a34a' }}>{formatPrice(c.resteAPayer)}</td>
                  <td><span className={clsx('badge', statutColor(c.statut))}>{statutLabel(c.statut)}</span></td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(c.dateCommande)}</td>
                  <td><ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={tableCF.page}
            totalPages={tableCF.totalPages}
            totalItems={tableCF.totalItems}
            pageSize={tableCF.pageSize}
            onPageChange={tableCF.setPage}
            onPageSizeChange={tableCF.setPageSize}
          />
        </div>
      )}

      {/* Modal Create / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                {editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Nom du fournisseur *</label>
                <input
                  required
                  className="input"
                  placeholder="Ex: TechDistrib SA"
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Contact (personne)</label>
                <input
                  className="input"
                  placeholder="Prénom Nom du contact"
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="contact@exemple.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <input
                    className="input"
                    placeholder="+221 33 800 00 00"
                    value={form.telephone}
                    onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Adresse</label>
                  <input
                    className="input"
                    placeholder="Adresse"
                    value={form.adresse}
                    onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Pays</label>
                  <input
                    className="input"
                    placeholder="Sénégal"
                    value={form.pays}
                    onChange={e => setForm(f => ({ ...f, pays: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Délai de livraison (jours)</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={form.delaiLivraison}
                    onChange={e => setForm(f => ({ ...f, delaiLivraison: +e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Conditions de paiement</label>
                  <input
                    className="input"
                    placeholder="Ex: 30 jours"
                    value={form.conditionsPaiement}
                    onChange={e => setForm(f => ({ ...f, conditionsPaiement: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes (optionnel)</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Notes internes…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
