import { Link } from 'react-router';
import { ArrowLeft, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const documentTypes = [
  { id: 'DT001', name: 'Passport', category: 'Identity', required: true, expiryTracking: true, uploads: 156 },
  { id: 'DT002', name: 'Driving License', category: 'License', required: true, expiryTracking: true, uploads: 148 },
  { id: 'DT003', name: 'Medical Certificate', category: 'Medical', required: true, expiryTracking: true, uploads: 142 },
  { id: 'DT004', name: 'Work Permit', category: 'Legal', required: true, expiryTracking: true, uploads: 135 },
  { id: 'DT005', name: 'Visa', category: 'Legal', required: true, expiryTracking: true, uploads: 129 },
  { id: 'DT006', name: 'Residence Permit', category: 'Legal', required: true, expiryTracking: true, uploads: 124 },
  { id: 'DT007', name: 'Tachograph Card', category: 'License', required: true, expiryTracking: true, uploads: 87 },
  { id: 'DT008', name: 'Employment Contract', category: 'Employment', required: true, expiryTracking: false, uploads: 156 },
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
        <Button asChild>
          <Link to="/dashboard/settings/document-types/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Document Type
          </Link>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{documentTypes.length}</div>
            <p className="text-sm text-muted-foreground">Total Document Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{documentTypes.filter(d => d.required).length}</div>
            <p className="text-sm text-muted-foreground">Required Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{documentTypes.filter(d => d.expiryTracking).length}</div>
            <p className="text-sm text-muted-foreground">With Expiry Tracking</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">
              {documentTypes.reduce((sum, d) => sum + d.uploads, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Type Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Document Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Uploads
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {documentTypes.map((docType) => (
                  <tr key={docType.id} className="border-b hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-[#0F172A]">{docType.name}</p>
                        <p className="text-sm text-muted-foreground">{docType.id}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{docType.category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2">
                        {docType.required && (
                          <Badge variant="outline">Required</Badge>
                        )}
                        {docType.expiryTracking && (
                          <Badge variant="outline" className="bg-[#EFF6FF]">
                            Expiry Tracking
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium">{docType.uploads}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/settings/document-types/${docType.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/settings/document-types/${docType.id}/edit`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
