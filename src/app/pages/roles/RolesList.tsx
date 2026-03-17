import { Link } from 'react-router';
import { Plus, Edit, Trash2, Shield, Users, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: {
    view: number;
    create: number;
    edit: number;
    delete: number;
  };
  isSystem: boolean;
  createdDate: string;
}

const mockRoles: Role[] = [
  {
    id: 'R001',
    name: 'System Administrator',
    description: 'Full system access with all permissions',
    userCount: 2,
    permissions: { view: 13, create: 13, edit: 13, delete: 13 },
    isSystem: true,
    createdDate: '2024-01-01',
  },
  {
    id: 'R002',
    name: 'HR Manager',
    description: 'Manage drivers, applications, and documents',
    userCount: 5,
    permissions: { view: 11, create: 8, edit: 8, delete: 5 },
    isSystem: false,
    createdDate: '2024-01-15',
  },
  {
    id: 'R003',
    name: 'Compliance Officer',
    description: 'View and manage compliance-related data',
    userCount: 3,
    permissions: { view: 9, create: 4, edit: 4, delete: 2 },
    isSystem: false,
    createdDate: '2024-01-20',
  },
  {
    id: 'R004',
    name: 'Internal Recruiter',
    description: 'Manage driver applications and workflow',
    userCount: 8,
    permissions: { view: 8, create: 5, edit: 5, delete: 3 },
    isSystem: false,
    createdDate: '2024-02-01',
  },
  {
    id: 'R005',
    name: 'Agency Manager',
    description: 'Manage agency drivers and users',
    userCount: 12,
    permissions: { view: 6, create: 4, edit: 4, delete: 2 },
    isSystem: false,
    createdDate: '2024-02-10',
  },
  {
    id: 'R006',
    name: 'Agency User',
    description: 'View and manage own agency drivers',
    userCount: 24,
    permissions: { view: 5, create: 3, edit: 3, delete: 1 },
    isSystem: false,
    createdDate: '2024-02-15',
  },
  {
    id: 'R007',
    name: 'Finance',
    description: 'Access to financial reports and data',
    userCount: 2,
    permissions: { view: 4, create: 1, edit: 1, delete: 0 },
    isSystem: false,
    createdDate: '2024-03-01',
  },
  {
    id: 'R008',
    name: 'Read Only',
    description: 'View-only access to selected modules',
    userCount: 6,
    permissions: { view: 7, create: 0, edit: 0, delete: 0 },
    isSystem: false,
    createdDate: '2024-03-05',
  },
];

export function RolesList() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Manage system roles and access control</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/dashboard/roles/permissions-matrix">
              <Lock className="w-4 h-4 mr-2" />
              Permissions Matrix
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/roles/create">
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Link>
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{mockRoles.length}</p>
                <p className="text-sm text-muted-foreground">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {mockRoles.reduce((sum, role) => sum + role.userCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {mockRoles.filter(r => r.isSystem).length}
                </p>
                <p className="text-sm text-muted-foreground">System Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {mockRoles.filter(r => !r.isSystem).length}
                </p>
                <p className="text-sm text-muted-foreground">Custom Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockRoles.map((role) => (
              <div 
                key={role.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-[#2563EB]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[#0F172A]">{role.name}</h3>
                      {role.isSystem && (
                        <Badge variant="outline" className="bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]">
                          System Role
                        </Badge>
                      )}
                      <Badge variant="outline">
                        <Users className="w-3 h-3 mr-1" />
                        {role.userCount} users
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">View</p>
                        <p className="font-medium">{role.permissions.view} screens</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Create</p>
                        <p className="font-medium">{role.permissions.create} screens</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Edit</p>
                        <p className="font-medium">{role.permissions.edit} screens</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Delete</p>
                        <p className="font-medium">{role.permissions.delete} screens</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/dashboard/roles/${role.id}/edit`}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  {!role.isSystem && (
                    <Button size="sm" variant="ghost">
                      <Trash2 className="w-4 h-4 text-[#EF4444]" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}