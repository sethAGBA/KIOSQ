import { useState, useEffect } from 'react';
import { 
  Building2, Package, Users, ShoppingCart, UserPlus, 
  Check, ArrowRight, ArrowLeft, X, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { onboardingApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface OnboardingWizardProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
}

export default function OnboardingWizard({ isOpen: externalIsOpen, onClose, onComplete }: OnboardingWizardProps) {
  const { user, setUser } = useAuthStore();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const visible = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Form states for steps
  const [companyName, setCompanyName] = useState('');
  const [devise, setDevise] = useState('FCFA');
  const [productDesignation, setProductDesignation] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [colleagueEmail, setColleagueEmail] = useState('');

  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await onboardingApi.getStatus();
        if (data.premiereConnexion) {
          setInternalIsOpen(true);
          setStep(data.onboardingStep > 0 ? Math.min(data.onboardingStep, 5) : 1);
        }
      } catch (err) {
        console.error('Failed to check onboarding status:', err);
      }
    }
    checkStatus();
  }, []);

  const closeWizard = () => {
    setInternalIsOpen(false);
    onClose?.();
  };

  if (!visible) return null;

  const handleStepSubmit = async (nextStep: number) => {
    setLoading(true);
    try {
      await onboardingApi.updateStep(nextStep);
      if (nextStep > 5) {
        toast.success('Configuration initiale terminée ! Bienvenue sur Kiosq.');
        closeWizard();
        if (user) {
          setUser({ ...user, premiereConnexion: false });
        }
        onComplete?.();
      } else {
        setStep(nextStep);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await onboardingApi.ignore();
      toast('Onboarding ignoré. Vous pouvez tout configurer plus tard.', { icon: 'ℹ️' });
      closeWizard();
      if (user) {
        setUser({ ...user, premiereConnexion: false });
      }
      onComplete?.();
    } catch (err: any) {
      toast.error('Erreur lors de la fermeture');
    } finally {
      setLoading(false);
    }
  };

  const stepsInfo = [
    { num: 1, label: 'Boutique', icon: Building2 },
    { num: 2, label: 'Produit', icon: Package },
    { num: 3, label: 'Client', icon: Users },
    { num: 4, label: 'Commande', icon: ShoppingCart },
    { num: 5, label: 'Équipe', icon: UserPlus },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bienvenue sur Kiosq</h2>
              <p className="text-xs text-gray-400">Assistant de configuration initiale (Étape {step} sur 5)</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1"
          >
            Ignorer <X size={14} />
          </button>
        </div>

        {/* Steps Progress Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          {stepsInfo.map((s, idx) => {
            const Icon = s.icon;
            const isDone = s.num < step;
            const isCurrent = s.num === step;
            return (
              <div key={s.num} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  isDone 
                    ? 'bg-amber-600 text-white' 
                    : isCurrent 
                    ? 'bg-gray-900 text-amber-400 ring-2 ring-amber-500/50' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {isDone ? <Check size={14} /> : <Icon size={14} />}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${isCurrent ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                  {s.label}
                </span>
                {idx < stepsInfo.length - 1 && (
                  <div className={`w-6 h-0.5 hidden sm:block ${isDone ? 'bg-amber-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-6 flex-1 min-h-[280px]">
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="text-amber-600" size={24} />
                <h3 className="text-base font-bold text-gray-900">Étape 1 : Informations de la boutique</h3>
              </div>
              <p className="text-xs text-gray-600">
                Personnalisez le nom et la devise de votre boutique pour vos factures et tickets de caisse.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nom de l'entreprise / boutique</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Boutique Elegance"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Devise principale</label>
                  <select
                    value={devise}
                    onChange={(e) => setDevise(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="FCFA">FCFA (Franc CFA)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <Package className="text-amber-600" size={24} />
                <h3 className="text-base font-bold text-gray-900">Étape 2 : Ajoutez votre premier produit</h3>
              </div>
              <p className="text-xs text-gray-600">
                Ajoutez un premier article à votre catalogue pour commencer à vendre immédiatement.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Désignation du produit</label>
                  <input
                    type="text"
                    value={productDesignation}
                    onChange={(e) => setProductDesignation(e.target.value)}
                    placeholder="Ex: Chemise en Soie Bleue"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Prix de vente ({devise})</label>
                  <input
                    type="number"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="Ex: 15000"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-amber-600" size={24} />
                <h3 className="text-base font-bold text-gray-900">Étape 3 : Créez votre premier client</h3>
              </div>
              <p className="text-xs text-gray-600">
                Enregistrez votre premier client pour pouvoir lui attribuer des commandes et des factures.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nom complet du client</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Paul Kouassi"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <ShoppingCart className="text-amber-600" size={24} />
                <h3 className="text-base font-bold text-gray-900">Étape 4 : Découvrir la prise de commande</h3>
              </div>
              <p className="text-xs text-gray-600">
                Votre catalogue et vos clients sont prêts ! Vous pourrez enregistrer vos ventes depuis la section Caisse ou Commandes.
              </p>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-2">
                <p className="font-semibold">💡 Astuce Kiosq :</p>
                <p>La section **Caisse / POS** vous permet d'effectuer des encaissements ultra-rapides au comptoir, avec impression de ticket et gestion multi-règlements.</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-2">
                <UserPlus className="text-amber-600" size={24} />
                <h3 className="text-base font-bold text-gray-900">Étape 5 : Invitez un collaborateur</h3>
              </div>
              <p className="text-xs text-gray-600">
                Ajoutez un collègue pour travailler en équipe sur votre boutique.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse email du collaborateur</label>
                  <input
                    type="email"
                    value={colleagueEmail}
                    onChange={(e) => setColleagueEmail(e.target.value)}
                    placeholder="Ex: collegue@boutique.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1 || loading}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} /> Précédent
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleStepSubmit(step + 1)}
            className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm"
          >
            {step === 5 ? 'Terminer l\'onboarding' : 'Étape suivante'} <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
