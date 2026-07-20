import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { Download, BarChart3, TrendingUp, Truck, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { formatPrice } from '@/lib/format';

const COLORS = ['var(--color-gold)', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function RapportsPage() {
  const { produits, categories, factures, commandes, fournisseurs } = useAppStore();
  const [periode, setPeriode] = useState<'3m' | '6m' | '12m' | 'custom'>('12m');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const nMois = periode === '3m' ? 3 : periode === '6m' ? 6 : 12;

  // ── Filtrage temporel global des données ─────────────────
  const filteredCommandes = useMemo(() => {
    if (periode === 'custom') {
      const start = dateDebut ? new Date(dateDebut) : new Date(0);
      const end = dateFin ? new Date(dateFin) : new Date();
      end.setHours(23, 59, 59, 999);
      return commandes.filter(c => {
        const cd = new Date(c.createdAt);
        return cd >= start && cd <= end;
      });
    }
    const now = new Date();
    const limit = new Date(now.getFullYear(), now.getMonth() - nMois + 1, 1);
    return commandes.filter(c => new Date(c.createdAt) >= limit);
  }, [commandes, periode, nMois, dateDebut, dateFin]);

  const filteredFactures = useMemo(() => {
    if (periode === 'custom') {
      const start = dateDebut ? new Date(dateDebut) : new Date(0);
      const end = dateFin ? new Date(dateFin) : new Date();
      end.setHours(23, 59, 59, 999);
      return factures.filter(f => {
        const fd = new Date(f.createdAt);
        return fd >= start && fd <= end;
      });
    }
    const now = new Date();
    const limit = new Date(now.getFullYear(), now.getMonth() - nMois + 1, 1);
    return factures.filter(f => new Date(f.createdAt) >= limit);
  }, [factures, periode, nMois, dateDebut, dateFin]);

  // ── CA mensuel / quotidien calculé ───────────────────────
  const dataCA = useMemo(() => {
    if (periode === 'custom' && dateDebut && dateFin) {
      const start = new Date(dateDebut);
      const end = new Date(dateFin);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 31) {
        // Groupement par jour pour une courte période
        const days = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
          const day = d.getDate();
          const month = d.getMonth();
          const year = d.getFullYear();
          const cmds = filteredCommandes.filter(c => {
            const cd = new Date(c.createdAt);
            return c.type === 'commande' && cd.getDate() === day && cd.getMonth() === month && cd.getFullYear() === year;
          });
          const valeur = cmds.reduce((s, c) => s + c.totalTTC, 0);
          const coutHT = cmds.reduce((s, c) => s + c.totalHT, 0);
          const benefice = valeur - coutHT;
          days.push({ label: dayStr, valeur, benefice, commandes: cmds.length });
        }
        return days;
      }
    }

    const now = new Date();
    return Array.from({ length: nMois }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (nMois - 1 - i), 1);
      const month = d.getMonth();
      const year  = d.getFullYear();

      const cmds = filteredCommandes.filter(c => {
        const cd = new Date(c.createdAt);
        return c.type === 'commande' && cd.getMonth() === month && cd.getFullYear() === year;
      });

      const valeur   = cmds.reduce((s, c) => s + c.totalTTC, 0);
      const coutHT   = cmds.reduce((s, c) => s + c.totalHT, 0);
      const benefice = valeur - coutHT;
      return { label: MONTHS_FR[month], valeur, benefice, commandes: cmds.length };
    });
  }, [filteredCommandes, periode, nMois, dateDebut, dateFin]);

  // ── Stock par catégorie ────────────────────────────────────
  const stockParCat = useMemo(() => {
    return categories.map(cat => {
      const prods = produits.filter(p => p.categorieId === cat.id);
      return {
        name: cat.nom,
        valeur: prods.reduce((s, p) => s + p.stockActuel * p.prixAchat, 0),
        items: prods.length,
      };
    }).filter(c => c.valeur > 0);
  }, [produits, categories]);

  // ── KPIs période ──────────────────────────────────────────
  const totalCA      = dataCA.reduce((s, d) => s + d.valeur, 0);
  const totalBenef   = dataCA.reduce((s, d) => s + d.benefice, 0);
  const tauxMarge    = totalCA > 0 ? (totalBenef / totalCA) * 100 : 0;
  const totalFacturé = filteredFactures.reduce((s, f) => s + f.totalTTC, 0);
  const totalPayé    = filteredFactures.reduce((s, f) => s + f.montantPaye, 0);
  const tauxRecouvrement = totalFacturé > 0 ? (totalPayé / totalFacturé) * 100 : 0;

  // ── Top 5 clients ─────────────────────────────────────────
  const topClients = useMemo(() => {
    const map: Record<string, { nom: string; ca: number }> = {};
    filteredCommandes
      .filter(c => c.type === 'commande')
      .forEach(c => {
        if (!map[c.clientId]) map[c.clientId] = { nom: c.clientNom, ca: 0 };
        map[c.clientId].ca += c.totalTTC;
      });
    return Object.values(map).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [filteredCommandes]);

  // ── Top 5 fournisseurs ────────────────────────────────────
  const topFournisseurs = useMemo(() => {
    return fournisseurs
      .filter(f => f.totalAchats > 0)
      .sort((a, b) => b.totalAchats - a.totalAchats)
      .slice(0, 5)
      .map(f => ({ nom: f.nom, ca: f.totalAchats, dette: f.soldeDette }));
  }, [fournisseurs]);

  // ── Produits les plus vendus ──────────────────────────────
  const topProduits = useMemo(() => {
    const map: Record<string, { nom: string; ref: string; qte: number; ca: number }> = {};
    filteredCommandes.filter(c => c.type === 'commande').forEach(c => {
      c.lignes.forEach(l => {
        if (!map[l.produitId]) map[l.produitId] = { nom: l.produitNom, ref: l.produitRef, qte: 0, ca: 0 };
        map[l.produitId].qte += l.quantite;
        map[l.produitId].ca  += l.total;
      });
    });
    return Object.values(map).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [filteredCommandes]);

  // ── Alertes stock ─────────────────────────────────────────
  const enAlerte  = produits.filter(p => p.stockActuel <= p.stockMinimum && p.stockActuel > 0).length;
  const enRupture = produits.filter(p => p.stockActuel === 0).length;
  const valeurStock = produits.reduce((s, p) => s + p.stockActuel * p.prixAchat, 0);

  const handleExport = () => {
    // CSV simple
    const labelHeader = periode === 'custom' ? 'Date' : 'Mois';
    const rows = [
      [labelHeader, 'CA (F)', 'Bénéfice (F)', 'Nombre de commandes'],
      ...dataCA.map(d => [d.label, d.valeur, d.benefice, d.commandes]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `rapport_ca_${periode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Analyse</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Rapports</h1>
        </div>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={14} /> Exporter CSV
        </button>
      </div>

      {/* Période selector */}
      <div className="flex gap-2 flex-wrap">
        {(['3m', '6m', '12m'] as const).map(k => (
          <button
            key={k}
            onClick={() => { setPeriode(k); setDateDebut(''); setDateFin(''); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={periode === k
              ? { backgroundColor: 'var(--color-gold)', color: 'white' }
              : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }}
          >
            {k === '3m' ? '3 mois' : k === '6m' ? '6 mois' : '12 mois'}
          </button>
        ))}
        {/* Filtre personnalisé */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: periode === 'custom' ? 'var(--color-gold)' : 'var(--color-cream-dark)', backgroundColor: 'white' }}>
          <span style={{ color: 'var(--color-ink-muted)' }}>Du</span>
          <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); setPeriode('custom'); }}
            className="bg-transparent text-xs font-bold focus:outline-none" />
          <span style={{ color: 'var(--color-ink-muted)' }}>au</span>
          <input type="date" value={dateFin} onChange={e => { setDateFin(e.target.value); setPeriode('custom'); }}
            className="bg-transparent text-xs font-bold focus:outline-none" />
          {periode === 'custom' && (
            <button onClick={() => { setPeriode('12m'); setDateDebut(''); setDateFin(''); }} style={{ color: 'var(--color-ink-muted)' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: `CA ${periode}`,        value: formatPrice(totalCA) },
          { label: 'Bénéfice estimé',      value: formatPrice(totalBenef) },
          { label: 'Taux de marge',        value: `${tauxMarge.toFixed(1)}%` },
          { label: 'Taux recouvrement',    value: `${tauxRecouvrement.toFixed(1)}%` },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <p className="label text-center">{k.label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Stock KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Valeur stock total',  value: formatPrice(valeurStock), sub: 'prix d\'achat' },
          { label: 'Références actives',  value: String(produits.filter(p => p.actif).length), sub: `${produits.length} total` },
          { label: 'En alerte stock',     value: String(enAlerte), sub: 'stock ≤ minimum', warn: enAlerte > 0 },
          { label: 'En rupture',          value: String(enRupture), sub: 'stock = 0', danger: enRupture > 0 },
        ].map(k => (
          <div key={k.label} className={`card p-4 text-center${(k as any).danger && enRupture > 0 ? ' border-l-2' : (k as any).warn && enAlerte > 0 ? ' border-l-2' : ''}`}
            style={(k as any).danger && enRupture > 0 ? { borderLeftColor: '#ef4444' } : (k as any).warn && enAlerte > 0 ? { borderLeftColor: '#f59e0b' } : {}}>
            <p className="label text-center">{k.label}</p>
            <p className="text-xl font-bold" style={{
              color: (k as any).danger && enRupture > 0 ? '#dc2626'
                : (k as any).warn && enAlerte > 0 ? '#d97706'
                : 'var(--color-ink)'
            }}>{k.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart CA — 2/3 */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>
                Chiffre d'affaires mensuel
              </p>
              <p className="font-semibold mt-0.5" style={{ color: 'var(--color-ink)' }}>
                {nMois} derniers mois
              </p>
            </div>
            <div className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
              {formatPrice(totalCA)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dataCA} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-gold)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: any, name: any) => [formatPrice(Number(v)), name === 'valeur' ? 'CA' : 'Bénéfice']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-cream-dark)' }}
              />
              <Area type="monotone" dataKey="valeur"   stroke="var(--color-gold)" strokeWidth={2} fill="url(#gradCA)"  name="valeur" />
              <Area type="monotone" dataKey="benefice" stroke="#10b981"           strokeWidth={1.5} fill="url(#gradBen)" strokeDasharray="4 2" name="benefice" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: 'var(--color-gold)' }} /> CA
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              <span className="w-3 h-0.5 rounded inline-block bg-emerald-500" /> Bénéfice estimé
            </span>
          </div>
        </div>

        {/* Bar chart commandes — 1/3 */}
        <div className="card p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--color-ink-muted)' }}>
            Commandes / mois
          </p>
          <p className="font-semibold mb-4" style={{ color: 'var(--color-ink)' }}>Volume</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dataCA} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-cream-dark)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: any) => [`${v} cmd`, 'Commandes']}
                contentStyle={{ fontSize: 11, borderColor: 'var(--color-cream-dark)', borderRadius: 8 }}
              />
              <Bar dataKey="commandes" fill="var(--color-gold)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock par catégorie (pie) */}
        {stockParCat.length > 0 && (
          <div className="card p-5">
            <p className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>Valeur stock par catégorie</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stockParCat}
                  dataKey="valeur"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {stockParCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatPrice(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top 5 clients */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} style={{ color: 'var(--color-gold)' }} />
            <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Top 5 clients par CA</p>
          </div>
          {topClients.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {topClients.map((c, i) => {
                const maxCA = topClients[0]?.ca ?? 1;
                const pct   = (c.ca / maxCA) * 100;
                return (
                  <div key={c.nom} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-center shrink-0" style={{ color: 'var(--color-ink-muted)' }}>
                      #{i + 1}
                    </span>
                    <p className="text-sm w-36 shrink-0 truncate" style={{ color: 'var(--color-ink)' }}>{c.nom}</p>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--color-gold)' }} />
                    </div>
                    <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-gold)' }}>
                      {formatPrice(c.ca)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top 5 fournisseurs & Top produits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 fournisseurs */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={14} style={{ color: 'var(--color-gold)' }} />
            <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Top 5 fournisseurs par achats</p>
          </div>
          {topFournisseurs.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {topFournisseurs.map((f, i) => {
                const maxCA = topFournisseurs[0]?.ca ?? 1;
                const pct   = (f.ca / maxCA) * 100;
                return (
                  <div key={f.nom} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-center shrink-0" style={{ color: 'var(--color-ink-muted)' }}>#{i + 1}</span>
                    <p className="text-sm w-36 shrink-0 truncate" style={{ color: 'var(--color-ink)' }}>{f.nom}</p>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#3b82f6' }} />
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold" style={{ color: '#3b82f6' }}>{formatPrice(f.ca)}</span>
                      {f.dette > 0 && <p className="text-[10px]" style={{ color: '#d97706' }}>dette: {formatPrice(f.dette)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top produits */}
        {topProduits.length > 0 ? (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} style={{ color: 'var(--color-gold)' }} />
              <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Top 5 produits par CA vendu</p>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="table-auto w-full">
                <thead>
                  <tr><th>#</th><th>Référence</th><th>Désignation</th><th>Qté vendue</th><th>CA</th></tr>
                </thead>
                <tbody>
                  {topProduits.map((p, i) => (
                    <tr key={p.ref}>
                      <td className="font-bold text-center" style={{ color: 'var(--color-gold)' }}>#{i + 1}</td>
                      <td><span className="font-mono text-[10px]">{p.ref}</span></td>
                      <td style={{ color: 'var(--color-ink)' }} className="truncate max-w-[100px]">{p.nom}</td>
                      <td className="text-center" style={{ color: 'var(--color-ink-muted)' }}>{p.qte}</td>
                      <td className="font-semibold" style={{ color: 'var(--color-gold)' }}>{formatPrice(p.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card p-5 flex items-center justify-center">
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Aucun produit vendu</p>
          </div>
        )}
      </div>

      {/* Recouvrement */}
      <div className="card p-5">
        <p className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>Taux de recouvrement des factures</p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-ink-muted)' }}>
              <span>Encaissé : {formatPrice(totalPayé)}</span>
              <span>Total facturé : {formatPrice(totalFacturé)}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, tauxRecouvrement)}%`,
                  backgroundColor: tauxRecouvrement >= 80 ? '#16a34a' : tauxRecouvrement >= 50 ? '#d97706' : '#dc2626',
                }}
              />
            </div>
          </div>
          <span className="text-xl font-bold shrink-0" style={{
            color: tauxRecouvrement >= 80 ? '#16a34a' : tauxRecouvrement >= 50 ? '#d97706' : '#dc2626',
          }}>
            {tauxRecouvrement.toFixed(1)}%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {[
            { label: 'Payées',       count: factures.filter(f => f.statut === 'payee').length,    color: '#16a34a' },
            { label: 'En attente',   count: factures.filter(f => ['envoyee','partielle'].includes(f.statut)).length, color: '#d97706' },
            { label: 'En retard',    count: factures.filter(f => f.statut === 'en_retard').length, color: '#dc2626' },
          ].map(item => (
            <div key={item.label} className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--color-cream)' }}>
              <p className="text-xl font-bold" style={{ color: item.color }}>{item.count}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
