import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ShieldOff, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { CountrySelect } from '../../components/ui/CountrySelect';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { toast } from 'sonner';
import { agenciesApi } from '../../services/api';

// Lightweight website validator — mirrors the backend's IsUrl(require_protocol: false)
// which tolerates "www.example.com" as well as "https://example.com".
function looksLikeWebsite(v: string): boolean {
  if (!v) return true;
  const s = v.trim();
  // Accept bare domain (no protocol) OR http(s)://host
  return /^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(s);
}

type FormShape = {
  name: string;
  country: string;
  contactFirstName: string;
  contactMiddleName: string;
  contactLastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  status: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  notes: string;
};

const EMPTY: FormShape = {
  name: '', country: '', contactFirstName: '', contactMiddleName: '', contactLastName: '',
  email: '', phone: '', whatsapp: '', status: 'ACTIVE',
  website: '', addressLine1: '', addressLine2: '', city: '', stateRegion: '', postalCode: '',
  notes: '',
};

export function AddAgency() {
  const { canCreate } = usePermissions();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormShape>(EMPTY);

  // Logo is picked up front but only sent *after* the agency record is
  // created — the backend needs an ID to attach the file to. We store
  // the File and a data-URL preview.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  if (!canCreate('agencies')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ShieldOff className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold text-[#0F172A]">Access Denied</p>
        <p className="text-sm">You don't have permission to perform this action.</p>
      </div>
    );
  }

  const setField = <K extends keyof FormShape>(key: K, value: FormShape[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Logo must be 5MB or smaller');
      return;
    }
    if (!/^image\/(jpe?g|png|webp|svg\+xml)$/i.test(f.type)) {
      toast.error('Logo must be JPEG, PNG, WebP or SVG');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(f);
    setLogoFile(f);
  };

  const clearLogo = () => { setLogoFile(null); setLogoPreview(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Minimal required-field + URL validation mirrors the backend DTO.
    if (!form.name.trim())          return toast.error('Agency name is required');
    if (!form.country)              return toast.error('Country is required');
    if (!form.contactFirstName.trim() || !form.contactLastName.trim())
      return toast.error('Contact person first and last name are required');
    if (!form.email.trim())         return toast.error('Email is required');
    if (!form.phone.trim())         return toast.error('Phone is required');
    if (form.website && !looksLikeWebsite(form.website))
      return toast.error('Website must be a valid URL');

    setSubmitting(true);
    try {
      const payload: any = {
        ...form,
        contactPerson: [form.contactFirstName, form.contactMiddleName, form.contactLastName]
          .map(s => s.trim()).filter(Boolean).join(' '),
      };
      const created = await agenciesApi.create(payload);
      if (logoFile && created?.id) {
        try { await agenciesApi.uploadLogo(created.id, logoFile); }
        catch (err: any) { toast.warning(`Agency created but logo upload failed: ${err?.message || 'unknown error'}`); }
      }
      toast.success('Agency added successfully');
      navigate(created?.id ? `/dashboard/agencies/${created.id}` : '/dashboard/agencies');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add agency');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/agencies"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Add New Agency</h1>
          <p className="text-muted-foreground mt-1">Create new recruitment agency partnership</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-3xl space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader><CardTitle>Agency Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Agency Name *</Label>
                  <Input id="name" placeholder="Enter agency name" value={form.name} onChange={e => setField('name', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <CountrySelect value={form.country} onChange={v => setField('country', v)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={form.status} onValueChange={v => setField('status', v)}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website Address</Label>
                <Input id="website" placeholder="https://agency.example.com" value={form.website} onChange={e => setField('website', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                    : <Upload className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="sr-only" onChange={handleLogoPick} />
                      {logoPreview ? 'Replace logo' : 'Select logo'}
                    </label>
                  </Button>
                  {logoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearLogo}>
                      <X className="w-4 h-4 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                PNG, JPEG, WebP or SVG · up to 5MB. The logo is uploaded after the agency is created.
              </p>
            </CardContent>
          </Card>

          {/* Contact person */}
          <Card>
            <CardHeader><CardTitle>Contact Person</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactFirstName">First Name *</Label>
                  <Input id="contactFirstName" value={form.contactFirstName} onChange={e => setField('contactFirstName', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactMiddleName">Middle Name</Label>
                  <Input id="contactMiddleName" value={form.contactMiddleName} onChange={e => setField('contactMiddleName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactLastName">Last Name *</Label>
                  <Input id="contactLastName" value={form.contactLastName} onChange={e => setField('contactLastName', e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" placeholder="contact@agency.com" value={form.email} onChange={e => setField('email', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <PhoneInput id="phone" value={form.phone} onChange={v => setField('phone', v)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <PhoneInput id="whatsapp" value={form.whatsapp} onChange={v => setField('whatsapp', v)} placeholder="optional" />
              </div>
            </CardContent>
          </Card>

          {/* HQ address */}
          <Card>
            <CardHeader><CardTitle>Headquarters Address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input id="addressLine1" value={form.addressLine1} onChange={e => setField('addressLine1', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" value={form.addressLine2} onChange={e => setField('addressLine2', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={e => setField('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stateRegion">State / Region</Label>
                  <Input id="stateRegion" value={form.stateRegion} onChange={e => setField('stateRegion', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" value={form.postalCode} onChange={e => setField('postalCode', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The country set above applies to this address.
              </p>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                id="notes"
                rows={5}
                placeholder="Internal notes, agreement context, escalation contacts, etc."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Attached Documents</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Agreement, contract, and other agency files can be uploaded after the agency is created — the
                document requires an agency reference to attach to.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Agency'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard/agencies">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
