import { useState, useEffect } from 'react';
import { Lock, User, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { authApi, USE_API } from '@/lib/api';

export default function ProfilPage() {
  const { user, updateProfile } = useAuthStore();

  // Profile fields
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setNom(user.nom || '');
      setPrenom(user.prenom || '');
      setEmail(user.email || '');
      setTelephone(user.telephone || '');
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
        avatar: user?.avatar ?? null,
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

  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-ink)' }}>
          Mon Profil
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
          Gérez vos informations personnelles et la sécurité de votre compte
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Profile form */}
        <div className="lg:col-span-2 card space-y-6">
          <div
            className="flex items-center gap-2 pb-4"
            style={{ borderBottom: '1px solid var(--color-cream-dark)' }}
          >
            <User size={18} style={{ color: 'var(--color-gold)' }} />
            <h2 className="font-semibold text-lg" style={{ color: 'var(--color-ink)' }}>
              Informations personnelles
            </h2>
          </div>

          {/* Avatar initials */}
          <div
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-xl font-bold"
              style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
            >
              {initials || '?'}
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--color-ink)' }}>
                {prenom} {nom}
              </p>
              <p className="text-sm capitalize" style={{ color: 'var(--color-ink-muted)' }}>
                {user?.role}
              </p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Prénom</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={prenom}
                  onChange={e => setPrenom(e.target.value)}
                  placeholder="John"
                />
              </div>

              <div>
                <label className="label">Nom</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Doe"
                />
              </div>

              <div>
                <label className="label">Adresse e-mail</label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-ink-muted)' }}
                  />
                  <input
                    type="email"
                    required
                    className="input"
                    style={{ paddingLeft: '2.25rem' }}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="john.doe@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="label">Téléphone</label>
                <div className="relative">
                  <Phone
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-ink-muted)' }}
                  />
                  <input
                    type="tel"
                    className="input"
                    style={{ paddingLeft: '2.25rem' }}
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
                className="btn-primary"
              >
                {profileLoading ? 'Enregistrement…' : 'Sauvegarder les modifications'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Password form */}
        <div className="card space-y-6">
          <div
            className="flex items-center gap-2 pb-4"
            style={{ borderBottom: '1px solid var(--color-cream-dark)' }}
          >
            <Lock size={18} style={{ color: 'var(--color-gold)' }} />
            <h2 className="font-semibold text-lg" style={{ color: 'var(--color-ink)' }}>
              Sécurité
            </h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="label">Mot de passe actuel</label>
              <input
                type="password"
                required
                className="input"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="label">Nouveau mot de passe</label>
              <input
                type="password"
                required
                className="input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                minLength={6}
              />
            </div>

            <div>
              <label className="label">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                required
                className="input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le nouveau mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {passwordLoading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
