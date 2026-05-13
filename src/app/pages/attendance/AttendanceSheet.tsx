import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Clock,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ClipboardList,
  Trash2,
  Lock,
  Unlock,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiError } from '../../../i18n/apiError';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { attendanceApi, companyProfilesApi } from '../../services/api';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

const STATUS_OPTIONS = [
  { value: 'PRESENT',      label: 'Present' },
  { value: 'ABSENT',       label: 'Absent' },
  { value: 'VACATION',     label: 'Vacation' },
  { value: 'HOLIDAY',      label: 'Public Holiday' },
  { value: 'SICK',         label: 'Sick' },
  { value: 'UNPAID_LEAVE', label: 'Unpaid Leave' },
  { value: 'OFF',          label: 'Off' },
];

const STATUS_LEGEND: { value: string; label: string; description: string }[] = [
  { value: 'PRESENT',      label: 'Present',        description: 'Day worked' },
  { value: 'ABSENT',       label: 'Absent',         description: 'No-show, not approved' },
  { value: 'VACATION',     label: 'Vacation',       description: 'Planned day off (paid)' },
  { value: 'HOLIDAY',      label: 'Public Holiday', description: 'Official leave per the Slovak Annual Holiday Calendar' },
  { value: 'SICK',         label: 'Sick',           description: 'Sick leave' },
  { value: 'UNPAID_LEAVE', label: 'Unpaid Leave',   description: 'Unpaid leave / absence' },
  { value: 'OFF',          label: 'Off',            description: 'Non-working day (weekend etc.)' },
];

const statusColors: Record<string, string> = {
  PRESENT:      'bg-green-100 text-green-700 border-green-200',
  ABSENT:       'bg-red-100 text-red-700 border-red-200',
  VACATION:     'bg-blue-100 text-blue-700 border-blue-200',
  HOLIDAY:      'bg-amber-100 text-amber-700 border-amber-200',
  SICK:         'bg-purple-100 text-purple-700 border-purple-200',
  UNPAID_LEAVE: 'bg-slate-100 text-slate-700 border-slate-200',
  OFF:          'bg-gray-100 text-gray-600 border-gray-200',
  // Legacy
  LATE:         'bg-amber-100 text-amber-700 border-amber-200',
  ON_LEAVE:     'bg-blue-100 text-blue-700 border-blue-200',
  HALF_DAY:     'bg-purple-100 text-purple-700 border-purple-200',
};

const statusLabels: Record<string, string> = {
  PRESENT: 'Present', ABSENT: 'Absent', VACATION: 'Vacation', HOLIDAY: 'Public Holiday',
  SICK: 'Sick', UNPAID_LEAVE: 'Unpaid Leave', OFF: 'Off',
  // Legacy values still rendered when stored
  LATE: 'Late', ON_LEAVE: 'On Leave', HALF_DAY: 'Half Day',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns decimal hours: (out-in) - (breakOut-breakIn). Empty string when inputs missing. */
function calcHours(checkIn: string, checkOut: string, breakIn: string, breakOut: string): string {
  if (!checkIn || !checkOut) return '';
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return isNaN(h) ? NaN : h * 60 + (m || 0);
  };
  const inMin = toMin(checkIn);
  const outMin = toMin(checkOut);
  if (isNaN(inMin) || isNaN(outMin) || outMin <= inMin) return '';
  let work = outMin - inMin;
  if (breakIn && breakOut) {
    const bIn = toMin(breakIn);
    const bOut = toMin(breakOut);
    if (!isNaN(bIn) && !isNaN(bOut) && bOut > bIn) work -= (bOut - bIn);
  }
  if (work <= 0) return '';
  const h = Math.floor(work / 60);
  const m = work % 60;
  return m > 0 ? (h + m / 60).toFixed(2).replace(/\.?0+$/, '') : String(h);
}

// ─── Bulk Fill Modal ───────────────────────────────────────────────────────────

interface BulkFillModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: string | undefined;
  month: number;
  year: number;
  days: DayEntry[];
  records: any[];
  onSuccess: () => void;
}

