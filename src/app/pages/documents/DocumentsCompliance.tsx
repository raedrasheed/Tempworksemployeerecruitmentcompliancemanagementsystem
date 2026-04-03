import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Search, AlertTriangle, CheckCircle, Clock, FileText,
  Download, Upload, RefreshCw, Edit, Trash2, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, ArrowUpDown, Filter, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { documentsApi, settingsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
const getFileUrl = (fileUrl: string) => `${API_BASE}${fileUrl}`;

const STATUS_OPTIONS = [
  { value: 'PENDING',       label: 'Pending Verification' },
  { value: 'VERIFIED',      label: 'Valid / Verified' },
  { value: 'REJECTED',      label: 'Rejected' },
  { value: 'EXPIRED',       label: 'Expired' },
  { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
];

const SORT_OPTIONS = [
  { value: 'createdAt',     label: 'Upload Date' },
  { value: 'name',          label: 'Document Name' },
  { value: 'status',        label: 'Status' },
  { value: 'issueDate',     label: 'Issue Date' },
  { value: 'expiryDate',    label: 'Expiry Date' },
  { value: 'documentNumber',label: 'Doc Number' },
  { value: 'docId',         label: 'Business ID' },
  { value: 'verifiedAt',    label: 'Verified At' },
];

export function DocumentsCompliance() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate, canEdit, canDelete, can } = usePermissions();

  // ── Server-driven state ──────────────────────────────────────────────────
  const [documents,  setDocuments]  = useState<any[]>([]);
  const [meta,       setMeta]       = useState({ total: 0, page: 1, limit: 30, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [docTypes,   setDocTypes]   = useState<{ id: string; name: string; code?: string }[]>([]);

  // ── Filters (all server-side) ─────────────────────────────────────────────
  const [search,         setSearch]         = useState(searchParams.get('search')         ?? '');
  const [statusFilter,   setStatusFilter]   = useState(searchParams.get('status')         ?? '');
  const [typeFilter,     setTypeFilter]     = useState(searchParams.get('documentTypeId') ?? '');
  const [entityTypeF,    setEntityTypeF]    = useState(searchParams.get('entityType')     ?? '');
  const [docIdFilter,    setDocIdFilter]    = useState(searchParams.get('docId')          ?? '');
  const [docNumFilter,   setDocNumFilter]   = useState(searchParams.get('documentNumber') ?? '');
  const [expFrom,        setExpFrom]        = useState(searchParams.get('expiryDateFrom') ?? '');
  const [expTo,          setExpTo]          = useState(searchParams.get('expiryDateTo')   ?? '');
  const [sortBy,         setSortBy]         = useState(searchParams.get('sortBy')         ?? 'createdAt');
  const [sortOrder,      setSortOrder]      = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) ?? 'desc');
  const [page,           setPage]           = useState(1);
  const limit = 30;

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [verifying,       setVerifying]      = useState<string | null>(null);
  const [rejectDialog,    setRejectDialog]   = useState<{ open: boolean; docId: string; docName: string }>({ open: false, docId: '', docName: '' });
  const [rejectionReason, setRejectionReason]= useState('');
  const [renewDialog,     setRenewDialog]    = useState<{ open: boolean; doc: any | null }>({ open: false, doc: null });
  const [renewForm,       setRenewForm]      = useState({ name: '', issueDate: '', expiryDate: '', documentNumber: '', issueCountry: '', issuer: '', notes: '' });
  const [renewing,        setRenewing]       = useState(false);

  // ── Load document types ────────────────────────────────────────────────────
  useEffect(() => {
    settingsApi.getDocumentTypes().then(setDocTypes).catch(() => {});
  }, []);

  // ── Fetch documents (server-driven) ───────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: p, limit, sortBy, sortOrder,
        ...(search       ? { search }                         : {}),
        ...(statusFilter ? { status: statusFilter }           : {}),
        ...(typeFilter   ? { documentTypeId: typeFilter }     : {}),
        ...(entityTypeF  ? { entityType: entityTypeF }        : {}),
        ...(docIdFilter  ? { docId: docIdFilter }             : {}),
        ...(docNumFilter ? { documentNumber: docNumFilter }   : {}),
        ...(expFrom      ? { expiryDateFrom: expFrom }        : {}),
        ...(expTo        ? { expiryDateTo:   expTo }          : {}),
      };
      const res = await documentsApi.list(params) as any;
      setDocuments(res.data ?? []);
      setMeta(res.meta ?? { total: 0, page: p, limit, totalPages: 1 });
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, entityTypeF, docIdFilter, docNumFilter, expFrom, expTo, sortBy, sortOrder]);

  useEffect(() => { setPage(1); load(1); }, [search, statusFilter, typeFilter, entityTypeF, docIdFilter, docNumFilter, expFrom, expTo, sortBy, sortOrder]);

  const handlePage = (p: number) => { setPage(p); load(p); };

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setTypeFilter('');
    setEntityTypeF(''); setDocIdFilter(''); setDocNumFilter('');
    setExpFrom(''); setExpTo('');
  };

  const hasFilters = search || statusFilter || typeFilter || entityTypeF || docIdFilter || docNumFilter || expFrom || expTo;

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleApprove = async (doc: any) => {
    setVerifying(doc.id);
    try {
      const updated = await documentsApi.verify(doc.id, { action: 'VERIFY' });
      setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d));
      toast.success(`"${doc.name}" approved`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve document');
    } finally { setVerifying(null); }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('A rejection reason is required'); return; }
    setVerifying(rejectDialog.docId);
    try {
      const updated = await documentsApi.verify(rejectDialog.docId, { action: 'REJECT', reason: rejectionReason.trim() });
      setDocuments(prev => prev.map(d => d.id === rejectDialog.docId ? updated : d));
      toast.success(`"${rejectDialog.docName}" rejected`);
      setRejectDialog({ open: false, docId: '', docName: '' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject document');
    } finally { setVerifying(null); }
  };

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

  const openRenewDialog = (doc: any) => {
    setRenewForm({ name: `${doc.name} (Renewal)`, issueDate: '', expiryDate: '', documentNumber: doc.documentNumber ?? '', issueCountry: doc.issueCountry ?? '', issuer: doc.issuer ?? '', notes: '' });
    setRenewDialog({ open: true, doc });
  };

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const renewed = await documentsApi.renew(renewDialog.doc.id, {
        name:           renewForm.name || undefined,
        issueDate:      renewForm.issueDate      || undefined,
        expiryDate:     renewForm.expiryDate     || undefined,
        documentNumber: renewForm.documentNumber || undefined,
        issueCountry:   renewForm.issueCountry   || undefined,
        issuer:         renewForm.issuer         || undefined,
        notes:          renewForm.notes          || undefined,
      });
      toast.success(`Renewal created: ${renewed.docId ?? renewed.id}`);
      setRenewDialog({ open: false, doc: null });
      load(page);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create renewal');
    } finally { setRenewing(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      VERIFIED: 'bg-emerald-100 text-emerald-700',
      EXPIRING_SOON: 'bg-amber-100 text-amber-700',
      EXPIRED: 'bg-red-100 text-red-700',
      REJECTED: 'bg-red-100 text-red-700',
      PENDING: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      VERIFIED: 'Valid', EXPIRING_SOON: 'Expiring Soon',
      EXPIRED: 'Expired', REJECTED: 'Rejected', PENDING: 'Pending',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>{labels[status] ?? status}</span>;
  };

  const getComplianceBadge = (status: string) => {
    if (status === 'VERIFIED')      return <span className="px-2 py-0.5 rounded-full text-xs border border-emerald-400 text-emerald-600 bg-emerald-50">Compliant</span>;
    if (status === 'EXPIRING_SOON') return <span className="px-2 py-0.5 rounded-full text-xs border border-amber-400  text-amber-600  bg-amber-50">At Risk</span>;
    if (status === 'PENDING')       return <span className="px-2 py-0.5 rounded-full text-xs border border-gray-300   text-gray-600   bg-gray-50">Pending</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs border border-red-400 text-red-600 bg-red-50">Non-Compliant</span>;
  };

  const SortBtn = ({ field }: { field: string }) => (
    <button onClick={() => toggleSort(field)} className="ml-1 opacity-50 hover:opacity-100">
      <ArrowUpDown className={`w-3 h-3 inline ${sortBy === field ? 'opacity-100 text-primary' : ''}`} />
    </button>
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const validDocs    = documents.filter(d => d.status === 'VERIFIED').length;
  const expiringDocs = documents.filter(d => d.status === 'EXPIRING_SOON').length;
  const expiredDocs  = documents.filter(d => d.status === 'EXPIRED').length;
  const pendingDocs  = documents.filter(d => d.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Documents & Compliance</h1>
          <p className="text-muted-foreground mt-1">Monitor driver documents and compliance status</p>
        </div>
        {canCreate('documents') && (
          <Button asChild>
            <Link to="/dashboard/documents/upload">
              <Upload className="w-4 h-4 mr-2" />Upload Document
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <CheckCircle className="w-6 h-6 text-emerald-500" />, bg: 'bg-emerald-50', count: validDocs,    label: 'Valid Documents',      filter: 'VERIFIED' },
          { icon: <Clock       className="w-6 h-6 text-amber-500"  />, bg: 'bg-amber-50',   count: expiringDocs, label: 'Expiring Soon',         filter: 'EXPIRING_SOON' },
          { icon: <AlertTriangle className="w-6 h-6 text-red-500" />, bg: 'bg-red-50',      count: expiredDocs,  label: 'Expired',               filter: 'EXPIRED' },
          { icon: <FileText    className="w-6 h-6 text-gray-500"  />, bg: 'bg-gray-50',     count: pendingDocs,  label: 'Pending Verification',  filter: 'PENDING' },
        ].map(({ icon, bg, count, label, filter }) => (
          <Card key={label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(f => f === filter ? '' : filter)}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
                <div><p className="text-2xl font-semibold">{count}</p><p className="text-xs text-muted-foreground leading-tight">{label}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance alert banner */}
      {(expiringDocs > 0 || expiredDocs > 0) && (
        <Card className="border-amber-400 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-700">Compliance Alerts</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {expiredDocs} expired · {expiringDocs} expiring soon. Immediate action required.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setStatusFilter('EXPIRING_SOON')}>View</Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Filter className="w-4 h-4" /> Filter Documents</CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="w-3 h-3 mr-1" /> Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Row 1: search + status + type */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, doc number, business ID, issuer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter || '__all__'} onValueChange={v => setTypeFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Types</SelectItem>
                {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityTypeF || '__all__'} onValueChange={v => setEntityTypeF(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Entities</SelectItem>
                <SelectItem value="APPLICANT">Applicants</SelectItem>
                <SelectItem value="EMPLOYEE">Employees</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Row 2: docId + docNumber + expiry range */}
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Business ID (e.g. DOCC2026…)"
              value={docIdFilter}
              onChange={e => setDocIdFilter(e.target.value)}
              className="w-52"
            />
            <Input
              placeholder="Physical doc number"
              value={docNumFilter}
              onChange={e => setDocNumFilter(e.target.value)}
              className="w-44"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Expiry from</span>
              <Input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={expTo} onChange={e => setExpTo(e.target.value)} className="w-36" />
            </div>
            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={open => !open && setRejectDialog(s => ({ ...s, open: false }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Rejecting: <span className="font-medium text-foreground">{rejectDialog.docName}</span></p>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Rejection Reason <span className="text-destructive">*</span></Label>
              <Textarea id="reject-reason" placeholder="Explain why this document is being rejected…" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(s => ({ ...s, open: false }))}>Cancel</Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={handleReject} disabled={!!verifying || !rejectionReason.trim()}>
              <XCircle className="w-4 h-4 mr-2" />{verifying ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew dialog */}
      <Dialog open={renewDialog.open} onOpenChange={open => !open && setRenewDialog(s => ({ ...s, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Renew Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Creates a new PENDING document linked to <span className="font-medium text-foreground">{renewDialog.doc?.docId ?? renewDialog.doc?.name}</span>.
            The original document record is preserved.
          </p>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={renewForm.name} onChange={e => setRenewForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Issue Date</Label><Input type="date" value={renewForm.issueDate} onChange={e => setRenewForm(p => ({ ...p, issueDate: e.target.value }))} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={renewForm.expiryDate} onChange={e => setRenewForm(p => ({ ...p, expiryDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Document Number</Label><Input value={renewForm.documentNumber} onChange={e => setRenewForm(p => ({ ...p, documentNumber: e.target.value }))} /></div>
              <div><Label>Issue Country</Label><Input value={renewForm.issueCountry} onChange={e => setRenewForm(p => ({ ...p, issueCountry: e.target.value }))} /></div>
            </div>
            <div><Label>Issuer</Label><Input value={renewForm.issuer} onChange={e => setRenewForm(p => ({ ...p, issuer: e.target.value }))} /></div>
            <div><Label>Notes</Label><Input value={renewForm.notes} onChange={e => setRenewForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialog(s => ({ ...s, open: false }))}>Cancel</Button>
            <Button onClick={handleRenew} disabled={renewing}>
              <RefreshCw className="w-4 h-4 mr-2" />{renewing ? 'Creating…' : 'Create Renewal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documents table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Documents ({meta.total})</CardTitle>
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>Page {meta.page} of {meta.totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => handlePage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" disabled={page >= meta.totalPages} onClick={() => handlePage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">
                    Business ID <SortBtn field="docId" />
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Owner</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Document <SortBtn field="name" />
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">
                    Doc # <SortBtn field="documentNumber" />
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Status <SortBtn field="status" />
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">
                    Expiry <SortBtn field="expiryDate" />
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden xl:table-cell">Verified by</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Compliance</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No documents found</td></tr>
                ) : documents.map(doc => {
                  const daysLeft = doc.expiryDate
                    ? Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000)
                    : null;
                  const verifierName = doc.verifiedBy
                    ? `${doc.verifiedBy.firstName} ${doc.verifiedBy.lastName}`
                    : null;
                  return (
                    <tr key={doc.id} className="border-b hover:bg-muted/20 transition-colors">
                      {/* Business ID */}
                      <td className="p-3 whitespace-nowrap">
                        {doc.docId
                          ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{doc.docId}</code>
                          : <span className="text-xs text-muted-foreground italic">—</span>}
                        {doc.renewedFrom && (
                          <div className="text-xs text-blue-500 mt-0.5">↩ renewal</div>
                        )}
                      </td>
                      {/* Owner */}
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            className="text-left text-sm font-medium hover:text-primary truncate max-w-[140px]"
                            onClick={() => setEntityTypeF(doc.entityType)}
                          >
                            {doc.entityId.slice(0, 8)}…
                          </button>
                          <span className={`text-xs px-1.5 py-0.5 rounded w-fit font-medium ${doc.entityType === 'APPLICANT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {doc.entityType === 'APPLICANT' ? 'Applicant' : 'Employee'}
                          </span>
                        </div>
                      </td>
                      {/* Document name */}
                      <td className="p-3">
                        <p className="font-medium truncate max-w-[180px]">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                      </td>
                      {/* Type */}
                      <td className="p-3 hidden md:table-cell text-muted-foreground">{doc.documentType?.name ?? '—'}</td>
                      {/* Physical doc number */}
                      <td className="p-3 hidden lg:table-cell text-muted-foreground font-mono text-xs">
                        {doc.documentNumber ?? '—'}
                      </td>
                      {/* Status + rejection reason */}
                      <td className="p-3">
                        {getStatusBadge(doc.status)}
                        {doc.rejectionReason && (
                          <p className="text-xs text-red-500 mt-0.5 max-w-[150px] truncate" title={doc.rejectionReason}>
                            ✕ {doc.rejectionReason}
                          </p>
                        )}
                      </td>
                      {/* Expiry */}
                      <td className="p-3 hidden lg:table-cell">
                        {doc.expiryDate
                          ? <>
                              <p className="text-sm">{new Date(doc.expiryDate).toLocaleDateString()}</p>
                              {daysLeft !== null && daysLeft > 0  && <p className="text-xs text-muted-foreground">{daysLeft}d left</p>}
                              {daysLeft !== null && daysLeft <= 0 && <p className="text-xs text-red-500">{Math.abs(daysLeft)}d ago</p>}
                            </>
                          : <span className="text-muted-foreground text-xs">N/A</span>}
                      </td>
                      {/* Verified by */}
                      <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground">
                        {verifierName && (
                          <>
                            <p>{verifierName}</p>
                            {doc.verifiedAt && <p>{new Date(doc.verifiedAt).toLocaleDateString()}</p>}
                          </>
                        )}
                      </td>
                      {/* Compliance */}
                      <td className="p-3">{getComplianceBadge(doc.status)}</td>
                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {doc.status === 'PENDING' && can('documents', 'verify') && (
                            <>
                              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-7 px-2" onClick={() => handleApprove(doc)} disabled={verifying === doc.id}>
                                <CheckCircle2 className="w-3 h-3 mr-1" />{verifying === doc.id ? '…' : 'Approve'}
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-500 border-red-300 hover:bg-red-50 h-7 px-2" onClick={() => { setRejectDialog({ open: true, docId: doc.id, docName: doc.name }); setRejectionReason(''); }} disabled={verifying === doc.id}>
                                <XCircle className="w-3 h-3 mr-1" />Reject
                              </Button>
                            </>
                          )}
                          {(doc.status === 'EXPIRED' || doc.status === 'EXPIRING_SOON' || doc.status === 'VERIFIED') && canCreate('documents') && (
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openRenewDialog(doc)}>
                              <RefreshCw className="w-3 h-3 mr-1" />Renew
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                            <a href={getFileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                          {canEdit('documents') && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                              <Link to={`/dashboard/documents/${doc.id}/edit`}><Edit className="w-3.5 h-3.5" /></Link>
                            </Button>
                          )}
                          {canDelete('documents') && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(doc)}>
                              <Trash2 className="w-3.5 h-3.5" />
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
          {/* Pagination footer */}
          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-muted-foreground">
              <span>{meta.total} documents · Page {meta.page} of {meta.totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePage(page - 1)}><ChevronLeft className="w-4 h-4" /> Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => handlePage(page + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
