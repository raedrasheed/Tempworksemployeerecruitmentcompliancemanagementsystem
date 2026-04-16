import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Shield, Lock, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { settingsApi } from '../../services/api';

const LOCKOUT_SETTING_KEY = 'MAX_LOGIN_ATTEMPTS';
const DEFAULT_MAX_ATTEMPTS = 3;

function findSettingValue(grouped: Record<string, any[]> | null, key: string): string | null {
  if (!grouped) return null;
  for (const category of Object.values(grouped)) {
    const found = (category as any[]).find(s => s.key === key);
    if (found) return found.value ?? null;
  }
  return null;
}

export function SecuritySettings() {
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [maxAttempts, setMaxAttempts]   = useState<string>(String(DEFAULT_MAX_ATTEMPTS));
  const [initialValue, setInitialValue] = useState<string>(String(DEFAULT_MAX_ATTEMPTS));

  useEffect(() => {
    settingsApi.getAll(true)
      .then((grouped) => {
        const raw = findSettingValue(grouped, LOCKOUT_SETTING_KEY);
        const value = raw ?? String(DEFAULT_MAX_ATTEMPTS);
        setMaxAttempts(value);
        setInitialValue(value);
      })
      .catch(() => toast.error('Failed to load security settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveLockout = async () => {
    const n = parseInt(maxAttempts, 10);
    if (isNaN(n) || n < 1 || n > 20) {
      toast.error('Please enter a number between 1 and 20');
      return;
    }
    setSaving(true);
    try {
      await settingsApi.update({ [LOCKOUT_SETTING_KEY]: String(n) });
      setInitialValue(String(n));
      toast.success('Lockout threshold updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const dirty = maxAttempts !== initialValue;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/settings"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Security Settings</h1>
          <p className="text-muted-foreground mt-1">Manage security and access control</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#2563EB]" />
            <CardTitle>Account Lockout</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="max-attempts">Lock account after N failed login attempts</Label>
            <div className="flex items-center gap-3">
              <Input
                id="max-attempts"
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                disabled={loading || saving}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">failed attempts</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Locked accounts are automatically released after 30 minutes. An administrator
              can unlock earlier from the user's edit page.
            </p>
          </div>
          <Button onClick={handleSaveLockout} disabled={loading || saving || !dirty}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save threshold
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="2fa">Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
            </div>
            <Switch id="2fa" defaultChecked />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Session Timeout</Label>
            <Select defaultValue="30">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ip-restriction">IP Address Restriction</Label>
              <p className="text-sm text-muted-foreground">Restrict access by IP address</p>
            </div>
            <Switch id="ip-restriction" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="audit-log">Audit Logging</Label>
              <p className="text-sm text-muted-foreground">Log all user activities</p>
            </div>
            <Switch id="audit-log" defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#EFF6FF] border-[#2563EB]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#2563EB]" />
            <CardTitle>Security Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your system security is configured correctly. Last security audit: March 1, 2026
          </p>
        </CardContent>
      </Card>
    </div>
  );
}