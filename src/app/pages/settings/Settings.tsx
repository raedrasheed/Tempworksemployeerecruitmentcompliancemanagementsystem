import { Link } from 'react-router';
import { useState, useEffect } from 'react';
import { FileType, Bell, Shield, Activity, Building2, GitBranch, Briefcase, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { settingsApi } from '../../services/api';

export function Settings() {
  const [maxUsers, setMaxUsers] = useState('5');
  const [savingAgency, setSavingAgency] = useState(false);

  useEffect(() => {
    settingsApi.getAll().then((grouped: any) => {
      const agencySettings: any[] = grouped?.agency ?? [];
      const setting = agencySettings.find((s: any) => s.key === 'agency.maxUsersPerAgency');
      if (setting) setMaxUsers(setting.value);
    }).catch(() => {});
  }, []);

  const handleSaveAgencySettings = async () => {
    setSavingAgency(true);
    try {
      await settingsApi.update({ 'agency.maxUsersPerAgency': maxUsers });
      toast.success('Agency settings saved');
    } catch {
      toast.error('Failed to save agency settings');
    } finally {
      setSavingAgency(false);
    }
  };

  const settingsCategories = [
    {
      icon: Briefcase,
      title: 'Job Types',
      description: 'Configure job types and document requirements',
      path: '/dashboard/settings/job-types',
      badge: 'New',
    },
    {
      icon: FileType,
      title: 'Document Types',
      description: 'Manage document types and requirements',
      path: '/dashboard/settings/document-types',
    },
    {
      icon: Bell,
      title: 'Notification Rules',
      description: 'Configure notification preferences and rules',
      path: '/dashboard/settings/notifications',
    },
    {
      icon: Shield,
      title: 'Security Settings',
      description: 'Manage security and access control settings',
      path: '/dashboard/settings/security',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage system configuration and preferences</p>
      </div>

      {/* Settings Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Appearance – always first */}
        <Link to="/dashboard/settings/color-scheme">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Palette className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>Appearance</CardTitle>
                    <Badge className="bg-primary text-primary-foreground">Theme</Badge>
                  </div>
                  <CardDescription>Color schemes, brand colors &amp; dark mode</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/dashboard/settings/workflow-configuration">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <GitBranch className="w-6 h-6 text-[#2563EB]" />
                </div>
                <h3 className="font-semibold">Workflow Configuration</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure recruitment workflow stages, requirements, and stage order. Admin only.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Badge className="bg-[#EF4444]">Admin Only</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        {settingsCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Link key={category.path} to={category.path}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                      <Icon className="w-6 h-6 text-[#2563EB]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{category.title}</CardTitle>
                        {category.badge && (
                          <Badge className="bg-[#22C55E]">{category.badge}</Badge>
                        )}
                      </div>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Agency Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <CardTitle>Agency Configuration</CardTitle>
              <CardDescription>Global settings for recruitment agencies</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="defaultMaxUsers">Default Maximum Users Per Agency</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Set the limit for how many users an Agency Manager can add to their agency
            </p>
            <Select value={maxUsers} onValueChange={setMaxUsers}>
              <SelectTrigger id="defaultMaxUsers" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'user' : 'users'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSaveAgencySettings} disabled={savingAgency}>
              {savingAgency ? 'Saving…' : 'Save Agency Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Retention Policy */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#22C55E]" />
            </div>
            <div>
              <CardTitle>Log Retention Policy</CardTitle>
              <CardDescription>Configure how long system logs are stored</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="logRetention">Log Retention Period</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              System logs older than this period will be automatically deleted
            </p>
            <Select defaultValue="90">
              <SelectTrigger id="logRetention" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days (Recommended)</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">365 days (1 year)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button>Save Log Settings</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">System Version</p>
              <p className="font-medium mt-1">v2.4.0</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium mt-1">March 10, 2026</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Database Status</p>
              <p className="font-medium mt-1 text-[#22C55E]">Connected</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="font-medium mt-1">24</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
