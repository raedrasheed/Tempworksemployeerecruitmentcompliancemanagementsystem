import { Link, useParams } from 'react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, Mail, Phone, MapPin, Users, Shield, ChevronRight, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { agenciesApi, getCurrentUser } from '../../services/api';
import { FinancialRecordsTab } from '../../components/finance/FinancialRecordsTab';

// Roles that can SEE the internal agency financial records. Agency users
// (external) are intentionally excluded from every list so the tab does
// not render at all for them.
const FINANCE_VIEW_ROLES   = ['System Admin', 'HR Manager', 'Finance', 'Recruiter'];
const FINANCE_WRITE_ROLES  = ['System Admin', 'HR Manager', 'Finance'];
const FINANCE_STATUS_ROLES = ['System Admin', 'Finance'];

export function AgencyProfile() {
  const { id } = useParams();
  const [agency, setAgency] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [agencyUsers, setAgencyUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState({ maxUsers: '10' });

  // Financial records are for Tempworks-internal staff only. Agency users
  // never see the tab, and the backend enforces role checks independently
  // so hiding is defence-in-depth not the primary gate.
  const currentUser = getCurrentUser();
  const userRole = currentUser?.role ?? '';
  const canViewFinance   = FINANCE_VIEW_ROLES.includes(userRole);
  const canWriteFinance  = FINANCE_WRITE_ROLES.includes(userRole);
  const canStatusFinance = FINANCE_STATUS_ROLES.includes(userRole);

  useEffect(() => {
    Promise.all([
      agenciesApi.get(id!),
      agenciesApi.getEmployees(id!, { limit: 50 }),
      agenciesApi.getUsers(id!),
    ]).then(([agencyData, empData, usersData]) => {
      setAgency(agencyData);
      setEmployees((empData as any)?.data ?? empData ?? []);
      setAgencyUsers((usersData as any)?.data ?? usersData ?? []);
      setSettings({ maxUsers: String((agencyData as any).maxUsersPerAgency ?? 10) });
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await agenciesApi.update(id!, { maxUsersPerAgency: parseInt(settings.maxUsers, 10) });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (notFound || !agency) return <div className="p-8">Agency not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/agencies"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">{agency.name}</h1>
          <p className="text-muted-foreground mt-1">Agency Profile & Management</p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/dashboard/agencies/${id}/users`}>
            <Users className="w-4 h-4 mr-2" />
            Manage Users
          </Link>
        </Button>
      </div>

      {/* Agency Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Country</p>
                <p className="font-medium">{agency.country}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{agency.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{agency.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Contact Person</p>
                <p className="font-medium">{agency.contactPerson}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {employees.filter(e => e.status === 'ACTIVE').length}
                </p>
                <p className="text-sm text-muted-foreground">Active Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{employees.length}</p>
                <p className="text-sm text-muted-foreground">Total Employees</p>
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
                <p className="text-2xl font-semibold">{agencyUsers.length}/{settings.maxUsers}</p>
                <p className="text-sm text-muted-foreground">Agency Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <Badge className={agency.status === 'ACTIVE' ? 'bg-[#22C55E]' : 'bg-gray-500'}>
                  {agency.status}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          {canViewFinance && <TabsTrigger value="finance">Financial Records</TabsTrigger>}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Agency Employees ({employees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-muted-foreground">No employees found for this agency.</p>
              ) : (
                <div className="space-y-3">
                  {employees.map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-[#F8FAFC] transition-colors">
                      <div>
                        <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                        <p className="text-sm text-muted-foreground">{emp.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={
                          emp.status === 'ACTIVE' ? 'bg-[#22C55E]' :
                          emp.status === 'PENDING' ? 'bg-[#F59E0B]' :
                          'bg-gray-500'
                        }>
                          {emp.status}
                        </Badge>
                        <Button size="sm" asChild>
                          <Link to={`/dashboard/employees/${emp.id}`}>
                            View Profile
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Agency Users ({agencyUsers.length})</CardTitle>
              <Button asChild>
                <Link to={`/dashboard/agencies/${id}/users`}>
                  <Users className="w-4 h-4 mr-2" />
                  Manage All Users
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {agencyUsers.length === 0 ? (
                <p className="text-muted-foreground">No users found for this agency.</p>
              ) : (
                <div className="space-y-3">
                  {agencyUsers.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge>{user.role?.name ?? user.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canViewFinance && (
          <TabsContent value="finance">
            <FinancialRecordsTab
              entityType="AGENCY"
              entityId={id!}
              canWrite={canWriteFinance}
              canChangeStatus={canStatusFinance}
            />
          </TabsContent>
        )}

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Agency Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="maxUsers">Maximum Number of Users</Label>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Limit the number of active users for this agency
                </p>
                <Select value={settings.maxUsers} onValueChange={val => setSettings(prev => ({ ...prev, maxUsers: val }))}>
                  <SelectTrigger id="maxUsers">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 users</SelectItem>
                    <SelectItem value="10">10 users</SelectItem>
                    <SelectItem value="15">15 users</SelectItem>
                    <SelectItem value="20">20 users</SelectItem>
                    <SelectItem value="50">50 users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  <Settings className="w-4 h-4 mr-2" />
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