function BulkFillModal({
  open, onClose, employeeId, month, year, days, records, onSuccess,
}: BulkFillModalProps) {
  const { t: tc } = useTranslation('common');
  const [status, setStatus] = useState('PRESENT');
  const [checkIn, setCheckIn] = useState('08:00');
  const [checkOut, setCheckOut] = useState('16:00');
  const [breakIn, setBreakIn] = useState('12:00');
  const [breakOut, setBreakOut] = useState('12:30');
  const [overwrite, setOverwrite] = useState(false);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [saving, setSaving] = useState(false);

  const isWorkStatus = status === 'PRESENT';
  const autoHours = isWorkStatus ? calcHours(checkIn, checkOut, breakIn, breakOut) : '';

  const targetDays = days.filter((d) => {
    if (skipWeekends && d.isWeekend) return false;
    if (overwrite) return true;
    return !records.find((r) => r.date?.slice(0, 10) === d.date);
  });

  const handleBulkFill = async () => {
    if (!employeeId) return;
    if (targetDays.length === 0) {
      toast.info('No days to fill');
      return;
    }
    setSaving(true);
    try {
      await attendanceApi.bulkApply({
        employeeId,
        status,
        dates: targetDays.map((d) => d.date),
        checkIn:  isWorkStatus ? checkIn : undefined,
        checkOut: isWorkStatus ? checkOut : undefined,
        breakIn:  isWorkStatus ? breakIn : undefined,
        breakOut: isWorkStatus ? breakOut : undefined,
        overwriteExisting: overwrite,
      });
      toast.success(`Filled ${targetDays.length} days as ${statusLabels[status] ?? status}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(apiError(err, tc('toast.operationFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Fill Month — {MONTH_NAMES[month - 1]} {year}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Default Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isWorkStatus && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Check In</Label>
                  <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Check Out</Label>
                  <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Break In</Label>
                  <Input type="time" value={breakIn} onChange={(e) => setBreakIn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Break Out</Label>
                  <Input type="time" value={breakOut} onChange={(e) => setBreakOut(e.target.value)} />
                </div>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-2.5">
                <Clock className="w-3.5 h-3.5 inline me-1.5 -mt-0.5" />
                Computed hours per day:{' '}
                <strong className="text-foreground">{autoHours || '—'}</strong>
                <span className="ms-1 text-xs">(= check-out − check-in − break)</span>
              </div>
            </>
          )}

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              Skip weekends
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              Overwrite existing records
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            This will affect <strong>{targetDays.length}</strong> day(s).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleBulkFill} disabled={saving || targetDays.length === 0}>
            {saving ? 'Filling…' : `Fill ${targetDays.length} Days`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lock Period Modal ────────────────────────────────────────────────────────

function LockPeriodModal({
  open, onClose, year, month, isLocked, lockId, onChanged,
}: {
  open: boolean; onClose: () => void; year: number; month: number;
  isLocked: boolean; lockId?: string; onChanged: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const action = isLocked ? 'unlock' : 'lock';

  const handle = async () => {
    setBusy(true);
    try {
      if (isLocked && lockId) {
        await attendanceApi.unlockPeriod(lockId);
        toast.success(`Period unlocked — ${MONTH_NAMES[month - 1]} ${year}`);
      } else {
        await attendanceApi.lockPeriod({ year, month, reason: reason || undefined });
        toast.success(`Period locked — ${MONTH_NAMES[month - 1]} ${year}`);
      }
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(apiError(err, `Failed to ${action}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLocked ? <Unlock className="w-5 h-5 text-amber-600" /> : <Lock className="w-5 h-5 text-red-600" />}
            {isLocked ? 'Unlock' : 'Lock'} Period — {MONTH_NAMES[month - 1]} {year}
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-3 text-sm">
          {isLocked ? (
            <p className="text-muted-foreground">
              Unlocking allows attendance for this month to be edited again. Use only when you need to correct payroll data after the period was sealed.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                Locking prevents any further additions, edits, or deletions of attendance for this month. Use this after payroll is finalized to seal the period against retrospective changes.
              </p>
              <div className="space-y-1.5">
                <Label>Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Payroll finalized for the month" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={isLocked ? 'outline' : 'destructive'} onClick={handle} disabled={busy}>
            {busy ? '…' : isLocked ? 'Unlock' : 'Lock Period'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({
  open, onClose, employeeId, month, year, employeeName,
}: {
  open: boolean; onClose: () => void; employeeId: string;
  month: number; year: number; employeeName: string;
}) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileId, setProfileId] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    companyProfilesApi.list().then((r) => {
      setProfiles(r ?? []);
      if (r && r.length > 0 && !profileId) setProfileId(r[0].id);
    }).catch(() => setProfiles([]));
  }, [open]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await attendanceApi.exportExcel({
        employeeId, month, year,
        companyProfileId: profileId || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheet-${employeeName.replace(/\s+/g, '-')}-${year}-${String(month).padStart(2, '0')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Timesheet exported');
      onClose();
    } catch (err: any) {
      toast.error(apiError(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            Export Timesheet
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3 text-sm">
          <div className="rounded-md bg-muted/40 p-3 text-xs">
            <div><strong>{employeeName}</strong></div>
            <div className="text-muted-foreground">{MONTH_NAMES[month - 1]} {year}</div>
          </div>
          <div className="space-y-1.5">
            <Label>Company Header</Label>
            <Select value={profileId || '__none__'} onValueChange={(v) => setProfileId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select company details" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No company header</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The selected company's details will appear in the Excel header. Manage profiles under Settings → Company Profiles.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exporting}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 me-1" />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DayEntry {
  date: string;
  dayName: string;
  dayNum: number;
  isWeekend: boolean;
}

interface EditForm {
  status: string;
  checkIn: string;
  checkOut: string;
  breakIn: string;
  breakOut: string;
  workingHours: string;
  notes: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AttendanceSheet() {
  const { t } = useTranslation('pages');
  const { t: tc } = useTranslation('common');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data state
  const [employee, setEmployee] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Lock state
  const [lockedPeriods, setLockedPeriods] = useState<any[]>([]);

  // Edit modal state
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editDate, setEditDate] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    status: 'PRESENT',
    checkIn: '',
    checkOut: '',
    breakIn: '',
    breakOut: '',
    workingHours: '',
    notes: '',
  });

  // Delete confirmation state
  const [deleteRecord, setDeleteRecord] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Modals
  const [showBulkFill, setShowBulkFill] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // ── Day generation ─────────────────────────────────────────────────────────────

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: DayEntry[] = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      dayName: d.toLocaleDateString('en', { weekday: 'short' }),
      dayNum: i + 1,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [result, locks] = await Promise.all([
        attendanceApi.getEmployeeAttendance(id, { month, year }),
        attendanceApi.listLockedPeriods().catch(() => []),
      ]);
      setEmployee(result?.employee ?? null);
      setRecords(result?.records ?? []);
      setSummary(result?.summary ?? {});
      setLockedPeriods(locks ?? []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [id, month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Edit helpers ───────────────────────────────────────────────────────────────

  const openEditModal = (record: any, date: string) => {
    setEditRecord(record ?? null);
    setEditDate(date);
    setEditForm({
      status: record?.status ?? 'PRESENT',
      checkIn:  record?.checkIn  ?? '',
      checkOut: record?.checkOut ?? '',
      breakIn:  record?.breakIn  ?? '',
      breakOut: record?.breakOut ?? '',
      workingHours: record?.workingHours != null ? String(record.workingHours) : '',
      notes: record?.notes ?? '',
    });
    setShowEditModal(true);
  };

  const handleFormChange = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate working hours when any time input changes.
      if (['checkIn', 'checkOut', 'breakIn', 'breakOut'].includes(field)) {
        const calculated = calcHours(
          updated.checkIn, updated.checkOut, updated.breakIn, updated.breakOut,
        );
        if (calculated) updated.workingHours = calculated;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        status: editForm.status,
        checkIn:  editForm.checkIn  || undefined,
        checkOut: editForm.checkOut || undefined,
        breakIn:  editForm.breakIn  || undefined,
        breakOut: editForm.breakOut || undefined,
        workingHours: editForm.workingHours ? Number(editForm.workingHours) : undefined,
        notes: editForm.notes || undefined,
      };

      if (editRecord?.id) {
        await attendanceApi.update(editRecord.id, payload);
        toast.success(t('attendance.toast.recordUpdated'));
      } else {
        await attendanceApi.upsert({
          employeeId: id,
          date: editDate,
          ...payload,
        });
        toast.success(t('attendance.toast.recordSaved'));
      }

      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(apiError(err, tc('toast.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRecord?.id) return;
    setDeleting(true);
    try {
      await attendanceApi.delete(deleteRecord.id);
      toast.success(t('attendance.toast.recordDeleted'));
      setShowDeleteModal(false);
      setDeleteRecord(null);
      fetchData();
    } catch (err: any) {
      toast.error(apiError(err, tc('toast.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────────

  const fullName = employee
    ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()
    : '…';
  const initials = employee
    ? `${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const recordByDate = (date: string) =>
    records.find((r) => r.date?.slice(0, 10) === date);

  const totalHoursDisplay =
    summary?.totalWorkingHours != null
      ? `${Number(summary.totalWorkingHours).toFixed(1)}h`
      : '—';

  const currentLock = lockedPeriods.find((p) => p.year === year && p.month === month);
  const isLocked = !!currentLock;

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/attendance')}
          className="text-muted-foreground hover:text-foreground -ms-2"
        >
          <ArrowLeft className="w-4 h-4 me-1" />
          Back to Attendance Sheets
        </Button>
      </div>

      {/* Employee header */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                <div className="h-4 w-60 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : employee ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start gap-5">
              {employee.photoUrl ? (
                <img
                  src={
                    employee.photoUrl.startsWith('http')
                      ? employee.photoUrl
                      : `${(
                          import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
                        ).replace('/api/v1', '')}${employee.photoUrl}`
                  }
                  alt={fullName}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-xl font-bold flex-shrink-0">
                  {initials}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-[#0F172A]">{fullName}</h2>
                  {employee.status && (
                    <Badge
                      className={
                        employee.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : employee.status === 'ON_LEAVE'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : employee.status === 'INACTIVE'
                          ? 'bg-gray-100 text-gray-600 border-gray-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }
                    >
                      {employee.status.replace(/_/g, ' ')}
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                      <Lock className="w-3 h-3 me-1" />
                      Period Locked
                    </Badge>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    ID: {employee.employeeNumber ?? '—'}
                  </span>
                  {(employee.agency?.name ?? employee.agencyName) && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Agency: {employee.agency?.name ?? employee.agencyName}
                    </span>
                  )}
                  {employee.email && <span>{employee.email}</span>}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkFill(true)}
                  disabled={isLocked}
                >
                  <ClipboardList className="w-4 h-4 me-1" />
                  Fill Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLockModal(true)}
                  className={isLocked ? 'text-amber-700 hover:text-amber-800' : 'text-red-700 hover:text-red-800'}
                >
                  {isLocked ? <Unlock className="w-4 h-4 me-1" /> : <Lock className="w-4 h-4 me-1" />}
                  {isLocked ? 'Unlock' : 'Lock'} Period
                </Button>
                <Button size="sm" onClick={() => setShowExportModal(true)}>
                  <Download className="w-4 h-4 me-1" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchData}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Month / Year selectors */}
      <div className="flex items-end gap-3">
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[110px]">
          <Label className="text-xs text-muted-foreground">Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { key: 'presentCount', label: 'Present', color: 'bg-green-100 text-green-700', icon: CheckCircle },
          { key: 'absentCount', label: 'Absent', color: 'bg-red-100 text-red-700', icon: XCircle },
          { key: 'vacationCount', label: 'Vacation', color: 'bg-blue-100 text-blue-700', icon: Calendar },
          { key: 'holidayCount', label: 'Public Holiday', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
          { key: 'sickCount', label: 'Sick', color: 'bg-purple-100 text-purple-700', icon: AlertCircle },
          { key: 'totalWorkingHours', label: 'Total Hours', color: 'bg-slate-100 text-slate-700', icon: Clock },
        ].map(({ key, label, color, icon: Icon }) => (
          <Card key={key} className="border">
            <CardContent className="p-3">
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${color}`}>
                <Icon className="w-3 h-3" />
                {label}
              </div>
              <p className="text-2xl font-bold text-[#0F172A]">
                {key === 'totalWorkingHours'
                  ? totalHoursDisplay
                  : (summary?.[key] ?? 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Daily Attendance — {MONTH_NAMES[month - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
              <p>Loading attendance records…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead className="w-16">Day</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-24">Check In</TableHead>
                    <TableHead className="w-24">Check Out</TableHead>
                    <TableHead className="w-24">Break In</TableHead>
                    <TableHead className="w-24">Break Out</TableHead>
                    <TableHead className="w-20">Total Hours</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-end w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((day) => {
                    const record = recordByDate(day.date);
                    const isWeekend = day.isWeekend;

                    return (
                      <TableRow
                        key={day.date}
                        className={
                          isWeekend
                            ? 'bg-muted/20 hover:bg-muted/30'
                            : 'hover:bg-muted/10'
                        }
                      >
                        <TableCell className="font-medium text-sm text-[#0F172A]">
                          {day.date}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${isWeekend ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {day.dayName}
                          </span>
                        </TableCell>
                        <TableCell>
                          {record?.status ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${statusColors[record.status] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {statusLabels[record.status] ?? record.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-mono">{record?.checkIn  || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-sm font-mono">{record?.checkOut || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-sm font-mono">{record?.breakIn  || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-sm font-mono">{record?.breakOut || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-sm">
                          {record?.workingHours != null ? (
                            <span className="inline-flex items-center gap-1 text-slate-700">
                              <Clock className="w-3 h-3 opacity-50" />
                              {Number(record.workingHours).toFixed(2).replace(/\.?0+$/, '')}h
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {record?.notes || <span className="opacity-40">—</span>}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            {record ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(record, day.date)}
                                  className="h-7 px-2"
                                  disabled={isLocked}
                                >
                                  <Pencil className="w-3.5 h-3.5 me-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setDeleteRecord(record); setShowDeleteModal(true); }}
                                  className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  disabled={isLocked}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(null, day.date)}
                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                disabled={isLocked}
                              >
                                <Plus className="w-3.5 h-3.5 me-1" />
                                Add
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status legend */}
      <Card className="bg-muted/20 border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Status Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {STATUS_LEGEND.map((s) => (
              <li key={s.value} className="flex items-start gap-2">
                <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColors[s.value]}`}>
                  {s.label}
                </Badge>
                <span className="text-muted-foreground">{s.description}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Total Working Hours = Check-Out − Check-In − (Break-Out − Break-In)
          </p>
        </CardContent>
      </Card>

      {/* Edit / Add Attendance Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editRecord ? (
                <><Pencil className="w-5 h-5 text-blue-600" />Edit Attendance</>
              ) : (
                <><Plus className="w-5 h-5 text-blue-600" />Add Attendance</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm font-medium">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {editDate}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => handleFormChange('status', v)}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-checkin">Check In</Label>
                <Input
                  id="edit-checkin"
                  type="time"
                  value={editForm.checkIn}
                  onChange={(e) => handleFormChange('checkIn', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-checkout">Check Out</Label>
                <Input
                  id="edit-checkout"
                  type="time"
                  value={editForm.checkOut}
                  onChange={(e) => handleFormChange('checkOut', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-breakin">Break In</Label>
                <Input
                  id="edit-breakin"
                  type="time"
                  value={editForm.breakIn}
                  onChange={(e) => handleFormChange('breakIn', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-breakout">Break Out</Label>
                <Input
                  id="edit-breakout"
                  type="time"
                  value={editForm.breakOut}
                  onChange={(e) => handleFormChange('breakOut', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-hours">
                Total Working Hours
                <span className="text-xs text-muted-foreground ms-2">(auto-calculated)</span>
              </Label>
              <Input
                id="edit-hours"
                type="number"
                step="0.01"
                min="0"
                max="24"
                value={editForm.workingHours}
                onChange={(e) => handleFormChange('workingHours', e.target.value)}
                placeholder="e.g. 7.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Optional notes…"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editRecord ? 'Save Changes' : 'Add Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Fill Modal */}
      <BulkFillModal
        open={showBulkFill}
        onClose={() => setShowBulkFill(false)}
        employeeId={id}
        month={month}
        year={year}
        days={days}
        records={records}
        onSuccess={fetchData}
      />

      {/* Lock Period Modal */}
      <LockPeriodModal
        open={showLockModal}
        onClose={() => setShowLockModal(false)}
        year={year}
        month={month}
        isLocked={isLocked}
        lockId={currentLock?.id}
        onChanged={fetchData}
      />

      {/* Export Modal */}
      {id && (
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          employeeId={id}
          month={month}
          year={year}
          employeeName={fullName}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => { if (!open) { setShowDeleteModal(false); setDeleteRecord(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Attendance Record
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the attendance record for{' '}
              <strong>{deleteRecord?.date?.slice(0, 10)}</strong>?
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteRecord(null); }} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="w-4 h-4 me-1" />
              {deleting ? 'Deleting…' : 'Delete Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
