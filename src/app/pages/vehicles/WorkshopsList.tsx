import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, Wrench, Pencil, Trash2, X, Save, ArrowLeft, RefreshCw,
  ArrowUp, ArrowDown, ArrowUpDown, Columns2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { vehiclesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

type Workshop = {
  id: string; name: string; contactName?: string; phone?: string; email?: string;
  address?: string; city?: string; country?: string; notes?: string; isActive: boolean;
};

type WForm = Omit<Workshop, 'id' | 'isActive'>;
const EMPTY_FORM: WForm = { name: '', contactName: '', phone: '', email: '', address: '', city: '', country: '', notes: '' };

type SortField = 'name' | 'contact' | 'phone' | 'email' | 'city' | 'country';
type SortOrder = 'asc' | 'desc';

function SortableHead({ label, field, sortBy, sortOrder, onSort, className }: {
  label: string; field: SortField; sortBy: SortField | null; sortOrder: SortOrder;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortBy === field;
  return (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(field)}
      >
        {label}
        {active ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
      </button>
    </TableHead>
  );
}

type ColKey = 'contact' | 'phone' | 'email' | 'city' | 'country';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'contact', label: 'Contact' },
  { key: 'phone',   label: 'Phone' },
  { key: 'email',   label: 'Email' },
  { key: 'city',    label: 'City' },
  { key: 'country', label: 'Country' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  contact: true, phone: true, email: true, city: true, country: true,
};

const LS_KEY = 'workshops-table-columns';

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_VISIBLE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VISIBLE };
}

