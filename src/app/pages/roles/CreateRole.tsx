import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { rolesApi } from '../../services/api';

const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
type Action = typeof ACTIONS[number];

const ACTION_LABELS: Record<Action, string> = {
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
};

export function CreateRole() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();

  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetches = isEditMode
      ? Promise.all([rolesApi.getPermissions(), rolesApi.get(id!)])
      : Promise.all([rolesApi.getPermissions(), Promise.resolve(null)]);

    fetches
      .then(([perms, role]) => {
        setAllPermissions(Array.isArray(perms) ? perms : []);
        if (role) {
          setRoleName(role.name ?? '');
          setDescription(role.description ?? '');
          const ids = (role.permissions ?? []).map((rp: any) => rp.permissionId as string);
          setSelectedIds(new Set(ids));
        }
      })
      .catch(() => {
        if (isEditMode) setNotFound(true);
        else toast.error('Failed to load permissions');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Build module → action → permissionId lookup
  const permMap: Record<string, Partial<Record<Action, string>>> = {};
  allPermissions.forEach((p: any) => {
    if (!permMap[p.module]) permMap[p.module] = {};
    permMap[p.module][p.action as Action] = p.id;
  });

  const modules = Object.keys(permMap).sort();

  const togglePermission = (permId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(permId) ? next.delete(permId) : next.add(permId);
      return next;
    });
  };

  const handleSelectAllAction = (action: Action) => {
    const actionIds = allPermissions.filter(p => p.action === action).map(p => p.id as string);
    const allChecked = actionIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      actionIds.forEach(pid => allChecked ? next.delete(pid) : next.add(pid));
      return next;
    });
  };

  const handleSelectAllModule = (module: string) => {
    const moduleIds = Object.values(permMap[module] ?? {}).filter(Boolean) as string[];
    const allChecked = moduleIds.every(pid => selectedIds.has(pid));
    setSelectedIds(prev => {
      const next = new Set(prev);
      moduleIds.forEach(pid => allChecked ? next.delete(pid) : next.add(pid));
      return next;
    });
  };

  const isActionAllChecked = (action: Action) =>
    allPermissions.filter(p => p.action === action).every(p => selectedIds.has(p.id));

  const isModuleAllChecked = (module: string) => {
    const ids = Object.values(permMap[module] ?? {}).filter(Boolean) as string[];
    return ids.length > 0 && ids.every(pid => selectedIds.has(pid));
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: roleName.trim(),
        description: description.trim(),
        permissionIds: Array.from(selectedIds),
      };
      if (isEditMode) {
        await rolesApi.update(id!, payload);
        toast.success('Role updated successfully');
      } else {
        await rolesApi.create(payload);
        toast.success('Role created successfully');
      }
      navigate('/dashboard/roles');
    } catch (err: any) {
      toast.error(err?.message || (isEditMode ? 'Failed to update role' : 'Failed to create role'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (notFound) return <div className="p-8">Role not found.</div>;

  // Group modules by category using their first segment (fallback to module name)
  const groupedModules = modules.reduce((acc, mod) => {
    // Capitalize first letter as category label
    const category = mod.charAt(0).toUpperCase() + mod.slice(1);
    if (!acc[category]) acc[category] = [];
    acc[category].push(mod);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/roles">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">
            {isEditMode ? 'Edit Role' : 'Create New Role'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode ? 'Modify role details and permissions' : 'Define a new role with custom permissions'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={submitting}>
          <Save className="w-4 h-4 mr-2" />
          {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Role'}
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
            Select permissions for each module
          </p>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <p className="text-muted-foreground text-sm">No permissions available.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#F8FAFC] border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm w-1/3">Module</th>
                    {ACTIONS.map(action => (
                      <th key={action} className="text-center p-4 font-semibold text-sm w-1/6">
                        <div className="flex flex-col items-center gap-2">
                          <span>{ACTION_LABELS[action]}</span>
                          <Checkbox
                            checked={isActionAllChecked(action)}
                            onCheckedChange={() => handleSelectAllAction(action)}
                            className="cursor-pointer"
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => (
                    <tr key={mod} className="border-b hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isModuleAllChecked(mod)}
                            onCheckedChange={() => handleSelectAllModule(mod)}
                            className="cursor-pointer"
                          />
                          <Shield className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium capitalize">{mod.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      {ACTIONS.map(action => {
                        const permId = permMap[mod]?.[action];
                        return (
                          <td key={action} className="p-4 text-center">
                            {permId ? (
                              <Checkbox
                                checked={selectedIds.has(permId)}
                                onCheckedChange={() => togglePermission(permId)}
                              />
                            ) : (
                              <span className="text-[#E2E8F0]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
