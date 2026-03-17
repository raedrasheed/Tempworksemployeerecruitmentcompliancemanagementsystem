import { useState } from 'react';
import { Search, Filter, AlertTriangle, CheckCircle, Clock, FileText, Download, Upload, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { mockDrivers, mockDocuments } from '../../data/mockData';

export function DocumentsCompliance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState('all');

  // Calculate compliance statistics
  const totalDocuments = mockDocuments.length;
  const validDocs = mockDocuments.filter(d => d.status === 'valid').length;
  const expiringDocs = mockDocuments.filter(d => d.status === 'expiring_soon').length;
  const expiredDocs = mockDocuments.filter(d => d.status === 'expired').length;
  const pendingDocs = mockDocuments.filter(d => d.status === 'pending_verification').length;

  // Filter documents
  const filteredDocuments = mockDocuments.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.driverName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    
    let matchesCompliance = true;
    if (complianceFilter === 'compliant') {
      matchesCompliance = doc.status === 'valid';
    } else if (complianceFilter === 'at_risk') {
      matchesCompliance = doc.status === 'expiring_soon';
    } else if (complianceFilter === 'non_compliant') {
      matchesCompliance = doc.status === 'expired';
    }
    
    return matchesSearch && matchesStatus && matchesCompliance;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge className="bg-[#22C55E]">Valid</Badge>;
      case 'expiring_soon':
        return <Badge className="bg-[#F59E0B]">Expiring Soon</Badge>;
      case 'expired':
        return <Badge className="bg-[#EF4444]">Expired</Badge>;
      case 'pending_verification':
        return <Badge className="bg-[#64748B]">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Documents & Compliance</h1>
          <p className="text-muted-foreground mt-1">Monitor driver documents and compliance status</p>
        </div>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Compliance Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{validDocs}</p>
                <p className="text-sm text-muted-foreground">Valid Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                <Clock className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{expiringDocs}</p>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[#EF4444]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{expiredDocs}</p>
                <p className="text-sm text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#64748B]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{pendingDocs}</p>
                <p className="text-sm text-muted-foreground">Pending Verification</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Alerts */}
      {(expiringDocs > 0 || expiredDocs > 0) && (
        <Card className="border-[#F59E0B] bg-[#FEF3C7]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-[#F59E0B]">Compliance Alerts</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {expiredDocs} document(s) have expired and {expiringDocs} document(s) are expiring soon. Immediate action required.
                </p>
              </div>
              <Button size="sm" variant="outline">
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by document or driver name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Document Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="pending_verification">Pending Verification</SelectItem>
              </SelectContent>
            </Select>

            <Select value={complianceFilter} onValueChange={setComplianceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Compliance Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Compliance</SelectItem>
                <SelectItem value="compliant">Compliant</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="non_compliant">Non-Compliant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table with Compliance Info */}
      <Card>
        <CardHeader>
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-sm">Driver</th>
                  <th className="text-left p-4 font-semibold text-sm">Document</th>
                  <th className="text-left p-4 font-semibold text-sm">Type</th>
                  <th className="text-left p-4 font-semibold text-sm">Status</th>
                  <th className="text-left p-4 font-semibold text-sm">Expiry Date</th>
                  <th className="text-left p-4 font-semibold text-sm">Compliance</th>
                  <th className="text-left p-4 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => {
                  const daysUntilExpiry = doc.expiryDate 
                    ? Math.ceil((new Date(doc.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  
                  const complianceStatus = 
                    doc.status === 'valid' ? 'Compliant' :
                    doc.status === 'expiring_soon' ? 'At Risk' :
                    doc.status === 'expired' ? 'Non-Compliant' :
                    'Pending';

                  return (
                    <tr key={doc.id} className="border-b hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4">
                        <p className="font-medium">{doc.driverName}</p>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{doc.fileName}</p>
                          <p className="text-sm text-muted-foreground">{doc.fileSize}</p>
                        </div>
                      </td>
                      <td className="p-4">{doc.type}</td>
                      <td className="p-4">{getStatusBadge(doc.status)}</td>
                      <td className="p-4">
                        <div>
                          <p>{doc.expiryDate || 'N/A'}</p>
                          {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {daysUntilExpiry} days remaining
                            </p>
                          )}
                          {daysUntilExpiry !== null && daysUntilExpiry < 0 && (
                            <p className="text-xs text-[#EF4444]">
                              Expired {Math.abs(daysUntilExpiry)} days ago
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge 
                          variant="outline"
                          className={
                            complianceStatus === 'Compliant' ? 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]' :
                            complianceStatus === 'At Risk' ? 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]' :
                            complianceStatus === 'Non-Compliant' ? 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]' :
                            'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                          }
                        >
                          {complianceStatus}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {doc.status === 'expired' || doc.status === 'expiring_soon' ? (
                            <Button size="sm" variant="outline">
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Renew
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
