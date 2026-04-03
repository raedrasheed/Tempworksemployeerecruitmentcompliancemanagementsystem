import { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, Pencil, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { vehiclesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

type MType = {
  id: string; name: string; description?: string;
  defaultIntervalDays?: number; defaultIntervalKm?: number; isActive: boolean;
};
type MForm = { name: string; description: string; defaultIntervalDays: string; defaultIntervalKm: string };
const EMPTY_FORM: MForm = { name: '', description: '', defaultIntervalDays: '', defaultIntervalKm: '' };

export function MaintenanceTypesList() {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('vehicles:write');

  const [types, setTypes]     = useState<MType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog]   = useState(false);
  const [editing, setEditing] = useState<MType | null>(null);
  const [form, setForm]       = useState<MForm>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTypes(await vehiclesApi.listMaintenanceTypes()); }
    catch { toast.error('Failed to load maintenance types'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditing(null); setForm(EMPTY_FORM); setDialog(true); };
  const openEdit = (t: MType) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? '',
      defaultIntervalDays: t.defaultIntervalDays ? String(t.defaultIntervalDays) : '',
      defaultIntervalKm:   t.defaultIntervalKm   ? String(t.defaultIntervalKm)   : '',
    });
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      const data: any = {
        name: form.name.trim(),
        description: form.description || undefined,
        defaultIntervalDays: form.defaultIntervalDays ? parseInt(form.defaultIntervalDays) : undefined,
        defaultIntervalKm:   form.defaultIntervalKm   ? parseInt(form.defaultIntervalKm)   : undefined,
      };
      if (editing) {
        await vehiclesApi.updateMaintenanceType(editing.id, data);
        toast.success('Updated');
      } else {
        await vehiclesApi.createMaintenanceType(data);
        toast.success('Created');
      }
      setDialog(false);
      load();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this maintenance type?')) return;
    try { await vehiclesApi.deleteMaintenanceType(id); toast.success('Deactivated'); load(); }
    catch { toast.error('Failed'); }
  };

  const set = (k: keyof MForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Maintenance Types
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Configure service types and default intervals</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Add Type
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Interval (Days)</TableHead>
                <TableHead>Interval (km)</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : types.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No maintenance types configured</TableCell></TableRow>
              ) : types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.description ?? '—'}</TableCell>
                  <TableCell className="text-sm">{t.defaultIntervalDays ? `${t.defaultIntervalDays} days` : '—'}</TableCell>
                  <TableCell className="text-sm">{t.defaultIntervalKm ? `${t.defaultIntervalKm.toLocaleString()} km` : '—'}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Maintenance Type' : 'Add Maintenance Type'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Oil Change" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Default Interval (days)</Label>
                <Input type="number" value={form.defaultIntervalDays} onChange={(e) => set('defaultIntervalDays', e.target.value)} placeholder="e.g. 365" min={1} />
              </div>
              <div className="space-y-1">
                <Label>Default Interval (km)</Label>
                <Input type="number" value={form.defaultIntervalKm} onChange={(e) => set('defaultIntervalKm', e.target.value)} placeholder="e.g. 10000" min={1} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
