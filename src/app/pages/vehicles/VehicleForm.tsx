import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { vehiclesApi } from '../../services/api';

const VEHICLE_TYPES = [
  { value: 'TRUCK', label: 'Truck' },
  { value: 'CAR', label: 'Car' },
  { value: 'VAN', label: 'Van' },
  { value: 'TANKER', label: 'Tanker' },
  { value: 'TRAILER', label: 'Trailer' },
  { value: 'REFRIGERATED_TRAILER', label: 'Refrigerated Trailer' },
  { value: 'SPECIALTY', label: 'Specialty' },
];
const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'IN_MAINTENANCE', 'SCRAPPED'];
const FUEL_TYPES = ['DIESEL', 'PETROL', 'ELECTRIC', 'HYBRID', 'GAS', 'OTHER'];

type FormData = {
  registrationNumber: string;
  type: string;
  make: string;
  model: string;
  status: string;
  year: string;
  color: string;
  vin: string;
  fuelType: string;
  currentMileage: string;
  motExpiryDate: string;
  taxExpiryDate: string;
  insuranceExpiryDate: string;
  notes: string;
  // Type-specific
  grossWeight: string;
  payloadCapacity: string;
  numberOfAxles: string;
  tankerCapacity: string;
  refrigerationUnit: string;
  trailerLength: string;
};

const EMPTY: FormData = {
  registrationNumber: '', type: '', make: '', model: '', status: 'ACTIVE',
  year: '', color: '', vin: '', fuelType: '', currentMileage: '',
  motExpiryDate: '', taxExpiryDate: '', insuranceExpiryDate: '', notes: '',
  grossWeight: '', payloadCapacity: '', numberOfAxles: '', tankerCapacity: '',
  refrigerationUnit: '', trailerLength: '',
};

function typeSpecificFields(type: string) {
  return ['TRUCK', 'TANKER', 'TRAILER', 'REFRIGERATED_TRAILER'].includes(type);
}

