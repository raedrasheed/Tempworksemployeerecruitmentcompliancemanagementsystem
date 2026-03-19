import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Edit, Search } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { mockUsers } from '../../data/mockData';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

// Define columns for the filter system
const userColumns: Column[] = [
  { id: 'name', label: 'User Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'role', label: 'Role', type: 'enum', options: ['system_admin', 'hr_manager', 'hr_staff', 'agency_admin', 'agency_staff', 'compliance_officer', 'finance_manager'] },
  { id: 'status', label: 'Status', type: 'enum', options: ['active', 'inactive'] },
  { id: 'lastLogin', label: 'Last Login', type: 'text' },
];

export function UsersList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: '1',
      name: 'Active Admins',
      rules: [
        { id: '1', columnId: 'status', operator: 'equals', value: 'active' },
        { id: '2', columnId: 'role', operator: 'equals', value: 'system_admin' }
      ],
      logic: 'AND'
    },
    {
      id: '2',
      name: 'HR Team',
      rules: [
        { id: '1', columnId: 'role', operator: 'in', value: 'hr_manager' },
        { id: '2', columnId: 'role', operator: 'in', value: 'hr_staff' }
      ],
      logic: 'OR'
    }
  ]);

  // Apply filters to users
  const applyFilters = (user: any) => {
    if (activeFilters.length === 0) return true;

    const results = activeFilters.map(filter => {
      const column = userColumns.find(c => c.id === filter.columnId);
      if (!column) return true;

      const value = (user as any)[filter.columnId] || '';

      // Apply operator logic
      switch (filter.operator) {
        case 'contains':
          return value.toLowerCase().includes(filter.value.toLowerCase());
        case 'equals':
          return value.toString().toLowerCase() === filter.value.toLowerCase();
        case 'startsWith':
          return value.toLowerCase().startsWith(filter.value.toLowerCase());
        case 'endsWith':
          return value.toLowerCase().endsWith(filter.value.toLowerCase());
        default:
          return true;
      }
    });

    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilters = applyFilters(user);
    return matchesSearch && matchesFilters;
  });

  const handleSavePreset = (name: string, rules: FilterRule[], logic: 'AND' | 'OR') => {
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name,
      rules,
      logic
    };
    setSavedPresets([...savedPresets, newPreset]);
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    setActiveFilters(preset.rules);
    setFilterLogic(preset.logic);
  };

  const handleDeletePreset = (presetId: string) => {
    setSavedPresets(savedPresets.filter(p => p.id !== presetId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and permissions</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/users/add">
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
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
              onLoadPreset={handleLoadPreset}
              onDeletePreset={handleDeletePreset}
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
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        user.role === 'system_admin' ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]' :
                        user.role === 'hr_manager' ? 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]' :
                        'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                      }>
                        {user.role.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.role.includes('agency') ? 'Agency' : 'Company Staff'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.status === 'active' ? 'bg-[#22C55E]' : 'bg-gray-500'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.lastLogin}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/dashboard/users/${user.id}/edit`}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Link>
                      </Button>
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