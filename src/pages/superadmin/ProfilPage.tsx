import { useState, useEffect } from 'react';
import { Lock, User, Mail, Phone, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { authApi, USE_API } from '@/lib/api';

export default function ProfilPage() {
  const { user, updateProfile } = useAuthStore();

  // Profile fields state
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Initialize fields
  useEffect(() => {
    if (user) {
      setNom(user.nom || '');
      setPrenom(user.prenom || '');
      setEmail(user.email || '');
      setTelephone(user.telephone || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await updateProfile({
        nom,
        prenom,
        email,
        telephone: telephone || null,
        avatar: avatar || null,
      });
      toast.success('Profil mis à jour avec succès');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Le nouveau mot de passe doit faire au moins 6 caractères');
      return;
    }
    setPasswordLoading(true);
    try {
      if (USE_API) {
        await authApi.updatePassword(currentPassword, newPassword);
      } else {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      toast.success('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Get initials for fallback avatar
  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Mon Profil</h1>
        <p className="text-sm text-gray-500">Gérez vos informations personnelles et la sécurité de votre compte Superadmin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-50">
            <User size={18} className="text-[#e94560]" />
            <h2 className="font-semibold text-gray-800 text-lg">Informations personnelles</h2>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Avatar Preview & URL Input */}
            <div className="flex flex-col sm:flex-row items-center gap-5 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <div className="relative group shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Avatar Preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${initials}`;
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#e94560]/10 text-[#e94560] font-bold text-2xl flex items-center justify-center border-2 border-white shadow-md">
                    {initials || '?'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={18} className="text-white" />
                </div>
              </div>

              <div className="flex-1 w-full space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  URL de la photo de profil (ex: https://...)
                </label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                  value={avatar}
                  onChange={e => setAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Prénom
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                  value={prenom}
                  onChange={e => setPrenom(e.target.value)}
                  placeholder="John"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nom
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="john.doe@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Téléphone
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                    value={telephone}
                    onChange={e => setTelephone(e.target.value)}
                    placeholder="+228 90 00 00 00"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={profileLoading}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#e94560] hover:bg-[#e94560]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileLoading ? 'Enregistrement en cours…' : 'Sauvegarder les modifications'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Password Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-50">
            <Lock size={18} className="text-[#e94560]" />
            <h2 className="font-semibold text-gray-800 text-lg">Sécurité</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Mot de passe actuel
              </label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#e94560] focus:border-[#e94560]"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le nouveau mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all bg-[#e94560] hover:bg-[#e94560]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {passwordLoading ? 'Mise à jour en cours…' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
