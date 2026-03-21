import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, GripVertical, Save, FileText, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { settingsApi, rolesApi } from '../../services/api';

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
  requirementsDocuments: string[];
  requirementsActions: string[];
  requirementsApprovals: string[];
}

interface RequirementsState {
  documents: string[];
  actions: string[];
  approvals: string[];
}

export function WorkflowConfiguration() {
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [isEditRequirementsOpen, setIsEditRequirementsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(null);
  const [requirements, setRequirements] = useState<RequirementsState>({ documents: [], actions: [], approvals: [] });
  const [savingReqs, setSavingReqs] = useState(false);

  const [newStageName, setNewStageName] = useState('');
  const [newStageDescription, setNewStageDescription] = useState('');
  const [newStageColor, setNewStageColor] = useState('#2563EB');
  const [addingStage, setAddingStage] = useState(false);

  // New item inputs (selected from dropdowns)
  const [newDocument, setNewDocument] = useState('');
  const [newApproval, setNewApproval] = useState('');

  // Available options for dropdowns
  const [documentTypes, setDocumentTypes] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  const draggedId = useRef<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadStages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsApi.getWorkflowStages();
      setStages(
        (data ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description ?? '',
          color: s.color ?? '#2563EB',
          order: s.order,
          requirementsDocuments: s.requirementsDocuments ?? [],
          requirementsActions: s.requirementsActions ?? [],
          requirementsApprovals: s.requirementsApprovals ?? [],
        })),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load workflow stages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStages(); }, []);

  // ─── Add stage ─────────────────────────────────────────────────────────────
  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    setAddingStage(true);
    try {
      const created = await settingsApi.createWorkflowStage({
        name: newStageName.trim(),
        description: newStageDescription.trim(),
        color: newStageColor,
      });
      setStages(prev => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          description: created.description ?? '',
          color: created.color ?? newStageColor,
          order: created.order,
          requirementsDocuments: [],
          requirementsActions: [],
          requirementsApprovals: [],
        },
      ]);
      setIsAddStageOpen(false);
      setNewStageName('');
      setNewStageDescription('');
      setNewStageColor('#2563EB');
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create stage');
    } finally {
      setAddingStage(false);
    }
  };

  // ─── Delete stage ──────────────────────────────────────────────────────────
  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage? This will affect all employees currently in this stage.')) return;
    try {
      await settingsApi.deleteWorkflowStage(stageId);
      setStages(prev => prev.filter(s => s.id !== stageId).map((s, i) => ({ ...s, order: i + 1 })));
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete stage');
    }
  };

  // ─── Drag and drop ─────────────────────────────────────────────────────────
  const handleDragStart = (stageId: string) => {
    draggedId.current = stageId;
  };

  const handleDragOver = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    if (!draggedId.current || draggedId.current === targetStageId) return;

    const draggedIndex = stages.findIndex(s => s.id === draggedId.current);
    const targetIndex = stages.findIndex(s => s.id === targetStageId);
    const newStages = [...stages];
    const [removed] = newStages.splice(draggedIndex, 1);
    newStages.splice(targetIndex, 0, removed);
    newStages.forEach((stage, index) => { stage.order = index + 1; });
    setStages(newStages);
  };

  const handleDragEnd = () => {
    draggedId.current = null;
  };

  // ─── Save order ────────────────────────────────────────────────────────────
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      await settingsApi.reorderWorkflowStages(stages.map(s => ({ id: s.id, order: s.order })));
      alert('Workflow configuration saved successfully.');
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit requirements ─────────────────────────────────────────────────────
  const openRequirementsEditor = async (stage: WorkflowStage) => {
    setSelectedStage(stage);
    setRequirements({
      documents: [...stage.requirementsDocuments],
      actions: [...stage.requirementsActions],
      approvals: [...stage.requirementsApprovals],
    });
    setNewDocument('');
    setNewApproval('');
    setIsEditRequirementsOpen(true);

    // Fetch dropdown data
    try {
      const [docTypes, rolesList] = await Promise.all([
        settingsApi.getDocumentTypes(),
        rolesApi.list(),
      ]);
      setDocumentTypes((docTypes ?? []).map((d: any) => ({ id: d.id, name: d.name })));
      setRoles((rolesList ?? []).map((r: any) => ({ id: r.id, name: r.name })));
    } catch {
      // silently fall back to empty lists
    }
  };

  const handleSaveRequirements = async () => {
    if (!selectedStage) return;
    setSavingReqs(true);
    try {
      await settingsApi.updateWorkflowStage(selectedStage.id, {
        requirementsDocuments: requirements.documents,
        requirementsActions: requirements.actions,
        requirementsApprovals: requirements.approvals,
      });
      setStages(prev =>
        prev.map(s =>
          s.id === selectedStage.id
            ? {
                ...s,
                requirementsDocuments: requirements.documents,
                requirementsActions: requirements.actions,
                requirementsApprovals: requirements.approvals,
              }
            : s,
        ),
      );
      setIsEditRequirementsOpen(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save requirements');
    } finally {
      setSavingReqs(false);
    }
  };

  // ─── Requirements helpers ──────────────────────────────────────────────────
  const addItem = (type: keyof RequirementsState, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRequirements(prev => ({ ...prev, [type]: [...prev[type], trimmed] }));
  };

  const removeItem = (type: keyof RequirementsState, index: number) => {
    setRequirements(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const updateItem = (type: keyof RequirementsState, index: number, value: string) => {
    setRequirements(prev => {
      const arr = [...prev[type]];
      arr[index] = value;
      return { ...prev, [type]: arr };
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Workflow Configuration</h1>
          <p className="text-muted-foreground mt-1">Configure recruitment workflow stages and requirements</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSaveChanges} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Stage
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Workflow Stage</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="stageName">Stage Name</Label>
                  <Input
                    id="stageName"
                    placeholder="e.g., Background Check"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="stageDescription">Description</Label>
                  <Input
                    id="stageDescription"
                    placeholder="Brief description of this stage"
                    value={newStageDescription}
                    onChange={(e) => setNewStageDescription(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="stageColor">Stage Color</Label>
                  <Select value={newStageColor} onValueChange={setNewStageColor}>
                    <SelectTrigger id="stageColor" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="#2563EB">Blue</SelectItem>
                      <SelectItem value="#22C55E">Green</SelectItem>
                      <SelectItem value="#F59E0B">Orange</SelectItem>
                      <SelectItem value="#EF4444">Red</SelectItem>
                      <SelectItem value="#8B5CF6">Purple</SelectItem>
                      <SelectItem value="#EC4899">Pink</SelectItem>
                      <SelectItem value="#06B6D4">Cyan</SelectItem>
                      <SelectItem value="#64748B">Gray</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddStageOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddStage} disabled={addingStage || !newStageName.trim()}>
                    {addingStage ? 'Adding…' : 'Add Stage'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
                Changes made here will affect the entire recruitment workflow. Only System Administrators can modify workflow configuration. All changes will be logged.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Card className="border-[#2563EB] bg-[#EFF6FF]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#2563EB] mt-0.5" />
            <div>
              <p className="font-medium text-[#2563EB]">Drag and Drop to Reorder</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use the drag handle to reorder workflow stages. Click "Save Changes" to persist the new order.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Stages ({stages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading stages…</div>
          ) : error ? (
            <div className="text-center py-10 text-[#EF4444]">{error}</div>
          ) : stages.length === 0 ? (
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
                  className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-move ${
                    draggedId.current === stage.id ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />

                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: stage.color }}
                    >
                      {stage.order}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#0F172A]">{stage.name}</h3>
                        <Badge variant="outline" style={{ borderColor: stage.color, color: stage.color }}>
                          Stage {stage.order}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{stage.description}</p>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>{stage.requirementsDocuments.length} documents</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-muted-foreground" />
                          <span>{stage.requirementsActions.length} actions</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                          <span>{stage.requirementsApprovals.length} approvals</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRequirementsEditor(stage)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Requirements
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteStage(stage.id)}
                    >
                      <Trash2 className="w-4 h-4 text-[#EF4444]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage Requirements Editor Dialog */}
      <Dialog open={isEditRequirementsOpen} onOpenChange={setIsEditRequirementsOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit Stage Requirements - {selectedStage?.name}</DialogTitle>
          </DialogHeader>
          {selectedStage && (
            <div className="space-y-6 pt-4">
              {/* Required Documents */}
              <div>
                <Label>Required Documents</Label>
                <div className="space-y-2 mt-2">
                  {requirements.documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 border rounded-md bg-muted/40 text-sm">{doc}</div>
                      <Button size="sm" variant="ghost" onClick={() => removeItem('documents', idx)}>
                        <Trash2 className="w-4 h-4 text-[#EF4444]" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Select value={newDocument} onValueChange={setNewDocument}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a document type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.length === 0 ? (
                          <SelectItem value="__none__" disabled>No document types configured</SelectItem>
                        ) : (
                          documentTypes
                            .filter(dt => !requirements.documents.includes(dt.name))
                            .map(dt => (
                              <SelectItem key={dt.id} value={dt.name}>{dt.name}</SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { addItem('documents', newDocument); setNewDocument(''); }}
                      disabled={!newDocument || newDocument === '__none__'}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Document
                    </Button>
                  </div>
                </div>
              </div>

              {/* Required Approvals */}
              <div>
                <Label>Required Approvals</Label>
                <div className="space-y-2 mt-2">
                  {requirements.approvals.map((approval, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 border rounded-md bg-muted/40 text-sm">{approval}</div>
                      <Button size="sm" variant="ghost" onClick={() => removeItem('approvals', idx)}>
                        <Trash2 className="w-4 h-4 text-[#EF4444]" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Select value={newApproval} onValueChange={setNewApproval}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.length === 0 ? (
                          <SelectItem value="__none__" disabled>No roles configured</SelectItem>
                        ) : (
                          roles
                            .filter(r => !requirements.approvals.includes(r.name))
                            .map(r => (
                              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { addItem('approvals', newApproval); setNewApproval(''); }}
                      disabled={!newApproval || newApproval === '__none__'}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Approval
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditRequirementsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRequirements} disabled={savingReqs}>
                  {savingReqs ? 'Saving…' : 'Save Requirements'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
