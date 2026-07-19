import { useEffect, useRef } from 'react';
import { X, Bell, Package, FileText, ShoppingCart, Info, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/lib/format';

const typeIcon = {
  alerte_stock: Package,
  facture_due: FileText,
  commande: ShoppingCart,
  info: Info,
};

const typeColor: Record<string, string> = {
  alerte_stock: '#ef4444',
  facture_due: '#d97706',
  commande: '#2563eb',
  info: 'var(--color-gold)',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDrawer({ isOpen, onClose }: Props) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useAppStore();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const unread = notifications.filter((n) => !n.lu).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/20 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Drawer */}
      <div
        ref={ref}
        className={clsx(
          'fixed top-0 right-0 h-full w-80 bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-cream-dark)' }}
        >
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: 'var(--color-gold)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
              Notifications
            </h3>
            {unread > 0 && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: '#ef4444' }}
              >
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'var(--color-gold)' }}
              >
                <CheckCheck size={13} /> Tout lire
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ colorScheme: 'light' }}>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: 'var(--color-ink-muted)' }}>
              <Bell size={28} />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = typeIcon[n.type] ?? Info;
              return (
                <button
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={clsx(
                    'w-full text-left flex items-start gap-3 px-5 py-4 border-b transition-colors',
                    !n.lu ? 'bg-amber-50/50' : 'bg-white hover:bg-gray-50'
                  )}
                  style={{ borderColor: 'var(--color-cream-dark)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${typeColor[n.type]}15`, color: typeColor[n.type] }}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-xs font-semibold leading-tight"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {n.titre}
                      </p>
                      {!n.lu && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                      {n.message}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)', opacity: 0.7 }}>
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
