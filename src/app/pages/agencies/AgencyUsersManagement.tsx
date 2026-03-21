import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Edit, Trash2, Users, Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { mockAgencies } from '../../data/mockData';
import { usePermissions } from '../../hooks/usePermissions';

interface AgencyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  createdDate: string;
}

const mockAgencyUsers: AgencyUser[] = [
  {
    id: 'AU001',
    name: 'Maria Schmidt',
    email: 'maria.schmidt@eurorecruit.com',
    role: 'Agency Manager',
    status: 'active',
    lastLogin: '2024-03-13 09:15',
    createdDate: '2024-01-15',
  },
  {
    id: 'AU002',
    name: 'Thomas Weber',
    email: 'thomas.weber@eurorecruit.com',
    role: 'Agency User',
    status: 'active',
    lastLogin: '2024-03-13 08:42',
    createdDate: '2024-01-20',
  },
  {
    id: 'AU003',
    name: 'Anna Mueller',
    email: 'anna.mueller@eurorecruit.com',
    role: 'Agency User',
    status: 'active',
    lastLogin: '2024-03-12 16:30',
    createdDate: '2024-02-01',
  },
  {
    id: 'AU004',
    name: 'Peter Fischer',
    email: 'peter.fischer@eurorecruit.com',
    role: 'Agency User',
    status: 'inactive',
    lastLogin: '2024-02-28 10:20',
    createdDate: '2024-01-25',
  },
];

export function AgencyUsersManagement() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { id } = useParams();
  const agency = mockAgencies.find(a => a.id === id);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');

  if (!agency) {
    return <div>Agency not found</div>;
  }

  const maxUsers = 10; // Example limit
  const currentUsers = mockAgencyUsers.filter(u => u.status === 'active').length;
  const canAddMore = currentUsers < maxUsers;

  const handleAddUser = () => {
    if (!canAddMore) {
      alert('Maximum number of users for this agency has been reached');
      return;
    }
    alert(`User "${newUserName}" added successfully`);
    setIsAddUserOpen(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/agencies/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Agency Users</h1>
          <p className="text-muted-foreground mt-1">{agency.name} • Manage agency user accounts</p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          {canCreate('agencies') && (
            <DialogTrigger asChild>
              <Button disabled={!canAddMore}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Agency User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="userName">Full Name</Label>
                <Input
                  id="userName"
                  placeholder="Enter user name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="userEmail">Email</Label>
                <Input
                  id="userEmail"
                  type="email"
                  placeholder="user@agency.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="userRole">Role</Label>
                <Select value={newUserRole} onValueChange={setNewUserRole}>
                  <SelectTrigger id="userRole" className="mt-1.5">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agency_manager">Agency Manager</SelectItem>
                    <SelectItem value="agency_user">Agency User (Default)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Default role will be assigned automatically
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddUser}>Add User</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* User Limit Warning */}
      {!canAddMore && (
        <Card className="border-[#F59E0B] bg-[#FEF3C7]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] mt-0.5" />
              <div>
                <p className="font-medium text-[#F59E0B]">Maximum number of users reached</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This agency has reached the maximum limit of {maxUsers} active users. Please contact support to increase the limit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{currentUsers}/{maxUsers}</p>
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
                <p className="text-2xl font-semibold">
                  {mockAgencyUsers.filter(u => u.role === 'Agency Manager').length}
                </p>
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
                <p className="text-2xl font-semibold">
                  {mockAgencyUsers.filter(u => u.status === 'inactive').length}
                </p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Agency Users ({mockAgencyUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-sm">User</th>
                  <th className="text-left p-4 font-semibold text-sm">Role</th>
                  <th className="text-left p-4 font-semibold text-sm">Status</th>
                  <th className="text-left p-4 font-semibold text-sm">Last Login</th>
                  <th className="text-left p-4 font-semibold text-sm">Created</th>
                  <th className="text-left p-4 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockAgencyUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={
                        user.role === 'Agency Manager' 
                          ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                      }>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge className={
                        user.status === 'active' ? 'bg-[#22C55E]' : 'bg-gray-500'
                      }>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm">{user.lastLogin}</td>
                    <td className="p-4 text-sm">{user.createdDate}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {canEdit('agencies') && (
                          <Button size="sm" variant="ghost">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete('agencies') && (
                          <Button size="sm" variant="ghost">
                            <Trash2 className="w-4 h-4 text-[#EF4444]" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
