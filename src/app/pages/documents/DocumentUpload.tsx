import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Upload, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { mockDrivers } from '../../data/mockData';
import { toast } from 'sonner';

export function DocumentUpload() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Document uploaded successfully');
    navigate('/dashboard/documents');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/documents">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Upload Document</h1>
          <p className="text-muted-foreground mt-1">Upload new driver document for verification</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver">Select Driver *</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockDrivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.firstName} {driver.lastName} ({driver.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Document Type *</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="license">Driving License</SelectItem>
                    <SelectItem value="medical">Medical Certificate</SelectItem>
                    <SelectItem value="work_permit">Work Permit</SelectItem>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="residence">Residence Permit</SelectItem>
                    <SelectItem value="tachograph">Tachograph Card</SelectItem>
                    <SelectItem value="contract">Employment Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input id="expiryDate" type="date" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Upload File *</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-[#2563EB] transition-colors">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPG, PNG up to 10MB
                  </p>
                  <Input id="file" type="file" className="mt-4" accept=".pdf,.jpg,.jpeg,.png" required />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard/documents">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}