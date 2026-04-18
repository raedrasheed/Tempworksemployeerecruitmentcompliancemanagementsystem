import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { workflowApi } from '../../services/api';
import { confirm } from '../../components/ui/ConfirmDialog';
import {
  Layers,
  Plus,
  ChevronRight,
  Star,
  Archive,
  Users,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Flag,
  MoreVertical,
  Trash2,
  Settings2,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function WorkflowCard({
  workflow,
  stats,
  onSelect,
  onConfigure,
  onArchive,
  onDelete,
}: {
  workflow: any;
  stats: any;
  onSelect: () => void;
  onConfigure: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group relative"
      onClick={onSelect}
    >
      {/* Color stripe */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: workflow.color }} />

      <div className="flex items-start justify-between mt-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {workflow.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Star className="w-2.5 h-2.5" /> Default
              </span>
            )}
            {workflow.status === 'ARCHIVED' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                <Archive className="w-2.5 h-2.5" /> Archived
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground text-base leading-tight">{workflow.name}</h3>
          {workflow.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{workflow.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-3" onClick={(e) => e.stopPropagation()}>
          {/* Configure button — always visible on hover */}
          <button
            onClick={onConfigure}
            title="Configure stages"
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-popover border border-border rounded-lg shadow-lg z-10 py-1" onMouseLeave={() => setMenuOpen(false)}>
                <button
                  onClick={() => { setMenuOpen(false); onConfigure(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <Settings2 className="w-3.5 h-3.5" /> Configure
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onArchive(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage pills */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(workflow.stages || []).slice(0, 5).map((s: any) => (
          <span
            key={s.id}
            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
            style={{ background: s.color }}
          >
            {s.name}
          </span>
        ))}
        {(workflow.stages?.length ?? 0) > 5 && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
            +{workflow.stages.length - 5} more
          </span>
        )}
        {(workflow.stages?.length ?? 0) === 0 && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground italic">
            No stages — click Configure to add
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-4 pt-4 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {stats?.totalActive ?? workflow._count?.assignments ?? 0} active</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {stats?.totalCompleted ?? 0} completed</span>
        {(stats?.flaggedCount ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-amber-600"><Flag className="w-3.5 h-3.5" /> {stats.flaggedCount} flagged</span>
        )}
        {(stats?.slaBreached ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> {stats.slaBreached} SLA</span>
        )}
      </div>

      {/* Open board CTA */}
      <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Open Board <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

// ─── Create workflow modal ─────────────────────────────────────────────────

function CreateWorkflowModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: '', description: '', isDefault: false, isPublic: true, color: '#2563EB' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const colors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#BE185D', '#374151'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const created = await workflowApi.create(form);
      onCreated(created.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">New Workflow</h2>
        <p className="text-sm text-muted-foreground mb-4">After creation you'll be taken to configure its stages.</p>
        {error && <p className="text-sm text-destructive mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. UK Driver Standard Onboarding"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full border-2 transition-transform"
                  style={{ background: c, borderColor: form.color === c ? '#000' : 'transparent', transform: form.color === c ? 'scale(1.2)' : 'scale(1)' }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded" />
              <span className="text-foreground">Set as default workflow</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Creating...' : 'Create & Configure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkflowsPage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await workflowApi.list(showArchived);
      setWorkflows(data);
      const statsResults = await Promise.allSettled(data.map((p: any) => workflowApi.stats(p.id)));
      const map: Record<string, any> = {};
      statsResults.forEach((r, i) => {
        if (r.status === 'fulfilled') map[data[i].id] = r.value;
      });
      setStatsMap(map);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { load(); }, [load]);

  const handleArchive = async (id: string) => {
    try { await workflowApi.archive(id); load(); } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete workflow?',
      description: 'This workflow will be permanently removed. This cannot be undone.',
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try { await workflowApi.delete(id); load(); } catch {}
  };

  // After creation, go directly to the configuration page
  const handleCreated = (id: string) => {
    navigate(`/dashboard/settings/workflows/${id}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> Workflows
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recruitment workflows — each has its own stages, requirements, and candidate workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowArchived(!showArchived)} className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${showArchived ? 'bg-muted text-foreground border-border' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
          <button onClick={load} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Workflow
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Create your first recruitment workflow to start managing candidate progress.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workflows.map((p) => (
            <WorkflowCard
              key={p.id}
              workflow={p}
              stats={statsMap[p.id]}
              onSelect={() => navigate(`/dashboard/workflows/${p.id}`)}
              onConfigure={() => navigate(`/dashboard/settings/workflows/${p.id}`)}
              onArchive={() => handleArchive(p.id)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateWorkflowModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
