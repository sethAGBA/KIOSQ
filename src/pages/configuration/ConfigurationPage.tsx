import { useState } from 'react';
import { Save, Building2, Globe, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConfigurationPage() {
  const [form, setForm] = useState({
    nom: 'Kiosq Commercial',
    adresse: 'Dakar, Sénégal',
    telephone: '+221 33 800 00 00',
    email: 'contact@kiosq.com',
    siteWeb: 'www.kiosq.com',
    devise: 'XOF',
    tva: '18',
    piedDePage: 'Merci pour votre confiance — Kiosq Commercial',
  });

  const handleSave = () => {
    toast.success('Configuration enregistrée');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Paramètres</p>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Configuration</h1>
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
            <input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Site web</label>
            <input className="input" value={form.siteWeb} onChange={e => setForm(f => ({ ...f, siteWeb: e.target.value }))} />
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
            <select className="input" value={form.devise} onChange={e => setForm(f => ({ ...f, devise: e.target.value }))}>
              <option value="XOF">XOF — Franc CFA (UEMOA)</option>
              <option value="XAF">XAF — Franc CFA (CEMAC)</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dollar US</option>
              <option value="MAD">MAD — Dirham marocain</option>
            </select>
          </div>
          <div>
            <label className="label">TVA par défaut (%)</label>
            <input type="number" className="input" value={form.tva} onChange={e => setForm(f => ({ ...f, tva: e.target.value }))} min="0" max="100" />
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={16} style={{ color: 'var(--color-gold)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Documents</h2>
        </div>
        <div>
          <label className="label">Pied de page des factures</label>
          <textarea
            className="input resize-none"
            rows={3}
            value={form.piedDePage}
            onChange={e => setForm(f => ({ ...f, piedDePage: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={handleSave}>
          <Save size={15} /> Enregistrer les modifications
        </button>
      </div>
    </div>
  );
}
