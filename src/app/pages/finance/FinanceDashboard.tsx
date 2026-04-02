/**
 * FinanceDashboard — Global Financial Records View
 *
 * Accessible to: System Admin, HR Manager, Finance roles.
 *
 * Shows all financial records across all Candidates and Employees with:
 *   - Filters: entity type, status, transaction type, currency, date range, search
 *   - Sortable columns
 *   - Running totals at the top
 *   - Excel export
 *   - Row click → navigate to the person's profile
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Download, Search, Filter, X, TrendingUp, TrendingDown,
  Wallet, DollarSign, ChevronUp, ChevronDown, RefreshCw,
  CheckCircle, Clock, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  entityType: '',
  status: '',
  transactionType: '',
  currency: '',
  dateFrom: '',
  dateTo: '',
  search: '',
  sortBy: 'transactionDate',
  sortOrder: 'desc' as 'asc' | 'desc',
  page: 1,
  limit: 50,
};

export function FinanceDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Access guard
  const allowed = ['System Admin', 'HR Manager', 'Finance'].includes(currentUser?.role ?? '');

  const [records, setRecords] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [constants, setConstants] = useState<any>(null);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Aggregate totals across the current filtered set
  const [totals, setTotals] = useState({ disbursed: 0, deducted: 0, balance: 0, empAgency: 0 });

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
      params.sortBy = filters.sortBy;
      params.sortOrder = filters.sortOrder;
      params.page = filters.page;
      params.limit = filters.limit;

      const res = await financeApi.list(params);
      const items: any[] = (res as any)?.data ?? [];
      setRecords(items);
      setMeta((res as any)?.meta ?? null);

      // Compute totals from current page
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

  const handleSort = (col: string) => {
    setFilters(f => ({
      ...f,
      sortBy: col,
      sortOrder: f.sortBy === col && f.sortOrder === 'asc' ? 'desc' : 'asc',
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
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" />{exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
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
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search */}
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
              {/* Entity type */}
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
              {/* Status */}
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
              {/* Transaction type */}
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
              {/* Currency */}
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
              {/* Date from */}
              <div className="space-y-1">
                <Label className="text-xs">Date From</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilter('dateFrom', e.target.value)}
                />
              </div>
              {/* Date to */}
              <div className="space-y-1">
                <Label className="text-xs">Date To</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilter('dateTo', e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" variant="ghost" onClick={resetFilters} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No financial records found matching the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <SortHead col="transactionDate" label="Date" sort={filters} onSort={handleSort} />
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Person</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Description</th>
                    <SortHead col="companyDisbursedAmount" label="Credit (↑)" sort={filters} onSort={handleSort} align="right" className="text-blue-600" />
                    <th className="text-right px-4 py-3 font-medium text-slate-500 whitespace-nowrap hidden lg:table-cell">Emp/Agency</th>
                    <th className="text-right px-4 py-3 font-medium text-amber-600 whitespace-nowrap">Debit (↓)</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec: any) => (
                    <tr
                      key={rec.id}
                      className="border-b hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(rec.transactionDate)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">
                          {rec.paidByName
                            ? rec.paidByName
                            : rec.paidByUser
                            ? `${rec.paidByUser.firstName} ${rec.paidByUser.lastName}`
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
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{rec.transactionType}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground hidden md:table-cell">
                        {rec.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700 whitespace-nowrap">
                        {fmt(rec.companyDisbursedAmount, rec.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap hidden lg:table-cell">
                        {Number(rec.employeeOrAgencyPaidAmount) > 0
                          ? fmt(rec.employeeOrAgencyPaidAmount, rec.currency)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                        {rec.deductionAmount != null && Number(rec.deductionAmount) > 0
                          ? fmt(rec.deductionAmount, rec.currency)
                          : <span className="text-muted-foreground font-normal">—</span>}
                      </td>
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
                {/* Page totals footer */}
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-sm">
                      Page totals
                      {meta && (
                        <span className="text-muted-foreground font-normal ml-2 text-xs">
                          (showing {records.length} of {meta.total})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-700">{fmt(totals.disbursed)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs hidden lg:table-cell">{fmt(totals.empAgency)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{fmt(totals.deducted)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr className="bg-muted/10">
                    <td colSpan={9} className="px-4 py-2 text-xs text-muted-foreground">
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

// ─── Sort header cell ─────────────────────────────────────────────────────────

function SortHead({
  col, label, sort, onSort, align = 'left', className = '',
}: {
  col: string;
  label: string;
  sort: { sortBy: string; sortOrder: 'asc' | 'desc' };
  onSort: (col: string) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.sortBy === col;
  return (
    <th
      className={`px-4 py-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground ${className} text-${align}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sort.sortOrder === 'asc'
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}
