import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, ArrowUpRight, Clock } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';

const STATUTS = ['tous', 'brouillon', 'envoyee', 'payee', 'partielle', 'en_retard', 'annulee'] as const;

export default function FacturationPage() {
  const { factures } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');

  const filtered = useMemo(() => {
    return factures.filter((f) => {
      const matchSearch =
        f.numero.toLowerCase().includes(search.toLowerCase()) ||
        f.clientNom.toLowerCase().includes(search.toLowerCase());
      const matchStatut = statutFilter === 'tous' || f.statut === statutFilter;
      return matchSearch && matchStatut;
    });
  }, [factures, search, statutFilter]);

  const kpis = useMemo(() => ({
    totalFacture: factures.reduce((s, f) => s + f.totalTTC, 0),
    totalPaye: factures.reduce((s, f) => s + f.montantPaye, 0),
    totalEnAttente: factures.filter(f => ['envoyee', 'partielle', 'en_retard'].includes(f.statut)).reduce((s, f) => s + f.resteAPayer, 0),
    nbEnRetard: factures.filter(f => f.statut === 'en_retard').length,
  }), [factures]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Comptabilité</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Facturation</h1>
        </div>
        <button className="btn-primary" onClick={() => navigate('/facturation/nouvelle')}>
          <Plus size={15} /> Nouvelle facture
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Total facturé</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{formatPrice(kpis.totalFacture)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{factures.length} factures</p>
        </div>
        <div className="card p-4">
          <p className="label">Encaissé</p>
          <p className="text-xl font-bold" style={{ color: '#16a34a' }}>{formatPrice(kpis.totalPaye)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>paiements reçus</p>
        </div>
        <div className="card p-4">
          <p className="label">En attente</p>
          <p className="text-xl font-bold" style={{ color: '#d97706' }}>{formatPrice(kpis.totalEnAttente)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>à encaisser</p>
        </div>
        <div className="card p-4 border-l-2" style={{ borderLeftColor: '#ef4444' }}>
          <p className="label">En retard</p>
          <p className="text-xl font-bold" style={{ color: '#dc2626' }}>{kpis.nbEnRetard}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>factures échues</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
          <input className="input pl-9" placeholder="Numéro, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatutFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={
                statutFilter === s
                  ? { backgroundColor: 'var(--color-gold)', color: 'white' }
                  : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
              }
            >
              {s === 'tous' ? 'Toutes' : statutLabel(s)}
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
              <th>Total TTC</th>
              <th>Payé</th>
              <th>Reste à payer</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Échéance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucune facture trouvée</td></tr>
            ) : filtered.map((f) => {
              const isRetard = f.statut === 'en_retard';
              return (
                <tr key={f.id} className="cursor-pointer" onClick={() => navigate(`/facturation/${f.id}`)}>
                  <td>
                    <span className="font-mono text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{f.numero}</span>
                  </td>
                  <td style={{ color: 'var(--color-ink)' }}>{f.clientNom}</td>
                  <td className="font-semibold" style={{ color: 'var(--color-ink)' }}>{formatPrice(f.totalTTC)}</td>
                  <td style={{ color: '#16a34a' }}>{formatPrice(f.montantPaye)}</td>
                  <td>
                    {f.resteAPayer > 0 ? (
                      <span className="flex items-center gap-1" style={{ color: isRetard ? '#dc2626' : '#d97706' }}>
                        {isRetard && <Clock size={12} />}
                        <span className="font-semibold">{formatPrice(f.resteAPayer)}</span>
                      </span>
                    ) : <span className="badge badge-success">soldé</span>}
                  </td>
                  <td><span className={clsx('badge', statutColor(f.statut))}>{statutLabel(f.statut)}</span></td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(f.dateFacture)}</td>
                  <td style={{ color: isRetard ? '#dc2626' : 'var(--color-ink-muted)' }}>{formatDate(f.dateEcheance)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-ink-muted)' }}
                        title="Télécharger PDF"
                      >
                        <Download size={13} />
                      </button>
                      <ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
