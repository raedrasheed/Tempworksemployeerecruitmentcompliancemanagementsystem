import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { settingsApi } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';

const DEFAULTS = ['International', 'Domestic', 'Bilateral', 'Cabotage', 'Hazardous', 'Refrigerated'];

export function TransportTypesSettings() {
  const { canEdit } = usePermissions();
  const isAdmin = canEdit('settings');
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.getAll().then((res: any) => {
      const arr: any[] = Array.isArray(res.form) ? res.form : [];
      const found = arr.find((i: any) => i.key === 'form.transportTypes');
      if (found) {
        try { setItems(JSON.parse(found.value)); } catch { setItems(DEFAULTS); }
      } else {
        setItems(DEFAULTS);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const add = () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems(prev => [...prev, trimmed]);
    setNewItem('');
  };

  const remove = (item: string) => setItems(prev => prev.filter(i => i !== item));

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update({ 'form.transportTypes': JSON.stringify(items) });
      toast.success('Transport Types saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <div className="text-center py-16 text-muted-foreground">Access denied.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/settings"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Transport Types</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage the transport types shown in the Driving Experience step</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Type</CardTitle>
          <CardDescription>New types will appear as checkboxes in the Transport Types section</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Oversized Load"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <Button onClick={add} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current Types ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">No types defined yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item} className="flex items-center justify-between px-3 py-2 border rounded-lg">
                  <span className="text-sm">{item}</span>
                  <button type="button" onClick={() => remove(item)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
