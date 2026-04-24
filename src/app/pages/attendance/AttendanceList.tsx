import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Search,
  Download,
  Eye,
  Users,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RefreshCw,
  X,
  ClipboardList,
  Columns2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { attendanceApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

const STATUS_OPTIONS = [
  { value: '',         label: 'All Statuses' },
  { value: 'PRESENT',  label: 'Present' },
  { value: 'ABSENT',   label: 'Absent' },
  { value: 'OFF',      label: 'Off' },
  { value: 'VACATION', label: 'Vacation' },
  { value: 'SICK',     label: 'Sick' },
  // Legacy values still surfaced so old rows remain filterable.
  { value: 'LATE',     label: 'Late (legacy)' },
  { value: 'ON_LEAVE', label: 'On Leave (legacy)' },
  { value: 'HALF_DAY', label: 'Half Day (legacy)' },
  { value: 'HOLIDAY',  label: 'Holiday (legacy)' },
];

const statusColors: Record<string, string> = {
  PRESENT:  'bg-green-100 text-green-700',
  ABSENT:   'bg-red-100 text-red-700',
  OFF:      'bg-slate-100 text-slate-700',
  VACATION: 'bg-blue-100 text-blue-700',
  SICK:     'bg-purple-100 text-purple-700',
  // Legacy
  LATE:     'bg-amber-100 text-amber-700',
  ON_LEAVE: 'bg-blue-100 text-blue-700',
  HALF_DAY: 'bg-purple-100 text-purple-700',
  HOLIDAY:  'bg-gray-100 text-gray-600',
};

// ─── Column visibility ──────────────────────────────────────────────────────────

type ColKey = 'employeeId' | 'license' | 'agency' | 'present' | 'absent' | 'late' | 'onLeave' | 'totalDays';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'license',    label: 'License' },
  { key: 'agency',     label: 'Agency' },
  { key: 'present',    label: 'Present' },
  { key: 'absent',     label: 'Absent' },
  { key: 'late',       label: 'Late' },
  { key: 'onLeave',    label: 'On Leave' },
  { key: 'totalDays',  label: 'Total Days' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  employeeId: true, license: true, agency: true,
  present: true, absent: true, late: true, onLeave: true, totalDays: true,
};

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem('attendance-table-columns');
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

// ─── Sort header helper ─────────────────────────────────────────────────────────

