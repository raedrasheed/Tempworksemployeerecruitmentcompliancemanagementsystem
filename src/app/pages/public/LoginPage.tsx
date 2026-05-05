import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, resolveAssetUrl } from '../../services/api';
import { useBranding } from '../../hooks/useBranding';
import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher';

export function LoginPage() {
  const navigate = useNavigate();
  const branding = useBranding();
  const { t } = useTranslation(['auth', 'common']);
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
    toast.success(t('login.welcomeBack'));
    if (result?.passwordExpired) {
      navigate('/change-password', {
        state: { message: t('login.passwordExpiredMessage') },
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
        toast.info(t('twoFactor.codeSentToast'));
        return;
      }
      proceedAfterLogin(result);
    } catch (err: any) {
      const raw = err?.message || t('login.loginFailed');
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
      const raw = err?.message || t('twoFactor.verifyFailed');
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
      toast.success(t('twoFactor.resendSuccess'));
    } catch (err: any) {
      toast.error(err?.message || t('twoFactor.resendFailed'));
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
      <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4">
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('login.backToHome')}
          </Button>
        </Link>
      </div>

      {/* Language switcher */}
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <LanguageSwitcher variant="labelled" />
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
            <div className="text-start">
              <span className="text-xl font-bold text-[#0F172A] block">{branding.companyName}</span>
              <span className="text-xs text-muted-foreground">{t('common:branding.tagline')}</span>
            </div>
          </div>
          <CardTitle className="text-2xl">
            {twoFactor ? t('twoFactor.title') : t('login.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {twoFactor
              ? (twoFactor.emailHint
                  ? t('twoFactor.subtitleWithEmail', { email: twoFactor.emailHint })
                  : t('twoFactor.subtitleWithoutEmail'))
              : t('login.subtitle')}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {twoFactor ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-md bg-[#EFF6FF] border border-[#2563EB]/20">
                <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0" />
                <p className="text-sm text-[#0F172A]">{t('twoFactor.noticeBanner')}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium">{t('twoFactor.codeLabel')}</label>
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
                {verifying ? t('twoFactor.verifying') : t('twoFactor.verify')}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-[#2563EB] hover:underline disabled:opacity-50"
                >
                  {resending ? t('twoFactor.resending') : t('twoFactor.resend')}
                </button>
                <button
                  type="button"
                  onClick={cancelTwoFactor}
                  className="text-muted-foreground hover:underline"
                >
                  {t('twoFactor.useDifferentAccount')}
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">{t('login.emailLabel')}</label>
              <Input
                id="email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                className={emailInvalid ? 'border-red-400 focus-visible:ring-red-400' : ''}
                required
                autoComplete="email"
              />
              {emailInvalid && <p className="text-xs text-red-500">{t('login.emailInvalid')}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">{t('login.passwordLabel')}</label>
                <Link to="/forgot-password" className="text-sm text-[#2563EB] hover:underline">
                  {t('login.forgot')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t('login.passwordPlaceholder')}
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
              {loading ? t('login.submitting') : t('login.submit')}
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
              <span className="bg-white px-2 text-muted-foreground">{t('login.or')}</span>
            </div>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">{t('login.lookingForJob')}</p>
            <Link to="/apply">
              <Button variant="outline" className="w-full">{t('login.submitApplication')}</Button>
            </Link>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      <div className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>{t('common:branding.copyright', { year: 2026, company: branding.companyName })} - {t('common:branding.secureAccess')}</p>
      </div>
    </div>
  );
}
