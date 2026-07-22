import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Crosshair } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useLeadsStore } from '@/store/leadsStore';
import LeadsFilters from '@/components/leads/LeadsFilters';
import LeadsTable from '@/components/leads/LeadsTable';
import GroupesSurveillésTable from '@/components/leads/GroupesSurveillésTable';
import GroupeFormModal from '@/components/leads/GroupeFormModal';
import { Pagination } from '@/components/ui/Pagination';
import type { GroupeSurveille } from '@/types';

export default function LeadsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const {
    leads,
    total,
    page,
    limit,
    filters,
    loading,
    groupes,
    groupesLoading,
    fetchLeads,
    setPage,
    fetchGroupes,
    deleteGroupe,
  } = useLeadsStore();

  const [activeTab, setActiveTab] = useState<'leads' | 'groupes'>('leads');
  const [showGroupeModal, setShowGroupeModal] = useState(false);
  const [editingGroupe, setEditingGroupe] = useState<GroupeSurveille | undefined>();

  useEffect(() => {
    fetchLeads().catch(err => {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du chargement des leads');
    });
    if (isAdmin) fetchGroupes();
  }, [fetchLeads, fetchGroupes, isAdmin]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const leadsCountByGroupe = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      counts[lead.groupeSurveilleId] = (counts[lead.groupeSurveilleId] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  const handleFilterChange = (newFilters: Parameters<typeof fetchLeads>[0]) => {
    useLeadsStore.setState({ page: 1 });
    fetchLeads(newFilters).catch(err => {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du filtrage');
    });
  };

  const handleDeleteGroupe = async (id: string) => {
    await deleteGroupe(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crosshair size={20} style={{ color: 'var(--color-gold)' }} />
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              Capture de Leads
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
            Intentions d&apos;achat détectées dans les groupes Facebook surveillés
          </p>
        </div>

        {isAdmin && activeTab === 'groupes' && (
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => { setEditingGroupe(undefined); setShowGroupeModal(true); }}
          >
            <Plus size={16} />
            Ajouter
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'leads' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
          )}
          style={{ color: activeTab === 'leads' ? 'var(--color-ink)' : 'var(--color-ink-muted)' }}
        >
          Leads
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('groupes')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'groupes' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
            )}
            style={{ color: activeTab === 'groupes' ? 'var(--color-ink)' : 'var(--color-ink-muted)' }}
          >
            Groupes surveillés
          </button>
        )}
      </div>

      {activeTab === 'leads' ? (
        <>
          <LeadsFilters filters={filters} onChange={handleFilterChange} />
          <LeadsTable
            leads={leads}
            loading={loading}
            onLeadClick={lead => navigate(`/leads/${lead.id}`)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={limit}
            onPageChange={setPage}
          />
        </>
      ) : (
        <GroupesSurveillésTable
          groupes={groupes}
          loading={groupesLoading}
          leadsCountByGroupe={leadsCountByGroupe}
          onEdit={groupe => { setEditingGroupe(groupe); setShowGroupeModal(true); }}
          onDelete={handleDeleteGroupe}
        />
      )}

      {showGroupeModal && (
        <GroupeFormModal
          groupe={editingGroupe}
          onSave={() => fetchGroupes()}
          onClose={() => { setShowGroupeModal(false); setEditingGroupe(undefined); }}
        />
      )}
    </div>
  );
}
