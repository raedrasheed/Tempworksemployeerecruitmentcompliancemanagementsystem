import { Link } from 'react-router';
import { Upload, FileCheck, AlertTriangle, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Progress } from '../../components/ui/progress';
import { mockDocuments } from '../../data/mockData';

export function DocumentsDashboard() {
  const validDocs = mockDocuments.filter(d => d.status === 'valid').length;
  const expiringDocs = mockDocuments.filter(d => d.status === 'expiring_soon').length;
  const pendingDocs = mockDocuments.filter(d => d.status === 'pending_review').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]';
      case 'expiring_soon': return 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]';
      case 'expired': return 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]';
      case 'pending_review': return 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]';
      default: return 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Documents</h1>
          <p className="text-muted-foreground mt-1">Manage driver documents and compliance materials</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/documents/upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Documents</CardTitle>
            <FileCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#0F172A]">{mockDocuments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valid</CardTitle>
            <FileCheck className="w-4 h-4 text-[#22C55E]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#22C55E]">{validDocs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#F59E0B]">{expiringDocs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            <Clock className="w-4 h-4 text-[#2563EB]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#2563EB]">{pendingDocs}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['Passport', 'Driving License', 'Medical Certificate', 'Work Permit'].map((category, index) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{category}</span>
                  <span className="font-medium">{Math.floor(mockDocuments.length / (index + 1))} documents</span>
                </div>
                <Progress value={(100 / (index + 1))} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.type}</TableCell>
                    <TableCell>{doc.driverName}</TableCell>
                    <TableCell>{doc.fileName}</TableCell>
                    <TableCell>{doc.uploadedDate}</TableCell>
                    <TableCell>{doc.expiryDate || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(doc.status)}>
                        {doc.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/documents/${doc.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}