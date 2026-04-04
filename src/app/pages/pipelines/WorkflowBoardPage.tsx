import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { workflowApi } from '../../services/api';
import {
  ArrowLeft,
  Layers,
  RefreshCw,
  Flag,
  AlertTriangle,
  Clock,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Plus,
  BarChart2,
  Settings2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';

// ─── Add Note Modal ───────────────────────────────────────────────────────────

function NoteModal({ progressId, onClose }: { progressId: string; onClose: () => void }) {
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      await workflowApi.addNote(progressId, { content, isPrivate });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-base font-semibold text-foreground mb-3">Add Note</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a note..."
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded" />
            <span className="text-foreground">Private note (only visible to admins)</span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !content.trim()} className="flex-1 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Advance Stage Modal ──────────────────────────────────────────────────────

function AdvanceModal({ assignmentId, pipeline, onClose, onAdvanced }: { assignmentId: string; pipeline: any; onClose: () => void; onAdvanced: () => void }) {
  const [selectedStageId, setSelectedStageId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStageId) return;
    setSaving(true);
    try {
      await workflowApi.advanceToStage(assignmentId, selectedStageId);
      onAdvanced();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-base font-semibold text-foreground mb-3">Advance to Stage</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            {pipeline?.stages?.map((s: any) => (
              <label key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-muted transition-colors" style={{ borderColor: selectedStageId === s.id ? s.color : undefined }}>
                <input type="radio" name="stage" value={s.id} checked={selectedStageId === s.id} onChange={() => setSelectedStageId(s.id)} className="sr-only" />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                <span className="text-sm text-foreground">{s.name}</span>
                {selectedStageId === s.id && <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: s.color }} />}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !selectedStageId} className="flex-1 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Advancing...' : 'Advance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Assign Candidate Modal ───────────────────────────────────────────────────

function AssignModal({ pipeline, onClose, onAssigned }: { pipeline: any; onClose: () => void; onAssigned: () => void }) {
  const [candidateId, setCandidateId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId.trim()) { setError('Candidate ID is required'); return; }
    setSaving(true);
    try {
      await workflowApi.assignCandidate({ candidateId, workflowId: pipeline.id, notes: notes || undefined });
      onAssigned();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Assignment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-base font-semibold text-foreground mb-3">Assign Candidate to Workflow</h3>
        {error && <p className="text-sm text-destructive mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Candidate ID *</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              placeholder="Paste candidate UUID..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Referred by agency..."
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stage Grid Card ──────────────────────────────────────────────────────────

function StageCard({ col, totalStages, totalActive }: { col: any; totalStages: number; totalActive: number }) {
  const stage       = col.stage;
  const activeCount = col.count ?? 0;
  const stageColor  = stage.color || '#2563EB';
  // Progress = percentage of total active candidates currently in this stage
  const progress    = totalActive > 0 ? Math.round((activeCount / totalActive) * 100) : 0;

  return (
    <Card className="relative hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Active count badge */}
        <div className="absolute top-4 right-4">
          <Badge
            className="rounded-full w-7 h-7 flex items-center justify-center p-0 text-white text-xs font-semibold"
            style={{ backgroundColor: stageColor }}
          >
            {activeCount}
          </Badge>
        </div>

        {/* Stage name */}
        <h3 className="font-semibold text-[#0F172A] mb-4 pr-8">{stage.name}</h3>

        {/* Progress bar */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Stage position + candidate count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Stage {stage.order} of {totalStages}
          </p>
          <p className="text-xs text-muted-foreground">
            {activeCount} active
          </p>
        </div>

        {/* View Details link */}
        <Link
          to={`/dashboard/workflow/stage/${stage.id}`}
          className="text-sm text-[#2563EB] hover:text-[#1d4ed8] flex items-center gap-1 font-medium"
        >
          View Details
          <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkflowBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard]   = useState<any>(null);
  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const [noteProgressId, setNoteProgressId] = useState<string | null>(null);
  const [advanceState,   setAdvanceState]   = useState<{ assignmentId: string } | null>(null);
  const [showAssign,     setShowAssign]     = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [boardData, statsData] = await Promise.all([
        workflowApi.board(id),
        workflowApi.stats(id),
      ]);
      setBoard(boardData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-36 bg-muted/30" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>
      </div>
    );
  }

  const pipeline   = board?.pipeline;
  const columns: any[] = board?.columns ?? [];
  const totalStages    = columns.length;
  const totalActive    = stats?.totalActive ?? 0;
  const totalCompleted = stats?.totalCompleted ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/workflows')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: pipeline?.color ?? '#2563EB' }} />
              <h1 className="text-2xl font-semibold text-[#0F172A]">{pipeline?.name}</h1>
              {pipeline?.isDefault && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">Default</span>
              )}
            </div>
            {pipeline?.description && (
              <p className="text-muted-foreground text-sm mt-0.5">{pipeline.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mr-2">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4" />
              <strong className="text-foreground">{totalActive}</strong> active
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <strong className="text-foreground">{totalCompleted}</strong> completed
            </span>
            {stats?.flaggedCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <Flag className="w-4 h-4" />
                <strong>{stats.flaggedCount}</strong> flagged
              </span>
            )}
            {stats?.slaBreached > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <strong>{stats.slaBreached}</strong> SLA breached
              </span>
            )}
          </div>

          <button
            onClick={load}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to={`/dashboard/settings/workflows/${id}`}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Assign Candidate
          </button>
        </div>
      </div>

      {/* Stage Grid */}
      {columns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No stages configured</h3>
          <p className="text-sm text-muted-foreground mb-4">Add stages to this workflow from the settings page.</p>
          <Link
            to={`/dashboard/settings/workflows/${id}`}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Settings2 className="w-4 h-4" /> Workflow Settings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {columns.map((col: any) => (
            <StageCard
              key={col.stage.id}
              col={col}
              totalStages={totalStages}
              totalActive={totalActive}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {noteProgressId && (
        <NoteModal progressId={noteProgressId} onClose={() => setNoteProgressId(null)} />
      )}
      {advanceState && (
        <AdvanceModal
          assignmentId={advanceState.assignmentId}
          pipeline={pipeline}
          onClose={() => setAdvanceState(null)}
          onAdvanced={load}
        />
      )}
      {showAssign && (
        <AssignModal pipeline={pipeline} onClose={() => setShowAssign(false)} onAssigned={load} />
      )}
    </div>
  );
}
