import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ShieldOff, Camera, User, X } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { employeesApi, agenciesApi, settingsApi } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

export function EditEmployee() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [jobTypes, setJobTypes] = useState<any[]>([]);

  // Photo state
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    nationality: '', dateOfBirth: '',
    agencyId: '', jobTypeId: '',
    addressLine1: '', addressLine2: '', city: '', country: '', postalCode: '',
    licenseNumber: '', licenseCategory: '', yearsExperience: '',
    emergencyContact: '', emergencyPhone: '', notes: '',
    status: 'PENDING',
  });

  useEffect(() => {
    Promise.all([
      employeesApi.get(id!),
      agenciesApi.list({ limit: 200 }),
      settingsApi.getJobTypes().catch(() => []),
    ]).then(([emp, agencyResult, jt]) => {
      setAgencies((agencyResult as any)?.data ?? []);
      setJobTypes(Array.isArray(jt) ? jt.filter((j: any) => j.isActive !== false) : []);
      setCurrentPhotoUrl(emp.photoUrl ?? null);
      setForm({
        firstName: emp.firstName ?? '',
        lastName: emp.lastName ?? '',
        email: emp.email ?? '',
        phone: emp.phone ?? '',
        nationality: emp.nationality ?? '',
        dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : '',
        agencyId:  emp.agencyId  ?? '',
        jobTypeId: emp.jobTypeId ?? '',
        addressLine1: emp.addressLine1 ?? '',
        addressLine2: emp.addressLine2 ?? '',
        city: emp.city ?? '',
        country: emp.country ?? '',
        postalCode: emp.postalCode ?? '',
        licenseNumber: emp.licenseNumber ?? '',
        licenseCategory: emp.licenseCategory ?? '',
        yearsExperience: String(emp.yearsExperience ?? ''),
        emergencyContact: emp.emergencyContact ?? '',
        emergencyPhone: emp.emergencyPhone ?? '',
        notes: emp.notes ?? '',
        status: emp.status ?? 'PENDING',
      });
    }).catch(() => toast.error('Failed to load employee'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Photo handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoClear = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        nationality: form.nationality,
        dateOfBirth: form.dateOfBirth,
        addressLine1: form.addressLine1,
        city: form.city,
        country: form.country,
        postalCode: form.postalCode,
        status: form.status,
        agencyId:  form.agencyId  || undefined,
        jobTypeId: form.jobTypeId || undefined,
        licenseNumber: form.licenseNumber || undefined,
        licenseCategory: form.licenseCategory || undefined,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience, 10) : undefined,
        emergencyContact: form.emergencyContact || undefined,
        emergencyPhone: form.emergencyPhone || undefined,
        notes: form.notes || undefined,
        addressLine2: form.addressLine2 || undefined,
      };
      await employeesApi.update(id!, payload);

      // Upload photo if a new one was selected
      if (photoFile) {
        setUploadingPhoto(true);
        try {
          const updated = await employeesApi.uploadPhoto(id!, photoFile);
          setCurrentPhotoUrl(updated.photoUrl ?? null);
        } catch (photoErr: any) {
          toast.error(`Profile saved but photo upload failed: ${photoErr?.message ?? 'Unknown error'}`);
          setSubmitting(false);
          setUploadingPhoto(false);
          return;
        } finally {
          setUploadingPhoto(false);
        }
      }

      toast.success('Employee updated successfully');
      navigate(`/dashboard/employees/${id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  if (!canEdit('employees')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ShieldOff className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold text-[#0F172A]">Access Denied</p>
        <p className="text-sm">You don't have permission to perform this action.</p>
      </div>
    );
  }

  const displayPhoto = photoPreview ?? resolvePhotoUrl(currentPhotoUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/employees/${id}`}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit Employee</h1>
          <p className="text-muted-foreground mt-1">Update employee information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            <Card>
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" value={form.firstName} onChange={set('firstName')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" value={form.lastName} onChange={set('lastName')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" value={form.email} onChange={set('email')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" type="tel" value={form.phone} onChange={set('phone')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Input id="nationality" value={form.nationality} onChange={set('nationality')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input id="emergencyContact" value={form.emergencyContact} onChange={set('emergencyContact')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Emergency Phone</Label>
                    <Input id="emergencyPhone" type="tel" value={form.emergencyPhone} onChange={set('emergencyPhone')} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Address Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Street Address *</Label>
                  <Input id="addressLine1" value={form.addressLine1} onChange={set('addressLine1')} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input id="addressLine2" value={form.addressLine2} onChange={set('addressLine2')} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" value={form.city} onChange={set('city')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code *</Label>
                    <Input id="postalCode" value={form.postalCode} onChange={set('postalCode')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input id="country" value={form.country} onChange={set('country')} required />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Professional Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agencyId">Recruitment Agency</Label>
                    <Select value={form.agencyId || '__none__'} onValueChange={val => setForm(prev => ({ ...prev, agencyId: val === '__none__' ? '' : val }))}>
                      <SelectTrigger id="agencyId"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Direct hire (no agency)</SelectItem>
                        {agencies.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTypeId">Job Type</Label>
                    <Select value={form.jobTypeId || '__none__'} onValueChange={val => setForm(prev => ({ ...prev, jobTypeId: val === '__none__' ? '' : val }))}>
                      <SelectTrigger id="jobTypeId"><SelectValue placeholder="Select job type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not specified</SelectItem>
                        {jobTypes.map((jt: any) => (
                          <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input id="licenseNumber" value={form.licenseNumber} onChange={set('licenseNumber')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licenseCategory">License Category</Label>
                    <Input id="licenseCategory" placeholder="e.g. CE, C, B" value={form.licenseCategory} onChange={set('licenseCategory')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">Years of Experience</Label>
                  <Input id="yearsExperience" type="number" min="0" value={form.yearsExperience} onChange={set('yearsExperience')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" value={form.notes} onChange={set('notes')} />
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="space-y-6">

            {/* Photo Upload Card */}
            <Card>
              <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Avatar preview */}
                <div className="flex justify-center">
                  <div className="relative">
                    {displayPhoto ? (
                      <img
                        src={displayPhoto}
                        alt="Employee photo"
                        className="w-28 h-28 rounded-full object-cover border-2 border-border"
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                        <User className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    {/* Camera overlay button */}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
                      title="Change photo"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pending new photo indicator */}
                {photoPreview && (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm text-blue-800">
                    <span>New photo selected</span>
                    <button type="button" onClick={handlePhotoClear} className="text-blue-600 hover:text-blue-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {currentPhotoUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  JPEG, PNG or WebP · max 5 MB
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={form.status} onValueChange={val => setForm(prev => ({ ...prev, status: val }))}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting || uploadingPhoto}>
                {submitting || uploadingPhoto ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to={`/dashboard/employees/${id}`}>Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
