import { useState, useEffect, useCallback } from 'react';
import { Plus, Wrench, Pencil, Trash2, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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

type Workshop = {
  id: string; name: string; contactName?: string; phone?: string; email?: string;
  address?: string; city?: string; country?: string; notes?: string; isActive: boolean;
};

type WForm = Omit<Workshop, 'id' | 'isActive'>;
const EMPTY_FORM: WForm = { name: '', contactName: '', phone: '', email: '', address: '', city: '', country: '', notes: '' };

export function WorkshopsList() {
  const { canCreate } = usePermissions();
  const canWrite = canCreate('vehicles');

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dialog, setDialog]       = useState(false);
  const [editing, setEditing]     = useState<Workshop | null>(null);
  const [form, setForm]           = useState<WForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await vehiclesApi.listWorkshops();
      setWorkshops(ws);
    } catch {
      toast.error('Failed to load workshops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setDialog(true); };
  const openEdit = (w: Workshop) => {
    setEditing(w);
    setForm({ name: w.name, contactName: w.contactName ?? '', phone: w.phone ?? '', email: w.email ?? '', address: w.address ?? '', city: w.city ?? '', country: w.country ?? '', notes: w.notes ?? '' });
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Workshop name required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await vehiclesApi.updateWorkshop(editing.id, form);
        toast.success('Workshop updated');
      } else {
        await vehiclesApi.createWorkshop(form);
        toast.success('Workshop created');
      }
      setDialog(false);
      load();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workshop?')) return;
    try {
      await vehiclesApi.deleteWorkshop(id);
      toast.success('Workshop deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const set = (key: keyof WForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            Workshop Register
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage garages and service centres used for vehicle maintenance</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Add Workshop
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Country</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : workshops.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No workshops registered yet</TableCell></TableRow>
              ) : workshops.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-sm">{w.contactName ?? '—'}</TableCell>
                  <TableCell className="text-sm">{w.phone ?? '—'}</TableCell>
                  <TableCell className="text-sm">{w.email ?? '—'}</TableCell>
                  <TableCell className="text-sm">{w.city ?? '—'}</TableCell>
                  <TableCell className="text-sm">{w.country ?? '—'}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(w)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(w.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Workshop' : 'Add Workshop'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Workshop Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. City Truck Services Ltd" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 ..." />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="service@example.com" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="UK" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional info" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Workshop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
