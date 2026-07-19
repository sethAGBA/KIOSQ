import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Download, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { formatPrice } from '@/lib/format';
import { mockDataCA } from '@/data/mock';

const COLORS = ['var(--color-gold)', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function RapportsPage() {
  const { produits, categories, factures, commandes } = useAppStore();
  const [periode, setPeriode] = useState<'3m' | '6m' | '12m'>('12m');

  const nMois = periode === '3m' ? 3 : periode === '6m' ? 6 : 12;
  const dataCA = mockDataCA.slice(-nMois);

  // Stock par catégorie
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

  // Taux de recouvrement
  const totalFacture = factures.reduce((s, f) => s + f.totalTTC, 0);
  const totalPaye = factures.reduce((s, f) => s + f.montantPaye, 0);
  const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture) * 100 : 0;

  const topClients = useMemo(() => {
    const map: Record<string, { nom: string; ca: number }> = {};
    commandes.filter(c => c.type === 'commande').forEach(c => {
      map[c.clientId] = { nom: c.clientNom, ca: (map[c.clientId]?.ca ?? 0) + c.totalTTC };
    });
    return Object.values(map).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [commandes]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Analyse</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Rapports</h1>
        </div>
        <button className="btn-secondary"><Download size={14} /> Exporter Excel</button>
      </div>

      {/* Période selector */}
      <div className="flex gap-2">
        {([['3m', '3 mois'], ['6m', '6 mois'], ['12m', '12 mois']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriode(k)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={periode === k
              ? { backgroundColor: 'var(--color-gold)', color: 'white' }
              : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'CA période', value: formatPrice(dataCA.reduce((s, d) => s + d.valeur, 0)) },
          { label: 'Bénéfice période', value: formatPrice(dataCA.reduce((s, d) => s + d.benefice, 0)) },
          { label: 'Taux de marge', value: `${((dataCA.reduce((s, d) => s + d.benefice, 0) / dataCA.reduce((s, d) => s + d.valeur, 1)) * 100).toFixed(1)}%` },
          { label: 'Taux recouvrement', value: `${tauxRecouvrement.toFixed(1)}%` },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <p className="label text-center">{k.label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CA + Bénéfice */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} style={{ color: 'var(--color-gold)' }} />
            <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>CA vs Bénéfice</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dataCA} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-cream-dark)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v) => formatPrice(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="valeur" name="CA" fill="var(--color-gold)" radius={[3,3,0,0]} opacity={0.8} />
              <Bar dataKey="benefice" name="Bénéfice" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock par catégorie (pie) */}
        <div className="card p-5">
          <p className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>Valeur stock par catégorie</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stockParCat} dataKey="valeur" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {stockParCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatPrice(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top clients */}
      <div className="card p-5">
        <p className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>Top 5 clients par CA</p>
        <div className="space-y-3">
          {topClients.map((c, i) => {
            const maxCA = topClients[0]?.ca ?? 1;
            const pct = (c.ca / maxCA) * 100;
            return (
              <div key={c.nom} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-center shrink-0" style={{ color: 'var(--color-ink-muted)' }}>#{i + 1}</span>
                <p className="text-sm w-40 shrink-0 truncate" style={{ color: 'var(--color-ink)' }}>{c.nom}</p>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--color-gold)' }} />
                </div>
                <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-gold)' }}>{formatPrice(c.ca)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
