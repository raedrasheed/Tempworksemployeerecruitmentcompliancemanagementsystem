import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ShieldOff, Unlock, RefreshCw, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { usersApi, rolesApi, agenciesApi, authApi, getCurrentUser } from '../../services/api';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const LANGUAGES = ['English', 'Arabic', 'Polish', 'German', 'French', 'Spanish', 'Italian', 'Romanian', 'Ukrainian'];
const TIMEZONES = [
  'UTC', 'Europe/London', 'Europe/Warsaw', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Bucharest', 'Europe/Kiev',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Dubai', 'Asia/Riyadh',
];

export function EditUser() {
  const { canEdit } = usePermissions();
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdminOrHR = currentUser?.role === 'System Admin' ||
    currentUser?.role === 'HR Manager' ||
    currentUser?.role?.toLowerCase().includes('admin') ||
    currentUser?.role?.toLowerCase().includes('hr');

  const [roles, setRoles] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState('');

  const [form, setForm] = useState({
    // Identity
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    // Work Information
    roleId: '',
    agencyId: '',
    jobTitle: '',
    department: '',
    startDate: '',
    status: '',
    // Personal Details
    dateOfBirth: '',
    gender: '',
    citizenship: '',
    phone: '',
    // Address
    addressLine1: '',
    addressLine2: '',
    city: '',
    country: '',
    postalCode: '',
    // Preferences
    preferredLanguage: '',
    timeZone: '',
  });

  useEffect(() => {
    Promise.all([
      usersApi.get(id!),
      rolesApi.list(),
      agenciesApi.list({ limit: 100 }),
    ]).then(([user, roleList, agencyPage]) => {
      setLockedAt(user.lockedAt ?? null);
      setUserStatus(user.status ?? 'ACTIVE');
      setForm({
        firstName: user.firstName ?? '',
        middleName: user.middleName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        roleId: user.role?.id ?? '',
        agencyId: user.agency?.id ?? user.agencyId ?? '',
        jobTitle: user.jobTitle ?? '',
        department: user.department ?? '',
        startDate: user.startDate ? user.startDate.slice(0, 10) : '',
        status: user.status ?? 'ACTIVE',
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
        gender: user.gender ?? '',
        citizenship: user.citizenship ?? '',
        phone: user.phone ?? '',
        addressLine1: user.addressLine1 ?? '',
        addressLine2: user.addressLine2 ?? '',
        city: user.city ?? '',
        country: user.country ?? '',
        postalCode: user.postalCode ?? '',
        preferredLanguage: user.preferredLanguage ?? '',
        timeZone: user.timeZone ?? '',
      });
      setRoles(roleList ?? []);
      setAgencies(agencyPage?.data ?? []);
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (notFound) return <div className="p-8">User not found</div>;

  if (!canEdit('users')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ShieldOff className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold text-[#0F172A]">Access Denied</p>
        <p className="text-sm">You don't have permission to perform this action.</p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSelect = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agencyId) {
      toast.error('Please select an agency');
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.update(id!, form);
      toast.success('User updated successfully');
      navigate('/dashboard/users');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockAccount = async () => {
    try {
      await usersApi.unlockUser(id!);
      setLockedAt(null);
      toast.success('Account unlocked successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unlock account');
    }
  };

  const handleResetPassword = async () => {
    if (!confirm('Send a password reset email to this user?')) return;
    try {
      await authApi.adminResetPassword(id!);
      toast.success('Password reset email sent successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send password reset');
    }
  };

  const handleResendActivation = async () => {
    try {
      await authApi.resendActivation(id!);
      toast.success('Activation email resent successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resend activation email');
    }
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

      {/* Account Actions */}
      <div className="max-w-2xl flex flex-wrap gap-3">
        {lockedAt && (
          <div className="flex items-center gap-3 flex-1 p-3 rounded-lg border border-amber-300 bg-amber-50">
            <Badge className="bg-amber-500 shrink-0">Locked</Badge>
            <span className="text-sm text-amber-800 flex-1">
              Account locked since {new Date(lockedAt).toLocaleDateString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlockAccount}
              className="border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0"
            >
              <Unlock className="w-4 h-4 mr-1" />
              Unlock
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetPassword}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset Password
        </Button>
        {(userStatus === 'PENDING' || form.status === 'PENDING') && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResendActivation}
          >
            <Mail className="w-4 h-4 mr-2" />
            Resend Activation
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">

          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" value={form.firstName} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input id="middleName" value={form.middleName} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={form.lastName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={handleChange} required />
              </div>
            </CardContent>
          </Card>

          {/* Work Information — admin-only fields shown to admins/HR */}
          <Card>
            <CardHeader>
              <CardTitle>Work Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdminOrHR && (
                <>
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={form.roleId} onValueChange={val => handleSelect('roleId', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Agency *</Label>
                    <Select value={form.agencyId} onValueChange={val => handleSelect('agencyId', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agency" />
                      </SelectTrigger>
                      <SelectContent>
                        {agencies.map((agency: any) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name} — {agency.country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={val => handleSelect('status', val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {!isAdminOrHR && (
                <>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={roles.find(r => r.id === form.roleId)?.name ?? form.roleId} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Agency</Label>
                    <Input value={agencies.find(a => a.id === form.agencyId)?.name ?? form.agencyId} disabled className="bg-muted" />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  {isAdminOrHR ? (
                    <Input id="jobTitle" value={form.jobTitle} onChange={handleChange} />
                  ) : (
                    <Input value={form.jobTitle} disabled className="bg-muted" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  {isAdminOrHR ? (
                    <Input id="department" value={form.department} onChange={handleChange} />
                  ) : (
                    <Input value={form.department} disabled className="bg-muted" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                {isAdminOrHR ? (
                  <Input id="startDate" type="date" value={form.startDate} onChange={handleChange} />
                ) : (
                  <Input value={form.startDate} disabled className="bg-muted" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Personal Details */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={val => handleSelect('gender', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="citizenship">Citizenship</Label>
                  <Input id="citizenship" placeholder="e.g. British" value={form.citizenship} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={handleChange} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input id="addressLine1" placeholder="Street address" value={form.addressLine1} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" placeholder="Apartment, suite, etc." value={form.addressLine2} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" value={form.city} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" placeholder="Country" value={form.country} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" placeholder="Post code" value={form.postalCode} onChange={handleChange} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preferred Language</Label>
                  <Select value={form.preferredLanguage} onValueChange={val => handleSelect('preferredLanguage', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <Select value={form.timeZone} onValueChange={val => handleSelect('timeZone', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
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
