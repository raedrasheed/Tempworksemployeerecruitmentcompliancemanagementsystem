import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { vehiclesApi, settingsApi } from '../../services/api';

type VehicleLookups = Record<string, string[]>;

// Type-specific sections key off the configured vehicle type by matching
// well-known keywords in its name, so admins can rename a type ("Lorry"
// for "Truck") or add new ones ("Refrigerated Van") without losing the
// associated form sections.
const isTruckLike = (t: string) => /truck|trailer|lorry/i.test(t);
const isTankerLike = (t: string) => /tanker/i.test(t);
const isVanLike = (t: string) => /\bvan\b/i.test(t);
const isCarLike = (t: string) => /\bcar\b/i.test(t);
const isRefrigeratedLike = (t: string) => /refrigerat/i.test(t);
const isSpecialtyLike = (t: string) => /special/i.test(t);

type FormData = {
  registrationNumber: string;
  licensePlate: string;
  type: string;
  make: string;
  model: string;
  status: string;
  year: string;
  color: string;
  vin: string;
  fuelType: string;
  fuelCapacity: string;
  currentMileage: string;
  motExpiryDate: string;
  taxExpiryDate: string;
  registrationExpiryDate: string;
  insuranceExpiryDate: string;
  notes: string;
  // Purchase info
  purchaseOrder: string;
  purchaseDate: string;
  purchaseCost: string;
  purchaseContract: string;
  vendorName: string;
  vendorAddress: string;
  // Insurance
  insurancePolicyNumber: string;
  insuranceCompany: string;
  insuranceType: string;
  insuranceStartDate: string;
  // Truck/Trailer specs
  grossWeight: string;
  payloadCapacity: string;
  numberOfAxles: string;
  tareWeight: string;
  bodyType: string;
  hitchType: string;
  lengthM: string;
  widthM: string;
  heightM: string;
  euroEmissionClass: string;
  tachographSerial: string;
  tachographCalibrationExpiry: string;
  trailerLength: string;
  // Van specs
  seatingCapacity: string;
  loadVolume: string;
  partitionFitted: boolean;
  // Car specs
  vinSubType: string;
  insuranceGroup: string;
  // Tanker specs
  tankMaterial: string;
  adrClass: string;
  unNumbers: string;
  lastPressureTestDate: string;
  nextPressureTestDate: string;
  tankerCapacity: string;
  // Refrigerated trailer specs
  refrigerationUnit: string;
  refrigerationModel: string;
  tempMin: string;
  tempMax: string;
  atpCertificateNumber: string;
  atpCertificateExpiry: string;
  // Specialty
  equipmentDescription: string;
};

const EMPTY: FormData = {
  registrationNumber: '', licensePlate: '', type: '', make: '', model: '', status: 'ACTIVE',
  year: '', color: '', vin: '', fuelType: '', fuelCapacity: '', currentMileage: '',
  motExpiryDate: '', taxExpiryDate: '', registrationExpiryDate: '', insuranceExpiryDate: '', notes: '',
  purchaseOrder: '', purchaseDate: '', purchaseCost: '', purchaseContract: '', vendorName: '', vendorAddress: '',
  insurancePolicyNumber: '', insuranceCompany: '', insuranceType: '', insuranceStartDate: '',
  grossWeight: '', payloadCapacity: '', numberOfAxles: '', tareWeight: '', bodyType: '', hitchType: '',
  lengthM: '', widthM: '', heightM: '', euroEmissionClass: '', tachographSerial: '', tachographCalibrationExpiry: '',
  trailerLength: '', seatingCapacity: '', loadVolume: '', partitionFitted: false,
  vinSubType: '', insuranceGroup: '', tankMaterial: '', adrClass: '', unNumbers: '',
  lastPressureTestDate: '', nextPressureTestDate: '', tankerCapacity: '',
  refrigerationUnit: '', refrigerationModel: '', tempMin: '', tempMax: '', atpCertificateNumber: '', atpCertificateExpiry: '',
  equipmentDescription: '',
};

function typeSpecificFields(type: string) {
  return isTruckLike(type) || isTankerLike(type) || isVanLike(type) || isCarLike(type) || isRefrigeratedLike(type) || isSpecialtyLike(type);
}

