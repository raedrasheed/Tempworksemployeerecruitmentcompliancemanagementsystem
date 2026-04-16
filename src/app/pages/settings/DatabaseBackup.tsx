import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle, Shield, Download, RotateCcw, Trash2, Eye, CheckCircle2,
  XCircle, RefreshCw, ArrowLeft, HardDrive, Plus, Info, Clock, FileArchive,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button }   from '../../components/ui/button';
import { Input }    from '../../components/ui/input';
import { Badge }    from '../../components/ui/badge';
import { Label }    from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { backupApi } from '../../services/api';
import { useAuthContext } from '../../contexts/AuthContext';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Backup {
  id:            string;
  fileName:      string;
  fileSize:      number;
  fileSizeHuman: string;
  backupType:    string;
  status:        'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  notes?:        string;
  errorMessage?: string;
  metadata?:     any;
  createdAt:     string;
  completedAt?:  string;
  createdBy?:    { id: string; name: string; email: string } | null;
  fileExists:    boolean;
}

interface RestoreOption {
  mode:        string;
  label:       string;
  description: string;
  risk:        'LOW' | 'MEDIUM' | 'HIGH';
  notes:       string;
}

interface Preview {
  backup:         Backup;
  fileExists:     boolean;
  warnings:       string[];
  compatibility:  Record<string, any>;
  restoreOptions: RestoreOption[];
}

const RESTORE_CONFIRM = 'RESTORE DATABASE';

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  RUNNING:   'bg-blue-100 text-blue-800',
  PENDING:   'bg-yellow-100 text-yellow-800',
  FAILED:    'bg-red-100 text-red-800',
};

const RISK_BADGE: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-green-100 text-green-700',
};