function SortHead({
  col, label, sortBy, sortOrder, onSort, className = '',
}: {
  col: string; label: string; sortBy: string; sortOrder: 'asc' | 'desc';
  onSort: (col: string) => void; className?: string;
}) {
  const active = sortBy === col;
  return (
    <TableHead className={className}>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-foreground font-medium group">
        {label}
        {active
          ? sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
          : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
      </button>
    </TableHead>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AttendanceList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();

  // List state
  const [employees, setEmployees] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [driversOnly, setDriversOnly] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Column visibility
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
      localStorage.setItem('attendance-table-columns', JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportDriversOnly, setExportDriversOnly] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await attendanceApi.listEmployees({
        page,
        limit: 20,
        search: search || undefined,
        month: selectedMonth,
        year: selectedYear,
        status: statusFilter || undefined,
        driversOnly,
      });
      setEmployees(result?.data ?? []);
      setTotal(result?.meta?.total ?? 0);
      setTotalPages(result?.meta?.totalPages ?? 1);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load attendance data');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedMonth, selectedYear, statusFilter, driversOnly]);

  useEffect(() => {
    const timer = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedMonth, selectedYear, statusFilter, driversOnly]);

  // ── Stats (computed from loaded page) ─────────────────────────────────────────

  const totalDriversCount = total;
  const presentToday = employees.filter((e) => e.todayStatus === 'PRESENT').length;
  const absentToday = employees.filter((e) => e.todayStatus === 'ABSENT').length;
  const onLeaveToday = employees.filter((e) => e.todayStatus === 'ON_LEAVE').length;

  // ── Sort ───────────────────────────────────────────────────────────────────────

  const handleSort = (col: string) => {
    setSortBy(col);
    setSortOrder((prev) => (sortBy === col && prev === 'asc' ? 'desc' : 'asc'));
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    let aVal: any;
    let bVal: any;
    switch (sortBy) {
      case 'name':
        aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
        bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
        break;
      case 'employeeId':
        aVal = a.employeeNumber?.toLowerCase() ?? '';
        bVal = b.employeeNumber?.toLowerCase() ?? '';
        break;
      case 'license':
        aVal = (a.licenseCategory ?? a.licenseNumber ?? '').toLowerCase();
        bVal = (b.licenseCategory ?? b.licenseNumber ?? '').toLowerCase();
        break;
      case 'agency':
        aVal = (a.agency?.name ?? a.agencyName ?? '').toLowerCase();
        bVal = (b.agency?.name ?? b.agencyName ?? '').toLowerCase();
        break;
      case 'present':
        aVal = a.presentCount ?? 0;
        bVal = b.presentCount ?? 0;
        break;
      case 'absent':
        aVal = a.absentCount ?? 0;
        bVal = b.absentCount ?? 0;
        break;
      case 'late':
        aVal = a.lateCount ?? 0;
        bVal = b.lateCount ?? 0;
        break;
      case 'onLeave':
        aVal = a.onLeaveCount ?? 0;
        bVal = b.onLeaveCount ?? 0;
        break;
      case 'totalDays':
        aVal = (a.presentCount ?? 0) + (a.absentCount ?? 0) + (a.lateCount ?? 0) + (a.onLeaveCount ?? 0) + (a.halfDayCount ?? 0) + (a.holidayCount ?? 0);
        bVal = (b.presentCount ?? 0) + (b.absentCount ?? 0) + (b.lateCount ?? 0) + (b.onLeaveCount ?? 0) + (b.halfDayCount ?? 0) + (b.holidayCount ?? 0);
        break;
      default:
        aVal = a[sortBy] ?? '';
        bVal = b[sortBy] ?? '';
    }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // ── Clear filters ──────────────────────────────────────────────────────────────

  const clearFilters = () => {
    setSearch('');
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
    setStatusFilter('');
    setDriversOnly(false);
    setPage(1);
  };

  const hasFilters =
    search !== '' ||
    selectedMonth !== new Date().getMonth() + 1 ||
    selectedYear !== new Date().getFullYear() ||
    statusFilter !== '' ||
    driversOnly;

  // ── Export ─────────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await attendanceApi.exportExcel({
        month: exportMonth,
        year: exportYear,
        driversOnly: exportDriversOnly,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${MONTH_NAMES[exportMonth - 1].toLowerCase()}-${exportYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Attendance sheet exported successfully');
      setShowExportModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-600" />
            Attendance Sheets
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage attendance for all employees
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => fetchEmployees()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
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
                  <button onClick={() => { const all = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>; setVisibleColumns(all); localStorage.setItem('attendance-table-columns', JSON.stringify(all)); }} className="flex-1 text-xs text-center text-blue-600 hover:underline py-0.5">Show all</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => { const none = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, false])) as Record<ColKey, boolean>; setVisibleColumns(none); localStorage.setItem('attendance-table-columns', JSON.stringify(none)); }} className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5">Hide all</button>
                </div>
              </div>
            )}
          </div>

          <Button size="sm" onClick={() => setShowExportModal(true)}>
            <Download className="w-4 h-4 mr-1" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Total Employees
                </p>
                <p className="text-2xl font-bold text-blue-700">{totalDriversCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Present Today
                </p>
                <p className="text-2xl font-bold text-green-700">{presentToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Absent Today
                </p>
                <p className="text-2xl font-bold text-red-700">{absentToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  On Leave Today
                </p>
                <p className="text-2xl font-bold text-purple-700">{onLeaveToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Month selector */}
            <div className="space-y-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year selector */}
            <div className="space-y-1 min-w-[100px]">
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-1 min-w-[150px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={statusFilter || '__all__'}
                onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drivers Only toggle */}
            <div className="flex items-center gap-2 self-end pb-1">
              <Switch
                id="drivers-only"
                checked={driversOnly}
                onCheckedChange={setDriversOnly}
              />
              <Label htmlFor="drivers-only" className="text-sm cursor-pointer">
                Drivers Only (License)
              </Label>
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
              <p>Loading attendance data…</p>
            </div>
          ) : sortedEmployees.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No employees found</p>
              <p className="text-sm mt-1">
                Try adjusting the filters or search term, or turn off "Drivers Only" to show all employees.
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <SortHead col="name"       label="Employee"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    {col('employeeId') && <SortHead col="employeeId" label="Employee ID" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                    {col('license')    && <SortHead col="license"    label="License"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                    {col('agency')     && <SortHead col="agency"     label="Agency"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                    {col('present')    && <SortHead col="present"    label="Present"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-center" />}
                    {col('absent')     && <SortHead col="absent"     label="Absent"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-center" />}
                    {col('late')       && <SortHead col="late"       label="Late"        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-center" />}
                    {col('onLeave')    && <SortHead col="onLeave"    label="On Leave"    sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-center" />}
                    {col('totalDays')  && <SortHead col="totalDays"  label="Total Days"  sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-center" />}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEmployees.map((emp, idx) => {
                    const fullName = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
                    const initials = `${emp.firstName?.[0] ?? ''}${emp.lastName?.[0] ?? ''}`.toUpperCase();
                    const totalDays =
                      (emp.presentCount ?? 0) +
                      (emp.absentCount ?? 0) +
                      (emp.lateCount ?? 0) +
                      (emp.onLeaveCount ?? 0) +
                      (emp.halfDayCount ?? 0) +
                      (emp.holidayCount ?? 0);

                    return (
                      <TableRow key={emp.id} className="hover:bg-muted/20">
                        <TableCell className="text-center text-muted-foreground text-sm">
                          {(page - 1) * 20 + idx + 1}
                        </TableCell>

                        {/* Driver column */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {emp.photoUrl ? (
                              <img
                                src={
                                  emp.photoUrl.startsWith('http')
                                    ? emp.photoUrl
                                    : `${(
                                        import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
                                      ).replace('/api/v1', '')}${emp.photoUrl}`
                                }
                                alt={fullName}
                                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-semibold flex-shrink-0">
                                {initials || '?'}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-[#0F172A] text-sm">{fullName}</div>
                              <div className="text-xs text-muted-foreground">{emp.email}</div>
                            </div>
                          </div>
                        </TableCell>

                        {col('employeeId') && (
                          <TableCell className="text-sm text-muted-foreground">
                            {emp.employeeNumber ?? '—'}
                          </TableCell>
                        )}

                        {col('license') && (
                          <TableCell className="text-sm">
                            {emp.licenseCategory ?? emp.licenseNumber ?? '—'}
                          </TableCell>
                        )}

                        {col('agency') && (
                          <TableCell className="text-sm">
                            {emp.agency?.name ?? emp.agencyName ?? (
                              <span className="text-muted-foreground">Direct</span>
                            )}
                          </TableCell>
                        )}

                        {col('present') && (
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.PRESENT}`}>
                              {emp.presentCount ?? 0}
                            </span>
                          </TableCell>
                        )}

                        {col('absent') && (
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.ABSENT}`}>
                              {emp.absentCount ?? 0}
                            </span>
                          </TableCell>
                        )}

                        {col('late') && (
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.LATE}`}>
                              {emp.lateCount ?? 0}
                            </span>
                          </TableCell>
                        )}

                        {col('onLeave') && (
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.ON_LEAVE}`}>
                              {emp.onLeaveCount ?? 0}
                            </span>
                          </TableCell>
                        )}

                        {col('totalDays') && (
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {totalDays}
                            </span>
                          </TableCell>
                        )}

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dashboard/attendance/${emp.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Timesheet
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages} · {total} employees total
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {!loading && totalPages <= 1 && (
        <p className="text-sm text-muted-foreground">
          Showing {sortedEmployees.length} of {total} employees
        </p>
      )}

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Export Attendance Sheet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select
                value={String(exportMonth)}
                onValueChange={(v) => setExportMonth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={String(exportYear)}
                onValueChange={(v) => setExportYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="export-drivers-only"
                checked={exportDriversOnly}
                onCheckedChange={setExportDriversOnly}
              />
              <Label htmlFor="export-drivers-only" className="cursor-pointer">
                Drivers Only (License)
              </Label>
            </div>

            <p className="text-xs text-muted-foreground">
              Exporting attendance for{' '}
              <strong>
                {MONTH_NAMES[exportMonth - 1]} {exportYear}
              </strong>
              {exportDriversOnly ? ' (drivers with license only)' : ' (all employees)'}.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="w-4 h-4 mr-1" />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