export function WorkshopsList() {
  const { canCreate } = usePermissions();
  const canWrite = canCreate('vehicles');
  const navigate = useNavigate();

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dialog, setDialog]       = useState(false);
  const [editing, setEditing]     = useState<Workshop | null>(null);
  const [form, setForm]           = useState<WForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  // filters
  const [search, setSearch]           = useState('');
  const [cityFilter, setCityFilter]   = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // sort
  const [sortBy, setSortBy]       = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // column visibility
  const [visibleCols, setVisibleCols]   = useState<Record<ColKey, boolean>>(loadVisibleColumns);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleColumn = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleCols[key];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await vehiclesApi.listWorkshops();
      setWorkshops(ws);
    } catch {
      toast.error('Failed to load workshops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // derived filter options
  const cityOptions = useMemo(() => {
    const s = new Set(workshops.map((w) => w.city).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [workshops]);

  const countryOptions = useMemo(() => {
    const s = new Set(workshops.map((w) => w.country).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [workshops]);

  const displayWorkshops = useMemo(() => {
    let list = [...workshops];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((w) =>
        w.name.toLowerCase().includes(q) ||
        (w.contactName ?? '').toLowerCase().includes(q) ||
        (w.phone ?? '').toLowerCase().includes(q) ||
        (w.email ?? '').toLowerCase().includes(q) ||
        (w.city ?? '').toLowerCase().includes(q) ||
        (w.country ?? '').toLowerCase().includes(q)
      );
    }
    if (cityFilter)    list = list.filter((w) => w.city === cityFilter);
    if (countryFilter) list = list.filter((w) => w.country === countryFilter);
    if (statusFilter === 'active')   list = list.filter((w) => w.isActive);
    if (statusFilter === 'inactive') list = list.filter((w) => !w.isActive);

    if (sortBy) {
      list.sort((a, b) => {
        let av = '', bv = '';
        if (sortBy === 'name')    { av = a.name;               bv = b.name; }
        if (sortBy === 'contact') { av = a.contactName ?? '';  bv = b.contactName ?? ''; }
        if (sortBy === 'phone')   { av = a.phone ?? '';        bv = b.phone ?? ''; }
        if (sortBy === 'email')   { av = a.email ?? '';        bv = b.email ?? ''; }
        if (sortBy === 'city')    { av = a.city ?? '';         bv = b.city ?? ''; }
        if (sortBy === 'country') { av = a.country ?? '';      bv = b.country ?? ''; }
        return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return list;
  }, [workshops, search, cityFilter, countryFilter, statusFilter, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const clearFilters = () => {
    setSearch(''); setCityFilter(''); setCountryFilter(''); setStatusFilter('');
  };

  const hasFilters = search || cityFilter || countryFilter || statusFilter;

  const visibleCount = ALL_COLUMNS.filter((c) => col(c.key)).length + 1 + (canWrite ? 1 : 0); // +1 name, +1 actions

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setDialog(true); };
  const openEdit = (w: Workshop) => {
    setEditing(w);
    setForm({ name: w.name, contactName: w.contactName ?? '', phone: w.phone ?? '', email: w.email ?? '', address: w.address ?? '', city: w.city ?? '', country: w.country ?? '', notes: w.notes ?? '' });
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Workshop name required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await vehiclesApi.updateWorkshop(editing.id, form);
        toast.success('Workshop updated');
      } else {
        await vehiclesApi.createWorkshop(form);
        toast.success('Workshop created');
      }
      setDialog(false);
      load();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workshop?')) return;
    try {
      await vehiclesApi.deleteWorkshop(id);
      toast.success('Workshop deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const setField = (key: keyof WForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              Workshop Register
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Manage garages and service centres used for vehicle maintenance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canWrite && (
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Add Workshop
            </Button>
          )}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search name, contact, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={cityFilter || '__all__'} onValueChange={(v) => setCityFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="City" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Cities</SelectItem>
            {cityOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={countryFilter || '__all__'} onValueChange={(v) => setCountryFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Countries</SelectItem>
            {countryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        )}

        {/* column picker */}
        <div className="relative ml-auto" ref={colPickerRef}>
          <Button variant="outline" size="sm" onClick={() => setShowColPicker((v) => !v)}>
            <Columns2 className="w-4 h-4 mr-2" /> Columns
          </Button>
          {showColPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md p-2 w-44">
              {ALL_COLUMNS.map(({ key, label }) => (
                <button
                  key={key}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted"
                  onClick={() => toggleColumn(key)}
                >
                  <span className={`w-4 h-4 border rounded flex items-center justify-center ${col(key) ? 'bg-primary border-primary' : 'border-input'}`}>
                    {col(key) && <Check className="w-3 h-3 text-primary-foreground" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Name" field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                {col('contact') && <SortableHead label="Contact" field="contact" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {col('phone')   && <SortableHead label="Phone"   field="phone"   sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {col('email')   && <SortableHead label="Email"   field="email"   sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {col('city')    && <SortableHead label="City"    field="city"    sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {col('country') && <SortableHead label="Country" field="country" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : displayWorkshops.length === 0 ? (
                <TableRow><TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">
                  {hasFilters ? 'No workshops match the current filters' : 'No workshops registered yet'}
                </TableCell></TableRow>
              ) : displayWorkshops.map((w) => (
                <TableRow key={w.id} className={!w.isActive ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">
                    {w.name}
                    {!w.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                  </TableCell>
                  {col('contact') && <TableCell className="text-sm">{w.contactName ?? '—'}</TableCell>}
                  {col('phone')   && <TableCell className="text-sm">{w.phone ?? '—'}</TableCell>}
                  {col('email')   && <TableCell className="text-sm">{w.email ?? '—'}</TableCell>}
                  {col('city')    && <TableCell className="text-sm">{w.city ?? '—'}</TableCell>}
                  {col('country') && <TableCell className="text-sm">{w.country ?? '—'}</TableCell>}
                  {canWrite && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(w)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(w.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Workshop' : 'Add Workshop'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Workshop Name *</Label>
              <Input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. City Truck Services Ltd" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+44 ..." />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="service@example.com" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Street address" />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setField('country', e.target.value)} placeholder="UK" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Additional info" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Workshop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
