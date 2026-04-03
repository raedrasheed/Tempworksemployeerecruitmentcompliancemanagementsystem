import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Search, MapPin, Briefcase, Clock, ChevronLeft, ChevronRight,
  ArrowRight, Filter, X,
} from 'lucide-react';
import { publicJobAdsApi, settingsApi } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CountrySelect } from '../../components/ui/CountrySelect';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';

const CONTRACT_TYPE_COLORS: Record<string, string> = {
  'Full-time':  'bg-blue-100 text-blue-700',
  'Part-time':  'bg-purple-100 text-purple-700',
  'Contract':   'bg-orange-100 text-orange-700',
  'Temporary':  'bg-amber-100 text-amber-700',
  'Internship': 'bg-pink-100 text-pink-700',
  'Seasonal':   'bg-teal-100 text-teal-700',
};

function formatSalary(min: any, max: any, currency: string): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n.toLocaleString();
  if (min && max) return `${currency} ${fmt(Number(min))} – ${fmt(Number(max))}`;
  if (min) return `from ${currency} ${fmt(Number(min))}`;
  return `up to ${currency} ${fmt(Number(max))}`;
}

export function JobListings() {
  const [jobs, setJobs]     = useState<any[]>([]);
  const [meta, setMeta]     = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const [search, setSearch]           = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [categories, setCategories]   = useState<string[]>([]);
  const [page, setPage]               = useState(1);
  const limit = 12;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await publicJobAdsApi.list({
        page: p, limit,
        ...(search         ? { search }                       : {}),
        ...(countryFilter  ? { country:      countryFilter }  : {}),
        ...(categoryFilter ? { category:     categoryFilter } : {}),
        ...(contractFilter ? { contractType: contractFilter } : {}),
      }) as any;
      setJobs(res.data ?? []);
      setMeta(res.meta ?? { total: 0, page: 1, limit, totalPages: 1 });
    } catch {
      setError('Unable to load job listings. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [search, countryFilter, categoryFilter, contractFilter]);

  useEffect(() => {
    settingsApi.getJobTypes()
      .then((types: any[]) => setCategories(types.filter((t: any) => t.isActive).map((t: any) => t.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, countryFilter, categoryFilter, contractFilter]);

  const handlePage = (p: number) => {
    setPage(p);
    load(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasFilters = search || countryFilter || categoryFilter || contractFilter;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-[#0F172A]">TempWorks Europe</span>
              <p className="text-xs text-muted-foreground">Current Job Openings</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/#contact">
              <Button variant="outline" size="sm">Contact Us</Button>
            </Link>
            <Link to="/apply">
              <Button size="sm">Apply Now</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#0F172A] text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-3">Current Job Openings</h1>
          <p className="text-blue-200 text-lg max-w-2xl mx-auto mb-8">
            Browse our latest opportunities and start your journey with TempWorks Europe.
          </p>
          {/* Search bar */}
          <div className="max-w-xl mx-auto flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search job title, location…"
                className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Filters
                  </span>
                  {hasFilters && (
                    <button
                      onClick={() => {
                        setSearch(''); setCountryFilter('');
                        setCategoryFilter(''); setContractFilter('');
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Clear all
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country</label>
                  <div className="mt-1.5">
                    <CountrySelect
                      value={countryFilter}
                      onChange={setCountryFilter}
                      placeholder="All Countries"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contract Type</label>
                  <select
                    value={contractFilter}
                    onChange={e => setContractFilter(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All Types</option>
                    {['Full-time','Part-time','Contract','Temporary','Internship','Seasonal'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Job grid */}
          <main className="flex-1">
            {/* Result count */}
            <div className="mb-4 text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${meta.total} job${meta.total !== 1 ? 's' : ''} found`}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && jobs.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No job openings found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map(job => {
                const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);
                return (
                  <Link key={job.id} to={`/jobs/${job.slug}`}>
                    <Card className="h-full hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
                      <CardContent className="p-5 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-3">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONTRACT_TYPE_COLORS[job.contractType] ?? 'bg-gray-100 text-gray-700'}`}>
                            {job.contractType}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </div>

                        <h3 className="font-semibold text-foreground text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-3">{job.category}</p>

                        <div className="space-y-1.5 mt-auto">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5" />
                            {job.city}, {job.country}
                          </div>
                          {salary && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Briefcase className="w-3.5 h-3.5" />
                              {salary}
                            </div>
                          )}
                          {job.publishedAt && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />
                              Posted {new Date(job.publishedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {page} of {meta.totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => handlePage(page + 1)}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-[#2563EB] text-white py-12 mt-10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-3">Don't see the right role?</h2>
          <p className="text-blue-100 mb-6">Submit a general application and we'll contact you when a matching position opens.</p>
          <Link to="/apply">
            <Button variant="secondary" size="lg">Submit General Application</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
