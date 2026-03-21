import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { usersApi, rolesApi, agenciesApi, settingsApi, getCurrentUser } from '../../services/api';

export function AddUser() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAgencyManager = currentUser?.role === 'Agency Manager';

  const [roles, setRoles] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [myAgency, setMyAgency] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agencyUserCount, setAgencyUserCount] = useState<number | null>(null);
  const [maxUsersLimit, setMaxUsersLimit] = useState<number | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    roleId: '',
    // Agency Managers are locked to their own agency
    agencyId: isAgencyManager ? (currentUser?.agencyId ?? '') : '',
  });

  useEffect(() => {
    const agencyFetch = isAgencyManager && currentUser?.agencyId
      ? agenciesApi.get(currentUser.agencyId)
      : agenciesApi.list({ limit: 100 });

    const fetches: Promise<any>[] = [rolesApi.list(), agencyFetch];
    if (isAgencyManager && currentUser?.agencyId) {
      fetches.push(
        usersApi.list({ agencyId: currentUser.agencyId, limit: 1 }),
        settingsApi.getAll(true),
      );
    }

    Promise.all(fetches)
      .then(([roleList, agencyResult, usersResult, settingsResult]) => {
        setRoles(roleList ?? []);
        if (isAgencyManager) {
          setMyAgency(agencyResult);
          if (usersResult != null) setAgencyUserCount((usersResult as any)?.total ?? 0);
          if (settingsResult != null) {
            const agencySettings: any[] = (settingsResult as any)?.agency ?? [];
            const s = agencySettings.find((x: any) => x.key === 'agency.maxUsersPerAgency');
            if (s) setMaxUsersLimit(parseInt(s.value, 10));
          }
        } else {
          setAgencies((agencyResult as any)?.data ?? []);
        }
      }).catch(() => {
        toast.error('Failed to load roles or agencies');
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roleId) {
      toast.error('Please select a role');
      return;
    }
    if (!form.agencyId) {
      toast.error('Please select an agency');
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.create(form);
      toast.success('User added successfully');
      navigate('/dashboard/users');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/users"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Add New User</h1>
          <p className="text-muted-foreground mt-1">Create new system user account</p>
        </div>
      </div>

      {isAgencyManager && maxUsersLimit !== null && agencyUserCount !== null && (
        <div className={`max-w-2xl rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
          agencyUserCount >= maxUsersLimit
            ? 'border-[#EF4444] bg-[#FEF2F2] text-[#EF4444]'
            : 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
        }`}>
          <span className="font-medium">
            {agencyUserCount >= maxUsersLimit
              ? `User limit reached (${agencyUserCount}/${maxUsersLimit}). You cannot add more users. Contact a System Administrator to increase the limit.`
              : `Agency users: ${agencyUserCount} / ${maxUsersLimit}`}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" placeholder="First name" value={form.firstName} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" placeholder="Last name" value={form.lastName} onChange={handleChange} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="user@company.com" value={form.email} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" placeholder="Minimum 8 characters" value={form.password} onChange={handleChange} required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" placeholder="+1 234 567 8900" value={form.phone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={form.roleId} onValueChange={val => setForm(prev => ({ ...prev, roleId: val }))} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.length > 0 ? (
                      roles.map((role: any) => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="placeholder" disabled>Loading roles...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agency">Agency *</Label>
                {isAgencyManager ? (
                  <Input
                    value={myAgency ? `${myAgency.name} — ${myAgency.country}` : 'Loading...'}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                ) : (
                  <Select value={form.agencyId} onValueChange={val => setForm(prev => ({ ...prev, agencyId: val }))} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agency" />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies.length > 0 ? (
                        agencies.map((agency: any) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name} — {agency.country}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="placeholder" disabled>Loading agencies...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting || (isAgencyManager && maxUsersLimit !== null && agencyUserCount !== null && agencyUserCount >= maxUsersLimit)}
            >
              {submitting ? 'Adding...' : 'Add User'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard/users">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
