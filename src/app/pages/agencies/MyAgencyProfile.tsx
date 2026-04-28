/**
 * "Agency Profile" entry from the user menu. Redirects the signed-in
 * user to their own agency profile so the URL for self-service stays
 * stable as /dashboard/my-agency.
 *
 * Users without an agency attachment (e.g. some admin accounts) see
 * a friendly notice instead of a redirect loop.
 */
import { Navigate } from 'react-router';
import { getCurrentUser } from '../../services/api';

export function MyAgencyProfile() {
  const agencyId = getCurrentUser()?.agencyId;

  if (!agencyId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-[#0F172A]">Agency Profile</h1>
        <p className="text-muted-foreground mt-2">
          Your account is not attached to any agency.
        </p>
      </div>
    );
  }

  return <Navigate to={`/dashboard/agencies/${agencyId}`} replace />;
}
