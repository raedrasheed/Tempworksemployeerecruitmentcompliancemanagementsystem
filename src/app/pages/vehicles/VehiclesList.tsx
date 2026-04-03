import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Download, Eye, Plus, Truck, Filter, RefreshCw, X,
  AlertTriangle, Car, Container, Thermometer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { vehiclesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

const VEHICLE_TYPES = [
  { value: 'TRUCK', label: 'Truck' },
  { value: 'CAR', label: 'Car' },
  { value: 'VAN', label: 'Van' },
  { value: 'TANKER', label: 'Tanker' },
  { value: 'TRAILER', label: 'Trailer' },
  { value: 'REFRIGERATED_TRAILER', label: 'Refrigerated Trailer' },
  { value: 'SPECIALTY', label: 'Specialty' },
];

const VEHICLE_STATUSES = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'INACTIVE', label: 'Inactive', color: 'bg-gray-100 text-gray-700' },
  { value: 'IN_MAINTENANCE', label: 'In Maintenance', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'SCRAPPED', label: 'Scrapped', color: 'bg-red-100 text-red-800' },
];

function statusBadge(status: string) {
  const s = VEHICLE_STATUSES.find((x) => x.value === status);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s?.color ?? 'bg-gray-100 text-gray-700'}`}>{s?.label ?? status}</span>;
}

function typeLabel(type: string) {
  return VEHICLE_TYPES.find((t) => t.value === type)?.label ?? type;
}

function expiryBadge(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (days < 0)  return <span className="text-xs text-red-600 font-medium">Expired</span>;
  if (days <= 30) return <span className="text-xs text-amber-600 font-medium">{days}d left</span>;
  return <span className="text-xs text-green-700">{d.toLocaleDateString()}</span>;
}

export function VehiclesList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('vehicles:write');

  const [vehicles, setVehicles]     = useState<any[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [exporting, setExporting]   = useState(false);
  const LIMIT = 20;

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
    try {
      const s = await vehiclesApi.getStats();
      setStats(s);
    } catch {
      // stats are non-critical
    }
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await vehiclesApi.exportExcel({
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vehicles-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(1); };
  const hasFilters = search || typeFilter || statusFilter;

  const totalPages = Math.ceil(total / LIMIT);

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => navigate('/dashboard/vehicles/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.totalVehicles, color: 'text-blue-700' },
            { label: 'Active', value: stats.activeVehicles, color: 'text-green-700' },
            { label: 'In Maintenance', value: stats.inMaintenance, color: 'text-amber-700' },
            { label: 'Scrapped', value: stats.scrapped, color: 'text-gray-500' },
            { label: 'Upcoming Service', value: stats.upcomingMaintenance, color: 'text-purple-700' },
            { label: 'Expiring Docs', value: stats.expiringDocs, color: 'text-red-700' },
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
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {VEHICLE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadVehicles}>
              <RefreshCw className="w-4 h-4" />
            </Button>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Driver</TableHead>
                <TableHead>MOT</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : vehicles.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No vehicles found</TableCell></TableRow>
              ) : vehicles.map((v) => {
                const driver = v.driverAssignments?.[0]?.employee;
                return (
                  <TableRow key={v.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/dashboard/vehicles/${v.id}`)}>
                    <TableCell className="font-mono font-medium">{v.registrationNumber}</TableCell>
                    <TableCell className="text-sm">{typeLabel(v.type)}</TableCell>
                    <TableCell>{v.make} {v.model}</TableCell>
                    <TableCell>{v.year ?? '—'}</TableCell>
                    <TableCell>{statusBadge(v.status)}</TableCell>
                    <TableCell className="text-sm">
                      {driver ? `${driver.firstName} ${driver.lastName}` : <span className="text-muted-foreground">Unassigned</span>}
                    </TableCell>
                    <TableCell>{expiryBadge(v.motExpiryDate)}</TableCell>
                    <TableCell>{expiryBadge(v.insuranceExpiryDate)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/vehicles/${v.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

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
