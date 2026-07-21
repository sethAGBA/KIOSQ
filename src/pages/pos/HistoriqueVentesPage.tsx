import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Download, ChevronDown,
  Printer, X, User, RotateCcw
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { formatPrice } from '@/lib/format';
import { facturesApi } from '@/lib/api';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { CancellationModal } from '@/components/pos/CancellationModal';
import RetourModal from '@/components/pos/RetourModal';
import type { Facture } from '@/types';
import toast from 'react-hot-toast';
import { useTableControls } from '@/hooks/useTableControls';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Pagination } from '@/components/ui/Pagination';

/* ── helpers ─────────────────────────────────────────────── */
function statutLabel(s: string) {
  return (
    { payee: 'Payée', partielle: 'Partielle', en_retard: 'En retard', annulee: 'Annulée', brouillon: 'Brouillon', envoyee: 'Envoyée' }[s] ?? s
  );
}
function statutClass(s: string) {
  return (
    { payee: 'bg-green-100 text-green-700', partielle: 'bg-amber-100 text-amber-700', en_retard: 'bg-red-100 text-red-700', annulee: 'bg-red-100 text-red-700' }[s] ??
    'bg-gray-100 text-gray-600'
  );
}
function modeClass(m: string) {
  return (
    { especes: 'bg-green-100 text-green-700', mobile_money: 'bg-blue-100 text-blue-700', carte: 'bg-purple-100 text-purple-700', virement: 'bg-indigo-100 text-indigo-700' }[m] ??
    'bg-gray-100 text-gray-700'
  );
}

/* ── CSV export ──────────────────────────────────────────── */
function exportCSV(data: Record<string, string | number>[], filename: string) {
  const headers = Object.keys(data[0] ?? {});
  const rows = data.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ── Excel export via xlsx ───────────────────────────────── */
async function exportExcel(data: Record<string, string | number>[], filename: string) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventes');
  XLSX.writeFile(wb, filename + '.xlsx');
}

/* ─────────────────────────────────────────────────────────── */

