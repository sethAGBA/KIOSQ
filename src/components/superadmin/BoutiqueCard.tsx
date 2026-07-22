/**
 * BoutiqueCard — summary card for a single tenant in the superadmin list.
 * Shows: name, plan (PlanBadge), status, creation date, user count, total revenue.
 */

import { Users, Calendar, TrendingUp, ChevronRight } from 'lucide-react';
import { type TenantListItem } from '@/lib/api';
import PlanBadge from './PlanBadge';

export type { TenantListItem };

interface BoutiqueCardProps {
  boutique: TenantListItem;
  onClick: (id: string) => void;
}

const STATUT_CONFIG = {
  actif: {
    label: 'Actif',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  essai: {
    label: 'Essai',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  suspendu: {
    label: 'Suspendu',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCA(amount: number, devise: string): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' ' + devise;
}

export default function BoutiqueCard({ boutique, onClick }: BoutiqueCardProps) {
  const statut = STATUT_CONFIG[boutique.statut];

  return (
    <button
      type="button"
      onClick={() => onClick(boutique.id)}
      className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-gray-200 hover:shadow-md transition-all duration-150 group"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 truncate">{boutique.nom}</span>
            <PlanBadge plan={boutique.plan} />
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statut.className}`}
            >
              {statut.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">/{boutique.slug}</p>
        </div>

        {/* Right: chevron */}
        <ChevronRight
          size={18}
          className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5 transition-colors"
        />
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar size={13} className="text-gray-400 shrink-0" />
          <span>{formatDate(boutique.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Users size={13} className="text-gray-400 shrink-0" />
          <span>
            {boutique.nbUtilisateurs}{' '}
            {boutique.nbUtilisateurs === 1 ? 'utilisateur' : 'utilisateurs'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 justify-end">
          <TrendingUp size={13} className="text-gray-400 shrink-0" />
          <span>{formatCA(boutique.caTotal, boutique.devise)}</span>
        </div>
      </div>
    </button>
  );
}
