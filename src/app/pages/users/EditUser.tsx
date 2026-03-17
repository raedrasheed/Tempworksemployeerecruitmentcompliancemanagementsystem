import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { mockUsers } from '../../data/mockData';
import { toast } from 'sonner';

export function EditUser() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = mockUsers.find(u => u.id === id);

  if (!user) return <div>User not found</div>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('User updated successfully');
    navigate('/dashboard/users');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/users"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit User</h1>
          <p className="text-muted-foreground mt-1">Update user information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" defaultValue={user.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" defaultValue={user.email} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select defaultValue={user.role}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal_recruiter">Internal Recruiter</SelectItem>
                    <SelectItem value="hr_manager">HR Manager</SelectItem>
                    <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="system_admin">System Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1">Save Changes</Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard/users">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}