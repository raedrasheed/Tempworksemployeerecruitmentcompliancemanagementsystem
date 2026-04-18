import { Link } from 'react-router';
import { useState, useEffect } from 'react';
import {
  Users, FileCheck, Clock, AlertTriangle, TrendingUp,
  CheckCircle2, ArrowUp, ArrowDown, Minus, Activity,
  FileX, Zap, BarChart3, UserPlus, RefreshCw, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { dashboardApi, getCurrentUser } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    ACTIVE:      'bg-emerald-100 text-emerald-700',
    INACTIVE:    'bg-gray-100 text-gray-600',
    PENDING:     'bg-amber-100 text-amber-700',
    ONBOARDING:  'bg-blue-100 text-blue-700',
    TERMINATED:  'bg-red-100 text-red-600',
    ON_LEAVE:    'bg-purple-100 text-purple-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function activityColor(action: string) {
  const a = action?.toUpperCase() ?? '';
  if (a.includes('DELETE') || a.includes('REJECT'))   return 'bg-red-500';
  if (a.includes('CREATE') || a.includes('UPLOAD'))   return 'bg-emerald-500';
  if (a.includes('UPDATE') || a.includes('EDIT'))     return 'bg-blue-500';
  if (a.includes('VERIFY') || a.includes('APPROVE'))  return 'bg-emerald-500';
  if (a.includes('LOGIN') || a.includes('LOGOUT'))    return 'bg-gray-400';
  return 'bg-amber-500';
}

