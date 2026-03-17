import { Link } from 'react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const documentTypes = [
  { id: 1, name: 'Passport', required: true, expiryTracking: true },
  { id: 2, name: 'Driving License', required: true, expiryTracking: true },
  { id: 3, name: 'Medical Certificate', required: true, expiryTracking: true },
  { id: 4, name: 'Work Permit', required: true, expiryTracking: true },
  { id: 5, name: 'Visa', required: true, expiryTracking: true },
  { id: 6, name: 'Residence Permit', required: true, expiryTracking: true },
  { id: 7, name: 'Tachograph Card', required: true, expiryTracking: true },
  { id: 8, name: 'Employment Contract', required: true, expiryTracking: false },
];

export function DocumentTypes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/settings"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Document Types</h1>
          <p className="text-muted-foreground mt-1">Manage document types and requirements</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Document Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Type Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documentTypes.map((docType) => (
              <div key={docType.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{docType.name}</p>
                  <p className="text-sm text-muted-foreground">Document ID: {docType.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {docType.required && <Badge variant="outline">Required</Badge>}
                  {docType.expiryTracking && <Badge variant="outline" className="bg-[#EFF6FF]">Expiry Tracking</Badge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}