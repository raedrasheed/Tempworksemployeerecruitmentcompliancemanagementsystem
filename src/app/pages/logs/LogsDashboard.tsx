import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Trash2, RefreshCw, FileText, Users, Activity, Shield, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { logsApi } from '../../services/api';
import { useAuthContext } from '../../contexts/AuthContext';

// ─── helpers ─────────────────────────────────────────────────────────────────
function getActionBadge(action: string) {
  const a = action?.toUpperCase() ?? '';
  if (a === 'CREATE') return <Badge className="bg-emerald-500 text-white">{action}</Badge>;
  if (a === 'UPDATE' || a === 'UPDATE_PROFILE') return <Badge className="bg-blue-500 text-white">{action}</Badge>;
  if (a === 'DELETE') return <Badge className="bg-red-500 text-white">{action}</Badge>;
  if (a === 'LOGIN') return <Badge className="bg-violet-500 text-white">LOGIN</Badge>;
  if (a === 'LOGOUT') return <Badge variant="outline">LOGOUT</Badge>;
  if (a === 'LOGIN_FAILED' || a === 'CHANGE_PASSWORD_FAILED') return <Badge className="bg-orange-500 text-white">{action}</Badge>;
  if (a.includes('UPLOAD') || a.includes('VERIFY')) return <Badge className="bg-cyan-500 text-white">{action}</Badge>;
  if (a.includes('STAGE') || a.includes('WORKFLOW')) return <Badge className="bg-amber-500 text-white">{action}</Badge>;
  if (a.includes('CHANGE_PASSWORD') || a.includes('PASSWORD')) return <Badge className="bg-purple-500 text-white">{action}</Badge>;
  return <Badge variant="outline">{action}</Badge>;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
}

