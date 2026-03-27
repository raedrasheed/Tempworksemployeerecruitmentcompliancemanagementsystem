import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authApi.login(email, password);
      toast.success('Welcome back!');
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
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
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
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <a href="#" className="text-sm text-[#2563EB] hover:underline">
                  Forgot password?
                </a>
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

            {/* Login Button */}
            <Button
              type="submit"
              className="w-full bg-[#2563EB] hover:bg-[#1d4ed8]"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Looking for a job opportunity?
            </p>
            <Link to="/apply">
              <Button variant="outline" className="w-full">
                Submit Job Application
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 TempWorks Europe - Secure Access</p>
      </div>
    </div>
  );
}