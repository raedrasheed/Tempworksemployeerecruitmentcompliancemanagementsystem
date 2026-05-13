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
import { attendanceApi, companyProfilesApi } from '../../services/api';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

const STATUS_OPTIONS = [
  { value: 'PRESENT',      label: 'Present (Odpracované)' },
  { value: 'ABSENT',       label: 'Absent (absencia)' },
  { value: 'VACATION',     label: 'Vacation (dovolenka)' },
  { value: 'HOLIDAY',      label: 'Public Holiday (sviatok)' },
  { value: 'SICK',         label: 'Sick Leave (platené voľno / lekár)' },
  { value: 'UNPAID_LEAVE', label: 'Unpaid Leave (neplatené voľno)' },
];

const INTERRUPTION_STATUS_OPTIONS = STATUS_OPTIONS.filter((o) => o.value !== 'PRESENT');

const statusColors: Record<string, string> = {
  PRESENT:      'bg-green-100 text-green-700 border-green-200',
  ABSENT:       'bg-orange-100 text-orange-700 border-orange-200',
  VACATION:     'bg-cyan-100 text-cyan-700 border-cyan-200',
  HOLIDAY:      'bg-purple-100 text-purple-700 border-purple-200',
  SICK:         'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  UNPAID_LEAVE: 'bg-red-100 text-red-700 border-red-200',
  OFF:          'bg-orange-100 text-orange-700 border-orange-200',
  LATE:         'bg-amber-100 text-amber-700 border-amber-200',
  ON_LEAVE:     'bg-blue-100 text-blue-700 border-blue-200',
  HALF_DAY:     'bg-purple-100 text-purple-700 border-purple-200',
};

const statusLabels: Record<string, string> = {
  PRESENT: 'Present', ABSENT: 'Absent', VACATION: 'Vacation', HOLIDAY: 'Public Holiday',
  SICK: 'Sick Leave', UNPAID_LEAVE: 'Unpaid Leave',
  OFF: 'Absent', LATE: 'Late', ON_LEAVE: 'On Leave', HALF_DAY: 'Half Day',
};

const LEAVE_STATUSES = new Set(['ABSENT', 'VACATION', 'HOLIDAY', 'SICK', 'UNPAID_LEAVE', 'OFF']);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calcHours(
  checkIn: string, checkOut: string,
  breakIn: string, breakOut: string,
  interruptionIn: string = '', interruptionOut: string = '',
): string {
  if (!checkIn || !checkOut) return '';
  const toMin = (s: string) => {
    if (!s) return NaN;
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
  if (interruptionIn && interruptionOut) {
    const iIn = toMin(interruptionIn);
    const iOut = toMin(interruptionOut);
    if (!isNaN(iIn) && !isNaN(iOut) && iOut > iIn) work -= (iOut - iIn);
  }
  if (work <= 0) return '';
  const h = Math.floor(work / 60);
  const m = work % 60;
  return m > 0 ? (h + m / 60).toFixed(2).replace(/\.?0+$/, '') : String(h);
}

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(Number(h))) return '—';
  const n = Number(h);
  return `${n.toFixed(1).replace(/\.0$/, '')}h`;
}

