import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ClipboardList,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { attendanceApi } from '../../services/api';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_OPTIONS = [
  { value: 'PRESENT',  label: 'Present' },
  { value: 'ABSENT',   label: 'Absent' },
  { value: 'OFF',      label: 'Off' },
  { value: 'VACATION', label: 'Vacation' },
  { value: 'SICK',     label: 'Sick' },
];

const statusColors: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 border-green-200',
  ABSENT: 'bg-red-100 text-red-700 border-red-200',
  LATE: 'bg-amber-100 text-amber-700 border-amber-200',
  ON_LEAVE: 'bg-blue-100 text-blue-700 border-blue-200',
  HALF_DAY: 'bg-purple-100 text-purple-700 border-purple-200',
  HOLIDAY: 'bg-gray-100 text-gray-600 border-gray-200',
};

const statusLabels: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  ON_LEAVE: 'On Leave',
  HALF_DAY: 'Half Day',
  HOLIDAY: 'Holiday',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calcHours(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return '';
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  if (isNaN(inH) || isNaN(outH)) return '';
  const totalMins = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMins <= 0) return '';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}.${Math.round((m / 60) * 10)}` : String(h);
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
  open,
  onClose,
  employeeId,
  month,
  year,
  days,
  records,
  onSuccess,
}: BulkFillModalProps) {
  const [status, setStatus] = useState('PRESENT');
  const [overwrite, setOverwrite] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyDays = days.filter(
    (d) => !records.find((r) => r.date?.slice(0, 10) === d.date),
  );
  const targetDays = overwrite ? days.filter((d) => !d.isWeekend) : emptyDays.filter((d) => !d.isWeekend);

  const handleBulkFill = async () => {
    if (targetDays.length === 0) {
      toast.info('No days to fill.');
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        targetDays.map((d) =>
          attendanceApi.upsert({
            employeeId,
            date: d.date,
            status,
          }),
        ),
      );
      toast.success(`Filled ${targetDays.length} day(s) as ${statusLabels[status]}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Bulk fill failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Fill Month
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Quickly fill{' '}
            <strong>
              {MONTH_NAMES[month - 1]} {year}
            </strong>{' '}
            with a default status for all non-weekend days.
          </p>

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

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="overwrite-existing"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="overwrite-existing" className="cursor-pointer text-sm">
              Overwrite existing records
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">
            This will affect{' '}
            <strong>{targetDays.length}</strong> day(s) (weekends excluded
            {!overwrite ? ', existing records preserved' : ''}).
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
  workingHours: string;
  notes: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AttendanceSheet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data state
  const [employee, setEmployee] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editDate, setEditDate] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    status: 'PRESENT',
    checkIn: '',
    checkOut: '',
    workingHours: '',
    notes: '',
  });

  // Delete confirmation state
  const [deleteRecord, setDeleteRecord] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Bulk fill modal
  const [showBulkFill, setShowBulkFill] = useState(false);

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
      const result = await attendanceApi.getEmployeeAttendance(id, { month, year });
      setEmployee(result?.employee ?? null);
      setRecords(result?.records ?? []);
      setSummary(result?.summary ?? {});
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [id, month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Month navigation ───────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // ── Edit helpers ───────────────────────────────────────────────────────────────

  const openEditModal = (record: any, date: string) => {
    setEditRecord(record ?? null);
    setEditDate(date);
    setEditForm({
      status: record?.status ?? 'PRESENT',
      checkIn: record?.checkIn ?? '',
      checkOut: record?.checkOut ?? '',
      workingHours: record?.workingHours != null ? String(record.workingHours) : '',
      notes: record?.notes ?? '',
    });
    setShowEditModal(true);
  };

  const handleFormChange = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate working hours when check in/out change
      if (field === 'checkIn' || field === 'checkOut') {
        const newCheckIn = field === 'checkIn' ? value : prev.checkIn;
        const newCheckOut = field === 'checkOut' ? value : prev.checkOut;
        const calculated = calcHours(newCheckIn, newCheckOut);
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
        checkIn: editForm.checkIn || undefined,
        checkOut: editForm.checkOut || undefined,
        workingHours: editForm.workingHours ? Number(editForm.workingHours) : undefined,
        notes: editForm.notes || undefined,
      };

      if (editRecord?.id) {
        await attendanceApi.update(editRecord.id, payload);
        toast.success('Attendance record updated');
      } else {
        await attendanceApi.upsert({
          employeeId: id,
          date: editDate,
          ...payload,
        });
        toast.success('Attendance record saved');
      }

      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save attendance record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRecord?.id) return;
    setDeleting(true);
    try {
      await attendanceApi.delete(deleteRecord.id);
      toast.success('Attendance record deleted');
      setShowDeleteModal(false);
      setDeleteRecord(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete attendance record');
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

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/attendance')}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Attendance Sheets
        </Button>
      </div>

      {/* Driver header */}
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
              {/* Avatar */}
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

              {/* Info */}
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
                </div>

                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    ID: {employee.employeeNumber ?? '—'}
                  </span>
                  {employee.licenseCategory && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      License: {employee.licenseCategory}
                    </span>
                  )}
                  {(employee.agency?.name ?? employee.agencyName) && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Agency: {employee.agency?.name ?? employee.agencyName}
                    </span>
                  )}
                  {employee.email && (
                    <span>{employee.email}</span>
                  )}
                </div>
              </div>

              {/* Bulk fill button */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkFill(true)}
                >
                  <ClipboardList className="w-4 h-4 mr-1" />
                  Fill Month
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

      {/* Month/Year selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-semibold text-[#0F172A] min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { key: 'presentCount', label: 'Present', color: 'bg-green-100 text-green-700', icon: CheckCircle },
          { key: 'absentCount', label: 'Absent', color: 'bg-red-100 text-red-700', icon: XCircle },
          { key: 'lateCount', label: 'Late', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
          { key: 'onLeaveCount', label: 'On Leave', color: 'bg-blue-100 text-blue-700', icon: Calendar },
          { key: 'halfDayCount', label: 'Half Day', color: 'bg-purple-100 text-purple-700', icon: Clock },
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
                    <TableHead className="w-20">Hours</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right w-24">Actions</TableHead>
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
                        {/* Date */}
                        <TableCell className="font-medium text-sm text-[#0F172A]">
                          {day.date}
                        </TableCell>

                        {/* Day name */}
                        <TableCell>
                          <span
                            className={`text-xs font-medium ${
                              isWeekend ? 'text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {day.dayName}
                          </span>
                          {isWeekend && (
                            <span className="ml-1 text-xs text-muted-foreground opacity-60">
                              ·
                            </span>
                          )}
                        </TableCell>

                        {/* Status */}
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

                        {/* Check In */}
                        <TableCell className="text-sm">
                          {record?.checkIn ? (
                            <span className="font-mono">{record.checkIn}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Check Out */}
                        <TableCell className="text-sm">
                          {record?.checkOut ? (
                            <span className="font-mono">{record.checkOut}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Hours */}
                        <TableCell className="text-sm">
                          {record?.workingHours != null ? (
                            <span className="inline-flex items-center gap-1 text-slate-700">
                              <Clock className="w-3 h-3 opacity-50" />
                              {record.workingHours}h
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Notes */}
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {record?.notes || <span className="opacity-40">—</span>}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {record ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(record, day.date)}
                                  className="h-7 px-2"
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setDeleteRecord(record); setShowDeleteModal(true); }}
                                  className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
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
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
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

      {/* Edit / Add Attendance Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editRecord ? (
                <>
                  <Pencil className="w-5 h-5 text-blue-600" />
                  Edit Attendance
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-blue-600" />
                  Add Attendance
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date (read-only) */}
            <div className="space-y-1.5">
              <Label>Date</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm font-medium">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {editDate}
              </div>
            </div>

            {/* Status */}
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
              {/* Check In */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-checkin">Check In</Label>
                <Input
                  id="edit-checkin"
                  type="time"
                  value={editForm.checkIn}
                  onChange={(e) => handleFormChange('checkIn', e.target.value)}
                  placeholder="HH:MM"
                />
              </div>

              {/* Check Out */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-checkout">Check Out</Label>
                <Input
                  id="edit-checkout"
                  type="time"
                  value={editForm.checkOut}
                  onChange={(e) => handleFormChange('checkOut', e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
            </div>

            {/* Working Hours */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-hours">
                Working Hours
                <span className="text-xs text-muted-foreground ml-2">
                  (auto-calculated from check in/out)
                </span>
              </Label>
              <Input
                id="edit-hours"
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={editForm.workingHours}
                onChange={(e) => handleFormChange('workingHours', e.target.value)}
                placeholder="e.g. 8.5"
              />
            </div>

            {/* Notes */}
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
            {deleteRecord && (
              <div className="mt-3 p-3 rounded-md bg-muted/40 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={`text-xs ${statusColors[deleteRecord.status] ?? ''}`}>
                    {statusLabels[deleteRecord.status] ?? deleteRecord.status}
                  </Badge>
                </div>
                {deleteRecord.checkIn && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check In:</span>
                    <span className="font-mono">{deleteRecord.checkIn}</span>
                  </div>
                )}
                {deleteRecord.checkOut && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check Out:</span>
                    <span className="font-mono">{deleteRecord.checkOut}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteRecord(null); }} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="w-4 h-4 mr-1" />
              {deleting ? 'Deleting…' : 'Delete Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
