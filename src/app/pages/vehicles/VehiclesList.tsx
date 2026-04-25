import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Download, Eye, Plus, Truck, RefreshCw, X,
  Edit, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Columns2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { vehiclesApi, settingsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

// Legacy enum codes that may still appear on rows created before the
// vehicle-types lookup was introduced. Render them as the human label
// so the table doesn't show "REFRIGERATED_TRAILER" until the row is
// re-saved through the new form.
const LEGACY_TYPE_LABELS: Record<string, string> = {
  TRUCK: 'Truck',
  CAR: 'Car',
  VAN: 'Van',
  TANKER: 'Tanker',
  TRAILER: 'Trailer',
  REFRIGERATED_TRAILER: 'Refrigerated Trailer',
  SPECIALTY: 'Specialty',
};

const VEHICLE_STATUSES = [
  { value: 'ACTIVE',          label: 'Active',          color: 'bg-green-100 text-green-800' },
  { value: 'INACTIVE',        label: 'Inactive',        color: 'bg-gray-100 text-gray-700' },
  { value: 'IN_MAINTENANCE',  label: 'In Maintenance',  color: 'bg-yellow-100 text-yellow-800' },
  { value: 'SCRAPPED',        label: 'Scrapped',        color: 'bg-red-100 text-red-800' },
];

function statusBadge(status: string) {
  const s = VEHICLE_STATUSES.find((x) => x.value === status);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s?.color ?? 'bg-gray-100 text-gray-700'}`}>{s?.label ?? status}</span>;
}

function typeLabel(type: string) {
  return LEGACY_TYPE_LABELS[type] ?? type;
}

function expiryBadge(date: string | null | undefined) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const d = new Date(date);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0)   return <span className="text-xs text-red-600 font-medium">Expired</span>;
  if (days <= 30) return <span className="text-xs text-amber-600 font-medium">{days}d left</span>;
  return <span className="text-xs text-green-700">{d.toLocaleDateString()}</span>;
}

// ── Column visibility ────────────────────────────────────────────────────────
type ColKey = 'type' | 'makeModel' | 'year' | 'status' | 'driver' | 'mot' | 'tax' | 'registration' | 'insurance' | 'tachograph' | 'atp' | 'pressureTest' | 'lastService' | 'serviceType' | 'workshop';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'type',      label: 'Type' },
  { key: 'makeModel', label: 'Make / Model' },
  { key: 'year',      label: 'Year' },
  { key: 'status',    label: 'Status' },
  { key: 'driver',    label: 'Current Driver' },
  { key: 'mot',       label: 'MOT' },
  { key: 'tax',       label: 'Tax Expiry' },
  { key: 'registration', label: 'Registration Expiry' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'tachograph', label: 'Tachograph Calib.' },
  { key: 'atp',       label: 'ATP Cert.' },
  { key: 'pressureTest', label: 'Next Pressure Test' },
  { key: 'lastService', label: 'Last Service' },
  { key: 'serviceType', label: 'Service Type' },
  { key: 'workshop', label: 'Workshop' },
];

// All compliance/expiry columns are visible by default so the Fleet
// list surfaces every regulated date at a glance. Operators can hide
// the type-specific ones (Tachograph / ATP / Pressure Test) via the
// Columns picker if their fleet doesn't use them. Maintenance columns
// (Last Service, Service Type) are visible; Workshop is hidden by default.
const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  type: true, makeModel: true, year: true, status: true,
  driver: true, mot: true, tax: true, registration: true,
  insurance: true, tachograph: true, atp: true, pressureTest: true,
  lastService: true, serviceType: true, workshop: false,
};

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem('vehicles-table-columns');
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

// ── Sort header ──────────────────────────────────────────────────────────────
type SortField = 'registration' | 'type' | 'makeModel' | 'year' | 'status' | 'driver' | 'mot' | 'tax' | 'registrationExp' | 'insurance' | 'tachograph' | 'atp' | 'pressureTest' | 'lastService' | 'serviceType' | 'workshop';

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

export function VehiclesList() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const canWrite = canCreate('vehicles');

  // ── Data ───────────────────────────────────────────────────────────────────
  const [vehicles, setVehicles]         = useState<any[]>([]);
  const [stats, setStats]               = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [exporting, setExporting]       = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const LIMIT = 20;

  // Centralised type list — the filter dropdown reads from System Settings →
  // Vehicle Settings so admins can add/rename categories without a code
  // change. Falls back to the seed defaults if the lookup ever fails.
  useEffect(() => {
    settingsApi.getVehicleSettings()
      .then((data) => {
        const list = data?.vehicleTypes;
        setVehicleTypes(Array.isArray(list) && list.length
          ? list
          : ['Truck', 'Car', 'Van', 'Tanker', 'Trailer', 'Refrigerated Trailer', 'Specialty']);
      })
      .catch(() => setVehicleTypes(['Truck', 'Car', 'Van', 'Tanker', 'Trailer', 'Refrigerated Trailer', 'Specialty']));
  }, []);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Sorting (client-side on current page) ─────────────────────────────────
  const [sortBy, setSortBy]       = useState<SortField>('registration');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
  };

  // ── Column visibility ──────────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Record<ColKey, boolean>>(loadVisibleColumns);
  const [showColPicker, setShowColPicker]   = useState(false);
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
      localStorage.setItem('vehicles-table-columns', JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vehiclesApi.list({
        page, limit: LIMIT,
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setVehicles(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  const loadStats = useCallback(async () => {
    try { setStats(await vehiclesApi.getStats()); } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter]);

  // ── Sorted vehicles ────────────────────────────────────────────────────────
  const displayVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      let aVal: any, bVal: any;
      const driverA = a.driverAssignments?.[0]?.employee;
      const driverB = b.driverAssignments?.[0]?.employee;
      switch (sortBy) {
        case 'registration': aVal = a.registrationNumber?.toLowerCase() ?? ''; bVal = b.registrationNumber?.toLowerCase() ?? ''; break;
        case 'type':         aVal = typeLabel(a.type).toLowerCase(); bVal = typeLabel(b.type).toLowerCase(); break;
        case 'makeModel':    aVal = `${a.make ?? ''} ${a.model ?? ''}`.toLowerCase(); bVal = `${b.make ?? ''} ${b.model ?? ''}`.toLowerCase(); break;
        case 'year':         aVal = Number(a.year ?? 0); bVal = Number(b.year ?? 0); break;
        case 'status':       aVal = a.status ?? ''; bVal = b.status ?? ''; break;
        case 'driver':       aVal = driverA ? `${driverA.firstName} ${driverA.lastName}`.toLowerCase() : ''; bVal = driverB ? `${driverB.firstName} ${driverB.lastName}`.toLowerCase() : ''; break;
        case 'mot':          aVal = a.motExpiryDate ?? ''; bVal = b.motExpiryDate ?? ''; break;
        case 'tax':          aVal = a.taxExpiryDate ?? ''; bVal = b.taxExpiryDate ?? ''; break;
        case 'registrationExp': aVal = a.registrationExpiryDate ?? ''; bVal = b.registrationExpiryDate ?? ''; break;
        case 'insurance':    aVal = a.insuranceExpiryDate ?? ''; bVal = b.insuranceExpiryDate ?? ''; break;
        case 'tachograph':   aVal = a.tachographCalibrationExpiry ?? ''; bVal = b.tachographCalibrationExpiry ?? ''; break;
        case 'atp':          aVal = a.atpCertificateExpiry ?? ''; bVal = b.atpCertificateExpiry ?? ''; break;
        case 'pressureTest': aVal = a.nextPressureTestDate ?? ''; bVal = b.nextPressureTestDate ?? ''; break;
        case 'lastService':  aVal = a.maintenanceRecords?.[0]?.completedDate ?? ''; bVal = b.maintenanceRecords?.[0]?.completedDate ?? ''; break;
        case 'serviceType':  aVal = a.maintenanceRecords?.[0]?.maintenanceType?.name?.toLowerCase() ?? ''; bVal = b.maintenanceRecords?.[0]?.maintenanceType?.name?.toLowerCase() ?? ''; break;
        case 'workshop':     aVal = a.maintenanceRecords?.[0]?.workshop?.name?.toLowerCase() ?? ''; bVal = b.maintenanceRecords?.[0]?.workshop?.name?.toLowerCase() ?? ''; break;
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [vehicles, sortBy, sortOrder]);

  // ── Delete / Export ────────────────────────────────────────────────────────
  const handleDelete = async (vehicleId: string) => {
    if (!(await confirm({
      title: 'Delete vehicle?',
      description: 'This vehicle will be permanently removed. This cannot be undone easily.',
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await vehiclesApi.delete(vehicleId);
      toast.success('Vehicle deleted');
      loadVehicles(); loadStats();
    } catch { toast.error('Failed to delete vehicle'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await vehiclesApi.exportExcel({ type: typeFilter || undefined, status: statusFilter || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `vehicles-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const clearFilters = () => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(1); };
  const hasFilters = search || typeFilter || statusFilter;
  const totalPages = Math.ceil(total / LIMIT);

  const hiddenCount = ALL_COLUMNS.filter(c => !visibleColumns[c.key]).length;
  const colSpan = 2 + ALL_COLUMNS.filter(c => visibleColumns[c.key]).length; // registration + visible + actions

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            Vehicle Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage company fleet, documents and maintenance</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={loadVehicles} disabled={loading}>
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
                  <button onClick={() => { const all = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>; setVisibleColumns(all); localStorage.setItem('vehicles-table-columns', JSON.stringify(all)); }} className="flex-1 text-xs text-center text-blue-600 hover:underline py-0.5">Show all</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => { const none = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, false])) as Record<ColKey, boolean>; setVisibleColumns(none); localStorage.setItem('vehicles-table-columns', JSON.stringify(none)); }} className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5">Hide all</button>
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => navigate('/dashboard/vehicles/new')}>
              <Plus className="w-4 h-4 mr-2" />Add Vehicle
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total',            value: stats.totalVehicles,      color: 'text-blue-700' },
            { label: 'Active',           value: stats.activeVehicles,     color: 'text-green-700' },
            { label: 'In Maintenance',   value: stats.inMaintenance,      color: 'text-amber-700' },
            { label: 'Scrapped',         value: stats.scrapped,           color: 'text-gray-500' },
            { label: 'Upcoming Service', value: stats.upcomingMaintenance, color: 'text-purple-700' },
            { label: 'Expiring Docs',    value: stats.expiringDocs,       color: 'text-red-700' },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search registration, make, model…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter || 'all'} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {vehicleTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {VEHICLE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Fleet ({total} vehicle{total !== 1 ? 's' : ''})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Registration" field="registration" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  {col('type')      && <SortableHead label="Type"           field="type"       sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('makeModel') && <SortableHead label="Make / Model"   field="makeModel"  sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('year')      && <SortableHead label="Year"           field="year"       sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('status')    && <SortableHead label="Status"         field="status"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('driver')    && <SortableHead label="Current Driver" field="driver"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('mot')       && <SortableHead label="MOT"            field="mot"        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('tax')       && <SortableHead label="Tax"            field="tax"        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('registration') && <SortableHead label="Registration" field="registrationExp" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('insurance') && <SortableHead label="Insurance"      field="insurance"  sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('tachograph') && <SortableHead label="Tachograph"    field="tachograph" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('atp')       && <SortableHead label="ATP"            field="atp"        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('pressureTest') && <SortableHead label="Pressure Test" field="pressureTest" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('lastService') && <SortableHead label="Last Service" field="lastService" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('serviceType') && <SortableHead label="Service Type" field="serviceType" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  {col('workshop') && <SortableHead label="Workshop" field="workshop" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : displayVehicles.length === 0 ? (
                  <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">No vehicles found</TableCell></TableRow>
                ) : displayVehicles.map((v) => {
                  const driver = v.driverAssignments?.[0]?.employee;
                  return (
                    <TableRow key={v.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/dashboard/vehicles/${v.id}`)}>
                      <TableCell className="font-mono font-medium">{v.registrationNumber}</TableCell>
                      {col('type')      && <TableCell className="text-sm">{typeLabel(v.type)}</TableCell>}
                      {col('makeModel') && <TableCell>{v.make} {v.model}</TableCell>}
                      {col('year')      && <TableCell>{v.year ?? '—'}</TableCell>}
                      {col('status')    && <TableCell>{statusBadge(v.status)}</TableCell>}
                      {col('driver')    && (
                        <TableCell className="text-sm">
                          {driver ? `${driver.firstName} ${driver.lastName}` : <span className="text-muted-foreground">Unassigned</span>}
                        </TableCell>
                      )}
                      {col('mot')       && <TableCell>{expiryBadge(v.motExpiryDate)}</TableCell>}
                      {col('tax')       && <TableCell>{expiryBadge(v.taxExpiryDate)}</TableCell>}
                      {col('registration') && <TableCell>{expiryBadge(v.registrationExpiryDate)}</TableCell>}
                      {col('insurance') && <TableCell>{expiryBadge(v.insuranceExpiryDate)}</TableCell>}
                      {col('tachograph') && <TableCell>{expiryBadge(v.tachographCalibrationExpiry)}</TableCell>}
                      {col('atp')       && <TableCell>{expiryBadge(v.atpCertificateExpiry)}</TableCell>}
                      {col('pressureTest') && <TableCell>{expiryBadge(v.nextPressureTestDate)}</TableCell>}
                      {col('lastService') && (
                        <TableCell className="text-sm">
                          {v.maintenanceRecords?.[0]?.completedDate
                            ? new Date(v.maintenanceRecords[0].completedDate).toLocaleDateString()
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                      )}
                      {col('serviceType') && (
                        <TableCell className="text-sm">
                          {v.maintenanceRecords?.[0]?.maintenanceType?.name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      {col('workshop') && (
                        <TableCell className="text-sm">
                          {v.maintenanceRecords?.[0]?.workshop?.name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/vehicles/${v.id}`)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canWrite && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/vehicles/${v.id}/edit`)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(v.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
