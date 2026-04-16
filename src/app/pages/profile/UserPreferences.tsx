import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { toast } from 'sonner';
import { usersApi } from '../../services/api';

const NOTIFICATION_OPTIONS = [
  { key: 'emailNotifications', label: 'Email notifications', description: 'Receive notifications via email' },
  { key: 'inAppNotifications', label: 'In-app notifications', description: 'Show notifications within the platform' },
  { key: 'documentExpiryAlerts', label: 'Document expiry alerts', description: 'Get alerted when documents are about to expire' },
  { key: 'complianceAlerts', label: 'Compliance alerts', description: 'Notifications about compliance issues' },
  { key: 'taskReminders', label: 'Task reminders', description: 'Reminders for pending tasks and actions' },
  { key: 'workflowUpdates', label: 'Workflow updates', description: 'Receive updates on workflow stage changes' },
  { key: 'systemUpdates', label: 'System updates', description: 'Information about platform updates and maintenance' },
];

export function UserPreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    preferredLanguage: 'English',
    timeZone: 'Europe/London',
    emailNotifications: true,
    inAppNotifications: true,
    documentExpiryAlerts: true,
    complianceAlerts: true,
    taskReminders: true,
    workflowUpdates: false,
    systemUpdates: false,
  });

  useEffect(() => {
    usersApi.me()
      .then((user: any) => {
        setForm(prev => ({
          ...prev,
          preferredLanguage: user.preferredLanguage ?? prev.preferredLanguage,
          timeZone: user.timeZone ?? prev.timeZone,
          ...(user.notificationPreferences ?? {}),
        }));
      })
      .catch(() => toast.error('Failed to load preferences'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { preferredLanguage, timeZone, ...notificationPreferences } = form;
      await usersApi.updatePreferences({ preferredLanguage, timeZone, notificationPreferences });
      toast.success('Preferences saved successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/profile"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Preferences</h1>
          <p className="text-muted-foreground mt-1">Manage your language, timezone, and notification settings</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Localisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Preferred Language</Label>
                <Select value={form.preferredLanguage} onValueChange={val => setForm(prev => ({ ...prev, preferredLanguage: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Arabic">Arabic (العربية)</SelectItem>
                    <SelectItem value="Polish">Polish (Polski)</SelectItem>
                    <SelectItem value="German">German (Deutsch)</SelectItem>
                    <SelectItem value="French">French (Français)</SelectItem>
                    <SelectItem value="Spanish">Spanish (Español)</SelectItem>
                    <SelectItem value="Italian">Italian (Italiano)</SelectItem>
                    <SelectItem value="Romanian">Romanian (Română)</SelectItem>
                    <SelectItem value="Ukrainian">Ukrainian (Українська)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Time Zone</Label>
                <Select value={form.timeZone} onValueChange={val => setForm(prev => ({ ...prev, timeZone: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Warsaw">Warsaw (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Berlin">Berlin (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Madrid">Madrid (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Rome">Rome (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Bucharest">Bucharest (EET/EEST)</SelectItem>
                    <SelectItem value="Europe/Kiev">Kyiv (EET/EEST)</SelectItem>
                    <SelectItem value="America/New_York">New York (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Chicago (CT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Los Angeles (PT)</SelectItem>
                    <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                    <SelectItem value="Asia/Riyadh">Riyadh (AST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-[#0F172A] mb-3">Channels</h4>
                {NOTIFICATION_OPTIONS.slice(0, 2).map(({ key, label, description }) => (
                  <div key={key} className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      id={key}
                      checked={form[key as keyof typeof form] as boolean}
                      onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div>
                      <label htmlFor={key} className="text-sm font-medium cursor-pointer">{label}</label>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-[#0F172A] mb-3">Notification Types</h4>
                {NOTIFICATION_OPTIONS.slice(2).map(({ key, label, description }) => (
                  <div key={key} className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      id={key}
                      checked={form[key as keyof typeof form] as boolean}
                      onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div>
                      <label htmlFor={key} className="text-sm font-medium cursor-pointer">{label}</label>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8]" disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Preferences'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard/profile">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
