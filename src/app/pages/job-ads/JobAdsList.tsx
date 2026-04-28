import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import {
  Plus, Search, ExternalLink, Edit2, Trash2,
  MapPin, Eye, Archive,
  ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ArrowUpDown, Columns2, Check, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { jobAdsApi, settingsApi, getCurrentUser } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED:  'bg-orange-100 text-orange-700',
};

const WRITE_ROLES = ['System Admin', 'HR Manager', 'Recruiter'];

// ── Column visibility ──────────────────────────────────────────────────────
type ColKey =
  | 'title' | 'category' | 'city' | 'country' | 'contractType'
  | 'status' | 'applicants' | 'createdAt' | 'updatedAt' | 'slug';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'title',        label: 'Title' },
  { key: 'category',     label: 'Category' },
  { key: 'city',         label: 'City' },
  { key: 'country',      label: 'Country' },
  { key: 'contractType', label: 'Contract' },
  { key: 'status',       label: 'Status' },
  { key: 'applicants',   label: 'Applicants' },
  { key: 'createdAt',    label: 'Created' },
  { key: 'updatedAt',    label: 'Updated' },
  { key: 'slug',         label: 'Slug' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  title: true, category: true, city: true, country: true, contractType: true,
  status: true, applicants: true, createdAt: true,
  updatedAt: false, slug: false,
};

const STORAGE_KEY = 'job-ads-table-columns';

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

// ── Sorting ─────────────────────────────────────────────────────────────────
type SortField = ColKey;
type SortOrder = 'asc' | 'desc';

