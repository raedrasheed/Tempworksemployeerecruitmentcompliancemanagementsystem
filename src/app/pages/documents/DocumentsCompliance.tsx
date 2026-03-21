import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Search, AlertTriangle, CheckCircle, Clock, FileText,
  Download, Upload, RefreshCw, Edit, Trash2, CheckCircle2, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { documentsApi, employeesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
const getFileUrl = (fileUrl: string) => `${API_BASE}${fileUrl}`;

const documentColumns: Column[] = [
  { id: 'name', label: 'Document Name', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'EXPIRING_SOON'] },
  { id: 'expiryDate', label: 'Expiry Date', type: 'date' },
];

export function DocumentsCompliance() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete, can } = usePermissions();
  const [documents, setDocuments] = useState<any[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    { id: '1', name: 'Expired Documents', rules: [{ id: '1', columnId: 'status', operator: 'equals', value: 'EXPIRED' }], logic: 'AND' },
    { id: '2', name: 'Expiring Soon', rules: [{ id: '1', columnId: 'status', operator: 'equals', value: 'EXPIRING_SOON' }], logic: 'AND' },
  ]);

  // Inline verify state
  const [verifying, setVerifying] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean; docId: string; docName: string;
  }>({ open: false, docId: '', docName: '' });
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const loadDocuments = documentsApi.list({ limit: 200 })
      .then((res: any) => setDocuments((res as any)?.data ?? []))
      .catch(() => toast.error('Failed to load documents'));

    const loadEmployees = employeesApi.list({ limit: 500 })
      .then((res: any) => {
        const emps: any[] = (res as any)?.data ?? [];
        const map: Record<string, string> = {};
        emps.forEach(e => { map[e.id] = `${e.firstName} ${e.lastName}`; });
        setEmployeeMap(map);
      })
      .catch(() => {/* employee names are optional, fail silently */});

    Promise.all([loadDocuments, loadEmployees]).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (doc: any) => {
    if (!confirm(`Delete document "${doc.name}"? This cannot be undone.`)) return;
    try {
      await documentsApi.delete(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Document deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete document');
    }
  };

  const handleApprove = async (doc: any) => {
    setVerifying(doc.id);
    try {
      const updated = await documentsApi.verify(doc.id, { action: 'VERIFY' });
      setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d));
      toast.success(`"${doc.name}" approved`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve document');
    } finally {
      setVerifying(null);
    }
  };

  const openRejectDialog = (doc: any) => {
    setRejectDialog({ open: true, docId: doc.id, docName: doc.name });
    setRejectionReason('');
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('A rejection reason is required'); return; }
    setVerifying(rejectDialog.docId);
    try {
      const updated = await documentsApi.verify(rejectDialog.docId, {
        action: 'REJECT',
        reason: rejectionReason.trim(),
      });
      setDocuments(prev => prev.map(d => d.id === rejectDialog.docId ? updated : d));
      toast.success(`"${rejectDialog.docName}" rejected`);
      setRejectDialog({ open: false, docId: '', docName: '' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject document');
    } finally {
      setVerifying(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':   return <Badge className="bg-[#22C55E]">Valid</Badge>;
      case 'EXPIRING_SOON': return <Badge className="bg-[#F59E0B]">Expiring Soon</Badge>;
      case 'EXPIRED':    return <Badge className="bg-[#EF4444]">Expired</Badge>;
      case 'REJECTED':   return <Badge className="bg-[#EF4444]">Rejected</Badge>;
      case 'PENDING':    return <Badge className="bg-[#64748B]">Pending</Badge>;
      default:           return <Badge variant="outline">{status}</Badge>;
    }
  };

  const applyFilters = (doc: any) => {
    if (activeFilters.length === 0) return true;
    const results = activeFilters.map(filter => {
      const value = (doc as any)[filter.columnId] ?? '';
      switch (filter.operator) {
        case 'contains':   return String(value).toLowerCase().includes(filter.value.toLowerCase());
        case 'equals':     return String(value).toLowerCase() === filter.value.toLowerCase();
        case 'startsWith': return String(value).toLowerCase().startsWith(filter.value.toLowerCase());
        case 'endsWith':   return String(value).toLowerCase().endsWith(filter.value.toLowerCase());
        case 'before':     return value && new Date(value) < new Date(filter.value);
        case 'after':      return value && new Date(value) > new Date(filter.value);
        default:           return true;
      }
    });
    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const filteredDocuments = documents.filter(doc => {
    const entityName = employeeMap[doc.entityId] ?? '';
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entityName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    let matchesCompliance = true;
    if (complianceFilter === 'compliant') matchesCompliance = doc.status === 'VERIFIED';
    else if (complianceFilter === 'at_risk') matchesCompliance = doc.status === 'EXPIRING_SOON';
    else if (complianceFilter === 'non_compliant') matchesCompliance = doc.status === 'EXPIRED' || doc.status === 'REJECTED';
    return matchesSearch && matchesStatus && matchesCompliance && applyFilters(doc);
  });

  const validDocs     = documents.filter(d => d.status === 'VERIFIED').length;
  const expiringDocs  = documents.filter(d => d.status === 'EXPIRING_SOON').length;
  const expiredDocs   = documents.filter(d => d.status === 'EXPIRED').length;
  const pendingDocs   = documents.filter(d => d.status === 'PENDING').length;

  const getComplianceLabel = (status: string) => {
    if (status === 'VERIFIED') return 'Compliant';
    if (status === 'EXPIRING_SOON') return 'At Risk';
    if (status === 'EXPIRED' || status === 'REJECTED') return 'Non-Compliant';
    return 'Pending';
  };

  const getComplianceBadgeClass = (status: string) => {
    if (status === 'VERIFIED') return 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]';
    if (status === 'EXPIRING_SOON') return 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]';
    if (status === 'EXPIRED' || status === 'REJECTED') return 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]';
    return 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]';
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Documents & Compliance</h1>
          <p className="text-muted-foreground mt-1">Monitor driver documents and compliance status</p>
        </div>
        {canCreate('documents') && (
          <Button asChild>
            <Link to="/dashboard/documents/upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#22C55E]" />
            </div>
            <div><p className="text-2xl font-semibold">{validDocs}</p><p className="text-sm text-muted-foreground">Valid Documents</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
              <Clock className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <div><p className="text-2xl font-semibold">{expiringDocs}</p><p className="text-sm text-muted-foreground">Expiring Soon</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#EF4444]" />
            </div>
            <div><p className="text-2xl font-semibold">{expiredDocs}</p><p className="text-sm text-muted-foreground">Expired</p></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#64748B]" />
            </div>
            <div><p className="text-2xl font-semibold">{pendingDocs}</p><p className="text-sm text-muted-foreground">Pending Verification</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Compliance Alert */}
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
              <Button size="sm" variant="outline" onClick={() => setStatusFilter('EXPIRING_SOON')}>
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle>Filter Documents</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
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
                <SelectTrigger><SelectValue placeholder="Document Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="VERIFIED">Valid</SelectItem>
                  <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="PENDING">Pending Verification</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                <SelectTrigger><SelectValue placeholder="Compliance Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Compliance</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FilterSystem
              columns={documentColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={(name, rules, logic) => setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, rules, logic }])}
              onLoadPreset={preset => { setActiveFilters(preset.rules); setFilterLogic(preset.logic); }}
              onDeletePreset={id => setSavedPresets(prev => prev.filter(p => p.id !== id))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rejection Reason Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={open => !open && setRejectDialog(s => ({ ...s, open: false }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting:{' '}
              <span className="font-medium text-[#0F172A]">{rejectDialog.docName}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="reject-reason-compliance">
                Rejection Reason <span className="text-[#EF4444]">*</span>
              </Label>
              <Textarea
                id="reject-reason-compliance"
                placeholder="Explain why this document is being rejected…"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(s => ({ ...s, open: false }))}>
              Cancel
            </Button>
            <Button
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
              onClick={handleReject}
              disabled={!!verifying || !rejectionReason.trim()}
            >
              <XCircle className="w-4 h-4 mr-2" />
              {verifying ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documents Table */}
      <Card>
        <CardHeader><CardTitle>Documents ({filteredDocuments.length})</CardTitle></CardHeader>
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
                {filteredDocuments.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No documents found</td></tr>
                ) : filteredDocuments.map((doc) => {
                  const daysUntilExpiry = doc.expiryDate
                    ? Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <tr key={doc.id} className="border-b hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4">
                        <p className="font-medium">{employeeMap[doc.entityId] ?? doc.entityId}</p>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                        </div>
                      </td>
                      <td className="p-4">{doc.documentType?.name ?? '-'}</td>
                      <td className="p-4">{getStatusBadge(doc.status)}</td>
                      <td className="p-4">
                        <div>
                          <p>{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}</p>
                          {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
                            <p className="text-xs text-muted-foreground">{daysUntilExpiry} days remaining</p>
                          )}
                          {daysUntilExpiry !== null && daysUntilExpiry <= 0 && (
                            <p className="text-xs text-[#EF4444]">Expired {Math.abs(daysUntilExpiry)} days ago</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={getComplianceBadgeClass(doc.status)}>
                          {getComplianceLabel(doc.status)}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Inline approve/reject for PENDING documents */}
                          {doc.status === 'PENDING' && can('documents', 'verify') && (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#22C55E] hover:bg-[#16A34A] text-white"
                                onClick={() => handleApprove(doc)}
                                disabled={verifying === doc.id}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {verifying === doc.id ? '…' : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[#EF4444] border-[#EF4444] hover:bg-[#FEF2F2]"
                                onClick={() => openRejectDialog(doc)}
                                disabled={verifying === doc.id}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {(doc.status === 'EXPIRED' || doc.status === 'EXPIRING_SOON') && canCreate('documents') && (
                            <Button size="sm" variant="outline" asChild>
                              <Link to="/dashboard/documents/upload">
                                <RefreshCw className="w-4 h-4 mr-1" />Renew
                              </Link>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" asChild>
                            <a href={getFileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                          {canEdit('documents') && (
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/dashboard/documents/${doc.id}/edit`}>
                                <Edit className="w-4 h-4" />
                              </Link>
                            </Button>
                          )}
                          {canDelete('documents') && (
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => handleDelete(doc)}
                              className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
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
