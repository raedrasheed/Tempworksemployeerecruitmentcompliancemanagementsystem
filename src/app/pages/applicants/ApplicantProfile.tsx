import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Mail, Phone, Globe, Briefcase, Calendar, FileText,
  UserPlus, Edit, Trash2, Download, Upload, X,
  Shield, Clock, Award, ChevronRight, MapPin, Loader2, TrendingUp, History, DollarSign,
  Layers, Plus,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { getCurrentUser, applicantsApi, documentsApi, settingsApi, employeeWorkflowApi, agenciesApi, workflowApi } from '../../services/api';
import { FinancialRecordsTab } from '../../components/finance/FinancialRecordsTab';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { ApplicantPdfExportButton } from '../../components/applicants/ApplicantPdfExport';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');

const statusBadgeClass = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'NEW': return 'bg-[#2563EB]';
    case 'SCREENING': return 'bg-[#F59E0B]';
    case 'INTERVIEW': return 'bg-[#8B5CF6]';
    case 'OFFER': return 'bg-[#06B6D4]';
    case 'ACCEPTED': case 'ONBOARDING': return 'bg-[#22C55E]';
    case 'REJECTED': case 'WITHDRAWN': return 'bg-[#EF4444]';
    default: return 'bg-gray-500';
  }
};

const docStatusClass = (status: string) => {
  if (status === 'VERIFIED' || status === 'Verified') return 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]';
  if (status === 'EXPIRING_SOON') return 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]';
  if (status === 'EXPIRED' || status === 'REJECTED' || status === 'Rejected') return 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]';
  return 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]';
};