export function JobAdsList() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const canWrite = WRITE_ROLES.includes(currentUser?.role ?? '');

  const [ads, setAds] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch]                 = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [countryFilter, setCountryFilter]   = useState('');
  const [cityFilter, setCityFilter]         = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [minApplicants, setMinApplicants]   = useState('');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');

  const [categories, setCategories]     = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Sort state
  const [sortBy, setSortBy]       = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const handleSort = (f: SortField) => {
    if (sortBy === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(f); setSortOrder('asc'); }
  };

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

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await jobAdsApi.list({
        page: p, limit,
        ...(search       ? { search }        : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(countryFilter  ? { country: countryFilter }   : {}),
      }) as any;
      setAds(res.data ?? []);
      setMeta(res.meta ?? { total: 0, page: 1, limit, totalPages: 1 });
    } catch {
      toast.error('Failed to load job ads');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, countryFilter]);

  useEffect(() => {
    settingsApi.getJobTypes()
      .then((types: any[]) => setCategories(types.filter((t: any) => t.isActive).map((t: any) => t.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, statusFilter, categoryFilter, countryFilter]);

  const handlePage = (p: number) => {
    setPage(p);
    load(p);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!(await confirm({
      title: 'Delete job ad?',
      description: `"${title}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await jobAdsApi.delete(id);
      toast.success('Job ad deleted');
      load(page);
    } catch {
      toast.error('Failed to delete job ad');
    }
  };

  const handleQuickStatus = async (id: string, newStatus: string) => {
    try {
      await jobAdsApi.update(id, { status: newStatus });
      toast.success(`Moved to ${newStatus}`);
      load(page);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const countryOptions  = useMemo(() => Array.from(new Set(ads.map(a => a.country).filter(Boolean))).sort() as string[], [ads]);
  const contractOptions = useMemo(() => Array.from(new Set(ads.map(a => a.contractType).filter(Boolean))).sort() as string[], [ads]);

  const displayAds = useMemo(() => {
    let data = ads;
    if (cityFilter) {
      const q = cityFilter.toLowerCase();
      data = data.filter(a => (a.city ?? '').toLowerCase().includes(q));
    }
    if (contractFilter) data = data.filter(a => a.contractType === contractFilter);
    if (minApplicants) {
      const n = Number(minApplicants);
      data = data.filter(a => (a._count?.applicants ?? 0) >= n);
    }
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
        case 'title':        aVal = (a.title ?? '').toLowerCase();        bVal = (b.title ?? '').toLowerCase(); break;
        case 'category':     aVal = (a.category ?? '').toLowerCase();     bVal = (b.category ?? '').toLowerCase(); break;
        case 'city':         aVal = (a.city ?? '').toLowerCase();         bVal = (b.city ?? '').toLowerCase(); break;
        case 'country':      aVal = (a.country ?? '').toLowerCase();      bVal = (b.country ?? '').toLowerCase(); break;
        case 'contractType': aVal = (a.contractType ?? '').toLowerCase(); bVal = (b.contractType ?? '').toLowerCase(); break;
        case 'status':       aVal = a.status ?? '';                        bVal = b.status ?? ''; break;
        case 'applicants':   aVal = a._count?.applicants ?? 0;             bVal = b._count?.applicants ?? 0; break;
        case 'createdAt':    aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                             bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0; break;
        case 'updatedAt':    aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                             bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : 0; break;
        case 'slug':         aVal = (a.slug ?? '').toLowerCase();         bVal = (b.slug ?? '').toLowerCase(); break;
        default:             aVal = ''; bVal = '';
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [ads, cityFilter, contractFilter, minApplicants, dateFrom, dateTo, sortBy, sortOrder]);

  const hasServerFilters = !!(search || statusFilter || categoryFilter || countryFilter);
  const hasExtraFilters  = !!(cityFilter || contractFilter || minApplicants || dateFrom || dateTo);
  const hasAnyFilters    = hasServerFilters || hasExtraFilters;

  const clearAllFilters = () => {
    setSearch(''); setStatusFilter(''); setCategoryFilter(''); setCountryFilter('');
    setCityFilter(''); setContractFilter(''); setMinApplicants('');
    setDateFrom(''); setDateTo('');
  };

  const SortableHead = ({ label, field, className }: { label: string; field: SortField; className?: string }) => {
    const active = sortBy === field;
    return (
      <th className={`px-4 py-3 text-left font-medium text-muted-foreground ${className ?? ''}`}>
        <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground group">
          {label}
          {active
            ? sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
            : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
        </button>
      </th>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Ads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage published and draft job advertisements
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Link to="/jobs" target="_blank">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="w-4 h-4" /> View Public Page
              </Button>
            </Link>
            <Button onClick={() => navigate('/dashboard/job-ads/new')} className="gap-2">
              <Plus className="w-4 h-4" /> New Job Ad
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search title, city, country…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter || '__all__'}
              onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter || '__all__'}
              onValueChange={v => setCategoryFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={countryFilter || '__all__'}
              onValueChange={v => setCountryFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Countries</SelectItem>
                {countryOptions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="City contains…"
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              className="w-44"
            />
            <Select
              value={contractFilter || '__all__'}
              onValueChange={v => setContractFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Contracts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Contracts</SelectItem>
                {contractOptions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              placeholder="Min applicants"
              value={minApplicants}
              onChange={e => setMinApplicants(e.target.value)}
              className="w-36"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Created from</span>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            </div>
            {hasAnyFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="w-3 h-3 mr-1" />Clear filters
              </Button>
            )}

            {/* Column picker */}
            <div className="relative ml-auto" ref={colPickerRef}>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowColPicker(v => !v)}
                className={showColPicker ? 'border-primary text-primary' : ''}
              >
                <Columns2 className="w-4 h-4 mr-1.5" />Columns
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
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {col('title')        && <SortableHead label="Title"      field="title" />}
              {col('category')     && <SortableHead label="Category"   field="category" />}
              {col('city')         && <SortableHead label="City"       field="city" />}
              {col('country')      && <SortableHead label="Country"    field="country" />}
              {col('contractType') && <SortableHead label="Contract"   field="contractType" />}
              {col('status')       && <SortableHead label="Status"     field="status" />}
              {col('applicants')   && <SortableHead label="Applicants" field="applicants" />}
              {col('createdAt')    && <SortableHead label="Created"    field="createdAt" />}
              {col('updatedAt')    && <SortableHead label="Updated"    field="updatedAt" />}
              {col('slug')         && <SortableHead label="Slug"       field="slug" />}
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleCount + 1} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : displayAds.length === 0 ? (
              <tr>
                <td colSpan={visibleCount + 1} className="px-4 py-8 text-center text-muted-foreground">
                  No job ads found.{' '}
                  {canWrite && (
                    <button
                      onClick={() => navigate('/dashboard/job-ads/new')}
                      className="text-primary underline"
                    >
                      Create the first one.
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              displayAds.map(ad => (
                <tr key={ad.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  {col('title') && (
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground line-clamp-1">{ad.title}</div>
                      <div className="text-xs text-muted-foreground">/{ad.slug}</div>
                    </td>
                  )}
                  {col('category')     && <td className="px-4 py-3 text-muted-foreground">{ad.category ?? '—'}</td>}
                  {col('city')         && <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {ad.city ?? '—'}
                    </span>
                  </td>}
                  {col('country')      && <td className="px-4 py-3 text-muted-foreground text-xs">{ad.country ?? '—'}</td>}
                  {col('contractType') && <td className="px-4 py-3 text-muted-foreground text-xs">{ad.contractType ?? '—'}</td>}
                  {col('status') && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ad.status] ?? ''}`}>
                        {ad.status}
                      </span>
                    </td>
                  )}
                  {col('applicants')   && <td className="px-4 py-3 text-muted-foreground text-center">{ad._count?.applicants ?? 0}</td>}
                  {col('createdAt')    && <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{ad.createdAt ? new Date(ad.createdAt).toLocaleDateString() : '—'}</td>}
                  {col('updatedAt')    && <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{ad.updatedAt ? new Date(ad.updatedAt).toLocaleDateString() : '—'}</td>}
                  {col('slug')         && <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{ad.slug ?? '—'}</td>}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite && ad.status === 'DRAFT' && (
                        <button
                          onClick={() => handleQuickStatus(ad.id, 'PUBLISHED')}
                          title="Publish"
                          className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {canWrite && ad.status === 'PUBLISHED' && (
                        <button
                          onClick={() => handleQuickStatus(ad.id, 'ARCHIVED')}
                          title="Archive"
                          className="p-1.5 rounded hover:bg-orange-50 text-orange-500 transition-colors"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => navigate(`/dashboard/job-ads/${ad.id}/edit`)}
                          title="Edit"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => handleDelete(ad.id, ad.title)}
                          title="Delete"
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {meta.total > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={visibleCount + 1} className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {meta.total} job ad{meta.total !== 1 ? 's' : ''}
                      {' · '}Page {meta.page} of {meta.totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm"
                        disabled={page <= 1}
                        onClick={() => handlePage(page - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        disabled={page >= meta.totalPages}
                        onClick={() => handlePage(page + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
