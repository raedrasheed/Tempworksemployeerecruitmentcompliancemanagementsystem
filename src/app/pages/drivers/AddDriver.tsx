import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { employeesApi, agenciesApi } from '../../services/api';

export function AddDriver() {
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    nationality: '', dateOfBirth: '',
    agencyId: '',
    addressLine1: '', city: '', country: '', postalCode: '',
    licenseNumber: '', licenseCategory: '', yearsExperience: '',
    emergencyContact: '', emergencyPhone: '', notes: '',
    status: 'PENDING',
  });

  useEffect(() => {
    agenciesApi.list({ limit: 200 })
      .then((res: any) => setAgencies(res?.data ?? []))
      .catch(() => {});
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

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
      };
      if (form.agencyId) payload.agencyId = form.agencyId;
      if (form.licenseNumber) payload.licenseNumber = form.licenseNumber;
      if (form.licenseCategory) payload.licenseCategory = form.licenseCategory;
      if (form.yearsExperience) payload.yearsExperience = parseInt(form.yearsExperience, 10);
      if (form.emergencyContact) payload.emergencyContact = form.emergencyContact;
      if (form.emergencyPhone) payload.emergencyPhone = form.emergencyPhone;
      if (form.notes) payload.notes = form.notes;

      const created = await employeesApi.create(payload);
      toast.success('Employee added successfully');
      navigate(`/dashboard/employees/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/employees"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Add New Employee</h1>
          <p className="text-muted-foreground mt-1">Enter employee information to create a new profile</p>
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
                    <Input id="firstName" placeholder="First name" value={form.firstName} onChange={set('firstName')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" placeholder="Last name" value={form.lastName} onChange={set('lastName')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" placeholder="employee@email.com" value={form.email} onChange={set('email')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" type="tel" placeholder="+48 123 456 789" value={form.phone} onChange={set('phone')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Input id="nationality" placeholder="e.g. Poland" value={form.nationality} onChange={set('nationality')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input id="emergencyContact" placeholder="Contact name" value={form.emergencyContact} onChange={set('emergencyContact')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Emergency Phone</Label>
                    <Input id="emergencyPhone" type="tel" placeholder="+48 000 000 000" value={form.emergencyPhone} onChange={set('emergencyPhone')} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Address Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Street Address *</Label>
                  <Input id="addressLine1" placeholder="Street address" value={form.addressLine1} onChange={set('addressLine1')} required />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" placeholder="City" value={form.city} onChange={set('city')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code *</Label>
                    <Input id="postalCode" placeholder="00-000" value={form.postalCode} onChange={set('postalCode')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input id="country" placeholder="Country" value={form.country} onChange={set('country')} required />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Professional Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agencyId">Recruitment Agency</Label>
                  <Select value={form.agencyId} onValueChange={val => setForm(prev => ({ ...prev, agencyId: val === '__none__' ? '' : val }))}>
                    <SelectTrigger id="agencyId">
                      <SelectValue placeholder="Select agency or leave blank for direct hire" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Direct hire (no agency)</SelectItem>
                      {agencies.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input id="licenseNumber" placeholder="e.g. PL-12345-CE" value={form.licenseNumber} onChange={set('licenseNumber')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licenseCategory">License Category</Label>
                    <Input id="licenseCategory" placeholder="e.g. CE, C, B" value={form.licenseCategory} onChange={set('licenseCategory')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">Years of Experience</Label>
                  <Input id="yearsExperience" type="number" min="0" placeholder="0" value={form.yearsExperience} onChange={set('yearsExperience')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" placeholder="Optional notes" value={form.notes} onChange={set('notes')} />
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Status & Classification</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Initial Status *</Label>
                  <Select value={form.status} onValueChange={val => setForm(prev => ({ ...prev, status: val }))}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#EFF6FF] border-[#2563EB]">
              <CardHeader><CardTitle className="text-sm">Next Steps</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Upload required documents</li>
                  <li>• Verify employee credentials</li>
                  <li>• Assign to workflow stage</li>
                  <li>• Begin compliance tracking</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Employee'}
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to="/dashboard/employees">Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
