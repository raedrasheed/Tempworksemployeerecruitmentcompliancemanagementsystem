import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import {
  Plus, Edit, Search, Trash2, Upload, Download, Copy, Check,
  ArrowUp, ArrowDown, ArrowUpDown, X, Columns2, RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { usersApi, getCurrentUser, BACKEND_URL } from '../../services/api';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { usePermissions } from '../../hooks/usePermissions';

const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'];

function parseCsvText(text: string): any[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const record: any = {};
    headers.forEach((h, i) => { record[h] = values[i] ?? ''; });
    return record;
  });
}

// ── Column visibility ────────────────────────────────────────────────────────
type ColKey = 'email' | 'role' | 'agency' | 'status' | 'lastLogin';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'email',     label: 'Email' },
  { key: 'role',      label: 'Role' },
  { key: 'agency',    label: 'Agency' },
  { key: 'status',    label: 'Status' },
  { key: 'lastLogin', label: 'Last Login' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  email: true, role: true, agency: true, status: true, lastLogin: true,
};

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem('users-table-columns');
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch { return DEFAULT_VISIBLE; }
}

// ── Sort header ──────────────────────────────────────────────────────────────
type SortField = 'userNumber' | 'name' | 'email' | 'role' | 'agency' | 'status' | 'lastLogin';

