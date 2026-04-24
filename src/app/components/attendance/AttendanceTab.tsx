/**
 * AttendanceTab
 * ─────────────────────────────────────────────────────────────────
 * Self-contained component rendered:
 *  • inside EmployeeProfile → Attendance & Time Sheets tab
 *  • inside the global Attendance page once a driver is drilled in
 *
 * Surfaces everything a payroll operator needs for one employee in
 * one month:
 *  • daily timesheet table (date, status, check in/out, break
 *    in/out, total hours, notes) with inline edit
 *  • status dropdown limited to the five requested statuses
 *  • Bulk Entry action that applies one template to a date range or
 *    explicit date list (e.g. "mark the whole week as Present
 *    08:00-16:30")
 *  • Monthly Zeiterfassung Excel download scoped to this employee
 *  • Locked-period awareness — shows a red banner and disables edits
 *    when the displayed month is locked
 */
import { useState, useEffect, useMemo } from 'react';
import { attendanceApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import {
  Plus, Save, X, Download, Lock, Layers, Trash2, Calendar as CalendarIcon, Info,
} from 'lucide-react';

// ── Status metadata ────────────────────────────────────────────────────────────

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'OFF', 'VACATION', 'SICK'] as const;
type Status = typeof ATTENDANCE_STATUSES[number];
type AnyStatus = Status | 'LATE' | 'ON_LEAVE' | 'HALF_DAY' | 'HOLIDAY';

const STATUS_STYLE: Record<AnyStatus, string> = {
  PRESENT:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  ABSENT:   'bg-red-100 text-red-800 border-red-200',
  OFF:      'bg-slate-100 text-slate-700 border-slate-200',
  VACATION: 'bg-blue-100 text-blue-800 border-blue-200',
  SICK:     'bg-violet-100 text-violet-800 border-violet-200',
  LATE:     'bg-amber-100 text-amber-800 border-amber-200',
  ON_LEAVE: 'bg-blue-100 text-blue-800 border-blue-200',
  HALF_DAY: 'bg-violet-100 text-violet-800 border-violet-200',
  HOLIDAY:  'bg-slate-100 text-slate-700 border-slate-200',
};

const STATUS_LABEL: Record<AnyStatus, string> = {
  PRESENT: 'Present', ABSENT: 'Absent', OFF: 'Off', VACATION: 'Vacation', SICK: 'Sick',
  LATE: 'Late', ON_LEAVE: 'On Leave', HALF_DAY: 'Half Day', HOLIDAY: 'Holiday',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function monthOptions() {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ].map((label, i) => ({ value: i + 1, label }));
}

