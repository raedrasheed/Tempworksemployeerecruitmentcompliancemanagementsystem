import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, MapPin, Briefcase, Clock, Calendar, ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { publicJobAdsApi, BACKEND_URL } from '../../services/api';
import { useBranding } from '../../hooks/useBranding';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';

function formatSalary(min: any, max: any, currency: string): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n.toLocaleString();
  if (min && max) return `${currency} ${fmt(Number(min))} – ${fmt(Number(max))}`;
  if (min) return `from ${currency} ${fmt(Number(min))}`;
  return `up to ${currency} ${fmt(Number(max))}`;
}

const CONTRACT_TYPE_COLORS: Record<string, string> = {
  'Full-time':  'bg-blue-100 text-blue-700',
  'Part-time':  'bg-purple-100 text-purple-700',
  'Contract':   'bg-orange-100 text-orange-700',
  'Temporary':  'bg-amber-100 text-amber-700',
  'Internship': 'bg-pink-100 text-pink-700',
  'Seasonal':   'bg-teal-100 text-teal-700',
};

export function JobDetail() {
  const branding = useBranding();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    publicJobAdsApi.getBySlug(slug)
      .then(setJob)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto" />
          <h2 className="text-xl font-semibold">Job Not Found</h2>
          <p className="text-muted-foreground">This job listing may have been removed or is no longer available.</p>
          <Link to="/jobs">
            <Button variant="outline">View All Jobs</Button>
          </Link>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${BACKEND_URL}${branding.logoUrl}`} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Briefcase className="w-6 h-6 text-white" />
              )}
            </div>
            <span className="text-xl font-bold text-[#0F172A]">{branding.companyName}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/jobs">
              <Button variant="outline" size="sm">All Jobs</Button>
            </Link>
            <Link to={`/apply?jobAdId=${job.id}&jobCategory=${encodeURIComponent(job.category ?? '')}&jobTitle=${encodeURIComponent(job.title ?? '')}&requiredDocs=${encodeURIComponent(JSON.stringify(job.requiredDocuments ?? []))}`}>
              <Button size="sm">Apply Now</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/jobs" className="hover:text-primary">Jobs</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground line-clamp-1">{job.title}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="max-w-3xl mx-auto">
          {/* Job header card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONTRACT_TYPE_COLORS[job.contractType] ?? 'bg-gray-100 text-gray-700'}`}>
                      {job.contractType}
                    </span>
                    <span className="text-xs text-muted-foreground">{job.category}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-3">{job.title}</h1>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {job.city}, {job.country}
                    </span>
                    {salary && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4" />
                        {salary}
                      </span>
                    )}
                    {job.publishedAt && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        Posted {new Date(job.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Link to={`/apply?jobAdId=${job.id}&jobCategory=${encodeURIComponent(job.category ?? '')}&jobTitle=${encodeURIComponent(job.title ?? '')}&requiredDocs=${encodeURIComponent(JSON.stringify(job.requiredDocuments ?? []))}`}>
                    <Button size="lg" className="w-full sm:w-auto">
                      Apply Now
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Job Description</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {job.description}
              </div>
            </CardContent>
          </Card>

          {/* Apply CTA */}
          <Card className="bg-[#2563EB] text-white border-0">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Interested in this position?</h3>
              <p className="text-blue-100 text-sm mb-5">
                Submit your application today. Our team will review it and get back to you shortly.
              </p>
              <Link to={`/apply?jobAdId=${job.id}&jobCategory=${encodeURIComponent(job.category ?? '')}&jobTitle=${encodeURIComponent(job.title ?? '')}&requiredDocs=${encodeURIComponent(JSON.stringify(job.requiredDocuments ?? []))}`}>
                <Button variant="secondary" size="lg">
                  Apply for this Position
                </Button>
              </Link>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Link to="/jobs" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to all jobs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
