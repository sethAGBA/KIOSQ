import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Download, ArrowUpRight, Clock, X, Trash2, ClipboardList } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { facturesApi, parametresApi, commandesApi, USE_API } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { Facture } from '@/types';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useTableControls } from '@/hooks/useTableControls';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Pagination } from '@/components/ui/Pagination';


const STATUTS = ['tous', 'brouillon', 'envoyee', 'payee', 'partielle', 'en_retard', 'annulee'] as const;

interface LigneForm {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  tva: number;
  total: number;
}

const newLigne = (tvaDefault = 18): LigneForm => ({
  designation: '', quantite: 1, prixUnitaire: 0, remise: 0, tva: tvaDefault, total: 0,
});

export default function FacturationPage() {
  const { factures, clients, commandes, addFacture } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');
  const [showModal, setShowModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [loading, setLoading] = useState(false);
  // Commande verrouillée en cours de facturation (pour libérer si abandon)
  const [lockedCommandeId, setLockedCommandeId] = useState<string | null>(null);
  const [lockedCommandeStatutPrev, setLockedCommandeStatutPrev] = useState<string>('confirme');

  const [formClientId, setFormClientId] = useState('');
  const [formCommandeId, setFormCommandeId] = useState('');
  const [formTva, setFormTva] = useState(18);
  const [formRemiseGlobale, setFormRemiseGlobale] = useState(0);
  const [formDateEcheance, setFormDateEcheance] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([newLigne()]);

  const canCreate = user?.role === 'admin' || user?.role === 'comptable' || user?.role === 'gestionnaire';

  const DEFAULT_CFG = { nom: 'Kiosq Commercial', adresse: 'Dakar, Sénégal', telephone: '+221 33 800 00 00', email: 'contact@kiosq.com', piedDePage: 'Merci pour votre confiance', logoUrl: '' };
  const [cfg, setCfg] = useState(DEFAULT_CFG);

  useEffect(() => {
    if (USE_API) {
      parametresApi.get()
        .then(data => setCfg({
          nom:        data.nom        ?? DEFAULT_CFG.nom,
          adresse:    data.adresse    ?? DEFAULT_CFG.adresse,
          telephone:  data.telephone  ?? DEFAULT_CFG.telephone,
          email:      data.email      ?? DEFAULT_CFG.email,
          piedDePage: data.piedDePage ?? DEFAULT_CFG.piedDePage,
          logoUrl:    data.logoUrl    ?? '',
        }))
        .catch(() => {});
    } else {
      try {
        const stored = localStorage.getItem('kiosq_config');
        if (stored) setCfg(prev => ({ ...prev, ...JSON.parse(stored) }));
      } catch { }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pré-ouverture depuis une commande (navigation state) ──
  useEffect(() => {
    const navState = location.state as { commandeId?: string; statutPrecedent?: string } | null;
    if (!navState?.commandeId) return;
    setLockedCommandeId(navState.commandeId);
    setLockedCommandeStatutPrev(navState.statutPrecedent ?? 'confirme');
    openModal();
    setTimeout(() => handleSelectCommande(navState.commandeId!), 50);
    window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pdfPrice = (n: number) =>
    formatPrice(n).replace(/[\u00a0\u202f\u2009\u2007\u2008]/g, ' ');

  const handleQuickPDF = async (e: React.MouseEvent, f: Facture) => {
    e.stopPropagation();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    const pageWidth = 210;
    const startY = 15;

    // ── Colonne gauche : Logo + coordonnées ──────────────────────
    let leftY = startY;
    if (cfg.logoUrl) {
      const logoRendered = await new Promise<number>(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx2d = canvas.getContext('2d');
            if (ctx2d) {
              ctx2d.drawImage(img, 0, 0);
              const ratio = img.naturalWidth / img.naturalHeight;
              const logoW = 32, logoH = logoW / ratio;
              doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, leftY, logoW, Math.min(logoH, 20));
              resolve(Math.min(logoH, 20));
            } else resolve(0);
          } catch { resolve(0); }
        };
        img.onerror = () => resolve(0);
        img.src = cfg.logoUrl;
      });
      if (logoRendered > 0) leftY += logoRendered + 3;
    }

    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(cfg.nom.toUpperCase(), margin, leftY); leftY += 5;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    if (cfg.email)    { doc.text(cfg.email,    margin, leftY); leftY += 4; }
    if (cfg.telephone){ doc.text(cfg.telephone, margin, leftY); leftY += 4; }

    // ── Colonne droite : FACTURE + numéro ────────────────────────
    doc.setFontSize(26); doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', pageWidth - margin, startY + 10, { align: 'right' });
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(f.numero, pageWidth - margin, startY + 18, { align: 'right' });
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(statutLabel(f.statut).toUpperCase(), pageWidth - margin, startY + 24, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // ── Séparateur ───────────────────────────────────────────────
    let y = Math.max(leftY, startY + 30) + 4;
    doc.setLineWidth(0.4); doc.line(margin, y, pageWidth - margin, y); y += 7;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Client :', margin, y);
    doc.text('Dates :', 130, y); y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(f.clientNom, margin, y);
    doc.text(`Date :      ${formatDate(f.dateFacture)}`, 130, y); y += 4;
    doc.text(`Échéance : ${formatDate(f.dateEcheance)}`, 130, y); y += 10;

    // Articles
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Désignation', margin + 1, y);
    doc.text('Qté', 130, y, { align: 'right' });
    doc.text('P.U.', 155, y, { align: 'right' });
    doc.text('Total', pageWidth - margin, y, { align: 'right' });
    y += 6; doc.setFont('helvetica', 'normal');
    for (const l of f.lignes) {
      const name = doc.splitTextToSize(l.designation, 105);
      doc.text(name, margin + 1, y);
      doc.text(`${l.quantite}`, 130, y, { align: 'right' });
      doc.text(pdfPrice(l.prixUnitaire), 155, y, { align: 'right' });
      doc.text(pdfPrice(l.total), pageWidth - margin, y, { align: 'right' });
      y += name.length > 1 ? name.length * 4 : 5;
    }

    // Totaux
    y += 3; doc.line(margin, y, pageWidth - margin, y); y += 5;
    const addRow = (label: string, val: string, bold = false) => {
      if (bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
      doc.text(label, 150, y, { align: 'right' });
      doc.text(val, pageWidth - margin, y, { align: 'right' }); y += 5;
    };
    addRow('Total HT :', pdfPrice(f.totalHT));
    if (f.tva > 0) addRow(`TVA (${f.tva}%) :`, pdfPrice(f.totalTTC - f.totalHT));
    addRow('TOTAL TTC :', pdfPrice(f.totalTTC), true);
    if (f.montantPaye > 0) addRow('Payé :', `- ${pdfPrice(f.montantPaye)}`);
    if (f.resteAPayer > 0) addRow('Reste à payer :', pdfPrice(f.resteAPayer), true);

    if (cfg.piedDePage) {
      y += 8; doc.setFontSize(8); doc.setFont('helvetica', 'italic');
      doc.text(cfg.piedDePage, pageWidth / 2, y, { align: 'center' });
    }
    doc.save(`facture-${f.numero}.pdf`);
  };

  const filtered = useMemo(() => {
    return factures.filter((f) => {
      const matchSearch =
        f.numero.toLowerCase().includes(search.toLowerCase()) ||
        f.clientNom.toLowerCase().includes(search.toLowerCase());
      const matchStatut = statutFilter === 'tous' || f.statut === statutFilter;
      return matchSearch && matchStatut;
    });
  }, [factures, search, statutFilter]);

  const table = useTableControls(filtered, { defaultSort: 'dateFacture', defaultDirection: 'desc' });

  const kpis = useMemo(() => ({
    totalFacture:  factures.reduce((s, f) => s + f.totalTTC, 0),
    totalPaye:     factures.reduce((s, f) => s + f.montantPaye, 0),
    totalEnAttente: factures.filter(f => ['envoyee', 'partielle', 'en_retard'].includes(f.statut)).reduce((s, f) => s + f.resteAPayer, 0),
    nbEnRetard:    factures.filter(f => f.statut === 'en_retard').length,
  }), [factures]);

  // ── Calculs totaux ─────────────────────────────────
  const totalHT  = useMemo(() => lignes.reduce((s, l) => s + l.total, 0) * (1 - formRemiseGlobale / 100), [lignes, formRemiseGlobale]);
  const totalTTC = useMemo(() => totalHT * (1 + formTva / 100), [totalHT, formTva]);

  const updateLigne = (index: number, patch: Partial<LigneForm>) => {
    setLignes(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const updated = { ...l, ...patch };
      updated.total = updated.quantite * updated.prixUnitaire * (1 - updated.remise / 100);
      return updated;
    }));
  };

  // Prefill from commande when selected
  const handleSelectCommande = (cmdId: string) => {
    setFormCommandeId(cmdId);
    if (!cmdId) return;
    const cmd = commandes.find(c => c.id === cmdId);
    if (!cmd) return;
    setFormClientId(cmd.clientId);
    setFormTva(cmd.tva);
    setFormRemiseGlobale(cmd.remiseGlobale);
    setLignes(cmd.lignes.map(l => ({
      designation: `${l.produitRef} — ${l.produitNom}`,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      remise: l.remise,
      tva: cmd.tva,
      total: l.total,
    })));
  };

  const openModal = () => {
    setFormClientId('');
    setFormCommandeId('');
    setFormTva(18);
    setFormRemiseGlobale(0);
    setFormDateEcheance('');
    setFormNotes('');
    setLignes([newLigne()]);
    setShowModal(true);
  };

  // Fermer le modal et libérer la commande verrouillée si abandon
  const closeModal = () => {
    if (lockedCommandeId) {
      if (USE_API) {
        commandesApi.update(lockedCommandeId, { statut: lockedCommandeStatutPrev as any }).catch(() => {});
      }
      setLockedCommandeId(null);
    }
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) return toast.error('Sélectionnez un client');
    if (!formDateEcheance) return toast.error('Renseignez la date d\'échéance');
    const validLignes = lignes.filter(l => l.designation.trim() && l.quantite > 0);
    if (validLignes.length === 0) return toast.error('Ajoutez au moins une ligne');

    setLoading(true);
    try {
      const payload = {
        clientId: formClientId,
        commandeId: formCommandeId || undefined,
        lignes: validLignes,
        totalHT,
        remiseGlobale: formRemiseGlobale,
        tva: formTva,
        totalTTC,
        dateEcheance: new Date(formDateEcheance),
        notes: formNotes || undefined,
      };

      if (USE_API) {
        const created = await facturesApi.create(payload);
        addFacture(created);
      } else {
        const client = clients.find(c => c.id === formClientId);
        addFacture({
          ...payload,
          id: `fac-${Date.now()}`,
          numero: `FAC-${new Date().getFullYear()}-${String(factures.length + 1).padStart(3, '0')}`,
          clientNom: client?.nom ?? '',
          clientEmail: client?.email,
          clientAdresse: client?.adresse,
          statut: 'brouillon',
          montantPaye: 0,
          resteAPayer: totalTTC,
          paiements: [],
          dateFacture: new Date(),
          dateEcheance: new Date(formDateEcheance),
          createdBy: user?.id ?? '',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Facture);
      }
      toast.success('Facture créée');
      // Succès : libérer le verrou sans remettre le statut précédent
      setLockedCommandeId(null);
      setShowModal(false);
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  // ── Commandes en attente de facturation ──────────────────
  const commandesEnAttente = commandes.filter(c =>
    c.type === 'commande' &&
    ['confirme', 'en_preparation', 'expedie', 'livre'].includes(c.statut) &&
    !factures.some(f => f.commandeId === c.id)
  );
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Comptabilité</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Facturation</h1>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            {/* Bouton commandes en attente */}
            <button
              className="btn-secondary relative flex items-center gap-2 text-sm"
              onClick={() => setShowQueueModal(true)}
            >
              <ClipboardList size={15} />
              Commandes en attente
              {commandesEnAttente.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-gold)' }}>
                  {commandesEnAttente.length}
                </span>
              )}
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={openModal}>
              <Plus size={15} /> Nouvelle facture
            </button>
          </div>
        )}
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
              <SortableHeader column="numero" label="Numéro" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="clientNom" label="Client" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="totalTTC" label="Total TTC" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="montantPaye" label="Payé" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="resteAPayer" label="Reste à payer" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="statut" label="Statut" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="dateFacture" label="Date" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="dateEcheance" label="Échéance" sort={table.sort} onSort={table.setSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {table.paginatedData.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucune facture trouvée</td></tr>
            ) : table.paginatedData.map((f) => {
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
                        onClick={(e) => handleQuickPDF(e, f)}
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
        <Pagination
          page={table.page}
          totalPages={table.totalPages}
          totalItems={table.totalItems}
          pageSize={table.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </div>

      {/* Modal Commandes en attente */}
      {showQueueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQueueModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                    Commandes en attente
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                    {commandesEnAttente.length === 0
                      ? 'Aucune commande à facturer'
                      : `${commandesEnAttente.length} commande${commandesEnAttente.length > 1 ? 's' : ''} prête${commandesEnAttente.length > 1 ? 's' : ''} à facturer`}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowQueueModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>

            {/* Liste */}
            <div className="divide-y max-h-[60vh] overflow-y-auto" style={{ borderColor: 'var(--color-cream-dark)' }}>
              {commandesEnAttente.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2">
                  <ClipboardList size={36} style={{ color: 'var(--color-ink-muted)', opacity: 0.3 }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-muted)' }}>Aucune commande en attente</p>
                  <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                    Les commandes confirmées/livrées sans facture apparaissent ici
                  </p>
                </div>
              ) : commandesEnAttente.map(cmd => (
                <div key={cmd.id} className="flex items-center gap-4 px-6 py-4 hover:bg-amber-50/40 transition-colors">
                  {/* Numéro */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-ink)' }}>{cmd.numero}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                        style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
                        {cmd.statut.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
                      {cmd.clientNom} · {formatPrice(cmd.totalTTC)}
                      {cmd.acompte > 0 && ` · Acompte ${formatPrice(cmd.acompte)}`}
                    </p>
                    {cmd.lignes.length > 0 && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-ink-muted)' }}>
                        {cmd.lignes.map(l => `${l.quantite}× ${l.produitNom}`).join(', ')}
                      </p>
                    )}
                  </div>
                  {/* Action */}
                  <button
                    onClick={() => {
                      // Verrouiller la commande
                      if (USE_API) {
                        commandesApi.update(cmd.id, { statut: 'en_facturation' as any }).catch(() => {});
                      }
                      setLockedCommandeId(cmd.id);
                      setLockedCommandeStatutPrev(cmd.statut as string);
                      setShowQueueModal(false);
                      openModal();
                      setTimeout(() => handleSelectCommande(cmd.id), 50);
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-colors"
                    style={{ backgroundColor: 'var(--color-gold)' }}
                  >
                    <Plus size={13} /> Facturer
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouvelle facture */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                Nouvelle facture
              </h3>
              <button onClick={() => closeModal()} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Client *</label>
                  <SearchableSelect
                    required
                    options={clients.filter(c => c.actif).map(c => ({ value: c.id, label: c.nom }))}
                    value={formClientId}
                    onChange={val => setFormClientId(val)}
                    emptyLabel="Sélectionner…"
                    placeholder="Rechercher un client…"
                  />
                </div>
                <div>
                  <label className="label">Commande liée (optionnel)</label>
                  <SearchableSelect
                    options={commandes.filter(c => c.type === 'commande').map(c => ({ value: c.id, label: `${c.numero} — ${c.clientNom}` }))}
                    value={formCommandeId}
                    onChange={val => handleSelectCommande(val)}
                    emptyLabel="Aucune"
                    placeholder="Rechercher une commande…"
                  />
                </div>
              </div>

              {/* Lignes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">Lignes de facturation *</label>
                  <button
                    type="button"
                    onClick={() => setLignes(prev => [...prev, newLigne(formTva)])}
                    className="text-xs font-medium flex items-center gap-1"
                    style={{ color: 'var(--color-gold)' }}
                  >
                    <Plus size={13} /> Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-2">
                  {lignes.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl" style={{ backgroundColor: 'var(--color-cream)' }}>
                      <div className="col-span-5">
                        <label className="label text-[10px]">Désignation</label>
                        <input
                          required
                          className="input text-sm"
                          placeholder="Désignation du service/produit…"
                          value={l.designation}
                          onChange={e => updateLigne(i, { designation: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">Qté</label>
                        <input type="number" min="1" className="input text-sm" value={l.quantite}
                          onChange={e => updateLigne(i, { quantite: +e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">P.U. (F)</label>
                        <input type="number" min="0" className="input text-sm" value={l.prixUnitaire}
                          onChange={e => updateLigne(i, { prixUnitaire: +e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">Remise %</label>
                        <input type="number" min="0" max="100" className="input text-sm" value={l.remise}
                          onChange={e => updateLigne(i, { remise: +e.target.value })} />
                      </div>
                      <div className="col-span-1 flex items-center justify-end pb-1">
                        {lignes.length > 1 && (
                          <button type="button" onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {l.total > 0 && (
                        <div className="col-span-12 text-right text-xs font-semibold" style={{ color: 'var(--color-gold)' }}>
                          Sous-total: {formatPrice(l.total)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">TVA (%)</label>
                  <input type="number" min="0" max="100" className="input" value={formTva}
                    onChange={e => setFormTva(+e.target.value)} />
                </div>
                <div>
                  <label className="label">Remise globale (%)</label>
                  <input type="number" min="0" max="100" className="input" value={formRemiseGlobale}
                    onChange={e => setFormRemiseGlobale(+e.target.value)} />
                </div>
                <div>
                  <label className="label">Échéance *</label>
                  <input type="date" required className="input" value={formDateEcheance}
                    onChange={e => setFormDateEcheance(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Notes (optionnel)</label>
                <input className="input" placeholder="Notes pour la facture…" value={formNotes}
                  onChange={e => setFormNotes(e.target.value)} />
              </div>

              {/* Récap */}
              <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: 'var(--color-cream)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-muted)' }}>Total HT</span>
                  <span style={{ color: 'var(--color-ink)' }}>{formatPrice(totalHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-muted)' }}>TVA ({formTva}%)</span>
                  <span style={{ color: 'var(--color-ink)' }}>{formatPrice(totalTTC - totalHT)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2" style={{ borderTop: '1px solid var(--color-cream-dark)', color: 'var(--color-ink)' }}>
                  <span>Total TTC</span>
                  <span style={{ color: 'var(--color-gold)' }}>{formatPrice(totalTTC)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => closeModal()} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Enregistrement…' : 'Créer la facture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