function exportToCsv(rows: any[]) {
  const headers = ['Timestamp', 'User', 'Email', 'Action', 'Entity', 'EntityId', 'IP Address'];
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      formatDate(r.createdAt),
      r.user ? `${r.user.firstName} ${r.user.lastName}` : r.userEmail ?? '—',
      r.user?.email ?? r.userEmail ?? '—',
      r.action,
      r.entity,
      r.entityId,
      r.ipAddress ?? '—',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── component ───────────────────────────────────────────────────────────────
export function LogsDashboard() {
  const { user: currentUser } = useAuthContext();
  const isAdmin = currentUser?.role === 'System Admin';

  // filters
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // data
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // clear logs dialog
  const [clearOpen, setClearOpen] = useState(false);
  const [clearFrom, setClearFrom] = useState('');
  const [clearTo, setClearTo] = useState('');
  const [clearEntity, setClearEntity] = useState('');
  const [clearing, setClearing] = useState(false);

  const getDateFilter = useCallback(() => {
    const now = new Date();
    if (dateRange === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { fromDate: start.toISOString() };
    }
    if (dateRange === 'week') {
      const start = new Date(now.getTime() - 7 * 86400000);
      return { fromDate: start.toISOString() };
    }
    if (dateRange === 'month') {
      const start = new Date(now.getTime() - 30 * 86400000);
      return { fromDate: start.toISOString() };
    }
    if (dateRange === 'quarter') {
      const start = new Date(now.getTime() - 90 * 86400000);
      return { fromDate: start.toISOString() };
    }
    return {};
  }, [dateRange]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit, search: search || undefined };
      if (entityFilter !== 'all') params.entity = entityFilter;
      if (actionFilter !== 'all') params.action = actionFilter;
      Object.assign(params, getDateFilter());
      // strip undefined
      Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
      const res = await logsApi.list(params);
      setLogs(res?.data ?? res?.items ?? []);
      setTotal(res?.total ?? res?.meta?.total ?? 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, entityFilter, actionFilter, getDateFilter]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await logsApi.getStats();
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [search, entityFilter, actionFilter, dateRange]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const filters: any = {};
      if (clearFrom) filters.fromDate = clearFrom;
      if (clearTo) filters.toDate = clearTo;
      if (clearEntity && clearEntity !== 'all') filters.entity = clearEntity;
      await logsApi.clearLogs(filters);
      setClearOpen(false);
      setClearFrom(''); setClearTo(''); setClearEntity('');
      await Promise.all([fetchLogs(), fetchStats()]);
    } finally {
      setClearing(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  // Unique entities for filter dropdowns (from stats or hardcoded)
  const knownEntities = ['User', 'Role', 'Agency', 'Employee', 'Applicant', 'Application',
    'Document', 'WorkflowStage', 'JobType', 'DocumentType', 'NotificationRule', 'Settings'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">System Logs</h1>
          <p className="text-muted-foreground mt-1">Full audit trail of all system activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchLogs(); fetchStats(); }}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv(logs)} disabled={logs.length === 0}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear Logs
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: FileText, label: 'Total Logs',
            value: statsLoading ? '…' : (stats?.total ?? 0).toLocaleString(),
            color: 'text-primary', bg: 'bg-primary/10',
          },
          {
            icon: Activity, label: 'Last 24 hours',
            value: statsLoading ? '…' : (stats?.last24hCount ?? 0).toLocaleString(),
            color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          },
          {
            icon: Shield, label: 'Last 7 days',
            value: statsLoading ? '…' : (stats?.last7dCount ?? 0).toLocaleString(),
            color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30',
          },
          {
            icon: Users, label: 'Top Modules',
            value: statsLoading ? '…' : (stats?.byEntity?.length ?? 0).toLocaleString(),
            color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/30',
          },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xl font-semibold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top entities breakdown */}
      {stats?.byEntity?.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Activity by Module</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byEntity.slice(0, 6).map((row: any) => (
                  <div key={row.entity} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.entity}</span>
                    <Badge variant="outline">{row._count.id.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Activity by Action</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byAction.slice(0, 6).map((row: any) => (
                  <div key={row.action} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.action}</span>
                    <Badge variant="outline">{row._count.id.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by action, entity, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger><SelectValue placeholder="Date Range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger><SelectValue placeholder="Module / Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {knownEntities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
                <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
                <SelectItem value="UPLOAD">Upload</SelectItem>
                <SelectItem value="VERIFY">Verify</SelectItem>
                <SelectItem value="CHANGE_PASSWORD">Change Password</SelectItem>
                <SelectItem value="STAGE_CHANGE">Stage Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Activity Logs
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {loading ? 'Loading…' : `${total.toLocaleString()} entries`}
            </span>
          </CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-muted-foreground">Page {page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Module</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Changes</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-muted animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No log entries found matching the current filters
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const userName = log.user
                      ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim()
                      : log.userEmail ?? '—';
                    const changes = log.changes
                      ? JSON.stringify(log.changes).slice(0, 80) + (JSON.stringify(log.changes).length > 80 ? '…' : '')
                      : '—';
                    return (
                      <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{userName}</p>
                          {log.user?.email && log.user.email !== userName && (
                            <p className="text-xs text-muted-foreground">{log.user.email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{log.entity}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {log.entityId?.slice(0, 12)}…
                          </code>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={JSON.stringify(log.changes)}>
                          {changes}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{log.ipAddress ?? '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear Logs Dialog – System Admin only */}
      {isAdmin && (
        <Dialog open={clearOpen} onOpenChange={setClearOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Clear Audit Logs</DialogTitle>
              <DialogDescription>
                Permanently delete log entries. Leave date fields empty to clear all logs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">This action is irreversible and cannot be undone.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="clearFrom">From Date</Label>
                  <Input id="clearFrom" type="date" value={clearFrom} onChange={e => setClearFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clearTo">To Date</Label>
                  <Input id="clearTo" type="date" value={clearTo} onChange={e => setClearTo(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clearEntity">Module / Entity (optional)</Label>
                <Select value={clearEntity} onValueChange={setClearEntity}>
                  <SelectTrigger id="clearEntity"><SelectValue placeholder="All modules" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All modules</SelectItem>
                    {knownEntities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                {!clearFrom && !clearTo && !clearEntity
                  ? 'All log entries will be permanently deleted.'
                  : `Logs matching the selected filters will be deleted.`}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearLogs}
                disabled={clearing}
              >
                {clearing ? 'Deleting…' : 'Delete Logs'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
