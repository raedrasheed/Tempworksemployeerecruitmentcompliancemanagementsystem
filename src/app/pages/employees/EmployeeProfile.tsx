import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, FileText, Shield, Briefcase, Clock, Award, GraduationCap, TrendingUp, ChevronRight, Trash2, Download, Upload, X, DollarSign, Plus, Layers, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { employeesApi, documentsApi, settingsApi, employeeWorkflowApi, agenciesApi, workflowApi, getCurrentUser } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { FinancialRecordsTab } from '../../components/finance/FinancialRecordsTab';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');

export function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const currentUser = getCurrentUser();
  const isFinanceOrAdmin = currentUser?.role === 'System Admin' || currentUser?.role === 'HR Manager' || currentUser?.role === 'Finance';
  const [employee, setEmployee] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  // Inline Notes editor — lets operators add/update the employee note
  // from view mode without jumping to the Edit page.
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [allStages, setAllStages] = useState<any[]>([]);
  const [changingStage, setChangingStage] = useState(false);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [changingAgency, setChangingAgency] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ documentTypeId: '', name: '', issueDate: '', expiryDate: '', documentNumber: '', issuer: '' });
  const [financialProfile, setFinancialProfile] = useState<any>(null);

  // Recruitment workflow assignment (single)
  const [assignment, setAssignment] = useState<any>(null);
  const [allWorkflows, setAllWorkflows] = useState<any[]>([]);
  const [showAssignWorkflow, setShowAssignWorkflow] = useState(false);
  const [assignWorkflowId, setAssignWorkflowId] = useState('');
  const [assigningWorkflow, setAssigningWorkflow] = useState(false);
  const [settingStage, setSettingStage] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [approvingStageId, setApprovingStageId] = useState<string | null>(null);

  // ── Per-employee agency-access grants (System Admin / HR Manager only) ─
  // Drives the "Agency Access" card on the Overview tab. Agency users of
  // any granted agency can then view/edit this specific employee; the
  // backend enforces the same rule so this is pure UX around the
  // employeesApi.listAgencyAccess / grantAgencyAccess / revokeAgencyAccess
  // endpoints.
  const canManageAgencyAccess = currentUser?.role === 'System Admin' || currentUser?.role === 'HR Manager';
  const [agencyAccess, setAgencyAccess] = useState<any[]>([]);
  const [grantAgencyId, setGrantAgencyId] = useState<string>('');
  const [grantNotes, setGrantNotes] = useState<string>('');
  const [grantBusy, setGrantBusy] = useState(false);

  const loadAgencyAccess = () => {
    if (!id || !canManageAgencyAccess) return;
    employeesApi.listAgencyAccess(id)
      .then((res: any) => setAgencyAccess(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => setAgencyAccess([]));
  };

  const handleGrantAccess = async (
    agencyId: string,
    flags: { canView: boolean; canEdit: boolean },
    notes?: string,
  ) => {
    if (!id || !agencyId) return;
    setGrantBusy(true);
    try {
      await employeesApi.grantAgencyAccess(id, agencyId, {
        canView: flags.canView,
        canEdit: flags.canEdit,
        notes,
      });
      loadAgencyAccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update access');
    } finally {
      setGrantBusy(false);
    }
  };

  const handleToggleAccess = async (
    agencyId: string,
    next: { canView: boolean; canEdit: boolean },
  ) => {
    if (!id) return;
    // If both flags are going off, confirm — it deletes the grant row.
    if (!next.canView && !next.canEdit) {
      const ok = await confirm({
        title: 'Revoke all agency access',
        description: 'Both View and Edit are being turned off, which removes this agency\'s access entirely. Continue?',
        confirmText: 'Revoke',
        tone: 'destructive',
      });
      if (!ok) return;
    }
    try {
      // upsert — grant creates the row if missing, update flips flags.
      await employeesApi.grantAgencyAccess(id, agencyId, next);
      toast.success('Access updated');
      loadAgencyAccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update access');
    }
  };

  const handleRevokeAccess = async (agencyId: string, agencyName?: string) => {
    if (!id) return;
    const ok = await confirm({
      title: 'Revoke agency access',
      description: `Remove ${agencyName || 'this agency'}'s access to this employee? Their users will stop seeing the record immediately.`,
      confirmText: 'Revoke',
      tone: 'destructive',
    });
    if (!ok) return;
    try {
      await employeesApi.revokeAgencyAccess(id, agencyId);
      toast.success('Agency access revoked');
      loadAgencyAccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke access');
    }
  };

  const loadRecruitmentWorkflow = () => {
    workflowApi.getEmployeeAssignment(id!).then(res => setAssignment(res ?? null)).catch(() => {});
  };

  const loadWorkflow = () => {
    employeesApi.getWorkflow(id!).then(wf => setWorkflow(Array.isArray(wf) ? wf : [])).catch(() => {});
  };

  const loadDocs = () => {
    employeesApi.getDocuments(id!).then(docs => setDocuments(Array.isArray(docs) ? docs : [])).catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      employeesApi.get(id!),
      employeesApi.getDocuments(id!),
      employeesApi.getWorkflow(id!),
      employeeWorkflowApi.getStages(),
    ]).then(([emp, docs, wf, stages]) => {
      setEmployee(emp);
      setDocuments(Array.isArray(docs) ? docs : []);
      setWorkflow(Array.isArray(wf) ? wf : []);
      setAllStages(Array.isArray(stages) ? stages : []);
      // Seed the inline Notes editor with the raw note text so the
      // operator can append / tweak without retyping from scratch.
      setNoteDraft(typeof emp?.notes === 'string' ? emp.notes : '');
    }).catch(() => toast.error('Failed to load employee'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    settingsApi.getDocumentTypes().then(setDocTypes).catch(() => {});
    agenciesApi.list({ limit: 200 }).then((res: any) => setAgencies(res?.data ?? [])).catch(() => {});
    if (id && isFinanceOrAdmin) {
      employeesApi.getFinancialProfile(id).then(setFinancialProfile).catch(() => {});
    }
    if (id) {
      loadRecruitmentWorkflow();
      workflowApi.list().then(res => setAllWorkflows(Array.isArray(res) ? res : [])).catch(() => {});
      loadAgencyAccess();
    }
  }, [id]);

  const handleStageChange = async (stageId: string) => {
    if (!stageId || !id) return;
    setChangingStage(true);
    try {
      await employeeWorkflowApi.setEmployeeCurrentStage(id, stageId);
      toast.success('Workflow stage updated');
      loadWorkflow();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update stage');
    } finally {
      setChangingStage(false);
    }
  };

  const handleAssignWorkflow = async () => {
    if (!assignWorkflowId || !id) return;
    setAssigningWorkflow(true);
    try {
      await workflowApi.assignEmployee({ employeeId: id, workflowId: assignWorkflowId });
      toast.success('Workflow connected');
      loadRecruitmentWorkflow();
      setShowAssignWorkflow(false);
      setAssignWorkflowId('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect workflow');
    } finally {
      setAssigningWorkflow(false);
    }
  };

  const handleSetStage = async (stageId: string) => {
    if (!id) return;
    setSettingStage(true);
    try {
      const updated = await workflowApi.setEmployeeCurrentStage(id, stageId);
      setAssignment(updated);
      toast.success('Current stage updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update stage');
    } finally {
      setSettingStage(false);
    }
  };

  const handleDisconnectWorkflow = async () => {
    if (!id || !assignment) return;
    if (!(await confirm({
      title: 'Disconnect from workflow?',
      description: 'This employee will be disconnected from the workflow. Existing progress is preserved.',
      confirmText: 'Disconnect',
    }))) return;
    try {
      await workflowApi.removeEmployeeAssignment(id, assignment.workflowId);
      setAssignment(null);
      toast.success('Workflow disconnected');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect');
    }
  };

  const handleApproveStage = async (stageId: string) => {
    if (!id) return;
    setApprovingStageId(stageId);
    try {
      const approval = await workflowApi.approveEmployeeStage(id, stageId);
      setAssignment((prev: any) => prev ? {
        ...prev,
        stageApprovals: [...(prev.stageApprovals ?? []).filter((a: any) => a.stageId !== stageId), approval],
      } : prev);
      toast.success('Stage approved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve stage');
    } finally {
      setApprovingStageId(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) { toast.error('Please select a file'); return; }
    if (!uploadForm.documentTypeId) { toast.error('Please select a document type'); return; }
    if (!uploadForm.name.trim()) { toast.error('Please enter a document name'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('name', uploadForm.name);
      fd.append('documentTypeId', uploadForm.documentTypeId);
      fd.append('entityType', 'EMPLOYEE');
      fd.append('entityId', id!);
      if (uploadForm.issueDate) fd.append('issueDate', uploadForm.issueDate);
      if (uploadForm.expiryDate) fd.append('expiryDate', uploadForm.expiryDate);
      if (uploadForm.documentNumber) fd.append('documentNumber', uploadForm.documentNumber);
      if (uploadForm.issuer) fd.append('issuer', uploadForm.issuer);
      await documentsApi.upload(fd);
      toast.success('Document uploaded successfully');
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ documentTypeId: '', name: '', issueDate: '', expiryDate: '', documentNumber: '', issuer: '' });
      loadDocs();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!id) return;
    setSavingNote(true);
    try {
      const updated = await employeesApi.update(id, { notes: noteDraft } as any);
      setEmployee((prev: any) => ({ ...prev, notes: updated?.notes ?? noteDraft }));
      toast.success('Note saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleAgencyChange = async (value: string) => {
    if (!id) return;
    const newAgencyId = value === '__none__' ? null : value;
    setChangingAgency(true);
    try {
      const updated = await employeesApi.update(id, { agencyId: newAgencyId });
      setEmployee((prev: any) => ({ ...prev, agencyId: updated.agencyId, agency: updated.agency }));
      toast.success('Agency updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update agency');
    } finally {
      setChangingAgency(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete employee?',
      description: `${employee?.firstName} ${employee?.lastName} will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await employeesApi.delete(id!);
      toast.success('Employee deleted');
      navigate('/dashboard/employees');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete employee');
    }
  };

  const statusBadgeClass = (status: string) => {
    if (status === 'ACTIVE') return 'bg-[#22C55E]';
    if (status === 'PENDING') return 'bg-[#F59E0B]';
    if (status === 'ONBOARDING') return 'bg-[#2563EB]';
    if (status === 'ON_LEAVE') return 'bg-[#8B5CF6]';
    return 'bg-gray-500';
  };

  const docStatusClass = (status: string) => {
    if (status === 'VERIFIED') return 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]';
    if (status === 'EXPIRING_SOON') return 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]';
    if (status === 'EXPIRED' || status === 'REJECTED') return 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]';
    return 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]';
  };

  const validDocs = documents.filter(d => d.status === 'VERIFIED').length;
  const expiringSoon = documents.filter(d => d.status === 'EXPIRING_SOON').length;

  const completedStages = workflow.filter(s => s.status === 'COMPLETED').length;
  const workflowProgress = workflow.length > 0 ? (completedStages / workflow.length) * 100 : 0;

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!employee) return <div className="p-8">Employee not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/employees"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Employee Profile</h1>
          <p className="text-muted-foreground mt-1">View and manage employee information</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit('employees') && (
            <Button asChild>
              <Link to={`/dashboard/employees/${id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />Edit Profile
              </Link>
            </Button>
          )}
          {canDelete('employees') && (
            <Button variant="outline" className="text-[#EF4444] border-[#EF4444]" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0">
              {employee.photoUrl ? (
                <img
                  src={employee.photoUrl.startsWith('http') ? employee.photoUrl : `${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')}${employee.photoUrl}`}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-3xl font-semibold">
                  {employee.firstName?.[0]}{employee.lastName?.[0]}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F172A]">
                    {employee.firstName} {employee.lastName}
                  </h2>
                  <p className="text-muted-foreground mt-1">Employee ID: {employee.employeeNumber ?? '—'}</p>
                </div>
                <Badge className={statusBadgeClass(employee.status)}>
                  {employee.status?.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{employee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{employee.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Citizenship</p>
                    <p className="text-sm font-medium">{employee.nationality}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-sm font-medium">{new Date(employee.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {/* Creation attribution — shows who created the profile,
                    or a Self-applied pill for public /apply submissions
                    carried forward through candidate → employee. */}
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created by</p>
                    {employee.source === 'SELF_APPLIED' ? (
                      <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                        Self-applied via public form
                      </span>
                    ) : employee.createdBy ? (
                      <p className="text-sm font-medium">
                        {[employee.createdBy.firstName, employee.createdBy.lastName].filter(Boolean).join(' ') || employee.createdBy.email}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Unknown (legacy record)</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Nav */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { to: `/dashboard/employees/${id}/certifications`, icon: Award, label: 'Certifications' },
          { to: `/dashboard/employees/${id}/training`, icon: GraduationCap, label: 'Training History' },
          { to: `/dashboard/employees/${id}/compliance-timeline`, icon: Shield, label: 'Compliance Timeline' },
          { to: `/dashboard/employees/${id}/performance`, icon: TrendingUp, label: 'Performance Reviews' },
        ].map(({ to, icon: Icon, label }) => (
          <Button key={to} variant="outline" className="justify-between" asChild>
            <Link to={to}>
              <div className="flex items-center gap-2"><Icon className="w-4 h-4" /><span>{label}</span></div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          {isFinanceOrAdmin && (
            <TabsTrigger value="financial">
              <DollarSign className="w-3 h-3 mr-1" />Financial
            </TabsTrigger>
          )}
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Full Name', `${employee.firstName} ${employee.lastName}`],
                    ['Date of Birth', employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : '—'],
                    ['Citizenship', employee.nationality],
                    ['Job Category', employee.jobType?.name ?? '—'],
                    ['License Number', employee.licenseNumber ?? '—'],
                    ['License Category', employee.licenseCategory ?? '—'],
                    ['Years Experience', `${employee.yearsExperience ?? 0} years`],
                    ['Address', `${employee.addressLine1}${employee.addressLine2 ? ', ' + employee.addressLine2 : ''}`],
                    ['City', employee.city],
                    ['Country', employee.country],
                    ['Postal Code', employee.postalCode],
                    employee.emergencyContact ? ['Emergency Contact', `${employee.emergencyContact} · ${employee.emergencyPhone ?? ''}`] : null,
                  ].filter(Boolean).map(([label, value]: any) => (
                    <div key={label}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Quick Stats</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { icon: FileText, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', value: documents.length, label: 'Documents' },
                    { icon: Shield, color: 'text-[#22C55E]', bg: 'bg-[#F0FDF4]', value: validDocs, label: 'Valid Docs' },
                    { icon: Clock, color: 'text-[#F59E0B]', bg: 'bg-[#FEF3C7]', value: expiringSoon, label: 'Expiring Soon' },
                  ].map(({ icon: Icon, color, bg, value, label }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold">{value}</p>
                        <p className="text-sm text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {canEdit('employees') && (
                <Card>
                  <CardHeader><CardTitle>Agency</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {employee.agency && (
                      <div className="flex items-center gap-3 pb-3 border-b">
                        <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
                          <Briefcase className="w-4 h-4 text-[#2563EB]" />
                        </div>
                        <p className="font-medium text-sm">{employee.agency.name}</p>
                      </div>
                    )}
                    <Select
                      value={employee.agencyId ?? '__none__'}
                      onValueChange={handleAgencyChange}
                      disabled={changingAgency}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No Agency (Direct)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No Agency (Direct)</SelectItem>
                        {agencies.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              {canManageAgencyAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle>Agency Access</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Grant or revoke this employee's view and edit access per agency. Conversion from Candidate doesn't auto-grant — you must turn the switches on explicitly.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* The employee's own agency is always shown first so the
                        admin can flip access for it without having to pick
                        it from a dropdown. */}
                    {employee.agencyId && (() => {
                      const ownGrant = agencyAccess.find((g: any) => g.agencyId === employee.agencyId);
                      const ownAgency = employee.agency ?? agencies.find((a: any) => a.id === employee.agencyId);
                      const canView = !!ownGrant?.canView;
                      const canEdit = !!ownGrant?.canEdit;
                      return (
                        <div className="p-3 rounded-lg border bg-[#F8FAFC] space-y-3">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-[#2563EB]" />
                            <p className="font-medium text-sm">{ownAgency?.name ?? 'Employee\'s agency'}</p>
                            <Badge variant="outline" className="ml-auto text-[10px]">Origin</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={canView}
                                disabled={grantBusy}
                                onChange={e => handleToggleAccess(employee.agencyId, { canView: e.target.checked, canEdit })}
                              />
                              <span>View</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={canEdit}
                                disabled={grantBusy}
                                onChange={e => handleToggleAccess(employee.agencyId, { canView, canEdit: e.target.checked })}
                              />
                              <span>Edit</span>
                            </label>
                          </div>
                          {ownGrant?.grantedAt && (
                            <p className="text-[11px] text-muted-foreground">
                              Granted {new Date(ownGrant.grantedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Any additional agencies already granted access. */}
                    {agencyAccess
                      .filter((g: any) => g.agencyId !== employee.agencyId)
                      .map((g: any) => (
                        <div key={g.agencyId} className="p-3 rounded-lg border space-y-3">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate flex-1">{g.agency?.name ?? g.agencyId}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                              onClick={() => handleRevokeAccess(g.agencyId, g.agency?.name)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={!!g.canView}
                                onChange={e => handleToggleAccess(g.agencyId, { canView: e.target.checked, canEdit: !!g.canEdit })}
                              />
                              <span>View</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={!!g.canEdit}
                                onChange={e => handleToggleAccess(g.agencyId, { canView: !!g.canView, canEdit: e.target.checked })}
                              />
                              <span>Edit</span>
                            </label>
                          </div>
                          {g.notes && <p className="text-xs text-muted-foreground truncate">{g.notes}</p>}
                        </div>
                      ))}

                    {/* Add another agency — hidden when the picker has no
                        remaining options to avoid showing an empty Select. */}
                    {agencies.some((a: any) => a.id !== employee.agencyId && !agencyAccess.some((g: any) => g.agencyId === a.id)) && (
                      <div className="pt-3 border-t space-y-3">
                        <Label className="text-xs">Grant access to another agency</Label>
                        <Select value={grantAgencyId} onValueChange={setGrantAgencyId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select agency" />
                          </SelectTrigger>
                          <SelectContent>
                            {agencies
                              .filter((a: any) => a.id !== employee.agencyId && !agencyAccess.some((g: any) => g.agencyId === a.id))
                              .map((a: any) => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Notes (optional)"
                          value={grantNotes}
                          onChange={e => setGrantNotes(e.target.value)}
                        />
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={async () => {
                            await handleGrantAccess(grantAgencyId, { canView: true, canEdit: true }, grantNotes || undefined);
                            setGrantAgencyId('');
                            setGrantNotes('');
                          }}
                          disabled={!grantAgencyId || grantBusy}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {grantBusy ? 'Granting…' : 'Grant view + edit'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Employee Documents</CardTitle>
              {canEdit('employees') && (
                <Button size="sm" onClick={() => setShowUpload(v => !v)} variant={showUpload ? 'outline' : 'default'}>
                  {showUpload ? <><X className="w-4 h-4 mr-1" />Cancel</> : <><Upload className="w-4 h-4 mr-1" />Upload Document</>}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Inline upload form */}
              {showUpload && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h4 className="font-medium text-sm">New Document</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Document Type *</Label>
                      <Select value={uploadForm.documentTypeId} onValueChange={v => setUploadForm(f => ({ ...f, documentTypeId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>{docTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Document Name *</Label>
                      <Input placeholder="e.g. Passport" value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Issue Date</Label>
                      <Input type="date" value={uploadForm.issueDate} onChange={e => setUploadForm(f => ({ ...f, issueDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiry Date</Label>
                      <Input type="date" value={uploadForm.expiryDate} onChange={e => setUploadForm(f => ({ ...f, expiryDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Document Number</Label>
                      <Input placeholder="Optional" value={uploadForm.documentNumber} onChange={e => setUploadForm(f => ({ ...f, documentNumber: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Issuer</Label>
                      <Input placeholder="Optional" value={uploadForm.issuer} onChange={e => setUploadForm(f => ({ ...f, issuer: e.target.value }))} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">File *</Label>
                      <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
                      {uploadFile && <p className="text-xs text-muted-foreground">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</p>}
                    </div>
                  </div>
                  <Button size="sm" onClick={handleUpload} disabled={uploading}>
                    <Upload className="w-4 h-4 mr-1" />{uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              )}

              {documents.length === 0 ? (
                <p className="text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{doc.documentType?.name} · {(doc.fileSize / 1024).toFixed(1)} KB</p>
                          {doc.expiryDate && (
                            <p className="text-xs text-muted-foreground mt-1">Expires: {new Date(doc.expiryDate).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={docStatusClass(doc.status)}>
                          {doc.status?.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`${API_BASE}${doc.fileUrl}`} target="_blank" rel="noopener noreferrer" download>
                            <Download className="w-4 h-4 mr-1" />Download
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/documents/${doc.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow */}
        <TabsContent value="workflow">
          {!assignment ? (
            /* ── No workflow connected ─────────────────────────── */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" /> Connect to a Workflow
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  This employee is not connected to any workflow yet.
                </p>
              </CardHeader>
              <CardContent>
                {showAssignWorkflow ? (
                  <div className="space-y-3 max-w-sm">
                    <Select value={assignWorkflowId} onValueChange={setAssignWorkflowId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a workflow…" />
                      </SelectTrigger>
                      <SelectContent>
                        {allWorkflows.map(w => (
                          <SelectItem key={w.id} value={w.id}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: w.color ?? '#6366F1' }} />
                              {w.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAssignWorkflow} disabled={assigningWorkflow || !assignWorkflowId}>
                        {assigningWorkflow ? 'Connecting…' : 'Connect'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowAssignWorkflow(false); setAssignWorkflowId(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  canEdit && (
                    <Button onClick={() => setShowAssignWorkflow(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Connect to Workflow
                    </Button>
                  )
                )}
              </CardContent>
            </Card>
          ) : (
            /* ── Workflow connected ─────────────────────────────── */
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ background: assignment.workflow?.color ?? '#6366F1' }} />
                    <CardTitle>{assignment.workflow?.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setShowAssignWorkflow(true)}>
                        Change
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={handleDisconnectWorkflow}>
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {assignment.assignedBy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected {new Date(assignment.assignedAt).toLocaleDateString()} by {assignment.assignedBy.firstName} {assignment.assignedBy.lastName}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {showAssignWorkflow && (
                  <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
                    <p className="text-sm font-medium">Change Workflow</p>
                    <Select value={assignWorkflowId} onValueChange={setAssignWorkflowId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a workflow…" />
                      </SelectTrigger>
                      <SelectContent>
                        {allWorkflows.map(w => (
                          <SelectItem key={w.id} value={w.id}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: w.color ?? '#6366F1' }} />
                              {w.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAssignWorkflow} disabled={assigningWorkflow || !assignWorkflowId}>
                        {assigningWorkflow ? 'Saving…' : 'Confirm'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowAssignWorkflow(false); setAssignWorkflowId(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {(!assignment.workflow?.stages || assignment.workflow.stages.length === 0) ? (
                  <p className="text-sm text-muted-foreground">This workflow has no stages configured yet.</p>
                ) : (
                  <div className="space-y-1">
                    {assignment.workflow.stages.map((stage: any, index: number) => {
                      const isCurrent = stage.id === assignment.currentStageId;
                      const isExpanded = expandedStageId === stage.id;
                      const stageApproval = assignment.stageApprovals?.find((a: any) => a.stageId === stage.id);
                      const isApproved = !!stageApproval;
                      const currentUserIsApprover = stage.assignedUsers?.some((u: any) => u.userId === currentUser?.id);

                      return (
                        <div key={stage.id} className={`rounded-lg border transition-all ${isCurrent ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:border-border hover:bg-muted/30'}`}>
                          {/* Stage row */}
                          <div
                            className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                            onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${isCurrent ? 'text-white ring-2 ring-offset-1 ring-primary' : 'text-white opacity-60'}`}
                              style={{ background: stage.color ?? '#6366F1' }}
                            >
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>{stage.name}</span>
                                {isCurrent && <Badge className="text-xs bg-primary">Current</Badge>}
                                {isApproved && <Badge className="text-xs bg-green-500">Approved</Badge>}
                                {stage.isFinal && <Badge variant="outline" className="text-xs">Final</Badge>}
                                {stage.requiresApproval && !isApproved && <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">Needs Approval</Badge>}
                                {stage.slaHours && <span className="text-xs text-muted-foreground">SLA: {stage.slaHours}h</span>}
                              </div>
                              {stage.description && <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {canEdit && !isCurrent && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-xs h-7"
                                  onClick={(e) => { e.stopPropagation(); handleSetStage(stage.id); }}
                                  disabled={settingStage}
                                >
                                  Set Current
                                </Button>
                              )}
                              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                          </div>

                          {/* Expanded panel */}
                          {isExpanded && (
                            <div className="px-3 pb-4 border-t pt-3 space-y-4">

                              {/* Required Documents */}
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Required Documents</p>
                                {!stage.requiredDocs || stage.requiredDocs.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No required documents for this stage.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {stage.requiredDocs.map((rd: any) => {
                                      const uploaded = documents.find((d: any) =>
                                        d.documentTypeId === rd.documentTypeId
                                      );
                                      return (
                                        <div key={rd.id} className="flex items-center justify-between p-2 rounded-md border bg-background">
                                          <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            <div>
                                              <p className="text-xs font-medium">{rd.documentType?.name}</p>
                                              {rd.documentType?.category && <p className="text-[11px] text-muted-foreground">{rd.documentType.category}</p>}
                                            </div>
                                          </div>
                                          {uploaded ? (
                                            <Badge className="text-xs bg-green-500">Uploaded</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs border-red-400 text-red-500">Missing</Badge>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Approval */}
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Stage Approval</p>
                                {isApproved ? (
                                  <div className="flex items-center gap-2 p-2 rounded-md border bg-green-50 border-green-200">
                                    <Badge className="bg-green-500 text-xs">Approved</Badge>
                                    <span className="text-xs text-muted-foreground">
                                      by {stageApproval.approvedBy?.firstName} {stageApproval.approvedBy?.lastName}
                                      {' · '}{new Date(stageApproval.approvedAt).toLocaleDateString()}
                                    </span>
                                    {stageApproval.notes && <span className="text-xs text-muted-foreground italic">— "{stageApproval.notes}"</span>}
                                  </div>
                                ) : stage.assignedUsers?.length > 0 ? (
                                  <div className="space-y-2">
                                    <div className="space-y-1">
                                      {stage.assignedUsers.map((u: any) => (
                                        <div key={u.userId} className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                                            {u.user?.firstName?.[0]}{u.user?.lastName?.[0]}
                                          </div>
                                          {u.user?.firstName} {u.user?.lastName}
                                          <span className="text-[11px] px-1.5 py-0.5 bg-muted rounded">{u.role}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {(canEdit || currentUserIsApprover) && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveStage(stage.id)}
                                        disabled={approvingStageId === stage.id}
                                        className="h-7 text-xs"
                                      >
                                        {approvingStageId === stage.id ? 'Approving…' : 'Approve Stage'}
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">No approvers assigned to this stage.</p>
                                    {canEdit && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveStage(stage.id)}
                                        disabled={approvingStageId === stage.id}
                                        className="h-7 text-xs"
                                      >
                                        {approvingStageId === stage.id ? 'Approving…' : 'Approve Stage'}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader><CardTitle>Compliance Status</CardTitle></CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground">No compliance data available. Upload documents to begin tracking compliance.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc: any) => {
                    const daysLeft = doc.expiryDate
                      ? Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{doc.documentType?.name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={docStatusClass(doc.status)}>
                            {doc.status?.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                          {daysLeft !== null && (
                            <p className={`text-xs mt-1 ${daysLeft <= 0 ? 'text-[#EF4444]' : daysLeft <= 30 ? 'text-[#F59E0B]' : 'text-muted-foreground'}`}>
                              {daysLeft <= 0 ? `Expired ${Math.abs(daysLeft)} days ago` : `${daysLeft} days remaining`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial — Banking/Salary Profile + Transaction Ledger */}
        {isFinanceOrAdmin && (
          <TabsContent value="financial" className="space-y-6">
            {/* Banking / Salary Details — inherited from Candidate stage */}
            {financialProfile && (
              <Card className="border-blue-100">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Banking &amp; Salary Profile</CardTitle>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      From Candidate Stage
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Banking and salary details captured during the candidate stage are retained after conversion.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                    {[
                      ['Bank Name', financialProfile.bankName],
                      ['Account Holder', financialProfile.accountHolder],
                      ['Account Number', financialProfile.accountNumber],
                      ['Sort Code', financialProfile.sortCode],
                      ['IBAN', financialProfile.iban],
                      ['Tax Code', financialProfile.taxCode],
                      ['NI Number', financialProfile.niNumber],
                      ['Payment Method', financialProfile.paymentMethod],
                      ['Salary Agreed', financialProfile.salaryAgreed != null
                        ? `${financialProfile.currency ?? 'GBP'} ${Number(financialProfile.salaryAgreed).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                        : null],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                    {financialProfile.notes && (
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm">{financialProfile.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transaction Ledger */}
            <FinancialRecordsTab
              entityType="EMPLOYEE"
              entityId={id!}
              canWrite={canEdit('employees')}
              canChangeStatus={currentUser?.role === 'System Admin' || currentUser?.role === 'Finance'}
            />
          </TabsContent>
        )}

        {/* Notes */}
        <TabsContent value="notes">
          <Card>
            <CardHeader><CardTitle>Notes & Comments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canEdit('employees') ? (
                <div className="space-y-2">
                  <Label htmlFor="employee-note" className="text-sm">Add / update note</Label>
                  <Textarea
                    id="employee-note"
                    rows={6}
                    placeholder="Write a note about this employee…"
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSaveNote} disabled={savingNote || noteDraft === (employee.notes ?? '')}>
                      {savingNote ? 'Saving…' : 'Save note'}
                    </Button>
                    {noteDraft !== (employee.notes ?? '') && (
                      <Button size="sm" variant="ghost" onClick={() => setNoteDraft(employee.notes ?? '')} disabled={savingNote}>
                        Discard changes
                      </Button>
                    )}
                  </div>
                </div>
              ) : employee.notes ? (
                <p className="whitespace-pre-wrap text-sm">{employee.notes}</p>
              ) : (
                <p className="text-muted-foreground">No notes for this employee.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
