import { Link, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  FolderOpen, 
  GitBranch, 
  Building2, 
  ShieldCheck, 
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
  ChevronRight
} from 'lucide-react';
import { cn } from '../ui/utils';

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: UserCheck, label: 'Applicants', path: '/dashboard/applicants' },
  { icon: Users, label: 'Employees', path: '/dashboard/employees' },
  { icon: FileText, label: 'Applications', path: '/dashboard/applications' },
  { icon: FolderOpen, label: 'Documents & Compliance', path: '/dashboard/documents-compliance' },
  { icon: FileSearch, label: 'Document Explorer', path: '/dashboard/document-explorer' },
  { icon: GitBranch, label: 'Workflow Pipeline', path: '/dashboard/workflow' },
  { icon: Building2, label: 'Agencies', path: '/dashboard/agencies' },
  { icon: BarChart3, label: 'Reports', path: '/dashboard/reports' },
  { icon: Bell, label: 'Notifications', path: '/dashboard/notifications' },
  { icon: UserCog, label: 'Users', path: '/dashboard/users' },
  { icon: Shield, label: 'Roles & Permissions', path: '/dashboard/roles' },
  { icon: Activity, label: 'System Logs', path: '/dashboard/logs' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <aside 
      className={cn(
        "bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-[#E2E8F0]">
        <div className={cn(
          "flex items-center gap-3 mb-2",
          isCollapsed && "justify-center"
        )}>
          <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">
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
                      ? "bg-[#2563EB] text-white" 
                      : "text-[#0F172A] hover:bg-[#F1F5F9]",
                    isCollapsed && "justify-center"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-[#0F172A] text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.label}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#0F172A] rotate-45" />
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* User Section */}
      <div className="p-4 border-t border-[#E2E8F0]">
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC]",
          isCollapsed && "justify-center"
        )}>
          <img 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" 
            alt="User" 
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A] truncate">Sarah Johnson</p>
              <p className="text-xs text-muted-foreground truncate">HR Manager</p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#2563EB] hover:border-[#2563EB] transition-colors shadow-sm z-10"
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