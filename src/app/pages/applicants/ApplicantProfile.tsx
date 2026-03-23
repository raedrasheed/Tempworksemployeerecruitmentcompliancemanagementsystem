import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Mail, Phone, Globe, Briefcase, Calendar, FileText,
  UserPlus, Edit, Trash2, Download, Upload, X,
  Shield, Clock, Award, ChevronRight,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { applicantsApi, documentsApi, settingsApi, workflowApi, agenciesApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

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
  const { canEdit, canDelete } = usePermissions();
  const [applicantData, setApplicantData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [allStages, setAllStages] = useState<any[]>([]);
  const [changingStage, setChangingStage] = useState(false);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [changingAgency, setChangingAgency] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ documentTypeId: '', name: '', issueDate: '', expiryDate: '', documentNumber: '', issuer: '' });
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  const loadDocs = () => {
    if (!id) return;
    setDocsLoading(true);
    documentsApi.getByEntity('APPLICANT', id)
      .then((docs: any) => setDocuments(Array.isArray(docs) ? docs : docs?.data ?? []))
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  };

  useEffect(() => { loadDocs(); }, [id]);

  useEffect(() => {
    settingsApi.getDocumentTypes().then(setDocTypes).catch(() => {});
    workflowApi.getStages().then((stages: any) => setAllStages(Array.isArray(stages) ? stages : [])).catch(() => {});
    agenciesApi.list({ limit: 200 }).then((res: any) => setAgencies(res?.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    applicantsApi.get(id).then((applicant) => {
      let extra: Record<string, any> = {};
      try { extra = JSON.parse(applicant.notes || '{}'); } catch { /* ignore */ }
      setApplicantData({
        ...applicant,
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

  const handleConvertToEmployee = () => {
    toast.success('Applicant converted to Employee successfully!');
    navigate('/dashboard/employees');
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
          {canEdit('applicants') && (
            <Button asChild>
              <Link to={`/dashboard/applicants/${id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />Edit Profile
              </Link>
            </Button>
          )}
          {canDelete('applicants') && (
            <Button variant="outline" className="text-[#EF4444] border-[#EF4444]" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          )}
          {applicantData.status === 'ACCEPTED' && (
            <Button className="bg-[#22C55E] hover:bg-[#16a34a]" onClick={() => setShowConvertDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />Convert to Employee
            </Button>
          )}
        </div>
      </div>

      {/* Hero Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-3xl font-semibold shrink-0">
              {applicantData.firstName?.[0]}{applicantData.lastName?.[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F172A]">{applicantData.fullName}</h2>
                  <p className="text-muted-foreground mt-1">Applicant ID: {applicantData.id}</p>
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
                    ['Job Type', applicantData.jobType?.name || '—'],
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recruitment Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {allStages.length === 0 ? (
                    <p className="text-muted-foreground">No workflow stages configured.</p>
                  ) : (
                    <div className="space-y-4">
                      {allStages.map((s: any, index: number) => {
                        const isCurrent = applicantData.currentWorkflowStageId === s.id;
                        return (
                          <div key={s.id} className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium ${
                              isCurrent ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 pb-4 border-b last:border-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className={`font-medium ${isCurrent ? 'text-[#2563EB]' : ''}`}>{s.name}</p>
                                  {s.description && <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>}
                                  {isCurrent && <p className="text-sm text-muted-foreground mt-1">Current stage</p>}
                                </div>
                                {isCurrent && <Badge className="bg-[#2563EB]">Current</Badge>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {canEdit('applicants') && allStages.length > 0 && (
              <div>
                <Card>
                  <CardHeader><CardTitle className="text-base">Change Current Stage</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Assign this applicant to a pipeline stage.
                    </p>
                    <Select
                      value={applicantData.currentWorkflowStageId ?? ''}
                      onValueChange={handleStageChange}
                      disabled={changingStage}
                    >
                      <SelectTrigger><SelectValue placeholder="No stage assigned" /></SelectTrigger>
                      <SelectContent>
                        {allStages.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {changingStage && <p className="text-xs text-muted-foreground">Updating stage…</p>}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
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

      {/* Convert to Employee Dialog */}
      {showConvertDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader><CardTitle>Convert to Employee</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to convert <strong>{applicantData.fullName}</strong> to an employee?
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Create a new employee record</li>
                <li>Transfer all applicant data and documents</li>
                <li>Set initial workflow stage to "Application Submitted"</li>
                <li>Remove applicant from the applicants list</li>
              </ul>
              <div className="flex gap-3 mt-6">
                <Button className="flex-1" onClick={handleConvertToEmployee}>Confirm Conversion</Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
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
