/**
 * SuperadminGuard — route guard for `/superadmin` paths.
 *
 * Renders SuperadminLayout (and via <Outlet /> the nested routes) only when
 * the authenticated user has `role === 'superadmin'`.  Any other user
 * (including unauthenticated ones) is redirected to `/login` with location
 * state `{ status: 403 }` so the login page can display an appropriate message.
 *
 * Requirements: 4.1, 4.2
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import SuperadminLayout from '@/pages/superadmin/SuperadminLayout';

export default function SuperadminGuard() {
  const { isAuthenticated, user } = useAuthStore();

  // Not logged in at all — redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ status: 403 }} />;
  }

  // Logged in but not a superadmin — redirect to login with 403 state
  if (user.role !== 'superadmin') {
    return <Navigate to="/login" replace state={{ status: 403 }} />;
  }

  // Render the superadmin layout which contains its own <Outlet />
  return <SuperadminLayout />;
}
