import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { pipelineApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Plus, Edit, Trash2, GripVertical, Save, FileText, CheckCircle,
  AlertCircle, Shield, PowerOff, Power, Clock, ArrowLeft,
} from 'lucide-react';

const COLORS: { label: string; value: string }[] = [
  { label: 'Blue',   value: '#2563EB' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Green',  value: '#22C55E' },
  { label: 'Orange', value: '#F59E0B' },
  { label: 'Red',    value: '#EF4444' },
  { label: 'Cyan',   value: '#06B6D4' },
  { label: 'Pink',   value: '#EC4899' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Gray',   value: '#64748B' },
];

interface Stage {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
  slaHours: number | null;
  requiresApproval: boolean;
  isFinal: boolean;
}

export function PipelineSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canDelete, canCreate } = usePermissions();

  const [pipeline, setPipeline] = useState<any>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pipeline metadata edit
  const [metaForm, setMetaForm] = useState({ name: '', description: '', color: '#2563EB', isDefault: false, isPublic: true });
  const [savingMeta, setSavingMeta] = useState(false);

  // Add Stage dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', color: '#2563EB', slaHours: '', requiresApproval: false, isFinal: false });
  const [addingStage, setAddingStage] = useState(false);

  // Edit Stage Requirements dialog
  const [isEditReqOpen, setIsEditReqOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [reqForm, setReqForm] = useState<{ name: string; description: string; color: string; slaHours: string; requiresApproval: boolean; isFinal: boolean }>({
    name: '', description: '', color: '#2563EB', slaHours: '', requiresApproval: false, isFinal: false,
  });
  const [savingReq, setSavingReq] = useState(false);

  const draggedId = useRef<string | null>(null);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await pipelineApi.get(id);
      setPipeline(data);
      setMetaForm({ name: data.name, description: data.description ?? '', color: data.color ?? '#2563EB', isDefault: data.isDefault, isPublic: data.isPublic });
      const mapped: Stage[] = (data.stages ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        color: s.color ?? '#6366F1',
        order: s.order,
        slaHours: s.slaHours ?? null,
        requiresApproval: s.requiresApproval ?? false,
        isFinal: s.isFinal ?? false,
      }));
      setStages(mapped);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ─── Add Stage ────────────────────────────────────────────────────────────

  const handleAddStage = async () => {
    if (!addForm.name.trim()) return;
    setAddingStage(true);
    try {
      const maxOrder = stages.reduce((m, s) => Math.max(m, s.order), 0);
      await pipelineApi.addStage(id!, {
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined,
        color: addForm.color,
        order: maxOrder + 1,
        slaHours: addForm.slaHours ? Number(addForm.slaHours) : undefined,
        requiresApproval: addForm.requiresApproval,
        isFinal: addForm.isFinal,
      });
      await load();
      setIsAddOpen(false);
      setAddForm({ name: '', description: '', color: '#2563EB', slaHours: '', requiresApproval: false, isFinal: false });
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create stage');
    } finally {
      setAddingStage(false);
    }
  };

  // ─── Delete Stage ─────────────────────────────────────────────────────────

  const handleDeleteStage = async (stageId: string, stageName: string) => {
    if (!confirm(`Delete the "${stageName}" stage? Candidates currently in this stage will lose their progress.`)) return;
    try {
      await pipelineApi.deleteStage(stageId);
      setStages(prev => prev.filter(s => s.id !== stageId).map((s, i) => ({ ...s, order: i + 1 })));
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete stage');
    }
  };

  // ─── Drag & Drop reorder ──────────────────────────────────────────────────

  const handleDragStart = (stageId: string) => { draggedId.current = stageId; };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId.current || draggedId.current === targetId) return;
    const fromIdx = stages.findIndex(s => s.id === draggedId.current);
    const toIdx = stages.findIndex(s => s.id === targetId);
    const next = [...stages];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    next.forEach((s, i) => { s.order = i + 1; });
    setStages(next);
  };

  const handleDragEnd = () => { draggedId.current = null; };

  // ─── Save order ───────────────────────────────────────────────────────────

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      await pipelineApi.reorderStages(id!, stages.map(s => s.id));
      alert('Stage order saved successfully.');
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  // ─── Save metadata ────────────────────────────────────────────────────────

  const handleSaveMeta = async () => {
    if (!metaForm.name.trim()) return;
    setSavingMeta(true);
    try {
      await pipelineApi.update(id!, metaForm);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save workflow details');
    } finally {
      setSavingMeta(false);
    }
  };

  // ─── Edit Stage dialog ────────────────────────────────────────────────────

  const openEditStage = (stage: Stage) => {
    setSelectedStage(stage);
    setReqForm({
      name: stage.name,
      description: stage.description,
      color: stage.color,
      slaHours: stage.slaHours?.toString() ?? '',
      requiresApproval: stage.requiresApproval,
      isFinal: stage.isFinal,
    });
    setIsEditReqOpen(true);
  };

  const handleSaveStage = async () => {
    if (!selectedStage || !reqForm.name.trim()) return;
    setSavingReq(true);
    try {
      await pipelineApi.updateStage(selectedStage.id, {
        name: reqForm.name.trim(),
        description: reqForm.description.trim() || undefined,
        color: reqForm.color,
        slaHours: reqForm.slaHours ? Number(reqForm.slaHours) : null,
        requiresApproval: reqForm.requiresApproval,
        isFinal: reqForm.isFinal,
      });
      await load();
      setIsEditReqOpen(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save stage');
    } finally {
      setSavingReq(false);
    }
  };

  // ─── Archive ──────────────────────────────────────────────────────────────

  const handleArchive = async () => {
    if (!confirm('Archive this workflow? No new candidates can be assigned but existing progress is preserved.')) return;
    try {
      await pipelineApi.archive(id!);
      navigate('/dashboard/pipelines');
    } catch {}
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="p-6">
        <div className="text-center py-10 text-[#EF4444]">{error ?? 'Workflow not found'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/dashboard/pipelines/${id}`)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link to="/dashboard/pipelines" className="hover:text-foreground transition-colors">Workflows</Link>
              <span>/</span>
              <Link to={`/dashboard/pipelines/${id}`} className="hover:text-foreground transition-colors">{pipeline.name}</Link>
              <span>/</span>
              <span className="text-foreground">Configuration</span>
            </div>
            <h1 className="text-3xl font-semibold text-[#0F172A]">Workflow Configuration</h1>
            <p className="text-muted-foreground mt-1">Configure stages and settings for <strong>{pipeline.name}</strong></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canEdit('settings') && (
            <Button variant="outline" onClick={handleSaveOrder} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving…' : 'Save Order'}
            </Button>
          )}
          {canCreate('settings') && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stage
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Stage</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="stageName">Stage Name</Label>
                    <Input id="stageName" placeholder="e.g., Document Collection" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="stageDesc">Description</Label>
                    <Input id="stageDesc" placeholder="Brief description" value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Stage Color</Label>
                    <Select value={addForm.color} onValueChange={v => setAddForm({ ...addForm, color: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stageSla">SLA (hours, optional)</Label>
                    <Input id="stageSla" type="number" min="1" placeholder="e.g., 48" value={addForm.slaHours} onChange={e => setAddForm({ ...addForm, slaHours: e.target.value })} className="mt-1.5" />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={addForm.requiresApproval} onChange={e => setAddForm({ ...addForm, requiresApproval: e.target.checked })} className="rounded" />
                      <span>Requires approval</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={addForm.isFinal} onChange={e => setAddForm({ ...addForm, isFinal: e.target.checked })} className="rounded" />
                      <span>Final stage</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddStage} disabled={addingStage || !addForm.name.trim()}>
                      {addingStage ? 'Adding…' : 'Add Stage'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Admin Warning */}
      <Card className="border-[#EF4444] bg-[#FEE2E2]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#EF4444] mt-0.5" />
            <div>
              <p className="font-medium text-[#EF4444]">System Administrator Access Only</p>
              <p className="text-sm text-muted-foreground mt-1">
                Changes here affect all candidates assigned to this workflow. All changes are logged.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drag & Drop info */}
      <Card className="border-[#2563EB] bg-[#EFF6FF]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#2563EB] mt-0.5" />
            <div>
              <p className="font-medium text-[#2563EB]">Drag and Drop to Reorder</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use the drag handle to reorder stages. Click "Save Order" to persist the new order.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Details */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wfName">Name *</Label>
              <Input id="wfName" value={metaForm.name} onChange={e => setMetaForm({ ...metaForm, name: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Color</Label>
              <Select value={metaForm.color} onValueChange={v => setMetaForm({ ...metaForm, color: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="wfDesc">Description</Label>
            <Input id="wfDesc" value={metaForm.description} onChange={e => setMetaForm({ ...metaForm, description: e.target.value })} className="mt-1.5" placeholder="Optional description…" />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={metaForm.isDefault} onChange={e => setMetaForm({ ...metaForm, isDefault: e.target.checked })} className="rounded" />
              <span>Set as default workflow</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={metaForm.isPublic} onChange={e => setMetaForm({ ...metaForm, isPublic: e.target.checked })} className="rounded" />
              <span>Public visibility</span>
            </label>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleSaveMeta} disabled={savingMeta}>
              <Save className="w-4 h-4 mr-2" />{savingMeta ? 'Saving…' : 'Save Details'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stages */}
      <Card>
        <CardHeader>
          <CardTitle>
            Workflow Stages ({stages.length} stage{stages.length !== 1 ? 's' : ''})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No stages configured. Click "Add Stage" to get started.</div>
          ) : (
            <div className="space-y-3">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  draggable
                  onDragStart={() => handleDragStart(stage.id)}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-[#F8FAFC] cursor-move transition-colors ${draggedId.current === stage.id ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-5 h-5 flex-shrink-0 text-muted-foreground" />

                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold" style={{ backgroundColor: stage.color }}>
                      {stage.order}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#0F172A]">{stage.name}</h3>
                        <Badge variant="outline" style={{ borderColor: stage.color, color: stage.color }}>
                          Stage {stage.order}
                        </Badge>
                        {stage.isFinal && (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50">Final</Badge>
                        )}
                      </div>
                      {stage.description && <p className="text-sm text-muted-foreground mb-2">{stage.description}</p>}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {stage.slaHours && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{stage.slaHours}h SLA</span>
                          </div>
                        )}
                        {stage.requiresApproval && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Requires approval</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit('settings') && (
                      <Button size="sm" variant="outline" onClick={() => openEditStage(stage)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Edit Stage
                      </Button>
                    )}
                    {canDelete('settings') && (
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteStage(stage.id, stage.name)}>
                        <Trash2 className="w-4 h-4 text-[#EF4444]" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Stage Dialog */}
      <Dialog open={isEditReqOpen} onOpenChange={setIsEditReqOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Stage — {selectedStage?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Stage Name</Label>
              <Input value={reqForm.name} onChange={e => setReqForm({ ...reqForm, name: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} className="mt-1.5" placeholder="Brief description…" />
            </div>
            <div>
              <Label>Stage Color</Label>
              <Select value={reqForm.color} onValueChange={v => setReqForm({ ...reqForm, color: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SLA (hours, optional)</Label>
              <Input type="number" min="1" placeholder="e.g., 48" value={reqForm.slaHours} onChange={e => setReqForm({ ...reqForm, slaHours: e.target.value })} className="mt-1.5" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={reqForm.requiresApproval} onChange={e => setReqForm({ ...reqForm, requiresApproval: e.target.checked })} className="rounded" />
                <span>Requires approval</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={reqForm.isFinal} onChange={e => setReqForm({ ...reqForm, isFinal: e.target.checked })} className="rounded" />
                <span>Final stage</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsEditReqOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveStage} disabled={savingReq || !reqForm.name.trim()}>
                {savingReq ? 'Saving…' : 'Save Stage'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Danger Zone */}
      <Card className="border-[#EF4444]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#EF4444]">
            <AlertCircle className="w-4 h-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[#0F172A]">Archive Workflow</p>
              <p className="text-sm text-muted-foreground">No new candidates can be assigned. Existing progress is preserved.</p>
            </div>
            <Button variant="outline" className="border-[#EF4444]/50 text-[#EF4444] hover:bg-[#FEE2E2]" onClick={handleArchive}>
              Archive Workflow
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
