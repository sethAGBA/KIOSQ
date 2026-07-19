import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ShoppingCart, FileText, ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';

const STATUTS_COMMANDE = ['tous', 'brouillon', 'confirme', 'en_preparation', 'expedie', 'livre', 'annule'] as const;
const STATUTS_DEVIS = ['tous', 'brouillon', 'envoye', 'accepte', 'refuse', 'expire'] as const;

export default function CommandesPage() {
  const { commandes } = useAppStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'commande' | 'devis'>('commande');
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');

  const filtered = useMemo(() => {
    return commandes.filter((c) => {
      const matchTab = c.type === tab;
      const matchSearch =
        c.numero.toLowerCase().includes(search.toLowerCase()) ||
        c.clientNom.toLowerCase().includes(search.toLowerCase());
      const matchStatut = statutFilter === 'tous' || c.statut === statutFilter;
      return matchTab && matchSearch && matchStatut;
    });
  }, [commandes, tab, search, statutFilter]);

  const statuts = tab === 'commande' ? STATUTS_COMMANDE : STATUTS_DEVIS;

  const kpis = useMemo(() => {
    const cmds = commandes.filter(c => c.type === 'commande');
    const dvs = commandes.filter(c => c.type === 'devis');
    return {
      totalCmds: cmds.length,
      caTotalCmds: cmds.reduce((s, c) => s + c.totalTTC, 0),
      totalDvs: dvs.length,
      caTotalDvs: dvs.reduce((s, c) => s + c.totalTTC, 0),
      enAttente: cmds.filter(c => ['confirme', 'en_preparation'].includes(c.statut)).length,
    };
  }, [commandes]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Ventes</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Commandes & Devis</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate('/commandes/nouveau?type=devis')}>
            <FileText size={15} /> Nouveau devis
          </button>
          <button className="btn-primary" onClick={() => navigate('/commandes/nouveau')}>
            <Plus size={15} /> Nouvelle commande
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Commandes</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{kpis.totalCmds}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(kpis.caTotalCmds)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Devis</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{kpis.totalDvs}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(kpis.caTotalDvs)} potentiel</p>
        </div>
        <div className="card p-4">
          <p className="label">En cours</p>
          <p className="text-xl font-bold" style={{ color: '#2563eb' }}>{kpis.enAttente}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>confirmé / en prépa</p>
        </div>
        <div className="card p-4">
          <p className="label">CA total</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>
            {formatPrice(commandes.filter(c => c.type === 'commande').reduce((s, c) => s + c.totalTTC, 0))}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>toutes commandes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
        {(['commande', 'devis'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setStatutFilter('tous'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={tab === t
              ? { backgroundColor: 'white', color: 'var(--color-ink)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--color-ink-muted)' }
            }
          >
            {t === 'commande' ? <ShoppingCart size={14} /> : <FileText size={14} />}
            {t === 'commande' ? 'Commandes' : 'Devis'}
            <span className="text-xs font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
              {commandes.filter(c => c.type === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
          <input className="input pl-9" placeholder="Numéro, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuts.map((s) => (
            <button
              key={s}
              onClick={() => setStatutFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
              style={
                statutFilter === s
                  ? { backgroundColor: 'var(--color-gold)', color: 'white' }
                  : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
              }
            >
              {s === 'tous' ? 'Tous' : statutLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Client</th>
              <th>Total HT</th>
              <th>TVA</th>
              <th>Total TTC</th>
              <th>Acompte</th>
              <th>Reste</th>
              <th>Statut</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucun résultat</td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/commandes/${c.id}`)}>
                <td><span className="font-mono text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{c.numero}</span></td>
                <td style={{ color: 'var(--color-ink)' }}>{c.clientNom}</td>
                <td>{formatPrice(c.totalHT)}</td>
                <td style={{ color: 'var(--color-ink-muted)' }}>{c.tva}%</td>
                <td className="font-semibold" style={{ color: 'var(--color-ink)' }}>{formatPrice(c.totalTTC)}</td>
                <td style={{ color: '#16a34a' }}>{formatPrice(c.acompte)}</td>
                <td>
                  {c.resteAPayer > 0
                    ? <span className="font-semibold" style={{ color: '#d97706' }}>{formatPrice(c.resteAPayer)}</span>
                    : <span className="badge badge-success">soldé</span>}
                </td>
                <td><span className={clsx('badge', statutColor(c.statut))}>{statutLabel(c.statut)}</span></td>
                <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(c.createdAt)}</td>
                <td><ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
