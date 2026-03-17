import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

export function AddDriver() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Employee added successfully');
    navigate('/dashboard/employees');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/employees">
            <ArrowLeft className="w-5 h-5" />
          </Link>
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
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" placeholder="Enter first name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" placeholder="Enter last name" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" placeholder="driver@email.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" type="tel" placeholder="+48 123 456 789" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input id="dateOfBirth" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Select required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="poland">Poland</SelectItem>
                        <SelectItem value="ukraine">Ukraine</SelectItem>
                        <SelectItem value="romania">Romania</SelectItem>
                        <SelectItem value="moldova">Moldova</SelectItem>
                        <SelectItem value="belarus">Belarus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Address Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address *</Label>
                  <Input id="address" placeholder="Enter street address" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" placeholder="Enter city" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input id="country" placeholder="Enter country" required />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jobType">Job Type *</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="truck_driver">Truck Driver</SelectItem>
                      <SelectItem value="delivery_driver">Delivery Driver</SelectItem>
                      <SelectItem value="warehouse_worker">Warehouse Worker</SelectItem>
                      <SelectItem value="forklift_operator">Forklift Operator</SelectItem>
                      <SelectItem value="logistics_coordinator">Logistics Coordinator</SelectItem>
                      <SelectItem value="construction_worker">Construction Worker</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="general_worker">General Worker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number (if applicable)</Label>
                    <Input id="licenseNumber" placeholder="e.g., PL-12345-CE" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearsExperience">Years of Experience *</Label>
                    <Input id="yearsExperience" type="number" min="0" placeholder="5" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agency">Recruitment Agency (Optional)</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agency or leave blank for direct hire" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A001">Euro Transport Recruitment</SelectItem>
                      <SelectItem value="A002">Global Driver Solutions</SelectItem>
                      <SelectItem value="A003">Baltic Logistics Partners</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="status">Initial Status *</Label>
                  <Select defaultValue="pending">
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentStage">Workflow Stage *</Label>
                  <Select defaultValue="application">
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="application">Application</SelectItem>
                      <SelectItem value="document_verification">Document Verification</SelectItem>
                      <SelectItem value="work_permit">Work Permit</SelectItem>
                      <SelectItem value="visa_application">Visa Application</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#EFF6FF] border-[#2563EB]">
              <CardHeader>
                <CardTitle className="text-sm">Next Steps</CardTitle>
              </CardHeader>
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
              <Button type="submit" className="w-full">
                Add Employee
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