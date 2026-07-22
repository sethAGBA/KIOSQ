import { useState, useEffect } from 'react';
import { ShieldAlert, Filter, ChevronLeft, ChevronRight, RefreshCw, Calendar, User, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { auditApi } from '@/lib/api';
import type { AuditLogEntry, AuditLogsResponse } from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const fetchLogs = async (p = page) => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        page: p,
        action: selectedAction || undefined,
        userId: selectedUser || undefined,
        dateDebut: dateDebut || undefined,
        dateFin: dateFin || undefined,
      });
      setLogs(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      toast.error('Erreur lors du chargement des journaux d\'audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [selectedAction, selectedUser, dateDebut, dateFin]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchLogs(newPage);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="text-amber-600" size={26} />
            Journal d'Audit et Traçabilité
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Historique complet des actions effectuées sur la boutique ({total} événements enregistrés).
          </p>
        </div>
        <button
          onClick={() => fetchLogs(page)}
          className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5 self-start md:self-auto transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <Activity size={12} /> Action
          </label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Toutes les actions</option>
            <option value="facture.created">Création de facture</option>
            <option value="facture.updated">Modification de facture</option>
            <option value="facture.deleted">Suppression de facture</option>
            <option value="produit.created">Création de produit</option>
            <option value="produit.deleted">Suppression de produit</option>
            <option value="user.login">Connexion utilisateur</option>
            <option value="user.logout">Déconnexion utilisateur</option>
            <option value="impersonation.start">Début d'impersonation</option>
            <option value="impersonation.end">Fin d'impersonation</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <Calendar size={12} /> Date Début
          </label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <Calendar size={12} /> Date Fin
          </label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              setSelectedAction('');
              setSelectedUser('');
              setDateDebut('');
              setDateFin('');
            }}
            className="w-full py-1.5 text-xs text-amber-600 font-semibold hover:underline text-center"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-500">Chargement du journal d'audit...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">Aucun journal d'audit trouvé pour ces critères.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                  <th className="py-3 px-4">Horodatage</th>
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Type de Ressource</th>
                  <th className="py-3 px-4">Adresse IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {log.userName || log.userEmail || log.userId || 'Système'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700 capitalize">
                      {log.resourceType} {log.resourceId ? `(${log.resourceId})` : ''}
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page {page} sur {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
