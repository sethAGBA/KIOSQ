/**
 * PlanBadge — colored badge for tenant plan levels.
 * starter = gray, pro = blue, enterprise = gold
 */

interface PlanBadgeProps {
  plan: 'starter' | 'pro' | 'enterprise';
  size?: 'sm' | 'md';
}

const PLAN_CONFIG = {
  starter: {
    label: 'Starter',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  pro: {
    label: 'Pro',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  enterprise: {
    label: 'Enterprise',
    className: 'bg-amber-50 text-amber-700 border border-amber-300',
  },
} as const;

export default function PlanBadge({ plan, size = 'sm' }: PlanBadgeProps) {
  const config = PLAN_CONFIG[plan];
  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${config.className}`}
    >
      {config.label}
    </span>
  );
}
