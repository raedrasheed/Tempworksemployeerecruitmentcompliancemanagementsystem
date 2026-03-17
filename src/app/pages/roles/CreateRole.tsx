import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';

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

interface ScreenPermissions {
  [screenId: string]: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export function CreateRole() {
  const navigate = useNavigate();
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<ScreenPermissions>(() => {
    const initial: ScreenPermissions = {};
    systemScreens.forEach(screen => {
      initial[screen.id] = { view: false, create: false, edit: false, delete: false };
    });
    return initial;
  });

  const handlePermissionChange = (screenId: string, permission: 'view' | 'create' | 'edit' | 'delete', checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [screenId]: {
        ...prev[screenId],
        [permission]: checked
      }
    }));
  };

  const handleSelectAll = (permission: 'view' | 'create' | 'edit' | 'delete') => {
    const newPermissions = { ...permissions };
    const allChecked = systemScreens.every(screen => permissions[screen.id][permission]);
    
    systemScreens.forEach(screen => {
      newPermissions[screen.id] = {
        ...newPermissions[screen.id],
        [permission]: !allChecked
      };
    });
    
    setPermissions(newPermissions);
  };

  const handleSave = () => {
    alert(`Role "${roleName}" created successfully`);
    navigate('/dashboard/roles');
  };

  const groupedScreens = systemScreens.reduce((acc, screen) => {
    if (!acc[screen.category]) {
      acc[screen.category] = [];
    }
    acc[screen.category].push(screen);
    return acc;
  }, {} as Record<string, typeof systemScreens>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/roles">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Create New Role</h1>
          <p className="text-muted-foreground mt-1">Define a new role with custom permissions</p>
        </div>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Role Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Role Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="roleName">Role Name</Label>
            <Input
              id="roleName"
              placeholder="e.g., Regional Manager"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Brief description of this role"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select permissions for each system screen
          </p>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-sm w-1/3">Screen / Module</th>
                  <th className="text-center p-4 font-semibold text-sm w-1/6">
                    <div className="flex flex-col items-center gap-2">
                      <span>View</span>
                      <Checkbox
                        onCheckedChange={() => handleSelectAll('view')}
                        className="cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="text-center p-4 font-semibold text-sm w-1/6">
                    <div className="flex flex-col items-center gap-2">
                      <span>Create</span>
                      <Checkbox
                        onCheckedChange={() => handleSelectAll('create')}
                        className="cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="text-center p-4 font-semibold text-sm w-1/6">
                    <div className="flex flex-col items-center gap-2">
                      <span>Edit</span>
                      <Checkbox
                        onCheckedChange={() => handleSelectAll('edit')}
                        className="cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="text-center p-4 font-semibold text-sm w-1/6">
                    <div className="flex flex-col items-center gap-2">
                      <span>Delete</span>
                      <Checkbox
                        onCheckedChange={() => handleSelectAll('delete')}
                        className="cursor-pointer"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedScreens).flatMap(([category, screens]) => [
                  <tr key={`category-${category}`} className="bg-[#F8FAFC]">
                    <td colSpan={5} className="p-3 font-semibold text-sm text-[#64748B]">
                      {category}
                    </td>
                  </tr>,
                  ...screens.map((screen) => (
                    <tr key={screen.id} className="border-b hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{screen.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Checkbox
                          checked={permissions[screen.id].view}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(screen.id, 'view', checked as boolean)
                          }
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Checkbox
                          checked={permissions[screen.id].create}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(screen.id, 'create', checked as boolean)
                          }
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Checkbox
                          checked={permissions[screen.id].edit}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(screen.id, 'edit', checked as boolean)
                          }
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Checkbox
                          checked={permissions[screen.id].delete}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(screen.id, 'delete', checked as boolean)
                          }
                        />
                      </td>
                    </tr>
                  ))
                ])}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}