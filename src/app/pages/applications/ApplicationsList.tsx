import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Filter, Eye, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';
import { applicationsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from 'sonner';

const applicationColumns: Column[] = [
  { id: 'id', label: 'Application ID', type: 'text' },
  { id: 'applicantName', label: 'Applicant Name', type: 'text' },
  { id: 'jobType', label: 'Position', type: 'text' },
  { id: 'nationality', label: 'Nationality', type: 'text' },
  { id: 'createdAt', label: 'Submitted Date', type: 'date' },
  { id: 'status', label: 'Status', type: 'enum', options: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'] },
];

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'APPROVED': return 'bg-green-100 text-green-800';
    case 'UNDER_REVIEW': return 'bg-blue-100 text-blue-800';
    case 'REJECTED': return 'bg-red-100 text-red-800';
    case 'SUBMITTED': return 'bg-purple-100 text-purple-800';
    case 'WITHDRAWN': return 'bg-gray-100 text-gray-800';
    default: return 'bg-yellow-100 text-yellow-800';
  }
};

export function ApplicationsList() {
  const navigate = useNavigate();
  const { canCreate, canDelete } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applications, setApplications] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    { id: '1', name: 'Pending Review', rules: [{ id: '1', columnId: 'status', operator: 'equals', value: 'UNDER_REVIEW' }], logic: 'AND' },
    { id: '2', name: 'Submitted', rules: [{ id: '1', columnId: 'status', operator: 'equals', value: 'SUBMITTED' }], logic: 'AND' },
  ]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: 1, limit: 100 };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;
      const result = await applicationsApi.list(params);
      setApplications(result.data || []);
      setTotal(result.meta?.total || 0);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchApplications, 300);
    return () => clearTimeout(t);
  }, [fetchApplications]);

  const handleDelete = async (appId: string) => {
    if (!confirm('Delete this application?')) return;
    try {
      await applicationsApi.delete(appId);
      toast.success('Application deleted');
      fetchApplications();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete application');
    }
  };

  // Apply frontend filters
  const applyFilters = (app: any) => {
    if (activeFilters.length === 0) return true;
    const results = activeFilters.map(filter => {
      let value: string;
      switch (filter.columnId) {
        case 'applicantName':
          value = app.applicant ? `${app.applicant.firstName} ${app.applicant.lastName}` : '';
          break;
        case 'jobType':
          value = app.jobType?.name || '';
          break;
        case 'nationality':
          value = app.applicant?.nationality || '';
          break;
        default:
          value = (app as any)[filter.columnId] || '';
      }
      switch (filter.operator) {
        case 'contains': return value.toLowerCase().includes(filter.value.toLowerCase());
        case 'equals': return value.toLowerCase() === filter.value.toLowerCase();
        case 'startsWith': return value.toLowerCase().startsWith(filter.value.toLowerCase());
        case 'endsWith': return value.toLowerCase().endsWith(filter.value.toLowerCase());
        case 'before': return new Date(value) < new Date(filter.value);
        case 'after': return new Date(value) > new Date(filter.value);
        default: return true;
      }
    });
    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const filtered = applications.filter(app => {
    const name = app.applicant ? `${app.applicant.firstName} ${app.applicant.lastName}` : '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.jobType?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && applyFilters(app);
  });

  // Stats
  const stats = {
    total: applications.length,
    submitted: applications.filter(a => a.status === 'SUBMITTED').length,
    underReview: applications.filter(a => a.status === 'UNDER_REVIEW').length,
    approved: applications.filter(a => a.status === 'APPROVED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Applications</h1>
          <p className="text-muted-foreground mt-1">Manage driver applications and recruitment requests</p>
        </div>
        {canCreate('applications') && (
          <Button onClick={() => navigate('/dashboard/applicants/add')}>
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Submitted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-purple-600">{stats.submitted}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Under Review</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{stats.underReview}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.approved}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
              </SelectContent>
            </Select>

            <FilterSystem
              columns={applicationColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={(name, rules, logic) => setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, rules, logic }])}
              onLoadPreset={(preset) => { setActiveFilters(preset.rules); setFilterLogic(preset.logic); }}
              onDeletePreset={(pid) => setSavedPresets(prev => prev.filter(p => p.id !== pid))}
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading applications...</div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application ID</TableHead>
                    <TableHead>Applicant Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-mono text-xs">{app.id.slice(0, 8)}…</TableCell>
                      <TableCell>
                        {app.applicant
                          ? `${app.applicant.firstName} ${app.applicant.lastName}`
                          : '-'}
                      </TableCell>
                      <TableCell>{app.jobType?.name || '-'}</TableCell>
                      <TableCell>{app.applicant?.nationality || '-'}</TableCell>
                      <TableCell>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(app.status)}>
                          {app.status?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {app.reviewedBy
                          ? `${app.reviewedBy.firstName} ${app.reviewedBy.lastName}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/applications/${app.id}`}>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Link>
                          </Button>
                          {canDelete('applications') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(app.id)}
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
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No applications found.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
