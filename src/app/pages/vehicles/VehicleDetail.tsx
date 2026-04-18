import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Edit, Truck, User, FileText, Wrench, Plus,
  Trash2, AlertTriangle, Search, ChevronDown, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { vehiclesApi, employeesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-700',
    IN_MAINTENANCE: 'bg-yellow-100 text-yellow-800',
    SCRAPPED: 'bg-red-100 text-red-800',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>{status.replace('_', ' ')}</span>;
}

function mStatusBadge(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>{status.replace('_', ' ')}</span>;
}

function expiryCell(date: string | null | undefined) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const d = new Date(date);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const text = d.toLocaleDateString();
  if (days < 0)  return <span className="text-red-600 text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{text} (Expired)</span>;
  if (days <= 30) return <span className="text-amber-600 text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{text} ({days}d)</span>;
  return <span className="text-xs">{text}</span>;
}

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const canWrite = canCreate('vehicles');

  const [vehicle, setVehicle]             = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [workshops, setWorkshops]         = useState<any[]>([]);
  const [maintenanceTypes, setMtnTypes]   = useState<any[]>([]);

  // Assign driver dialog
  const [assignDialog, setAssignDialog]     = useState(false);
  const [driverEmployeeId, setDriverEmpId]  = useState('');
  const [driverSelectedName, setDriverName] = useState('');
  const [driverStartDate, setDriverStart]   = useState(new Date().toISOString().split('T')[0]);
  const [assigningSaving, setAssignSaving]  = useState(false);

  // Driver picker search
  const [driverSearch, setDriverSearch]     = useState('');
  const [driverOptions, setDriverOptions]   = useState<any[]>([]);
  const [driverLoading, setDriverLoading]   = useState(false);
  const [pickerOpen, setPickerOpen]         = useState(false);
  const pickerRef                           = useRef<HTMLDivElement>(null);

  // Add / Edit document dialog
  const [docDialog, setDocDialog]         = useState(false);
  const [editingDoc, setEditingDoc]       = useState<any>(null);
  const [docForm, setDocForm]             = useState({ name: '', documentType: 'MOT', expiryDate: '', issuedDate: '', issuer: '', notes: '' });
  const [docFile, setDocFile]             = useState<File | null>(null);
  const [docSaving, setDocSaving]         = useState(false);

  // Add / Edit maintenance dialog
  const [mainDialog, setMainDialog]       = useState(false);
  const [editingMain, setEditingMain]     = useState<any>(null);
  const [mainForm, setMainForm]           = useState<any>({
    maintenanceTypeId: '', workshopId: '', status: 'SCHEDULED',
    scheduledDate: '', completedDate: '', description: '', mileageAtService: '', cost: '', notes: '',
  });
  const [mainSaving, setMainSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, ws, mt] = await Promise.all([
        vehiclesApi.getOne(id!),
        vehiclesApi.listWorkshops(),
        vehiclesApi.listMaintenanceTypes(),
      ]);
      setVehicle(v);
      setWorkshops(ws);
      setMtnTypes(mt);
    } catch {
      toast.error('Failed to load vehicle');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Load driver options when the assign dialog opens or search changes
  useEffect(() => {
    if (!assignDialog) return;
    let cancelled = false;
    setDriverLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await employeesApi.list({
          driversOnly: 'true',
          search: driverSearch || undefined,
          limit: 50,
        });
        if (!cancelled) setDriverOptions(res.data ?? []);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setDriverLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [assignDialog, driverSearch]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete vehicle?',
      description: 'This vehicle will be permanently removed. This action cannot be undone easily.',
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await vehiclesApi.delete(id!);
      toast.success('Vehicle deleted');
      navigate('/dashboard/vehicles');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleAssignDriver = async () => {
    if (!driverEmployeeId) { toast.error('Please select a driver'); return; }
    setAssignSaving(true);
    try {
      await vehiclesApi.assignDriver(id!, { employeeId: driverEmployeeId, startDate: driverStartDate });
      toast.success('Driver assigned');
      setAssignDialog(false);
      load();
    } catch {
      toast.error('Failed to assign driver');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!(await confirm({
      title: 'End driver assignment?',
      description: 'The current driver assignment will be ended.',
      confirmText: 'End assignment',
    }))) return;
    try {
      await vehiclesApi.unassignDriver(id!, assignmentId);
      toast.success('Driver unassigned');
      load();
    } catch {
      toast.error('Failed to unassign driver');
    }
  };

  const openAddDoc = () => {
    setEditingDoc(null);
    setDocForm({ name: '', documentType: 'MOT', expiryDate: '', issuedDate: '', issuer: '', notes: '' });
    setDocFile(null);
    setDocDialog(true);
  };

  const openEditDoc = (doc: any) => {
    setEditingDoc(doc);
    setDocForm({
      name:         doc.name ?? '',
      documentType: doc.documentType ?? 'MOT',
      expiryDate:   doc.expiryDate ? doc.expiryDate.split('T')[0] : '',
      issuedDate:   doc.issuedDate ? doc.issuedDate.split('T')[0] : '',
      issuer:       doc.issuer ?? '',
      notes:        doc.notes ?? '',
    });
    setDocFile(null);
    setDocDialog(true);
  };

  const handleSaveDoc = async () => {
    if (!docForm.name.trim()) { toast.error('Document name required'); return; }
    setDocSaving(true);
    try {
      if (editingDoc) {
        await vehiclesApi.updateDocument(id!, editingDoc.id, {
          name:         docForm.name,
          documentType: docForm.documentType,
          expiryDate:   docForm.expiryDate || undefined,
          issuedDate:   docForm.issuedDate || undefined,
          issuer:       docForm.issuer || undefined,
          notes:        docForm.notes || undefined,
        });
        toast.success('Document updated');
      } else {
        await vehiclesApi.addDocument(
          id!,
          {
            name:         docForm.name,
            documentType: docForm.documentType,
            expiryDate:   docForm.expiryDate || undefined,
            issuedDate:   docForm.issuedDate || undefined,
            issuer:       docForm.issuer || undefined,
            notes:        docForm.notes || undefined,
          },
          docFile ?? undefined,
        );
        toast.success('Document added');
      }
      setDocDialog(false);
      load();
    } catch {
      toast.error(editingDoc ? 'Failed to update document' : 'Failed to add document');
    } finally {
      setDocSaving(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!(await confirm({
      title: 'Delete document?',
      description: 'This document will be permanently removed.',
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await vehiclesApi.deleteDocument(id!, docId);
      toast.success('Document deleted');
      load();
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const BLANK_MAIN = { maintenanceTypeId: '', workshopId: '', status: 'SCHEDULED', scheduledDate: '', completedDate: '', description: '', mileageAtService: '', cost: '', notes: '' };

  const openAddMaintenance = () => {
    setEditingMain(null);
    setMainForm(BLANK_MAIN);
    setMainDialog(true);
  };

  const openEditMaintenance = (rec: any) => {
    setEditingMain(rec);
    setMainForm({
      maintenanceTypeId: rec.maintenanceTypeId ?? '',
      workshopId:        rec.workshopId ?? '',
      status:            rec.status ?? 'SCHEDULED',
      scheduledDate:     rec.scheduledDate ? rec.scheduledDate.split('T')[0] : '',
      completedDate:     rec.completedDate ? rec.completedDate.split('T')[0] : '',
      description:       rec.description ?? '',
      mileageAtService:  rec.mileageAtService ?? '',
      cost:              rec.cost ?? '',
      notes:             rec.notes ?? '',
    });
    setMainDialog(true);
  };

  const handleSaveMaintenance = async () => {
    setMainSaving(true);
    try {
      const payload: any = {
        maintenanceTypeId: mainForm.maintenanceTypeId || undefined,
        workshopId:        mainForm.workshopId || undefined,
        status:            mainForm.status,
        scheduledDate:     mainForm.scheduledDate || undefined,
        completedDate:     mainForm.completedDate || undefined,
        description:       mainForm.description || undefined,
        mileageAtService:  mainForm.mileageAtService ? parseInt(mainForm.mileageAtService) : undefined,
        cost:              mainForm.cost ? parseFloat(mainForm.cost) : undefined,
        notes:             mainForm.notes || undefined,
      };
      if (editingMain) {
        await vehiclesApi.updateMaintenance(editingMain.id, payload);
        toast.success('Maintenance record updated');
      } else {
        await vehiclesApi.createMaintenance({ vehicleId: id!, ...payload });
        toast.success('Maintenance record added');
      }
      setMainDialog(false);
      load();
    } catch {
      toast.error(editingMain ? 'Failed to update record' : 'Failed to add maintenance record');
    } finally {
      setMainSaving(false);
    }
  };

  const handleDeleteMaintenance = async (recId: string) => {
    if (!(await confirm({
      title: 'Delete maintenance record?',
      description: 'This maintenance record will be permanently removed.',
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await vehiclesApi.deleteMaintenance(recId);
      toast.success('Record deleted');
      load();
    } catch {
      toast.error('Failed to delete record');
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!vehicle) return <div className="p-6 text-red-600">Vehicle not found</div>;

  const activeDriver = vehicle.driverAssignments?.find((a: any) => a.isActive);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/vehicles')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {vehicle.registrationNumber}
            </h1>
            <p className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model} · {vehicle.type?.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {statusBadge(vehicle.status)}
          {canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/vehicles/${id}/edit`)}>
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="driver">Driver ({vehicle.driverAssignments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({vehicle.documents?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({vehicle.maintenanceRecords?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Vehicle Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ['Year', vehicle.year ?? '—'],
                  ['Color', vehicle.color ?? '—'],
                  ['VIN', vehicle.vin ?? '—'],
                  ['Fuel Type', vehicle.fuelType ?? '—'],
                  ['Current Mileage', vehicle.currentMileage ? `${vehicle.currentMileage.toLocaleString()} km` : '—'],
                  ['Agency', vehicle.agency?.name ?? '—'],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Compliance</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">MOT Expiry</span>
                  {expiryCell(vehicle.motExpiryDate)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tax Expiry</span>
                  {expiryCell(vehicle.taxExpiryDate)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Insurance Expiry</span>
                  {expiryCell(vehicle.insuranceExpiryDate)}
                </div>
              </CardContent>
            </Card>
          </div>

          {vehicle.notes && (
            <Card>
              <CardContent className="pt-4 text-sm text-muted-foreground">{vehicle.notes}</CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Driver Tab */}
        <TabsContent value="driver" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Driver Assignments</h3>
            {canWrite && (
              <Button size="sm" onClick={() => {
                setDriverEmpId('');
                setDriverName('');
                setDriverSearch('');
                setPickerOpen(false);
                setAssignDialog(true);
              }}>
                <User className="w-4 h-4 mr-2" /> Assign Driver
              </Button>
            )}
          </div>

          {activeDriver && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-medium">{activeDriver.employee.firstName} {activeDriver.employee.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        Licence: {activeDriver.employee.licenseNumber ?? '—'} · Since {new Date(activeDriver.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-green-200 text-green-800 text-xs">Active</Badge>
                  </div>
                  {canWrite && (
                    <Button size="sm" variant="outline" onClick={() => handleUnassign(activeDriver.id)}>
                      End Assignment
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.driverAssignments?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No assignments</TableCell></TableRow>
              ) : vehicle.driverAssignments?.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.employee.firstName} {a.employee.lastName}</TableCell>
                  <TableCell className="font-mono text-sm">{a.employee.licenseNumber ?? '—'}</TableCell>
                  <TableCell className="text-sm">{new Date(a.startDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">{a.endDate ? new Date(a.endDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded ${a.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {a.isActive ? 'Active' : 'Ended'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Vehicle Documents</h3>
            {canWrite && (
              <Button size="sm" onClick={openAddDoc}>
                <Plus className="w-4 h-4 mr-2" /> Add Document
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.documents?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No documents</TableCell></TableRow>
              ) : vehicle.documents?.map((doc: any) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  <TableCell className="text-sm">{doc.documentType}</TableCell>
                  <TableCell className="text-sm">{doc.issuer ?? '—'}</TableCell>
                  <TableCell className="text-sm">{doc.issuedDate ? new Date(doc.issuedDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{expiryCell(doc.expiryDate)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {doc.fileUrl && (
                        <a
                          href={`${(import.meta.env.VITE_API_URL as string | undefined)?.replace('/api/v1', '') ?? 'http://localhost:3000'}${doc.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          download={doc.fileName ?? undefined}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                          title={`Download ${doc.fileName ?? 'file'}`}
                        >
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </a>
                      )}
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEditDoc(doc)}>
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteDoc(doc.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Maintenance Records</h3>
            {canWrite && (
              <Button size="sm" onClick={openAddMaintenance}>
                <Plus className="w-4 h-4 mr-2" /> Add Record
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Workshop</TableHead>
                <TableHead>Cost</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.maintenanceRecords?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No maintenance records</TableCell></TableRow>
              ) : vehicle.maintenanceRecords?.map((rec: any) => (
                <TableRow key={rec.id}>
                  <TableCell className="font-medium text-sm">{rec.maintenanceType?.name ?? rec.description ?? '—'}</TableCell>
                  <TableCell>{mStatusBadge(rec.status)}</TableCell>
                  <TableCell className="text-sm">{rec.scheduledDate ? new Date(rec.scheduledDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-sm">{rec.completedDate ? new Date(rec.completedDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-sm">{rec.workshop?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{rec.cost ? `£${rec.cost.toFixed(2)}` : '—'}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditMaintenance(rec)}>
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteMaintenance(rec.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDialog} onOpenChange={(open) => {
        setAssignDialog(open);
        if (!open) { setPickerOpen(false); setDriverSearch(''); }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Driver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Searchable employee picker */}
            <div className="space-y-1" ref={pickerRef}>
              <Label>Select Driver *</Label>
              {/* Selected employee display / search input */}
              <div className="relative">
                <div
                  className="flex items-center border rounded-md px-3 py-2 gap-2 cursor-text bg-background focus-within:ring-2 focus-within:ring-ring"
                  onClick={() => setPickerOpen(true)}
                >
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  {driverSelectedName && !pickerOpen ? (
                    <span className="text-sm flex-1">{driverSelectedName}</span>
                  ) : (
                    <input
                      autoFocus={pickerOpen}
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      placeholder="Search by name or licence…"
                      value={driverSearch}
                      onChange={(e) => { setDriverSearch(e.target.value); setPickerOpen(true); }}
                      onFocus={() => setPickerOpen(true)}
                    />
                  )}
                  {driverSelectedName && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs ml-auto"
                      onClick={(e) => { e.stopPropagation(); setDriverEmpId(''); setDriverName(''); setDriverSearch(''); setPickerOpen(true); }}
                    >✕</button>
                  )}
                </div>

                {/* Dropdown */}
                {pickerOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                    {driverLoading ? (
                      <div className="py-3 text-center text-sm text-muted-foreground">Searching…</div>
                    ) : driverOptions.length === 0 ? (
                      <div className="py-3 text-center text-sm text-muted-foreground">No drivers found</div>
                    ) : driverOptions.map((emp: any) => (
                      <button
                        key={emp.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2 ${driverEmployeeId === emp.id ? 'bg-accent font-medium' : ''}`}
                        onClick={() => {
                          setDriverEmpId(emp.id);
                          setDriverName(`${emp.firstName} ${emp.lastName}`);
                          setDriverSearch('');
                          setPickerOpen(false);
                        }}
                      >
                        <User className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              emp.jobType?.name,
                              emp.licenseCategory,
                              emp.licenseNumber,
                            ].filter(Boolean).join(' · ') || 'Driver'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={driverStartDate} onChange={(e) => setDriverStart(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssignDriver} disabled={assigningSaving || !driverEmployeeId}>
              {assigningSaving ? 'Assigning…' : 'Assign Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Document Dialog */}
      <Dialog open={docDialog} onOpenChange={(open) => { setDocDialog(open); if (!open) setDocFile(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDoc ? 'Edit Document' : 'Add Vehicle Document'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Document Name *</Label>
              <Input value={docForm.name} onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. MOT Certificate" />
            </div>
            <div className="space-y-1">
              <Label>Document Type</Label>
              <Select value={docForm.documentType} onValueChange={(v) => setDocForm((f) => ({ ...f, documentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['MOT', 'Insurance', 'Road Tax', 'Registration', 'Inspection', 'Other'].map((t) =>
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Issued Date</Label>
                <Input type="date" value={docForm.issuedDate} onChange={(e) => setDocForm((f) => ({ ...f, issuedDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Expiry Date</Label>
                <Input type="date" value={docForm.expiryDate} onChange={(e) => setDocForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Issuer</Label>
              <Input value={docForm.issuer} onChange={(e) => setDocForm((f) => ({ ...f, issuer: e.target.value }))} placeholder="e.g. DVSA" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={docForm.notes} onChange={(e) => setDocForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
            {!editingDoc && (
              <div className="space-y-1">
                <Label>File <span className="text-muted-foreground text-xs">(optional, max 20 MB)</span></Label>
                <input
                  type="file"
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-input file:text-sm file:bg-background file:cursor-pointer hover:file:bg-accent cursor-pointer"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
                {docFile && (
                  <p className="text-xs text-muted-foreground">{docFile.name} ({(docFile.size / 1024).toFixed(0)} KB)</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDocDialog(false); setDocFile(null); }}>Cancel</Button>
            <Button onClick={handleSaveDoc} disabled={docSaving}>
              {docSaving ? 'Saving…' : editingDoc ? 'Save Changes' : 'Add Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Maintenance Dialog */}
      <Dialog open={mainDialog} onOpenChange={setMainDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingMain ? 'Edit Maintenance Record' : 'Add Maintenance Record'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Maintenance Type</Label>
                <Select value={mainForm.maintenanceTypeId || 'none'} onValueChange={(v) => setMainForm((f: any) => ({ ...f, maintenanceTypeId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {maintenanceTypes.map((mt: any) => <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={mainForm.status} onValueChange={(v) => setMainForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Scheduled Date</Label>
                <Input type="date" value={mainForm.scheduledDate} onChange={(e) => setMainForm((f: any) => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Completed Date</Label>
                <Input type="date" value={mainForm.completedDate} onChange={(e) => setMainForm((f: any) => ({ ...f, completedDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Workshop</Label>
                <Select value={mainForm.workshopId || 'none'} onValueChange={(v) => setMainForm((f: any) => ({ ...f, workshopId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select workshop" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {workshops.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Mileage at Service</Label>
                <Input type="number" value={mainForm.mileageAtService} onChange={(e) => setMainForm((f: any) => ({ ...f, mileageAtService: e.target.value }))} placeholder="km" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Total Cost (£)</Label>
                <Input type="number" step="0.01" value={mainForm.cost} onChange={(e) => setMainForm((f: any) => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={mainForm.description} onChange={(e) => setMainForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Work description" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={mainForm.notes} onChange={(e) => setMainForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMainDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveMaintenance} disabled={mainSaving}>
              {mainSaving ? 'Saving…' : editingMain ? 'Save Changes' : 'Add Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