function activityLabel(action: string, entity: string) {
  const a = action?.toUpperCase() ?? '';
  const e = entity ? entity.charAt(0).toUpperCase() + entity.slice(1).toLowerCase() : '';
  if (a === 'UPLOAD')  return `${e} uploaded`;
  if (a === 'VERIFY')  return `${e} verified`;
  if (a === 'REJECT')  return `${e} rejected`;
  if (a === 'CREATE')  return `${e} created`;
  if (a === 'UPDATE')  return `${e} updated`;
  if (a === 'DELETE')  return `${e} deleted`;
  if (a === 'RENEW')   return `${e} renewed`;
  if (a === 'CONVERT') return `${e} converted`;
  return `${e} ${action?.toLowerCase() ?? ''}`.trim();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Map workflow stage names to the 4 required display categories
const STAGE_KEYWORDS: { label: string; keywords: string[] }[] = [
  { label: 'Document Verification', keywords: ['document', 'verification', 'doc'] },
  { label: 'Work Permit',           keywords: ['permit', 'work permit'] },
  { label: 'Visa',                  keywords: ['visa'] },
  { label: 'Onboarding',            keywords: ['onboard', 'onboarding', 'deployment'] },
];

function matchStageToCategory(stageName: string) {
  const lower = stageName.toLowerCase();
  for (const cat of STAGE_KEYWORDS) {
    if (cat.keywords.some(k => lower.includes(k))) return cat.label;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const currentUser = getCurrentUser();
  const isAgencyUser = currentUser?.role === 'Agency User' || currentUser?.role === 'Agency Manager';
  // Leads are Tempworks-internal only. For agency accounts every
  // applicant link targets the Candidates view instead.
  const applicantsPath = isAgencyUser ? '/dashboard/candidates' : '/dashboard/applicants';
  const { canCreate, can } = usePermissions();

  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else             setLoading(true);
    setError(false);
    try {
      const result = await dashboardApi.getOverview();
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Derived values ─────────────────────────────────────────────────────────

  const employees      = data?.employees   ?? {};
  const applicants     = data?.applicants  ?? {};
  const documents      = data?.documents   ?? {};
  const workflow       = data?.pipeline    ?? {};
  const recentEmps     = data?.recentEmployees   ?? [];
  const expiredDocs    = data?.expiredDocuments  ?? [];
  const recentActivity = data?.recentActivity    ?? [];

  const totalEmp       = employees.total        ?? 0;
  const activeEmp      = employees.active       ?? 0;
  const deltaThisMonth = employees.newThisMonth ?? 0;

  const pendingApps    = applicants.pending      ?? 0;
  const totalApps      = applicants.total        ?? 0;
  const appByStatus: { status: string; count: number }[] = applicants.byStatus ?? [];

  const expiringSoon        = documents.expiringSoon          ?? 0;
  const expiredUnrenewed    = documents.expiredUnrenewedCount ?? 0;

  const workflowStages: any[]    = workflow.stages           ?? [];
  const avgDays:         number | null = workflow.avgProcessingDays ?? null;
  const approvalRate:    number | null = workflow.approvalRate      ?? null;

  // Aggregate workflow into the 4 required categories
  const workflowSummary = STAGE_KEYWORDS.map(cat => {
    const matching = workflowStages.filter(s => matchStageToCategory(s.name) === cat.label);
    const count    = matching.reduce((sum, s) => sum + (s.count ?? 0), 0);
    return { label: cat.label, count };
  });
  const workflowTotal = workflowSummary.reduce((s, c) => s + c.count, 0);

  // Applicant status lookups
  const appStatus = (s: string) => appByStatus.find(x => x.status === s)?.count ?? 0;

  // ── Stat card sub-component ────────────────────────────────────────────────
  const Skeleton = () => <div className="h-7 w-16 bg-muted animate-pulse rounded" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load dashboard data. <button className="underline" onClick={() => load()}>Retry</button>
        </div>
      )}

      {/* ── Widget Row 1: Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Employees */}
        <Link to="/dashboard/employees" className="group">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton /> : <div className="text-3xl font-bold text-[#0F172A]">{totalEmp}</div>}
              <div className="flex items-center gap-1 mt-1 text-xs">
                {deltaThisMonth > 0
                  ? <><ArrowUp className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600 font-medium">+{deltaThisMonth}</span><span className="text-muted-foreground ml-1">this month</span></>
                  : deltaThisMonth < 0
                  ? <><ArrowDown className="w-3 h-3 text-red-500" /><span className="text-red-600 font-medium">{deltaThisMonth}</span><span className="text-muted-foreground ml-1">this month</span></>
                  : <><Minus className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">No change this month</span></>
                }
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 2. Active Employees */}
        <Link to="/dashboard/employees?status=ACTIVE" className="group">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Employees</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton /> : <div className="text-3xl font-bold text-[#0F172A]">{activeEmp}</div>}
              <div className="flex items-center gap-1 mt-1 text-xs">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-600 font-medium">Active</span>
                {totalEmp > 0 && !loading && (
                  <span className="text-muted-foreground ml-1">
                    ({((activeEmp / totalEmp) * 100).toFixed(0)}% of total)
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 3. Pending Applications */}
        <Link to={`${applicantsPath}?status=NEW`} className="group">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Applications</CardTitle>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton /> : <div className="text-3xl font-bold text-[#0F172A]">{pendingApps}</div>}
              <div className="flex items-center gap-1 mt-1 text-xs">
                {pendingApps > 0
                  ? <><span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{pendingApps} need review</span></>
                  : <span className="text-muted-foreground">All reviewed</span>
                }
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 4. Expiring Documents */}
        <Link to="/dashboard/documents-compliance?status=EXPIRING_SOON" className="group">
          <Card className={`hover:shadow-md transition-shadow cursor-pointer h-full ${expiringSoon > 0 ? 'border-amber-300' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Documents</CardTitle>
              <AlertTriangle className={`w-4 h-4 ${expiringSoon > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              {loading
                ? <Skeleton />
                : <div className={`text-3xl font-bold ${expiringSoon > 0 ? 'text-amber-600' : 'text-[#0F172A]'}`}>{expiringSoon}</div>
              }
              <div className="mt-1 text-xs">
                {expiringSoon > 0
                  ? <span className="text-amber-600 font-medium">Within 60 days — action needed</span>
                  : <span className="text-muted-foreground">Within 60 days</span>
                }
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Widget Row 2: Applicants Overview ── */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#0F172A]">
                <Users className="w-5 h-5 text-[#2563EB]" />
                Applicants Overview
              </CardTitle>
              <CardDescription>Job applicants by current status</CardDescription>
            </div>
            <Button asChild size="sm">
              <Link to={applicantsPath}>{isAgencyUser ? 'View All Candidates' : 'View All Applicants'}</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Total',             value: totalApps,            color: 'text-[#0F172A]',  link: applicantsPath },
              { label: 'New / Unreviewed',  value: appStatus('NEW'),      color: 'text-blue-600',   link: `${applicantsPath}?status=NEW` },
              { label: 'Screening',         value: appStatus('SCREENING'),color: 'text-amber-600',  link: `${applicantsPath}?status=SCREENING` },
              { label: 'Interview',         value: appStatus('INTERVIEW'),color: 'text-purple-600', link: `${applicantsPath}?status=INTERVIEW` },
              { label: 'Offer Made',        value: appStatus('OFFER'),    color: 'text-indigo-600', link: `${applicantsPath}?status=OFFER` },
              { label: 'Accepted',          value: appStatus('ACCEPTED'), color: 'text-emerald-600',link: `${applicantsPath}?status=ACCEPTED` },
            ].map(({ label, value, color, link }) => (
              <Link key={label} to={link}>
                <div className="text-center p-3 bg-white rounded-lg hover:shadow-sm transition-shadow cursor-pointer">
                  {loading
                    ? <div className="h-7 w-10 bg-muted animate-pulse rounded mx-auto" />
                    : <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  }
                  <div className="text-xs text-muted-foreground mt-1 leading-tight">{label}</div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Widget Row 3: Workflow + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 5. Recruitment Workflow */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recruitment Workflow</CardTitle>
                <CardDescription>Current stage distribution of employees in the recruitment process</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/workflows">View Workflow <ChevronRight className="w-3 h-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading
              ? [1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-1">
                    <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                    <div className="h-2 bg-muted animate-pulse rounded" />
                  </div>
                ))
              : workflowStages.length === 0
              ? <p className="text-sm text-muted-foreground py-4 text-center">No active workflow stages configured.</p>
              : workflowSummary.map(({ label, count }) => {
                  const pct = workflowTotal > 0 ? Math.round((count / workflowTotal) * 100) : 0;
                  return (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{count} employee{count !== 1 ? 's' : ''}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })
            }

            <div className="pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-semibold text-[#2563EB]">
                    {loading ? '—' : avgDays !== null ? `${avgDays}d` : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Avg. Processing Days</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-emerald-600">
                    {loading ? '—' : approvalRate !== null ? `${approvalRate}%` : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Approval Rate</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest system events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading
              ? <div className="space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              : recentActivity.length === 0
              ? <p className="text-sm text-muted-foreground py-4 text-center">No recent activity.</p>
              : <div className="space-y-3">
                  {recentActivity.map((item: any) => (
                    <div key={item.id} className="flex gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${activityColor(item.action)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] leading-tight">
                          {activityLabel(item.action, item.entity)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.userEmail ?? 'System'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
            }
            <Button variant="outline" className="w-full mt-4" size="sm" asChild>
              <Link to="/dashboard/logs">View All Activity</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Widget Row 4: Recent Employees + Expired Documents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7. Recent Employees */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Employees</CardTitle>
                <CardDescription>Latest registrations</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/employees">View All <ChevronRight className="w-3 h-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading
              ? <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
                </div>
              : recentEmps.length === 0
              ? <div className="text-center py-8 text-muted-foreground text-sm">No employees registered yet.</div>
              : <div className="space-y-2">
                  {recentEmps.map((emp: any) => (
                    <Link key={emp.id} to={`/dashboard/employees/${emp.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center shrink-0">
                            {emp.photoUrl
                              ? <img
                                  src={`${API_BASE}${emp.photoUrl}`}
                                  alt={emp.firstName}
                                  className="w-full h-full object-cover"
                                />
                              : <span className="text-blue-600 text-sm font-semibold">
                                  {emp.firstName?.[0]}{emp.lastName?.[0]}
                                </span>
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#0F172A]">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {emp.employeeNumber ?? '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(emp.status)}`}>
                          {emp.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
            }
          </CardContent>
        </Card>

        {/* 8. Expired Documents (not yet renewed) */}
        <Card className={expiredUnrenewed > 0 ? 'border-red-200' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileX className={`w-4 h-4 ${expiredUnrenewed > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                  Expired Documents
                </CardTitle>
                <CardDescription>
                  {loading ? '…' : `${expiredUnrenewed} expired with no renewal`}
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/documents-compliance">View All <ChevronRight className="w-3 h-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading
              ? <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
                </div>
              : expiredDocs.length === 0
              ? <div className="text-center py-8 text-muted-foreground text-sm">
                  {expiredUnrenewed === 0 ? 'No expired documents without renewals.' : 'Showing 0 of 0 expired documents.'}
                </div>
              : <div className="space-y-2">
                  {expiredDocs.map((doc: any) => {
                    const expDate  = doc.expiryDate ? new Date(doc.expiryDate) : null;
                    const daysAgo  = expDate ? Math.floor((Date.now() - expDate.getTime()) / 86400000) : null;
                    return (
                      <Link key={doc.id} to={`/dashboard/documents/${doc.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-red-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0F172A] truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.ownerName ?? doc.entityId?.slice(0, 8)}
                              {doc.documentType?.name ? ` · ${doc.documentType.name}` : ''}
                            </p>
                            {expDate && (
                              <p className="text-xs text-red-500">
                                Expired {expDate.toLocaleDateString()} ({daysAgo}d ago)
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-300 ml-2 shrink-0">
                            Expired
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                  {expiredUnrenewed > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{expiredUnrenewed - 5} more —{' '}
                      <Link to="/dashboard/documents-compliance" className="underline">view all</Link>
                    </p>
                  )}
                </div>
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Widget Row 5: Quick Actions ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            Quick Actions
          </CardTitle>
          <CardDescription>Shortcuts to common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {canCreate('employees') && (
              <Button variant="outline" className="h-auto flex-col gap-2 p-4 hover:bg-blue-50 hover:border-blue-300" asChild>
                <Link to="/dashboard/employees/add">
                  <UserPlus className="w-6 h-6 text-blue-600" />
                  <span className="text-sm">Add Employee</span>
                </Link>
              </Button>
            )}
            {canCreate('documents') && (
              <Button variant="outline" className="h-auto flex-col gap-2 p-4 hover:bg-emerald-50 hover:border-emerald-300" asChild>
                <Link to="/dashboard/documents/upload">
                  <FileCheck className="w-6 h-6 text-emerald-600" />
                  <span className="text-sm">Upload Document</span>
                </Link>
              </Button>
            )}
            {can('workflow', 'read') && (
              <Button variant="outline" className="h-auto flex-col gap-2 p-4 hover:bg-purple-50 hover:border-purple-300" asChild>
                <Link to="/dashboard/workflows">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                  <span className="text-sm">View Workflow</span>
                </Link>
              </Button>
            )}
            {can('reports', 'read') && (
              <Button variant="outline" className="h-auto flex-col gap-2 p-4 hover:bg-amber-50 hover:border-amber-300" asChild>
                <Link to="/dashboard/reports">
                  <BarChart3 className="w-6 h-6 text-amber-600" />
                  <span className="text-sm">Reports</span>
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
