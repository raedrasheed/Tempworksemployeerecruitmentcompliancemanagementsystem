/**
 * FinancialRecordsTab
 *
 * Shared component rendered inside both ApplicantProfile and EmployeeProfile.
 * Displays a double-entry style ledger table:
 *   Credit  = companyDisbursedAmount   (money disbursed BY the company TO the person)
 *   Debit   = deductionAmount          (money recovered through payroll deductions)
 *   Balance = running cumulative: SUM(credit) - SUM(debit)
 *
 * employeeOrAgencyPaidAmount is shown as a separate informational column and does
 * NOT affect the balance calculation.
 *
 * Accounting rules (mirrors backend):
 *   totalDisbursed = SUM(companyDisbursedAmount)
 *   totalDeducted  = SUM(deductionAmount where NOT NULL)
 *   currentBalance = totalDisbursed − totalDeducted
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronUp, Upload, X,
  FileText, Download, TrendingUp, TrendingDown, Wallet,
  CheckCircle, Clock, AlertCircle, Paperclip,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { financeApi, usersApi, getAccessToken } from '../../services/api';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialRecord {
  id: string;
  entityType: string;
  entityId: string;
  transactionDate: string;
  currency: string;
  transactionType: string;
  description?: string;
  paymentMethod?: string;
  paidByName?: string;
  paidByUser?: { id: string; firstName: string; lastName: string };
  companyDisbursedAmount: number;
  employeeOrAgencyPaidAmount: number;
  status: 'PENDING' | 'DEDUCTED';
  deductionAmount?: number;
  deductionDate?: string;
  payrollReference?: string;
  notes?: string;
  attachments?: Attachment[];
  createdAt: string;
}

interface Attachment {
  id: string;
  name: string;
  fileUrl: string;
  mimeType?: string;
  fileSize?: number;
}

interface Constants {
  transactionTypes: string[];
  paymentMethods: string[];
  statuses: string[];
  currencies: string[];
}

interface Totals {
  totalDisbursed: number;
  totalDeducted: number;
  currentBalance: number;
  totalEmpAgency: number;
  recordCount: number;
}

// ─── Empty form defaults ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  transactionDate: new Date().toISOString().slice(0, 10),
  currency: 'EUR',
  transactionType: '',
  description: '',
  paymentMethod: '',
  paidByName: '',
  paidById: '',
  companyDisbursedAmount: '',
  employeeOrAgencyPaidAmount: '',
  payrollReference: '',
  notes: '',
};

const EMPTY_STATUS_FORM = {
  status: 'DEDUCTED',
  deductionAmount: '',
  deductionDate: '',
  payrollReference: '',
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function fmt(amount: number | undefined | null, currency = 'EUR') {
  if (amount == null || isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function fmtDate(date: string) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  entityType: 'APPLICANT' | 'EMPLOYEE' | 'AGENCY';
  entityId: string;
  canWrite: boolean;
  canChangeStatus: boolean;
}

export function FinancialRecordsTab({ entityType, entityId, canWrite, canChangeStatus }: Props) {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [constants, setConstants] = useState<Constants | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<FinancialRecord | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusRecord, setStatusRecord] = useState<FinancialRecord | null>(null);
  const [statusForm, setStatusForm] = useState<Record<string, any>>({ ...EMPTY_STATUS_FORM });
  const [savingStatus, setSavingStatus] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Attachment upload (on existing records via expanded row)
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Staff list for "Paid By" dropdown
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);

  // Pending files queued inside the Add/Edit modal (uploaded after record save)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const [res, tots] = await Promise.all([
        financeApi.list({ entityType, entityId, limit: 500 }),
        financeApi.getTotals(entityType, entityId),
      ]);
      const items: FinancialRecord[] = (res as any)?.data ?? [];
      // Sort chronologically for running balance
      items.sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
      setRecords(items);
      setTotals(tots as Totals);
    } catch {
      toast.error('Failed to load financial records');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  useEffect(() => {
    financeApi.getConstants().then(c => setConstants(c as Constants)).catch(() => {});
    // Load all internal staff (agency users + system users) for the Paid By dropdown
    usersApi.list({ limit: 200, status: 'ACTIVE' }).then((res: any) => {
      const users: any[] = res?.data ?? [];
      setStaffList(users.map((u: any) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() + (u.role ? ` (${u.role})` : ''),
      })));
    }).catch(() => {});
  }, []);

  // ── Running balance ─────────────────────────────────────────────────────────

  const recordsWithBalance = records.map((r, i) => {
    const prevBalance = i === 0 ? 0
      : records.slice(0, i).reduce(
        (acc, prev) => acc + Number(prev.companyDisbursedAmount ?? 0) - Number(prev.deductionAmount ?? 0),
        0,
      );
    const balance = prevBalance + Number(r.companyDisbursedAmount ?? 0) - Number(r.deductionAmount ?? 0);
    return { ...r, runningBalance: balance };
  });

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditRecord(null);
    setForm({ ...EMPTY_FORM });
    setPendingFiles([]);
    setShowModal(true);
  };

  const openEdit = (rec: FinancialRecord) => {
    setEditRecord(rec);
    setForm({
      transactionDate: rec.transactionDate?.slice(0, 10) ?? '',
      currency: rec.currency ?? 'EUR',
      transactionType: rec.transactionType ?? '',
      description: rec.description ?? '',
      paymentMethod: rec.paymentMethod ?? '',
      paidByName: rec.paidByName ?? '',
      paidById: rec.paidByUser?.id ?? '',
      companyDisbursedAmount: rec.companyDisbursedAmount ?? '',
      employeeOrAgencyPaidAmount: rec.employeeOrAgencyPaidAmount ?? '',
      payrollReference: rec.payrollReference ?? '',
      notes: rec.notes ?? '',
    });
    setPendingFiles([]);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditRecord(null); setPendingFiles([]); };

  const handleSave = async () => {
    if (!form.transactionType) { toast.error('Please select a transaction type'); return; }
    if (!form.transactionDate) { toast.error('Please enter a transaction date'); return; }
    if (form.companyDisbursedAmount === '' || Number(form.companyDisbursedAmount) < 0) {
      toast.error('Please enter a valid company disbursed amount (≥ 0)');
      return;
    }
    setSaving(true);
    try {
      // Resolve paid-by: prefer dropdown selection, fall back to free-text
      const selectedStaff = staffList.find(s => s.id === form.paidById);
      const payload = {
        entityType,
        entityId,
        transactionDate: form.transactionDate,
        currency: form.currency || 'EUR',
        transactionType: form.transactionType,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod || undefined,
        paidByName: selectedStaff ? selectedStaff.name.split(' (')[0] : (form.paidByName || undefined),
        paidById: form.paidById || undefined,
        companyDisbursedAmount: Number(form.companyDisbursedAmount),
        employeeOrAgencyPaidAmount: Number(form.employeeOrAgencyPaidAmount || 0),
        payrollReference: form.payrollReference || undefined,
        notes: form.notes || undefined,
      };

      let savedId: string;
      if (editRecord) {
        await financeApi.update(editRecord.id, payload);
        savedId = editRecord.id;
        toast.success('Record updated');
      } else {
        const created = await financeApi.create(payload) as any;
        savedId = created.id;
        toast.success('Record created');
      }

      // Upload any pending files queued inside the modal
      if (pendingFiles.length > 0) {
        await Promise.allSettled(
          pendingFiles.map(file => {
            const fd = new FormData();
            fd.append('file', file);
            return financeApi.addAttachment(savedId, fd);
          }),
        );
        if (pendingFiles.length > 0) toast.success(`${pendingFiles.length} attachment(s) uploaded`);
      }

      closeModal();
      loadRecords();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Status modal ────────────────────────────────────────────────────────────

  const openStatus = (rec: FinancialRecord) => {
    setStatusRecord(rec);
    setStatusForm({
      status: 'DEDUCTED',
      deductionAmount: rec.companyDisbursedAmount ?? '',
      deductionDate: new Date().toISOString().slice(0, 10),
      payrollReference: rec.payrollReference ?? '',
    });
    setShowStatusModal(true);
  };

  const handleSaveStatus = async () => {
    if (!statusRecord) return;
    if (!statusForm.deductionAmount || Number(statusForm.deductionAmount) <= 0) {
      toast.error('Deduction amount must be greater than 0');
      return;
    }
    if (Number(statusForm.deductionAmount) > Number(statusRecord.companyDisbursedAmount)) {
      toast.error('Deduction cannot exceed the company disbursed amount');
      return;
    }
    setSavingStatus(true);
    try {
      await financeApi.updateStatus(statusRecord.id, {
        status: statusForm.status,
        deductionAmount: Number(statusForm.deductionAmount),
        deductionDate: statusForm.deductionDate || undefined,
        payrollReference: statusForm.payrollReference || undefined,
      });
      toast.success('Status updated');
      setShowStatusModal(false);
      loadRecords();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await financeApi.delete(id);
      toast.success('Record deleted');
      loadRecords();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Attachment upload ───────────────────────────────────────────────────────

  const handleAttach = async (recordId: string) => {
    if (!attachFile) { toast.error('Please select a file'); return; }
    setUploadingAttachment(true);
    try {
      const fd = new FormData();
      fd.append('file', attachFile);
      await financeApi.addAttachment(recordId, fd);
      toast.success('Attachment uploaded');
      setAttachingId(null);
      setAttachFile(null);
      loadRecords();
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (recordId: string, attachmentId: string) => {
    try {
      await financeApi.removeAttachment(recordId, attachmentId);
      toast.success('Attachment removed');
      loadRecords();
    } catch (err: any) {
      toast.error(err?.message || 'Remove failed');
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const blob = await financeApi.exportExcel({ entityType, entityId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-records-${entityId.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading financial records…
        </CardContent>
      </Card>
    );
  }

  const currency = records[0]?.currency ?? 'EUR';

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">Transaction Ledger</h3>
          <Badge variant="outline" className="text-xs">{records.length} record{records.length !== 1 ? 's' : ''}</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />Export Excel
          </Button>
          {canWrite && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1" />Add Transaction
            </Button>
          )}
        </div>
      </div>

      {/* Totals summary cards */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Disbursed</p>
                  <p className="text-xl font-bold text-blue-700">{fmt(totals.totalDisbursed, currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Deducted</p>
                  <p className="text-xl font-bold text-amber-700">{fmt(totals.totalDeducted, currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-${totals.currentBalance > 0 ? 'emerald' : 'slate'}-200 bg-${totals.currentBalance > 0 ? 'emerald' : 'slate'}-50/40`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-${totals.currentBalance > 0 ? 'emerald' : 'slate'}-100 flex items-center justify-center`}>
                  <Wallet className={`w-4 h-4 text-${totals.currentBalance > 0 ? 'emerald' : 'slate'}-600`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current Balance</p>
                  <p className={`text-xl font-bold text-${totals.currentBalance > 0 ? 'emerald' : 'slate'}-700`}>
                    {fmt(totals.currentBalance, currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions table */}
      <Card>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No financial records yet.</p>
              {canWrite && (
                <Button size="sm" className="mt-3" onClick={openAdd}>
                  <Plus className="w-4 h-4 mr-1" />Add First Transaction
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Stage</th>
                    <th className="text-right px-4 py-3 font-medium text-blue-600 whitespace-nowrap">Credit (↑)</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Emp/Agency</th>
                    <th className="text-right px-4 py-3 font-medium text-amber-600 whitespace-nowrap">Debit (↓)</th>
                    <th className="text-right px-4 py-3 font-medium text-emerald-700 whitespace-nowrap">Balance</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsWithBalance.map((rec) => (
                    <>
                      <tr
                        key={rec.id}
                        className="border-b hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {fmtDate(rec.transactionDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium">{rec.transactionType}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                          {rec.description || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {rec.stageAtCreation && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              rec.stageAtCreation === 'EMPLOYEE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rec.stageAtCreation === 'CANDIDATE'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {rec.stageAtCreation}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700 whitespace-nowrap">
                          {Number(rec.companyDisbursedAmount) > 0
                            ? fmt(rec.companyDisbursedAmount, rec.currency)
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap text-xs">
                          {Number(rec.employeeOrAgencyPaidAmount) > 0
                            ? fmt(rec.employeeOrAgencyPaidAmount, rec.currency)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                          {rec.deductionAmount != null && Number(rec.deductionAmount) > 0
                            ? fmt(rec.deductionAmount, rec.currency)
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                          <span className={rec.runningBalance > 0 ? 'text-emerald-700' : rec.runningBalance < 0 ? 'text-red-600' : 'text-slate-500'}>
                            {fmt(rec.runningBalance, rec.currency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {expandedId === rec.id
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            {canWrite && (
                              <>
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-7 w-7"
                                  title="Edit"
                                  onClick={() => openEdit(rec)}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                {canChangeStatus && rec.status === 'PENDING' && (
                                  <Button
                                    size="icon" variant="ghost"
                                    className="h-7 w-7 text-amber-600"
                                    title="Mark as Deducted"
                                    onClick={() => openStatus(rec)}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-7 w-7 text-red-500"
                                  title="Delete"
                                  disabled={deletingId === rec.id}
                                  onClick={() => handleDelete(rec.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {expandedId === rec.id && (
                        <tr key={`${rec.id}-detail`} className="bg-muted/10 border-b">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="space-y-2">
                                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Transaction Details</p>
                                {/* Description = customer-facing line shown in the
                                    row above (truncated there). We repeat it in full
                                    here because long descriptions get clipped in the
                                    narrow Description column. */}
                                <InfoItem label="Description" value={rec.description || '—'} />
                                {rec.paymentMethod && <InfoItem label="Payment Method" value={rec.paymentMethod} />}
                                {rec.paidByName && <InfoItem label="Paid By" value={rec.paidByName} />}
                                {rec.paidByUser && <InfoItem label="Recorded By" value={`${rec.paidByUser.firstName} ${rec.paidByUser.lastName}`} />}
                                <InfoItem label="Currency" value={rec.currency} />
                                {rec.notes && <InfoItem label="Internal Notes" value={rec.notes} />}
                              </div>
                              {rec.status === 'DEDUCTED' && (
                                <div className="space-y-2">
                                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Deduction Info</p>
                                  {rec.deductionAmount != null && <InfoItem label="Deduction Amount" value={fmt(rec.deductionAmount, rec.currency)} />}
                                  {rec.deductionDate && <InfoItem label="Deduction Date" value={fmtDate(rec.deductionDate)} />}
                                  {rec.payrollReference && <InfoItem label="Payroll Ref" value={rec.payrollReference} />}
                                </div>
                              )}
                              <div className="space-y-2">
                                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                                  Attachments ({rec.attachments?.length ?? 0})
                                </p>
                                {rec.attachments?.map(att => (
                                  <div key={att.id} className="flex items-center justify-between gap-2 p-2 border rounded bg-white">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                      <a
                                        href={`${API_BASE}${att.fileUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-blue-600 hover:underline truncate"
                                      >
                                        {att.name}
                                      </a>
                                    </div>
                                    {canWrite && (
                                      <Button
                                        size="icon" variant="ghost"
                                        className="h-6 w-6 text-red-400 shrink-0"
                                        onClick={() => handleRemoveAttachment(rec.id, att.id)}
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                {canWrite && attachingId === rec.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                      className="text-xs flex-1 min-w-0"
                                      onChange={e => setAttachFile(e.target.files?.[0] ?? null)}
                                    />
                                    <Button
                                      size="sm" className="shrink-0"
                                      disabled={!attachFile || uploadingAttachment}
                                      onClick={() => handleAttach(rec.id)}
                                    >
                                      {uploadingAttachment ? '…' : 'Upload'}
                                    </Button>
                                    <Button
                                      size="icon" variant="ghost"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() => { setAttachingId(null); setAttachFile(null); }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : canWrite ? (
                                  <Button
                                    size="sm" variant="outline"
                                    className="w-full text-xs"
                                    onClick={() => setAttachingId(rec.id)}
                                  >
                                    <Paperclip className="w-3 h-3 mr-1" />Attach File
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>

                {/* Totals footer */}
                {totals && records.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/30 border-t-2 font-semibold">
                      {/* Label spans Date, Type, Description, Stage so the
                          first monetary cell lines up with Credit (↑). */}
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold">Totals</td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmt(totals.totalDisbursed, currency)}</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmt(totals.totalEmpAgency, currency)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{fmt(totals.totalDeducted, currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${totals.currentBalance > 0 ? 'text-emerald-700' : totals.currentBalance < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {fmt(totals.currentBalance, currency)}
                        </span>
                      </td>
                      {/* Status + Actions are non-numeric — leave them blank. */}
                      <td colSpan={2} />
                    </tr>
                    <tr className="bg-muted/10">
                      <td colSpan={10} className="px-4 py-2 text-xs text-muted-foreground">
                        <span className="text-blue-600 font-medium">Credit (↑)</span> = company disbursed amount &nbsp;·&nbsp;
                        <span className="text-amber-600 font-medium">Debit (↓)</span> = payroll deduction &nbsp;·&nbsp;
                        <span className="text-slate-500">Emp/Agency</span> = paid by employee/agency (informational, excluded from balance) &nbsp;·&nbsp;
                        <span className="text-emerald-700 font-medium">Balance</span> = cumulative credit − debit
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="max-w-2xl w-full my-6">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">
                {editRecord ? 'Edit Transaction' : 'New Transaction'}
              </CardTitle>
              <Button size="icon" variant="ghost" onClick={closeModal}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-1">
                  <Label className="text-xs">Transaction Date *</Label>
                  <Input
                    type="date"
                    value={form.transactionDate}
                    onChange={e => setForm(f => ({ ...f, transactionDate: e.target.value }))}
                  />
                </div>
                {/* Currency */}
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(constants?.currencies ?? ['EUR', 'GBP', 'USD']).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Transaction type */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Transaction Type *</Label>
                  <Select value={form.transactionType} onValueChange={v => setForm(f => ({ ...f, transactionType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                    <SelectContent>
                      {(constants?.transactionTypes ?? []).map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Description — short summary shown on the table row. */}
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="Short summary shown on the ledger row (e.g. 'Q1 visa fee')"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Brief line visible in the transaction table and expand panel.
                  </p>
                </div>
                {/* Company disbursed (Credit) */}
                <div className="space-y-1">
                  <Label className="text-xs text-blue-700">Company Disbursed Amount (Credit) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.companyDisbursedAmount}
                    onChange={e => setForm(f => ({ ...f, companyDisbursedAmount: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Amount paid BY the company TO/FOR the person</p>
                </div>
                {/* Employee/agency paid (informational) */}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Employee / Agency Paid (informational)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.employeeOrAgencyPaidAmount}
                    onChange={e => setForm(f => ({ ...f, employeeOrAgencyPaidAmount: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Not included in balance — reconciliation only</p>
                </div>
                {/* Payment method */}
                <div className="space-y-1">
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={form.paymentMethod || '__none__'} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v === '__none__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not specified —</SelectItem>
                      {(constants?.paymentMethods ?? []).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Paid by — staff dropdown */}
                <div className="space-y-1">
                  <Label className="text-xs">Paid By (staff)</Label>
                  <Select
                    value={form.paidById || '__none__'}
                    onValueChange={v => {
                      if (v === '__none__') {
                        setForm(f => ({ ...f, paidById: '', paidByName: '' }));
                      } else {
                        const staff = staffList.find(s => s.id === v);
                        setForm(f => ({ ...f, paidById: v, paidByName: staff ? staff.name.split(' (')[0] : '' }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select staff…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not specified —</SelectItem>
                      {staffList.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Payroll Reference is collected later, when the row is
                    marked DEDUCTED via the status dialog — at creation
                    time there's nothing to reconcile against yet. */}
                {/* Notes — private, long-form context visible only in
                    the expanded panel (not the ledger row). */}
                <div className="space-y-1">
                  <Label className="text-xs">Internal Notes</Label>
                  <Input
                    placeholder="Context / reasoning for the finance team"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Longer internal-only context, shown only when the row is expanded.
                  </p>
                </div>
              </div>

              {/* Attachments — queue files before saving */}
              <div className="space-y-2 pt-1 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attached Documents
                    {pendingFiles.length > 0 && (
                      <Badge variant="outline" className="text-xs ml-1">{pendingFiles.length} queued</Badge>
                    )}
                  </Label>
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      <Plus className="w-3.5 h-3.5" />Add file
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      multiple
                      className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) setPendingFiles(prev => [...prev, ...files]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {/* Existing attachments (edit mode) */}
                {editRecord && (editRecord.attachments ?? []).length > 0 && (
                  <div className="space-y-1">
                    {editRecord.attachments!.map(att => (
                      <div key={att.id} className="flex items-center justify-between gap-2 p-2 border rounded bg-muted/20 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <a href={`${API_BASE}${att.fileUrl}`} target="_blank" rel="noreferrer"
                            className="text-blue-600 hover:underline truncate">{att.name}</a>
                        </div>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-red-400 shrink-0"
                          onClick={() => handleRemoveAttachment(editRecord.id, att.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pending (new) files */}
                {pendingFiles.length > 0 && (
                  <div className="space-y-1">
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2 border border-dashed rounded bg-blue-50/40 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate text-blue-700">{file.name}</span>
                          <span className="text-muted-foreground shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-red-400 shrink-0"
                          onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {pendingFiles.length === 0 && (!editRecord || (editRecord.attachments ?? []).length === 0) && (
                  <p className="text-xs text-muted-foreground">No files attached. Click "Add file" to attach receipts, invoices, or proof documents.</p>
                )}
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editRecord ? 'Save Changes' : 'Create Record'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={closeModal} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Status / Deduction Modal ──────────────────────────────────────── */}
      {showStatusModal && statusRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-amber-600" />Mark as Deducted
              </CardTitle>
              <Button size="icon" variant="ghost" onClick={() => setShowStatusModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Transaction:</span> <span className="font-medium">{statusRecord.transactionType}</span></p>
                <p><span className="text-muted-foreground">Original Amount:</span> <span className="font-medium text-blue-700">{fmt(statusRecord.companyDisbursedAmount, statusRecord.currency)}</span></p>
                {statusRecord.description && <p><span className="text-muted-foreground">Description:</span> {statusRecord.description}</p>}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-amber-700">Deduction Amount *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={Number(statusRecord.companyDisbursedAmount)}
                    value={statusForm.deductionAmount}
                    onChange={e => setStatusForm(f => ({ ...f, deductionAmount: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Must be ≤ {fmt(statusRecord.companyDisbursedAmount, statusRecord.currency)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deduction Date</Label>
                  <Input
                    type="date"
                    value={statusForm.deductionDate}
                    onChange={e => setStatusForm(f => ({ ...f, deductionDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payroll Reference</Label>
                  <Input
                    placeholder="e.g. PAY-2026-04"
                    value={statusForm.payrollReference}
                    onChange={e => setStatusForm(f => ({ ...f, payrollReference: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t">
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={handleSaveStatus}
                  disabled={savingStatus}
                >
                  {savingStatus ? 'Saving…' : 'Confirm Deduction'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowStatusModal(false)} disabled={savingStatus}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'DEDUCTED') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-medium text-xs">
        <CheckCircle className="w-3 h-3 mr-1" />Deducted
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-medium text-xs">
      <Clock className="w-3 h-3 mr-1" />Pending
    </Badge>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
