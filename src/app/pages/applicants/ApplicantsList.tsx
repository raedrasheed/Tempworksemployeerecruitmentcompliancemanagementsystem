import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { applicantsApi, employeeWorkflowApi, agenciesApi, settingsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { getCurrentUser, getAccessToken } from '../../services/api';
import { Link } from 'react-router';
import { Search, Plus, Eye, Edit, Download, Trash2, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, X, Columns2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'NEW': return 'bg-blue-100 text-blue-800';
    case 'SCREENING': return 'bg-yellow-100 text-yellow-800';
    case 'INTERVIEW': return 'bg-purple-100 text-purple-800';
    case 'OFFER': case 'ONBOARDING': case 'ACCEPTED': return 'bg-green-100 text-green-800';
    case 'REJECTED': case 'WITHDRAWN': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getTierColor = (tier: string) => {
  if (tier === 'CANDIDATE') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  return 'bg-amber-100 text-amber-800 border border-amber-200';
};

const STATUSES = ['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'ONBOARDING'];

type SortField = 'firstName' | 'email' | 'nationality' | 'jobType' | 'agency' | 'tier' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';

// ── Column visibility ────────────────────────────────────────────────────────
type ColKey =
  | 'contact' | 'nationality' | 'appliedPosition' | 'passportNumber'
  | 'age' | 'gender' | 'agency' | 'tier' | 'applied' | 'status';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'contact',         label: 'Contact' },
  { key: 'nationality',     label: 'Citizenship' },
  { key: 'appliedPosition', label: 'Applied Position' },
  { key: 'passportNumber',  label: 'Passport Number' },
  { key: 'age',             label: 'Age' },
  { key: 'gender',          label: 'Gender' },
  { key: 'agency',          label: 'Agency' },
  { key: 'tier',            label: 'Tier' },
  { key: 'applied',         label: 'Applied' },
  { key: 'status',          label: 'Status' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  contact: true, nationality: true, appliedPosition: true,
  passportNumber: true, age: true, gender: true,
  agency: true, tier: false, applied: true, status: true,
};

/** Age in whole years from a DOB string/Date. Returns null for missing /
 *  unparseable dates so the cell can show a '—' rather than an NaN. */
function calcAge(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

/** Passport number lives inside the applicationData JSON. */
function readPassportNumber(a: any): string {
  const raw = a?.applicationData?.passportNumber ?? a?.passportNumber ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

function formatGender(g: string | null | undefined): string {
  if (!g) return '';
  switch (g) {
    case 'MALE': return 'Male';
    case 'FEMALE': return 'Female';
    case 'OTHER': return 'Other';
    case 'PREFER_NOT_TO_SAY': return 'Prefer not to say';
    default: return g;
  }
}

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem('applicants-table-columns-v3');
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

export function ApplicantsList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const currentUser = getCurrentUser();
  const isAgencyUser = currentUser?.role === 'Agency User' || currentUser?.role === 'Agency Manager';

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
      localStorage.setItem('applicants-table-columns-v3', JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]               = useState('');
  const [tierFilter]                              = useState<string>('LEAD');
  const [statusFilter, setStatusFilter]           = useState<string>('');
  const [agencyFilter, setAgencyFilter]           = useState<string>('');
  const [nationalityFilter, setNationalityFilter] = useState<string>('');
  const [jobTypeFilter, setJobTypeFilter]         = useState<string>('');
  const [dateFrom, setDateFrom]                   = useState<string>('');
  const [dateTo, setDateTo]                       = useState<string>('');

  // ── Sorting (client-side) ──────────────────────────────────────────────────
  const [sortBy, setSortBy]       = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
  };

  // ── Data ───────────────────────────────────────────────────────────────────
  const [applicantsData, setApplicantsData] = useState<any[]>([]);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [jobTypes, setJobTypes] = useState<any[]>([]);

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: 1, limit: 500 };
      if (searchTerm) params.search = searchTerm;
      if (tierFilter) params.tier = tierFilter;
      if (statusFilter) params.status = statusFilter;
      if (agencyFilter) params.agencyId = agencyFilter;
      if (nationalityFilter) params.nationality = nationalityFilter;
      if (jobTypeFilter) params.jobTypeId = jobTypeFilter;
      const result = await applicantsApi.list(params);
      setApplicantsData(result.data || []);
      setTotalApplicants(result.meta?.total || 0);
    } catch {
      setApplicantsData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, tierFilter, statusFilter, agencyFilter, nationalityFilter, jobTypeFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchApplicants, 300);
    return () => clearTimeout(timer);
  }, [fetchApplicants]);

  useEffect(() => {
    agenciesApi.list({ limit: 200 }).then((r: any) => setAgencies(r?.data ?? [])).catch(() => {});
    settingsApi.getJobTypes?.().then((jt: any) => setJobTypes(Array.isArray(jt) ? jt : [])).catch(() => {});
  }, []);

  // ── Sorted + date-filtered data ────────────────────────────────────────────
  const displayData = useMemo(() => {
    let data = applicantsData;
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const to   = dateTo   ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
      data = data.filter(a => {
        const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        return t >= from && t <= to;
      });
    }
    return [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'firstName':  aVal = `${a.firstName ?? ''} ${a.lastName ?? ''}`.toLowerCase(); bVal = `${b.firstName ?? ''} ${b.lastName ?? ''}`.toLowerCase(); break;
        case 'email':      aVal = a.email?.toLowerCase() ?? ''; bVal = b.email?.toLowerCase() ?? ''; break;
        case 'nationality':aVal = a.nationality?.toLowerCase() ?? ''; bVal = b.nationality?.toLowerCase() ?? ''; break;
        case 'jobType':    aVal = (typeof a.jobType === 'object' ? a.jobType?.name : a.jobType)?.toLowerCase() ?? ''; bVal = (typeof b.jobType === 'object' ? b.jobType?.name : b.jobType)?.toLowerCase() ?? ''; break;
        case 'agency':     aVal = a.agency?.name?.toLowerCase() ?? ''; bVal = b.agency?.name?.toLowerCase() ?? ''; break;
        case 'tier':       aVal = a.tier ?? ''; bVal = b.tier ?? ''; break;
        case 'createdAt':  aVal = a.createdAt ?? ''; bVal = b.createdAt ?? ''; break;
        case 'status':     aVal = a.status ?? ''; bVal = b.status ?? ''; break;
        default:           aVal = ''; bVal = '';
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [applicantsData, sortBy, sortOrder, dateFrom, dateTo]);

  const nationalityOptions = useMemo(() => {
    const all = applicantsData.map(a => a.nationality).filter(Boolean) as string[];
    return [...new Set(all)].sort();
  }, [applicantsData]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (applicant: any) => {
    if (!confirm(`Delete "${applicant.firstName} ${applicant.lastName}"? This cannot be undone.`)) return;
    try {
      await applicantsApi.delete(applicant.id);
      setApplicantsData(prev => prev.filter(a => a.id !== applicant.id));
      setTotalApplicants(prev => prev - 1);
      setSelected(prev => { const n = new Set(prev); n.delete(applicant.id); return n; });
      toast.success('Applicant deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete applicant');
    }
  };

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    if (selected.size === displayData.length) setSelected(new Set());
    else setSelected(new Set(displayData.map(a => a.id)));
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const handleBulkAction = async (action: string, value?: string) => {
    if (selected.size === 0) { toast.error('Select at least one applicant'); return; }
    setBulkActionInProgress(true);
    try {
      const result = await applicantsApi.bulkAction({ ids: [...selected], action, value });
      const failed = result.results?.filter((r: any) => !r.success) ?? [];
      if (failed.length === 0) toast.success(`Bulk action applied to ${selected.size} applicant(s)`);
      else toast.warning(`Applied to ${selected.size - failed.length}, failed for ${failed.length}`);
      setSelected(new Set());
      await fetchApplicants();
    } catch (err: any) {
      toast.error(err?.message || 'Bulk action failed');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const runCsvDownload = (params: Record<string, any>, filename: string) => {
    const token = getAccessToken();
    const csvUrl = applicantsApi.exportCsv(params);
    fetch(csvUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Export failed'));
  };

  /** Export only the rows currently selected (by id). */
  const handleExportSelected = () => {
    if (selected.size === 0) return;
    runCsvDownload(
      { ids: Array.from(selected) },
      `applicants-selected-${Date.now()}.csv`,
    );
  };

  /** Export every row matching the active filters — honours the same
   *  search/tier/status/agency/nationality/jobType filters that scope
   *  the table. */
  const handleExportAll = () => {
    const params: Record<string, any> = {};
    if (searchTerm) params.search = searchTerm;
    if (tierFilter) params.tier = tierFilter;
    if (statusFilter) params.status = statusFilter;
    if (agencyFilter) params.agencyId = agencyFilter;
    if (nationalityFilter) params.nationality = nationalityFilter;
    if (jobTypeFilter) params.jobTypeId = jobTypeFilter;
    runCsvDownload(params, `applicants-${Date.now()}.csv`);
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const hasActiveFilters = searchTerm || statusFilter || agencyFilter || nationalityFilter || jobTypeFilter || dateFrom || dateTo;
  const clearFilters = () => { setSearchTerm(''); setStatusFilter(''); setAgencyFilter(''); setNationalityFilter(''); setJobTypeFilter(''); setDateFrom(''); setDateTo(''); };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const leads        = applicantsData.filter(a => a.tier === 'LEAD');
  const acceptedCount = applicantsData.filter(a => a.status === 'ACCEPTED' || a.status === 'ONBOARDING').length;

  // dynamic colSpan for loading/empty rows
  const colSpan = 2 /* checkbox + applicant */
    + ALL_COLUMNS.filter(c => {
        if (c.key === 'tier' && isAgencyUser) return false;
        return visibleColumns[c.key];
      }).length
    + 1 /* actions */;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Applicants</h1>
          <p className="text-muted-foreground mt-1">Manage leads and convert to candidates</p>
        </div>
        {canCreate('applicants') && (
          <Button asChild>
            <Link to="/dashboard/applicants/add">
              <Plus className="w-4 h-4 mr-2" />Add Applicant
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-[#0F172A]">{totalApplicants}</div></CardContent>
        </Card>
        {!isAgencyUser && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Leads</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{leads.length}</div></CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Accepted / Onboarding</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{acceptedCount}</div></CardContent>
        </Card>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {!isAgencyUser && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkActionInProgress}
                  onClick={() => {
                    if (selected.size === 0) return;
                    if (!confirm(`Promote ${selected.size} selected applicant(s) to Candidate?`)) return;
                    handleBulkAction('TIER_CHANGE', 'CANDIDATE');
                  }}
                >Promote to Candidate</Button>
                <Button variant="outline" size="sm" disabled={bulkActionInProgress} onClick={() => { const s = prompt('Enter new status (NEW / SCREENING / INTERVIEW / OFFER / ACCEPTED / REJECTED / WITHDRAWN / ONBOARDING)'); if (s) handleBulkAction('STATUS_CHANGE', s.toUpperCase()); }}>Change Status</Button>
              </>
            )}
            <Button variant="outline" size="sm" className="text-red-600" disabled={bulkActionInProgress} onClick={() => { if (confirm(`Delete ${selected.size} applicant(s)?`)) handleBulkAction('DELETE'); }}>
              <Trash2 className="w-3 h-3 mr-1" />Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* Table card */}
      <Card>
        <CardContent className="p-6">
          {/* Filter rows */}
          <div className="space-y-3 mb-6">
            {/* Row 1 */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search name, email, ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>

              <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>

              {!isAgencyUser && agencies.length > 0 && (
                <Select value={agencyFilter || '__all__'} onValueChange={v => setAgencyFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All Agencies" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Agencies</SelectItem>
                    {agencies.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="sm" onClick={fetchApplicants} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelected}
                disabled={selected.size === 0}
                title={selected.size === 0 ? 'Select one or more rows to export' : undefined}
              >
                <Download className="w-4 h-4 mr-2" />Export Selected ({selected.size})
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportAll}>
                <Download className="w-4 h-4 mr-2" />Export All
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
                      {ALL_COLUMNS.filter(c => !(c.key === 'tier' && isAgencyUser)).map(c => (
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
                      <button onClick={() => { const all = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>; setVisibleColumns(all); localStorage.setItem('applicants-table-columns-v3', JSON.stringify(all)); }} className="flex-1 text-xs text-center text-blue-600 hover:underline py-0.5">Show all</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => { const none = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, false])) as Record<ColKey, boolean>; setVisibleColumns(none); localStorage.setItem('applicants-table-columns-v3', JSON.stringify(none)); }} className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5">Hide all</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={nationalityFilter || '__all__'} onValueChange={v => setNationalityFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Citizenships" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Citizenships</SelectItem>
                  {nationalityOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>

              {jobTypes.length > 0 && (
                <Select value={jobTypeFilter || '__all__'} onValueChange={v => setJobTypeFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="All Job Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Job Categories</SelectItem>
                    {jobTypes.map((jt: any) => <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Applied from</span>
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
                  <TableHead className="w-10">
                    <Checkbox checked={displayData.length > 0 && selected.size === displayData.length} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <SortableHead label="Applicant"    field="firstName"   sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  {col('contact')     && <SortableHead label="Contact"      field="email"       sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('nationality') && <SortableHead label="Citizenship"  field="nationality" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('appliedPosition') && <TableHead>Applied Position</TableHead>}
                  {col('passportNumber')  && <TableHead>Passport Number</TableHead>}
                  {col('age')             && <TableHead>Age</TableHead>}
                  {col('gender')          && <TableHead>Gender</TableHead>}
                  {col('agency')      && <SortableHead label="Agency"       field="agency"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('tier') && !isAgencyUser && <SortableHead label="Tier" field="tier" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('applied')     && <SortableHead label="Applied"      field="createdAt"   sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('status')      && <SortableHead label="Status"       field="status"      sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
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
                    <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">No applicants found matching your criteria.</TableCell>
                  </TableRow>
                )}
                {!loading && displayData.map(applicant => (
                  <TableRow key={applicant.id} className={selected.has(applicant.id) ? 'bg-blue-50' : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(applicant.id)} onCheckedChange={() => toggleSelect(applicant.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center shrink-0">
                          {applicant.photoUrl
                            ? <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${applicant.photoUrl}`} alt={applicant.firstName} className="w-full h-full object-cover" />
                            : <span className="text-blue-600 text-sm font-semibold">{applicant.firstName?.[0]}{applicant.lastName?.[0]}</span>}
                        </div>
                        <div>
                          <div className="font-medium text-[#0F172A]">{applicant.firstName} {applicant.lastName}</div>
                          <div className="text-xs font-mono text-muted-foreground">
                            {applicant.tier === 'CANDIDATE' && applicant.candidateNumber
                              ? <span className="text-purple-600">{applicant.candidateNumber}</span>
                              : applicant.leadNumber
                                ? <span className="text-blue-600">{applicant.leadNumber}</span>
                                : <span className="italic opacity-60">Legacy</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    {col('contact') && (
                      <TableCell>
                        <div className="text-sm">
                          <div>{applicant.email}</div>
                          <div className="text-muted-foreground">{applicant.phone}</div>
                        </div>
                      </TableCell>
                    )}
                    {col('nationality') && <TableCell className="text-sm">{applicant.nationality}</TableCell>}
                    {col('appliedPosition') && (
                      <TableCell>
                        {applicant.jobAd?.title
                          ? <span className="text-sm">{applicant.jobAd.title}</span>
                          : <Badge variant="outline" className="text-[10px] font-semibold tracking-wide">GENERAL</Badge>}
                      </TableCell>
                    )}
                    {col('passportNumber') && (
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {readPassportNumber(applicant) || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {col('age') && (
                      <TableCell className="text-sm tabular-nums">
                        {calcAge(applicant.dateOfBirth) ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {col('gender') && (
                      <TableCell className="text-sm">
                        {formatGender(applicant.gender) || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {col('agency') && (
                      <TableCell>
                        {applicant.agency?.name
                          ? <span className="text-sm">{applicant.agency.name}</span>
                          : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {col('tier') && !isAgencyUser && (
                      <TableCell>
                        <Badge className={getTierColor(applicant.tier)}>{applicant.tier}</Badge>
                      </TableCell>
                    )}
                    {col('applied') && (
                      <TableCell>
                        <span className="text-sm">{applicant.createdAt ? new Date(applicant.createdAt).toLocaleDateString() : '—'}</span>
                      </TableCell>
                    )}
                    {col('status') && (
                      <TableCell>
                        <Badge className={getStatusColor(applicant.status)}>{applicant.status?.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/applicants/${applicant.id}`}><Eye className="w-4 h-4 mr-1" />View</Link>
                        </Button>
                        {canEdit('applicants') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/applicants/${applicant.id}/edit`}><Edit className="w-4 h-4 mr-1" />Edit</Link>
                          </Button>
                        )}
                        {canDelete('applicants') && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(applicant)} className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]">
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
              Showing {displayData.length} of {totalApplicants} applicants
              {selected.size > 0 && ` · ${selected.size} selected`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
