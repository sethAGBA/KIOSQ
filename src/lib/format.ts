/**
 * Formate un nombre en devise (XOF par défaut)
 */
export function formatPrice(amount: number, devise = 'XOF'): string {
  if (devise === 'XOF') {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' F';
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formate un pourcentage avec signe
 */
export function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Formate une date en français
 */
export function formatDate(date: Date | string | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Retourne la variante de badge selon un statut
 */
export function statutColor(statut: string): string {
  const map: Record<string, string> = {
    brouillon: 'badge-neutral',
    envoye: 'badge-info',
    confirme: 'badge-gold',
    en_preparation: 'badge-warning',
    expedie: 'badge-info',
    livre: 'badge-success',
    annule: 'badge-danger',
    accepte: 'badge-success',
    refuse: 'badge-danger',
    expire: 'badge-neutral',
    en_caisse: 'badge-warning',
    en_facturation: 'badge-info',
    // factures
    envoyee: 'badge-info',
    payee: 'badge-success',
    partielle: 'badge-warning',
    en_retard: 'badge-danger',
    annulee: 'badge-neutral',
    // commandes fournisseurs
    commandee: 'badge-info',
    recu_partiel: 'badge-warning',
    recu: 'badge-success',
  };
  return map[statut] ?? 'badge-neutral';
}

/**
 * Libellé lisible d'un statut
 */
export function statutLabel(statut: string): string {
  const map: Record<string, string> = {
    brouillon: 'Brouillon',
    envoye: 'Envoyé',
    confirme: 'Confirmé',
    en_preparation: 'En préparation',
    expedie: 'Expédié',
    livre: 'Livré',
    annule: 'Annulé',
    accepte: 'Accepté',
    refuse: 'Refusé',
    expire: 'Expiré',
    en_caisse: '🔒 En caisse',
    en_facturation: '🔒 En facturation',
    envoyee: 'Envoyée',
    payee: 'Payée',
    partielle: 'Paiement partiel',
    en_retard: 'En retard',
    annulee: 'Annulée',
    commandee: 'Commandée',
    recu_partiel: 'Reçu partiel',
    recu: 'Reçu',
  };
  return map[statut] ?? statut;
}

export { exportToCSV } from './exportUtils';
