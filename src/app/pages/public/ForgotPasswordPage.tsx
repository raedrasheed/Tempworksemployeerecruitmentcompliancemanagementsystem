import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft, CheckCircle } from 'lucide-react';
import { authApi, BACKEND_URL } from '../../services/api';
import { useBranding } from '../../hooks/useBranding';
import { ReCaptchaV2 } from '../../components/ui/ReCaptchaV2';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

export function ForgotPasswordPage() {
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email, captchaToken);
    } catch {
      // Intentionally swallow error to prevent enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
      setCaptchaToken(null);
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
            <div className="w-12 h-12 rounded-lg bg-[#2563EB] flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${BACKEND_URL}${branding.logoUrl}`} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Briefcase className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="text-left">
              <span className="text-xl font-bold text-[#0F172A] block">{branding.companyName}</span>
              <span className="text-xs text-muted-foreground">Professional Recruitment</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your email address and we'll send you a reset link
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {submitted ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-center text-muted-foreground leading-relaxed">
                  If an account exists for <span className="font-medium text-[#0F172A]">{email}</span>, a reset link has been sent.
                  Please check your inbox and follow the instructions.
                </p>
              </div>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="flex justify-center">
                <ReCaptchaV2
                  siteKey={RECAPTCHA_SITE_KEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpired={() => setCaptchaToken(null)}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#2563EB] hover:bg-[#1d4ed8]"
                disabled={loading || !captchaToken}
                title={!captchaToken ? 'Please complete the "I am not a robot" check first' : undefined}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-[#2563EB] hover:underline">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 {branding.companyName} - Secure Access</p>
      </div>
    </div>
  );
}
