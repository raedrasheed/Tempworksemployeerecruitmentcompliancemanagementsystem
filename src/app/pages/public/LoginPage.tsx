import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, resolveAssetUrl } from '../../services/api';
import { useBranding } from '../../hooks/useBranding';

export function LoginPage() {
  const navigate = useNavigate();
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const emailInvalid = emailTouched && !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 2FA challenge state
  const [twoFactor, setTwoFactor] = useState<{ challengeId: string; emailHint?: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const proceedAfterLogin = (result: any) => {
    toast.success('Welcome back!');
    if (result?.passwordExpired) {
      navigate('/change-password', {
        state: { message: 'Your password has expired. Please set a new one.' },
      });
      return;
    }
    navigate('/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authApi.login(email, password);
      if ('twoFactorRequired' in result && result.twoFactorRequired) {
        setTwoFactor({ challengeId: result.challengeId, emailHint: result.emailHint });
        setOtp('');
        toast.info('We just emailed you a verification code.');
        return;
      }
      proceedAfterLogin(result);
    } catch (err: any) {
      const raw = err?.message || 'Login failed. Please check your credentials.';
      const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactor) return;
    setVerifying(true);
    setError('');
    try {
      const result = await authApi.verifyTwoFactor(twoFactor.challengeId, otp.trim());
      proceedAfterLogin(result);
    } catch (err: any) {
      const raw = err?.message || 'Verification failed';
      const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
      setError(message);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!twoFactor) return;
    setResending(true);
    try {
      const { challengeId } = await authApi.resendTwoFactor(twoFactor.challengeId);
      setTwoFactor(prev => (prev ? { ...prev, challengeId } : prev));
      setOtp('');
      toast.success('A new code is on the way.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not resend code. Please sign in again.');
      setTwoFactor(null);
    } finally {
      setResending(false);
    }
  };

  const cancelTwoFactor = () => {
    setTwoFactor(null);
    setOtp('');
    setError('');
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
            <div className="w-12 h-12 rounded-lg bg-[#2563EB] flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img
                  src={resolveAssetUrl(branding.logoUrl)}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Briefcase className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="text-left">
              <span className="text-xl font-bold text-[#0F172A] block">{branding.companyName}</span>
              <span className="text-xs text-muted-foreground">Professional Recruitment</span>
            </div>
          </div>
          <CardTitle className="text-2xl">
            {twoFactor ? 'Two-Factor Verification' : 'Login to Platform'}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {twoFactor
              ? `We sent a 6-digit code to ${twoFactor.emailHint ?? 'your email'}. Enter it below to continue.`
              : 'Access your recruitment management dashboard'}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {twoFactor ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-md bg-[#EFF6FF] border border-[#2563EB]/20">
                <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0" />
                <p className="text-sm text-[#0F172A]">
                  Check your inbox for the verification code. It expires in 10 minutes.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium">Verification code</label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="tracking-[0.5em] text-center font-mono text-lg"
                  maxLength={6}
                  required
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
                disabled={verifying || otp.length !== 6}
              >
                {verifying ? 'Verifying…' : 'Verify & sign in'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-[#2563EB] hover:underline disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={cancelTwoFactor}
                  className="text-muted-foreground hover:underline"
                >
                  Use a different account
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email Address</label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                className={emailInvalid ? 'border-red-400 focus-visible:ring-red-400' : ''}
                required
                autoComplete="email"
              />
              {emailInvalid && <p className="text-xs text-red-500">Please enter a valid email address</p>}
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
          )}

          {!twoFactor && (
          <>
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
          </>
          )}
        </CardContent>
      </Card>

      <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 {branding.companyName} - Secure Access</p>
      </div>
    </div>
  );
}
