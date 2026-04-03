import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  GitBranch,
  Layers,
  Building2,
  BarChart3,
  Bell,
  UserCog,
  Settings,
  Shield,
  FileSearch,
  Activity,
  Briefcase,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Megaphone,
  Trash2,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { useAuthContext } from '../../contexts/AuthContext';

// Each nav item declares which permission (module:read) is required to see it.
// null means always visible to any authenticated user.
const allNavigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard',             path: '/dashboard',                  permission: null },
  { icon: UserCheck,       label: 'Applicants',            path: '/dashboard/applicants',       permission: 'applicants:read' },
  { icon: Users,           label: 'Employees',             path: '/dashboard/employees',        permission: 'employees:read' },
  { icon: FolderOpen,      label: 'Documents & Compliance',path: '/dashboard/documents-compliance', permission: 'documents:read' },
  { icon: FileSearch,      label: 'Document Explorer',     path: '/dashboard/document-explorer',permission: 'documents:read' },
  { icon: Layers,          label: 'Workflows',             path: '/dashboard/pipelines',        permission: 'workflow:read' },
  { icon: GitBranch,       label: 'Workflow',              path: '/dashboard/workflow',         permission: 'workflow:read' },
  { icon: Building2,       label: 'Agencies',              path: '/dashboard/agencies',         permission: 'agencies:read' },
  { icon: BarChart3,       label: 'Reports',               path: '/dashboard/reports',          permission: 'reports:read' },
  { icon: DollarSign,     label: 'Finance',               path: '/dashboard/finance',          permission: 'finance:read', roles: ['System Admin', 'HR Manager', 'Finance'] },
  { icon: Megaphone,      label: 'Job Ads',               path: '/dashboard/job-ads',          permission: 'job-ads:read', roles: ['System Admin', 'HR Manager', 'Recruiter'] },
  { icon: Bell,            label: 'Notifications',         path: '/dashboard/notifications',    permission: 'notifications:read' },
  { icon: UserCog,         label: 'Users',                 path: '/dashboard/users',            permission: 'users:read' },
  { icon: Shield,          label: 'Roles & Permissions',   path: '/dashboard/roles',            permission: 'roles:read' },
  { icon: Activity,        label: 'System Logs',           path: '/dashboard/logs',             permission: 'logs:read' },
  { icon: Trash2,          label: 'Deleted Records',       path: '/dashboard/recycle-bin',      permission: 'logs:read', roles: ['System Admin', 'HR Manager', 'Compliance Officer'] },
  { icon: Settings,        label: 'Settings',              path: '/dashboard/settings',         permission: 'settings:read' },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuthContext();
  const userRole = user?.role ?? '';
  const permissions = user?.permissions ?? [];
  const isAdmin = userRole === 'System Admin';

  const navigationItems = allNavigationItems.filter((item: any) => {
    if (!item.permission) return true; // always visible
    if (isAdmin) return true;          // admins see everything
    if (item.roles && item.roles.includes(userRole)) return true; // role-based visibility
    return permissions.includes(item.permission);
  });

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-sidebar-border">
        <div className={cn(
          "flex items-center gap-3 mb-2",
          isCollapsed && "justify-center"
        )}>
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-6 h-6 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">
                TempWorks Europe
              </h1>
              <p className="text-xs text-muted-foreground">Recruitment Platform</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path ||
                           (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative group",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isCollapsed && "justify-center"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="text-sm">{item.label}</span>}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-popover text-popover-foreground border border-border text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.label}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-popover rotate-45 border-l border-b border-border" />
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent",
          isCollapsed && "justify-center"
        )}>
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.firstName ?? 'User'}`}
            alt="User"
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user ? `${user.firstName} ${user.lastName}` : 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{userRole || 'Guest'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors shadow-sm z-10"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}