export function VehicleForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    vehiclesApi.getOne(id!).then((v) => {
      setForm({
        registrationNumber: v.registrationNumber ?? '',
        type: v.type ?? '',
        make: v.make ?? '',
        model: v.model ?? '',
        status: v.status ?? 'ACTIVE',
        year: v.year ? String(v.year) : '',
        color: v.color ?? '',
        vin: v.vin ?? '',
        fuelType: v.fuelType ?? '',
        currentMileage: v.currentMileage ? String(v.currentMileage) : '',
        motExpiryDate: v.motExpiryDate ? v.motExpiryDate.split('T')[0] : '',
        taxExpiryDate: v.taxExpiryDate ? v.taxExpiryDate.split('T')[0] : '',
        insuranceExpiryDate: v.insuranceExpiryDate ? v.insuranceExpiryDate.split('T')[0] : '',
        notes: v.notes ?? '',
        grossWeight: v.grossWeight ? String(v.grossWeight) : '',
        payloadCapacity: v.payloadCapacity ? String(v.payloadCapacity) : '',
        numberOfAxles: v.numberOfAxles ? String(v.numberOfAxles) : '',
        tankerCapacity: v.tankerCapacity ? String(v.tankerCapacity) : '',
        refrigerationUnit: v.refrigerationUnit ?? '',
        trailerLength: v.trailerLength ? String(v.trailerLength) : '',
      });
    }).catch(() => toast.error('Failed to load vehicle')).finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key: keyof FormData, value: string) => setForm((f) => ({ ...f, [key]: value }));

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
        type:   form.type,
        make:   form.make.trim(),
        model:  form.model.trim(),
        status: form.status || undefined,
        year:   form.year ? parseInt(form.year) : undefined,
        color:  form.color || undefined,
        vin:    form.vin || undefined,
        fuelType: form.fuelType || undefined,
        currentMileage: form.currentMileage ? parseInt(form.currentMileage) : undefined,
        motExpiryDate:       form.motExpiryDate || undefined,
        taxExpiryDate:       form.taxExpiryDate || undefined,
        insuranceExpiryDate: form.insuranceExpiryDate || undefined,
        notes: form.notes || undefined,
        grossWeight:     form.grossWeight     ? parseFloat(form.grossWeight)     : undefined,
        payloadCapacity: form.payloadCapacity ? parseFloat(form.payloadCapacity) : undefined,
        numberOfAxles:   form.numberOfAxles   ? parseInt(form.numberOfAxles)     : undefined,
        tankerCapacity:  form.tankerCapacity  ? parseFloat(form.tankerCapacity)  : undefined,
        refrigerationUnit: form.refrigerationUnit || undefined,
        trailerLength:   form.trailerLength   ? parseFloat(form.trailerLength)   : undefined,
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
        {/* Core Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Vehicle Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Registration Number *</Label>
              <Input value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value.toUpperCase())} placeholder="e.g. AB12 CDE" />
            </div>
            <div className="space-y-1">
              <Label>Vehicle Type *</Label>
              <Select value={form.type || 'none'} onValueChange={(v) => set('type', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
              <Label>Status</Label>
              <Select value={form.status || 'ACTIVE'} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
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
                  {FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Current Mileage (km)</Label>
              <Input type="number" value={form.currentMileage} onChange={(e) => set('currentMileage', e.target.value)} placeholder="0" min={0} />
            </div>
            <div className="col-span-full space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional notes" />
            </div>
          </CardContent>
        </Card>

        {/* Compliance Dates */}
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance Dates</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>MOT Expiry</Label>
              <Input type="date" value={form.motExpiryDate} onChange={(e) => set('motExpiryDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tax Expiry</Label>
              <Input type="date" value={form.taxExpiryDate} onChange={(e) => set('taxExpiryDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Insurance Expiry</Label>
              <Input type="date" value={form.insuranceExpiryDate} onChange={(e) => set('insuranceExpiryDate', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Type-specific fields */}
        {typeSpecificFields(form.type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Type-Specific Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['TRUCK', 'TANKER', 'TRAILER', 'REFRIGERATED_TRAILER'].includes(form.type) && (
                <>
                  <div className="space-y-1">
                    <Label>Gross Weight (tonnes)</Label>
                    <Input type="number" step="0.1" value={form.grossWeight} onChange={(e) => set('grossWeight', e.target.value)} placeholder="e.g. 44" />
                  </div>
                  <div className="space-y-1">
                    <Label>Payload Capacity (tonnes)</Label>
                    <Input type="number" step="0.1" value={form.payloadCapacity} onChange={(e) => set('payloadCapacity', e.target.value)} placeholder="e.g. 26" />
                  </div>
                  <div className="space-y-1">
                    <Label>Number of Axles</Label>
                    <Input type="number" value={form.numberOfAxles} onChange={(e) => set('numberOfAxles', e.target.value)} placeholder="e.g. 5" min={1} max={12} />
                  </div>
                </>
              )}
              {['TRAILER', 'REFRIGERATED_TRAILER'].includes(form.type) && (
                <div className="space-y-1">
                  <Label>Trailer Length (m)</Label>
                  <Input type="number" step="0.1" value={form.trailerLength} onChange={(e) => set('trailerLength', e.target.value)} placeholder="e.g. 13.6" />
                </div>
              )}
              {form.type === 'TANKER' && (
                <div className="space-y-1">
                  <Label>Tanker Capacity (litres)</Label>
                  <Input type="number" value={form.tankerCapacity} onChange={(e) => set('tankerCapacity', e.target.value)} placeholder="e.g. 30000" />
                </div>
              )}
              {form.type === 'REFRIGERATED_TRAILER' && (
                <div className="space-y-1">
                  <Label>Refrigeration Unit</Label>
                  <Input value={form.refrigerationUnit} onChange={(e) => set('refrigerationUnit', e.target.value)} placeholder="e.g. Thermo King T-1200R" />
                </div>
              )}
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
