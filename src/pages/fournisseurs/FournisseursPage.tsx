import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Truck, ArrowUpRight, Mail, Phone, Package } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';

export default function FournisseursPage() {
  const { fournisseurs, commandesFournisseurs } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'fournisseurs' | 'commandes'>('fournisseurs');

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

  const totalDettes = fournisseurs.reduce((s, f) => s + f.soldeDette, 0);
  const totalAchats = fournisseurs.reduce((s, f) => s + f.totalAchats, 0);
  const cmdEnCours = commandesFournisseurs.filter(c => ['commandee', 'recu_partiel'].includes(c.statut)).length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Achats</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Fournisseurs</h1>
        </div>
        <div className="flex gap-2">
          {tab === 'fournisseurs'
            ? <button className="btn-primary" onClick={() => navigate('/fournisseurs/nouveau')}><Plus size={15} /> Nouveau fournisseur</button>
            : <button className="btn-primary" onClick={() => navigate('/fournisseurs/commande/nouvelle')}><Plus size={15} /> Nouvelle commande</button>
          }
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
              <tr><th>Fournisseur</th><th>Contact</th><th>Délai livraison</th><th>Total achats</th><th>Dette</th><th></th></tr>
            </thead>
            <tbody>
              {filteredF.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucun fournisseur</td></tr>
              ) : filteredF.map(f => (
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
                  <td><ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-auto w-full">
            <thead>
              <tr><th>Numéro</th><th>Fournisseur</th><th>Total TTC</th><th>Payé</th><th>Reste</th><th>Statut</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {filteredCF.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucune commande</td></tr>
              ) : filteredCF.map(c => (
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
        </div>
      )}
    </div>
  );
}
