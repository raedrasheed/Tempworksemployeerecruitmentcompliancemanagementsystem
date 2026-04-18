import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Search, AlertTriangle, CheckCircle, Clock, FileText,
  Download, Upload, RefreshCw, Edit, Trash2, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Filter, X, ArrowLeft,
  Columns2, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
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

const COMPLIANCE_OPTIONS = [
  { value: 'COMPLIANT',     label: 'Compliant' },
  { value: 'AT_RISK',       label: 'At Risk' },
  { value: 'NON_COMPLIANT', label: 'Non-Compliant' },
  { value: 'PENDING',       label: 'Pending' },
];

// ── Sorting ─────────────────────────────────────────────────────────────────
type SortField =
  | 'docId' | 'ownerName' | 'name' | 'typeName' | 'status'
  | 'expiryDate' | 'verifiedAt' | 'createdAt'
  | 'documentNumber' | 'issueDate';
type SortOrder = 'asc' | 'desc';

const SERVER_SORT_FIELDS: SortField[] = [
  'docId', 'name', 'status', 'expiryDate', 'verifiedAt',
  'createdAt', 'documentNumber', 'issueDate',
];

// ── Column visibility ───────────────────────────────────────────────────────
type ColKey =
  | 'docId' | 'owner' | 'document' | 'type' | 'status'
  | 'expiry' | 'verifiedBy' | 'compliance'
  | 'createdAt' | 'documentNumber' | 'issueDate' | 'entityType';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'docId',          label: 'Doc ID' },
  { key: 'owner',          label: 'Owner' },
  { key: 'document',       label: 'Document' },
  { key: 'type',           label: 'Type' },
  { key: 'status',         label: 'Status' },
  { key: 'expiry',         label: 'Expiry Date' },
  { key: 'verifiedBy',     label: 'Verified by' },
  { key: 'compliance',     label: 'Compliance' },
  { key: 'createdAt',      label: 'Upload Date' },
  { key: 'documentNumber', label: 'Doc Number' },
  { key: 'issueDate',      label: 'Issue Date' },
  { key: 'entityType',     label: 'Entity Type' },
];

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  docId: true, owner: true, document: true, type: true, status: true,
  expiry: true, verifiedBy: true, compliance: true,
  createdAt: false, documentNumber: false, issueDate: false, entityType: false,
};

const STORAGE_KEY = 'documents-compliance-table-columns';

