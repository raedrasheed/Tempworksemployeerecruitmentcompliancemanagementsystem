/**
 * WorkHistoryTimeline
 * ─────────────────────────────────────────────────────────────────
 * Post-hire contract timeline shown inside the Employee Profile's
 * Contracts tab. Deliberately kept separate from Workflow History —
 * no pipeline / stage events ever appear here.
 *
 * Ordering: newest first (date desc, createdAt desc) so operators
 * see the latest contract event at the top of the list.
 */
import { useEffect, useState, useMemo } from 'react';
import { employeeWorkHistoryApi, usersApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { confirm } from '../ui/ConfirmDialog';
import {
  Plus, Save, X, FileText, Paperclip, Trash2, Download, Edit2, CheckCircle2,
  LogOut, Clock, Coffee, XOctagon, BadgeCheck,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');

const EVENT_TYPES = [
  { value: 'NEW_CONTRACT',       label: 'New Contract',        icon: BadgeCheck,   tone: 'emerald' },
  { value: 'PROBATION_START',    label: 'Probation Period Start', icon: Clock,     tone: 'blue' },
  { value: 'PROBATION_END',      label: 'Probation Period End',   icon: CheckCircle2, tone: 'blue' },
  { value: 'END_OF_CONTRACT',    label: 'End of Contract',     icon: LogOut,       tone: 'amber' },
  { value: 'UNPAID_LEAVE_START', label: 'Unpaid Leave Start',  icon: Coffee,       tone: 'slate' },
  { value: 'UNPAID_LEAVE_END',   label: 'Unpaid Leave End',    icon: Coffee,       tone: 'slate' },
  { value: 'TERMINATED',         label: 'Terminated',          icon: XOctagon,     tone: 'red' },
] as const;

type EventTypeValue = typeof EVENT_TYPES[number]['value'];

const EVENT_META: Record<string, { label: string; icon: any; tone: string }> = {};
EVENT_TYPES.forEach(e => { EVENT_META[e.value] = e; });

const TONE_CLASS: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  blue:    'bg-blue-100 text-blue-800 border-blue-200',
  amber:   'bg-amber-100 text-amber-800 border-amber-200',
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
  red:     'bg-red-100 text-red-800 border-red-200',
};

const TONE_DOT: Record<string, string> = {
  emerald: 'bg-emerald-500',
  blue:    'bg-blue-500',
  amber:   'bg-amber-500',
  slate:   'bg-slate-400',
  red:     'bg-red-500',
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fullName(u?: { firstName?: string; lastName?: string; email?: string } | null) {
  if (!u) return '';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '';
}

interface Props {
  employeeId: string;
  canWrite: boolean;
}

export function WorkHistoryTimeline({ employeeId, canWrite }: Props) {
  const [entries, setEntries]  = useState<any[]>([]);
  const [loading, setLoading]  = useState(true);
  const [users,   setUsers]    = useState<any[]>([]);

  // Dialog state — shared between "add new entry" and "edit existing".
  const [open, setOpen]        = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ date: string; eventType: EventTypeValue; description: string; approvedById: string }>({
    date: new Date().toISOString().slice(0, 10),
    eventType: 'NEW_CONTRACT',
    description: '',
    approvedById: '',
  });
  const [saving, setSaving]    = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await employeeWorkHistoryApi.list(employeeId);
      setEntries(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Only hit the users list when the operator can actually write —
    // the Approved By picker is the only consumer.
    if (canWrite) {
      usersApi.list({ limit: 200 }).then((res: any) => setUsers(res?.data ?? [])).catch(() => setUsers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, canWrite]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      eventType: 'NEW_CONTRACT',
      description: '',
      approvedById: '',
    });
    setOpen(true);
  };

  const openEdit = (entry: any) => {
    setEditingId(entry.id);
    setForm({
      date: entry.date ? String(entry.date).slice(0, 10) : '',
      eventType: entry.eventType,
      description: entry.description ?? '',
      approvedById: entry.approvedBy?.id ?? '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.date)      { toast.error('Date is required'); return; }
    if (!form.eventType) { toast.error('Event type is required'); return; }
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        eventType: form.eventType,
        description: form.description.trim() || undefined,
        approvedById: form.approvedById || undefined,
      };
      if (editingId) {
        await employeeWorkHistoryApi.update(employeeId, editingId, payload);
        toast.success('Entry updated');
      } else {
        await employeeWorkHistoryApi.create(employeeId, payload);
        toast.success('Entry added');
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: any) => {
    const ok = await confirm({
      title: 'Delete work history entry?',
      description: `"${EVENT_META[entry.eventType]?.label ?? entry.eventType}" on ${formatDate(entry.date)} will be removed.`,
      confirmText: 'Delete',
      tone: 'destructive',
    });
    if (!ok) return;
    try {
      await employeeWorkHistoryApi.delete(employeeId, entry.id);
      toast.success('Entry deleted');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const handleAttach = async (entryId: string, file: File) => {
    setUploadingId(entryId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await employeeWorkHistoryApi.addAttachment(employeeId, entryId, fd);
      toast.success('Attachment uploaded');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveAttachment = async (entryId: string, attachmentId: string, name: string) => {
    const ok = await confirm({
      title: 'Remove attachment?',
      description: `"${name}" will be removed from this entry.`,
      confirmText: 'Remove',
      tone: 'destructive',
    });
    if (!ok) return;
    try {
      await employeeWorkHistoryApi.removeAttachment(employeeId, entryId, attachmentId);
      toast.success('Attachment removed');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Remove failed');
    }
  };

  const userOptions = useMemo(() => users.filter((u: any) => !u.deletedAt), [users]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />Work History
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Post-hire contract timeline — new contracts, probation, leave, termination. Separate from Workflow history.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />Add Entry
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-muted-foreground text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No work history yet. {canWrite && 'Add the first contract event to start the timeline.'}
          </div>
        ) : (
          <ol className="relative border-l-2 border-muted/60 ml-2 space-y-5">
            {entries.map((entry: any) => {
              const meta = EVENT_META[entry.eventType] ?? { label: entry.eventType, icon: FileText, tone: 'slate' };
              const Icon = meta.icon;
              return (
                <li key={entry.id} className="pl-5 relative">
                  <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-background ${TONE_DOT[meta.tone]}`} />
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
                            <Icon className="w-3 h-3 mr-1" />{meta.label}
                          </Badge>
                          <span className="text-sm font-medium">{formatDate(entry.date)}</span>
                        </div>
                        {entry.description && (
                          <p className="text-sm mt-2 whitespace-pre-wrap">{entry.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          {entry.createdBy && (
                            <span>Created by <strong className="text-foreground">{fullName(entry.createdBy)}</strong></span>
                          )}
                          {entry.approvedBy && (
                            <span>Approved by <strong className="text-foreground">{fullName(entry.approvedBy)}</strong></span>
                          )}
                          <span>· {formatDate(entry.createdAt)}</span>
                        </div>

                        {/* Attachments */}
                        {(entry.attachments?.length ?? 0) > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {entry.attachments.map((att: any) => (
                              <div key={att.id} className="flex items-center gap-1.5 px-2 py-1 border rounded bg-muted/30 text-xs">
                                <Paperclip className="w-3 h-3 text-muted-foreground" />
                                <a href={`${API_BASE}${att.fileUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[14rem]">
                                  {att.name}
                                </a>
                                <a href={`${API_BASE}${att.fileUrl}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                                  <Download className="w-3 h-3" />
                                </a>
                                {canWrite && (
                                  <button
                                    onClick={() => handleRemoveAttachment(entry.id, att.id, att.name)}
                                    className="text-red-400 hover:text-red-600"
                                    aria-label="Remove attachment"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {canWrite && (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Attach file — hidden native input driven by the paperclip icon. */}
                          <label className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted cursor-pointer" title="Attach file">
                            <Paperclip className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                              disabled={uploadingId === entry.id}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleAttach(entry.id, f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(entry)} title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(entry)} title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Work History Entry' : 'Add Work History Entry'}</DialogTitle>
            <DialogDescription>Post-hire contract event. Attachments can be added after saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wh-date" className="text-xs">Date *</Label>
                <Input id="wh-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Event Type *</Label>
                <Select value={form.eventType} onValueChange={(v) => setForm(f => ({ ...f, eventType: v as EventTypeValue }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="wh-desc" className="text-xs">Description</Label>
              <Input
                id="wh-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional — context, salary, reason, etc."
              />
            </div>
            <div>
              <Label className="text-xs">Approved By</Label>
              <Select value={form.approvedById || '__none__'} onValueChange={(v) => setForm(f => ({ ...f, approvedById: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__"><span className="text-muted-foreground">Not specified</span></SelectItem>
                  {userOptions.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{fullName(u) || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
