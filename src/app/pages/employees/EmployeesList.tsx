import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Download, Eye, Edit, Trash2, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, X, Columns2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { employeesApi, agenciesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

const STATUSES = ['ACTIVE', 'PENDING', 'ONBOARDING', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE'];

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':     return 'bg-green-500 text-white';
    case 'PENDING':    return 'bg-amber-500 text-white';
    case 'ONBOARDING': return 'bg-blue-600 text-white';
    case 'ON_LEAVE':   return 'bg-purple-500 text-white';
    default:           return 'bg-gray-500 text-white';
  }
};

type SortField = 'firstName' | 'email' | 'nationality' | 'licenseNumber' | 'yearsExperience' | 'agency' | 'status' | 'createdAt';
type SortOrder = 'asc' | 'desc';

// ── Column visibility ────────────────────────────────────────────────────────
type ColKey = 'contact' | 'nationality' | 'license' | 'experience' | 'agency' | 'status';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'contact',     label: 'Contact' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'license',     label: 'ID / License' },
  { key: 'experience',  label: 'Experience' },
  { key: 'agency',      label: 'Agency' },
  { key: 'status',      label: 'Status' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  contact: true, nationality: true, license: true,
  experience: true, agency: true, status: true,
};

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem('employees-table-columns');
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

// ── Sortable header ──────────────────────────────────────────────────────────
function SortableHead({ label, field, sortBy, sortOrder, onSort }: {
  label: string; field: SortField; sortBy: SortField; sortOrder: SortOrder; onSort: (f: SortField) => void;
}) {
  const active = sortBy === field;
  return (
    <TableHead>
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground font-medium group">
        {label}
        {active
          ? sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
          : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
      </button>
    </TableHead>
  );
}

export function EmployeesList() {
  const { canCreate, canEdit, canDelete } = usePermissions();

  // ── Column visibility ──────────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Record<ColKey, boolean>>(loadVisibleColumns);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPicker]);

  const toggleColumn = (key: ColKey) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('employees-table-columns', JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]               = useState('');
  const [statusFilter, setStatusFilter]           = useState('');
  const [agencyFilter, setAgencyFilter]           = useState('');
  const [nationalityFilter, setNationalityFilter] = useState('');
  const [dateFrom, setDateFrom]                   = useState('');
  const [dateTo, setDateTo]                       = useState('');

  // ── Sorting (client-side) ──────────────────────────────────────────────────
  const [sortBy, setSortBy]       = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
  };

  // ── Data ───────────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<any[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState<any[]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: 1, limit: 500 };
      if (searchTerm)       params.search    = searchTerm;
      if (statusFilter)     params.status    = statusFilter;
      if (agencyFilter)     params.agencyId  = agencyFilter;
      if (nationalityFilter) params.nationality = nationalityFilter;
      const result = await employeesApi.list(params);
      setEmployees(result.data || []);
      setTotalEmployees(result.meta?.total || 0);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, agencyFilter, nationalityFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  useEffect(() => {
    agenciesApi.list({ limit: 200 }).then((r: any) => setAgencies(r?.data ?? [])).catch(() => {});
  }, []);

  // ── Sorted + date-filtered display data ───────────────────────────────────
  const displayData = useMemo(() => {
    let data = employees;
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const to   = dateTo   ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
      data = data.filter(e => {
        const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
        return t >= from && t <= to;
      });
    }
    return [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'firstName':       aVal = `${a.firstName ?? ''} ${a.lastName ?? ''}`.toLowerCase(); bVal = `${b.firstName ?? ''} ${b.lastName ?? ''}`.toLowerCase(); break;
        case 'email':           aVal = a.email?.toLowerCase() ?? ''; bVal = b.email?.toLowerCase() ?? ''; break;
        case 'nationality':     aVal = a.nationality?.toLowerCase() ?? ''; bVal = b.nationality?.toLowerCase() ?? ''; break;
        case 'licenseNumber':   aVal = a.licenseNumber?.toLowerCase() ?? ''; bVal = b.licenseNumber?.toLowerCase() ?? ''; break;
        case 'yearsExperience': aVal = Number(a.yearsExperience ?? 0); bVal = Number(b.yearsExperience ?? 0); break;
        case 'agency':          aVal = (a.agency?.name ?? a.agencyName ?? '').toLowerCase(); bVal = (b.agency?.name ?? b.agencyName ?? '').toLowerCase(); break;
        case 'status':          aVal = a.status ?? ''; bVal = b.status ?? ''; break;
        case 'createdAt':       aVal = a.createdAt ?? ''; bVal = b.createdAt ?? ''; break;
        default:                aVal = ''; bVal = '';
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [employees, sortBy, sortOrder, dateFrom, dateTo]);

  const nationalityOptions = useMemo(() => {
    const all = employees.map(e => e.nationality).filter(Boolean) as string[];
    return [...new Set(all)].sort();
  }, [employees]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (employee: any) => {
    if (!confirm(`Delete "${employee.firstName} ${employee.lastName}"? This cannot be undone.`)) return;
    try {
      await employeesApi.delete(employee.id);
      setEmployees(prev => prev.filter(e => e.id !== employee.id));
      setTotalEmployees(prev => prev - 1);
      toast.success('Employee deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete employee');
    }
  };

  // ── CSV Export (client-side) ───────────────────────────────────────────────
  const handleExport = () => {
    const headers = ['Employee Number', 'First Name', 'Last Name', 'Email', 'Phone', 'Nationality', 'License Number', 'Experience (yrs)', 'Agency', 'Status', 'Joined'];
    const rows = displayData.map(e => [
      e.employeeNumber ?? '',
      e.firstName ?? '',
      e.lastName ?? '',
      e.email ?? '',
      e.phone ?? '',
      e.nationality ?? '',
      e.licenseNumber ?? '',
      e.yearsExperience ?? '',
      e.agency?.name ?? e.agencyName ?? '',
      e.status ?? '',
      e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `employees-${Date.now()}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const hasActiveFilters = searchTerm || statusFilter || agencyFilter || nationalityFilter || dateFrom || dateTo;
  const clearFilters = () => { setSearchTerm(''); setStatusFilter(''); setAgencyFilter(''); setNationalityFilter(''); setDateFrom(''); setDateTo(''); };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeCount     = employees.filter(e => e.status === 'ACTIVE').length;
  const onboardingCount = employees.filter(e => e.status === 'ONBOARDING').length;
  const pendingCount    = employees.filter(e => e.status === 'PENDING').length;

  const colSpan = 2 + ALL_COLUMNS.filter(c => visibleColumns[c.key]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage and track all employees in the system</p>
        </div>
        {canCreate('employees') && (
          <Button asChild>
            <Link to="/dashboard/employees/add">
              <Plus className="w-4 h-4 mr-2" />Add Employee
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-[#0F172A]">{totalEmployees}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Onboarding</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{onboardingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{pendingCount}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Filter rows */}
          <div className="space-y-3 mb-6">
            {/* Row 1 */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name, email, nationality..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>

              <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>

              {agencies.length > 0 && (
                <Select value={agencyFilter || '__all__'} onValueChange={v => setAgencyFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All Agencies" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Agencies</SelectItem>
                    {agencies.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="sm" onClick={fetchEmployees} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />Export CSV
              </Button>

              {/* Column picker */}
              <div className="relative" ref={colPickerRef}>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowColPicker(v => !v)}
                  className={showColPicker ? 'border-blue-500 text-blue-600' : ''}
                >
                  <Columns2 className="w-4 h-4 mr-1.5" />Columns
                  {ALL_COLUMNS.filter(c => !visibleColumns[c.key]).length > 0 && (
                    <span className="ml-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {ALL_COLUMNS.filter(c => !visibleColumns[c.key]).length}
                    </span>
                  )}
                </Button>

                {showColPicker && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border rounded-lg shadow-lg p-3 min-w-[180px]">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Toggle columns</p>
                    <div className="space-y-0.5">
                      {ALL_COLUMNS.map(c => (
                        <button
                          key={c.key}
                          onClick={() => toggleColumn(c.key)}
                          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 text-sm text-left"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visibleColumns[c.key] ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {visibleColumns[c.key] && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="border-t mt-2 pt-2 flex gap-1.5">
                      <button onClick={() => { const all = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>; setVisibleColumns(all); localStorage.setItem('employees-table-columns', JSON.stringify(all)); }} className="flex-1 text-xs text-center text-blue-600 hover:underline py-0.5">Show all</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => { const none = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, false])) as Record<ColKey, boolean>; setVisibleColumns(none); localStorage.setItem('employees-table-columns', JSON.stringify(none)); }} className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5">Hide all</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={nationalityFilter || '__all__'} onValueChange={v => setNationalityFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Nationalities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Nationalities</SelectItem>
                  {nationalityOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Joined from</span>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 text-sm" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 text-sm" />
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5 mr-1" />Clear filters
                </Button>
              )}
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Employee"    field="firstName"       sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  {col('contact')     && <SortableHead label="Contact"      field="email"           sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('nationality') && <SortableHead label="Nationality"  field="nationality"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('license')     && <SortableHead label="ID / License" field="licenseNumber"   sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('experience')  && <SortableHead label="Experience"   field="yearsExperience" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('agency')      && <SortableHead label="Agency"       field="agency"          sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('status')      && <SortableHead label="Status"       field="status"          sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                )}
                {!loading && displayData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">No employees found matching your criteria.</TableCell>
                  </TableRow>
                )}
                {!loading && displayData.map(driver => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {driver.photoUrl ? (
                          <img
                            src={driver.photoUrl.startsWith('http') ? driver.photoUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${driver.photoUrl}`}
                            alt={driver.firstName}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-semibold flex-shrink-0">
                            {driver.firstName?.[0]}{driver.lastName?.[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-[#0F172A]">{driver.firstName} {driver.lastName}</div>
                          <div className="text-sm text-muted-foreground font-mono">{driver.employeeNumber ?? '—'}</div>
                        </div>
                      </div>
                    </TableCell>
                    {col('contact') && (
                      <TableCell>
                        <div className="text-sm">
                          <div>{driver.email}</div>
                          <div className="text-muted-foreground">{driver.phone}</div>
                        </div>
                      </TableCell>
                    )}
                    {col('nationality') && <TableCell className="text-sm">{driver.nationality}</TableCell>}
                    {col('license') && (
                      <TableCell className="text-sm">{driver.licenseNumber ?? '—'}</TableCell>
                    )}
                    {col('experience') && (
                      <TableCell className="text-sm">
                        {driver.yearsExperience != null ? `${driver.yearsExperience} yrs` : '—'}
                      </TableCell>
                    )}
                    {col('agency') && (
                      <TableCell>
                        {driver.agency
                          ? <span className="text-sm">{driver.agency.name ?? driver.agencyName}</span>
                          : driver.agencyName
                            ? <span className="text-sm">{driver.agencyName}</span>
                            : <span className="text-sm text-muted-foreground">Direct</span>}
                      </TableCell>
                    )}
                    {col('status') && (
                      <TableCell>
                        <Badge className={getStatusColor(driver.status)}>
                          {driver.status?.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/employees/${driver.id}`}><Eye className="w-4 h-4 mr-1" />View</Link>
                        </Button>
                        {canEdit('employees') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/employees/${driver.id}/edit`}><Edit className="w-4 h-4 mr-1" />Edit</Link>
                          </Button>
                        )}
                        {canDelete('employees') && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(driver)} className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]">
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

          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {displayData.length} of {totalEmployees} employees
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
