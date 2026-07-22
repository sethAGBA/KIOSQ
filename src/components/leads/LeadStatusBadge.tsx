import type { StatutLead } from '@/types';

interface LeadStatusBadgeProps {
  statut: StatutLead;
}

const CONFIG: Record<StatutLead, { label: string; className: string }> = {
  nouveau: { label: 'Nouveau',  className: 'badge-warning' },   // orange
  envoye:  { label: 'Envoyé',   className: 'badge-success' },   // green
  ignore:  { label: 'Ignoré',   className: 'badge-neutral' },   // grey
};

export default function LeadStatusBadge({ statut }: LeadStatusBadgeProps) {
  const { label, className } = CONFIG[statut] ?? CONFIG.nouveau;
  return <span className={`badge ${className}`}>{label}</span>;
}
