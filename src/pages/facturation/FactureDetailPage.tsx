import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Send, CheckCircle, Printer, CreditCard, X, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { facturesApi, parametresApi, USE_API } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { ModePaiement } from '@/types';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import RetourModal from '@/components/pos/RetourModal';


const MODES_PAIEMENT: { value: ModePaiement; label: string }[] = [
  { value: 'especes',      label: 'Espèces' },
  { value: 'virement',     label: 'Virement bancaire' },
  { value: 'cheque',       label: 'Chèque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'carte',        label: 'Carte bancaire' },
  { value: 'autre',        label: 'Autre' },
];

const DEFAULT_CONFIG = {
  nom: 'Kiosq Commercial',
  adresse: 'Dakar, Sénégal',
  telephone: '+221 33 800 00 00',
  email: 'contact@kiosq.com',
  piedDePage: 'Merci pour votre confiance',
  logoUrl: window.location.origin + '/icon.png',
};

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { factures, updateFacture } = useAppStore();
  const { user } = useAuthStore();

  const facture = factures.find((f) => f.id === id);
  const canEdit = user?.role === 'admin' || user?.role === 'comptable' || user?.role === 'gestionnaire';

  const [showPayModal, setShowPayModal] = useState(false);
  const [payMontant, setPayMontant] = useState(0);
  const [payMode, setPayMode] = useState<ModePaiement>('especes');
  const [payRef, setPayRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (USE_API) {
      parametresApi.get()
        .then(data => setCfg({
          nom:        data.nom        ?? DEFAULT_CONFIG.nom,
          adresse:    data.adresse    ?? DEFAULT_CONFIG.adresse,
          telephone:  data.telephone  ?? DEFAULT_CONFIG.telephone,
          email:      data.email      ?? DEFAULT_CONFIG.email,
          piedDePage: data.piedDePage ?? DEFAULT_CONFIG.piedDePage,
          logoUrl:    data.logoUrl    ?? '',
        }))
        .catch(() => {});
    } else {
      try {
        const stored = localStorage.getItem('kiosq_config');
        if (stored) setCfg(prev => ({ ...prev, ...JSON.parse(stored) }));
        // logoUrl also stored in kiosq_config by ConfigurationPage
      } catch { }
    }
  }, []);

  if (!facture) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Facture introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/facturation')}>Retour</button>
    </div>
  );

  const handleMarkPaid = async () => {
    if (!confirm('Marquer cette facture comme entièrement payée ?')) return;
    setStatusLoading(true);
    try {
      if (USE_API) {
        const updated = await facturesApi.update(facture.id, { statut: 'payee' });
        updateFacture(facture.id, updated);
      } else {
        updateFacture(facture.id, { statut: 'payee', montantPaye: facture.totalTTC, resteAPayer: 0 });
      }
      toast.success('Facture marquée comme payée');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleMarkSent = async () => {
    setStatusLoading(true);
    try {
      if (USE_API) {
        const updated = await facturesApi.update(facture.id, { statut: 'envoyee' });
        updateFacture(facture.id, updated);
      } else {
        updateFacture(facture.id, { statut: 'envoyee' });
      }
      toast.success('Facture marquée comme envoyée');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setStatusLoading(false);
    }
  };

  const openPayModal = () => {
    setPayMontant(facture.resteAPayer);
    setPayMode('especes');
    setPayRef('');
    setShowPayModal(true);
  };

  const handleRegisterPaiement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payMontant <= 0) return toast.error('Montant invalide');
    if (payMontant > facture.resteAPayer) return toast.error('Montant supérieur au reste à payer');

    setPayLoading(true);
    try {
      const paiement = {
        montant: payMontant,
        mode: payMode,
        date: new Date().toISOString(),
        reference: payRef || undefined,
      };

      if (USE_API) {
        const updated = await facturesApi.addPaiement(facture.id, paiement as any);
        updateFacture(facture.id, updated);
      } else {
        // Local fallback
        const newMontantPaye = facture.montantPaye + payMontant;
        const newReste = Math.max(0, facture.totalTTC - newMontantPaye);
        const newStatut = newReste === 0 ? 'payee' : 'partielle';
        updateFacture(facture.id, {
          montantPaye: newMontantPaye,
          resteAPayer: newReste,
          statut: newStatut,
          paiements: [...facture.paiements, {
            id: `pay-${Date.now()}`,
            montant: payMontant,
            mode: payMode,
            date: new Date(),
            reference: payRef || undefined,
          }],
        });
      }
      toast.success('Paiement enregistré');
      setShowPayModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setPayLoading(false);
    }
  };

  // ── PDF & Impression ───────────────────────────────────
  const pdfPrice = (n: number) =>
    formatPrice(n).replace(/[\u00a0\u202f\u2009\u2007\u2008]/g, ' ');

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Facture ${facture?.numero ?? ''}</title>
          <style>
            body { margin: 20px; font-family: Arial, sans-serif; font-size: 12px; color: #111; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 2px solid #e5e7eb; padding: 6px 4px; }
            td { padding: 6px 4px; border-bottom: 1px solid #f3f4f6; }
            .total-section { max-width: 280px; margin-left: auto; }
            .total-row { display: flex; justify-content: space-between; padding: 4px 0; }
            .grand-total { font-weight: bold; font-size: 14px; border-top: 2px solid #d4a017; padding-top: 6px; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const addLogoToPdf = (doc: jsPDF, logoUrl: string, x: number, y: number, maxW: number, maxH: number): Promise<number> => {
    return new Promise(resolve => {
      if (!logoUrl) { resolve(0); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(0); return; }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const ratio = img.naturalWidth / img.naturalHeight;
          let w = maxW, h = maxW / ratio;
          if (h > maxH) { h = maxH; w = maxH * ratio; }
          doc.addImage(dataUrl, 'PNG', x, y, w, h);
          resolve(h);
        } catch { resolve(0); }
      };
      img.onerror = () => resolve(0);
      img.src = logoUrl;
    });
  };

  const handleDownloadPDF = async () => {
    if (!facture) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const margin = 15;
    const pageWidth = 210;
    const startY = 15;

    // ── Colonne gauche : Logo + coordonnées entreprise ──────────
    let leftY = startY;
    const logoH = await addLogoToPdf(doc, cfg.logoUrl, margin, leftY, 32, 20);
    if (logoH > 0) leftY += logoH + 3;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(cfg.nom.toUpperCase(), margin, leftY); leftY += 5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    if (cfg.email)    { doc.text(cfg.email,    margin, leftY); leftY += 4; }
    if (cfg.telephone){ doc.text(cfg.telephone, margin, leftY); leftY += 4; }
    if (cfg.adresse)  { doc.text(cfg.adresse,   margin, leftY); leftY += 4; }

    // ── Colonne droite : FACTURE + numéro + statut ───────────────
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', pageWidth - margin, startY + 10, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(facture.numero, pageWidth - margin, startY + 18, { align: 'right' });

    const statutTxt = statutLabel(facture.statut).toUpperCase();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(statutTxt, pageWidth - margin, startY + 24, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // ── Séparateur ───────────────────────────────────────────────
    let y = Math.max(leftY, startY + 30) + 4;
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Client + dates
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Facturer à :', margin, y);
    doc.text('Dates :', 130, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(facture.clientNom, margin, y);
    doc.text(`Date :      ${formatDate(facture.dateFacture)}`, 130, y); y += 4;
    if (facture.clientEmail)   { doc.text(facture.clientEmail, margin, y); }
    doc.text(`Échéance : ${formatDate(facture.dateEcheance)}`, 130, y); y += 4;
    if (facture.clientAdresse) { doc.text(facture.clientAdresse, margin, y); y += 4; }
    y += 8;

    // Tableau lignes
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Désignation',          margin + 1, y);
    doc.text('Qté',    130,           y, { align: 'right' });
    doc.text('P.U.',   155,           y, { align: 'right' });
    doc.text('Remise', 173,           y, { align: 'right' });
    doc.text('Total',  pageWidth - margin, y, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'normal');

    for (const ligne of facture.lignes) {
      const name = doc.splitTextToSize(ligne.designation, 100);
      doc.text(name,                           margin + 1, y);
      doc.text(`${ligne.quantite}`,             130,        y, { align: 'right' });
      doc.text(pdfPrice(ligne.prixUnitaire),    155,        y, { align: 'right' });
      doc.text(ligne.remise > 0 ? `${ligne.remise}%` : '-', 173, y, { align: 'right' });
      doc.text(pdfPrice(ligne.total),           pageWidth - margin, y, { align: 'right' });
      y += name.length > 1 ? name.length * 4 : 5;
    }

    // Totaux
    y += 3;
    doc.line(margin, y, pageWidth - margin, y); y += 5;
    const colLabel = 150;
    const colVal   = pageWidth - margin;
    const addRow = (label: string, val: string, bold = false) => {
      if (bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
      doc.text(label, colLabel, y, { align: 'right' });
      doc.text(val,   colVal,   y, { align: 'right' });
      y += 5;
    };
    addRow('Total HT :', pdfPrice(facture.totalHT));
    if (facture.remiseGlobale > 0)
      addRow(`Remise (${facture.remiseGlobale}%) :`, `- ${pdfPrice(facture.totalHT * facture.remiseGlobale / 100)}`);
    if (facture.tva > 0)
      addRow(`TVA (${facture.tva}%) :`, pdfPrice(facture.totalTTC - facture.totalHT));
    addRow('TOTAL TTC :', pdfPrice(facture.totalTTC), true);
    if (facture.montantPaye > 0) addRow('Payé :',        `- ${pdfPrice(facture.montantPaye)}`);
    if (facture.resteAPayer > 0) addRow('Reste à payer :', pdfPrice(facture.resteAPayer), true);

    // Pied de page
    if (cfg.piedDePage) {
      y += 10;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(cfg.piedDePage, pageWidth / 2, y, { align: 'center' });
    }

    doc.save(`facture-${facture.numero}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-muted)' }} onClick={() => navigate('/facturation')}>
        <ArrowLeft size={15} /> Retour
      </button>

      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono" style={{ color: 'var(--color-ink)' }}>{facture.numero}</h1>
          <span className={clsx('badge', statutColor(facture.statut))}>{statutLabel(facture.statut)}</span>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <button className="btn-secondary" title="Imprimer" onClick={handlePrint}><Printer size={14} /> Imprimer</button>
            <button className="btn-secondary" title="Télécharger PDF" onClick={handleDownloadPDF}><Download size={14} /> PDF</button>
            {facture.statut === 'brouillon' && (
              <button className="btn-secondary" onClick={handleMarkSent} disabled={statusLoading}>
                <Send size={14} /> {statusLoading ? '…' : 'Marquer envoyée'}
              </button>
            )}
            {['envoyee', 'partielle', 'en_retard'].includes(facture.statut) && (
              <button className="btn-secondary" style={{ color: '#16a34a', borderColor: '#86efac' }} onClick={openPayModal}>
                <CreditCard size={14} /> Enregistrer paiement
              </button>
            )}
            {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
              <button className="btn-primary" onClick={handleMarkPaid} disabled={statusLoading}>
                <CheckCircle size={14} /> {statusLoading ? '…' : 'Marquer payée'}
              </button>
            )}
            {(user?.role === 'admin' || user?.role === 'gestionnaire') && facture.statut !== 'annulee' && facture.statut !== 'brouillon' && (
              <button className="btn-secondary" style={{ color: '#d97706', borderColor: '#fcd34d' }} onClick={() => setShowReturnModal(true)}>
                <RotateCcw size={14} /> Retour client
              </button>
            )}
          </div>
        )}
      </div>

      {/* Facture preview — zone imprimable */}
      <div className="card p-8 shadow-md" ref={printRef}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {cfg.logoUrl
              ? <img src={cfg.logoUrl} alt="Logo" className="h-12 object-contain mb-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--color-gold)' }}>{cfg.nom}</p>
            }
            {cfg.email     && <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{cfg.email}</p>}
            {cfg.telephone && <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{cfg.telephone}</p>}
            {cfg.adresse   && <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{cfg.adresse}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)' }}>FACTURE</p>
            <p className="font-mono text-sm mt-1" style={{ color: 'var(--color-ink)' }}>{facture.numero}</p>
          </div>
        </div>

        {/* Client & dates */}
        <div className="grid grid-cols-2 gap-8 mb-8 p-5 rounded-xl" style={{ backgroundColor: 'var(--color-cream)' }}>
          <div>
            <p className="label">Facturer à</p>
            <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>{facture.clientNom}</p>
            {facture.clientEmail && <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{facture.clientEmail}</p>}
            {facture.clientAdresse && <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{facture.clientAdresse}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label">Date</p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{formatDate(facture.dateFacture)}</p>
            </div>
            <div>
              <p className="label">Échéance</p>
              <p className="text-sm font-medium" style={{ color: facture.statut === 'en_retard' ? '#dc2626' : 'var(--color-ink)' }}>
                {formatDate(facture.dateEcheance)}
              </p>
            </div>
          </div>
        </div>

        {/* Lines */}
        <table className="table-auto w-full mb-6">
          <thead>
            <tr>
              <th>Désignation</th>
              <th className="text-right">Qté</th>
              <th className="text-right">P.U.</th>
              <th className="text-right">Remise</th>
              <th className="text-right">TVA</th>
              <th className="text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {facture.lignes.map((l, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--color-ink)' }}>{l.designation}</td>
                <td className="text-right" style={{ color: 'var(--color-ink-muted)' }}>{l.quantite}</td>
                <td className="text-right">{formatPrice(l.prixUnitaire)}</td>
                <td className="text-right">{l.remise > 0 ? `${l.remise}%` : '—'}</td>
                <td className="text-right">{l.tva}%</td>
                <td className="text-right font-medium" style={{ color: 'var(--color-ink)' }}>{formatPrice(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-ink-muted)' }}>Total HT</span>
              <span style={{ color: 'var(--color-ink)' }}>{formatPrice(facture.totalHT)}</span>
            </div>
            {facture.remiseGlobale > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-ink-muted)' }}>Remise ({facture.remiseGlobale}%)</span>
                <span style={{ color: '#dc2626' }}>- {formatPrice(facture.totalHT * facture.remiseGlobale / 100)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-ink-muted)' }}>TVA ({facture.tva}%)</span>
              <span style={{ color: 'var(--color-ink)' }}>{formatPrice(facture.totalTTC - facture.totalHT)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: '2px solid var(--color-gold)', color: 'var(--color-ink)' }}>
              <span>Total TTC</span>
              <span style={{ color: 'var(--color-gold)' }}>{formatPrice(facture.totalTTC)}</span>
            </div>
            {facture.montantPaye > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#16a34a' }}>Payé</span>
                <span style={{ color: '#16a34a' }}>- {formatPrice(facture.montantPaye)}</span>
              </div>
            )}
            {facture.resteAPayer > 0 && (
              <div className="flex justify-between text-sm font-bold">
                <span style={{ color: '#d97706' }}>Reste à payer</span>
                <span style={{ color: '#d97706' }}>{formatPrice(facture.resteAPayer)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments history */}
        {facture.paiements.length > 0 && (
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
            <p className="label mb-3">Historique des paiements</p>
            <div className="space-y-2">
              {facture.paiements.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-cream)' }}>
                  <div className="flex items-center gap-3">
                    <CheckCircle size={14} style={{ color: '#16a34a' }} />
                    <div>
                      <p className="text-xs font-medium capitalize" style={{ color: 'var(--color-ink)' }}>
                        {MODES_PAIEMENT.find(m => m.value === p.mode)?.label ?? p.mode}
                      </p>
                      {p.reference && <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Réf: {p.reference}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatPrice(p.montant)}</p>
                    <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{formatDate(p.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-base" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                Enregistrer un paiement
              </h3>
              <button onClick={() => setShowPayModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleRegisterPaiement} className="px-6 py-5 space-y-4">
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--color-cream)' }}>
                <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Reste à payer</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(facture.resteAPayer)}</p>
              </div>
              <div>
                <label className="label">Montant (F) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  max={facture.resteAPayer}
                  className="input"
                  value={payMontant || ''}
                  onChange={e => setPayMontant(+e.target.value)}
                  autoFocus
                />
                {payMontant > 0 && payMontant < facture.resteAPayer && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
                    Reste après paiement : {formatPrice(facture.resteAPayer - payMontant)}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Mode de paiement *</label>
                <SearchableSelect
                  required
                  options={MODES_PAIEMENT.map(m => ({ value: m.value, label: m.label }))}
                  value={payMode}
                  onChange={(val: string) => setPayMode(val as ModePaiement)}
                  emptyLabel="Sélectionner…"
                  placeholder="Rechercher un mode…"
                />
              </div>
              <div>
                <label className="label">Référence (optionnel)</label>
                <input className="input" placeholder="N° chèque, référence virement…" value={payRef}
                  onChange={e => setPayRef(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={payLoading} className="btn-primary flex-1">
                  {payLoading ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Retour Client Modal */}
      {showReturnModal && (
        <RetourModal
          facture={facture}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
