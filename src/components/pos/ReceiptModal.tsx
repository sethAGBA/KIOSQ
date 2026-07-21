import { useRef, useState, useEffect } from 'react';
import { X, Printer, FileDown } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type { Facture } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { parametresApi, USE_API } from '@/lib/api';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface ReceiptModalProps {
  facture: Facture;
  onClose: () => void;
}

export function ReceiptModal({ facture, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  const DEFAULT_CFG = { nom: 'Kiosq Commercial', adresse: 'Dakar, Sénégal', telephone: '+221 33 800 00 00', piedDePage: 'Merci de votre visite !', logoUrl: '' };
  const [cfg, setCfg] = useState(DEFAULT_CFG);

  useEffect(() => {
    if (USE_API) {
      parametresApi.get()
        .then(data => setCfg({
          nom:        data.nom        ?? DEFAULT_CFG.nom,
          adresse:    data.adresse    ?? DEFAULT_CFG.adresse,
          telephone:  data.telephone  ?? DEFAULT_CFG.telephone,
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

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket ${facture.numero}</title>
          <style>
            body { margin: 0; padding: 10px; font-family: monospace; font-size: 11px; color: black; width: 80mm; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .right { text-align: right; }
            .divider { border-top: 1px dashed black; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; vertical-align: top; }
            .total-row { font-weight: bold; font-size: 12px; }
            .red { color: red; }
            .small { font-size: 9px; }
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

  const handleDownloadPDF = async () => {
    // Lecture de la config entreprise
    const nomEtab  = cfg.nom;
    const adresse  = cfg.adresse;
    const tel      = cfg.telephone;
    const piedPage = cfg.piedDePage;
    const logoUrl  = cfg.logoUrl;

    /**
     * Formateur sûr pour jsPDF :
     * Intl.NumberFormat('fr-FR') utilise U+202F (narrow no-break space) comme
     * séparateur de milliers — jsPDF le rend caractère par caractère, d'où
     * "5 / 5 0 0 F". On remplace tout espace Unicode par un point.
     */
    const pdfPrice = (n: number): string =>
      formatPrice(n).replace(/[\u00a0\u202f\u2009\u2007\u2008]/g, '.');

    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200], // 80mm wide thermal receipt
      orientation: 'portrait',
    });

    let y = 10;
    const centerX = 40;
    const margin  = 5;

    // ── Logo ou nom en-tête ───────────────────────
    if (logoUrl) {
      // Charge le logo via canvas pour l'intégrer dans jsPDF
      await new Promise<void>(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx2d = canvas.getContext('2d');
            if (ctx2d) {
              ctx2d.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              const ratio = img.naturalWidth / img.naturalHeight;
              const logoW = 20, logoH = logoW / ratio;
              doc.addImage(dataUrl, 'PNG', centerX - logoW / 2, y, logoW, logoH);
              y += logoH + 2;
            }
          } catch { /* CORS silencié */ }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = logoUrl;
      });
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(nomEtab.toUpperCase(), centerX, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (adresse) { doc.text(adresse, centerX, y, { align: 'center' }); y += 4; }
    if (tel)     { doc.text(`Tel: ${tel}`, centerX, y, { align: 'center' }); y += 4; }

    // Séparateur
    y += 2;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    // ── Infos vente ────────────────────────────────────────
    doc.setFontSize(8);
    const dateStr = format(new Date(facture.dateFacture), 'dd/MM/yyyy HH:mm');
    doc.text(`Date:    ${dateStr}`, margin, y); y += 4;
    doc.text(`Ticket:  #${facture.numero}`, margin, y); y += 4;
    doc.text(`Client:  ${facture.clientNom || 'Client passage'}`, margin, y); y += 4;
    const caissier = user ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() : '';
    if (caissier) { doc.text(`Caissier: ${caissier.split(' ')[0]}`, margin, y); y += 4; }

    // Séparateur
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    // ── Colonnes articles ──────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.text('Qte',    margin,           y);
    doc.text('Article', margin + 10,     y);
    doc.text('Montant', 80 - margin,     y, { align: 'right' });
    y += 2;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    for (const ligne of facture.lignes) {
      const montantStr = pdfPrice(ligne.total);
      doc.text(`${ligne.quantite}`, margin, y);
      const maxWidth = 42;
      const splitName = doc.splitTextToSize(ligne.designation, maxWidth);
      doc.text(splitName,  margin + 10, y);
      doc.text(montantStr, 80 - margin, y, { align: 'right' });
      y += splitName.length > 1 ? splitName.length * 4 : 4;
    }

    // ── Totaux ─────────────────────────────────────────────
    y += 2;
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    doc.text(`Total HT: ${pdfPrice(facture.totalHT)}`, margin, y); y += 4;

    const totalRemise = facture.lignes.reduce(
      (s, l) => s + (l.prixUnitaire * l.quantite * (l.remise / 100)), 0
    );
    if (totalRemise > 0) {
      doc.text(`Remise:  -${pdfPrice(totalRemise)}`, margin, y); y += 4;
    }
    if (facture.tva > 0) {
      doc.text(`TVA (${facture.tva}%): ${pdfPrice(facture.totalTTC - facture.totalHT)}`, margin, y); y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`NET A PAYER: ${pdfPrice(facture.totalTTC)}`, margin, y); y += 6;

    // ── Paiement ───────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    const paiement = facture.paiements?.[0];
    const modeLabel: Record<string, string> = {
      especes: 'Especes', virement: 'Virement', cheque: 'Cheque',
      mobile_money: 'Mobile Money', carte: 'Carte', autre: 'Autre',
    };
    const mode = modeLabel[paiement?.mode ?? ''] ?? (paiement?.mode ?? '').toUpperCase();
    doc.text(`Mode:  ${mode}`, margin, y); y += 4;

    const montantRecu = paiement?.montant ?? facture.montantPaye;
    doc.text(`Recu:  ${pdfPrice(montantRecu)}`, margin, y); y += 4;

    if (facture.resteAPayer > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 0, 0);
      doc.text(`RESTE A PAYER: ${pdfPrice(facture.resteAPayer)}`, margin, y); y += 5;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }

    const rendu = paiement?.mode === 'especes' && montantRecu > facture.totalTTC
      ? montantRecu - facture.totalTTC : 0;
    if (rendu > 0) {
      doc.text(`Rendu: ${pdfPrice(rendu)}`, margin, y); y += 4;
    }
    y += 2;

    // ── Pied de page ───────────────────────────────────────
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, 80 - margin, y);
    y += 4;
    doc.setFontSize(7);
    doc.text(piedPage, centerX, y, { align: 'center' }); y += 4;
    doc.text('Logiciel: Kiosq — Gestion commerciale', centerX, y, { align: 'center' });

    doc.save(`ticket-${facture.numero}.pdf`);
  };

  const modePaiementLabel = (mode: string) =>
    ({ especes: 'Espèces', mobile_money: 'Mobile Money', carte: 'Carte', virement: 'Virement', autre: 'Autre' }[mode] ?? mode);

  const totalRemise = facture.lignes.reduce((s, l) => s + (l.prixUnitaire * l.quantite * (l.remise / 100)), 0);
  const paiement = facture.paiements?.[0];
  const montantRecu = paiement?.montant ?? facture.montantPaye;
  const rendu = paiement?.mode === 'especes' && montantRecu > facture.totalTTC ? montantRecu - facture.totalTTC : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-sm mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--color-cream-dark)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
            Aperçu du ticket
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className="bg-white shadow-md mx-auto max-w-[300px] rounded p-4">
            {/* Ce div est le contenu imprimable */}
            <div ref={printRef} className="text-black font-mono text-[10px] leading-tight">
              {/* Header */}
              <div className="text-center mb-3">
                {cfg.logoUrl
                  ? <img src={cfg.logoUrl} alt="Logo" className="mx-auto mb-1" style={{ maxHeight: 32, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <p className="text-sm font-bold uppercase tracking-wider">{cfg.nom}</p>
                }
                {cfg.logoUrl && <p className="text-xs font-bold uppercase">{cfg.nom}</p>}
                {cfg.adresse   && <p>{cfg.adresse}</p>}
                {cfg.telephone && <p>Tél : {cfg.telephone}</p>}
              </div>
              <div className="divider" />

              {/* Infos vente */}
              <div className="mb-3 space-y-0.5">
                <div className="flex justify-between">
                  <span>Date :</span>
                  <span>{new Date(facture.dateFacture).toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ticket :</span>
                  <span className="font-bold">{facture.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span>Client :</span>
                  <span>{facture.clientNom}</span>
                </div>
                <div className="flex justify-between">
                  <span>Caissier :</span>
                  <span>{user?.prenom} {user?.nom}</span>
                </div>
              </div>
              <div className="divider" />

              {/* Articles */}
              <table className="w-full mb-3">
                <thead>
                  <tr style={{ borderBottom: '1px dashed black' }}>
                    <th className="text-left py-1 font-bold">Qté</th>
                    <th className="text-left py-1 font-bold">Art</th>
                    <th className="text-right py-1 font-bold">Mnt</th>
                  </tr>
                </thead>
                <tbody>
                  {facture.lignes.map((l, i) => (
                    <tr key={i}>
                      <td className="py-0.5 align-top w-[10%]">{l.quantite}</td>
                      <td className="py-0.5 align-top pr-1">{l.designation}</td>
                      <td className="py-0.5 align-top text-right whitespace-nowrap">
                        {formatPrice(l.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divider" />

              {/* Totaux */}
              <div className="mb-3 space-y-0.5">
                <div className="flex justify-between">
                  <span>Total HT</span>
                  <span>{formatPrice(facture.totalHT)}</span>
                </div>
                {totalRemise > 0 && (
                  <div className="flex justify-between">
                    <span>Remise</span>
                    <span>-{formatPrice(totalRemise)}</span>
                  </div>
                )}
                {facture.tva > 0 && (
                  <div className="flex justify-between">
                    <span>TVA ({facture.tva}%)</span>
                    <span>{formatPrice(facture.totalTTC - facture.totalHT + totalRemise)}</span>
                  </div>
                )}
                <div className="divider" />
                <div className="flex justify-between font-bold text-sm">
                  <span>NET À PAYER</span>
                  <span>{formatPrice(facture.totalTTC)}</span>
                </div>
              </div>

              {/* Paiement */}
              <div className="mb-4 space-y-0.5">
                <div className="flex justify-between">
                  <span>Mode :</span>
                  <span className="uppercase">{modePaiementLabel(paiement?.mode ?? '')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reçu :</span>
                  <span>{formatPrice(montantRecu)}</span>
                </div>
                {facture.resteAPayer > 0 && (
                  <div className="flex justify-between font-bold" style={{ color: 'red' }}>
                    <span>Reste à payer :</span>
                    <span>{formatPrice(facture.resteAPayer)}</span>
                  </div>
                )}
                {rendu > 0 && (
                  <div className="flex justify-between">
                    <span>Rendu :</span>
                    <span>{formatPrice(rendu)}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="divider" />
              <div className="text-center space-y-1 mt-2">
                <p className="italic">{cfg.piedDePage}</p>
                <p className="text-[8px] mt-2">Logiciel : Kiosq — Gestion commerciale</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="p-4 border-t flex gap-3"
          style={{ borderColor: 'var(--color-cream-dark)' }}
        >
          <button
            onClick={handlePrint}
            className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
          >
            <Printer size={16} /> Imprimer
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
          >
            <FileDown size={16} /> PDF
          </button>
        </div>
      </div>
    </div>
  );
}
