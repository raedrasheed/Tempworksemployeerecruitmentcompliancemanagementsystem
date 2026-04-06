import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ShieldOff, Camera, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { usersApi, rolesApi, agenciesApi, settingsApi, getCurrentUser } from '../../services/api';

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];
const LANGUAGES = ['English', 'Arabic', 'Polish', 'German', 'French', 'Spanish', 'Italian', 'Romanian', 'Ukrainian'];
const TIMEZONES = [
  'UTC', 'Europe/London', 'Europe/Warsaw', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Bucharest', 'Europe/Kiev',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Dubai', 'Asia/Riyadh',
];

export function AddUser() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const currentUser = getCurrentUser();
  const isAgencyManager = currentUser?.role === 'Agency Manager';

  const [roles, setRoles] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [myAgency, setMyAgency] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agencyUserCount, setAgencyUserCount] = useState<number | null>(null);
  const [maxUsersLimit, setMaxUsersLimit] = useState<number | null>(null);
  const [sendActivationEmail, setSendActivationEmail] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    // Identity
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    // Work Information
    roleId: '',
    agencyId: isAgencyManager ? (currentUser?.agencyId ?? '') : '',
    jobTitle: '',
    department: '',
    startDate: '',
    status: 'PENDING',
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
    preferredLanguage: 'English',
    timeZone: 'Europe/London',
    // Auth
    password: '',
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

  const handleSelect = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
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
    if (!sendActivationEmail && !form.password) {
      toast.error('Please enter a password or enable Send Activation Email');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        email: form.email,
        roleId: form.roleId,
        agencyId: form.agencyId,
        jobTitle: form.jobTitle || undefined,
        department: form.department || undefined,
        startDate: form.startDate || undefined,
        status: form.status,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        citizenship: form.citizenship || undefined,
        phone: form.phone || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        postalCode: form.postalCode || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        timeZone: form.timeZone || undefined,
        sendActivationEmail,
      };
      if (!sendActivationEmail && form.password) {
        payload.password = form.password;
      }

      const newUser = await usersApi.create(payload);
      if (photoFile && newUser?.id) {
        await usersApi.uploadPhoto(newUser.id, photoFile);
      }
      toast.success('User added successfully');
      navigate('/dashboard/users');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate('users')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ShieldOff className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold text-[#0F172A]">Access Denied</p>
        <p className="text-sm">You don't have permission to perform this action.</p>
      </div>
    );
  }

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

          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-7 h-7 text-gray-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Profile Photo</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG or GIF · max 5 MB</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()}>
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      {photoPreview ? 'Change' : 'Upload'}
                    </Button>
                    {photoPreview && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" placeholder="First name" value={form.firstName} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input id="middleName" placeholder="Middle name" value={form.middleName} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" placeholder="Last name" value={form.lastName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="user@company.com" value={form.email} onChange={handleChange} required />
              </div>
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card>
            <CardHeader>
              <CardTitle>Work Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.roleId} onValueChange={val => handleSelect('roleId', val)} required>
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
                <Label>Agency *</Label>
                {isAgencyManager ? (
                  <Input
                    value={myAgency ? `${myAgency.name} — ${myAgency.country}` : 'Loading...'}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                ) : (
                  <Select value={form.agencyId} onValueChange={val => handleSelect('agencyId', val)} required>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input id="jobTitle" placeholder="e.g. Recruitment Officer" value={form.jobTitle} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" placeholder="e.g. Operations" value={form.department} onChange={handleChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={form.startDate} onChange={handleChange} />
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
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
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
                  <Input id="phone" type="tel" placeholder="+44 20 7123 4567" value={form.phone} onChange={handleChange} />
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
                      <SelectValue />
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
                      <SelectValue />
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

          {/* Account Setup */}
          <Card>
            <CardHeader>
              <CardTitle>Account Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="sendActivationEmail"
                  checked={sendActivationEmail}
                  onCheckedChange={(checked) => setSendActivationEmail(!!checked)}
                />
                <div>
                  <Label htmlFor="sendActivationEmail" className="cursor-pointer font-medium">
                    Send activation email
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The user will receive an email with a link to set their password
                  </p>
                </div>
              </div>

              {!sendActivationEmail && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={form.password}
                    onChange={handleChange}
                    required={!sendActivationEmail}
                    minLength={8}
                  />
                </div>
              )}
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