function fmt(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DatabaseBackup() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const isAdmin  = user?.role === 'System Admin';

  // List state
  const [backups,      setBackups]      = useState<Backup[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locked,       setLocked]       = useState(false);

  // Create backup modal
  const [showCreate,    setShowCreate]    = useState(false);
  const [createNotes,   setCreateNotes]   = useState('');
  const [creating,      setCreating]      = useState(false);

  // Delete modal
  const [deleteTarget,  setDeleteTarget]  = useState<Backup | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  // Restore modal
  const [preview,        setPreview]        = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showRestore,    setShowRestore]    = useState(false);
  const [restoreMode,    setRestoreMode]    = useState('FULL');
  const [confirmPhrase,  setConfirmPhrase]  = useState('');
  const [restoreNotes,   setRestoreNotes]   = useState('');
  const [skipSafety,     setSkipSafety]     = useState(false);
  const [restoring,      setRestoring]      = useState(false);
  const [restoreResult,  setRestoreResult]  = useState<any | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backupApi.list({ page, limit: 15, search: search || undefined, status: statusFilter || undefined });
      setBackups(res?.data ?? []);
      setTotal(res?.meta?.total ?? 0);
      setTotalPages(res?.meta?.totalPages ?? 1);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await backupApi.status();
      setLocked(s?.locked ?? false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchStatus();
  }, [fetchBackups, fetchStatus]);

  // Poll status while locked
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => {
      fetchStatus();
      fetchBackups();
    }, 3000);
    return () => clearInterval(t);
  }, [locked, fetchStatus, fetchBackups]);

  // ── Create backup ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setCreating(true);
    try {
      await backupApi.create({ notes: createNotes || undefined });
      toast.success('Backup created successfully');
      setShowCreate(false);
      setCreateNotes('');
      fetchBackups();
      fetchStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = async (b: Backup) => {
    try {
      await backupApi.download(b.id, b.fileName);
      toast.success('Download started');
    } catch (err: any) {
      toast.error(err?.message || 'Download failed');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await backupApi.delete(deleteTarget.id);
      toast.success('Backup deleted');
      setDeleteTarget(null);
      fetchBackups();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── Restore flow ──────────────────────────────────────────────────────────

  const openRestoreModal = async (b: Backup) => {
    setPreviewLoading(true);
    setShowRestore(true);
    setConfirmPhrase('');
    setRestoreNotes('');
    setRestoreMode('FULL');
    setSkipSafety(false);
    setRestoreResult(null);
    try {
      const data = await backupApi.preview(b.id);
      setPreview(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load preview');
      setShowRestore(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!preview) return;
    if (confirmPhrase !== RESTORE_CONFIRM) {
      toast.error(`Type exactly: ${RESTORE_CONFIRM}`);
      return;
    }
    setRestoring(true);
    try {
      const result = await backupApi.restore(preview.backup.id, {
        restoreMode:    restoreMode,
        confirmPhrase,
        notes:          restoreNotes || undefined,
        skipSafetyBackup: skipSafety,
      });
      setRestoreResult(result);
      toast.success('Restore completed successfully');
      fetchBackups();
    } catch (err: any) {
      toast.error(err?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <h2 className="text-lg font-semibold mb-1">Access Denied</h2>
          <p className="text-muted-foreground">Only System Administrators can access database backup.</p>
        </div>
      </div>
    );
  }

  const completedBackups = backups.filter(b => b.status === 'COMPLETED').length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/settings')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Database Backup & Restore</h1>
            <p className="text-muted-foreground mt-1">
              Create, manage, and restore full PostgreSQL database backups.
              All operations are logged to the audit trail.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={locked}>
          {locked
            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Operation in progress…</>
            : <><Plus className="w-4 h-4 mr-2" />Create Backup</>
          }
        </Button>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Important — Backup & Restore Safety Notes</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>Backup files are stored in <code className="bg-amber-100 px-1 rounded">./backups/</code> on the server. Secure this directory appropriately.</li>
              <li>A pre-restore safety backup is created automatically before any restore (unless skipped).</li>
              <li>During restore, active database connections may cause conflicts. Schedule restores during low-traffic windows.</li>
              <li>Requires <code className="bg-amber-100 px-1 rounded">pg_dump</code> / <code className="bg-amber-100 px-1 rounded">pg_restore</code> installed on the server. Set <code className="bg-amber-100 px-1 rounded">PG_BIN_PATH</code> env var if needed.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Backups</p>
            <p className="text-2xl font-bold text-blue-700">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-bold text-green-700">{completedBackups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Latest Backup</p>
            <p className="text-sm font-medium">{backups[0] ? fmt(backups[0].createdAt) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
            <p className={`text-sm font-semibold ${locked ? 'text-blue-600' : 'text-green-600'}`}>
              {locked ? 'Operation running…' : 'Idle'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by filename or notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { fetchBackups(); fetchStatus(); }} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Backups table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
              <p>Loading backups…</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <FileArchive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No backups found</p>
              <p className="text-sm mt-1">Create your first backup using the button above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map(b => (
                    <TableRow key={b.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div className="font-mono text-xs text-foreground">{b.fileName}</div>
                            {!b.fileExists && b.status === 'COMPLETED' && (
                              <div className="text-xs text-red-500">File missing from disk</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{b.backupType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.fileSizeHuman}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {b.status === 'RUNNING' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                          {b.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {b.createdBy?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmt(b.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {b.notes ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {b.status === 'COMPLETED' && b.fileExists && (
                            <>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleDownload(b)}
                                title="Download backup"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => openRestoreModal(b)}
                                disabled={locked}
                                title="Restore from backup"
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {b.status !== 'RUNNING' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setDeleteTarget(b)}
                              title="Delete backup"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Page {page} of {totalPages} · {total} backups</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* ── Create Backup Modal ──────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={o => { if (!o) setShowCreate(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Create Database Backup
            </DialogTitle>
            <DialogDescription>
              Creates a full PostgreSQL backup using <code>pg_dump</code>.
              The backup is stored securely on the server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. Pre-deployment backup, weekly snapshot…"
                value={createNotes}
                onChange={e => setCreateNotes(e.target.value)}
              />
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-1">
              <p className="font-medium">What's included:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Full database schema and all data</li>
                <li>Sequences and identity counters</li>
                <li>Indexes and constraints</li>
                <li>Format: pg_dump custom (compressed)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                : <><Database className="w-4 h-4 mr-2" />Create Backup</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Backup
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the backup file and its metadata record.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="py-2 space-y-2">
              <div className="p-3 bg-muted rounded text-sm font-mono">{deleteTarget.fileName}</div>
              <p className="text-sm text-muted-foreground">Size: {deleteTarget.fileSizeHuman}</p>
              <p className="text-sm text-muted-foreground">Created: {fmt(deleteTarget.createdAt)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Deleting…</>
                : <><Trash2 className="w-4 h-4 mr-2" />Delete Backup</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Restore Modal ────────────────────────────────────────────────────── */}
      <Dialog open={showRestore} onOpenChange={o => {
        if (!o && !restoring) { setShowRestore(false); setPreview(null); setRestoreResult(null); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <RotateCcw className="w-5 h-5" />
              Restore Database from Backup
            </DialogTitle>
            <DialogDescription>
              Review the backup details, select a restore mode, and confirm the restore operation.
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="py-8 text-center">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin opacity-40 mb-3" />
              <p className="text-muted-foreground">Loading backup preview…</p>
            </div>
          ) : restoreResult ? (
            /* ── Success state ── */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Restore Completed Successfully
                </div>
                <p className="text-sm text-green-700">{restoreResult.message}</p>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Backup</span><span className="font-mono">{restoreResult.fileName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{restoreResult.restoreMode}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{fmt(restoreResult.completedAt)}</span></div>
                {restoreResult.safetyBackupId && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Safety Backup ID</span><span className="font-mono text-xs">{restoreResult.safetyBackupId}</span></div>
                )}
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                You may need to restart the backend server for all changes to take effect.
              </div>
              <Button className="w-full" onClick={() => { setShowRestore(false); setPreview(null); setRestoreResult(null); }}>
                Close
              </Button>
            </div>
          ) : preview ? (
            /* ── Main restore form ── */
            <div className="space-y-5 py-2">
              {/* Backup summary */}
              <div className="p-4 bg-muted/40 rounded-lg text-sm space-y-2">
                <p className="font-medium flex items-center gap-2"><FileArchive className="w-4 h-4" />Backup Details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">File</span>
                  <span className="font-mono text-xs">{preview.backup.fileName}</span>
                  <span className="text-muted-foreground">Size</span>
                  <span>{preview.backup.fileSizeHuman}</span>
                  <span className="text-muted-foreground">Created</span>
                  <span>{fmt(preview.backup.createdAt)}</span>
                  <span className="text-muted-foreground">Created By</span>
                  <span>{preview.backup.createdBy?.name ?? '—'}</span>
                  {preview.backup.metadata?.pgVersion && (
                    <>
                      <span className="text-muted-foreground">PostgreSQL</span>
                      <span className="text-xs">{String(preview.backup.metadata.pgVersion).slice(0, 50)}</span>
                    </>
                  )}
                  {preview.backup.metadata?.estimatedTotalRows != null && (
                    <>
                      <span className="text-muted-foreground">Est. Rows</span>
                      <span>{Number(preview.backup.metadata.estimatedTotalRows).toLocaleString()}</span>
                    </>
                  )}
                  {preview.backup.metadata?.tableCount != null && (
                    <>
                      <span className="text-muted-foreground">Tables</span>
                      <span>{preview.backup.metadata.tableCount}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  {preview.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Restore mode selector */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Restore Mode</Label>
                <div className="space-y-2">
                  {preview.restoreOptions.map(opt => (
                    <label
                      key={opt.mode}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        restoreMode === opt.mode
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-border hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value={opt.mode}
                        checked={restoreMode === opt.mode}
                        onChange={() => setRestoreMode(opt.mode)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{opt.label}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RISK_BADGE[opt.risk]}`}>
                            {opt.risk} RISK
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                        <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                          <Info className="w-3 h-3" />{opt.notes}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Safety backup option */}
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded">
                <Shield className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skipSafety"
                      checked={skipSafety}
                      onChange={e => setSkipSafety(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="skipSafety" className="text-sm cursor-pointer font-medium text-green-800">
                      Skip pre-restore safety backup
                    </Label>
                  </div>
                  <p className="text-xs text-green-700 mt-1 ml-6">
                    By default, a safety backup of the current database is created before restore.
                    Uncheck (default) to keep this protection. Only skip if you are certain.
                  </p>
                </div>
              </div>

              {/* Optional notes */}
              <div className="space-y-1.5">
                <Label className="text-sm">Reason / notes (optional)</Label>
                <Input
                  placeholder="e.g. Reverting failed deployment, disaster recovery…"
                  value={restoreNotes}
                  onChange={e => setRestoreNotes(e.target.value)}
                />
              </div>

              {/* Danger warning */}
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  This will overwrite the current database. This action cannot be undone.
                </p>
                <p className="text-xs text-red-700">
                  All users currently logged in may experience data loss or unexpected behavior.
                  Schedule this during a maintenance window if possible.
                </p>
              </div>

              {/* Confirm phrase */}
              <div className="space-y-2">
                <Label className="text-sm">
                  Type{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm">{RESTORE_CONFIRM}</code>
                  {' '}to confirm:
                </Label>
                <Input
                  placeholder={RESTORE_CONFIRM}
                  value={confirmPhrase}
                  onChange={e => setConfirmPhrase(e.target.value)}
                  className="font-mono"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowRestore(false)} disabled={restoring}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={restoring || confirmPhrase !== RESTORE_CONFIRM || !preview.fileExists}
                  onClick={handleRestore}
                >
                  {restoring
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Restoring…</>
                    : <><RotateCcw className="w-4 h-4 mr-2" />Execute Restore</>
                  }
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
