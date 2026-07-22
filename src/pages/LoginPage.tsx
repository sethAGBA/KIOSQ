import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('admin@kiosq.com');
  const [password, setPassword] = useState('demo1234');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'superadmin') {
        navigate('/superadmin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-cream)' }}
    >
      {/* Card */}
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden"
            style={{ backgroundColor: '#111' }}
          >
            <img src="/icon.png" alt="Kiosq Logo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            Kiosq
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-ink-muted)' }}>
            Gestion commerciale
          </p>
        </div>

        <div className="card p-8 shadow-lg">
          <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-ink)' }}>
            Connexion
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="label">Adresse e-mail</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center py-2.5 text-base mt-2"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Connexion…</>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div
            className="mt-5 p-3 rounded-lg text-xs"
            style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
          >
            <p className="font-semibold mb-1">Comptes de démonstration</p>
            <p>admin@kiosq.com · demo1234</p>
            <p>commercial@kiosq.com · demo1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
