/**
 * FinanceDashboard — Global Financial Records View
 *
 * Accessible to: System Admin, HR Manager, Finance roles.
 *
 * Shows all financial records across all Candidates and Employees with:
 *   - Filters: entity type, status, transaction type, currency, date range, search, amount range, paid by
 *   - Sortable columns (every column)
 *   - Column visibility toggle (persisted to localStorage)
 *   - Running totals at the top
 *   - Excel export
 *   - Row click → navigate to the person's profile
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Download, Search, Filter, X, TrendingUp, TrendingDown,
  Wallet, DollarSign, ChevronUp, ChevronDown, RefreshCw,
  CheckCircle, Clock, ExternalLink, Columns2, Check,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { financeApi, getCurrentUser } from '../../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number | undefined | null, currency = 'EUR') {
  if (amount == null || isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function fmtDate(date: string) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Column visibility ────────────────────────────────────────────────────────

type ColKey =
  | 'date' | 'person' | 'paidBy' | 'type' | 'description'
  | 'disbursed' | 'empAgency' | 'deducted' | 'currency' | 'status'
  | 'payrollRef' | 'createdAt';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'date',        label: 'Date' },
  { key: 'person',      label: 'Person' },
  { key: 'paidBy',      label: 'Paid By' },
  { key: 'type',        label: 'Type' },
  { key: 'description', label: 'Description' },
  { key: 'disbursed',   label: 'Credit (↑)' },
  { key: 'empAgency',   label: 'Emp/Agency' },
  { key: 'deducted',    label: 'Debit (↓)' },
  { key: 'currency',    label: 'Currency' },
  { key: 'status',      label: 'Status' },
  { key: 'payrollRef',  label: 'Payroll Ref' },
  { key: 'createdAt',   label: 'Created' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  date: true, person: true, paidBy: true, type: true, description: true,
  disbursed: true, empAgency: true, deducted: true, status: true,
  currency: false, payrollRef: false, createdAt: false,
};

const STORAGE_KEY = 'finance-dashboard-columns';

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

type SortField =
  | 'transactionDate' | 'person' | 'paidBy' | 'transactionType' | 'description'
  | 'companyDisbursedAmount' | 'employeeOrAgencyPaidAmount' | 'deductionAmount'
  | 'currency' | 'status' | 'payrollReference' | 'createdAt';

// Fields the server supports directly (sent via sortBy param)
const SERVER_SORT_FIELDS: SortField[] = [
  'transactionDate', 'companyDisbursedAmount', 'deductionAmount',
  'employeeOrAgencyPaidAmount', 'transactionType', 'status', 'createdAt',
];

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  entityType: '',
  status: '',
  transactionType: '',
  currency: '',
  dateFrom: '',
  dateTo: '',
  search: '',
  paidByFilter: '',
  minAmount: '',
  maxAmount: '',
  sortBy: 'transactionDate' as SortField,
  sortOrder: 'desc' as 'asc' | 'desc',
  page: 1,
  limit: 50,
};

export function FinanceDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const allowed = ['System Admin', 'HR Manager', 'Finance', 'Recruiter'].includes(currentUser?.role ?? '');
  const canExport = ['System Admin', 'HR Manager', 'Finance'].includes(currentUser?.role ?? '');

  const [records, setRecords] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [constants, setConstants] = useState<any>(null);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [totals, setTotals] = useState({ disbursed: 0, deducted: 0, balance: 0, empAgency: 0 });

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<ColKey, boolean>>(loadVisibleColumns);
  const [showColPicker,  setShowColPicker]  = useState(false);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];
  const hiddenCount  = ALL_COLUMNS.filter(c => !visibleColumns[c.key]).length;
  const visibleCount = ALL_COLUMNS.filter(c =>  visibleColumns[c.key]).length;

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.status) params.status = filters.status;
      if (filters.transactionType) params.transactionType = filters.transactionType;
      if (filters.currency) params.currency = filters.currency;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.search) params.search = filters.search;
      if (SERVER_SORT_FIELDS.includes(filters.sortBy)) {
        params.sortBy = filters.sortBy;
        params.sortOrder = filters.sortOrder;
      } else {
        params.sortBy = 'transactionDate';
        params.sortOrder = 'desc';
      }
      params.page = filters.page;
      params.limit = filters.limit;

      const res = await financeApi.list(params);
      const items: any[] = (res as any)?.data ?? [];
      setRecords(items);
      setMeta((res as any)?.meta ?? null);

      const d = items.reduce((a, r) => a + Number(r.companyDisbursedAmount ?? 0), 0);
      const ded = items.reduce((a, r) => a + Number(r.deductionAmount ?? 0), 0);
      const emp = items.reduce((a, r) => a + Number(r.employeeOrAgencyPaidAmount ?? 0), 0);
      setTotals({ disbursed: d, deducted: ded, balance: d - ded, empAgency: emp });
    } catch {
      toast.error('Failed to load financial records');
    } finally {
      setLoading(false);
    }
  }, [filters, allowed]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    financeApi.getConstants().then(c => setConstants(c)).catch(() => {});
  }, []);

  const setFilter = (key: string, value: any) =>
    setFilters(f => ({ ...f, [key]: value, page: 1 }));

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const handleSort = (field: SortField) => {
    setFilters(f => ({
      ...f,
      sortBy: field,
      sortOrder: f.sortBy === field && f.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, any> = {};
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.status) params.status = filters.status;
      if (filters.transactionType) params.transactionType = filters.transactionType;
      if (filters.currency) params.currency = filters.currency;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.search) params.search = filters.search;

      const blob = await financeApi.exportExcel(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-records-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export started');
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const navigateToProfile = (rec: any) => {
    if (rec.entityType === 'EMPLOYEE') {
      navigate(`/dashboard/employees/${rec.entityId}`);
    } else {
      navigate(`/dashboard/applicants/${rec.entityId}`);
    }
  };

  // Client-side filter & sort of the current page
  const displayRecords = useMemo(() => {
    let data = records;

    if (filters.paidByFilter) {
      const q = filters.paidByFilter.toLowerCase();
      data = data.filter(r => {
        const name = r.paidByName ?? (r.paidByUser
          ? `${r.paidByUser.firstName ?? ''} ${r.paidByUser.lastName ?? ''}`
          : '');
        return name.toLowerCase().includes(q);
      });
    }
    if (filters.minAmount) {
      const n = Number(filters.minAmount);
      data = data.filter(r => Number(r.companyDisbursedAmount ?? 0) >= n);
    }
    if (filters.maxAmount) {
      const n = Number(filters.maxAmount);
      data = data.filter(r => Number(r.companyDisbursedAmount ?? 0) <= n);
    }

    if (!SERVER_SORT_FIELDS.includes(filters.sortBy)) {
      data = [...data].sort((a, b) => {
        let aVal: any = '', bVal: any = '';
        switch (filters.sortBy) {
          case 'person':
            aVal = (a.entityName ?? '').toLowerCase();
            bVal = (b.entityName ?? '').toLowerCase();
            break;
          case 'paidBy':
            aVal = (a.paidByName ?? (a.paidByUser ? `${a.paidByUser.firstName ?? ''} ${a.paidByUser.lastName ?? ''}` : '')).toLowerCase();
            bVal = (b.paidByName ?? (b.paidByUser ? `${b.paidByUser.firstName ?? ''} ${b.paidByUser.lastName ?? ''}` : '')).toLowerCase();
            break;
          case 'description':
            aVal = (a.description ?? '').toLowerCase();
            bVal = (b.description ?? '').toLowerCase();
            break;
          case 'currency':
            aVal = (a.currency ?? '').toLowerCase();
            bVal = (b.currency ?? '').toLowerCase();
            break;
          case 'payrollReference':
            aVal = (a.payrollReference ?? '').toLowerCase();
            bVal = (b.payrollReference ?? '').toLowerCase();
            break;
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return filters.sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return data;
  }, [records, filters.paidByFilter, filters.minAmount, filters.maxAmount, filters.sortBy, filters.sortOrder]);

  const hasExtraFilters = !!(filters.paidByFilter || filters.minAmount || filters.maxAmount);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!allowed) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">You do not have permission to access the Finance Dashboard.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const SortHead = ({
    label, field, align = 'left', className = '',
  }: {
    label: string; field: SortField; align?: 'left' | 'right' | 'center'; className?: string;
  }) => {
    const active = filters.sortBy === field;
    return (
      <th
        className={`px-4 py-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground ${className} text-${align}`}
        onClick={() => handleSort(field)}
      >
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          {label}
          {active ? (
            filters.sortOrder === 'asc'
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3 opacity-30" />
          )}
        </span>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A] flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-600" />Finance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Global view of all company disbursements and payroll deductions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}>
            <Filter className="w-4 h-4 mr-1" />{showFilters ? 'Hide Filters' : 'Filters'}
          </Button>

          {/* Column picker */}
          <div className="relative" ref={colPickerRef}>
            <Button
              variant="outline" size="sm"
              onClick={() => setShowColPicker(v => !v)}
              className={showColPicker ? 'border-primary text-primary' : ''}
            >
              <Columns2 className="w-4 h-4 mr-1" />Columns
              {hiddenCount > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {hiddenCount}
                </span>
              )}
            </Button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border rounded-lg shadow-lg p-3 min-w-[200px]">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Toggle columns</p>
                <div className="space-y-0.5 max-h-72 overflow-y-auto">
                  {ALL_COLUMNS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => toggleColumn(c.key)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 text-sm text-left"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visibleColumns[c.key] ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                        {visibleColumns[c.key] && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </span>
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="border-t mt-2 pt-2 flex gap-1.5">
                  <button
                    onClick={() => {
                      const all = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>;
                      setVisibleColumns(all);
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
                    }}
                    className="flex-1 text-xs text-center text-primary hover:underline py-0.5"
                  >Show all</button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => {
                      setVisibleColumns(DEFAULT_VISIBLE);
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VISIBLE));
                    }}
                    className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5"
                  >Reset</button>
                </div>
              </div>
            )}
          </div>

          {canExport && (
            <Button size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="w-4 h-4 mr-1" />{exporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          )}
        </div>
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Disbursed</p>
                <p className="text-xl font-bold text-blue-700">{fmt(totals.disbursed)}</p>
                <p className="text-xs text-muted-foreground">{meta?.total ?? records.length} records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Deducted</p>
                <p className="text-xl font-bold text-amber-700">{fmt(totals.deducted)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Balance</p>
                <p className={`text-xl font-bold ${totals.balance > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {fmt(totals.balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Emp / Agency Paid</p>
                <p className="text-xl font-bold text-slate-600">{fmt(totals.empAgency)}</p>
                <p className="text-xs text-muted-foreground">informational only</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Description, payroll ref, name…"
                    value={filters.search}
                    onChange={e => setFilter('search', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Person Type</Label>
                <Select value={filters.entityType || '__all__'} onValueChange={v => setFilter('entityType', v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    <SelectItem value="APPLICANT">Candidates</SelectItem>
                    <SelectItem value="EMPLOYEE">Employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filters.status || '__all__'} onValueChange={v => setFilter('status', v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="DEDUCTED">Deducted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Transaction Type</Label>
                <Select value={filters.transactionType || '__all__'} onValueChange={v => setFilter('transactionType', v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Types</SelectItem>
                    {(constants?.transactionTypes ?? []).map((t: string) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={filters.currency || '__all__'} onValueChange={v => setFilter('currency', v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Currencies</SelectItem>
                    {(constants?.currencies ?? []).map((c: string) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date From</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilter('dateFrom', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date To</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilter('dateTo', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Paid By</Label>
                <Input
                  placeholder="Name contains…"
                  value={filters.paidByFilter}
                  onChange={e => setFilter('paidByFilter', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Disbursed</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={filters.minAmount}
                  onChange={e => setFilter('minAmount', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Disbursed</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={filters.maxAmount}
                  onChange={e => setFilter('maxAmount', e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={resetFilters} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inline extra-filters banner when filter panel is hidden */}
      {!showFilters && hasExtraFilters && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Filter className="w-3 h-3" />
          <span>Extra client-side filters active</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setFilters(f => ({ ...f, paidByFilter: '', minAmount: '', maxAmount: '' }))}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        </div>
      )}

      {/* Records table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : displayRecords.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No financial records found matching the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {col('date')        && <SortHead label="Date"        field="transactionDate" />}
                    {col('person')      && <SortHead label="Person"      field="person" />}
                    {col('paidBy')      && <SortHead label="Paid By"     field="paidBy" />}
                    {col('type')        && <SortHead label="Type"        field="transactionType" />}
                    {col('description') && <SortHead label="Description" field="description" />}
                    {col('disbursed')   && <SortHead label="Credit (↑)"  field="companyDisbursedAmount" align="right" className="text-blue-600" />}
                    {col('empAgency')   && <SortHead label="Emp/Agency"  field="employeeOrAgencyPaidAmount" align="right" className="text-slate-500" />}
                    {col('deducted')    && <SortHead label="Debit (↓)"   field="deductionAmount" align="right" className="text-amber-600" />}
                    {col('currency')    && <SortHead label="Currency"    field="currency" />}
                    {col('status')      && <SortHead label="Status"      field="status" align="center" />}
                    {col('payrollRef')  && <SortHead label="Payroll Ref" field="payrollReference" />}
                    {col('createdAt')   && <SortHead label="Created"     field="createdAt" />}
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRecords.map((rec: any) => (
                    <tr
                      key={rec.id}
                      className="border-b hover:bg-muted/20 transition-colors"
                    >
                      {col('date') && (
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(rec.transactionDate)}</td>
                      )}
                      {col('person') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">
                            {rec.entityName
                              ? rec.entityName
                              : <span className="text-muted-foreground italic">—</span>}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs mt-0.5 ${rec.entityType === 'EMPLOYEE'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                          >
                            {rec.entityType === 'EMPLOYEE' ? 'Employee' : 'Candidate'}
                          </Badge>
                        </td>
                      )}
                      {col('paidBy') && (
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {rec.paidByName
                            ? rec.paidByName
                            : rec.paidByUser
                            ? `${rec.paidByUser.firstName} ${rec.paidByUser.lastName}`
                            : <span className="italic">—</span>}
                        </td>
                      )}
                      {col('type') && (
                        <td className="px-4 py-3 whitespace-nowrap font-medium">{rec.transactionType}</td>
                      )}
                      {col('description') && (
                        <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground" title={rec.description}>
                          {rec.description || '—'}
                        </td>
                      )}
                      {col('disbursed') && (
                        <td className="px-4 py-3 text-right font-semibold text-blue-700 whitespace-nowrap">
                          {fmt(rec.companyDisbursedAmount, rec.currency)}
                        </td>
                      )}
                      {col('empAgency') && (
                        <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                          {Number(rec.employeeOrAgencyPaidAmount) > 0
                            ? fmt(rec.employeeOrAgencyPaidAmount, rec.currency)
                            : '—'}
                        </td>
                      )}
                      {col('deducted') && (
                        <td className="px-4 py-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                          {rec.deductionAmount != null && Number(rec.deductionAmount) > 0
                            ? fmt(rec.deductionAmount, rec.currency)
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </td>
                      )}
                      {col('currency') && (
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{rec.currency ?? '—'}</td>
                      )}
                      {col('status') && (
                        <td className="px-4 py-3 text-center">
                          {rec.status === 'DEDUCTED' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />Deducted
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              <Clock className="w-3 h-3 mr-1" />Pending
                            </Badge>
                          )}
                        </td>
                      )}
                      {col('payrollRef') && (
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{rec.payrollReference ?? '—'}</td>
                      )}
                      {col('createdAt') && (
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {rec.createdAt ? fmtDate(rec.createdAt) : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7"
                          title="Open profile"
                          onClick={() => navigateToProfile(rec)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer note */}
                <tfoot>
                  <tr className="bg-muted/10">
                    <td colSpan={visibleCount + 1} className="px-4 py-2 text-xs text-muted-foreground">
                      <span className="text-blue-600 font-medium">Credit (↑)</span> = company disbursed &nbsp;·&nbsp;
                      <span className="text-amber-600 font-medium">Debit (↓)</span> = payroll deduction &nbsp;·&nbsp;
                      <span className="text-slate-500">Emp/Agency</span> = paid by employee/agency (informational, excluded from balance)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {meta.page} of {meta.totalPages} · {meta.total} records total
          </p>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={filters.page <= 1}
              onClick={() => setFilter('page', filters.page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={filters.page >= meta.totalPages}
              onClick={() => setFilter('page', filters.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
