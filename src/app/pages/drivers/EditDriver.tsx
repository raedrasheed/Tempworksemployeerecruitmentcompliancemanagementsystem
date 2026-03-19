import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { mockDrivers } from '../../data/mockData';

export function EditDriver() {
  const { id } = useParams();
  const navigate = useNavigate();
  const driver = mockDrivers.find(d => d.id === id);

  if (!driver) {
    return <div>Driver not found</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Driver updated successfully');
    navigate(`/dashboard/drivers/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/drivers/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit Driver</h1>
          <p className="text-muted-foreground mt-1">Update driver information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" defaultValue={driver.firstName} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" defaultValue={driver.lastName} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" defaultValue={driver.email} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" type="tel" defaultValue={driver.phone} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input id="dateOfBirth" type="date" defaultValue={driver.dateOfBirth} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Input id="nationality" defaultValue={driver.nationality} required />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number *</Label>
                    <Input id="licenseNumber" defaultValue={driver.licenseNumber} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearsExperience">Years of Experience *</Label>
                    <Input id="yearsExperience" type="number" defaultValue={driver.yearsExperience} required />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status & Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select defaultValue={driver.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentStage">Workflow Stage *</Label>
                  <Select defaultValue={driver.currentStage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="application">Application</SelectItem>
                      <SelectItem value="document_verification">Document Verification</SelectItem>
                      <SelectItem value="work_permit">Work Permit</SelectItem>
                      <SelectItem value="visa_application">Visa Application</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" className="w-full">
                Save Changes
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to={`/dashboard/drivers/${id}`}>Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}