import { Link } from 'react-router';
import { FileType, Bell, Shield, Activity, Layers, Briefcase, Palette, Trash2, Database, Server, Building2, Star, Truck, Tag, GitBranch, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL, getCurrentUser } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

interface SystemInfo {
  version: string;
  organizationName: string;
  lastUpdated: string;
}

interface SystemStats {
  totalUsers: number;
  databaseStatus: string;
}

export function Settings() {
  // settings:update is the gate for admin-only configuration cards
  // (branding, skills, truck brands, database backup/cleanup, …).
  // System Admins pass via the usePermissions isAdmin bypass so the
  // legacy behaviour is preserved, and any role explicitly granted
  // `settings:update` via the Roles UI now also unlocks these cards.
  //
  // Fall back to the cached user from localStorage when AuthContext
  // hasn't populated yet — the Sidebar uses the same pattern so the
  // admin-only cards stay visible right after a hard reload instead of
  // briefly disappearing while /auth/me is in-flight.
  const { canEdit } = usePermissions();
  const { user: ctxUser } = useAuthContext();
  const cachedUser = ctxUser ?? getCurrentUser();
  const cachedRole = typeof cachedUser?.role === 'string'
    ? cachedUser.role
    : ((cachedUser?.role as any)?.name ?? '');
  const isCachedAdmin = cachedRole.trim().toLowerCase() === 'system admin';
  const canEditSettings = canEdit('settings') || isCachedAdmin;

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/settings/system-info`, { headers }).then((r) => r.json()).catch(() => null),
      fetch(`${API_URL}/settings/system-stats`, { headers }).then((r) => r.json()).catch(() => null),
    ]).then(([info, stats]) => {
      if (info) setSystemInfo(info);
      if (stats) setSystemStats(stats);
    });
  }, []);

  const settingsCategories = [
    {
      icon: Briefcase,
      title: 'Job Categories',
      description: 'Configure job categories and document requirements',
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
      icon: DollarSign,
      title: 'Transaction Types',
      description: 'Configure the transaction type options shown in the finance ledger',
      path: '/dashboard/settings/transaction-types',
    },
    {
      icon: Briefcase,
      title: 'Work History Event Types',
      description: 'Configure the event types shown in the Employee profile Contracts tab',
      path: '/dashboard/settings/work-history-event-types',
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
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
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

        <Link to="/dashboard/workflows">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <Layers className="w-6 h-6 text-[#2563EB]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>Manage Workflows</CardTitle>
                    <Badge className="bg-[#EF4444]">Admin Only</Badge>
                  </div>
                  <CardDescription>Create and configure recruitment workflows</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        {settingsCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Link key={category.path} to={category.path}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
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

        {/* Company Branding — System Admin only */}
        {canEditSettings && (
          <Link to="/dashboard/settings/branding">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-indigo-200 hover:border-indigo-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-indigo-800">Company Branding</CardTitle>
                      <Badge className="bg-[#EF4444]">Admin Only</Badge>
                    </div>
                    <CardDescription>Company name and logo shown across the platform</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Skills List */}
        {canEditSettings && (
          <Link to="/dashboard/settings/skills">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-amber-200 hover:border-amber-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Star className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-amber-800">Skills List</CardTitle>
                      <Badge className="bg-[#EF4444]">Admin Only</Badge>
                    </div>
                    <CardDescription>Manage predefined skills shown in the applicant form</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Transport Types */}
        {canEditSettings && (
          <Link to="/dashboard/settings/transport-types">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-blue-200 hover:border-blue-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <GitBranch className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-blue-800">Transport Types</CardTitle>
                      <Badge className="bg-[#EF4444]">Admin Only</Badge>
                    </div>
                    <CardDescription>Manage transport type options in the applicant form</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Truck Brands */}
        {canEditSettings && (
          <Link to="/dashboard/settings/truck-brands">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-blue-200 hover:border-blue-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-blue-800">Truck Brands</CardTitle>
                      <Badge className="bg-[#EF4444]">Admin Only</Badge>
                    </div>
                    <CardDescription>Manage truck brand options in the applicant form</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Trailer Types */}
        {canEditSettings && (
          <Link to="/dashboard/settings/trailer-types">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-blue-200 hover:border-blue-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Tag className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-blue-800">Trailer Types</CardTitle>
                      <Badge className="bg-[#EF4444]">Admin Only</Badge>
                    </div>
                    <CardDescription>Manage trailer type options in the applicant form</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Vehicle Settings — central hub for every vehicle-form lookup list */}
        {canEditSettings && (
          <Link to="/dashboard/settings/vehicles">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-blue-200 hover:border-blue-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-blue-800">Vehicle Settings</CardTitle>
                      <Badge className="bg-[#EF4444]">Admin Only</Badge>
                    </div>
                    <CardDescription>
                      Central hub for vehicle lookups: statuses, fuel types, body / hitch types, ADR classes, document types, and more
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Database Backup & Restore — System Admin only */}
        {canEditSettings && (
          <Link to="/dashboard/settings/database-backup">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-blue-200 hover:border-blue-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Database className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-blue-800">Database Backup & Restore</CardTitle>
                      <Badge className="bg-blue-600">Admin Only</Badge>
                    </div>
                    <CardDescription>Create, manage, and restore full PostgreSQL backups</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* System Information — System Admin only */}
        {canEditSettings && (
          <Link to="/dashboard/settings/system-information">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-slate-200 hover:border-slate-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Server className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-slate-800">System Information</CardTitle>
                      <Badge className="bg-[#EF4444]">Admin Only</Badge>
                    </div>
                    <CardDescription>Edit version, contact info, and organization details</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        {/* Database Cleanup — System Admin only */}
        {canEditSettings && (
          <Link to="/dashboard/settings/database-cleanup">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-red-200 hover:border-red-400">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-red-800">Database Cleanup</CardTitle>
                      <Badge className="bg-red-600">Danger Zone</Badge>
                    </div>
                    <CardDescription>Reset business data while preserving admin accounts</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Server className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <CardTitle>System Information</CardTitle>
                <CardDescription>
                  {systemInfo?.organizationName ? systemInfo.organizationName : 'Live system data from database'}
                </CardDescription>
              </div>
            </div>
            {canEditSettings && (
              <Link to="/dashboard/settings/system-information">
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">System Version</p>
              <p className="font-medium mt-1">{systemInfo?.version || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium mt-1">{systemInfo?.lastUpdated || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Database Status</p>
              <p className="font-medium mt-1 text-[#22C55E]">{systemStats?.databaseStatus ?? '…'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="font-medium mt-1">{systemStats?.totalUsers ?? '…'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