// ─── Slovak public holidays calendar ───────────────────────────────────────────
const SLOVAK_PUBLIC_HOLIDAYS: Record<string, string> = {
  '2024-01-01': 'Day of the Establishment of the Slovak Republic',
  '2024-01-06': 'Epiphany',
  '2024-03-29': 'Good Friday',
  '2024-04-01': 'Easter Monday',
  '2024-05-01': 'Labour Day',
  '2024-05-08': 'Day of Victory over Fascism',
  '2024-07-05': 'St. Cyril and Methodius Day',
  '2024-08-29': 'Slovak National Uprising Anniversary',
  '2024-09-01': 'Constitution Day',
  '2024-09-15': 'Day of Our Lady of Sorrows',
  '2024-11-01': 'All Saints\' Day',
  '2024-11-17': 'Struggle for Freedom and Democracy Day',
  '2024-12-24': 'Christmas Eve',
  '2024-12-25': 'Christmas Day',
  '2024-12-26': 'St. Stephen\'s Day',
  '2025-01-01': 'Day of the Establishment of the Slovak Republic',
  '2025-01-06': 'Epiphany',
  '2025-04-18': 'Good Friday',
  '2025-04-21': 'Easter Monday',
  '2025-05-01': 'Labour Day',
  '2025-05-08': 'Day of Victory over Fascism',
  '2025-07-05': 'St. Cyril and Methodius Day',
  '2025-08-29': 'Slovak National Uprising Anniversary',
  '2025-09-01': 'Constitution Day',
  '2025-09-15': 'Day of Our Lady of Sorrows',
  '2025-11-01': 'All Saints\' Day',
  '2025-11-17': 'Struggle for Freedom and Democracy Day',
  '2025-12-24': 'Christmas Eve',
  '2025-12-25': 'Christmas Day',
  '2025-12-26': 'St. Stephen\'s Day',
  '2026-01-01': 'Day of the Establishment of the Slovak Republic',
  '2026-01-06': 'Epiphany',
  '2026-04-03': 'Good Friday',
  '2026-04-06': 'Easter Monday',
  '2026-05-01': 'Labour Day',
  '2026-05-08': 'Day of Victory over Fascism',
  '2026-07-05': 'St. Cyril and Methodius Day',
  '2026-08-29': 'Slovak National Uprising Anniversary',
  '2026-09-01': 'Constitution Day',
  '2026-09-15': 'Day of Our Lady of Sorrows',
  '2026-11-01': 'All Saints\' Day',
  '2026-11-17': 'Struggle for Freedom and Democracy Day',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-26': 'St. Stephen\'s Day',
  '2027-01-01': 'Day of the Establishment of the Slovak Republic',
  '2027-01-06': 'Epiphany',
  '2027-03-26': 'Good Friday',
  '2027-03-29': 'Easter Monday',
  '2027-05-01': 'Labour Day',
  '2027-05-08': 'Day of Victory over Fascism',
  '2027-07-05': 'St. Cyril and Methodius Day',
  '2027-08-29': 'Slovak National Uprising Anniversary',
  '2027-09-01': 'Constitution Day',
  '2027-09-15': 'Day of Our Lady of Sorrows',
  '2027-11-01': 'All Saints\' Day',
  '2027-11-17': 'Struggle for Freedom and Democracy Day',
  '2027-12-24': 'Christmas Eve',
  '2027-12-25': 'Christmas Day',
  '2027-12-26': 'St. Stephen\'s Day',
  '2028-01-01': 'Day of the Establishment of the Slovak Republic',
  '2028-01-06': 'Epiphany',
  '2028-04-14': 'Good Friday',
  '2028-04-17': 'Easter Monday',
  '2028-05-01': 'Labour Day',
  '2028-05-08': 'Day of Victory over Fascism',
  '2028-07-05': 'St. Cyril and Methodius Day',
  '2028-08-29': 'Slovak National Uprising Anniversary',
  '2028-09-01': 'Constitution Day',
  '2028-09-15': 'Day of Our Lady of Sorrows',
  '2028-11-01': 'All Saints\' Day',
  '2028-11-17': 'Struggle for Freedom and Democracy Day',
  '2028-12-24': 'Christmas Eve',
  '2028-12-25': 'Christmas Day',
  '2028-12-26': 'St. Stephen\'s Day',
  '2029-01-01': 'Day of the Establishment of the Slovak Republic',
  '2029-01-06': 'Epiphany',
  '2029-03-30': 'Good Friday',
  '2029-04-02': 'Easter Monday',
  '2029-05-01': 'Labour Day',
  '2029-05-08': 'Day of Victory over Fascism',
  '2029-07-05': 'St. Cyril and Methodius Day',
  '2029-08-29': 'Slovak National Uprising Anniversary',
  '2029-09-01': 'Constitution Day',
  '2029-09-15': 'Day of Our Lady of Sorrows',
  '2029-11-01': 'All Saints\' Day',
  '2029-11-17': 'Struggle for Freedom and Democracy Day',
  '2029-12-24': 'Christmas Eve',
  '2029-12-25': 'Christmas Day',
  '2029-12-26': 'St. Stephen\'s Day',
  '2030-01-01': 'Day of the Establishment of the Slovak Republic',
  '2030-01-06': 'Epiphany',
  '2030-04-19': 'Good Friday',
  '2030-04-22': 'Easter Monday',
  '2030-05-01': 'Labour Day',
  '2030-05-08': 'Day of Victory over Fascism',
  '2030-07-05': 'St. Cyril and Methodius Day',
  '2030-08-29': 'Slovak National Uprising Anniversary',
  '2030-09-01': 'Constitution Day',
  '2030-09-15': 'Day of Our Lady of Sorrows',
  '2030-11-01': 'All Saints\' Day',
  '2030-11-17': 'Struggle for Freedom and Democracy Day',
  '2030-12-24': 'Christmas Eve',
  '2030-12-25': 'Christmas Day',
  '2030-12-26': 'St. Stephen\'s Day',
};