function yearOptions() {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now - 2; y <= now + 1; y++) years.push(y);
  return years;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatHours(h: number | null | undefined) {
  if (!h || !Number.isFinite(Number(h))) return '—';
  const n = Number(h);
  const totalMin = Math.round(n * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  employeeId: string;
  employeeName?: string;
  canWrite: boolean;
  /** If true, operator can lock/unlock payroll periods. */
  canLock?: boolean;
}

export function AttendanceTab({ employeeId, employeeName, canWrite, canLock = false }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Draft row — shared between "add new day" and inline-edit of an
  // existing row via the same dialog.
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [form, setForm] = useState<{
    date: string; status: Status; checkIn: string; checkOut: string;
    breakIn: string; breakOut: string; notes: string;
  }>({ date: '', status: 'PRESENT', checkIn: '', checkOut: '', breakIn: '', breakOut: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Bulk entry dialog state.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<{
    dateFrom: string; dateTo: string; status: Status;
    checkIn: string; checkOut: string; breakIn: string; breakOut: string;
    notes: string; overwriteExisting: boolean; skipWeekends: boolean;
  }>({
    dateFrom: '', dateTo: '', status: 'PRESENT',
    checkIn: '08:00', checkOut: '16:30', breakIn: '12:00', breakOut: '12:30',
    notes: '', overwriteExisting: true, skipWeekends: true,
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  // Lock awareness.
  const [lockedPeriods, setLockedPeriods] = useState<Array<{ id: string; year: number; month: number; reason?: string; lockedBy?: { firstName: string; lastName: string } | null }>>([]);
  const currentPeriodLock = useMemo(
    () => lockedPeriods.find(lp => lp.year === year && lp.month === month) ?? null,
    [lockedPeriods, year, month],
  );
  const effectiveCanWrite = canWrite && !currentPeriodLock;

  // ── Data load ───────────────────────────────────────────────────────────────
  const load = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [att, locks] = await Promise.all([
        attendanceApi.getEmployeeAttendance(employeeId, { month, year }),
        attendanceApi.listLockedPeriods().catch(() => []),
      ]);
      setRecords(Array.isArray(att?.records) ? att.records : []);
      setLockedPeriods(Array.isArray(locks) ? locks : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [employeeId, month, year]);

  // ── Per-day map for quick lookup. ──────────────────────────────────────────
  const byDay = useMemo(() => {
    const map = new Map<number, any>();
    for (const r of records) {
      const d = new Date(r.date);
      map.set(d.getUTCDate(), r);
    }
    return map;
  }, [records]);

  // Summary derived from the currently-loaded records.
  const summary = useMemo(() => {
    const s = { worked: 0, vacation: 0, absent: 0, sick: 0, off: 0 };
    for (const r of records) {
      const h = Number(r.workingHours ?? 0);
      switch (r.status) {
        case 'PRESENT':  s.worked   += h; break;
        case 'VACATION': s.vacation += 8; break;
        case 'ABSENT':   s.absent   += 8; break;
        case 'SICK':     s.sick     += 8; break;
        case 'OFF':      s.off      += 1; break;
      }
    }
    return s;
  }, [records]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openNew = (dateStr?: string) => {
    setEditingDate(dateStr ?? null);
    const existing = dateStr
      ? records.find(r => String(r.date).slice(0, 10) === dateStr)
      : null;
    setForm({
      date: dateStr ?? new Date().toISOString().slice(0, 10),
      status: (existing?.status as Status) ?? 'PRESENT',
      checkIn:  existing?.checkIn  ?? '',
      checkOut: existing?.checkOut ?? '',
      breakIn:  existing?.breakIn  ?? '',
      breakOut: existing?.breakOut ?? '',
      notes:    existing?.notes    ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.date) { toast.error('Pick a date'); return; }
    setSaving(true);
    try {
      await attendanceApi.upsert({
        employeeId,
        date: form.date,
        status: form.status,
        checkIn:  form.checkIn  || undefined,
        checkOut: form.checkOut || undefined,
        breakIn:  form.breakIn  || undefined,
        breakOut: form.breakOut || undefined,
        notes:    form.notes    || undefined,
      });
      toast.success(editingDate ? 'Attendance updated' : 'Attendance added');
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      await attendanceApi.delete(recordId);
      toast.success('Row deleted');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const handleBulkApply = async () => {
    if (!bulkForm.dateFrom || !bulkForm.dateTo) { toast.error('Set a date range'); return; }
    setBulkSaving(true);
    try {
      const res = await attendanceApi.bulkApply({
        employeeId,
        status: bulkForm.status,
        dateFrom: bulkForm.dateFrom,
        dateTo: bulkForm.dateTo,
        checkIn: bulkForm.checkIn || undefined,
        checkOut: bulkForm.checkOut || undefined,
        breakIn: bulkForm.breakIn || undefined,
        breakOut: bulkForm.breakOut || undefined,
        notes: bulkForm.notes || undefined,
        overwriteExisting: bulkForm.overwriteExisting,
        skipWeekends: bulkForm.skipWeekends,
      });
      const s = res?.summary ?? {};
      toast.success(`Applied: ${s.created ?? 0} new · ${s.updated ?? 0} updated · ${s.skipped_locked ?? 0} locked · ${s.skipped_existing ?? 0} skipped · ${s.errors ?? 0} errors`);
      setBulkOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Bulk apply failed');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await attendanceApi.exportExcel({ month, year, employeeId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safe = (employeeName ?? 'employee').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'employee';
      const mm = String(month).padStart(2, '0');
      a.download = `Zeiterfassung_${safe}_${year}-${mm}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  const handleLockToggle = async () => {
    try {
      if (currentPeriodLock) {
        await attendanceApi.unlockPeriod(currentPeriodLock.id);
        toast.success(`${monthOptions()[month - 1].label} ${year} unlocked`);
      } else {
        await attendanceApi.lockPeriod({ year, month });
        toast.success(`${monthOptions()[month - 1].label} ${year} locked`);
      }
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lock operation failed');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const dim = daysInMonth(year, month);
  const allDays: number[] = [];
  for (let d = 1; d <= dim; d++) allDays.push(d);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />Attendance &amp; Time Sheets
              {currentPeriodLock && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 ml-2">
                  <Lock className="w-3 h-3 mr-1" />Locked
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions().map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions().map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1" />Export
              </Button>
              {canWrite && (
                <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} disabled={!effectiveCanWrite}>
                  <Layers className="w-4 h-4 mr-1" />Bulk Entry
                </Button>
              )}
              {canWrite && (
                <Button size="sm" onClick={() => openNew()} disabled={!effectiveCanWrite}>
                  <Plus className="w-4 h-4 mr-1" />Add Day
                </Button>
              )}
              {canLock && (
                <Button size="sm" variant={currentPeriodLock ? 'outline' : 'outline'} onClick={handleLockToggle}>
                  <Lock className="w-4 h-4 mr-1" />{currentPeriodLock ? 'Unlock Month' : 'Lock Month'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {currentPeriodLock && (
          <CardContent className="pt-0">
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>This month is locked.</strong> Attendance records cannot be created, edited, or deleted until the lock is removed.
                {currentPeriodLock.lockedBy && (
                  <> Locked by {currentPeriodLock.lockedBy.firstName} {currentPeriodLock.lockedBy.lastName}.</>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile label="Working Hours" value={formatHours(summary.worked)} tone="emerald" />
        <SummaryTile label="Vacation" value={formatHours(summary.vacation)} tone="blue" />
        <SummaryTile label="Absence" value={formatHours(summary.absent)} tone="red" />
        <SummaryTile label="Sick" value={formatHours(summary.sick)} tone="violet" />
        <SummaryTile label="Off days" value={String(summary.off)} tone="slate" />
      </div>

      {/* Daily table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-16">Day</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Check-in</th>
                  <th className="text-left px-3 py-2 font-medium">Check-out</th>
                  <th className="text-left px-3 py-2 font-medium">Break-in</th>
                  <th className="text-left px-3 py-2 font-medium">Break-out</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                ) : (
                  allDays.map(d => {
                    const rec = byDay.get(d);
                    const dateObj = new Date(Date.UTC(year, month - 1, d));
                    const dateStr = dateObj.toISOString().slice(0, 10);
                    const isWeekend = [0, 6].includes(dateObj.getUTCDay());
                    return (
                      <tr key={d} className={`border-t hover:bg-muted/20 ${isWeekend ? 'bg-muted/10' : ''}`}>
                        <td className="px-3 py-1.5 text-muted-foreground">{d}</td>
                        <td className="px-3 py-1.5">
                          {dateStr}
                          {isWeekend && <span className="text-xs text-muted-foreground ml-1">· {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dateObj.getUTCDay()]}</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          {rec ? (
                            <Badge variant="outline" className={STATUS_STYLE[rec.status as AnyStatus] ?? ''}>
                              {STATUS_LABEL[rec.status as AnyStatus] ?? rec.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{rec?.checkIn  ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">{rec?.checkOut ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">{rec?.breakIn  ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">{rec?.breakOut ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{formatHours(rec?.workingHours)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate max-w-xs">{rec?.notes ?? ''}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {canWrite && effectiveCanWrite && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openNew(dateStr)}>
                                {rec ? 'Edit' : 'Add'}
                              </Button>
                              {rec && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(rec.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDate ? 'Edit Attendance' : 'Add Attendance'}</DialogTitle>
            <DialogDescription>
              Total Hours = (Check-out − Check-in) − (Break-out − Break-in). Off / Vacation / Sick / Absent rows record zero working hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} disabled={!!editingDate} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as Status }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ATTENDANCE_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.status === 'PRESENT' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Check-in</Label>
                    <Input type="time" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Check-out</Label>
                    <Input type="time" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Break-in</Label>
                    <Input type="time" value={form.breakIn} onChange={e => setForm(f => ({ ...f, breakIn: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Break-out</Label>
                    <Input type="time" value={form.breakOut} onChange={e => setForm(f => ({ ...f, breakOut: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk entry dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !bulkSaving && setBulkOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Entry</DialogTitle>
            <DialogDescription>
              Apply the same status + times to every date in the range. Locked-month dates are automatically skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={bulkForm.dateFrom} onChange={e => setBulkForm(f => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={bulkForm.dateTo} onChange={e => setBulkForm(f => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={bulkForm.status} onValueChange={(v) => setBulkForm(f => ({ ...f, status: v as Status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {bulkForm.status === 'PRESENT' && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Check-in</Label> <Input type="time" value={bulkForm.checkIn} onChange={e => setBulkForm(f => ({ ...f, checkIn: e.target.value }))} /></div>
                <div><Label className="text-xs">Check-out</Label><Input type="time" value={bulkForm.checkOut} onChange={e => setBulkForm(f => ({ ...f, checkOut: e.target.value }))} /></div>
                <div><Label className="text-xs">Break-in</Label> <Input type="time" value={bulkForm.breakIn} onChange={e => setBulkForm(f => ({ ...f, breakIn: e.target.value }))} /></div>
                <div><Label className="text-xs">Break-out</Label><Input type="time" value={bulkForm.breakOut} onChange={e => setBulkForm(f => ({ ...f, breakOut: e.target.value }))} /></div>
              </div>
            )}
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={bulkForm.notes} onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={bulkForm.overwriteExisting} onCheckedChange={c => setBulkForm(f => ({ ...f, overwriteExisting: !!c }))} />
                Overwrite existing rows in range
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={bulkForm.skipWeekends} onCheckedChange={c => setBulkForm(f => ({ ...f, skipWeekends: !!c }))} />
                Skip Saturdays &amp; Sundays
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button onClick={handleBulkApply} disabled={bulkSaving}><Layers className="w-4 h-4 mr-2" />{bulkSaving ? 'Applying…' : 'Apply'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'blue' | 'red' | 'violet' | 'slate' }) {
  const palette: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    blue:    'text-blue-700 bg-blue-50 border-blue-200',
    red:     'text-red-700 bg-red-50 border-red-200',
    violet:  'text-violet-700 bg-violet-50 border-violet-200',
    slate:   'text-slate-700 bg-slate-50 border-slate-200',
  };
  return (
    <div className={`border rounded-md px-3 py-2 ${palette[tone]}`}>
      <p className="text-xs">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
