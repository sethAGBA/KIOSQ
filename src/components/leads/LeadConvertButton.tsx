import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLeadsStore } from '@/store/leadsStore';
import type { Client } from '@/types';

interface LeadConvertButtonProps {
  leadId: string;
  clientId: string | null;
  onConverted: (client: Client) => void;
}

export default function LeadConvertButton({ leadId, clientId, onConverted }: LeadConvertButtonProps) {
  const [loading, setLoading] = useState(false);
  const convertirLead = useLeadsStore(s => s.convertirLead);

  const handleConvert = async () => {
    setLoading(true);
    try {
      const client = await convertirLead(leadId);
      toast.success(`Client « ${client.nom} » créé avec succès`);
      onConverted(client);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la conversion';
      toast.error(message);
      // Do not close the detail panel — error shown via toast
    } finally {
      setLoading(false);
    }
  };

  const isConverted = clientId !== null;

  return (
    <button
      onClick={handleConvert}
      disabled={isConverted || loading}
      title={isConverted ? 'Lead déjà converti' : 'Convertir en client'}
      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <UserPlus size={14} />
      {loading ? 'Conversion…' : isConverted ? 'Déjà converti' : 'Convertir en client'}
    </button>
  );
}
