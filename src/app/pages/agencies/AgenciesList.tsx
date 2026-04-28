import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import {
  Plus, Eye, Edit, Trash2, Search,
  ArrowUp, ArrowDown, ArrowUpDown, Columns2, Check, X,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { agenciesApi } from '../../services/api';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';
import { usePermissions } from '../../hooks/usePermissions';

const agencyColumns: Column[] = [
  { id: 'name', label: 'Agency Name', type: 'text' },
  { id: 'country', label: 'Country', type: 'text' },
  { id: 'contactPerson', label: 'Contact Person', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
];

// ── Column visibility ───────────────────────────────────────────────────────
type ColKey = 'name' | 'country' | 'contactPerson' | 'email' | 'phone' | 'status' | 'createdAt';
const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'name',          label: 'Agency Name' },
  { key: 'country',       label: 'Country' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'email',         label: 'Email' },
  { key: 'phone',         label: 'Phone' },
  { key: 'status',        label: 'Status' },
  { key: 'createdAt',     label: 'Created' },
];
const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  name: true, country: true, contactPerson: true, email: true, phone: true, status: true,
  createdAt: false,
};
const STORAGE_KEY = 'agencies-table-columns';

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

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE': return <Badge className="bg-[#22C55E]">Active</Badge>;
    case 'INACTIVE': return <Badge className="bg-gray-500">Inactive</Badge>;
    case 'SUSPENDED': return <Badge className="bg-[#EF4444]">Suspended</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export function AgenciesList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);

  // Sort state
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const handleSort = (f: SortField) => {
    if (sortBy === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(f); setSortOrder('asc'); }
  };

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];
  const hiddenCount  = ALL_COLUMNS.filter(c => !visibleColumns[c.key]).length;
  const visibleCount = ALL_COLUMNS.filter(c =>  visibleColumns[c.key]).length;

  const handleDelete = async (agency: any) => {
    if (!(await confirm({
      title: 'Delete agency?',
      description: `"${agency.name}" and its data will be permanently removed. This action cannot be undone.`,
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await agenciesApi.delete(agency.id);
      setAgencies(prev => prev.filter(a => a.id !== agency.id));
      toast.success('Agency deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete agency');
    }
  };

  useEffect(() => {
    agenciesApi.list({ limit: 100 })
      .then((res: any) => setAgencies(res?.data ?? res ?? []))
      .catch(() => setAgencies([]))
      .finally(() => setLoading(false));
  }, []);

  const applyFilters = (agency: any) => {
    if (activeFilters.length === 0) return true;
    const results = activeFilters.map(filter => {
      const value = (agency[filter.columnId] ?? '').toString();
      switch (filter.operator) {
        case 'contains': return value.toLowerCase().includes(filter.value.toLowerCase());
        case 'equals': return value.toLowerCase() === filter.value.toLowerCase();
        case 'startsWith': return value.toLowerCase().startsWith(filter.value.toLowerCase());
        case 'endsWith': return value.toLowerCase().endsWith(filter.value.toLowerCase());
        default: return true;
      }
    });
    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const countryOptions = useMemo(
    () => Array.from(new Set(agencies.map(a => a.country).filter(Boolean))).sort() as string[],
    [agencies]
  );

  const displayAgencies = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = agencies.filter(agency => {
      const matchesSearch = !q
        || (agency.name ?? '').toLowerCase().includes(q)
        || (agency.country ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || agency.status === statusFilter;
      const matchesCountry = countryFilter === 'all' || agency.country === countryFilter;
      const matchesContact = !contactFilter || (agency.contactPerson ?? '').toLowerCase().includes(contactFilter.toLowerCase());
      const matchesEmail = !emailFilter || (agency.email ?? '').toLowerCase().includes(emailFilter.toLowerCase());
      const matchesPhone = !phoneFilter || (agency.phone ?? '').toLowerCase().includes(phoneFilter.toLowerCase());
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
        const to   = dateTo   ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
        const t = agency.createdAt ? new Date(agency.createdAt).getTime() : 0;
        matchesDate = t >= from && t <= to;
      }
      return matchesSearch && matchesStatus && matchesCountry && matchesContact
        && matchesEmail && matchesPhone && matchesDate && applyFilters(agency);
    });

    return [...filtered].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'name':          aVal = (a.name ?? '').toLowerCase();          bVal = (b.name ?? '').toLowerCase(); break;
        case 'country':       aVal = (a.country ?? '').toLowerCase();       bVal = (b.country ?? '').toLowerCase(); break;
        case 'contactPerson': aVal = (a.contactPerson ?? '').toLowerCase(); bVal = (b.contactPerson ?? '').toLowerCase(); break;
        case 'email':         aVal = (a.email ?? '').toLowerCase();         bVal = (b.email ?? '').toLowerCase(); break;
        case 'phone':         aVal = (a.phone ?? '').toLowerCase();         bVal = (b.phone ?? '').toLowerCase(); break;
        case 'status':        aVal = a.status ?? '';                         bVal = b.status ?? ''; break;
        case 'createdAt':     aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                              bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0; break;
        default:              aVal = ''; bVal = '';
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [agencies, searchQuery, statusFilter, countryFilter, contactFilter,
      emailFilter, phoneFilter, dateFrom, dateTo,
      activeFilters, filterLogic, sortBy, sortOrder]);

  const hasExtraFilters = countryFilter !== 'all' || contactFilter || emailFilter || phoneFilter || dateFrom || dateTo;
  const clearExtraFilters = () => {
    setCountryFilter('all'); setContactFilter(''); setEmailFilter('');
    setPhoneFilter(''); setDateFrom(''); setDateTo('');
  };

  const SortableHead = ({ label, field }: { label: string; field: SortField }) => {
    const active = sortBy === field;
    return (
      <TableHead>
        <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground font-medium group">
          {label}
          {active
            ? sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
            : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
        </button>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Agencies</h1>
          <p className="text-muted-foreground mt-1">Manage recruitment agency partnerships</p>
        </div>
        {canCreate('agencies') && (
          <Button asChild>
            <Link to="/dashboard/agencies/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Agency
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countryOptions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FilterSystem
              columns={agencyColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={(name, rules, logic) => setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, rules, logic }])}
              onLoadPreset={(preset) => { setActiveFilters(preset.rules); setFilterLogic(preset.logic); }}
              onDeletePreset={(id) => setSavedPresets(prev => prev.filter(p => p.id !== id))}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Contact person contains…"
              value={contactFilter}
              onChange={e => setContactFilter(e.target.value)}
              className="w-52"
            />
            <Input
              placeholder="Email contains…"
              value={emailFilter}
              onChange={e => setEmailFilter(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="Phone contains…"
              value={phoneFilter}
              onChange={e => setPhoneFilter(e.target.value)}
              className="w-44"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Created from</span>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            </div>
            {hasExtraFilters && (
              <Button variant="ghost" size="sm" onClick={clearExtraFilters}>
                <X className="w-3 h-3 mr-1" />Clear
              </Button>
            )}
            <div className="ml-auto relative" ref={colPickerRef}>
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

      <Card>
        <CardContent className="p-6">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {col('name')          && <SortableHead label="Agency Name"    field="name" />}
                  {col('country')       && <SortableHead label="Country"        field="country" />}
                  {col('contactPerson') && <SortableHead label="Contact Person" field="contactPerson" />}
                  {col('email')         && <SortableHead label="Email"          field="email" />}
                  {col('phone')         && <SortableHead label="Phone"          field="phone" />}
                  {col('status')        && <SortableHead label="Status"         field="status" />}
                  {col('createdAt')     && <SortableHead label="Created"        field="createdAt" />}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={visibleCount + 1} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : displayAgencies.length === 0 ? (
                  <TableRow><TableCell colSpan={visibleCount + 1} className="text-center py-8 text-muted-foreground">No agencies found</TableCell></TableRow>
                ) : displayAgencies.map((agency) => (
                  <TableRow key={agency.id}>
                    {col('name')          && <TableCell className="font-medium">{agency.name}</TableCell>}
                    {col('country')       && <TableCell>{agency.country ?? '—'}</TableCell>}
                    {col('contactPerson') && <TableCell>{agency.contactPerson ?? '—'}</TableCell>}
                    {col('email')         && <TableCell className="text-sm">{agency.email ?? '—'}</TableCell>}
                    {col('phone')         && <TableCell className="text-sm text-muted-foreground">{agency.phone ?? '—'}</TableCell>}
                    {col('status')        && <TableCell>{getStatusBadge(agency.status)}</TableCell>}
                    {col('createdAt')     && <TableCell className="text-sm text-muted-foreground">{agency.createdAt ? new Date(agency.createdAt).toLocaleDateString() : '—'}</TableCell>}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/agencies/${agency.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        {canEdit('agencies') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/agencies/${agency.id}/edit`}>
                              <Edit className="w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                        {canDelete('agencies') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(agency)}
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]"
                          >
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
        </CardContent>
      </Card>
    </div>
  );
}