function SortableHead({ label, field, sortBy, sortOrder, onSort, className }: {
  label: string; field: SortField; sortBy: SortField; sortOrder: 'asc' | 'desc';
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortBy === field;
  return (
    <TableHead className={className}>
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground font-medium group">
        {label}
        {active
          ? sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
          : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
      </button>
    </TableHead>
  );
}

export function UsersList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const currentUser = getCurrentUser();
  const isTempworksAdmin = currentUser?.role === 'System Admin' || currentUser?.role === 'HR Manager';
  const isAgencyManager = currentUser?.role === 'Agency Manager';

  // Agency Manager can touch an agency user only while they're
  // still PENDING_APPROVAL, or when a Tempworks admin has flipped
  // the per-user override flag on. Tempworks-internal staff keep
  // full control via canEdit / canDelete.
  const canManagerEdit = (user: any) =>
    user.approvalStatus === 'PENDING_APPROVAL' || user.allowManagerEdit === true;
  const canManagerDelete = (user: any) =>
    user.approvalStatus === 'PENDING_APPROVAL' || user.allowManagerDelete === true;
  const mayEditRow = (user: any) =>
    canEdit('users') && (!isAgencyManager || canManagerEdit(user));
  const mayDeleteRow = (user: any) =>
    canDelete('users') && user.id !== currentUser?.id && (!isAgencyManager || canManagerDelete(user));

  // ── Data ───────────────────────────────────────────────────────────────────
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    usersApi.list({ limit: 500 })
      .then((res: any) => setUsers(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]         = useState('');
  const [roleFilter, setRoleFilter]           = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [agencyFilter, setAgencyFilter]       = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [countryFilter, setCountryFilter]     = useState('');

  // ── Sorting ────────────────────────────────────────────────────────────────
  const [sortBy, setSortBy]       = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  // ── Column visibility ──────────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Record<ColKey, boolean>>(loadVisibleColumns);
  const [showColPicker, setShowColPicker]   = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPicker]);

  const toggleColumn = (key: ColKey) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('users-table-columns', JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];

  // ── Derived filter options ─────────────────────────────────────────────────
  const roleOptions = useMemo(() => {
    const names = users.map(u => u.role?.name).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [users]);

  const agencyOptions = useMemo(() => {
    const names = users.map(u => u.agency?.name).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [users]);

  const departmentOptions = useMemo(() => {
    const names = users.map(u => u.department).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [users]);

  const countryOptions = useMemo(() => {
    const names = users.map(u => u.country).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [users]);

  // ── Filtered + sorted data ─────────────────────────────────────────────────
  const displayUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let data = users.filter(user => {
      // Full-text search across every visible & common field — the previous
      // version only checked name/email/role/userNumber, which meant typing
      // an agency (or phone, dept, city, etc.) returned nothing.
      if (q) {
        const haystack = [
          user.firstName, user.middleName, user.lastName,
          user.email, user.userNumber,
          user.phone,
          user.role?.name,
          user.agency?.name,
          user.jobTitle, user.department,
          user.city, user.country, user.postalCode,
          user.citizenship,
          user.status,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (roleFilter       && user.role?.name !== roleFilter)     return false;
      if (statusFilter     && user.status      !== statusFilter)   return false;
      if (agencyFilter     && user.agency?.name !== agencyFilter)  return false;
      if (departmentFilter && user.department   !== departmentFilter) return false;
      if (countryFilter    && user.country      !== countryFilter) return false;
      return true;
    });

    return [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'userNumber': aVal = a.userNumber ?? ''; bVal = b.userNumber ?? ''; break;
        case 'name':       aVal = `${a.firstName ?? ''} ${a.lastName ?? ''}`.toLowerCase(); bVal = `${b.firstName ?? ''} ${b.lastName ?? ''}`.toLowerCase(); break;
        case 'email':      aVal = a.email?.toLowerCase() ?? ''; bVal = b.email?.toLowerCase() ?? ''; break;
        case 'role':       aVal = a.role?.name?.toLowerCase() ?? ''; bVal = b.role?.name?.toLowerCase() ?? ''; break;
        case 'agency':     aVal = a.agency?.name?.toLowerCase() ?? ''; bVal = b.agency?.name?.toLowerCase() ?? ''; break;
        case 'status':     aVal = a.status ?? ''; bVal = b.status ?? ''; break;
        case 'lastLogin':  aVal = a.lastLoginAt ?? ''; bVal = b.lastLoginAt ?? ''; break;
        default:           aVal = ''; bVal = '';
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [users, searchQuery, roleFilter, statusFilter, agencyFilter, departmentFilter, countryFilter, sortBy, sortOrder]);

  const hasActiveFilters = !!(searchQuery || roleFilter || statusFilter || agencyFilter || departmentFilter || countryFilter);
  const clearFilters = () => {
    setSearchQuery(''); setRoleFilter(''); setStatusFilter('');
    setAgencyFilter(''); setDepartmentFilter(''); setCountryFilter('');
  };

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal]   = useState(false);
  const [csvText, setCsvText]                   = useState('');
  const [importing, setImporting]               = useState(false);
  const [activationLink, setActivationLink]     = useState<string | null>(null);
  const [activationLinkUser, setActivationLinkUser] = useState('');
  const [linkCopied, setLinkCopied]             = useState(false);
  const [loadingLink, setLoadingLink]           = useState<string | null>(null);

  const handleDelete = async (user: any) => {
    if (!(await confirm({
      title: 'Delete user?',
      description: `${user.firstName} ${user.lastName} will be permanently removed. This action cannot be undone.`,
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await usersApi.delete(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      toast.success('User deleted successfully');
    } catch (err: any) { toast.error(err?.message || 'Failed to delete user'); }
  };

  // ── Tempworks-admin approval ──────────────────────────────────────────────
  // Per-user manager override (allowManagerEdit/Delete) lives on the
  // Edit User page for a clearer UI; this list only surfaces the
  // Approve action on pending rows.
  const [approveBusy, setApproveBusy] = useState<string | null>(null);

  const handleApprove = async (user: any) => {
    setApproveBusy(user.id);
    try {
      await usersApi.approveAgencyUser(user.id);
      toast.success('User approved');
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve user');
    } finally {
      setApproveBusy(null);
    }
  };

  const handleBulkImport = async () => {
    if (!csvText.trim()) { toast.error('Please paste CSV data first'); return; }
    const records = parseCsvText(csvText);
    if (records.length === 0) { toast.error('No valid records found. Ensure CSV has a header row.'); return; }
    setImporting(true);
    try {
      await usersApi.bulkImport(records);
      toast.success(`${records.length} record(s) imported successfully`);
      setShowImportModal(false); setCsvText('');
      reload();
    } catch (err: any) { toast.error(err?.message || 'Bulk import failed'); }
    finally { setImporting(false); }
  };

  const handleGetActivationLink = async (user: any) => {
    setLoadingLink(user.id);
    try {
      const res = await usersApi.getActivationLink(user.id);
      setActivationLink(res.url);
      setActivationLinkUser(`${user.firstName} ${user.lastName}`);
      setLinkCopied(false);
    } catch (err: any) { toast.error(err?.message || 'Failed to generate activation link'); }
    finally { setLoadingLink(null); }
  };

  const handleCopyLink = () => {
    if (!activationLink) return;
    navigator.clipboard.writeText(activationLink).then(() => {
      setLinkCopied(true);
      toast.success('Activation link copied to clipboard');
      setTimeout(() => setLinkCopied(false), 3000);
    });
  };

  const handleExport = async () => {
    try {
      const data = await usersApi.bulkExport();
      if (!Array.isArray(data) || data.length === 0) { toast.info('No data to export'); return; }
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
  };

  const hiddenCount = ALL_COLUMNS.filter(c => !visibleColumns[c.key]).length;
  const colSpan = 2 + ALL_COLUMNS.filter(c => visibleColumns[c.key]).length + 1; // # + user + visible + actions

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
          {canCreate('users') && (
            <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4 mr-2" />Bulk Import
            </Button>
          )}
          {canCreate('users') && (
            <Button asChild>
              <Link to="/dashboard/users/add">
                <Plus className="w-4 h-4 mr-2" />Add User
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: search (full width, so the icon can't get pushed out of
              place by wrapping filter pills) */}
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, role, agency, phone, dept…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>

          {/* Row 2: filter pills + column picker */}
          <div className="flex flex-wrap gap-3 items-center">
            {roleOptions.length > 0 && (
              <Select value={roleFilter || '__all__'} onValueChange={v => setRoleFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Roles</SelectItem>
                  {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            {agencyOptions.length > 0 && (
              <Select value={agencyFilter || '__all__'} onValueChange={v => setAgencyFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Agencies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Agencies</SelectItem>
                  {agencyOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {departmentOptions.length > 0 && (
              <Select value={departmentFilter || '__all__'} onValueChange={v => setDepartmentFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Departments</SelectItem>
                  {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {countryOptions.length > 0 && (
              <Select value={countryFilter || '__all__'} onValueChange={v => setCountryFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Countries" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Countries</SelectItem>
                  {countryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5 mr-1" />Clear filters
              </Button>
            )}

            {/* Column picker */}
            <div className="relative ml-auto" ref={colPickerRef}>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowColPicker(v => !v)}
                className={showColPicker ? 'border-blue-500 text-blue-600' : ''}
              >
                <Columns2 className="w-4 h-4 mr-1.5" />Columns
                {hiddenCount > 0 && (
                  <span className="ml-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {hiddenCount}
                  </span>
                )}
              </Button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border rounded-lg shadow-lg p-3 min-w-[180px]">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Toggle columns</p>
                  <div className="space-y-0.5">
                    {ALL_COLUMNS.map(c => (
                      <button key={c.key} onClick={() => toggleColumn(c.key)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 text-sm text-left">
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visibleColumns[c.key] ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                          {visibleColumns[c.key] && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t mt-2 pt-2 flex gap-1.5">
                    <button onClick={() => { const all = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>; setVisibleColumns(all); localStorage.setItem('users-table-columns', JSON.stringify(all)); }} className="flex-1 text-xs text-center text-blue-600 hover:underline py-0.5">Show all</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => { const none = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, false])) as Record<ColKey, boolean>; setVisibleColumns(none); localStorage.setItem('users-table-columns', JSON.stringify(none)); }} className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5">Hide all</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-6">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="#"          field="userNumber" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="w-24" />
                  <SortableHead label="User"        field="name"       sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  {col('email')     && <SortableHead label="Email"      field="email"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('role')      && <SortableHead label="Role"       field="role"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('agency')    && <SortableHead label="Agency"     field="agency"    sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('status')    && <SortableHead label="Status"     field="status"    sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('lastLogin') && <SortableHead label="Last Login" field="lastLogin" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : displayUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : displayUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{user.userNumber ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={user.photoUrl ? `${BACKEND_URL}${user.photoUrl}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.firstName}`}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                        <div>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    {col('email')  && <TableCell className="text-sm">{user.email}</TableCell>}
                    {col('role')   && (
                      <TableCell>
                        <Badge variant="outline" className={
                          user.role?.name?.toLowerCase().includes('admin') ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]' :
                          user.role?.name?.toLowerCase().includes('hr')    ? 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]' :
                          'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                        }>
                          {user.role?.name ?? '—'}
                        </Badge>
                      </TableCell>
                    )}
                    {col('agency')    && <TableCell className="text-sm">{user.agency?.name ?? '—'}</TableCell>}
                    {col('status')    && (
                      <TableCell>
                        <Badge className={user.status === 'ACTIVE' ? 'bg-green-500' : user.status === 'PENDING' ? 'bg-amber-500' : user.status === 'SUSPENDED' ? 'bg-red-500' : 'bg-gray-500'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                    )}
                    {col('lastLogin') && (
                      <TableCell className="text-sm">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit('users') && (user.status === 'PENDING' || user.status === 'INACTIVE') && (
                          <Button variant="ghost" size="sm" onClick={() => handleGetActivationLink(user)} disabled={loadingLink === user.id} className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-xs" title="Get activation link">
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            {loadingLink === user.id ? '...' : 'Activation Link'}
                          </Button>
                        )}
                        {/* Pending-approval badge + Tempworks admin Approve button */}
                        {user.approvalStatus === 'PENDING_APPROVAL' && (
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Pending approval</Badge>
                        )}
                        {isTempworksAdmin && user.approvalStatus === 'PENDING_APPROVAL' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(user)}
                            disabled={approveBusy === user.id}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs"
                            title="Approve this agency-created user"
                          >
                            {approveBusy === user.id ? '…' : 'Approve'}
                          </Button>
                        )}
                        {/* Per-user manager override toggles live on the Edit User page — System Admin only. */}
                        {mayEditRow(user) && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/users/${user.id}/edit`}><Edit className="w-4 h-4 mr-1" />Edit</Link>
                          </Button>
                        )}
                        {mayDeleteRow(user) && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(user)} className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Showing {displayUsers.length} of {users.length} users
          </p>
        </CardContent>
      </Card>

      {/* Activation Link Modal */}
      {activationLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#0F172A]">Activation Link</h2>
              <Button variant="ghost" size="sm" onClick={() => setActivationLink(null)}>✕</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with <strong>{activationLinkUser}</strong> so they can set their password and activate their account. The link expires in <strong>60 minutes</strong>.
            </p>
            <div className="bg-gray-50 border rounded-md p-3 break-all text-sm font-mono text-gray-700">{activationLink}</div>
            <div className="flex gap-3 pt-1">
              <Button className="flex-1" onClick={handleCopyLink}>
                {linkCopied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setActivationLink(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#0F172A]">Bulk Import Users</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowImportModal(false); setCsvText(''); }}>✕</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste CSV data below. The first row must be a header row with field names
              (e.g. <code className="bg-gray-100 px-1 rounded text-xs">firstName,lastName,email,roleId,agencyId</code>).
            </p>
            <div className="space-y-2">
              <Label htmlFor="csvInput">CSV Data</Label>
              <textarea
                id="csvInput" rows={10}
                className="w-full border rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder={`firstName,lastName,email,roleId,agencyId\nJohn,Smith,john@example.com,role-id,agency-id`}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
              />
            </div>
            {csvText.trim() && (
              <p className="text-xs text-muted-foreground">Preview: {parseCsvText(csvText).length} record(s) detected</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={handleBulkImport} disabled={importing || !csvText.trim()}>
                {importing ? 'Importing...' : 'Import Records'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setShowImportModal(false); setCsvText(''); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
