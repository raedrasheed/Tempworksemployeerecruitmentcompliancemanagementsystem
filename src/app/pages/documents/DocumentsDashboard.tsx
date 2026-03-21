import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Upload, FileCheck, AlertTriangle, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Progress } from '../../components/ui/progress';
import { toast } from 'sonner';
import { documentsApi } from '../../services/api';

export function DocumentsDashboard() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    documentsApi.list({ limit: 200 })
      .then((res: any) => setDocuments(res?.data ?? []))
      .catch(() => toast.error('Failed to load documents'))
      .finally(() => setLoading(false));
  }, []);

  const validDocs = documents.filter(d => d.status === 'VERIFIED').length;
  const expiringDocs = documents.filter(d => d.status === 'EXPIRING_SOON').length;
  const pendingDocs = documents.filter(d => d.status === 'PENDING').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]';
      case 'EXPIRING_SOON': return 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]';
      case 'EXPIRED': return 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]';
      case 'PENDING': return 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]';
      default: return 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]';
    }
  };

  const getCategoryCount = (typeName: string) =>
    documents.filter(d => d.documentType?.name === typeName).length;

  const categories = [...new Set(documents.map(d => d.documentType?.name).filter(Boolean))].slice(0, 4);

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

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
            <div className="text-2xl font-semibold text-[#0F172A]">{documents.length}</div>
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

      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Document Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categories.map((category) => {
                const count = getCategoryCount(category);
                const pct = documents.length > 0 ? Math.round((count / documents.length) * 100) : 0;
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{category}</span>
                      <span className="font-medium">{count} document{count !== 1 ? 's' : ''}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                      No documents found. <Link to="/dashboard/documents/upload" className="text-[#2563EB] hover:underline">Upload one</Link>.
                    </TableCell>
                  </TableRow>
                ) : documents.slice(0, 20).map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>{doc.documentType?.name ?? '-'}</TableCell>
                    <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(doc.status)}>
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/dashboard/documents/${doc.id}`}>
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
