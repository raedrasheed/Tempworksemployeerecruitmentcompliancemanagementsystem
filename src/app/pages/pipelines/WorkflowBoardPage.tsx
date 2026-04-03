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
  User2,
  Settings2,
  BarChart2,
  List,
  LayoutDashboard,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSlaDeadline(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const breached = diff < 0;
  const hours = Math.abs(Math.floor(diff / 3600000));
  const label = hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
  return { breached, label };
}

function ApprovalBadge({ approval }: { approval: any }) {
  if (!approval) return null;
  const cfg: Record<string, { cls: string; icon: React.ReactNode }> = {
    APPROVED: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    REJECTED: { cls: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
    PENDING: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  };
  const c = cfg[approval.decision] ?? cfg.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${c.cls}`}>
      {c.icon} {approval.decision}
    </span>
  );
}

// ─── Candidate Card ───────────────────────────────────────────────────────────

function CandidateCard({ item, onAdvance, onFlag, onNote }: { item: any; onAdvance: () => void; onFlag: () => void; onNote: () => void }) {
  const sla = formatSlaDeadline(item.slaDeadline);

  return (
    <div className={`bg-card border rounded-lg p-3 hover:shadow-md transition-shadow ${item.flagged ? 'border-amber-300 bg-amber-50/30' : 'border-border'}`}>
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
          {item.candidate?.photoUrl ? (
            <img src={item.candidate.photoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <User2 className="w-4 h-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            to={`/dashboard/applicants/${item.candidate?.id}`}
            className="text-sm font-medium text-foreground hover:text-primary truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            {item.candidate?.firstName} {item.candidate?.lastName}
          </Link>
          <p className="text-xs text-muted-foreground">{item.candidate?.candidateNumber ?? item.candidate?.nationality}</p>
        </div>
        {item.flagged && <Flag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
      </div>

      {/* SLA */}
      {sla && (
        <div className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${sla.breached ? 'text-red-600' : 'text-muted-foreground'}`}>
          <AlertTriangle className="w-3 h-3" />
          {sla.breached ? `SLA breached ${sla.label} ago` : `SLA: ${sla.label} left`}
        </div>
      )}

      {/* Approval */}
      {item.latestApproval && (
        <div className="mt-2"><ApprovalBadge approval={item.latestApproval} /></div>
      )}

      {/* Notes count */}
      {item.recentNotes?.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <MessageSquare className="w-3 h-3" /> {item.recentNotes.length} note{item.recentNotes.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-1 flex-wrap">
        <button
          onClick={onAdvance}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <ChevronRight className="w-3 h-3" /> Advance
        </button>
        <button
          onClick={onFlag}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${item.flagged ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'}`}
        >
          <Flag className="w-3 h-3" /> {item.flagged ? 'Unflag' : 'Flag'}
        </button>
        <button
          onClick={onNote}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          <MessageSquare className="w-3 h-3" /> Note
        </button>
      </div>
    </div>
  );
}

// ─── Stage Column ─────────────────────────────────────────────────────────────

function StageColumn({
  column,
  stages,
  onAdvance,
  onFlag,
  onNote,
}: {
  column: any;
  stages: any[];
  onAdvance: (progressId: string, assignmentId: string) => void;
  onFlag: (progressId: string, flagged: boolean) => void;
  onNote: (progressId: string) => void;
}) {
  return (
    <div className="flex-shrink-0 w-64">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ background: column.stage.color }} />
        <span className="text-sm font-semibold text-foreground">{column.stage.name}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{column.count}</span>
      </div>

      {/* Cards */}
      <div className="space-y-2 min-h-[80px]">
        {column.candidates.length === 0 && (
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">Empty</div>
        )}
        {column.candidates.map((item: any) => (
          <CandidateCard
            key={item.progressId}
            item={item}
            onAdvance={() => onAdvance(item.progressId, item.assignmentId)}
            onFlag={() => onFlag(item.progressId, !item.flagged)}
            onNote={() => onNote(item.progressId)}
          />
        ))}
      </div>
    </div>
  );
}

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

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: any }) {
  if (!stats) return null;
  return (
    <div className="flex items-center gap-6 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /><strong className="text-foreground">{stats.totalActive}</strong> active</span>
      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><strong className="text-foreground">{stats.totalCompleted}</strong> completed</span>
      {stats.flaggedCount > 0 && <span className="flex items-center gap-1.5 text-amber-600"><Flag className="w-4 h-4" /><strong>{stats.flaggedCount}</strong> flagged</span>}
      {stats.slaBreached > 0 && <span className="flex items-center gap-1.5 text-red-600"><AlertTriangle className="w-4 h-4" /><strong>{stats.slaBreached}</strong> SLA breached</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkflowBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');

  const [noteProgressId, setNoteProgressId] = useState<string | null>(null);
  const [advanceState, setAdvanceState] = useState<{ assignmentId: string } | null>(null);
  const [showAssign, setShowAssign] = useState(false);

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
      setError(err.message || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleFlag = async (progressId: string, flagged: boolean) => {
    try {
      await workflowApi.updateProgress(progressId, { status: 'ACTIVE', flagged });
      load();
    } catch {}
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-64 h-64 bg-muted rounded-xl" />
            ))}
          </div>
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

  const pipeline = board?.pipeline;
  const columns = board?.columns ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/dashboard/workflows')} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: pipeline?.color }} />
            <h1 className="text-lg font-semibold text-foreground">{pipeline?.name}</h1>
            {pipeline?.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">Default</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatsBar stats={stats} />
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button onClick={() => setView('board')} className={`p-1.5 rounded-md transition-colors ${view === 'board' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <LayoutDashboard className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setView('list')} className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={load} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link to={`/dashboard/settings/workflows/${id}`} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
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
        {pipeline?.description && <p className="text-sm text-muted-foreground">{pipeline.description}</p>}
      </div>

      {/* Board */}
      {view === 'board' ? (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 min-w-max pb-4">
            {columns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 w-full text-center">
                <Layers className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No stages configured</h3>
                <p className="text-sm text-muted-foreground mb-4">Add stages to this workflow from the settings page.</p>
                <Link to={`/dashboard/settings/workflows/${id}`} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Settings2 className="w-4 h-4" /> Workflow Settings
                </Link>
              </div>
            ) : (
              columns.map((col: any) => (
                <StageColumn
                  key={col.stage.id}
                  column={col}
                  stages={pipeline?.stages ?? []}
                  onAdvance={(progressId, assignmentId) => setAdvanceState({ assignmentId })}
                  onFlag={handleFlag}
                  onNote={(progressId) => setNoteProgressId(progressId)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        // List view
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {columns.flatMap((col: any) =>
              col.candidates.map((item: any) => (
                <div key={item.progressId} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.stage.color }} />
                  <div className="flex-1 min-w-0">
                    <Link to={`/dashboard/applicants/${item.candidate?.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {item.candidate?.firstName} {item.candidate?.lastName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.candidate?.candidateNumber}</p>
                  </div>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">{col.stage.name}</span>
                  {item.flagged && <Flag className="w-4 h-4 text-amber-500" />}
                  <ApprovalBadge approval={item.latestApproval} />
                </div>
              ))
            )}
            {columns.every((c: any) => c.candidates.length === 0) && (
              <div className="text-center py-12 text-muted-foreground text-sm">No candidates in this workflow yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {noteProgressId && <NoteModal progressId={noteProgressId} onClose={() => setNoteProgressId(null)} />}
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
