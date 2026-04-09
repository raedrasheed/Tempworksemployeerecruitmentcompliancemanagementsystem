import { useState, useEffect, useCallback } from 'react';
import { applicantsApi, employeeWorkflowApi, agenciesApi, settingsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { getCurrentUser, getAccessToken } from '../../services/api';
import { Link } from 'react-router';
import { Search, Plus, Eye, Edit, UserPlus, Download, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'NEW': return 'bg-blue-100 text-blue-800';
    case 'SCREENING': return 'bg-yellow-100 text-yellow-800';
    case 'INTERVIEW': return 'bg-purple-100 text-purple-800';
    case 'OFFER': case 'ONBOARDING': case 'ACCEPTED': return 'bg-green-100 text-green-800';
    case 'REJECTED': case 'WITHDRAWN': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getTierColor = (tier: string) => {
  if (tier === 'CANDIDATE') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  return 'bg-amber-100 text-amber-800 border border-amber-200';
};

const STATUSES = ['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'ONBOARDING'];

export function ApplicantsList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const currentUser = getCurrentUser();
  const isAgencyUser = currentUser?.role === 'Agency User' || currentUser?.role === 'Agency Manager';

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]     = useState('');
  const [tierFilter]                    = useState<string>('LEAD');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [agencyFilter, setAgencyFilter] = useState<string>('');

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [applicantsData, setApplicantsData] = useState<any[]>([]);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allStages, setAllStages] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [changingStageFor, setChangingStageFor] = useState<string | null>(null);

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: 1, limit: 100 };
      if (searchTerm) params.search = searchTerm;
      if (tierFilter) params.tier = tierFilter;
      if (statusFilter) params.status = statusFilter;
      if (agencyFilter) params.agencyId = agencyFilter;
      const result = await applicantsApi.list(params);
      setApplicantsData(result.data || []);
      setTotalApplicants(result.meta?.total || 0);
    } catch {
      setApplicantsData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, tierFilter, statusFilter, agencyFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchApplicants, 300);
    return () => clearTimeout(timer);
  }, [fetchApplicants]);

  useEffect(() => {
    employeeWorkflowApi.getStages()
      .then((s: any) => setAllStages(Array.isArray(s) ? s : []))
      .catch(() => {});
    agenciesApi.list({ limit: 200 })
      .then((r: any) => setAgencies(r?.data ?? []))
      .catch(() => {});
    settingsApi.getJobTypes?.()
      .then((jt: any) => setJobTypes(Array.isArray(jt) ? jt : []))
      .catch(() => {});
  }, []);

  // ── Stage Change ──────────────────────────────────────────────────────────────
  const handleStageChange = async (applicantId: string, stageId: string) => {
    setChangingStageFor(applicantId);
    try {
      const updated = await applicantsApi.setCurrentStage(applicantId, stageId);
      setApplicantsData(prev => prev.map(a =>
        a.id === applicantId
          ? { ...a, currentWorkflowStageId: updated.currentWorkflowStageId, currentWorkflowStage: updated.currentWorkflowStage }
          : a,
      ));
      toast.success('Stage updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update stage');
    } finally {
      setChangingStageFor(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (applicant: any) => {
    if (!confirm(`Delete "${applicant.firstName} ${applicant.lastName}"? This cannot be undone.`)) return;
    try {
      await applicantsApi.delete(applicant.id);
      setApplicantsData(prev => prev.filter(a => a.id !== applicant.id));
      setTotalApplicants(prev => prev - 1);
      setSelected(prev => { const n = new Set(prev); n.delete(applicant.id); return n; });
      toast.success('Applicant deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete applicant');
    }
  };

  // ── Bulk selection ────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === applicantsData.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(applicantsData.map(a => a.id)));
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  const handleBulkAction = async (action: string, value?: string) => {
    if (selected.size === 0) { toast.error('Select at least one applicant'); return; }
    setBulkActionInProgress(true);
    try {
      const result = await applicantsApi.bulkAction({ ids: [...selected], action, value });
      const failed = result.results?.filter((r: any) => !r.success) ?? [];
      if (failed.length === 0) {
        toast.success(`Bulk action applied to ${selected.size} applicant(s)`);
      } else {
        toast.warning(`Applied to ${selected.size - failed.length}, failed for ${failed.length}`);
      }
      setSelected(new Set());
      await fetchApplicants();
    } catch (err: any) {
      toast.error(err?.message || 'Bulk action failed');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const params: Record<string, any> = {};
    if (searchTerm) params.search = searchTerm;
    if (tierFilter) params.tier = tierFilter;
    if (statusFilter) params.status = statusFilter;
    if (agencyFilter) params.agencyId = agencyFilter;

    const token = getAccessToken();
    const csvUrl = applicantsApi.exportCsv(params);
    // Open URL with bearer token via hidden anchor (token in query param for file downloads)
    const a = document.createElement('a');
    // Use fetch + blob to honour auth header
    fetch(csvUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `applicants-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Export failed'));
  };

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const leads      = applicantsData.filter(a => a.tier === 'LEAD');
  const candidates = applicantsData.filter(a => a.tier === 'CANDIDATE');
  const newCount   = applicantsData.filter(a => a.status === 'NEW').length;
  const acceptedCount = applicantsData.filter(a => a.status === 'ACCEPTED' || a.status === 'ONBOARDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Applicants</h1>
          <p className="text-muted-foreground mt-1">
            Manage leads and convert to candidates
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate('applicants') && (
            <Button asChild>
              <Link to="/dashboard/applicants/add">
                <Plus className="w-4 h-4 mr-2" />
                Add Applicant
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0F172A]">{totalApplicants}</div>
          </CardContent>
        </Card>
        {!isAgencyUser && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{leads.length}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Accepted / Onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{acceptedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {!isAgencyUser && (
              <>
                <Button
                  variant="outline" size="sm"
                  disabled={bulkActionInProgress}
                  onClick={() => handleBulkAction('TIER_CHANGE', 'CANDIDATE')}
                >
                  Promote to Candidate
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={bulkActionInProgress}
                  onClick={() => {
                    const status = prompt('Enter new status (NEW / SCREENING / INTERVIEW / OFFER / ACCEPTED / REJECTED / WITHDRAWN / ONBOARDING)');
                    if (status) handleBulkAction('STATUS_CHANGE', status.toUpperCase());
                  }}
                >
                  Change Status
                </Button>
              </>
            )}
            <Button
              variant="outline" size="sm" className="text-red-600"
              disabled={bulkActionInProgress}
              onClick={() => {
                if (confirm(`Delete ${selected.size} applicant(s)?`)) handleBulkAction('DELETE');
              }}
            >
              <Trash2 className="w-3 h-3 mr-1" />Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* Search / Filters / Table */}
      <Card>
        <CardContent className="p-6">
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!isAgencyUser && agencies.length > 0 && (
              <Select value={agencyFilter || '__all__'} onValueChange={v => setAgencyFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Agencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Agencies</SelectItem>
                  {agencies.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button variant="outline" size="sm" onClick={fetchApplicants} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size > 0 && selected.size === applicantsData.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Agency</TableHead>
                  {!isAgencyUser && <TableHead>Tier</TableHead>}
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={isAgencyUser ? 9 : 10} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && applicantsData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAgencyUser ? 9 : 10} className="text-center py-12 text-muted-foreground">
                      No applicants found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && applicantsData.map((applicant) => (
                  <TableRow key={applicant.id} className={selected.has(applicant.id) ? 'bg-blue-50' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(applicant.id)}
                        onCheckedChange={() => toggleSelect(applicant.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center shrink-0">
                          {applicant.photoUrl
                            ? <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${applicant.photoUrl}`} alt={applicant.firstName} className="w-full h-full object-cover" />
                            : <span className="text-blue-600 text-sm font-semibold">{applicant.firstName?.[0]}{applicant.lastName?.[0]}</span>
                          }
                        </div>
                        <div>
                          <div className="font-medium text-[#0F172A]">
                            {applicant.firstName} {applicant.lastName}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">
                            {applicant.tier === 'CANDIDATE' && applicant.candidateNumber
                              ? <span className="text-purple-600">{applicant.candidateNumber}</span>
                              : applicant.leadNumber
                                ? <span className="text-blue-600">{applicant.leadNumber}</span>
                                : <span className="italic opacity-60">Legacy</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{applicant.email}</div>
                        <div className="text-muted-foreground">{applicant.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{applicant.nationality}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {typeof applicant.jobType === 'object' && applicant.jobType !== null
                          ? applicant.jobType.name
                          : applicant.jobType ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {applicant.agency
                        ? <span className="text-sm">{applicant.agency.name}</span>
                        : <span className="text-sm text-muted-foreground">Direct</span>}
                    </TableCell>
                    {!isAgencyUser && (
                      <TableCell>
                        <Badge className={getTierColor(applicant.tier)}>
                          {applicant.tier}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-sm">
                        {applicant.createdAt
                          ? new Date(applicant.createdAt).toLocaleDateString()
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(applicant.status)}>
                        {applicant.status?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/applicants/${applicant.id}`}>
                            <Eye className="w-4 h-4 mr-1" />View
                          </Link>
                        </Button>
                        {canEdit('applicants') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/applicants/${applicant.id}/edit`}>
                              <Edit className="w-4 h-4 mr-1" />Edit
                            </Link>
                          </Button>
                        )}
                        {canDelete('applicants') && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleDelete(applicant)}
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {applicantsData.length} of {totalApplicants} applicants
              {selected.size > 0 && ` · ${selected.size} selected`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
