import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Edit, Search, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { usersApi, getCurrentUser } from '../../services/api';
import { toast } from 'sonner';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';
import { usePermissions } from '../../hooks/usePermissions';

const userColumns: Column[] = [
  { id: 'firstName', label: 'First Name', type: 'text' },
  { id: 'lastName', label: 'Last Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] },
];

export function UsersList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);

  useEffect(() => {
    usersApi.list({ limit: 100 })
      .then((res: any) => setUsers(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const applyFilters = (user: any) => {
    if (activeFilters.length === 0) return true;
    const results = activeFilters.map(filter => {
      const value = (user[filter.columnId] ?? '').toString();
      switch (filter.operator) {
        case 'contains': return value.toLowerCase().includes(filter.value.toLowerCase());
        case 'equals': return value.toLowerCase() === filter.value.toLowerCase();
        case 'startsWith': return value.toLowerCase().startsWith(filter.value.toLowerCase());
        case 'endsWith': return value.toLowerCase().endsWith(filter.value.toLowerCase());
        default: return true;
      }
    });
    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.role?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && applyFilters(user);
  });

  const handleDelete = async (user: any) => {
    if (!confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`)) return;
    try {
      await usersApi.delete(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      toast.success('User deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete user');
    }
  };

  const handleSavePreset = (name: string, rules: FilterRule[], logic: 'AND' | 'OR') => {
    setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, rules, logic }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and permissions</p>
        </div>
        {canCreate('users') && (
          <Button asChild>
            <Link to="/dashboard/users/add">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <FilterSystem
              columns={userColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={handleSavePreset}
              onLoadPreset={(preset) => { setActiveFilters(preset.rules); setFilterLogic(preset.logic); }}
              onDeletePreset={(id) => setSavedPresets(prev => prev.filter(p => p.id !== id))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        user.role?.name?.toLowerCase().includes('admin') ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]' :
                        user.role?.name?.toLowerCase().includes('hr') ? 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]' :
                        'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                      }>
                        {user.role?.name ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.agency?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={user.status === 'ACTIVE' ? 'bg-[#22C55E]' : 'bg-gray-500'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit('users') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/users/${user.id}/edit`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Link>
                          </Button>
                        )}
                        {canDelete('users') && user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
