import { useState, useEffect } from 'react';
import { Plus, Save, Building2, Globe, CreditCard, RefreshCw, Tag, Ruler, ShieldAlert, X, Edit, Trash2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { categoriesApi } from '@/lib/api';
import clsx from 'clsx';
import type { Categorie, Unite } from '@/types';

const STORAGE_KEY = 'kiosq_config';
const UNITES_KEY = 'kiosq_unites';

const DEFAULT_CONFIG = {
  nom: 'Kiosq Commercial',
  adresse: 'Dakar, Sénégal',
  telephone: '+221 33 800 00 00',
  email: 'contact@kiosq.com',
  siteWeb: 'www.kiosq.com',
  siret: '',
  devise: 'XOF',
  tva: '18',
  piedDePage: 'Merci pour votre confiance — Kiosq Commercial',
  logoUrl: '',
};

type Tab = 'categories' | 'unites' | 'entreprise' | 'maintenance';

export default function ConfigurationPage() {
  const { categories, addCategorie, updateCategorie, deleteCategorie } = useAppStore();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('categories');

  // Entreprise state
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Categories state
  const [catModal, setCatModal] = useState(false);
  const [catEditing, setCatEditing] = useState<Categorie | null>(null);
  const [catForm, setCatForm] = useState({ nom: '', description: '' });
  const [catLoading, setCatLoading] = useState(false);

  // Unités state
  const [unites, setUnites] = useState<Unite[]>([]);
  const [uniteModal, setUniteModal] = useState(false);
  const [uniteEditing, setUniteEditing] = useState<Unite | null>(null);
  const [uniteForm, setUniteForm] = useState({ nom: '', abreviation: '' });

  // Maintenance
  const [confirmText, setConfirmText] = useState('');

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'gestionnaire';

  useEffect(() => {
    // Load config
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setConfig(prev => ({ ...prev, ...JSON.parse(stored) }));
    } catch { }
    // Load unités
    try {
      const stored = localStorage.getItem(UNITES_KEY);
      if (stored) setUnites(JSON.parse(stored));
    } catch { }
  }, []);


  // ── Entreprise ──────────────────────────────────────────
  const updateConfig = (patch: Partial<typeof config>) => {
    setConfig(p => ({ ...p, ...patch }));
    setDirty(true); setSaved(false);
  };
  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaved(true); setDirty(false);
    toast.success('Configuration enregistrée');
  };
  const handleReset = () => {
    if (!confirm('Réinitialiser la configuration par défaut ?')) return;
    setConfig(DEFAULT_CONFIG);
    localStorage.removeItem(STORAGE_KEY);
    setDirty(false); setSaved(false);
    toast.success('Configuration réinitialisée');
  };

  // ── Catégories ──────────────────────────────────────────
  const openCatCreate = () => { setCatEditing(null); setCatForm({ nom: '', description: '' }); setCatModal(true); };
  const openCatEdit = (c: Categorie) => { setCatEditing(c); setCatForm({ nom: c.nom, description: c.description ?? '' }); setCatModal(true); };
  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setCatLoading(true);
    try {
      if (catEditing) {
        await categoriesApi.update(catEditing.id, catForm).catch(() => null);
        updateCategorie(catEditing.id, catForm);
        toast.success('Catégorie modifiée');
      } else {
        const created = await categoriesApi.create(catForm).catch(() => null);
        const newCat: Categorie = created ?? { id: `cat-${Date.now()}`, ...catForm, createdAt: new Date() };
        addCategorie(newCat);
        toast.success('Catégorie créée');
      }
      setCatModal(false);
    } finally { setCatLoading(false); }
  };
  const handleCatDelete = async (c: Categorie) => {
    if (!confirm(`Supprimer la catégorie "${c.nom}" ?`)) return;
    await categoriesApi.remove(c.id).catch(() => null);
    deleteCategorie(c.id);
    toast.success('Catégorie supprimée');
  };

  // ── Unités ──────────────────────────────────────────────
  const saveUnites = (list: Unite[]) => { setUnites(list); localStorage.setItem(UNITES_KEY, JSON.stringify(list)); };
  const openUniteCreate = () => { setUniteEditing(null); setUniteForm({ nom: '', abreviation: '' }); setUniteModal(true); };
  const openUniteEdit = (u: Unite) => { setUniteEditing(u); setUniteForm({ nom: u.nom, abreviation: u.abreviation }); setUniteModal(true); };
  const handleUniteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uniteEditing) {
      saveUnites(unites.map(u => u.id === uniteEditing.id ? { ...u, ...uniteForm } : u));
      toast.success('Unité modifiée');
    } else {
      saveUnites([...unites, { id: `u-${Date.now()}`, ...uniteForm, createdAt: new Date() }]);
      toast.success('Unité créée');
    }
    setUniteModal(false);
  };
  const handleUniteDelete = (u: Unite) => {
    if (!confirm(`Supprimer l'unité "${u.nom}" ?`)) return;
    saveUnites(unites.filter(x => x.id !== u.id));
    toast.success('Unité supprimée');
  };

  // ── Maintenance ─────────────────────────────────────────
  const handleMaintenance = () => {
    if (confirmText !== 'INITIALISER') { toast.error('Tapez INITIALISER pour confirmer'); return; }
    localStorage.clear();
    toast.success('Données réinitialisées — rechargement…');
    setTimeout(() => window.location.reload(), 1500);
  };

  const TABS: { key: Tab; label: string; Icon: any }[] = [
    { key: 'categories', label: 'Catégories', Icon: Tag },
    { key: 'unites', label: 'Unités', Icon: Ruler },
    { key: 'entreprise', label: 'Entreprise', Icon: Building2 },
    ...(isAdmin ? [{ key: 'maintenance' as Tab, label: 'Maintenance', Icon: ShieldAlert }] : []),
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Paramètres</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Configuration</h1>
        </div>
        {dirty && <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>Non sauvegardé</span>}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx('flex items-center gap-2 px-4 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === key
                ? key === 'maintenance' ? 'text-red-500 border-red-500' : 'border-b-2'
                : 'border-transparent'
            )}
            style={tab === key && key !== 'maintenance' ? { color: 'var(--color-gold)', borderColor: 'var(--color-gold)' } : tab !== key ? { color: 'var(--color-ink-muted)' } : {}}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Catégories ── */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Catégories produits ({categories.length})</h2>
            {canEdit && <button className="btn-primary" onClick={openCatCreate}><Plus size={14} /> Nouvelle catégorie</button>}
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-auto w-full">
              <thead><tr><th>Nom</th><th>Description</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucune catégorie</td></tr>
                ) : categories.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium" style={{ color: 'var(--color-ink)' }}>{c.nom}</td>
                    <td style={{ color: 'var(--color-ink-muted)' }}>{c.description || '—'}</td>
                    {canEdit && (
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openCatEdit(c)} className="p-1.5 rounded-lg hover:bg-gold/10 transition-colors" style={{ color: 'var(--color-ink-muted)' }}><Edit size={13} /></button>
                          <button onClick={() => handleCatDelete(c)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" style={{ color: 'var(--color-ink-muted)' }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Unités ── */}
      {tab === 'unites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Unités de mesure ({unites.length})</h2>
            {canEdit && <button className="btn-primary" onClick={openUniteCreate}><Plus size={14} /> Nouvelle unité</button>}
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="table-auto w-full">
              <thead><tr><th>Nom</th><th>Abréviation</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {unites.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>
                    <p className="mb-2">Aucune unité personnalisée</p>
                    <p className="text-xs">Les unités par défaut (pièce, kg, litre…) sont toujours disponibles dans les formulaires produit.</p>
                  </td></tr>
                ) : unites.map(u => (
                  <tr key={u.id}>
                    <td className="font-medium" style={{ color: 'var(--color-ink)' }}>{u.nom}</td>
                    <td><span className="font-mono text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-gold)' }}>{u.abreviation}</span></td>
                    {canEdit && (
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openUniteEdit(u)} className="p-1.5 rounded-lg hover:bg-gold/10 transition-colors" style={{ color: 'var(--color-ink-muted)' }}><Edit size={13} /></button>
                          <button onClick={() => handleUniteDelete(u)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" style={{ color: 'var(--color-ink-muted)' }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Entreprise ── */}
      {tab === 'entreprise' && (
        <div className="space-y-6">
          {/* Infos entreprise */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={16} style={{ color: 'var(--color-gold)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Informations entreprise</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Nom de l'entreprise</label><input className="input" value={config.nom} onChange={e => updateConfig({ nom: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Adresse</label><input className="input" value={config.adresse} onChange={e => updateConfig({ adresse: e.target.value })} /></div>
              <div><label className="label">Téléphone</label><input className="input" value={config.telephone} onChange={e => updateConfig({ telephone: e.target.value })} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={config.email} onChange={e => updateConfig({ email: e.target.value })} /></div>
              <div><label className="label">Site web</label><input className="input" value={config.siteWeb} onChange={e => updateConfig({ siteWeb: e.target.value })} /></div>
              <div><label className="label">SIRET / Registre commerce</label><input className="input" placeholder="SN-DKR-2024-B-00001" value={config.siret} onChange={e => updateConfig({ siret: e.target.value })} /></div>
            </div>
          </div>

          {/* Financier */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={16} style={{ color: 'var(--color-gold)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Paramètres financiers</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Devise</label>
                <select className="input" value={config.devise} onChange={e => updateConfig({ devise: e.target.value })}>
                  <option value="XOF">XOF — Franc CFA (UEMOA)</option>
                  <option value="XAF">XAF — Franc CFA (CEMAC)</option>
                  <option value="GNF">GNF — Franc guinéen</option>
                  <option value="MAD">MAD — Dirham marocain</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar US</option>
                </select>
              </div>
              <div>
                <label className="label">TVA par défaut (%)</label>
                <input type="number" className="input" value={config.tva} onChange={e => updateConfig({ tva: e.target.value })} min="0" max="100" />
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={16} style={{ color: 'var(--color-gold)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Documents & Impression</h2>
            </div>
            <div>
              <label className="label">Pied de page des factures</label>
              <textarea className="input resize-none" rows={3} value={config.piedDePage} onChange={e => updateConfig({ piedDePage: e.target.value })} placeholder="Texte affiché en bas de chaque facture…" />
            </div>
            <div>
              <label className="label">URL du logo (optionnel)</label>
              <input className="input" placeholder="https://…/logo.png" value={config.logoUrl} onChange={e => updateConfig({ logoUrl: e.target.value })} />
              {config.logoUrl && <img src={config.logoUrl} alt="Logo" className="mt-2 h-12 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            </div>
          </div>

          {/* Aperçu */}
          {(config.nom || config.piedDePage) && (
            <div className="card p-6">
              <p className="label mb-3">Aperçu entête facture</p>
              <div className="rounded-xl p-5 text-sm" style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-bold" style={{ color: 'var(--color-ink)' }}>{config.nom}</p>
                    <p style={{ color: 'var(--color-ink-muted)' }}>{config.adresse}</p>
                    <p style={{ color: 'var(--color-ink-muted)' }}>{config.telephone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)' }}>FACTURE</p>
                    <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>FAC-{new Date().getFullYear()}-001</p>
                  </div>
                </div>
                {config.piedDePage && <div className="pt-3 mt-3 text-center text-xs" style={{ borderTop: '1px solid var(--color-cream-dark)', color: 'var(--color-ink-muted)' }}>{config.piedDePage}</div>}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={handleReset}><RefreshCw size={14} /> Réinitialiser</button>
            <button className="btn-primary" onClick={handleSave}><Save size={15} /> {saved ? 'Sauvegardé ✓' : 'Enregistrer'}</button>
          </div>
        </div>
      )}

      {/* ── Maintenance ── */}
      {tab === 'maintenance' && isAdmin && (
        <div className="space-y-6 max-w-2xl">
          <div className="rounded-2xl p-6 flex gap-4" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h4 className="font-bold text-lg mb-2" style={{ color: '#7f1d1d' }}>Zone Danger — Réinitialisation</h4>
              <p className="text-sm mb-3" style={{ color: '#b91c1c' }}>Cette action est <strong>irréversible</strong>. Elle effacera toutes les données locales (mock) :</p>
              <ul className="grid grid-cols-2 gap-1 text-xs font-medium" style={{ color: '#dc2626' }}>
                {['Tous les produits', 'Toutes les ventes', 'Tous les clients', 'Tous les fournisseurs', 'Toutes les factures', 'Toutes les commandes'].map(item => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="card p-6 space-y-4 max-w-sm mx-auto">
            <p className="text-sm text-center" style={{ color: 'var(--color-ink-muted)' }}>
              Tapez <strong style={{ color: 'var(--color-ink)' }}>INITIALISER</strong> pour confirmer :
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              className="input text-center font-bold tracking-widest text-lg"
              placeholder="Tapez ici…"
            />
            <button
              onClick={handleMaintenance}
              disabled={confirmText !== 'INITIALISER'}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              style={confirmText === 'INITIALISER'
                ? { backgroundColor: '#dc2626', color: 'white' }
                : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)', cursor: 'not-allowed' }}
            >
              <RotateCcw size={18} /> Réinitialiser toutes les données
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {catModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{catEditing ? 'Modifier' : 'Nouvelle'} catégorie</h3>
              <button onClick={() => setCatModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCatSubmit} className="px-6 py-5 space-y-4">
              <div><label className="label">Nom *</label><input required className="input" placeholder="Ex: Boissons" value={catForm.nom} onChange={e => setCatForm(f => ({ ...f, nom: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea className="input resize-none" rows={2} placeholder="Optionnel…" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setCatModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={catLoading} className="btn-primary flex-1">{catLoading ? 'Enregistrement…' : 'Valider'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {uniteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{uniteEditing ? 'Modifier' : 'Nouvelle'} unité</h3>
              <button onClick={() => setUniteModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleUniteSubmit} className="px-6 py-5 space-y-4">
              <div><label className="label">Nom *</label><input required className="input" placeholder="Ex: Kilogramme" value={uniteForm.nom} onChange={e => setUniteForm(f => ({ ...f, nom: e.target.value }))} /></div>
              <div><label className="label">Abréviation *</label><input required className="input font-mono" placeholder="Ex: kg" maxLength={5} value={uniteForm.abreviation} onChange={e => setUniteForm(f => ({ ...f, abreviation: e.target.value }))} /></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setUniteModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
