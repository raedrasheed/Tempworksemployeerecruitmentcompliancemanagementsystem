import { getCurrentUser } from '../services/api';

/**
 * Provides permission helpers based on the current user's permissions array.
 * Permissions are stored as "module:action" strings (e.g. "employees:create").
 * System Admins bypass all permission checks.
 */
export function usePermissions() {
  const user = getCurrentUser();
  const permissions = user?.permissions ?? [];
  const isAdmin = user?.role === 'System Admin';

  const can = (module: string, action: string): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    return permissions.includes(`${module}:${action}`);
  };

  return {
    canView: (module: string) => can(module, 'read'),
    canCreate: (module: string) => can(module, 'create'),
    canEdit: (module: string) => can(module, 'update'),
    canDelete: (module: string) => can(module, 'delete'),
    can,
  };
}
