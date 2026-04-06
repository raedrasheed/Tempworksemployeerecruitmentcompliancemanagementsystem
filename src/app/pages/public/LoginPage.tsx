import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, agenciesApi, setTokens, setCurrentUser } from '../../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Agency dropdown state
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<{ id: string; name: string } | null>(null);
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyOpen, setAgencyOpen] = useState(false);

  useEffect(() => {
    agenciesApi.listPublic()
      .then(data => setAgencies(Array.isArray(data) ? data : []))
      .catch(() => setAgencies([]));
  }, []);

  const filteredAgencies = agencies.filter(a =>
    a.name.toLowerCase().includes(agencySearch.toLowerCase())
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authApi.login(email, password, selectedAgency?.id || undefined);
      toast.success('Welcome back!');

      if ((result as any)?.passwordExpired) {
        navigate('/change-password', {
          state: { message: 'Your password has expired. Please set a new one.' },
        });
        return;
      }

      navigate('/dashboard');
    } catch (err: any) {
      const raw = err?.message || 'Login failed. Please check your credentials.';
      const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EFF6FF] to-white flex items-center justify-center p-4">
      {/* Back to Home */}
      <div className="absolute top-4 left-4">
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <span className="text-xl font-bold text-[#0F172A] block">TempWorks Europe</span>
              <span className="text-xs text-muted-foreground">Professional Recruitment</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Login to Platform</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Access your recruitment management dashboard
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Agency Dropdown (optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Agency <span className="text-muted-foreground font-normal">(optional)</span>
              </label>

              <div className="relative">
                {/* Selected value / trigger */}
                <button
                  type="button"
                  onClick={() => { setAgencyOpen(o => !o); setAgencySearch(''); }}
                  className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm bg-white hover:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] transition-colors"
                >
                  {selectedAgency ? (
                    <span className="text-[#0F172A]">{selectedAgency.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Select your agency...</span>
                  )}
                  <div className="flex items-center gap-1">
                    {selectedAgency && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setSelectedAgency(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedAgency(null); } }}
                        className="p-0.5 hover:bg-gray-100 rounded"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${agencyOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown panel */}
                {agencyOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg">
                    <div className="p-2 border-b">
                      <Input
                        autoFocus
                        placeholder="Search agencies..."
                        value={agencySearch}
                        onChange={e => setAgencySearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredAgencies.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No agencies found</p>
                      ) : filteredAgencies.map(agency => (
                        <button
                          key={agency.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EFF6FF] transition-colors ${selectedAgency?.id === agency.id ? 'bg-[#EFF6FF] text-[#2563EB] font-medium' : ''}`}
                          onClick={() => { setSelectedAgency(agency); setAgencyOpen(false); }}
                        >
                          {agency.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Leave blank if you are not associated with a specific agency
              </p>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email Address</label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Link to="/forgot-password" className="text-sm text-[#2563EB] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#2563EB] hover:bg-[#1d4ed8]"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Looking for a job opportunity?</p>
            <Link to="/apply">
              <Button variant="outline" className="w-full">Submit Job Application</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 TempWorks Europe - Secure Access</p>
      </div>
    </div>
  );
}
