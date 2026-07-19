import { useState, useEffect } from 'react';
import { Save, Building2, Globe, CreditCard, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'kiosq_config';

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

export default function ConfigurationPage() {
  const [form, setForm] = useState(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setForm(prev => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore parse errors */ }
  }, []);

  const update = (patch: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setSaved(true);
      setDirty(false);
      toast.success('Configuration enregistrée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleReset = () => {
    if (!confirm('Réinitialiser la configuration par défaut ?')) return;
    setForm(DEFAULT_CONFIG);
    localStorage.removeItem(STORAGE_KEY);
    setDirty(false);
    setSaved(false);
    toast.success('Configuration réinitialisée');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Paramètres</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Configuration</h1>
        </div>
        {dirty && (
          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            Modifications non sauvegardées
          </span>
        )}
      </div>

      {/* Entreprise */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={16} style={{ color: 'var(--color-gold)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Informations entreprise</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nom de l'entreprise</label>
            <input className="input" value={form.nom} onChange={e => update({ nom: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={e => update({ adresse: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.telephone} onChange={e => update({ telephone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => update({ email: e.target.value })} />
          </div>
          <div>
            <label className="label">Site web</label>
            <input className="input" value={form.siteWeb} onChange={e => update({ siteWeb: e.target.value })} />
          </div>
          <div>
            <label className="label">SIRET / Registre commerce</label>
            <input className="input" placeholder="Ex: SN-DKR-2024-B-00001" value={form.siret} onChange={e => update({ siret: e.target.value })} />
          </div>
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
            <select className="input" value={form.devise} onChange={e => update({ devise: e.target.value })}>
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
            <input
              type="number"
              className="input"
              value={form.tva}
              onChange={e => update({ tva: e.target.value })}
              min="0"
              max="100"
            />
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
          <textarea
            className="input resize-none"
            rows={3}
            value={form.piedDePage}
            onChange={e => update({ piedDePage: e.target.value })}
            placeholder="Texte affiché en bas de chaque facture imprimée ou PDF…"
          />
        </div>
        <div>
          <label className="label">URL du logo (optionnel)</label>
          <input
            className="input"
            placeholder="https://…/logo.png"
            value={form.logoUrl}
            onChange={e => update({ logoUrl: e.target.value })}
          />
          {form.logoUrl && (
            <img
              src={form.logoUrl}
              alt="Logo"
              className="mt-2 h-12 object-contain rounded"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      </div>

      {/* Aperçu facture */}
      {(form.nom || form.piedDePage) && (
        <div className="card p-6">
          <p className="label mb-3">Aperçu entête / pied de facture</p>
          <div className="rounded-xl p-5 text-sm" style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}>
            <div className="flex justify-between items-start mb-4">
              <div>
                {form.logoUrl && (
                  <img src={form.logoUrl} alt="Logo" className="h-8 mb-2 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <p className="font-bold" style={{ color: 'var(--color-ink)' }}>{form.nom}</p>
                <p style={{ color: 'var(--color-ink-muted)' }}>{form.adresse}</p>
                <p style={{ color: 'var(--color-ink-muted)' }}>{form.telephone}</p>
                <p style={{ color: 'var(--color-ink-muted)' }}>{form.email}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)' }}>FACTURE</p>
                <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>FAC-{new Date().getFullYear()}-001</p>
              </div>
            </div>
            {form.piedDePage && (
              <div className="pt-3 mt-3 text-center text-xs" style={{ borderTop: '1px solid var(--color-cream-dark)', color: 'var(--color-ink-muted)' }}>
                {form.piedDePage}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-secondary" onClick={handleReset}>
          <RefreshCw size={14} /> Réinitialiser
        </button>
        <button className="btn-primary" onClick={handleSave}>
          <Save size={15} /> {saved ? 'Sauvegardé ✓' : 'Enregistrer les modifications'}
        </button>
      </div>
    </div>
  );
}
