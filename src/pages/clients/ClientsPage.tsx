import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Building2, User, ArrowUpRight, Phone, Mail } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate } from '@/lib/format';

export default function ClientsPage() {
  const { clients } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'tous' | 'particulier' | 'entreprise'>('tous');

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

  const totalCA = clients.reduce((s, c) => s + c.totalAchats, 0);
  const totalCreances = clients.reduce((s, c) => s + c.soldeCredit, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>CRM</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Clients</h1>
        </div>
        <button className="btn-primary" onClick={() => navigate('/clients/nouveau')}>
          <Plus size={15} /> Nouveau client
        </button>
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
              <th>Client</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Commandes</th>
              <th>CA total</th>
              <th>Créance</th>
              <th>Dernière cmd</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>
                  Aucun client trouvé
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
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
                    <ArrowUpRight size={15} style={{ color: 'var(--color-gold)' }} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
