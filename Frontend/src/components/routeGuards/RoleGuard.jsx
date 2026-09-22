import { useAuth } from '@/context/authContext';
import { Navigate, useLocation } from 'react-router-dom';
import AccessDenied from '@/pages/AccessDenied';

/**
 * RoleGuard — protects a route based on the user's backend-verified role.
 *
 * Props:
 *   allowedRoles — array of role strings the route accepts, e.g.
 *     ['admin']            → only admins
 *     ['delivery']         → only delivery partners
 *     ['customer','admin'] → customers AND admins
 *
 * Behaviour:
 *   1. While authLoading is true (JWT still being verified) → renders nothing
 *      (prevents flash of protected content or premature redirects).
 *   2. If user is null (not authenticated) → redirects to /login.
 *   3. If user.role is not in allowedRoles → renders AccessDenied page
 *      (shows current role, never exposes other users' data).
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

  // Not signed in at all
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but wrong role
  if (!allowedRoles.includes(user.role)) {
    return <AccessDenied />;
  }

  return children;
}

export default RoleGuard;