export function ApplicantProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete, can } = usePermissions();
  const currentUser = getCurrentUser();
  const isFinanceOrAdmin = currentUser?.role === 'System Admin' || currentUser?.role === 'HR Manager' || currentUser?.role === 'Finance';
  const [applicantData, setApplicantData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [allStages, setAllStages] = useState<any[]>([]);
  const [changingStage, setChangingStage] = useState(false);
  const [candidateAssignment, setCandidateAssignment] = useState<any>(null);
  const [allWorkflows, setAllWorkflows] = useState<any[]>([]);
  const [showAssignWorkflow, setShowAssignWorkflow] = useState(false);
  const [assignWorkflowId, setAssignWorkflowId] = useState('');
  const [assigningWorkflow, setAssigningWorkflow] = useState(false);
  const [settingStage, setSettingStage] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [approvingProgressId, setApprovingProgressId] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [changingAgency, setChangingAgency] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ documentTypeId: '', name: '', issueDate: '', expiryDate: '', documentNumber: '', issuer: '' });
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertForm, setConvertForm] = useState({
    addressLine1: '', addressLine2: '', city: '', country: '', postalCode: '',
    licenseNumber: '', licenseCategory: '', yearsExperience: '', emergencyContact: '', emergencyPhone: '',
  });

  // Tier / financial / history state
  const [showConvertLeadDialog, setShowConvertLeadDialog] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);
  const [financialProfile, setFinancialProfile] = useState<any>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);
  const [financialForm, setFinancialForm] = useState<any>({});
  const [agencyHistory, setAgencyHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadDocs = () => {
    if (!id) return;
    setDocsLoading(true);
    documentsApi.getByEntity('APPLICANT', id)
      .then((docs: any) => setDocuments(Array.isArray(docs) ? docs : docs?.data ?? []))
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  };

  const loadCandidateWorkflow = () => {
    if (!id) return;
    workflowApi.getCandidateAssignments(id)
      .then(assignments => setCandidateAssignment(assignments?.[0] ?? null))
      .catch(() => {});
  };

  useEffect(() => { loadDocs(); }, [id]);

  useEffect(() => {
    settingsApi.getDocumentTypes().then(setDocTypes).catch(() => {});
    employeeWorkflowApi.getStages().then((stages: any) => setAllStages(Array.isArray(stages) ? stages : [])).catch(() => {});
    agenciesApi.list({ limit: 200 }).then((res: any) => setAgencies(res?.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadCandidateWorkflow();
    workflowApi.list().then(res => setAllWorkflows(Array.isArray(res) ? res : [])).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    applicantsApi.get(id).then((applicant) => {
      let extra: Record<string, any> = {};
      try { extra = JSON.parse(applicant.notes || '{}'); } catch { /* ignore */ }

      // Map fields from applicationData JSON (submitted form) to profile display names
      const ad: Record<string, any> = (applicant as any).applicationData ?? {};
      const quals: any[] = ad.qualifications ?? [];
      const tachographQual = quals.find((q: any) => /tachograph/i.test(q.type ?? ''));
      const code95Qual = quals.find((q: any) => /code.?95|cpc/i.test(q.type ?? ''));
      const adrQual = quals.find((q: any) => /adr/i.test(q.type ?? ''));
      const langs: any[] = ad.languages ?? [];
      const findLang = (name: string) => langs.find((l: any) => l.language?.toLowerCase() === name.toLowerCase())?.proficiency ?? '';
      const otherLangs = langs.filter((l: any) => !['english','german','russian'].includes(l.language?.toLowerCase())).map((l: any) => `${l.language} (${l.proficiency})`).join(', ');
      const cats: string[] = ad.licenseCategories ?? [];

      const appDataMapped: Record<string, any> = {
        // Travel & Residence
        passportNumber: ad.passportNumber,
        passportValidUntil: ad.passportExpiryDate,
        hasEUVisa: ad.hasEuVisa === 'yes',
        hasWorkPermit: ad.hasWorkPermit === 'yes',
        hasResidenceCard: ad.hasEuResidence === 'yes',
        issuingCountry: ad.passportCountry,
        // Driving
        drivingLicenseNumber: ad.licenseNumber,
        licenseIssuingCountry: ad.licenseCountry,
        licenseValidUntil: ad.licenseExpiryDate,
        categoryA: cats.includes('A') ? 'A' : '',
        categoryB: cats.includes('B') ? 'B' : '',
        categoryC: cats.some((c: string) => /^C/i.test(c)) ? 'C' : '',
        categoryE: cats.some((c: string) => /E/i.test(c)) ? 'E' : '',
        hasTachographCard: !!tachographQual,
        tachographNumber: tachographQual?.number ?? '',
        hasQualificationCard: !!code95Qual,
        qualificationValidUntil: code95Qual?.expiryDate ?? '',
        hasADR: !!adrQual,
        adrClasses: adrQual?.type ?? '',
        // International Experience
        hasEUExperience: ['eu','both'].includes(ad.drivingExpType ?? '') || Number(ad.euExpYears) > 0,
        yearsEUExperience: ad.euExpYears,
        totalCEExperience: ad.euExpKm ? `${ad.euExpKm} km` : ad.domesticExpYears ? `${ad.domesticExpYears} yrs domestic` : '',
        yearsActiveDriving: ad.domesticExpYears,
        drivenOtherCountries: !!(ad.euExpCountries),
        specifyCountries: ad.euExpCountries,
        // Safety
        trafficAccidents: ad.trafficAccidents === 'yes',
        aetrViolations: false,
        finesAbroad: false,
        ecoDriving: false,
        // Languages
        englishLevel: findLang('english'),
        germanLevel: findLang('german'),
        russianLevel: findLang('russian'),
        otherLanguages: otherLangs,
        languageAtWork: langs.find((l: any) => l.proficiency === 'Native' || l.proficiency === 'Fluent')?.language ?? '',
        // Work Flexibility
        doubleCrewWillingness: (ad.workRegime ?? []).includes('Double Crew'),
        maxTourWeeks: '',
        weekendDriving: ad.weekendDriving,
        nightDriving: ad.nightDriving,
        preferredCountries: ad.preferredLocations,
        undesiredCountries: '',
        // Personal / Address
        permanentAddress: ad.homeAddress
          ? [ad.homeAddress.street, ad.homeAddress.city, ad.homeAddress.country].filter(Boolean).join(', ')
          : '',
        countryOfResidence: ad.homeAddress?.country ?? ad.currentAddress?.country ?? '',
        currentCountryOfResidence: ad.currentAddress?.country ?? ad.homeAddress?.country ?? '',
        howDidYouHear: ad.howDidYouHear,
      };

      setApplicantData({
        ...applicant,
        ...appDataMapped,
        fullName: `${applicant.firstName} ${applicant.lastName}`.trim(),
        applicationDate: applicant.createdAt ? applicant.createdAt.slice(0, 10) : '',
        status: applicant.status || 'NEW',
        ...extra,
        id: applicant.id,
        email: applicant.email,
        phone: applicant.phone,
        nationality: applicant.nationality,
        dateOfBirth: applicant.dateOfBirth ? applicant.dateOfBirth.slice(0, 10) : '',
        preferredStartDate: applicant.preferredStartDate ? applicant.preferredStartDate.slice(0, 10) : '',
        jobType: applicant.jobType,
        agencyId: applicant.agencyId ?? null,
        agency: applicant.agency ?? null,
        currentWorkflowStageId: applicant.currentWorkflowStageId ?? null,
        currentWorkflowStage: applicant.currentWorkflowStage ?? null,
        // Lifecycle identifiers & conversion timestamps
        leadNumber: (applicant as any).leadNumber ?? null,
        candidateNumber: (applicant as any).candidateNumber ?? null,
        candidateConvertedAt: (applicant as any).candidateConvertedAt
          ? new Date((applicant as any).candidateConvertedAt).toLocaleDateString()
          : null,
        employeeConvertedAt: (applicant as any).employeeConvertedAt
          ? new Date((applicant as any).employeeConvertedAt).toLocaleDateString()
          : null,
      });
    }).catch(() => {
      toast.error('Failed to load applicant');
      navigate('/dashboard/applicants');
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  const handleStageChange = async (stageId: string) => {
    if (!stageId || !id) return;
    setChangingStage(true);
    try {
      const updated = await applicantsApi.setCurrentStage(id, stageId);
      setApplicantData((prev: any) => ({ ...prev, currentWorkflowStage: updated.currentWorkflowStage, currentWorkflowStageId: updated.currentWorkflowStageId }));
      toast.success('Workflow stage updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update stage');
    } finally {
      setChangingStage(false);
    }
  };

  const handleAssignCandidateWorkflow = async () => {
    if (!assignWorkflowId || !id) return;
    setAssigningWorkflow(true);
    try {
      await workflowApi.assignCandidate({ candidateId: id, workflowId: assignWorkflowId });
      toast.success('Workflow connected');
      loadCandidateWorkflow();
      setShowAssignWorkflow(false);
      setAssignWorkflowId('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect workflow');
    } finally {
      setAssigningWorkflow(false);
    }
  };

  const handleDisconnectCandidateWorkflow = async () => {
    if (!id || !candidateAssignment || !confirm('Disconnect this applicant from the workflow?')) return;
    try {
      await workflowApi.removeCandidateAssignment(id, candidateAssignment.id);
      setCandidateAssignment(null);
      toast.success('Workflow disconnected');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect');
    }
  };

  const handleSetCandidateStage = async (stageId: string) => {
    if (!candidateAssignment) return;
    setSettingStage(true);
    try {
      await workflowApi.advanceToStage(candidateAssignment.id, stageId);
      loadCandidateWorkflow();
      toast.success('Current stage updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update stage');
    } finally {
      setSettingStage(false);
    }
  };

  const handleApproveCandidateStage = async (progressId: string) => {
    setApprovingProgressId(progressId);
    try {
      await workflowApi.submitApproval(progressId, { decision: 'APPROVED' });
      loadCandidateWorkflow();
      toast.success('Stage approved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve stage');
    } finally {
      setApprovingProgressId(null);
    }
  };

  const handleAgencyChange = async (value: string) => {
    if (!id) return;
    const newAgencyId = value === '__none__' ? null : value;
    setChangingAgency(true);
    try {
      const updated = await applicantsApi.update(id, { agencyId: newAgencyId });
      setApplicantData((prev: any) => ({ ...prev, agencyId: updated.agencyId, agency: updated.agency }));
      toast.success('Agency updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update agency');
    } finally {
      setChangingAgency(false);
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
      fd.append('entityType', 'APPLICANT');
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

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this applicant?')) return;
    try {
      await applicantsApi.delete(id);
      toast.success('Applicant deleted successfully');
      navigate('/dashboard/applicants');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete applicant');
    }
  };

  const handleConvertToEmployee = async () => {
    if (!id) return;
    if (!convertForm.addressLine1.trim() || !convertForm.city.trim() || !convertForm.country.trim() || !convertForm.postalCode.trim()) {
      toast.error('Please fill in all required address fields');
      return;
    }
    setConverting(true);
    try {
      const payload: any = {
        addressLine1: convertForm.addressLine1.trim(),
        city: convertForm.city.trim(),
        country: convertForm.country.trim(),
        postalCode: convertForm.postalCode.trim(),
      };
      if (convertForm.addressLine2.trim()) payload.addressLine2 = convertForm.addressLine2.trim();
      if (convertForm.licenseNumber.trim()) payload.licenseNumber = convertForm.licenseNumber.trim();
      if (convertForm.licenseCategory.trim()) payload.licenseCategory = convertForm.licenseCategory.trim();
      if (convertForm.yearsExperience) payload.yearsExperience = Number(convertForm.yearsExperience);
      if (convertForm.emergencyContact.trim()) payload.emergencyContact = convertForm.emergencyContact.trim();
      if (convertForm.emergencyPhone.trim()) payload.emergencyPhone = convertForm.emergencyPhone.trim();

      const result = await applicantsApi.convertToEmployee(id, payload);
      toast.success('Applicant successfully converted to employee');
      setShowConvertDialog(false);
      navigate(`/dashboard/employees/${result.employee.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to convert applicant to employee');
    } finally {
      setConverting(false);
    }
  };

  // Load financial profile and agency history when tab is opened
  const loadFinancialProfile = () => {
    if (!id || !isFinanceOrAdmin) return;
    setFinancialLoading(true);
    applicantsApi.getFinancialProfile(id)
      .then((data: any) => {
        setFinancialProfile(data);
        setFinancialForm(data ?? {});
      })
      .catch(() => {})
      .finally(() => setFinancialLoading(false));
  };

  const loadAgencyHistory = () => {
    if (!id) return;
    setHistoryLoading(true);
    applicantsApi.getAgencyHistory(id)
      .then((data: any) => setAgencyHistory(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  };

  const handleConvertLeadToCandidate = async () => {
    if (!id) return;
    setConvertingLead(true);
    try {
      const updated = await applicantsApi.convertLeadToCandidate(id, {});
      setApplicantData((prev: any) => ({ ...prev, tier: 'CANDIDATE', agencyId: updated.agencyId, agency: updated.agency }));
      toast.success('Promoted to Candidate');
      setShowConvertLeadDialog(false);
    } catch (err: any) {
      toast.error(err?.message || 'Promotion failed');
    } finally {
      setConvertingLead(false);
    }
  };

  const handleSaveFinancial = async () => {
    if (!id) return;
    setSavingFinancial(true);
    try {
      const saved = await applicantsApi.upsertFinancialProfile(id, financialForm);
      setFinancialProfile(saved);
      toast.success('Financial profile saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save financial profile');
    } finally {
      setSavingFinancial(false);
    }
  };

  const validDocs = documents.filter(d => d.status === 'VERIFIED' || d.status === 'Verified').length;
  const expiringSoon = documents.filter(d => d.status === 'EXPIRING_SOON').length;

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!applicantData) return <div className="p-8">Applicant not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/applicants"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Applicant Profile</h1>
          <p className="text-muted-foreground mt-1">View and manage applicant information</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tier badge */}
          {applicantData && (
            <Badge className={applicantData.tier === 'CANDIDATE'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm px-3 py-1'
              : 'bg-amber-100 text-amber-800 border border-amber-200 text-sm px-3 py-1'}>
              {applicantData.tier ?? 'LEAD'}
            </Badge>
          )}
          {canEdit('applicants') && (
            <Button asChild variant="outline">
              <Link to={`/dashboard/applicants/${id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />Edit
              </Link>
            </Button>
          )}
          {/* Promote Lead → Candidate */}
          {canEdit('applicants') && applicantData?.tier === 'LEAD' && (
            <Button variant="outline" className="text-emerald-700 border-emerald-300" onClick={() => setShowConvertLeadDialog(true)}>
              <TrendingUp className="w-4 h-4 mr-2" />Promote to Candidate
            </Button>
          )}
          {/* Convert Candidate → Employee */}
          {canEdit('applicants') && applicantData?.tier === 'CANDIDATE' && (
            <Button className="bg-[#22C55E] hover:bg-[#16a34a]" onClick={() => setShowConvertDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />Convert to Employee
            </Button>
          )}
          <ApplicantPdfExportButton applicant={applicantData} documents={documents} />
          {canDelete('applicants') && (
            <Button variant="outline" className="text-[#EF4444] border-[#EF4444]" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          )}
        </div>
      </div>

      {/* Hero Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full shrink-0 overflow-hidden bg-[#EFF6FF] flex items-center justify-center">
              {applicantData.photoUrl
                ? <img
                    src={applicantData.photoUrl.startsWith('http') ? applicantData.photoUrl : `${API_BASE}${applicantData.photoUrl}`}
                    alt={applicantData.fullName}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                : <span className="text-[#2563EB] text-3xl font-semibold">{applicantData.firstName?.[0]}{applicantData.lastName?.[0]}</span>
              }
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F172A]">{applicantData.fullName}</h2>
                  {/* Lifecycle identifier — shows current active stage ID */}
                  <div className="flex items-center gap-2 mt-1">
                    {applicantData.tier === 'CANDIDATE' && applicantData.candidateNumber ? (
                      <span className="font-mono text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5">
                        {applicantData.candidateNumber}
                      </span>
                    ) : applicantData.leadNumber ? (
                      <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                        {applicantData.leadNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No identifier (legacy record)</span>
                    )}
                    {/* Also show lead number for candidates so traceability is visible */}
                    {applicantData.tier === 'CANDIDATE' && applicantData.leadNumber && (
                      <span className="text-xs text-muted-foreground">
                        (was <span className="font-mono">{applicantData.leadNumber}</span>)
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={statusBadgeClass(applicantData.status)}>
                  {applicantData.status?.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{applicantData.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{applicantData.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nationality</p>
                    <p className="text-sm font-medium">{applicantData.nationality}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Applied</p>
                    <p className="text-sm font-medium">{applicantData.applicationDate}</p>
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
          { label: 'Travel & Residence', icon: FileText },
          { label: 'Driving Licence', icon: Award },
          { label: 'Experience', icon: Globe },
          { label: 'Safety Record', icon: Shield },
        ].map(({ label, icon: Icon }) => (
          <Button key={label} variant="outline" className="justify-between">
            <div className="flex items-center gap-2"><Icon className="w-4 h-4" /><span>{label}</span></div>
            <ChevronRight className="w-4 h-4" />
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
            <TabsTrigger
              value="financial"
              onClick={() => { loadFinancialProfile(); }}
            >
              <DollarSign className="w-3 h-3 mr-1" />Financial
            </TabsTrigger>
          )}
          <TabsTrigger value="history" onClick={loadAgencyHistory}>
            <History className="w-3 h-3 mr-1" />Agency History
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Full Name', applicantData.fullName],
                    ['Date of Birth', applicantData.dateOfBirth || '—'],
                    ['Nationality', applicantData.nationality],
                    ['License Number', applicantData.drivingLicenseNumber || '—'],
                    ['License Category', [applicantData.categoryC && 'C', applicantData.categoryE && 'E'].filter(Boolean).join('+') || '—'],
                    ['Years EU Experience', applicantData.yearsEUExperience || '—'],
                    ['Permanent Address', applicantData.permanentAddress || '—'],
                    ['Country of Residence', applicantData.countryOfResidence || '—'],
                    ['Current Country', applicantData.currentCountryOfResidence || '—'],
                    ['Job Category', applicantData.jobType?.name || '—'],
                    ['Preferred Start Date', applicantData.preferredStartDate || '—'],
                    ['How They Heard', applicantData.howDidYouHear || '—'],
                  ].map(([label, value]: any) => (
                    <div key={label}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Right sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
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

              {/* Lifecycle Identifiers */}
              <Card>
                <CardHeader><CardTitle>Lifecycle Identifiers</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Lead ID</p>
                      {applicantData.leadNumber
                        ? <span className="font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">{applicantData.leadNumber}</span>
                        : <span className="text-muted-foreground italic text-xs">Not assigned (legacy)</span>}
                      <p className="text-xs text-muted-foreground mt-1">Created: {applicantData.applicationDate || '—'}</p>
                    </div>
                    <div className="border-t pt-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Candidate ID</p>
                      {applicantData.candidateNumber
                        ? <span className="font-mono font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5">{applicantData.candidateNumber}</span>
                        : <span className="text-muted-foreground italic text-xs">{applicantData.tier === 'LEAD' ? 'Not yet converted' : 'Not assigned (legacy)'}</span>}
                      {applicantData.candidateConvertedAt && (
                        <p className="text-xs text-muted-foreground mt-1">Converted: {applicantData.candidateConvertedAt}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agency */}
              <Card>
                <CardHeader><CardTitle>Agency</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {applicantData.agency && (
                    <div className="flex items-center gap-3 pb-3 border-b">
                      <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-[#2563EB]" />
                      </div>
                      <p className="font-medium text-sm">{applicantData.agency.name}</p>
                    </div>
                  )}
                  {canEdit('applicants') && (
                    <Select
                      value={applicantData.agencyId ?? '__none__'}
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
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Applicant-specific details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Travel & Residence Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />Travel & Residence Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Passport Number" value={applicantData.passportNumber} />
                <InfoRow label="Passport Valid Until" value={applicantData.passportValidUntil} />
                <InfoRow label="EU Visa" value={applicantData.hasEUVisa ? 'Yes' : 'No'} />
                <InfoRow label="Work Permit in EU" value={applicantData.hasWorkPermit ? 'Yes' : 'No'} />
                <InfoRow label="Residence Card in EU" value={applicantData.hasResidenceCard ? 'Yes' : 'No'} />
                <InfoRow label="Issuing Country" value={applicantData.issuingCountry} />
              </CardContent>
            </Card>

            {/* Driving Licence & Certifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />Driving Licence & Certifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="License Number" value={applicantData.drivingLicenseNumber} />
                <InfoRow label="Issuing Country" value={applicantData.licenseIssuingCountry} />
                <InfoRow label="Valid Until" value={applicantData.licenseValidUntil} />
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">Categories:</p>
                  <div className="flex flex-wrap gap-2">
                    {applicantData.categoryA && applicantData.categoryA !== '-' && <Badge variant="outline">A</Badge>}
                    {applicantData.categoryB && applicantData.categoryB !== '-' && <Badge variant="outline">B</Badge>}
                    {applicantData.categoryC && applicantData.categoryC !== '-' && <Badge variant="outline" className="border-[#2563EB] text-[#2563EB]">C</Badge>}
                    {applicantData.categoryE && applicantData.categoryE !== '-' && <Badge variant="outline" className="border-[#2563EB] text-[#2563EB]">E</Badge>}
                  </div>
                </div>
                <div className="pt-2 border-t space-y-2">
                  <InfoRow label="Tachograph Card" value={applicantData.hasTachographCard ? `Yes (${applicantData.tachographNumber || 'N/A'})` : 'No'} />
                  <InfoRow label="Code 95 / CPC" value={applicantData.hasQualificationCard ? `Yes (until ${applicantData.qualificationValidUntil || '—'})` : 'No'} />
                  <InfoRow label="ADR Certificate" value={applicantData.hasADR ? `Yes (${applicantData.adrClasses || '—'})` : 'No'} />
                </div>
              </CardContent>
            </Card>

            {/* International Experience */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />International Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="EU Experience" value={applicantData.hasEUExperience ? 'Yes' : 'No'} />
                <InfoRow label="Years in EU" value={applicantData.yearsEUExperience} />
                <InfoRow label="Total C+E Experience" value={applicantData.totalCEExperience} />
                <InfoRow label="Years Active Driving" value={applicantData.yearsActiveDriving} />
                <InfoRow label="Driven Other Countries" value={applicantData.drivenOtherCountries ? 'Yes' : 'No'} />
                {applicantData.specifyCountries && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Countries:</p>
                    <p className="font-medium">{applicantData.specifyCountries}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Safety Record */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />Safety & Discipline Record
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['Traffic Accidents (Last 3 yrs)', applicantData.trafficAccidents],
                  ['AETR Violations', applicantData.aetrViolations],
                  ['Fines Abroad (Last 3 yrs)', applicantData.finesAbroad],
                  ['Eco-Driving Trained', applicantData.ecoDriving],
                ].map(([label, val]: any) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{label}</span>
                    <Badge className={
                      label === 'Eco-Driving Trained'
                        ? (val ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')
                        : (val ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')
                    }>
                      {val ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Language Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />Language Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="English" value={applicantData.englishLevel} />
                  <InfoRow label="German" value={applicantData.germanLevel} />
                  <InfoRow label="Russian" value={applicantData.russianLevel} />
                  <InfoRow label="Other Languages" value={applicantData.otherLanguages} />
                </div>
                <div className="mt-4 pt-4 border-t">
                  <InfoRow label="Language at Work" value={applicantData.languageAtWork} />
                </div>
              </CardContent>
            </Card>

            {/* Work Flexibility */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />Work Flexibility & Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Double Crew" value={applicantData.doubleCrewWillingness ? 'Yes' : 'No'} />
                  <InfoRow label="Max Tour Length" value={applicantData.maxTourWeeks} />
                  <InfoRow label="Weekend Driving" value={applicantData.weekendDriving ? 'Yes' : 'No'} />
                  <InfoRow label="Night Driving" value={applicantData.nightDriving ? 'Yes' : 'No'} />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <InfoRow label="Preferred Countries" value={applicantData.preferredCountries} />
                  <InfoRow label="Undesired Countries" value={applicantData.undesiredCountries} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Applicant Documents</CardTitle>
              {canEdit('applicants') && (
                <Button size="sm" onClick={() => setShowUpload(v => !v)} variant={showUpload ? 'outline' : 'default'}>
                  {showUpload ? <><X className="w-4 h-4 mr-1" />Cancel</> : <><Upload className="w-4 h-4 mr-1" />Upload Document</>}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
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
              {docsLoading ? (
                <p className="text-muted-foreground">Loading documents...</p>
              ) : documents.length === 0 ? (
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
                          <p className="text-sm text-muted-foreground">
                            {doc.documentType?.name} {doc.fileSize ? `· ${(doc.fileSize / 1024).toFixed(1)} KB` : ''}
                          </p>
                          {doc.expiryDate && (
                            <p className="text-xs text-muted-foreground mt-1">Expires: {new Date(doc.expiryDate).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={docStatusClass(doc.status)}>
                          {doc.status?.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                        <a
                          href={`${API_BASE}${doc.fileUrl}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Download className="w-4 h-4" />Download
                        </a>
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
          {!candidateAssignment ? (
            /* ── No workflow connected ─────────────────────────── */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" /> Connect to a Workflow
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  This applicant is not connected to any workflow yet.
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
                        {allWorkflows.map((w: any) => (
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
                      <Button size="sm" onClick={handleAssignCandidateWorkflow} disabled={assigningWorkflow || !assignWorkflowId}>
                        {assigningWorkflow ? 'Connecting…' : 'Connect'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowAssignWorkflow(false); setAssignWorkflowId(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  canEdit('applicants') && (
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
                    <div className="w-4 h-4 rounded-full" style={{ background: candidateAssignment.workflow?.color ?? '#6366F1' }} />
                    <CardTitle>{candidateAssignment.workflow?.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit('applicants') && (
                      <Button size="sm" variant="ghost" onClick={() => setShowAssignWorkflow(true)}>
                        Change
                      </Button>
                    )}
                    {canEdit('applicants') && (
                      <Button size="sm" variant="ghost" onClick={handleDisconnectCandidateWorkflow}>
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {candidateAssignment.assignedBy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected {new Date(candidateAssignment.assignedAt).toLocaleDateString()} by {candidateAssignment.assignedBy.firstName} {candidateAssignment.assignedBy.lastName}
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
                        {allWorkflows.map((w: any) => (
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
                      <Button size="sm" onClick={handleAssignCandidateWorkflow} disabled={assigningWorkflow || !assignWorkflowId}>
                        {assigningWorkflow ? 'Saving…' : 'Confirm'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowAssignWorkflow(false); setAssignWorkflowId(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {(!candidateAssignment.workflow?.stages || candidateAssignment.workflow.stages.length === 0) ? (
                  <p className="text-sm text-muted-foreground">This workflow has no stages configured yet.</p>
                ) : (
                  <div className="space-y-1">
                    {candidateAssignment.workflow.stages.map((stage: any, index: number) => {
                      // Find the progress record for this stage
                      const progress = candidateAssignment.stageProgress?.find((p: any) => p.stageId === stage.id);
                      const isCurrent = progress?.status === 'ACTIVE';
                      const isExpanded = expandedStageId === stage.id;
                      const latestApproval = progress?.approvals?.[0];
                      const isApproved = latestApproval?.decision === 'APPROVED';
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
                              {canEdit('applicants') && !isCurrent && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-xs h-7"
                                  onClick={(e) => { e.stopPropagation(); handleSetCandidateStage(stage.id); }}
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
                                      const uploaded = documents.find((d: any) => d.documentTypeId === rd.documentTypeId);
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
                                      by {latestApproval.approvedBy?.firstName} {latestApproval.approvedBy?.lastName}
                                      {' · '}{new Date(latestApproval.decidedAt ?? latestApproval.createdAt).toLocaleDateString()}
                                    </span>
                                    {latestApproval.notes && <span className="text-xs text-muted-foreground italic">— "{latestApproval.notes}"</span>}
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
                                    {(canEdit('applicants') || currentUserIsApprover) && progress && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveCandidateStage(progress.id)}
                                        disabled={approvingProgressId === progress.id}
                                        className="h-7 text-xs"
                                      >
                                        {approvingProgressId === progress.id ? 'Approving…' : 'Approve Stage'}
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">No approvers assigned to this stage.</p>
                                    {canEdit('applicants') && progress && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveCandidateStage(progress.id)}
                                        disabled={approvingProgressId === progress.id}
                                        className="h-7 text-xs"
                                      >
                                        {approvingProgressId === progress.id ? 'Approving…' : 'Approve Stage'}
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

        {/* Financial — Transaction Ledger */}
        {isFinanceOrAdmin && (
          <TabsContent value="financial">
            {applicantData?.tier !== 'CANDIDATE' ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />Financial Transactions
                  </CardTitle>
                  <Badge className="bg-amber-100 text-amber-800">Candidates only</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Financial transactions are available for Candidates only. Promote this applicant to Candidate first.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Bank / Tax details card (retained for reference) */}
                {financialProfile && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />Bank & Tax Details
                      </CardTitle>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => {
                          if (!id) return;
                          setSavingFinancial(true);
                          applicantsApi.upsertFinancialProfile(id, financialForm)
                            .then((saved: any) => { setFinancialProfile(saved); toast.success('Saved'); })
                            .catch((err: any) => toast.error(err?.message || 'Save failed'))
                            .finally(() => setSavingFinancial(false));
                        }}
                        disabled={savingFinancial}
                      >
                        {savingFinancial ? 'Saving…' : 'Save'}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          ['bankName', 'Bank Name', 'text'],
                          ['iban', 'IBAN', 'text'],
                          ['taxCode', 'Tax Code', 'text'],
                          ['niNumber', 'NI Number', 'text'],
                          ['paymentMethod', 'Payment Method', 'text'],
                        ].map(([field, label, type]) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input
                              type={type as any}
                              value={financialForm[field] ?? ''}
                              onChange={e => setFinancialForm((f: any) => ({ ...f, [field]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {/* Transaction ledger */}
                <FinancialRecordsTab
                  entityType="APPLICANT"
                  entityId={id!}
                  canWrite={canEdit('applicants')}
                  canChangeStatus={currentUser?.role === 'System Admin' || currentUser?.role === 'Finance'}
                />
              </div>
            )}
          </TabsContent>
        )}

        {/* Agency History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />Agency Assignment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : agencyHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No agency assignment history recorded.</p>
              ) : (
                <div className="space-y-3">
                  {agencyHistory.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{h.agencyName}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.assignedAt).toLocaleDateString()}
                            {h.removedAt && ` → ${new Date(h.removedAt).toLocaleDateString()}`}
                          </span>
                        </div>
                        {h.reason && <p className="text-sm text-muted-foreground mt-0.5">Reason: {h.reason}</p>}
                        {h.notes && <p className="text-sm text-muted-foreground mt-0.5">{h.notes}</p>}
                        {!h.removedAt && (
                          <Badge className="bg-green-100 text-green-800 mt-1" variant="outline">Current</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes">
          <Card>
            <CardHeader><CardTitle>Notes & Comments</CardTitle></CardHeader>
            <CardContent>
              {applicantData.notes ? (
                (() => {
                  try {
                    const parsed = JSON.parse(applicantData.notes);
                    const text = Object.entries(parsed)
                      .filter(([, v]) => v && v !== '' && v !== 'false' && v !== false)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n');
                    return text ? <p className="whitespace-pre-wrap text-sm">{text}</p> : <p className="text-muted-foreground">No notes for this applicant.</p>;
                  } catch {
                    return <p className="whitespace-pre-wrap">{applicantData.notes}</p>;
                  }
                })()
              ) : (
                <p className="text-muted-foreground">No notes for this applicant. You can add notes when editing the profile.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Promote Lead → Candidate Dialog */}
      {showConvertLeadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />Promote to Candidate
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>{applicantData?.fullName}</strong> will be promoted from Lead to Candidate.
                This grants agency users visibility. A holding agency will be assigned if configured.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                This action is logged and can be reviewed in Agency History.
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleConvertLeadToCandidate}
                  disabled={convertingLead}
                >
                  {convertingLead
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Promoting…</>
                    : <><TrendingUp className="w-4 h-4 mr-2" />Confirm Promotion</>}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowConvertLeadDialog(false)} disabled={convertingLead}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Convert to Employee Dialog */}
      {showConvertDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="max-w-xl w-full my-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#22C55E]" />
                Convert to Employee
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Converting <strong>{applicantData.fullName}</strong> — all documents will be transferred and the applicant record will be archived.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Read-only applicant info */}
              <div className="rounded-lg border bg-[#F8FAFC] p-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name: </span><span className="font-medium">{applicantData.fullName}</span></div>
                <div><span className="text-muted-foreground">Email: </span><span className="font-medium">{applicantData.email}</span></div>
                <div><span className="text-muted-foreground">Phone: </span><span className="font-medium">{applicantData.phone}</span></div>
                <div><span className="text-muted-foreground">Nationality: </span><span className="font-medium">{applicantData.nationality}</span></div>
              </div>

              {/* Address — required */}
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <MapPin className="w-4 h-4 text-[#2563EB]" />Address <span className="text-[#EF4444]">*</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cv-addr1">Address Line 1 <span className="text-[#EF4444]">*</span></Label>
                    <Input id="cv-addr1" className="mt-1" value={convertForm.addressLine1}
                      onChange={e => setConvertForm(p => ({ ...p, addressLine1: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cv-addr2">Address Line 2</Label>
                    <Input id="cv-addr2" className="mt-1" value={convertForm.addressLine2}
                      onChange={e => setConvertForm(p => ({ ...p, addressLine2: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="cv-city">City <span className="text-[#EF4444]">*</span></Label>
                      <Input id="cv-city" className="mt-1" value={convertForm.city}
                        onChange={e => setConvertForm(p => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="cv-country">Country <span className="text-[#EF4444]">*</span></Label>
                      <Input id="cv-country" className="mt-1" value={convertForm.country}
                        onChange={e => setConvertForm(p => ({ ...p, country: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="cv-post">Postal Code <span className="text-[#EF4444]">*</span></Label>
                      <Input id="cv-post" className="mt-1" value={convertForm.postalCode}
                        onChange={e => setConvertForm(p => ({ ...p, postalCode: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional extras */}
              <div>
                <p className="text-sm font-semibold mb-3">Additional Details <span className="text-muted-foreground font-normal">(optional)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cv-lic">License Number</Label>
                    <Input id="cv-lic" className="mt-1" value={convertForm.licenseNumber}
                      onChange={e => setConvertForm(p => ({ ...p, licenseNumber: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cv-liccat">License Category</Label>
                    <Input id="cv-liccat" className="mt-1" value={convertForm.licenseCategory}
                      onChange={e => setConvertForm(p => ({ ...p, licenseCategory: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cv-yoe">Years Experience</Label>
                    <Input id="cv-yoe" type="number" min={0} className="mt-1" value={convertForm.yearsExperience}
                      onChange={e => setConvertForm(p => ({ ...p, yearsExperience: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cv-ec">Emergency Contact</Label>
                    <Input id="cv-ec" className="mt-1" value={convertForm.emergencyContact}
                      onChange={e => setConvertForm(p => ({ ...p, emergencyContact: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="cv-ep">Emergency Phone</Label>
                    <Input id="cv-ep" className="mt-1" value={convertForm.emergencyPhone}
                      onChange={e => setConvertForm(p => ({ ...p, emergencyPhone: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <Button
                  className="flex-1 bg-[#22C55E] hover:bg-[#16a34a]"
                  onClick={handleConvertToEmployee}
                  disabled={converting || !convertForm.addressLine1.trim() || !convertForm.city.trim() || !convertForm.country.trim() || !convertForm.postalCode.trim()}
                >
                  {converting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Converting…</> : <><UserPlus className="w-4 h-4 mr-2" />Confirm Conversion</>}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowConvertDialog(false)} disabled={converting}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || <span className="text-muted-foreground italic">Not provided</span>}</p>
    </div>
  );
}