export default function HistoriqueVentesPage() {
  const navigate = useNavigate();
  const { factures, produits, updateProduit, updateFacture } = useAppStore();
  const { user } = useAuthStore();

  const isGestionnaire = user?.role === 'admin' || user?.role === 'gestionnaire';

  // Filtres
  const [search, setSearch] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [selectedStatut, setSelectedStatut] = useState('all');
  const [selectedMode, setSelectedMode] = useState('all');
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Modals state
  const [previewFacture, setPreviewFacture] = useState<Facture | null>(null);
  const [venteToCancel, setVenteToCancel] = useState<Facture | null>(null);
  const [venteToReturn, setVenteToReturn] = useState<Facture | null>(null);

  /* ── Données filtrées ─────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = factures.filter(f => f.numero.startsWith('TIC-') || f.id.startsWith('pos-') || f.numero.startsWith('FAC-'));

    // Filtre date
    if (dateDebut) {
      const start = new Date(dateDebut);
      start.setHours(0, 0, 0, 0);
      list = list.filter(f => new Date(f.dateFacture) >= start);
    }
    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      list = list.filter(f => new Date(f.dateFacture) <= end);
    }

    // Filtre recherche
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        f.numero.toLowerCase().includes(q) ||
        f.clientNom.toLowerCase().includes(q)
      );
    }

    // Filtre statut
    if (selectedStatut !== 'all') list = list.filter(f => f.statut === selectedStatut);

    // Filtre mode paiement
    if (selectedMode !== 'all') list = list.filter(f => f.paiements[0]?.mode === selectedMode);

    return list;
  }, [factures, search, dateDebut, dateFin, selectedStatut, selectedMode]);

  const table = useTableControls(filtered, { defaultSort: 'dateFacture', defaultDirection: 'desc' });

  /* ── KPIs ─────────────────────────────────────────────── */
  const totalCA = filtered.reduce((s, f) => s + f.totalTTC, 0);
  const nbVentes = filtered.length;
  const panierMoyen = nbVentes > 0 ? totalCA / nbVentes : 0;

  /* ── Export ───────────────────────────────────────────── */
  const buildExportData = () =>
    filtered.flatMap(f => {
      if (!f.lignes.length) {
        return [{
          'ID Vente': f.numero,
          'Date': new Date(f.dateFacture).toLocaleString('fr-FR'),
          'Client': f.clientNom,
          'Produit Réf': '-',
          'Produit': '-',
          'Quantité': 0,
          'Prix Unitaire': 0,
          'Total Ligne': 0,
          'Mode paiement': (f.paiements[0]?.mode ?? '').replace('_', ' '),
          'Statut': statutLabel(f.statut),
        }];
      }
      return f.lignes.map(l => ({
        'ID Vente': f.numero,
        'Date': new Date(f.dateFacture).toLocaleString('fr-FR'),
        'Client': f.clientNom,
        'Produit Réf': '-',
        'Produit': l.designation,
        'Quantité': l.quantite,
        'Prix Unitaire': l.prixUnitaire,
        'Total Ligne': l.total,
        'Mode paiement': (f.paiements[0]?.mode ?? '').replace('_', ' '),
        'Statut': statutLabel(f.statut),
      }));
    });

  const handleExport = async (fmt: 'csv' | 'excel') => {
    setIsExportOpen(false);
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
    const data = buildExportData();
    if (!data.length) return;
    if (fmt === 'csv') exportCSV(data, `historique_ventes_${timestamp}`);
    else await exportExcel(data, `historique_ventes_${timestamp}`);
  };

  /* ── Cancellation Handler ──────────────────────────────── */
  const handleAnnuler = async (motif: string) => {
    if (!venteToCancel) return;
    try {
      // 1. Try real API (handles stock restore server-side)
      let updated: Facture | null = null;
      try {
        updated = await facturesApi.annuler(venteToCancel.id, motif);
      } catch (apiErr: any) {
        console.warn('[Historique] annuler API failed, falling back to local:', apiErr?.message);
      }

      // 2. Always update local store
      venteToCancel.lignes.forEach(l => {
        const ref = l.designation.split(' — ')[0]?.trim();
        const prod = produits.find(p => p.reference === ref);
        if (prod) updateProduit(prod.id, { stockActuel: prod.stockActuel + l.quantite });
      });

      const cancelNotes = [
        venteToCancel.notes,
        `[Annulée le ${new Date().toLocaleDateString('fr-FR')}] : ${motif}. par ${user?.prenom} ${user?.nom}`
      ].filter(Boolean).join('\n');

      updateFacture(venteToCancel.id, updated ?? { statut: 'annulee', notes: cancelNotes });

      toast.success('Vente annulée avec succès. Le stock a été restauré.');
      setVenteToCancel(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation");
    }
  };

  /* ─────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── En-tête ────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-1.5 text-sm mb-2 transition-colors"
            style={{ color: 'var(--color-ink-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
          >
            <ArrowLeft size={16} /> Retour au POS
          </button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            Historique des Ventes
          </h1>
        </div>

        {/* ── Contrôles droite ─────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-end">

          {/* Filtre date */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-sm"
            style={{ backgroundColor: 'white', border: '1px solid var(--color-cream-dark)' }}
          >
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-black px-1" style={{ color: 'var(--color-ink-muted)' }}>Du</span>
              <input
                type="date"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none"
              />
            </div>
            <div className="w-px h-6" style={{ backgroundColor: 'var(--color-cream-dark)' }} />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-black px-1" style={{ color: 'var(--color-ink-muted)' }}>Au</span>
              <input
                type="date"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
                className="bg-transparent text-xs font-bold focus:outline-none"
              />
            </div>
            {(dateDebut || dateFin) && (
              <button
                onClick={() => { setDateDebut(''); setDateFin(''); }}
                className="p-1 rounded-md transition-colors hover:bg-red-50 text-red-500"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Export (gestionnaire seulement) */}
          {isGestionnaire && (
            <div className="relative">
              <button
                onClick={() => setIsExportOpen(o => !o)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Download size={16} />
                <span className="hidden md:inline">Exporter</span>
                <ChevronDown size={13} className={clsx('transition-transform', isExportOpen && 'rotate-180')} />
              </button>
              {isExportOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsExportOpen(false)} />
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl overflow-hidden z-20"
                    style={{ backgroundColor: 'white', border: '1px solid var(--color-cream-dark)' }}
                  >
                    <button
                      onClick={() => handleExport('excel')}
                      className="w-full text-left px-4 py-3 text-sm font-bold transition-colors"
                      style={{ color: 'var(--color-gold)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-cream)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      Format Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full text-left px-4 py-3 text-sm font-bold transition-colors"
                      style={{ color: 'var(--color-gold)', borderTop: '1px solid var(--color-cream-dark)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-cream)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      Format CSV (.csv)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Filtre vendeur */}
          {isGestionnaire && (
            <div className="relative w-48">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
              <select className="input pl-9 text-xs appearance-none">
                <option>Tous les vendeurs</option>
                {user && <option>{user.prenom} {user.nom}</option>}
              </select>
            </div>
          )}

          {/* Filtre statut */}
          <div className="relative w-48">
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-ink-muted)' }} />
            <select
              className="input pl-4 pr-9 text-xs appearance-none"
              value={selectedStatut}
              onChange={e => setSelectedStatut(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="payee">Validées (Payée)</option>
              <option value="annulee">Annulées</option>
            </select>
          </div>

          {/* Filtre mode de paiement */}
          <div className="relative w-48">
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-ink-muted)' }} />
            <select
              className="input pl-4 pr-9 text-xs appearance-none"
              value={selectedMode}
              onChange={e => setSelectedMode(e.target.value)}
            >
              <option value="all">Tous les modes</option>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="carte">Carte</option>
              <option value="virement">Virement</option>
            </select>
          </div>

          {/* Recherche */}
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
            <input
              type="text"
              className="input pl-9 text-sm"
              placeholder="Rechercher (ticket, client)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Chiffre d\'affaires', value: formatPrice(totalCA), color: 'var(--color-gold)' },
          { label: 'Nombre de ventes', value: String(nbVentes), color: 'var(--color-ink)' },
          { label: 'Panier moyen', value: formatPrice(panierMoyen), color: 'var(--color-ink)' },
        ].map(k => (
          <div key={k.label} className="card p-5 text-center">
            <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--color-ink-muted)' }}>{k.label}</p>
            <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left bg-white">
          <thead style={{ backgroundColor: 'var(--color-cream)' }}>
            <tr>
              <SortableHeader column="dateFacture" label="Date" sort={table.sort} onSort={table.setSort} className="p-4" />
              <SortableHeader column="numero" label="Ticket" sort={table.sort} onSort={table.setSort} className="p-4" />
              <SortableHeader column="clientNom" label="Client" sort={table.sort} onSort={table.setSort} className="p-4" />
              <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Vendeur</th>
              <SortableHeader column="totalTTC" label="Montant" sort={table.sort} onSort={table.setSort} align="right" className="p-4" />
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--color-ink-muted)' }}>Paiement</th>
              <SortableHeader column="statut" label="Statut" sort={table.sort} onSort={table.setSort} className="p-4" />
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--color-ink-muted)' }}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm" style={{ borderColor: 'var(--color-cream-dark)' }}>
            {table.paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center" style={{ color: 'var(--color-ink-muted)' }}>
                  Aucune vente trouvée.
                </td>
              </tr>
            ) : table.paginatedData.map(f => (
              <tr
                key={f.id}
                className="transition-colors hover:bg-cream/40"
              >
                {/* Date */}
                <td className="p-4 font-mono text-ink-muted">
                  {new Date(f.dateFacture).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>

                {/* Ticket */}
                <td className="p-4 font-mono font-bold text-ink">
                  {f.numero}
                </td>

                {/* Client */}
                <td className="p-4 text-ink">
                  {f.clientNom}
                </td>

                {/* Vendeur */}
                <td className="p-4 text-ink-muted">
                  {user ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim().split(' ')[0] : '—'}
                </td>

                {/* Montant */}
                <td className="p-4 text-right font-bold text-ink">
                  {formatPrice(f.totalTTC)}
                </td>

                {/* Mode paiement */}
                <td className="p-4 text-center">
                  <span className={clsx('px-2 py-1 rounded text-[10px] uppercase font-bold', modeClass(f.paiements[0]?.mode ?? ''))}>
                    {(f.paiements[0]?.mode ?? '—').replace('_', ' ')}
                  </span>
                </td>

                {/* Statut */}
                <td className="p-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={clsx('px-2 py-1 rounded-full text-[10px] uppercase font-black tracking-widest', statutClass(f.statut))}>
                      {statutLabel(f.statut)}
                    </span>
                    {f.statut === 'annulee' && f.notes && (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-red-600 font-bold max-w-[120px] truncate" title={f.notes.split('\n').pop()}>
                          {f.notes.split('\n').pop()?.replace('[Annulée', 'Annulée')}
                        </span>
                      </div>
                    )}
                  </div>
                </td>

                {/* Action */}
                <td className="p-4 text-right flex items-center justify-end gap-1">
                  <button
                    onClick={() => setPreviewFacture(f)}
                    className="p-2 hover:bg-gold/10 text-ink-muted hover:text-gold rounded transition-colors"
                    title="Voir / Réimprimer le ticket"
                  >
                    <Printer size={18} />
                  </button>
                  {isGestionnaire && f.statut !== 'annulee' && (
                    <>
                      <button
                        onClick={() => setVenteToCancel(f)}
                        className="p-2 hover:bg-red-50 text-ink-muted hover:text-red-500 rounded transition-colors"
                        title="Annuler la vente"
                      >
                        <ArrowLeft size={18} className="rotate-45" />
                      </button>
                      <button
                        onClick={() => setVenteToReturn(f)}
                        className="p-2 hover:bg-gold/10 text-ink-muted hover:text-gold rounded transition-colors"
                        title="Effectuer un retour"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
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

      {/* ── Modal ticket ───────────────────────────────────── */}
      {previewFacture && (
        <ReceiptModal
          facture={previewFacture}
          onClose={() => setPreviewFacture(null)}
        />
      )}

      {/* ── Modal d'annulation ─────────────────────────────── */}
      {venteToCancel && (
        <CancellationModal
          factureNumero={venteToCancel.numero}
          onClose={() => setVenteToCancel(null)}
          onConfirm={handleAnnuler}
        />
      )}

      {/* ── Modal de retour ────────────────────────────────── */}
      {venteToReturn && (
        <RetourModal
          facture={venteToReturn}
          onClose={() => setVenteToReturn(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