export function VehicleForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormData>(EMPTY);
  const [lookups, setLookups] = useState<VehicleLookups | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    settingsApi.getVehicleSettings()
      .then((data) => setLookups(data))
      .catch(() => toast.error('Failed to load vehicle settings'));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    vehiclesApi.getOne(id!).then((v) => {
      setForm({
        registrationNumber: v.registrationNumber ?? '',
        licensePlate: v.licensePlate ?? '',
        type: v.type ?? '',
        make: v.make ?? '',
        model: v.model ?? '',
        status: v.status ?? 'ACTIVE',
        year: v.year ? String(v.year) : '',
        color: v.color ?? '',
        vin: v.vin ?? '',
        fuelType: v.fuelType ?? '',
        fuelCapacity: v.fuelCapacity ? String(v.fuelCapacity) : '',
        currentMileage: v.currentMileage ? String(v.currentMileage) : '',
        motExpiryDate: v.motExpiryDate ? v.motExpiryDate.split('T')[0] : '',
        taxExpiryDate: v.taxExpiryDate ? v.taxExpiryDate.split('T')[0] : '',
        registrationExpiryDate: v.registrationExpiryDate ? v.registrationExpiryDate.split('T')[0] : '',
        insuranceExpiryDate: v.insuranceExpiryDate ? v.insuranceExpiryDate.split('T')[0] : '',
        notes: v.notes ?? '',
        purchaseOrder: v.purchaseOrder ?? '',
        purchaseDate: v.purchaseDate ? v.purchaseDate.split('T')[0] : '',
        purchaseCost: v.purchaseCost ? String(v.purchaseCost) : '',
        purchaseContract: v.purchaseContract ?? '',
        vendorName: v.vendorName ?? '',
        vendorAddress: v.vendorAddress ?? '',
        insurancePolicyNumber: v.insurancePolicyNumber ?? '',
        insuranceCompany: v.insuranceCompany ?? '',
        insuranceType: v.insuranceType ?? '',
        insuranceStartDate: v.insuranceStartDate ? v.insuranceStartDate.split('T')[0] : '',
        grossWeight: v.grossWeight ? String(v.grossWeight) : '',
        payloadCapacity: v.payloadCapacity ? String(v.payloadCapacity) : '',
        numberOfAxles: v.numberOfAxles ? String(v.numberOfAxles) : '',
        tareWeight: v.tareWeight ? String(v.tareWeight) : '',
        bodyType: v.bodyType ?? '',
        hitchType: v.hitchType ?? '',
        lengthM: v.lengthM ? String(v.lengthM) : '',
        widthM: v.widthM ? String(v.widthM) : '',
        heightM: v.heightM ? String(v.heightM) : '',
        euroEmissionClass: v.euroEmissionClass ?? '',
        tachographSerial: v.tachographSerial ?? '',
        tachographCalibrationExpiry: v.tachographCalibrationExpiry ? v.tachographCalibrationExpiry.split('T')[0] : '',
        trailerLength: v.trailerLength ? String(v.trailerLength) : '',
        seatingCapacity: v.seatingCapacity ? String(v.seatingCapacity) : '',
        loadVolume: v.loadVolume ? String(v.loadVolume) : '',
        partitionFitted: v.partitionFitted ?? false,
        vinSubType: v.vinSubType ?? '',
        insuranceGroup: v.insuranceGroup ?? '',
        tankMaterial: v.tankMaterial ?? '',
        adrClass: v.adrClass ?? '',
        unNumbers: v.unNumbers ?? '',
        lastPressureTestDate: v.lastPressureTestDate ? v.lastPressureTestDate.split('T')[0] : '',
        nextPressureTestDate: v.nextPressureTestDate ? v.nextPressureTestDate.split('T')[0] : '',
        tankerCapacity: v.tankerCapacity ? String(v.tankerCapacity) : '',
        refrigerationUnit: v.refrigerationUnit ?? '',
        refrigerationModel: v.refrigerationModel ?? '',
        tempMin: v.tempMin ? String(v.tempMin) : '',
        tempMax: v.tempMax ? String(v.tempMax) : '',
        atpCertificateNumber: v.atpCertificateNumber ?? '',
        atpCertificateExpiry: v.atpCertificateExpiry ? v.atpCertificateExpiry.split('T')[0] : '',
        equipmentDescription: v.equipmentDescription ?? '',
      });
    }).catch(() => toast.error('Failed to load vehicle')).finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key: keyof FormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.registrationNumber.trim()) { toast.error('Registration number is required'); return; }
    if (!form.type) { toast.error('Vehicle type is required'); return; }
    if (!form.make.trim()) { toast.error('Make is required'); return; }
    if (!form.model.trim()) { toast.error('Model is required'); return; }

    setSaving(true);
    try {
      const payload: any = {
        registrationNumber: form.registrationNumber.trim(),
        licensePlate: form.licensePlate || undefined,
        type: form.type,
        make: form.make.trim(),
        model: form.model.trim(),
        status: form.status || undefined,
        year: form.year ? parseInt(form.year) : undefined,
        color: form.color || undefined,
        vin: form.vin || undefined,
        fuelType: form.fuelType || undefined,
        fuelCapacity: form.fuelCapacity ? parseFloat(form.fuelCapacity) : undefined,
        currentMileage: form.currentMileage ? parseInt(form.currentMileage) : undefined,
        motExpiryDate: form.motExpiryDate || undefined,
        taxExpiryDate: form.taxExpiryDate || undefined,
        registrationExpiryDate: form.registrationExpiryDate || undefined,
        insuranceExpiryDate: form.insuranceExpiryDate || undefined,
        notes: form.notes || undefined,
        purchaseOrder: form.purchaseOrder || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchaseCost: form.purchaseCost ? parseFloat(form.purchaseCost) : undefined,
        purchaseContract: form.purchaseContract || undefined,
        vendorName: form.vendorName || undefined,
        vendorAddress: form.vendorAddress || undefined,
        insurancePolicyNumber: form.insurancePolicyNumber || undefined,
        insuranceCompany: form.insuranceCompany || undefined,
        insuranceType: form.insuranceType || undefined,
        insuranceStartDate: form.insuranceStartDate || undefined,
        grossWeight: form.grossWeight ? parseFloat(form.grossWeight) : undefined,
        payloadCapacity: form.payloadCapacity ? parseFloat(form.payloadCapacity) : undefined,
        numberOfAxles: form.numberOfAxles ? parseInt(form.numberOfAxles) : undefined,
        tareWeight: form.tareWeight ? parseFloat(form.tareWeight) : undefined,
        bodyType: form.bodyType || undefined,
        hitchType: form.hitchType || undefined,
        lengthM: form.lengthM ? parseFloat(form.lengthM) : undefined,
        widthM: form.widthM ? parseFloat(form.widthM) : undefined,
        heightM: form.heightM ? parseFloat(form.heightM) : undefined,
        euroEmissionClass: form.euroEmissionClass || undefined,
        tachographSerial: form.tachographSerial || undefined,
        tachographCalibrationExpiry: form.tachographCalibrationExpiry || undefined,
        trailerLength: form.trailerLength ? parseFloat(form.trailerLength) : undefined,
        seatingCapacity: form.seatingCapacity ? parseInt(form.seatingCapacity) : undefined,
        loadVolume: form.loadVolume ? parseFloat(form.loadVolume) : undefined,
        partitionFitted: form.partitionFitted ?? undefined,
        vinSubType: form.vinSubType || undefined,
        insuranceGroup: form.insuranceGroup || undefined,
        tankMaterial: form.tankMaterial || undefined,
        adrClass: form.adrClass || undefined,
        unNumbers: form.unNumbers || undefined,
        lastPressureTestDate: form.lastPressureTestDate || undefined,
        nextPressureTestDate: form.nextPressureTestDate || undefined,
        tankerCapacity: form.tankerCapacity ? parseFloat(form.tankerCapacity) : undefined,
        refrigerationUnit: form.refrigerationUnit || undefined,
        refrigerationModel: form.refrigerationModel || undefined,
        tempMin: form.tempMin ? parseFloat(form.tempMin) : undefined,
        tempMax: form.tempMax ? parseFloat(form.tempMax) : undefined,
        atpCertificateNumber: form.atpCertificateNumber || undefined,
        atpCertificateExpiry: form.atpCertificateExpiry || undefined,
        equipmentDescription: form.equipmentDescription || undefined,
      };

      if (isEdit) {
        await vehiclesApi.update(id!, payload);
        toast.success('Vehicle updated');
      } else {
        const created = await vehiclesApi.create(payload);
        toast.success('Vehicle created');
        navigate(`/dashboard/vehicles/${created.id}`);
        return;
      }
      navigate(`/dashboard/vehicles/${id}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vehicle Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Vehicle Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Registration Number *</Label>
              <Input value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value.toUpperCase())} placeholder="e.g. AB12 CDE" />
            </div>
            <div className="space-y-1">
              <Label>License Plate</Label>
              <Input value={form.licensePlate} onChange={(e) => set('licensePlate', e.target.value)} placeholder="e.g. AB12CDE" />
            </div>
            <div className="space-y-1">
              <Label>Vehicle Type *</Label>
              <Select value={form.type || 'none'} onValueChange={(v) => set('type', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {lookups?.vehicleTypes?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status || 'ACTIVE'} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lookups?.statuses?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Make *</Label>
              <Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="e.g. Volvo" />
            </div>
            <div className="space-y-1">
              <Label>Model *</Label>
              <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="e.g. FH16" />
            </div>
            <div className="space-y-1">
              <Label>Year</Label>
              <Input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} placeholder="e.g. 2022" min={1950} max={2100} />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="e.g. White" />
            </div>
            <div className="space-y-1">
              <Label>VIN</Label>
              <Input value={form.vin} onChange={(e) => set('vin', e.target.value.toUpperCase())} placeholder="Vehicle Identification Number" />
            </div>
            <div className="space-y-1">
              <Label>Fuel Type</Label>
              <Select value={form.fuelType || 'none'} onValueChange={(v) => set('fuelType', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select fuel type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {lookups?.fuelTypes?.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fuel Capacity (litres)</Label>
              <Input type="number" step="0.1" value={form.fuelCapacity} onChange={(e) => set('fuelCapacity', e.target.value)} placeholder="e.g. 200" />
            </div>
            <div className="space-y-1">
              <Label>Current Mileage (km)</Label>
              <Input type="number" value={form.currentMileage} onChange={(e) => set('currentMileage', e.target.value)} placeholder="0" min={0} />
            </div>
            <div className="col-span-full space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional notes" rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Compliance Dates */}
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance & Registration Dates</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>MOT Expiry</Label>
              <Input type="date" value={form.motExpiryDate} onChange={(e) => set('motExpiryDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tax Expiry</Label>
              <Input type="date" value={form.taxExpiryDate} onChange={(e) => set('taxExpiryDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Registration Expiry</Label>
              <Input type="date" value={form.registrationExpiryDate} onChange={(e) => set('registrationExpiryDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Insurance Expiry</Label>
              <Input type="date" value={form.insuranceExpiryDate} onChange={(e) => set('insuranceExpiryDate', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Purchase Information */}
        <Card>
          <CardHeader><CardTitle className="text-base">Purchase Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Purchase Order</Label>
              <Input value={form.purchaseOrder} onChange={(e) => set('purchaseOrder', e.target.value)} placeholder="e.g. PO-2024-001" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Purchase Cost</Label>
              <Input type="number" step="0.01" value={form.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} placeholder="e.g. 50000.00" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Contract</Label>
              <Input value={form.purchaseContract} onChange={(e) => set('purchaseContract', e.target.value)} placeholder="e.g. CON-2024-001" />
            </div>
            <div className="space-y-1">
              <Label>Vendor Name</Label>
              <Input value={form.vendorName} onChange={(e) => set('vendorName', e.target.value)} placeholder="e.g. ABC Vehicle Dealers" />
            </div>
            <div className="col-span-full space-y-1">
              <Label>Vendor Address</Label>
              <Textarea value={form.vendorAddress} onChange={(e) => set('vendorAddress', e.target.value)} placeholder="Full vendor address" rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Insurance Information */}
        <Card>
          <CardHeader><CardTitle className="text-base">Insurance Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Policy Number</Label>
              <Input value={form.insurancePolicyNumber} onChange={(e) => set('insurancePolicyNumber', e.target.value)} placeholder="e.g. POL-2024-001" />
            </div>
            <div className="space-y-1">
              <Label>Insurance Company</Label>
              <Input value={form.insuranceCompany} onChange={(e) => set('insuranceCompany', e.target.value)} placeholder="e.g. ABC Insurance" />
            </div>
            <div className="space-y-1">
              <Label>Insurance Type</Label>
              <Select value={form.insuranceType || 'none'} onValueChange={(v) => set('insuranceType', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select insurance type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {lookups?.insuranceTypes?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Insurance Start Date</Label>
              <Input type="date" value={form.insuranceStartDate} onChange={(e) => set('insuranceStartDate', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Truck & Trailer Specifications */}
        {(isTruckLike(form.type) || isRefrigeratedLike(form.type)) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Truck & Trailer Specifications</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Gross Weight (tonnes)</Label>
                <Input type="number" step="0.1" value={form.grossWeight} onChange={(e) => set('grossWeight', e.target.value)} placeholder="e.g. 44" />
              </div>
              <div className="space-y-1">
                <Label>Payload Capacity (tonnes)</Label>
                <Input type="number" step="0.1" value={form.payloadCapacity} onChange={(e) => set('payloadCapacity', e.target.value)} placeholder="e.g. 26" />
              </div>
              <div className="space-y-1">
                <Label>Tare Weight (tonnes)</Label>
                <Input type="number" step="0.1" value={form.tareWeight} onChange={(e) => set('tareWeight', e.target.value)} placeholder="e.g. 18" />
              </div>
              <div className="space-y-1">
                <Label>Number of Axles</Label>
                <Input type="number" value={form.numberOfAxles} onChange={(e) => set('numberOfAxles', e.target.value)} placeholder="e.g. 5" min={1} max={12} />
              </div>
              <div className="space-y-1">
                <Label>Body Type</Label>
                <Select value={form.bodyType || 'none'} onValueChange={(v) => set('bodyType', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select body type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {lookups?.bodyTypes?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Hitch Type</Label>
                <Select value={form.hitchType || 'none'} onValueChange={(v) => set('hitchType', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select hitch type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {lookups?.hitchTypes?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Length (m)</Label>
                <Input type="number" step="0.1" value={form.lengthM} onChange={(e) => set('lengthM', e.target.value)} placeholder="e.g. 13.6" />
              </div>
              <div className="space-y-1">
                <Label>Width (m)</Label>
                <Input type="number" step="0.1" value={form.widthM} onChange={(e) => set('widthM', e.target.value)} placeholder="e.g. 2.5" />
              </div>
              <div className="space-y-1">
                <Label>Height (m)</Label>
                <Input type="number" step="0.1" value={form.heightM} onChange={(e) => set('heightM', e.target.value)} placeholder="e.g. 2.5" />
              </div>
              <div className="space-y-1">
                <Label>Euro Emission Class</Label>
                <Select value={form.euroEmissionClass || 'none'} onValueChange={(v) => set('euroEmissionClass', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select emission class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {lookups?.euroEmissionClasses?.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tachograph Serial</Label>
                <Input value={form.tachographSerial} onChange={(e) => set('tachographSerial', e.target.value)} placeholder="e.g. VD0123456789" />
              </div>
              <div className="space-y-1">
                <Label>Tachograph Calibration Expiry</Label>
                <Input type="date" value={form.tachographCalibrationExpiry} onChange={(e) => set('tachographCalibrationExpiry', e.target.value)} />
              </div>
              {(/trailer/i.test(form.type) || isRefrigeratedLike(form.type)) && (
                <div className="space-y-1">
                  <Label>Trailer Length (m)</Label>
                  <Input type="number" step="0.1" value={form.trailerLength} onChange={(e) => set('trailerLength', e.target.value)} placeholder="e.g. 13.6" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Van Specifications */}
        {isVanLike(form.type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Van Specifications</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Seating Capacity</Label>
                <Input type="number" value={form.seatingCapacity} onChange={(e) => set('seatingCapacity', e.target.value)} placeholder="e.g. 5" min={1} max={20} />
              </div>
              <div className="space-y-1">
                <Label>Load Volume (m³)</Label>
                <Input type="number" step="0.1" value={form.loadVolume} onChange={(e) => set('loadVolume', e.target.value)} placeholder="e.g. 15.5" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox checked={form.partitionFitted} onCheckedChange={(v) => set('partitionFitted', !!v)} id="partition" />
                <Label htmlFor="partition" className="font-normal cursor-pointer">Partition Fitted</Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Car Specifications */}
        {isCarLike(form.type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Car Specifications</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>VIN Sub-type</Label>
                <Select value={form.vinSubType || 'none'} onValueChange={(v) => set('vinSubType', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select VIN sub-type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {lookups?.vinSubTypes?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Insurance Group</Label>
                <Select value={form.insuranceGroup || 'none'} onValueChange={(v) => set('insuranceGroup', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select insurance group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {lookups?.insuranceGroups?.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tanker Specifications */}
        {isTankerLike(form.type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Tanker Specifications</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tanker Capacity (litres)</Label>
                <Input type="number" value={form.tankerCapacity} onChange={(e) => set('tankerCapacity', e.target.value)} placeholder="e.g. 30000" />
              </div>
              <div className="space-y-1">
                <Label>Tank Material</Label>
                <Select value={form.tankMaterial || 'none'} onValueChange={(v) => set('tankMaterial', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select tank material" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {lookups?.tankMaterials?.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>ADR Class</Label>
                <Select value={form.adrClass || 'none'} onValueChange={(v) => set('adrClass', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select ADR class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {lookups?.adrClasses?.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>UN Numbers</Label>
                <Input value={form.unNumbers} onChange={(e) => set('unNumbers', e.target.value)} placeholder="e.g. 1223, 1250" />
              </div>
              <div className="space-y-1">
                <Label>Last Pressure Test Date</Label>
                <Input type="date" value={form.lastPressureTestDate} onChange={(e) => set('lastPressureTestDate', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Next Pressure Test Date</Label>
                <Input type="date" value={form.nextPressureTestDate} onChange={(e) => set('nextPressureTestDate', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refrigerated Trailer Specifications */}
        {isRefrigeratedLike(form.type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Refrigerated Trailer Specifications</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Refrigeration Unit</Label>
                <Input value={form.refrigerationUnit} onChange={(e) => set('refrigerationUnit', e.target.value)} placeholder="e.g. Thermo King" />
              </div>
              <div className="space-y-1">
                <Label>Refrigeration Model</Label>
                <Input value={form.refrigerationModel} onChange={(e) => set('refrigerationModel', e.target.value)} placeholder="e.g. T-1200R" />
              </div>
              <div className="space-y-1">
                <Label>Min Temperature (°C)</Label>
                <Input type="number" step="0.1" value={form.tempMin} onChange={(e) => set('tempMin', e.target.value)} placeholder="e.g. -25" />
              </div>
              <div className="space-y-1">
                <Label>Max Temperature (°C)</Label>
                <Input type="number" step="0.1" value={form.tempMax} onChange={(e) => set('tempMax', e.target.value)} placeholder="e.g. 10" />
              </div>
              <div className="space-y-1">
                <Label>ATP Certificate Number</Label>
                <Input value={form.atpCertificateNumber} onChange={(e) => set('atpCertificateNumber', e.target.value)} placeholder="e.g. ATP-2024-001" />
              </div>
              <div className="space-y-1">
                <Label>ATP Certificate Expiry</Label>
                <Input type="date" value={form.atpCertificateExpiry} onChange={(e) => set('atpCertificateExpiry', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Specialty Equipment */}
        {isSpecialtyLike(form.type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Specialty Equipment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Equipment Description</Label>
                <Textarea value={form.equipmentDescription} onChange={(e) => set('equipmentDescription', e.target.value)} placeholder="Describe any special equipment or modifications" rows={4} />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Vehicle'}
          </Button>
        </div>
      </form>
    </div>
  );
}
