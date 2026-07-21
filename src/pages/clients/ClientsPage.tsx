import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Building2, User, ArrowUpRight, Phone, Mail, X, Edit, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { clientsApi, USE_API } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/format';
import type { Client } from '@/types';
import { useTableControls } from '@/hooks/useTableControls';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Pagination } from '@/components/ui/Pagination';

const EMPTY_FORM = {
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  adresse: '',
  ville: '',
  pays: '',
  secteurActivite: '',
  typeClient: 'entreprise' as 'particulier' | 'entreprise',
  notes: '',
};

export default function ClientsPage() {
  const { clients, addClient, updateClient, deleteClient } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'tous' | 'particulier' | 'entreprise'>('tous');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'commercial' || user?.role === 'gestionnaire';

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.telephone?.includes(search);
      const matchType = typeFilter === 'tous' || c.typeClient === typeFilter;
      return matchSearch && matchType;
    });
  }, [clients, search, typeFilter]);

  const table = useTableControls(filtered, { defaultSort: 'nom', defaultDirection: 'asc' });

  const totalCA = clients.reduce((s, c) => s + c.totalAchats, 0);
  const totalCreances = clients.reduce((s, c) => s + c.soldeCredit, 0);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(c);
    setForm({
      nom: c.nom,
      prenom: c.prenom ?? '',
      email: c.email ?? '',
      telephone: c.telephone ?? '',
      adresse: c.adresse ?? '',
      ville: c.ville ?? '',
      pays: c.pays ?? '',
      secteurActivite: c.secteurActivite ?? '',
      typeClient: c.typeClient,
      notes: c.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        if (USE_API) {
          const updated = await clientsApi.update(editing.id, form);
          updateClient(editing.id, updated);
        } else {
          updateClient(editing.id, { ...form, updatedAt: new Date() });
        }
        toast.success('Client modifié');
      } else {
        if (USE_API) {
          const created = await clientsApi.create(form);
          addClient(created);
        } else {
          addClient({
            ...form,
            id: `cl-${Date.now()}`,
            code: `CLI-${String(clients.length + 1).padStart(3, '0')}`,
            totalAchats: 0, soldeCredit: 0, nombreCommandes: 0,
            actif: true, createdAt: new Date(), updatedAt: new Date(),
          });
        }
        toast.success('Client créé');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Désactiver le client "${c.nom}" ?`)) return;
    try {
      if (USE_API) {
        await clientsApi.remove(c.id);
      }
      deleteClient(c.id);
      toast.success('Client désactivé');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>CRM</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Clients</h1>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={15} /> Nouveau client
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total clients', value: String(clients.length), sub: `${clients.filter(c => c.actif).length} actifs` },
          { label: 'CA total généré', value: formatPrice(totalCA), sub: 'toutes commandes' },
          { label: 'Créances en cours', value: formatPrice(totalCreances), sub: 'solde dû par les clients' },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--color-ink-muted)' }}>{k.label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{k.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
          <input
            className="input pl-9"
            placeholder="Rechercher par nom, email, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--color-ink-muted)' }} />
          {(['tous', 'entreprise', 'particulier'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize')}
              style={
                typeFilter === t
                  ? { backgroundColor: 'var(--color-gold)', color: 'white' }
                  : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead>
            <tr>
              <SortableHeader column="nom" label="Client" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="email" label="Contact" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="typeClient" label="Type" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="nombreCommandes" label="Commandes" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="totalAchats" label="CA total" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="soldeCredit" label="Créance" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="derniereCommande" label="Dernière cmd" sort={table.sort} onSort={table.setSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {table.paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>
                  Aucun client trouvé
                </td>
              </tr>
            ) : (
              table.paginatedData.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
                      >
                        {c.typeClient === 'entreprise' ? <Building2 size={14} /> : c.nom[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{c.nom}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--color-ink-muted)' }}>{c.code}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-0.5">
                      {c.email && (
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-ink-muted)' }}>
                          <Mail size={11} />{c.email}
                        </p>
                      )}
                      {c.telephone && (
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-ink-muted)' }}>
                          <Phone size={11} />{c.telephone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={clsx('badge', c.typeClient === 'entreprise' ? 'badge-info' : 'badge-neutral')}>
                      {c.typeClient === 'entreprise' ? <Building2 size={11} /> : <User size={11} />}
                      {c.typeClient}
                    </span>
                  </td>
                  <td className="font-medium text-center" style={{ color: 'var(--color-ink)' }}>{c.nombreCommandes}</td>
                  <td className="font-medium" style={{ color: 'var(--color-ink)' }}>{formatPrice(c.totalAchats)}</td>
                  <td>
                    {c.soldeCredit > 0 ? (
                      <span className="badge badge-warning font-medium">{formatPrice(c.soldeCredit)}</span>
                    ) : (
                      <span className="badge badge-success">soldé</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(c.derniereCommande)}</td>
                  <td>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <button
                          onClick={(e) => openEdit(c, e)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gold/10"
                          style={{ color: 'var(--color-ink-muted)' }}
                          title="Modifier"
                        >
                          <Edit size={13} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDelete(c, e)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                          style={{ color: 'var(--color-ink-muted)' }}
                          title="Désactiver"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <ArrowUpRight size={15} style={{ color: 'var(--color-gold)' }} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          page={table.page}
          totalPages={table.totalPages}
          totalItems={table.totalItems}
          pageSize={table.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </div>

      {/* Modal Create / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                {editing ? 'Modifier le client' : 'Nouveau client'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-ink-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Type */}
              <div>
                <label className="label">Type de client</label>
                <div className="flex gap-2 mt-1">
                  {(['entreprise', 'particulier'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, typeClient: t }))}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
                      style={form.typeClient === t
                        ? { backgroundColor: 'var(--color-gold)', color: 'white' }
                        : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }}
                    >
                      {t === 'entreprise' ? <><Building2 size={13} className="inline mr-1" />Entreprise</> : <><User size={13} className="inline mr-1" />Particulier</>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nom / Raison sociale *</label>
                  <input
                    required
                    className="input"
                    placeholder={form.typeClient === 'entreprise' ? 'Ex: Groupe Sonatel' : 'Nom de famille'}
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  />
                </div>
                {form.typeClient === 'particulier' && (
                  <div className="col-span-2">
                    <label className="label">Prénom</label>
                    <input
                      className="input"
                      placeholder="Prénom"
                      value={form.prenom}
                      onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    />
                  </div>
                )}
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
                    placeholder="+221 77 000 00 00"
                    value={form.telephone}
                    onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Adresse</label>
                <input
                  className="input"
                  placeholder="Adresse complète"
                  value={form.adresse}
                  onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ville</label>
                  <input
                    className="input"
                    placeholder="Dakar"
                    value={form.ville}
                    onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
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

              {form.typeClient === 'entreprise' && (
                <div>
                  <label className="label">Secteur d'activité</label>
                  <input
                    className="input"
                    placeholder="Ex: Télécommunications, Finance…"
                    value={form.secteurActivite}
                    onChange={e => setForm(f => ({ ...f, secteurActivite: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="label">Notes (optionnel)</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Informations complémentaires…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
