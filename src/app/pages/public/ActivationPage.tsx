import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, setTokens, setCurrentUser } from '../../services/api';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Medium', color: 'bg-yellow-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {text}
    </div>
  );
}

export function ActivationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rules = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const allRulesMet = Object.values(rules).every(Boolean);
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing activation token.');
      return;
    }
    if (!allRulesMet) {
      setError('Password does not meet the requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.activateAccount(token, password);
      setTokens(result.accessToken, result.refreshToken);
      setCurrentUser(result.user);
      toast.success('Account activated successfully! Welcome!');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.message || 'Activation failed. The link may have expired or already been used.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
      toast.error('Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EFF6FF] to-white flex items-center justify-center p-4">
      <div className="absolute top-4 left-4">
        <Link to="/login">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
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
          <CardTitle className="text-2xl">Activate Your Account</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Set a password to complete your account activation
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {!token && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              No activation token found. Please use the link from your invitation email.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                New Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {password && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${strength.color}`}
                        style={{ width: `${(strength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      strength.label === 'Weak' ? 'text-red-500' :
                      strength.label === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                    }`}>{strength.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <PasswordRule met={rules.minLength} text="At least 8 characters" />
                    <PasswordRule met={rules.uppercase} text="Uppercase letter" />
                    <PasswordRule met={rules.lowercase} text="Lowercase letter" />
                    <PasswordRule met={rules.number} text="Number" />
                    <PasswordRule met={rules.special} text="Special character" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#2563EB] hover:bg-[#1d4ed8]"
              disabled={loading || !token}
            >
              {loading ? 'Activating...' : 'Activate Account'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 TempWorks Europe - Secure Access</p>
      </div>
    </div>
  );
}