const isSlovakPublicHoliday = (date: string): boolean => date in SLOVAK_PUBLIC_HOLIDAYS;
const slovakPublicHolidayName = (date: string): string => SLOVAK_PUBLIC_HOLIDAYS[date] ?? '';

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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
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
  interruptionIn: string;
  interruptionOut: string;
  interruptionStatus: string;
  workingHours: string;
  notes: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface AttendanceSheetProps {
  /** Optional override; when omitted, the employee id comes from the
   *  route param. Lets the same screen render inside Employee Profile
   *  → Attendance & Time Sheets tab without the back button. */
  employeeId?: string;
  /** Hide the "Back to Attendance Sheets" header (used when embedded). */
  hideBackButton?: boolean;
}

export function AttendanceSheet({ employeeId: propEmployeeId, hideBackButton = false }: AttendanceSheetProps = {}) {
  const { t } = useTranslation('pages');
  const { t: tc } = useTranslation('common');
  const params = useParams<{ id: string }>();
  const id = propEmployeeId ?? params.id;
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const [lockedPeriods, setLockedPeriods] = useState<any[]>([]);

  const [editRecord, setEditRecord] = useState<any>(null);
  const [editDate, setEditDate] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    status: 'PRESENT',
    checkIn: '', checkOut: '',
    breakIn: '', breakOut: '',
    interruptionIn: '', interruptionOut: '', interruptionStatus: '',
    workingHours: '', notes: '',
  });

  const [deleteRecord, setDeleteRecord] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    const fallbackStatus = !record && isSlovakPublicHoliday(date) ? 'HOLIDAY' : 'PRESENT';
    setEditForm({
      status: record?.status ?? fallbackStatus,
      checkIn:  record?.checkIn  ?? '',
      checkOut: record?.checkOut ?? '',
      breakIn:  record?.breakIn  ?? '',
      breakOut: record?.breakOut ?? '',
      interruptionIn:     record?.interruptionIn     ?? '',
      interruptionOut:    record?.interruptionOut    ?? '',
      interruptionStatus: record?.interruptionStatus ?? '',
      workingHours: record?.workingHours != null ? String(record.workingHours) : '',
      notes: record?.notes ?? '',
    });
    setShowEditModal(true);
  };

  const handleFormChange = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => {
      const updated: EditForm = { ...prev, [field]: value };
      if (field === 'status' && LEAVE_STATUSES.has(value)) {
        updated.checkIn = '';
        updated.checkOut = '';
        updated.breakIn = '';
        updated.breakOut = '';
        updated.interruptionIn = '';
        updated.interruptionOut = '';
        updated.interruptionStatus = '';
        updated.workingHours = '0';
        return updated;
      }
      if (['checkIn', 'checkOut', 'breakIn', 'breakOut', 'interruptionIn', 'interruptionOut'].includes(field)) {
        const calculated = calcHours(
          updated.checkIn, updated.checkOut, updated.breakIn, updated.breakOut,
          updated.interruptionIn, updated.interruptionOut,
        );
        if (calculated) updated.workingHours = calculated;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isLeave = LEAVE_STATUSES.has(editForm.status);
      const payload: any = {
        status: editForm.status,
        checkIn:  isLeave ? null : (editForm.checkIn  || null),
        checkOut: isLeave ? null : (editForm.checkOut || null),
        breakIn:  isLeave ? null : (editForm.breakIn  || null),
        breakOut: isLeave ? null : (editForm.breakOut || null),
        interruptionIn:     isLeave ? null : (editForm.interruptionIn     || null),
        interruptionOut:    isLeave ? null : (editForm.interruptionOut    || null),
        interruptionStatus: isLeave ? null : (editForm.interruptionStatus || null),
        workingHours: editForm.workingHours ? Number(editForm.workingHours) : undefined,
        notes: editForm.notes || undefined,
      };
      if (editRecord?.id) {
        await attendanceApi.update(editRecord.id, payload);
        toast.success(t('attendance.toast.recordUpdated'));
      } else {
        await attendanceApi.upsert({ employeeId: id, date: editDate, ...payload });
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

  const currentLock = lockedPeriods.find((p) => p.year === year && p.month === month);
  const isLocked = !!currentLock;

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back button — hidden when embedded inside Employee Profile. */}
      {!hideBackButton && (
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
      )}

      {/* Toolbar card — matches AttendanceTab layout */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {loading ? <span className="text-muted-foreground">Loading…</span> : fullName}
              {isLocked && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 ms-2">
                  <Lock className="w-3 h-3 me-1" />Period Locked
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)}>
                <Download className="w-4 h-4 me-1" />Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowBulkFill(true)} disabled={isLocked}>
                <ClipboardList className="w-4 h-4 me-1" />Fill Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLockModal(true)}
                className={isLocked ? 'text-amber-700 hover:text-amber-800' : ''}
              >
                {isLocked
                  ? <Unlock className="w-4 h-4 me-1" />
                  : <Lock className="w-4 h-4 me-1" />}
                {isLocked ? 'Unlock' : 'Lock'} Period
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Employee info + lock notice */}
        {(employee || isLocked) && (
          <CardContent className="pt-0 space-y-3">
            {employee && (
              <div className="flex items-center gap-3">
                {employee.photoUrl ? (
                  <img
                    src={
                      employee.photoUrl.startsWith('http')
                        ? employee.photoUrl
                        : `${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${employee.photoUrl}`
                    }
                    alt={fullName}
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-bold shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-sm text-muted-foreground">
                  {employee.status && (
                    <Badge
                      variant="outline"
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
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    ID: {employee.employeeNumber ?? '—'}
                  </span>
                  {(employee.agency?.name ?? employee.agencyName) && (
                    <span>Agency: {employee.agency?.name ?? employee.agencyName}</span>
                  )}
                  {employee.email && <span>{employee.email}</span>}
                </div>
              </div>
            )}
            {isLocked && (
              <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <strong>Period locked.</strong> Attendance edits are disabled for {MONTH_NAMES[month - 1]} {year}.
                  Use the "Unlock Period" button to reopen.
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Summary tiles — same SummaryTile style as AttendanceTab */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryTile
          label="Present"
          value={fmtHours(summary?.presentHours)}
          subValue={summary?.presentCount ? `${summary.presentCount} days` : undefined}
          tone="emerald"
        />
        <SummaryTile
          label="Public Holiday"
          value={fmtHours(summary?.holidayHours)}
          subValue={summary?.holidayCount ? `${summary.holidayCount} days` : undefined}
          tone="purple"
        />
        <SummaryTile
          label="Vacation"
          value={fmtHours(summary?.vacationHours)}
          subValue={summary?.vacationCount ? `${summary.vacationCount} days` : undefined}
          tone="blue"
        />
        <SummaryTile
          label="Sick Leave"
          value={fmtHours(summary?.sickHours)}
          subValue={summary?.sickCount ? `${summary.sickCount} days` : undefined}
          tone="violet"
        />
        <SummaryTile
          label="Unpaid Leave"
          value={fmtHours(summary?.unpaidLeaveHours)}
          subValue={summary?.unpaidLeaveCount ? `${summary.unpaidLeaveCount} days` : undefined}
          tone="orange"
        />
        <SummaryTile
          label="Absent"
          value={fmtHours(summary?.absentHours)}
          subValue={summary?.absentCount ? `${summary.absentCount} days` : undefined}
          tone="red"
        />
        <SummaryTile
          label="Monthly Total"
          value={fmtHours(summary?.monthlyTotalHours)}
          tone="slate"
        />
      </div>

      {/* Daily attendance table — same table style as AttendanceTab */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-start px-3 py-2 font-medium w-10">#</th>
                  <th className="text-start px-3 py-2 font-medium">Date</th>
                  <th className="text-start px-3 py-2 font-medium">Status</th>
                  <th className="text-start px-3 py-2 font-medium">Check In</th>
                  <th className="text-start px-3 py-2 font-medium">Check Out</th>
                  <th className="text-start px-3 py-2 font-medium">Break In</th>
                  <th className="text-start px-3 py-2 font-medium">Break Out</th>
                  <th className="text-start px-3 py-2 font-medium">Interr. In</th>
                  <th className="text-start px-3 py-2 font-medium">Interr. Out</th>
                  <th className="text-end px-3 py-2 font-medium">Total</th>
                  <th className="text-start px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-muted-foreground">
                      Loading attendance records…
                    </td>
                  </tr>
                ) : (
                  days.map((day) => {
                    const record = recordByDate(day.date);
                    const isHoliday = isSlovakPublicHoliday(day.date);
                    return (
                      <tr
                        key={day.date}
                        className={`border-t hover:bg-muted/20 ${
                          isHoliday ? 'bg-purple-50/40' : day.isWeekend ? 'bg-muted/10' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 text-muted-foreground">{day.dayNum}</td>
                        <td className="px-3 py-1.5">
                          <div>
                            <span>
                              {day.date}
                              {day.isWeekend && (
                                <span className="text-xs text-muted-foreground ms-1">· {day.dayName}</span>
                              )}
                            </span>
                            {isHoliday && (
                              <div className="text-[10px] text-purple-700 italic">
                                {slovakPublicHolidayName(day.date)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          {record?.status ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${statusColors[record.status] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {statusLabels[record.status] ?? record.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{record?.checkIn  ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">{record?.checkOut ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">{record?.breakIn  ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">{record?.breakOut ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">{record?.interruptionIn ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono">
                          {record?.interruptionOut ? (
                            <div className="leading-tight">
                              <div>{record.interruptionOut}</div>
                              {record.interruptionStatus && (
                                <div className="text-[10px] text-muted-foreground italic">
                                  → {statusLabels[record.interruptionStatus] ?? record.interruptionStatus}
                                </div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-end font-medium">
                          {record?.workingHours != null
                            ? `${Number(record.workingHours).toFixed(2).replace(/\.?0+$/, '')}h`
                            : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate max-w-xs">
                          {record?.notes ?? ''}
                        </td>
                        <td className="px-3 py-1.5 text-end whitespace-nowrap">
                          {record ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => openEditModal(record, day.date)}
                                disabled={isLocked}
                              >
                                <Pencil className="w-3.5 h-3.5 me-1" />Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => { setDeleteRecord(record); setShowDeleteModal(true); }}
                                disabled={isLocked}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditModal(null, day.date)}
                              disabled={isLocked}
                            >
                              <Plus className="w-3.5 h-3.5 me-1" />Add
                            </Button>
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

      {/* Edit / Add Attendance Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editRecord
                ? <><Pencil className="w-5 h-5 text-blue-600" />Edit Attendance</>
                : <><Plus className="w-5 h-5 text-blue-600" />Add Attendance</>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm font-medium">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {editDate}
                {isSlovakPublicHoliday(editDate) && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                    sviatok · {slovakPublicHolidayName(editDate)}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => handleFormChange('status', v)}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editForm.status === 'PRESENT' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-checkin">Check In</Label>
                    <Input id="edit-checkin" type="time" value={editForm.checkIn} onChange={(e) => handleFormChange('checkIn', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-checkout">Check Out</Label>
                    <Input id="edit-checkout" type="time" value={editForm.checkOut} onChange={(e) => handleFormChange('checkOut', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-breakin">Break In (zac pres)</Label>
                    <Input id="edit-breakin" type="time" value={editForm.breakIn} onChange={(e) => handleFormChange('breakIn', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-breakout">Break Out (kon pres)</Label>
                    <Input id="edit-breakout" type="time" value={editForm.breakOut} onChange={(e) => handleFormChange('breakOut', e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    In-day interruption (zac prer / kon prer)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Optional. Records hours the employee was away during the day (e.g. doctor's visit).
                    The duration is deducted from the daily total and added to the selected leave status's monthly total.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-interruption-in" className="text-xs">Interruption In (zac prer)</Label>
                      <Input id="edit-interruption-in" type="time" value={editForm.interruptionIn} onChange={(e) => handleFormChange('interruptionIn', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-interruption-out" className="text-xs">Interruption Out (kon prer)</Label>
                      <Input id="edit-interruption-out" type="time" value={editForm.interruptionOut} onChange={(e) => handleFormChange('interruptionOut', e.target.value)} />
                    </div>
                  </div>
                  {(editForm.interruptionIn || editForm.interruptionOut) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Attribute interruption to</Label>
                      <Select value={editForm.interruptionStatus || ''} onValueChange={(v) => handleFormChange('interruptionStatus', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a leave status" />
                        </SelectTrigger>
                        <SelectContent>
                          {INTERRUPTION_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}

            {editForm.status !== 'PRESENT' && (
              <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
                On non-Present statuses, all time fields are recorded as <strong>0:00</strong>. The day counts as
                <strong> 8 hours</strong> towards the monthly total for the selected status — Check-in / Check-out /
                Break inputs are intentionally hidden.
              </div>
            )}

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
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>Cancel</Button>
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
      <Dialog
        open={showDeleteModal}
        onOpenChange={(open) => { if (!open) { setShowDeleteModal(false); setDeleteRecord(null); } }}
      >
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

// ─── Summary Tile — same component pattern as AttendanceTab ───────────────────

function SummaryTile({
  label, value, subValue, tone,
}: {
  label: string;
  value: string;
  subValue?: string;
  tone: string;
}) {
  const palette: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    blue:    'text-blue-700 bg-blue-50 border-blue-200',
    red:     'text-red-700 bg-red-50 border-red-200',
    violet:  'text-violet-700 bg-violet-50 border-violet-200',
    slate:   'text-slate-700 bg-slate-50 border-slate-200',
    purple:  'text-purple-700 bg-purple-50 border-purple-200',
    orange:  'text-orange-700 bg-orange-50 border-orange-200',
  };
  return (
    <div className={`border rounded-md px-3 py-2 ${palette[tone] ?? palette.slate}`}>
      <p className="text-xs">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {subValue && <p className="text-xs opacity-70 mt-0.5">{subValue}</p>}
    </div>
  );
}
