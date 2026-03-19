import { useState } from 'react';
import { Camera, Save, Shield, Monitor, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';

export function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Mock user data
  const [userData, setUserData] = useState({
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@tempworks.eu',
    phone: '+44 20 7123 4567',
    nationality: 'United Kingdom',
    role: 'HR Manager',
    agency: 'N/A - Company Staff',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    createdAt: '2025-01-15',
    lastLogin: '2026-03-19 09:32 AM',
    permissions: ['User Management', 'Employee Management', 'Document Verification', 'Compliance Monitoring']
  });

  // Mock activity data
  const recentActions = [
    { action: 'Approved employee application', time: '2 hours ago' },
    { action: 'Updated document verification rules', time: '5 hours ago' },
    { action: 'Created new user account', time: '1 day ago' },
    { action: 'Generated compliance report', time: '2 days ago' }
  ];

  // Mock sessions
  const activeSessions = [
    { device: 'Chrome on Windows', location: 'London, UK', lastActive: 'Active now', current: true },
    { device: 'Safari on iPhone', location: 'London, UK', lastActive: '2 hours ago', current: false },
    { device: 'Chrome on MacBook', location: 'Manchester, UK', lastActive: '1 day ago', current: false }
  ];

  // Calculate profile completion
  const calculateProfileCompletion = () => {
    const fields = [
      userData.firstName,
      userData.lastName,
      userData.email,
      userData.phone,
      userData.nationality,
      userData.avatar
    ];
    const filledFields = fields.filter(field => field && field !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const profileCompletion = calculateProfileCompletion();

  const handleSave = () => {
    // In production, this would save to backend
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  const handleLogoutOtherDevices = () => {
    alert('Logged out from all other devices');
  };

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
              <h3 className="font-semibold text-[#0F172A]">Profile Completion</h3>
              <p className="text-sm text-muted-foreground">Complete your profile to unlock all features</p>
            </div>
            <Badge className={profileCompletion === 100 ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}>
              {profileCompletion}%
            </Badge>
          </div>
          <Progress value={profileCompletion} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Information */}
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
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <img 
                    src={userData.avatar}
                    alt={userData.firstName}
                    className="w-24 h-24 rounded-full"
                  />
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white hover:bg-[#1D4ED8] transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{userData.firstName} {userData.lastName}</h3>
                  <p className="text-sm text-muted-foreground">{userData.role}</p>
                  {isEditing && (
                    <Button variant="outline" size="sm" className="mt-2">
                      Upload New Photo
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input 
                    value={userData.firstName}
                    onChange={(e) => setUserData({...userData, firstName: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input 
                    value={userData.lastName}
                    onChange={(e) => setUserData({...userData, lastName: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    type="email"
                    value={userData.email}
                    disabled
                    className="bg-[#F8FAFC]"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    value={userData.phone}
                    onChange={(e) => setUserData({...userData, phone: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nationality</Label>
                  <Input 
                    value={userData.nationality}
                    onChange={(e) => setUserData({...userData, nationality: e.target.value})}
                    disabled={!isEditing}
                  />
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
                  <Input 
                    value={userData.role}
                    disabled
                    className="bg-[#F8FAFC]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Agency</Label>
                  <Input 
                    value={userData.agency}
                    disabled
                    className="bg-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Permissions (Read-only)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {userData.permissions.map((permission, index) => (
                    <Badge key={index} variant="outline" className="bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActions.map((action, index) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="w-2 h-2 rounded-full bg-[#2563EB] mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{action.action}</p>
                      <p className="text-xs text-muted-foreground">{action.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Session Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Sessions</CardTitle>
                <Button variant="outline" size="sm" onClick={handleLogoutOtherDevices}>
                  Logout Other Devices
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeSessions.map((session, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    {session.device.includes('iPhone') ? (
                      <Smartphone className="w-5 h-5 text-muted-foreground mt-0.5" />
                    ) : (
                      <Monitor className="w-5 h-5 text-muted-foreground mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{session.device}</p>
                        {session.current && (
                          <Badge className="bg-[#22C55E] text-xs">Current</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{session.location}</p>
                      <p className="text-xs text-muted-foreground">Last active: {session.lastActive}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Account Info & Security */}
        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">Account Created</Label>
                <p className="font-medium mt-1">{new Date(userData.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground text-sm">Last Login</Label>
                <p className="font-medium mt-1">{userData.lastLogin}</p>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground text-sm">User ID</Label>
                <p className="font-medium mt-1 text-sm text-muted-foreground">USR-2025-001</p>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
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
                <Switch 
                  checked={twoFactorEnabled}
                  onCheckedChange={setTwoFactorEnabled}
                />
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
                  <a href="/dashboard/change-password">Change Password</a>
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
                  <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                  <span className="text-sm">Account Active</span>
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
