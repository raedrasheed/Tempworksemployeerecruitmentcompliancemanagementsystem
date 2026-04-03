import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import {
  Plus, Search, Filter, ExternalLink, Edit2, Trash2,
  MapPin, Briefcase, Clock, Users, Eye, EyeOff, Archive,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { jobAdsApi } from '../../services/api';
import { getCurrentUser } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED:  'bg-orange-100 text-orange-700',
};

const WRITE_ROLES = ['System Admin', 'HR Manager', 'Recruiter'];

export function JobAdsList() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const canWrite = WRITE_ROLES.includes(currentUser?.role ?? '');

  const [ads, setAds] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [countryFilter, setCountryFilter]   = useState('');

  const [categories, setCategories]     = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await jobAdsApi.list({
        page: p, limit,
        ...(search       ? { search }        : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(countryFilter  ? { country: countryFilter }   : {}),
      }) as any;
      setAds(res.data ?? []);
      setMeta(res.meta ?? { total: 0, page: 1, limit, totalPages: 1 });
    } catch {
      toast.error('Failed to load job ads');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, countryFilter]);

  useEffect(() => {
    jobAdsApi.getConstants().then((c: any) => {
      setCategories(c.categories ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, statusFilter, categoryFilter, countryFilter]);

  const handlePage = (p: number) => {
    setPage(p);
    load(p);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await jobAdsApi.delete(id);
      toast.success('Job ad deleted');
      load(page);
    } catch {
      toast.error('Failed to delete job ad');
    }
  };

  const handleQuickStatus = async (id: string, newStatus: string) => {
    try {
      await jobAdsApi.update(id, { status: newStatus });
      toast.success(`Moved to ${newStatus}`);
      load(page);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Ads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage published and draft job advertisements
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Link to="/jobs" target="_blank">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="w-4 h-4" /> View Public Page
              </Button>
            </Link>
            <Button onClick={() => navigate('/dashboard/job-ads/new')} className="gap-2">
              <Plus className="w-4 h-4" /> New Job Ad
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search title, city, country…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(statusFilter || categoryFilter || countryFilter || search) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch(''); setStatusFilter('');
                setCategoryFilter(''); setCountryFilter('');
              }}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Location</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Contract</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Applicants</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Created</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : ads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No job ads found.{' '}
                  {canWrite && (
                    <button
                      onClick={() => navigate('/dashboard/job-ads/new')}
                      className="text-primary underline"
                    >
                      Create the first one.
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              ads.map(ad => (
                <tr key={ad.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground line-clamp-1">{ad.title}</div>
                    <div className="text-xs text-muted-foreground">/{ad.slug}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{ad.category}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <MapPin className="w-3 h-3" />
                      {ad.city}, {ad.country}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {ad.contractType}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ad.status] ?? ''}`}>
                      {ad.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-center">
                    {ad._count?.applicants ?? 0}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(ad.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite && ad.status === 'DRAFT' && (
                        <button
                          onClick={() => handleQuickStatus(ad.id, 'PUBLISHED')}
                          title="Publish"
                          className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {canWrite && ad.status === 'PUBLISHED' && (
                        <button
                          onClick={() => handleQuickStatus(ad.id, 'ARCHIVED')}
                          title="Archive"
                          className="p-1.5 rounded hover:bg-orange-50 text-orange-500 transition-colors"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => navigate(`/dashboard/job-ads/${ad.id}/edit`)}
                          title="Edit"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => handleDelete(ad.id, ad.title)}
                          title="Delete"
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {meta.total > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={8} className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {meta.total} job ad{meta.total !== 1 ? 's' : ''}
                      {' · '}Page {meta.page} of {meta.totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm"
                        disabled={page <= 1}
                        onClick={() => handlePage(page - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        disabled={page >= meta.totalPages}
                        onClick={() => handlePage(page + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
