import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppUser } from '@/types';
import { authApi, USE_API } from '@/lib/api';
import { mockUsers } from '@/data/mock';



interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  setUser: (user: AppUser) => void;
  updateProfile: (profile: { nom: string; prenom: string; email: string; telephone?: string | null; avatar?: string | null }) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        if (USE_API) {
          // Real API login
          const data = await authApi.login(email, password);
          if (data.token) {
            localStorage.setItem('kiosq_jwt', data.token);
          }
          const user: AppUser = {
            id:        data.id,
            email:     data.email,
            nom:       data.nom,
            prenom:    data.prenom,
            role:      data.role as AppUser['role'],
            actif:     data.actif,
            telephone: data.telephone,
            avatar:    data.avatar,
            createdAt: new Date(),
            tenantId:  data.tenantId,
          };
          set({ user, isAuthenticated: true });
        } else {
          // Mock login — no API needed
          await new Promise((r) => setTimeout(r, 500));
          const found = mockUsers.find((u) => u.email === email && u.actif);
          if (!found || password !== 'demo1234') {
            throw new Error('Email ou mot de passe incorrect');
          }
          set({ user: found, isAuthenticated: true });
        }
      },

      logout: async () => {
        localStorage.removeItem('kiosq_jwt');
        if (USE_API) {
          try { await authApi.logout(); } catch { /* ignore */ }
        }
        set({ user: null, isAuthenticated: false });
      },

      setUser: (user: AppUser) => {
        set({ user });
      },

      refreshMe: async () => {
        if (!USE_API) return;
        try {
          const data = await authApi.me();
          const user: AppUser = {
            id:        data.id,
            email:     data.email,
            nom:       data.nom,
            prenom:    data.prenom,
            role:      data.role as AppUser['role'],
            actif:     data.actif,
            telephone: data.telephone,
            avatar:    data.avatar,
            createdAt: new Date(),
            tenantId:  data.tenantId,
          };
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      updateProfile: async (profile) => {
        if (USE_API) {
          const data = await authApi.updateProfile(profile);
          const user: AppUser = {
            id:        data.id,
            email:     data.email,
            nom:       data.nom,
            prenom:    data.prenom,
            role:      data.role as AppUser['role'],
            telephone: data.telephone,
            avatar:    data.avatar,
            actif:     data.actif,
            createdAt: new Date(),
            tenantId:  data.tenantId,
          };
          set({ user });
        } else {
          // Mock profile update
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            const updated = {
              ...currentUser,
              ...profile,
            };
            set({ user: updated });
          }
        }
      },
    }),
    {
      name: 'kiosq-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);

// Expose the store on globalThis to avoid circular dependency when resolving tenant
(globalThis as any).__authStoreModule = { useAuthStore };
