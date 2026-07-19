import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import AppLayout from '@/components/layout/AppLayout';

export default function AuthGuard() {
  const { isAuthenticated, refreshMe } = useAuthStore();
  const { fetchAll } = useAppStore();

  useEffect(() => {
    if (isAuthenticated) {
      // Refresh JWT session silently, then load all data
      refreshMe().catch(() => {});
      fetchAll().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
