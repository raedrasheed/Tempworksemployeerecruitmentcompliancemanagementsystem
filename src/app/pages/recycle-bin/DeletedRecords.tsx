import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Trash2, RotateCcw, Eye, AlertTriangle,
  ChevronLeft, ChevronRight, Users, FileText, Building2, Briefcase,
  DollarSign, Shield, Bell, BarChart3, FolderOpen, UserCheck, Truck, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { recycleBinApi } from '../../services/api';
import { useAuthContext } from '../../contexts/AuthContext';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeletedRecord {
  entityType: string;
  id: string;
  displayName: string;
  businessId?: string;
  deletedAt: string;
  deletedBy?: string;
  deletedByName?: string;
  deletionReason?: string;
  canRestore: boolean;
  canRestoreWithRelated: boolean;
  canHardDelete: boolean;
  relatedDeletedCount: number;
  extra?: Record<string, any>;
}

interface RelatedData {
  relatedRecords: DeletedRecord[];
  summary: Record<string, number>;
}

interface HardDeletePreview {
  canDelete: boolean;
  blockedReason?: string;
  willDelete: Record<string, number>;
  totalRecords: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  APPLICANT:        { label: 'Applicant',        icon: UserCheck,  color: 'bg-blue-100 text-blue-800' },
  EMPLOYEE:         { label: 'Employee',          icon: Users,      color: 'bg-green-100 text-green-800' },
  USER:             { label: 'User',              icon: Shield,     color: 'bg-purple-100 text-purple-800' },
  AGENCY:           { label: 'Agency',            icon: Building2,  color: 'bg-orange-100 text-orange-800' },
  DOCUMENT:         { label: 'Document',          icon: FileText,   color: 'bg-cyan-100 text-cyan-800' },
  DOCUMENT_TYPE:    { label: 'Document Type',     icon: FolderOpen, color: 'bg-teal-100 text-teal-800' },
  JOB_AD:           { label: 'Job Ad',            icon: Briefcase,  color: 'bg-yellow-100 text-yellow-800' },
  FINANCIAL_RECORD: { label: 'Financial Record',  icon: DollarSign, color: 'bg-emerald-100 text-emerald-800' },
  ROLE:             { label: 'Role',              icon: Shield,     color: 'bg-indigo-100 text-indigo-800' },
  NOTIFICATION:        { label: 'Notification',        icon: Bell,      color: 'bg-gray-100 text-gray-800' },
  REPORT:              { label: 'Report',               icon: BarChart3, color: 'bg-pink-100 text-pink-800' },
  VEHICLE:             { label: 'Vehicle',              icon: Truck,     color: 'bg-sky-100 text-sky-800' },
  VEHICLE_DOCUMENT:    { label: 'Vehicle Document',     icon: FileText,  color: 'bg-blue-100 text-blue-800' },
  MAINTENANCE_RECORD:  { label: 'Maintenance Record',   icon: Wrench,    color: 'bg-amber-100 text-amber-800' },
  MAINTENANCE_TYPE:    { label: 'Maintenance Type',     icon: Wrench,    color: 'bg-orange-100 text-orange-800' },
  WORKSHOP:            { label: 'Workshop',             icon: Building2, color: 'bg-slate-100 text-slate-800' },
};

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
}

