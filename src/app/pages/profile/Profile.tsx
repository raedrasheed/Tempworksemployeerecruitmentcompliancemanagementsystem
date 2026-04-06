import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Camera, Save, Shield, CheckCircle, AlertCircle, Loader2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { usersApi } from '../../services/api';
import { toast } from 'sonner';

export function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    phone: '',
    dateOfBirth: '',
    gender: '',
    citizenship: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    country: '',
    postalCode: '',
  });

  useEffect(() => {
    usersApi.me()
      .then((user) => {
        setUserData(user);
        setEditForm({
          phone: user.phone || '',
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
          gender: user.gender || '',
          citizenship: user.citizenship || '',
          addressLine1: user.addressLine1 || '',
          addressLine2: user.addressLine2 || '',
          city: user.city || '',
          country: user.country || '',
          postalCode: user.postalCode || '',
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const profileCompletion = userData ? (() => {
    const fields = [
      userData.firstName, userData.lastName, userData.email, userData.phone,
      userData.dateOfBirth, userData.gender, userData.citizenship,
      userData.city, userData.country,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  })() : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await usersApi.updateProfile(editForm);
      setUserData((prev: any) => ({ ...prev, ...updated }));
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      phone: userData.phone || '',
      dateOfBirth: userData.dateOfBirth ? userData.dateOfBirth.slice(0, 10) : '',
      gender: userData.gender || '',
      citizenship: userData.citizenship || '',
      addressLine1: userData.addressLine1 || '',
      addressLine2: userData.addressLine2 || '',
      city: userData.city || '',
      country: userData.country || '',
      postalCode: userData.postalCode || '',
    });
    setIsEditing(false);
  };

  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.firstName || 'User'}`;
  const displayName = userData ? `${userData.firstName} ${userData.lastName}` : '';
  const roleName = userData?.role?.name || '';
  const agencyName = userData?.agency ? `${userData.agency.name}${userData.agency.country ? ` — ${userData.agency.country}` : ''}` : 'N/A';
  const permissions: string[] = (userData?.role?.permissions ?? []).map((p: any) => p.permission?.name || p.name).filter(Boolean);

  const formatDate = (val: string | null | undefined) => {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateTime = (val: string | null | undefined) => {
    if (!val) return '—';
    return new Date(val).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal information and account settings</p>
      </div>

      {/* Profile Completion */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-[#0F172A]">Profile Completion</h3>
                {userData?.userNumber && (
                  <Badge variant="outline" className="font-mono text-sm bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]">
                    {userData.userNumber}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Complete your profile to unlock all features</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/preferences">
                  <Settings className="w-4 h-4 mr-2" />
                  Preferences
                </Link>
              </Button>
              <Badge className={profileCompletion === 100 ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}>
                {profileCompletion}%
              </Badge>
            </div>
          </div>
          <Progress value={profileCompletion} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Personal Information</CardTitle>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <img src={avatar} alt={displayName} className="w-24 h-24 rounded-full" />
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white hover:bg-[#1D4ED8] transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{displayName}</h3>
                  <p className="text-sm text-muted-foreground">{roleName}</p>
                </div>
              </div>

              <Separator />

              {/* Read-only identity fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={userData?.firstName || ''} disabled className="bg-[#F8FAFC]" />
                  <p className="text-xs text-muted-foreground">Contact admin to update</p>
                </div>

                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={userData?.lastName || ''} disabled className="bg-[#F8FAFC]" />
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" value={userData?.email || ''} disabled className="bg-[#F8FAFC]" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={isEditing ? editForm.phone : (userData?.phone || '')}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    disabled={!isEditing}
                    placeholder={isEditing ? 'e.g. +44 20 7123 4567' : '—'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type={isEditing ? 'date' : 'text'}
                    value={isEditing ? editForm.dateOfBirth : (userData?.dateOfBirth ? new Date(userData.dateOfBirth).toLocaleDateString() : '—')}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  {isEditing ? (
                    <Select value={editForm.gender} onValueChange={val => setEditForm({ ...editForm, gender: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Non-binary">Non-binary</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={userData?.gender || '—'} disabled />
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Citizenship</Label>
                  <Input
                    value={isEditing ? editForm.citizenship : (userData?.citizenship || '—')}
                    onChange={(e) => setEditForm({ ...editForm, citizenship: e.target.value })}
                    disabled={!isEditing}
                    placeholder={isEditing ? 'e.g. British' : ''}
                  />
                </div>
              </div>

              <Separator />

              {/* Address fields */}
              <div>
                <h4 className="text-sm font-semibold text-[#0F172A] mb-3">Address</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 1</Label>
                    <Input
                      value={isEditing ? editForm.addressLine1 : (userData?.addressLine1 || '—')}
                      onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                      disabled={!isEditing}
                      placeholder={isEditing ? 'Street address' : ''}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 2</Label>
                    <Input
                      value={isEditing ? editForm.addressLine2 : (userData?.addressLine2 || '')}
                      onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })}
                      disabled={!isEditing}
                      placeholder={isEditing ? 'Apartment, suite, etc.' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={isEditing ? editForm.city : (userData?.city || '—')}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={isEditing ? editForm.country : (userData?.country || '—')}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input
                      value={isEditing ? editForm.postalCode : (userData?.postalCode || '—')}
                      onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card>
            <CardHeader>
              <CardTitle>Work Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={roleName} disabled className="bg-[#F8FAFC]" />
                </div>

                <div className="space-y-2">
                  <Label>Agency</Label>
                  <Input value={agencyName} disabled className="bg-[#F8FAFC]" />
                </div>

                {userData?.jobTitle && (
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input value={userData.jobTitle} disabled className="bg-[#F8FAFC]" />
                  </div>
                )}

                {userData?.department && (
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input value={userData.department} disabled className="bg-[#F8FAFC]" />
                  </div>
                )}

                {userData?.startDate && (
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input value={formatDate(userData.startDate)} disabled className="bg-[#F8FAFC]" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Input value={userData?.status || '—'} disabled className="bg-[#F8FAFC]" />
                </div>
              </div>

              {permissions.length > 0 && (
                <div className="space-y-2">
                  <Label>Permissions (Read-only)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {permissions.map((permission, index) => (
                      <Badge key={index} variant="outline" className="bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {userData?.userNumber && (
                <>
                  <div>
                    <Label className="text-muted-foreground text-sm">User Number</Label>
                    <p className="font-bold mt-1 text-lg text-[#2563EB] font-mono">
                      {userData.userNumber}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              <div>
                <Label className="text-muted-foreground text-sm">Account Created</Label>
                <p className="font-medium mt-1">{formatDate(userData?.createdAt)}</p>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground text-sm">Last Login</Label>
                <p className="font-medium mt-1">{formatDateTime(userData?.lastLoginAt)}</p>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground text-sm">User ID</Label>
                <p className="font-medium mt-1 text-sm text-muted-foreground font-mono">
                  {userData?.id ? userData.id.slice(0, 8).toUpperCase() : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#2563EB]" />
                    <Label className="font-medium">Two-Factor Authentication</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
              </div>

              {twoFactorEnabled && (
                <div className="p-3 bg-[#EFF6FF] border border-[#2563EB] rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2563EB] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[#2563EB]">2FA Enabled</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your account is protected with two-factor authentication
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <Label className="text-muted-foreground text-sm">Password</Label>
                <p className="text-sm mt-1">••••••••••••</p>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link to="/dashboard/change-password">Change Password</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                  <span className="text-sm">Email Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  {userData?.status === 'ACTIVE' ? (
                    <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#EF4444]" />
                  )}
                  <span className="text-sm">
                    Account {userData?.status === 'ACTIVE' ? 'Active' : userData?.status || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {twoFactorEnabled ? (
                    <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                  )}
                  <span className="text-sm">
                    {twoFactorEnabled ? '2FA Enabled' : '2FA Not Enabled'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
