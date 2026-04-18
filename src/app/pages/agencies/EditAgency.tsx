import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ShieldOff, Upload, X, FileText, Download } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
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
import { confirm } from '../../components/ui/ConfirmDialog';
import { agenciesApi, documentsApi, BACKEND_URL, settingsApi, getCurrentUser } from '../../services/api';

function looksLikeWebsite(v: string): boolean {
  if (!v) return true;
  const s = v.trim();
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
  isSystem: boolean;
};

export function EditAgency() {
  const { canEdit } = usePermissions();
  const { id } = useParams();
  const navigate = useNavigate();
  const isSystemAdmin = getCurrentUser()?.role === 'System Admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormShape>({
    name: '', country: '', contactFirstName: '', contactMiddleName: '', contactLastName: '',
    email: '', phone: '', whatsapp: '', status: 'ACTIVE', website: '',
    addressLine1: '', addressLine2: '', city: '', stateRegion: '', postalCode: '',
    notes: '', isSystem: false,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Attached documents (contract, etc.) via the shared /documents flow.
  const [documents, setDocuments] = useState<any[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocTypeId, setNewDocTypeId] = useState<string>('');
  const [newDocName, setNewDocName] = useState<string>('');

  const loadDocs = useCallback(() => {
    if (!id) return;
    documentsApi.list({ entityType: 'AGENCY', entityId: id, limit: 100 })
      .then((res: any) => setDocuments(res?.data ?? []))
      .catch(() => setDocuments([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    agenciesApi.get(id)
      .then((agency: any) => {
        // Fallback to splitting legacy contactPerson into first/last pieces.
        let first = agency.contactFirstName ?? '';
        let middle = agency.contactMiddleName ?? '';
        let last  = agency.contactLastName ?? '';
        if (!first && !last && agency.contactPerson) {
          const parts = String(agency.contactPerson).trim().split(/\s+/);
          if (parts.length === 1) { first = parts[0]; }
          else if (parts.length === 2) { first = parts[0]; last = parts[1]; }
          else { first = parts[0]; last = parts[parts.length - 1]; middle = parts.slice(1, -1).join(' '); }
        }
        setForm({
          name: agency.name ?? '',
          country: agency.country ?? '',
          contactFirstName: first,
          contactMiddleName: middle,
          contactLastName: last,
          email: agency.email ?? '',
          phone: agency.phone ?? '',
          whatsapp: agency.whatsapp ?? '',
          status: agency.status ?? 'ACTIVE',
          website: agency.website ?? '',
          addressLine1: agency.addressLine1 ?? '',
          addressLine2: agency.addressLine2 ?? '',
          city: agency.city ?? '',
          stateRegion: agency.stateRegion ?? '',
          postalCode: agency.postalCode ?? '',
          notes: agency.notes ?? '',
          isSystem: Boolean(agency.isSystem),
        });
        setLogoUrl(agency.logoUrl ?? null);
      })
      .catch(() => toast.error('Failed to load agency'))
      .finally(() => setLoading(false));

    loadDocs();
    settingsApi.getDocumentTypes().then((res: any) => {
      setDocTypes(Array.isArray(res) ? res : (res?.data ?? []));
    }).catch(() => setDocTypes([]));
  }, [id, loadDocs]);

  if (!canEdit('agencies')) {
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !id) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Logo must be 5MB or smaller'); return; }
    if (!/^image\/(jpe?g|png|webp|svg\+xml)$/i.test(f.type)) {
      toast.error('Logo must be JPEG, PNG, WebP or SVG'); return;
    }
    setUploadingLogo(true);
    try {
      const updated = await agenciesApi.uploadLogo(id, f);
      setLogoUrl(updated.logoUrl ?? null);
      toast.success('Logo updated');
    } catch (err: any) {
      toast.error(err?.message || 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
      // Allow selecting the same file again later
      (e.target as HTMLInputElement).value = '';
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !id) return;
    if (!newDocTypeId) { toast.error('Choose a document type first'); (e.target as HTMLInputElement).value = ''; return; }
    const fd = new FormData();
    fd.append('file', f);
    fd.append('entityType', 'AGENCY');
    fd.append('entityId', id);
    fd.append('documentTypeId', newDocTypeId);
    fd.append('name', newDocName.trim() || f.name);
    setUploadingDoc(true);
    try {
      await documentsApi.upload(fd);
      toast.success('Document uploaded');
      setNewDocName('');
      setNewDocTypeId('');
      loadDocs();
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploadingDoc(false);
      (e.target as HTMLInputElement).value = '';
    }
  };

  const handleDocDelete = async (doc: any) => {
    if (!(await confirm({
      title: 'Remove document?',
      description: `"${doc.name}" will be removed from this agency.`,
      confirmText: 'Remove', tone: 'destructive',
    }))) return;
    try {
      await documentsApi.delete(doc.id);
      toast.success('Document removed');
      loadDocs();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove document');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // isSystem is a System-Admin-only switch. The backend strips it
      // from non-admin payloads defensively, but drop it from the wire
      // payload here too so nothing drifts in the audit log.
      if (!isSystemAdmin) delete payload.isSystem;
      await agenciesApi.update(id!, payload);
      toast.success('Agency updated successfully');
      navigate(`/dashboard/agencies/${id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update agency');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  const logoSrc = logoUrl
    ? (logoUrl.startsWith('http') ? logoUrl : `${BACKEND_URL}${logoUrl}`)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/agencies/${id}`}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit Agency</h1>
          <p className="text-muted-foreground mt-1">Update agency information</p>
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
                  <Input id="name" value={form.name} onChange={e => setField('name', e.target.value)} required />
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
                  {logoSrc
                    ? <img src={logoSrc} alt="Agency logo" className="w-full h-full object-contain" />
                    : <Upload className="w-6 h-6 text-muted-foreground" />}
                </div>
                <Button type="button" variant="outline" size="sm" asChild disabled={uploadingLogo}>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      className="sr-only"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                    {uploadingLogo ? 'Uploading...' : logoSrc ? 'Replace logo' : 'Upload logo'}
                  </label>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                PNG, JPEG, WebP or SVG · up to 5MB.
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
                  <Input id="email" type="email" value={form.email} onChange={e => setField('email', e.target.value)} required />
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

          {/* Tenancy — System Admin only. Flipping this on marks the
              agency as the Tempworks root; its users then see global
              data instead of being scoped to the agency. */}
          {isSystemAdmin && (
            <Card>
              <CardHeader><CardTitle>Tenancy Scope</CardTitle></CardHeader>
              <CardContent>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="isSystem"
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    checked={form.isSystem}
                    onChange={e => setField('isSystem', e.target.checked)}
                  />
                  <div className="space-y-1">
                    <div className="font-medium text-[#0F172A]">Treat as Tempworks system agency (global scope)</div>
                    <p className="text-sm text-muted-foreground">
                      Users attached to this agency bypass tenancy scoping and see data across every tenant. Enable only for the Tempworks root / owner agency; leave off for every real tenant.
                    </p>
                  </div>
                </label>
              </CardContent>
            </Card>
          )}

          {/* Attached documents */}
          <Card>
            <CardHeader><CardTitle>Attached Documents</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {documents.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents attached to this agency yet.</p>
              )}
              {documents.length > 0 && (
                <div className="divide-y rounded-md border">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.documentType?.name ?? '—'}
                          {doc.expiryDate ? ` · expires ${new Date(doc.expiryDate).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      {doc.fileUrl && (
                        <Button type="button" variant="ghost" size="sm" asChild>
                          <a href={doc.fileUrl.startsWith('http') ? doc.fileUrl : `${BACKEND_URL}${doc.fileUrl}`} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleDocDelete(doc)} className="text-red-600 hover:text-red-700">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={newDocTypeId} onValueChange={setNewDocTypeId}>
                    <SelectTrigger><SelectValue placeholder="e.g. Agency contract" /></SelectTrigger>
                    <SelectContent>
                      {docTypes.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Document Name</Label>
                  <Input value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="Optional — defaults to file name" />
                </div>
                <Button type="button" variant="outline" size="sm" asChild disabled={uploadingDoc || !newDocTypeId}>
                  <label className="cursor-pointer">
                    <input type="file" className="sr-only" onChange={handleDocUpload} disabled={uploadingDoc || !newDocTypeId} />
                    <Upload className="w-4 h-4 mr-1.5" />
                    {uploadingDoc ? 'Uploading...' : 'Upload'}
                  </label>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Files are stored through the shared Documents module, linked to this agency (entityType=AGENCY).
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to={`/dashboard/agencies/${id}`}>Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