function EntityBadge({ entityType }: { entityType: string }) {
  const meta = ENTITY_LABELS[entityType] ?? { label: entityType, icon: FileText, color: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <meta.icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DeletedRecords() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'System Admin';

  // ── State ──────────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('__all__');
  const [deletedFrom, setDeletedFrom] = useState('');
  const [deletedTo, setDeletedTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const LIMIT = 20;

  // Dialogs
  const [selectedRecord, setSelectedRecord] = useState<DeletedRecord | null>(null);
  const [relatedData, setRelatedData] = useState<RelatedData | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [showRelatedDialog, setShowRelatedDialog] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<DeletedRecord | null>(null);
  const [restoreWithRelated, setRestoreWithRelated] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  const [hardDeleteTarget, setHardDeleteTarget] = useState<DeletedRecord | null>(null);
  const [hardDeletePreview, setHardDeletePreview] = useState<HardDeletePreview | null>(null);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState('');
  const [hardDeleteReason, setHardDeleteReason] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(LIMIT),
        sortOrder,
      };
      if (entityType !== '__all__') params.entityType = entityType;
      if (search) params.search = search;
      if (deletedFrom) params.deletedFrom = deletedFrom;
      if (deletedTo) params.deletedTo = deletedTo;

      const res = await recycleBinApi.list(params);
      setRecords(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch {
      toast.error('Failed to load deleted records');
    } finally {
      setLoading(false);
    }
  }, [page, sortOrder, entityType, search, deletedFrom, deletedTo]);

  const fetchCounts = useCallback(async () => {
    try {
      const c = await recycleBinApi.getCounts();
      setCounts(c);
    } catch {}
  }, []);

  useEffect(() => { fetchRecords(); fetchCounts(); }, [fetchRecords, fetchCounts]);

  // ── Related data dialog ────────────────────────────────────────────────────
  const openRelated = async (rec: DeletedRecord) => {
    setSelectedRecord(rec);
    setRelatedLoading(true);
    setShowRelatedDialog(true);
    try {
      const data = await recycleBinApi.getRelated(rec.entityType, rec.id);
      setRelatedData(data);
    } catch {
      toast.error('Failed to load related data');
    } finally {
      setRelatedLoading(false);
    }
  };

  // ── Restore dialog ─────────────────────────────────────────────────────────
  const openRestore = (rec: DeletedRecord, withRelated = false) => {
    setRestoreTarget(rec);
    setRestoreWithRelated(withRelated);
    setShowRestoreDialog(true);
  };

  const executeRestore = async () => {
    if (!restoreTarget) return;
    setRestoreLoading(true);
    try {
      const result = await recycleBinApi.restore(restoreTarget.entityType, restoreTarget.id, {
        withRelated: restoreWithRelated,
      });
      toast.success(
        `Restored ${ENTITY_LABELS[restoreTarget.entityType]?.label ?? restoreTarget.entityType}: ${restoreTarget.displayName}` +
        (result.restored ? ` (${Object.entries(result.restored).filter(([, v]) => (v as number) > 0).map(([k, v]) => `${v} ${k}`).join(', ')})` : '')
      );
      if (result.warnings?.length) {
        result.warnings.forEach((w: string) => toast.warning(w));
      }
      setShowRestoreDialog(false);
      setRestoreTarget(null);
      fetchRecords();
      fetchCounts();
    } catch (e: any) {
      toast.error(e?.message ?? 'Restore failed');
    } finally {
      setRestoreLoading(false);
    }
  };

  // ── Hard delete dialog ─────────────────────────────────────────────────────
  const openHardDelete = async (rec: DeletedRecord) => {
    setHardDeleteTarget(rec);
    setHardDeleteConfirm('');
    setHardDeleteReason('');
    setHardDeletePreview(null);
    setShowHardDeleteDialog(true);
    try {
      const preview = await recycleBinApi.previewHardDelete(rec.entityType, rec.id);
      setHardDeletePreview(preview);
    } catch {
      toast.error('Failed to load deletion preview');
    }
  };

  const executeHardDelete = async () => {
    if (!hardDeleteTarget) return;
    const expectedConfirm = `DELETE ${hardDeleteTarget.displayName}`;
    if (hardDeleteConfirm !== expectedConfirm) {
      toast.error(`Type exactly: ${expectedConfirm}`);
      return;
    }
    setHardDeleteLoading(true);
    try {
      await recycleBinApi.hardDelete(hardDeleteTarget.entityType, hardDeleteTarget.id, { reason: hardDeleteReason });
      toast.success(`Permanently deleted: ${hardDeleteTarget.displayName}`);
      setShowHardDeleteDialog(false);
      setHardDeleteTarget(null);
      fetchRecords();
      fetchCounts();
    } catch (e: any) {
      toast.error(e?.message ?? 'Hard delete failed');
    } finally {
      setHardDeleteLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deleted Records</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View, restore, or permanently delete soft-deleted records across the system.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchRecords(); fetchCounts(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Object.entries(ENTITY_LABELS).filter(([key]) => (counts[key] ?? 0) > 0 || counts.total > 0).map(([key, meta]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all hover:shadow-md ${entityType === key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => { setEntityType(entityType === key ? '__all__' : key); setPage(1); }}
          >
            <CardContent className="p-3 text-center">
              <meta.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-xl font-bold">{counts[key] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{meta.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, ID…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={entityType} onValueChange={v => { setEntityType(v); setPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Types</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={v => setSortOrder(v as 'asc' | 'desc')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest first</SelectItem>
                <SelectItem value="asc">Oldest first</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Deleted from</Label>
              <Input type="date" value={deletedFrom} onChange={e => { setDeletedFrom(e.target.value); setPage(1); }} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">to</Label>
              <Input type="date" value={deletedTo} onChange={e => { setDeletedTo(e.target.value); setPage(1); }} className="w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {loading ? 'Loading…' : `${total} deleted record${total !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name / ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Business ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deleted At</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Related</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No deleted records found
                  </td></tr>
                ) : records.map(rec => (
                  <tr key={`${rec.entityType}-${rec.id}`} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><EntityBadge entityType={rec.entityType} /></td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-48">{rec.displayName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{rec.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {rec.businessId ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(rec.deletedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-32 truncate">
                      {rec.deletionReason ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {rec.relatedDeletedCount > 0 ? (
                        <button
                          onClick={() => openRelated(rec)}
                          className="text-xs text-primary hover:underline"
                        >
                          {rec.relatedDeletedCount} related
                        </button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {rec.relatedDeletedCount > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => openRelated(rec)} title="View related deleted data">
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {rec.canRestore && (
                          <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => openRestore(rec, false)} title="Restore">
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        {rec.canRestoreWithRelated && rec.relatedDeletedCount > 0 && (
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openRestore(rec, true)} title="Restore with related records">
                            <RotateCcw className="w-4 h-4 mr-1" />
                            <span className="text-xs">+related</span>
                          </Button>
                        )}
                        {rec.canHardDelete && isAdmin && (
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openHardDelete(rec)} title="Permanently delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} records)
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Related Data Dialog ───────────────────────────────────────────── */}
      <Dialog open={showRelatedDialog} onOpenChange={setShowRelatedDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Related Deleted Records</DialogTitle>
            <DialogDescription>
              Soft-deleted records associated with: <strong>{selectedRecord?.displayName}</strong>
            </DialogDescription>
          </DialogHeader>
          {relatedLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading…</div>
          ) : relatedData ? (
            <div className="space-y-4">
              {Object.entries(relatedData.summary).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 bg-muted/40 rounded">
                  <EntityBadge entityType={type.toUpperCase().replace('_COUNT', '')} />
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {relatedData.relatedRecords.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {relatedData.relatedRecords.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div>
                        <EntityBadge entityType={r.entityType} />
                        <span className="ml-2">{r.displayName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(r.deletedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRelatedDialog(false)}>Close</Button>
            {selectedRecord?.canRestoreWithRelated && (
              <Button onClick={() => { setShowRelatedDialog(false); openRestore(selectedRecord!, true); }}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore with Related
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Restore Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {restoreWithRelated ? 'Restore with Related Records' : 'Restore Record'}
            </DialogTitle>
            <DialogDescription>
              {restoreWithRelated
                ? `This will restore "${restoreTarget?.displayName}" and all its soft-deleted related records.`
                : `This will restore "${restoreTarget?.displayName}" only.`}
            </DialogDescription>
          </DialogHeader>
          {restoreWithRelated && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              <strong>Note:</strong> Related records (documents, financial records, attachments) deleted at the same time will also be restored.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>Cancel</Button>
            <Button onClick={executeRestore} disabled={restoreLoading}>
              {restoreLoading ? 'Restoring…' : (
                <><RotateCcw className="w-4 h-4 mr-2" />Restore</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hard Delete Dialog ───────────────────────────────────────────── */}
      <Dialog open={showHardDeleteDialog} onOpenChange={open => { if (!open) { setShowHardDeleteDialog(false); setHardDeleteTarget(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Permanent Deletion
            </DialogTitle>
            <DialogDescription>
              This action is <strong>irreversible</strong>. The record and all related data will be permanently removed from the database.
            </DialogDescription>
          </DialogHeader>

          {hardDeletePreview ? (
            <div className="space-y-3">
              {!hardDeletePreview.canDelete && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  <strong>Blocked:</strong> {hardDeletePreview.blockedReason}
                </div>
              )}
              {hardDeletePreview.canDelete && (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-sm font-medium text-amber-900 mb-2">
                      This will permanently delete {hardDeletePreview.totalRecords} record(s):
                    </p>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {Object.entries(hardDeletePreview.willDelete).map(([key, count]) => (
                        <li key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Reason for deletion (optional)</Label>
                    <Input
                      placeholder="Enter reason…"
                      value={hardDeleteReason}
                      onChange={e => setHardDeleteReason(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">
                      Type <code className="bg-muted px-1 rounded">DELETE {hardDeleteTarget?.displayName}</code> to confirm:
                    </Label>
                    <Input
                      placeholder={`DELETE ${hardDeleteTarget?.displayName}`}
                      value={hardDeleteConfirm}
                      onChange={e => setHardDeleteConfirm(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground">Loading preview…</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowHardDeleteDialog(false); setHardDeleteTarget(null); }}>
              Cancel
            </Button>
            {hardDeletePreview?.canDelete && (
              <Button
                variant="destructive"
                disabled={hardDeleteLoading || hardDeleteConfirm !== `DELETE ${hardDeleteTarget?.displayName}`}
                onClick={executeHardDelete}
              >
                {hardDeleteLoading ? 'Deleting…' : (
                  <><Trash2 className="w-4 h-4 mr-2" />Permanently Delete</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