function loadVisibleColumns(): Record<ColKey, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function DocumentsCompliance() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate, canEdit, canDelete, can } = usePermissions();

  // ── Server-driven state ──────────────────────────────────────────────────
  const [documents,  setDocuments]  = useState<any[]>([]);
  const [meta,       setMeta]       = useState({ total: 0, page: 1, limit: 30, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [docTypes,   setDocTypes]   = useState<{ id: string; name: string; code?: string }[]>([]);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search,           setSearch]           = useState(searchParams.get('search')         ?? '');
  const [statusFilter,     setStatusFilter]     = useState(searchParams.get('status')         ?? '');
  const [typeFilter,       setTypeFilter]       = useState(searchParams.get('documentTypeId') ?? '');
  const [entityTypeF,      setEntityTypeF]      = useState(searchParams.get('entityType')     ?? '');
  const [docIdFilter,      setDocIdFilter]      = useState(searchParams.get('docId')          ?? '');
  const [docNumFilter,     setDocNumFilter]     = useState(searchParams.get('documentNumber') ?? '');
  const [expFrom,          setExpFrom]          = useState(searchParams.get('expiryDateFrom') ?? '');
  const [expTo,            setExpTo]            = useState(searchParams.get('expiryDateTo')   ?? '');
  const [issueFrom,        setIssueFrom]        = useState('');
  const [issueTo,          setIssueTo]          = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');
  const [ownerFilter,      setOwnerFilter]      = useState('');
  const [verifierFilter,   setVerifierFilter]   = useState('');
  const [sortBy,           setSortBy]           = useState<SortField>((searchParams.get('sortBy') as SortField) ?? 'createdAt');
  const [sortOrder,        setSortOrder]        = useState<SortOrder>((searchParams.get('sortOrder') as SortOrder) ?? 'desc');
  const [page,             setPage]             = useState(1);
  const limit = 30;

  // ── Column visibility ─────────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Record<ColKey, boolean>>(loadVisibleColumns);
  const [showColPicker,  setShowColPicker]  = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPicker]);

  const toggleColumn = (key: ColKey) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleColumns[key];
  const hiddenCount  = ALL_COLUMNS.filter(c => !visibleColumns[c.key]).length;
  const visibleCount = ALL_COLUMNS.filter(c =>  visibleColumns[c.key]).length;

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

  // ── Fetch documents ───────────────────────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const useServerSort = SERVER_SORT_FIELDS.includes(sortBy);
      const params: Record<string, any> = {
        page: p, limit,
        ...(useServerSort ? { sortBy, sortOrder } : { sortBy: 'createdAt', sortOrder: 'desc' }),
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

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setTypeFilter('');
    setEntityTypeF(''); setDocIdFilter(''); setDocNumFilter('');
    setExpFrom(''); setExpTo('');
    setIssueFrom(''); setIssueTo('');
    setComplianceFilter(''); setOwnerFilter(''); setVerifierFilter('');
  };

  const hasFilters = !!(search || statusFilter || typeFilter || entityTypeF
    || docIdFilter || docNumFilter || expFrom || expTo
    || issueFrom || issueTo || complianceFilter || ownerFilter || verifierFilter);

  // ── Client-side sort + filter of current page ────────────────────────────
  const complianceOf = (status: string): string => {
    if (status === 'VERIFIED')      return 'COMPLIANT';
    if (status === 'EXPIRING_SOON') return 'AT_RISK';
    if (status === 'PENDING')       return 'PENDING';
    return 'NON_COMPLIANT';
  };

  const displayData = useMemo(() => {
    let data = documents;

    // Client-only filters
    if (complianceFilter) data = data.filter(d => complianceOf(d.status) === complianceFilter);
    if (ownerFilter) {
      const q = ownerFilter.toLowerCase();
      data = data.filter(d => (d.ownerName ?? '').toLowerCase().includes(q)
        || (d.ownerSystemId ?? '').toLowerCase().includes(q));
    }
    if (verifierFilter) {
      const q = verifierFilter.toLowerCase();
      data = data.filter(d => {
        if (!d.verifiedBy) return false;
        const name = `${d.verifiedBy.firstName ?? ''} ${d.verifiedBy.lastName ?? ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    if (issueFrom || issueTo) {
      const from = issueFrom ? new Date(issueFrom).getTime() : -Infinity;
      const to   = issueTo   ? new Date(issueTo + 'T23:59:59').getTime() : Infinity;
      data = data.filter(d => {
        if (!d.issueDate) return false;
        const t = new Date(d.issueDate).getTime();
        return t >= from && t <= to;
      });
    }

    // Client-side sort for derived fields (server handles the rest)
    if (!SERVER_SORT_FIELDS.includes(sortBy)) {
      data = [...data].sort((a, b) => {
        let aVal: any = '', bVal: any = '';
        if (sortBy === 'ownerName') {
          aVal = (a.ownerName ?? '').toLowerCase();
          bVal = (b.ownerName ?? '').toLowerCase();
        } else if (sortBy === 'typeName') {
          aVal = (a.documentType?.name ?? '').toLowerCase();
          bVal = (b.documentType?.name ?? '').toLowerCase();
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return data;
  }, [documents, complianceFilter, ownerFilter, verifierFilter, issueFrom, issueTo, sortBy, sortOrder]);

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
    if (!(await confirm({
      title: 'Delete document?',
      description: `"${doc.name}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
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

  const SortableHead = ({ label, field, className }: { label: string; field: SortField; className?: string }) => {
    const active = sortBy === field;
    return (
      <TableHead className={className}>
        <button
          onClick={() => handleSort(field)}
          className="flex items-center gap-1 hover:text-foreground font-medium group"
        >
          {label}
          {active
            ? sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
            : <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />}
        </button>
      </TableHead>
    );
  };

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
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-semibold text-[#0F172A]">Documents & Compliance</h1>
          </div>
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
          {/* Row 2: docId + docNumber + owner + verifier + compliance */}
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Doc ID (e.g. DOCC2026…)"
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
            <Input
              placeholder="Owner name / ID"
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              className="w-44"
            />
            <Input
              placeholder="Verified by"
              value={verifierFilter}
              onChange={e => setVerifierFilter(e.target.value)}
              className="w-40"
            />
            <Select value={complianceFilter || '__all__'} onValueChange={v => setComplianceFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Compliance" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Compliance</SelectItem>
                {COMPLIANCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Row 3: expiry range + issue range + column picker */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Expiry from</span>
              <Input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)} className="w-36" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={expTo} onChange={e => setExpTo(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Issue from</span>
              <Input type="date" value={issueFrom} onChange={e => setIssueFrom(e.target.value)} className="w-36" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={issueTo} onChange={e => setIssueTo(e.target.value)} className="w-36" />
            </div>

            {/* Column picker */}
            <div className="relative ml-auto" ref={colPickerRef}>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowColPicker(v => !v)}
                className={showColPicker ? 'border-primary text-primary' : ''}
              >
                <Columns2 className="w-4 h-4 mr-1.5" />Columns
                {hiddenCount > 0 && (
                  <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {hiddenCount}
                  </span>
                )}
              </Button>

              {showColPicker && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border rounded-lg shadow-lg p-3 min-w-[200px]">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Toggle columns</p>
                  <div className="space-y-0.5 max-h-72 overflow-y-auto">
                    {ALL_COLUMNS.map(c => (
                      <button
                        key={c.key}
                        onClick={() => toggleColumn(c.key)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 text-sm text-left"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visibleColumns[c.key] ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                          {visibleColumns[c.key] && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t mt-2 pt-2 flex gap-1.5">
                    <button
                      onClick={() => {
                        const all = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColKey, boolean>;
                        setVisibleColumns(all);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
                      }}
                      className="flex-1 text-xs text-center text-primary hover:underline py-0.5"
                    >Show all</button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        setVisibleColumns(DEFAULT_VISIBLE);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VISIBLE));
                      }}
                      className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5"
                    >Reset</button>
                  </div>
                </div>
              )}
            </div>
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
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  {col('docId')          && <SortableHead label="Doc ID"       field="docId" />}
                  {col('owner')          && <SortableHead label="Owner"        field="ownerName" />}
                  {col('document')       && <SortableHead label="Document"     field="name" />}
                  {col('type')           && <SortableHead label="Type"         field="typeName" />}
                  {col('status')         && <SortableHead label="Status"       field="status" />}
                  {col('expiry')         && <SortableHead label="Expiry Date"  field="expiryDate" />}
                  {col('verifiedBy')     && <SortableHead label="Verified by"  field="verifiedAt" />}
                  {col('compliance')     && <SortableHead label="Compliance"   field="status" />}
                  {col('createdAt')      && <SortableHead label="Upload Date"  field="createdAt" />}
                  {col('documentNumber') && <SortableHead label="Doc Number"   field="documentNumber" />}
                  {col('issueDate')      && <SortableHead label="Issue Date"   field="issueDate" />}
                  {col('entityType')     && <SortableHead label="Entity Type"  field="ownerName" />}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={visibleCount + 1} className="p-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : displayData.length === 0 ? (
                  <TableRow><TableCell colSpan={visibleCount + 1} className="p-8 text-center text-muted-foreground">No documents found</TableCell></TableRow>
                ) : displayData.map(doc => {
                  const daysLeft = doc.expiryDate
                    ? Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000)
                    : null;
                  const verifierName = doc.verifiedBy
                    ? `${doc.verifiedBy.firstName} ${doc.verifiedBy.lastName}`
                    : null;
                  return (
                    <TableRow key={doc.id}>
                      {col('docId') && (
                        <TableCell className="whitespace-nowrap">
                          {doc.docId
                            ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{doc.docId}</code>
                            : <span className="text-xs text-muted-foreground italic">—</span>}
                          {doc.renewedFrom && (
                            <div className="text-xs text-blue-500 mt-0.5">↩ renewal</div>
                          )}
                        </TableCell>
                      )}
                      {col('owner') && (
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <button
                              className="text-left text-sm font-medium hover:text-primary truncate max-w-[160px]"
                              onClick={() => setEntityTypeF(doc.entityType)}
                            >
                              {doc.ownerName ?? doc.entityId.slice(0, 8) + '…'}
                            </button>
                            {doc.ownerSystemId && (
                              <span className="text-xs text-muted-foreground font-mono">{doc.ownerSystemId}</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded w-fit font-medium ${doc.entityType === 'APPLICANT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {doc.entityType === 'APPLICANT' ? 'Applicant' : 'Employee'}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      {col('document') && (
                        <TableCell>
                          <p className="font-medium truncate max-w-[180px]">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                        </TableCell>
                      )}
                      {col('type') && (
                        <TableCell className="text-muted-foreground">{doc.documentType?.name ?? '—'}</TableCell>
                      )}
                      {col('status') && (
                        <TableCell>
                          {getStatusBadge(doc.status)}
                          {doc.rejectionReason && (
                            <p className="text-xs text-red-500 mt-0.5 max-w-[150px] truncate" title={doc.rejectionReason}>
                              ✕ {doc.rejectionReason}
                            </p>
                          )}
                        </TableCell>
                      )}
                      {col('expiry') && (
                        <TableCell>
                          {doc.expiryDate
                            ? <>
                                <p className="text-sm">{new Date(doc.expiryDate).toLocaleDateString()}</p>
                                {daysLeft !== null && daysLeft > 0  && <p className="text-xs text-muted-foreground">{daysLeft}d left</p>}
                                {daysLeft !== null && daysLeft <= 0 && <p className="text-xs text-red-500">{Math.abs(daysLeft)}d ago</p>}
                              </>
                            : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                      )}
                      {col('verifiedBy') && (
                        <TableCell className="text-xs text-muted-foreground">
                          {verifierName ? (
                            <>
                              <p>{verifierName}</p>
                              {doc.verifiedAt && <p>{new Date(doc.verifiedAt).toLocaleDateString()}</p>}
                            </>
                          ) : '—'}
                        </TableCell>
                      )}
                      {col('compliance') && (
                        <TableCell>{getComplianceBadge(doc.status)}</TableCell>
                      )}
                      {col('createdAt') && (
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}
                        </TableCell>
                      )}
                      {col('documentNumber') && (
                        <TableCell className="text-sm font-mono">{doc.documentNumber ?? '—'}</TableCell>
                      )}
                      {col('issueDate') && (
                        <TableCell className="text-sm">
                          {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : '—'}
                        </TableCell>
                      )}
                      {col('entityType') && (
                        <TableCell>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${doc.entityType === 'APPLICANT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {doc.entityType === 'APPLICANT' ? 'Applicant' : 'Employee'}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
