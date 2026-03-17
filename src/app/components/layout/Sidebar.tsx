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
  Briefcase
} from 'lucide-react';
import { cn } from '../ui/utils';

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
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

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col">
      <div className="p-6 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">
              TempWorks Europe
            </h1>
            <p className="text-xs text-muted-foreground">Recruitment Platform</p>
          </div>
        </div>
      </div>
      
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
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isActive 
                      ? "bg-[#2563EB] text-white" 
                      : "text-[#0F172A] hover:bg-[#F1F5F9]"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-[#E2E8F0]">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC]">
          <img 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" 
            alt="User" 
            className="w-8 h-8 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A] truncate">Sarah Johnson</p>
            <p className="text-xs text-muted-foreground truncate">HR Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
}