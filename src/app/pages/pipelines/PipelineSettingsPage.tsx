import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { pipelineApi } from '../../services/api';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  CheckSquare,
  Clock,
  Save,
  AlertTriangle,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#BE185D', '#374151', '#6366F1', '#F59E0B'];

// ─── Stage Form ───────────────────────────────────────────────────────────────

function StageRow({
  stage,
  onSave,
  onDelete,
}: {
  stage: any;
  onSave: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(!stage.id); // new stages start expanded
  const [form, setForm] = useState({
    name: stage.name ?? '',
    description: stage.description ?? '',
    color: stage.color ?? '#6366F1',
    slaHours: stage.slaHours ?? '',
    requiresApproval: stage.requiresApproval ?? false,
    isFinal: stage.isFinal ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(stage.id, { ...form, slaHours: form.slaHours ? Number(form.slaHours) : null });
      setExpanded(false);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete stage "${stage.name || 'this stage'}"?`)) return;
    setDeleting(true);
    try {
      await onDelete(stage.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`border rounded-xl transition-all ${expanded ? 'border-primary/40 shadow-sm' : 'border-border'}`}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab" />
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: form.color }} />
        <span className="text-sm font-medium text-foreground flex-1">{form.name || <span className="text-muted-foreground italic">Unnamed stage</span>}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {form.requiresApproval && <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded"><CheckSquare className="w-3 h-3" /> Approval</span>}
          {form.slaHours && <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded"><Clock className="w-3 h-3" /> {form.slaHours}h SLA</span>}
          {form.isFinal && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">Final</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Stage Name *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Document Collection"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">SLA (hours)</label>
              <input
                type="number"
                min="1"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.slaHours}
                onChange={(e) => setForm({ ...form, slaHours: e.target.value })}
                placeholder="e.g. 48"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What happens in this stage..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-6 h-6 rounded-full border-2 transition-transform"
                  style={{ background: c, borderColor: form.color === c ? '#000' : 'transparent', transform: form.color === c ? 'scale(1.25)' : 'scale(1)' }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} className="rounded" />
              <span className="text-foreground">Requires approval</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isFinal} onChange={(e) => setForm({ ...form, isFinal: e.target.checked })} className="rounded" />
              <span className="text-foreground">Final stage (completes assignment)</span>
            </label>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Deleting...' : 'Delete stage'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline Metadata Form ───────────────────────────────────────────────────

function PipelineMetaForm({ pipeline, onSaved }: { pipeline: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: pipeline.name ?? '',
    description: pipeline.description ?? '',
    isDefault: pipeline.isDefault ?? false,
    isPublic: pipeline.isPublic ?? true,
    color: pipeline.color ?? '#2563EB',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await pipelineApi.update(pipeline.id, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-foreground">Pipeline Details</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
        <input
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, color: c })}
              className="w-6 h-6 rounded-full border-2 transition-transform"
              style={{ background: c, borderColor: form.color === c ? '#000' : 'transparent', transform: form.color === c ? 'scale(1.25)' : 'scale(1)' }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded" />
          <span className="text-foreground flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" /> Set as default pipeline</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="rounded" />
          <span className="text-foreground">Public visibility</span>
        </label>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${saved ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PipelineSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStageOrder, setNewStageOrder] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await pipelineApi.get(id);
      setPipeline(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSaveStage = async (stageId: string, data: any) => {
    if (stageId) {
      await pipelineApi.updateStage(stageId, data);
    } else {
      await pipelineApi.addStage(id!, { ...data, order: data.order ?? newStageOrder });
      setNewStageOrder(null);
    }
    await load();
  };

  const handleDeleteStage = async (stageId: string) => {
    await pipelineApi.deleteStage(stageId);
    await load();
  };

  const addNewStage = () => {
    const maxOrder = pipeline?.stages?.reduce((m: number, s: any) => Math.max(m, s.order), 0) ?? 0;
    setNewStageOrder(maxOrder + 1);
  };

  const handleArchive = async () => {
    if (!confirm('Archive this pipeline? Candidates will no longer be assignable to it.')) return;
    try {
      await pipelineApi.archive(id!);
      navigate('/dashboard/pipelines');
    } catch {}
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error || 'Pipeline not found'}</div>
      </div>
    );
  }

  const stages = pipeline.stages ?? [];

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Nav */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard/pipelines" className="hover:text-foreground transition-colors">Pipelines</Link>
        <span>/</span>
        <Link to={`/dashboard/pipelines/${id}`} className="hover:text-foreground transition-colors">{pipeline.name}</Link>
        <span>/</span>
        <span className="text-foreground">Settings</span>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/dashboard/pipelines/${id}`)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pipeline Settings</h1>
          <p className="text-sm text-muted-foreground">{pipeline.name}</p>
        </div>
      </div>

      {/* Metadata */}
      <PipelineMetaForm pipeline={pipeline} onSaved={load} />

      {/* Stages */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Stages</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Define the steps candidates move through in this pipeline</p>
          </div>
          <button
            onClick={addNewStage}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Stage
          </button>
        </div>

        <div className="space-y-2">
          {stages.map((s: any) => (
            <StageRow
              key={s.id}
              stage={s}
              onSave={handleSaveStage}
              onDelete={handleDeleteStage}
            />
          ))}

          {/* New stage (pending save) */}
          {newStageOrder !== null && (
            <StageRow
              stage={{ id: null, name: '', color: '#6366F1', order: newStageOrder }}
              onSave={async (_, data) => {
                await pipelineApi.addStage(id!, { ...data, order: newStageOrder });
                setNewStageOrder(null);
                await load();
              }}
              onDelete={async () => setNewStageOrder(null)}
            />
          )}

          {stages.length === 0 && newStageOrder === null && (
            <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
              No stages yet. Click "Add Stage" to create the first one.
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-destructive/30 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Archive Pipeline</p>
            <p className="text-xs text-muted-foreground">Candidates already assigned will retain their progress. No new assignments can be made.</p>
          </div>
          <button
            onClick={handleArchive}
            className="px-4 py-2 text-sm font-medium border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
