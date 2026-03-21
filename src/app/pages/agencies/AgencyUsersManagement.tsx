import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Trash2, Users, Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { agenciesApi, usersApi, settingsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

export function AgencyUsersManagement() {
  const { id } = useParams();
  const { canCreate, canDelete, can } = usePermissions();
  const canManageUsers = canCreate('users') || can('agencies', 'update');

  const [agency, setAgency] = useState<any>(null);
  const [agencyUsers, setAgencyUsers] = useState<any[]>([]);
  const [maxUsers, setMaxUsers] = useState<number>(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      agenciesApi.get(id!),
      agenciesApi.getUsers(id!),
      settingsApi.getAll(true),
    ]).then(([agencyData, usersResult, settingsResult]) => {
      setAgency(agencyData);
      setAgencyUsers((usersResult as any)?.data ?? usersResult ?? []);
      const agencySettings: any[] = (settingsResult as any)?.agency ?? [];
      const s = agencySettings.find((x: any) => x.key === 'agency.maxUsersPerAgency');
      if (s) setMaxUsers(parseInt(s.value, 10));
    }).catch(() => toast.error('Failed to load agency data'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Are you sure you want to remove ${user.firstName} ${user.lastName} from this agency?`)) return;
    try {
      await usersApi.delete(user.id);
      setAgencyUsers(prev => prev.filter(u => u.id !== user.id));
      toast.success('User removed successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove user');
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!agency) return <div className="p-8">Agency not found</div>;

  const activeUsers = agencyUsers.filter(u => u.status === 'ACTIVE');
  const managers = agencyUsers.filter(u => u.role?.name === 'Agency Manager');
  const atLimit = activeUsers.length >= maxUsers;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/agencies/${id}`}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Agency Users</h1>
          <p className="text-muted-foreground mt-1">{agency.name} — Manage agency user accounts</p>
        </div>
        {canManageUsers && (
          <Button asChild disabled={atLimit}>
            <Link to="/dashboard/users/add">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Link>
          </Button>
        )}
      </div>

      {atLimit && (
        <Card className="border-[#F59E0B] bg-[#FEF3C7]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] mt-0.5" />
              <div>
                <p className="font-medium text-[#F59E0B]">Maximum number of users reached</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This agency has reached the maximum limit of {maxUsers} active users. Contact a System Administrator to increase the limit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{activeUsers.length}/{maxUsers}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{managers.length}</p>
                <p className="text-sm text-muted-foreground">Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#EF4444]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{agencyUsers.filter(u => u.status !== 'ACTIVE').length}</p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agency Users ({agencyUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {agencyUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found for this agency.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#F8FAFC] border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">User</th>
                    <th className="text-left p-4 font-semibold text-sm">Role</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-left p-4 font-semibold text-sm">Last Login</th>
                    <th className="text-left p-4 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agencyUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={
                          user.role?.name === 'Agency Manager'
                            ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]'
                            : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                        }>
                          {user.role?.name ?? '—'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={user.status === 'ACTIVE' ? 'bg-[#22C55E]' : 'bg-gray-500'}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-4">
                        {(canDelete('users') || can('agencies', 'delete')) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(user)}
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
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
