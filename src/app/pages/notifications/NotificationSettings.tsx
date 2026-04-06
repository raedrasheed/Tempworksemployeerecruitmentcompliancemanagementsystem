import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Save, Loader2, Bell, Mail, MessageSquare, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { notificationsApi } from '../../services/api';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChannelPrefs {
  in_app: boolean;
  email:  boolean;
  sms:    boolean;
}

interface EventMeta {
  key:         string;
  label:       string;
  description: string;
  category:    string;
}

// ── Channel header cell ───────────────────────────────────────────────────────

function ChannelHeader({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[72px]">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationSettings() {
  const [meta, setMeta]     = useState<EventMeta[]>([]);
  const [prefs, setPrefs]   = useState<Record<string, ChannelPrefs>>({});
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [dirty,   setDirty]     = useState(false);

  useEffect(() => {
    notificationsApi.getPreferences()
      .then((data: any) => {
        const { meta: m, ...rest } = data;
        setMeta(Array.isArray(m) ? m : []);
        // rest keys are event type strings mapped to ChannelPrefs
        const prefMap: Record<string, ChannelPrefs> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (k !== 'meta' && typeof v === 'object' && v !== null) {
            prefMap[k] = v as ChannelPrefs;
          }
        }
        setPrefs(prefMap);
      })
      .catch(() => toast.error('Failed to load notification preferences'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (eventKey: string, channel: 'in_app' | 'email') => {
    setPrefs(prev => ({
      ...prev,
      [eventKey]: {
        ...(prev[eventKey] ?? { in_app: true, email: false, sms: false }),
        [channel]: !(prev[eventKey]?.[channel] ?? false),
      },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsApi.updatePreferences(prefs);
      setDirty(false);
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Group meta by category
  const categories = [...new Set(meta.map(m => m.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/notifications"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Notification Settings</h1>
          <p className="text-muted-foreground mt-1">Choose what you get notified about and how</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>In-App</strong> — shown in your Notifications inbox.&nbsp;
            <strong>Email</strong> — sent to your account email.&nbsp;
            <strong>SMS</strong> — not yet available (coming soon).
          </div>
        </CardContent>
      </Card>

      {/* Matrix */}
      {categories.map(category => {
        const items = meta.filter(m => m.category === category);
        return (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{category} Notifications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Column headers */}
              <div className="flex items-center border-b px-6 py-3 bg-muted/30">
                <div className="flex-1" />
                <div className="flex items-center gap-6">
                  <ChannelHeader icon={<Bell className="w-4 h-4" />} label="In-App" />
                  <ChannelHeader icon={<Mail className="w-4 h-4" />} label="Email" />
                  <ChannelHeader
                    icon={<MessageSquare className="w-4 h-4 opacity-40" />}
                    label="SMS"
                    sub="Soon"
                  />
                </div>
              </div>

              {/* Rows */}
              {items.map((evt, idx) => {
                const p = prefs[evt.key] ?? { in_app: true, email: false, sms: false };
                return (
                  <div key={evt.key}>
                    <div className="flex items-center px-6 py-4">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-medium">{evt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        {/* In-App toggle */}
                        <div className="min-w-[72px] flex justify-center">
                          <Switch
                            checked={p.in_app}
                            onCheckedChange={() => toggle(evt.key, 'in_app')}
                          />
                        </div>
                        {/* Email toggle */}
                        <div className="min-w-[72px] flex justify-center">
                          <Switch
                            checked={p.email}
                            onCheckedChange={() => toggle(evt.key, 'email')}
                          />
                        </div>
                        {/* SMS — always disabled */}
                        <div className="min-w-[72px] flex justify-center">
                          <Switch checked={false} disabled />
                        </div>
                      </div>
                    </div>
                    {idx < items.length - 1 && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Empty state */}
      {meta.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No notification types configured.</p>
        </div>
      )}

      {/* Save footer */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <div className="bg-card border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">You have unsaved changes</span>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
