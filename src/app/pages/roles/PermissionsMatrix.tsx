import { Link } from 'react-router';
import { ArrowLeft, Download, Shield, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const systemScreens = [
  { id: 'dashboard', name: 'Dashboard', category: 'Overview' },
  { id: 'drivers', name: 'Drivers Management', category: 'Drivers' },
  { id: 'applications', name: 'Applications', category: 'Recruitment' },
  { id: 'documents', name: 'Documents', category: 'Documents' },
  { id: 'document_explorer', name: 'Driver Document Explorer', category: 'Documents' },
  { id: 'workflow', name: 'Workflow Management', category: 'Workflow' },
  { id: 'agencies', name: 'Agencies', category: 'Agencies' },
  { id: 'compliance', name: 'Compliance', category: 'Compliance' },
  { id: 'reports', name: 'Reports', category: 'Reports' },
  { id: 'notifications', name: 'Notifications', category: 'System' },
  { id: 'users', name: 'Users Management', category: 'System' },
  { id: 'roles', name: 'Roles & Permissions', category: 'System' },
  { id: 'settings', name: 'Settings', category: 'System' },
];

const roles = [
  { id: 'R001', name: 'System Admin', color: '#2563EB' },
  { id: 'R002', name: 'HR Manager', color: '#22C55E' },
  { id: 'R003', name: 'Compliance', color: '#F59E0B' },
  { id: 'R004', name: 'Recruiter', color: '#8B5CF6' },
  { id: 'R005', name: 'Agency Mgr', color: '#EC4899' },
  { id: 'R006', name: 'Agency User', color: '#06B6D4' },
];

// Mock permissions data
const mockPermissions: Record<string, Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>> = {
  'R001': Object.fromEntries(systemScreens.map(s => [s.id, { view: true, create: true, edit: true, delete: true }])),
  'R002': {
    dashboard: { view: true, create: false, edit: false, delete: false },
    drivers: { view: true, create: true, edit: true, delete: true },
    applications: { view: true, create: true, edit: true, delete: false },
    documents: { view: true, create: true, edit: true, delete: false },
    document_explorer: { view: true, create: false, edit: false, delete: false },
    workflow: { view: true, create: true, edit: true, delete: false },
    agencies: { view: true, create: false, edit: false, delete: false },
    compliance: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    notifications: { view: true, create: false, edit: false, delete: false },
    users: { view: true, create: true, edit: true, delete: false },
    roles: { view: false, create: false, edit: false, delete: false },
    settings: { view: true, create: false, edit: true, delete: false },
  },
  'R003': {
    dashboard: { view: true, create: false, edit: false, delete: false },
    drivers: { view: true, create: false, edit: false, delete: false },
    applications: { view: true, create: false, edit: false, delete: false },
    documents: { view: true, create: false, edit: false, delete: false },
    document_explorer: { view: true, create: false, edit: false, delete: false },
    workflow: { view: true, create: false, edit: false, delete: false },
    agencies: { view: true, create: false, edit: false, delete: false },
    compliance: { view: true, create: true, edit: true, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    notifications: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    roles: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
  'R004': {
    dashboard: { view: true, create: false, edit: false, delete: false },
    drivers: { view: true, create: true, edit: true, delete: false },
    applications: { view: true, create: true, edit: true, delete: false },
    documents: { view: true, create: true, edit: false, delete: false },
    document_explorer: { view: false, create: false, edit: false, delete: false },
    workflow: { view: true, create: false, edit: true, delete: false },
    agencies: { view: true, create: false, edit: false, delete: false },
    compliance: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    notifications: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    roles: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
  'R005': {
    dashboard: { view: true, create: false, edit: false, delete: false },
    drivers: { view: true, create: true, edit: true, delete: true },
    applications: { view: true, create: true, edit: true, delete: false },
    documents: { view: true, create: true, edit: true, delete: false },
    document_explorer: { view: false, create: false, edit: false, delete: false },
    workflow: { view: true, create: false, edit: false, delete: false },
    agencies: { view: true, create: false, edit: true, delete: false },
    compliance: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    notifications: { view: true, create: false, edit: false, delete: false },
    users: { view: true, create: true, edit: true, delete: true },
    roles: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
  'R006': {
    dashboard: { view: true, create: false, edit: false, delete: false },
    drivers: { view: true, create: true, edit: true, delete: false },
    applications: { view: true, create: true, edit: false, delete: false },
    documents: { view: true, create: true, edit: false, delete: false },
    document_explorer: { view: false, create: false, edit: false, delete: false },
    workflow: { view: true, create: false, edit: false, delete: false },
    agencies: { view: false, create: false, edit: false, delete: false },
    compliance: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    notifications: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    roles: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
};

export function PermissionsMatrix() {
  const groupedScreens = systemScreens.reduce((acc, screen) => {
    if (!acc[screen.category]) {
      acc[screen.category] = [];
    }
    acc[screen.category].push(screen);
    return acc;
  }, {} as Record<string, typeof systemScreens>);

  const renderPermissionIcon = (hasPermission: boolean) => {
    return hasPermission ? (
      <Check className="w-5 h-5 text-[#22C55E]" />
    ) : (
      <X className="w-5 h-5 text-[#E2E8F0]" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/roles">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Permissions Matrix</h1>
          <p className="text-muted-foreground mt-1">Complete overview of all role permissions across the system</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Matrix
        </Button>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Role Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {roles.map(role => (
              <Badge 
                key={role.id} 
                variant="outline" 
                className="px-3 py-1.5"
                style={{ borderColor: role.color, color: role.color }}
              >
                {role.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Permissions Matrix</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            <Check className="w-4 h-4 inline text-[#22C55E]" /> = Permission granted • 
            <X className="w-4 h-4 inline text-[#E2E8F0] ml-2" /> = Permission denied
          </p>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-[#F8FAFC] border-b sticky top-0">
                <tr>
                  <th className="text-left p-4 font-semibold text-sm sticky left-0 bg-[#F8FAFC] z-10 min-w-[250px]">
                    Screen / Module
                  </th>
                  {roles.map(role => (
                    <th key={role.id} colSpan={4} className="text-center p-4 font-semibold text-sm border-l">
                      <Badge variant="outline" style={{ borderColor: role.color, color: role.color }}>
                        {role.name}
                      </Badge>
                      <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground font-normal">
                        <span>V</span>
                        <span>C</span>
                        <span>E</span>
                        <span>D</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedScreens).map(([category, screens]) => (
                  <>
                    <tr key={category} className="bg-[#F8FAFC]">
                      <td colSpan={roles.length * 4 + 1} className="p-3 font-semibold text-sm text-[#64748B]">
                        {category}
                      </td>
                    </tr>
                    {screens.map((screen) => (
                      <tr key={screen.id} className="border-b hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{screen.name}</span>
                          </div>
                        </td>
                        {roles.map(role => {
                          const perms = mockPermissions[role.id]?.[screen.id] || { view: false, create: false, edit: false, delete: false };
                          return (
                            <td key={role.id} colSpan={4} className="border-l">
                              <div className="grid grid-cols-4 gap-0">
                                <div className="flex items-center justify-center p-2 border-r">
                                  {renderPermissionIcon(perms.view)}
                                </div>
                                <div className="flex items-center justify-center p-2 border-r">
                                  {renderPermissionIcon(perms.create)}
                                </div>
                                <div className="flex items-center justify-center p-2 border-r">
                                  {renderPermissionIcon(perms.edit)}
                                </div>
                                <div className="flex items-center justify-center p-2">
                                  {renderPermissionIcon(perms.delete)}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}