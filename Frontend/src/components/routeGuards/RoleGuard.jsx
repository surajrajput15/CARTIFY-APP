import { useAuth } from '@/context/authContext';
import { Navigate, useLocation } from 'react-router-dom';
import AccessDenied from '@/pages/AccessDenied';
import { saveLoginRedirect } from '@/utils/navigation';

/**
 * RoleGuard — protects a route based on the user's backend-verified role.
 *
 * Props:
 *   allowedRoles — array of role strings the route accepts, e.g.
 *     ['admin']            → only admins
 *     ['delivery']         → only delivery partners
 *     ['customer','admin'] → customers AND admins
 *     (omitted)            → any signed-in user (authenticated-only guard)
 *
 * Behaviour:
 *   1. While authLoading is true (JWT still being verified) → renders nothing
 *      (prevents flash of protected content or premature redirects).
 *   2. If user is null (not authenticated) → records the current path in
 *      sessionStorage 'redirectAfterLogin' (LoginPage honours it) and
 *      redirects to /login.
 *   3. If allowedRoles is set and user.role is not in it → renders
 *      AccessDenied page (shows current role, never exposes other users' data).
 *
 * IMPORTANT — trust boundary:
 *   user.role and user.isAdmin come exclusively from the JWT-decoded server
 *   response (/api/auth/me), stored in localStorage via AuthContext.login().
 *   They are NEVER accepted from any client-side prop, query param, or storage
 *   that bypasses the server. If you add a new source of user data, update
 *   AuthContext first.
 */
function RoleGuard({ allowedRoles, children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return null;

  // Not signed in at all — F-14/F-15: remember where the user was so login
  // can return them there (LoginPage reads sessionStorage, not router state).
  if (!user) {
    saveLoginRedirect(location.pathname + location.search);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but wrong role (only enforced when roles are specified)
  if (allowedRoles) {
    const isAdminRoute = allowedRoles.includes('admin');
    const isUserAdmin = Boolean(user.isAdmin || user.role === 'admin' || user.role === 'super_admin');
    const isAllowed = allowedRoles.includes(user.role) || (isAdminRoute && isUserAdmin);
    if (!isAllowed) {
      return <AccessDenied />;
    }
  }

  return children;
}

export default RoleGuard;
