import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { usersApi, getCurrentUser } from '../../services/api';

export function UserPreferences() {
  const currentUser = getCurrentUser();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    language: 'en',
    timezone: 'UTC',
    emailNotifications: true,
    inAppNotifications: true,
    documentExpiryAlerts: true,
    workflowUpdates: false,
  });

  useEffect(() => {
    if (!currentUser) return;
    // Pre-populate from current user preferences if available
    const prefs = (currentUser as any).preferences;
    if (prefs) {
      setForm(prev => ({
        ...prev,
        language: prefs.language ?? prev.language,
        timezone: prefs.timezone ?? prev.timezone,
        emailNotifications: prefs.emailNotifications ?? prev.emailNotifications,
        inAppNotifications: prefs.inAppNotifications ?? prev.inAppNotifications,
        documentExpiryAlerts: prefs.documentExpiryAlerts ?? prev.documentExpiryAlerts,
        workflowUpdates: prefs.workflowUpdates ?? prev.workflowUpdates,
      }));
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersApi.updatePreferences(form);
      toast.success('Preferences saved successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

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
              <CardTitle>Regional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Preferred Language</Label>
                <Select value={form.language} onValueChange={val => setForm(prev => ({ ...prev, language: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="pl">Polish</SelectItem>
                    <SelectItem value="cs">Czech</SelectItem>
                    <SelectItem value="ro">Romanian</SelectItem>
                    <SelectItem value="bg">Bulgarian</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Time Zone</Label>
                <Select value={form.timezone} onValueChange={val => setForm(prev => ({ ...prev, timezone: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Europe/Warsaw">Europe/Warsaw</SelectItem>
                    <SelectItem value="Europe/Prague">Europe/Prague</SelectItem>
                    <SelectItem value="Europe/Bucharest">Europe/Bucharest</SelectItem>
                    <SelectItem value="Europe/Sofia">Europe/Sofia</SelectItem>
                    <SelectItem value="Asia/Riyadh">Asia/Riyadh</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
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
              {[
                { key: 'emailNotifications', label: 'Email notifications', description: 'Receive notifications via email' },
                { key: 'inAppNotifications', label: 'In-app notifications', description: 'Show notifications within the platform' },
                { key: 'documentExpiryAlerts', label: 'Document expiry alerts', description: 'Get alerted when documents are about to expire' },
                { key: 'workflowUpdates', label: 'Workflow updates', description: 'Receive updates on workflow stage changes' },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-start gap-3">
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
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8]" disabled={saving}>
              {saving ? 'Saving...' : 'Save Preferences'}
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
