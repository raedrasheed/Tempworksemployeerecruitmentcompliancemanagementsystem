import { Link } from 'react-router';
import { useState, useEffect } from 'react';
import {
  Users,
  FileCheck,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Plane,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { reportsApi, complianceApi, getCurrentUser } from '../services/api';

export function Dashboard() {
  const currentUser = getCurrentUser();
  const [stats, setStats] = useState<any>(null);
  const [expiringDocs, setExpiringDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsApi.getDashboard(),
      complianceApi.getExpiringDocuments(60),
    ]).then(([dashData, expiringData]) => {
      setStats(dashData?.stats || dashData);
      setExpiringDocs(expiringData || []);
    }).catch(() => {
      // Fall back to empty state if backend not available
      setStats({ totalEmployees: 0, activeEmployees: 0, pendingApplications: 0, expiringDocuments: 0 });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Employees
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#0F172A]">{loading ? '—' : (stats?.totalEmployees ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-[#22C55E]">+{stats?.completedThisMonth ?? 0}</span> this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Employees
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#0F172A]">{loading ? '—' : (stats?.activeEmployees ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalEmployees > 0 ? `${((stats.activeEmployees / stats.totalEmployees) * 100).toFixed(0)}% of total` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Applications
            </CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#0F172A]">{loading ? '—' : (stats?.pendingApplications ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-[#F59E0B]">{stats?.pendingApplications ?? 0}</span> need review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expiring Documents
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#0F172A]">{loading ? '—' : (stats?.expiringDocuments ?? expiringDocs.length)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Within 60 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Applicants Overview Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#2563EB]" />
                Applicants Overview
              </CardTitle>
              <CardDescription>Job applicants awaiting review and conversion</CardDescription>
            </div>
            <Button asChild>
              <Link to="/dashboard/applicants">View All Applicants</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-[#0F172A]">5</div>
              <div className="text-xs text-muted-foreground mt-1">Total Applicants</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-blue-600">1</div>
              <div className="text-xs text-muted-foreground mt-1">New Applications</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">1</div>
              <div className="text-xs text-muted-foreground mt-1">Under Review</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-purple-600">1</div>
              <div className="text-xs text-muted-foreground mt-1">Interview Scheduled</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-green-600">1</div>
              <div className="text-xs text-muted-foreground mt-1">Ready to Convert</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recruitment Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recruitment Pipeline</CardTitle>
            <CardDescription>Current status of employee recruitment process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Document Verification</span>
                <span className="font-medium">15 employees</span>
              </div>
              <Progress value={60} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Work Permit Processing</span>
                <span className="font-medium">8 employees</span>
              </div>
              <Progress value={35} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Visa Application</span>
                <span className="font-medium">12 employees</span>
              </div>
              <Progress value={50} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Final Onboarding</span>
                <span className="font-medium">6 employees</span>
              </div>
              <Progress value={25} className="h-2" />
            </div>

            <div className="pt-4 border-t">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-semibold text-[#2563EB]">{dashboardStats.avgProcessingTime}</div>
                  <div className="text-xs text-muted-foreground mt-1">Avg. Processing Days</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-[#22C55E]">{dashboardStats.approvalRate}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Approval Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-[#F59E0B]">{dashboardStats.visasPending}</div>
                  <div className="text-xs text-muted-foreground mt-1">Visas Pending</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates and changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="flex gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    alert.type === 'warning' ? 'bg-[#F59E0B]' :
                    alert.type === 'success' ? 'bg-[#22C55E]' :
                    alert.type === 'error' ? 'bg-[#EF4444]' :
                    'bg-[#2563EB]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A]">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link to="/dashboard/notifications">View All Notifications</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Employees</CardTitle>
            <CardDescription>Latest employee registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentDrivers.map((driver) => (
                <div key={driver.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                  <div className="flex items-center gap-3">
                    <img 
                      src={driver.photo} 
                      alt={driver.firstName} 
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {driver.firstName} {driver.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{driver.nationality}</p>
                    </div>
                  </div>
                  <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                    {driver.status}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link to="/dashboard/employees">View All Employees</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Expiring Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Expiring Documents</CardTitle>
            <CardDescription>Documents requiring renewal soon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expiringDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{doc.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">{doc.driverName}</p>
                    <p className="text-xs text-muted-foreground">Expires: {doc.expiryDate}</p>
                  </div>
                  <Badge variant="outline" className="bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]">
                    Expiring Soon
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link to="/dashboard/compliance">View Compliance Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Frequently used actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link to="/dashboard/employees/add">
                <Users className="w-6 h-6" />
                <span>Add Employee</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link to="/dashboard/documents/upload">
                <FileCheck className="w-6 h-6" />
                <span>Upload Document</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link to="/dashboard/workflow">
                <TrendingUp className="w-6 h-6" />
                <span>View Workflow</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link to="/dashboard/reports">
                <Plane className="w-6 h-6" />
                <span>Reports</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}