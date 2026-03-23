import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { ArrowLeft, Mail, Phone, Globe, Briefcase, Calendar, FileText, UserPlus, Edit, Trash2, CheckCircle2, Download, Upload, X } from 'lucide-react';
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

// Comprehensive mock data matching the application form structure
const applicantData = {
  id: 'APP001',
  status: 'Under Review',
  applicationDate: '2026-03-15',
  
  // Basic Information
  fullName: 'Andrei Popescu',
  dateOfBirth: '1988-05-15',
  nationality: 'Romania',
  countryOfResidence: 'Romania',
  currentCountryOfResidence: 'Romania',
  permanentAddress: 'Str. Victoriei 45, Bucharest',
  phone: '+40 721 234 567',
  email: 'andrei.popescu@email.com',
  earliestStartDate: '2026-04-01',
  howDidYouHear: 'LinkedIn',
  
  // Travel & Residence Documents
  passportNumber: 'RO123456789',
  passportValidUntil: '2030-12-31',
  hasEUVisa: false,
  visaType: '-',
  visaValidUntil: '-',
  hasWorkPermit: true,
  hasResidenceCard: true,
  issuingCountry: 'Romania',
  
  // Licence & Certifications
  drivingLicenseNumber: 'RO-4567-CE',
  licenseIssuingCountry: 'Romania',
  licenseValidUntil: '2028-05-15',
  categoryA: '2005-03-10',
  categoryB: '2006-04-15',
  categoryC: '2015-07-20',
  categoryD: '-',
  categoryE: '2016-09-10',
  hasTachographCard: true,
  tachographNumber: 'TACH123456',
  tachographValidUntil: '2027-03-15',
  hasQualificationCard: true,
  qualificationValidUntil: '2027-06-30',
  hasADR: false,
  adrClasses: '-',
  adrValidUntil: '-',
  
  // International Experience
  hasEUExperience: true,
  yearsEUExperience: '5 years',
  totalCEExperience: '8 years',
  yearsActiveDriving: '8 years',
  mainlyHomeCountry: false,
  drivenOtherCountries: true,
  specifyCountries: 'Germany, France, Netherlands, Belgium, Austria',
  
  // Work Experience Profile
  kilometersRange: '> 1,000,000 km',
  transportTypes: ['International Transport', 'Bilateral Transport'],
  
  // Operational Skills
  operationalSkills: [
    'EUR Pallet Exchange',
    'Driver Loading and Unloading',
    'CMR Documentation',
    'Load Securing (lashing)',
    'Digital Tachograph Operation'
  ],
  
  // Technical Experience
  truckBrands: ['Volvo', 'Scania', 'DAF'],
  otherBrand: '-',
  gearboxType: 'Both (Manual & Automatic)',
  trailerTypes: ['Curtain Sider', 'Reefer', 'Mega'],
  mostUsedTrailer: 'Curtain Sider',
  yearsWithTrailer: '7 years',
  confidentTrailers: 'Curtain sider, Reefer, Mega',
  
  // Safety & Discipline
  weekendDriving: true,
  nightDriving: true,
  trafficAccidents: false,
  accidentDescription: '-',
  aetrViolations: false,
  finesAbroad: false,
  ecoDriving: true,
  
  // Language Skills
  englishLevel: 'Intermediate',
  germanLevel: 'Basic',
  russianLevel: '-',
  otherLanguages: 'French (basic)',
  languageAtWork: 'English',
  
  // Work Flexibility
  doubleCrewWillingness: true,
  maxTourWeeks: '3 weeks',
  preferredCountries: 'Germany, Netherlands, Belgium',
  undesiredCountries: '-',
  
  // Documents
  documents: [
    { id: 'DOC001', name: 'Passport', type: 'Passport', uploadDate: '2026-03-15', status: 'Verified' },
    { id: 'DOC002', name: 'Driving License CE', type: 'License', uploadDate: '2026-03-15', status: 'Verified' },
    { id: 'DOC003', name: 'CV Resume', type: 'CV', uploadDate: '2026-03-15', status: 'Pending' },
    { id: 'DOC004', name: 'Work Experience Certificate', type: 'Certificate', uploadDate: '2026-03-15', status: 'Verified' },
  ],
  
  // Notes
  notes: [
    {
      id: 'NOTE001',
      author: 'Sarah Johnson',
      date: '2026-03-16',
      time: '10:30',
      content: 'Excellent driving record. 8 years experience with international routes. Strong EU experience.',
    },
    {
      id: 'NOTE002',
      author: 'Michael Brown',
      date: '2026-03-16',
      time: '14:45',
      content: 'Interview scheduled for March 20th at 2:00 PM. All certifications verified.',
    },
  ],
};

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'NEW':
    case 'NEW APPLICATION':
      return 'bg-blue-100 text-blue-800';
    case 'SCREENING':
    case 'UNDER REVIEW':
      return 'bg-yellow-100 text-yellow-800';
    case 'INTERVIEW':
    case 'INTERVIEW SCHEDULED':
      return 'bg-purple-100 text-purple-800';
    case 'ACCEPTED':
    case 'OFFER':
    case 'ONBOARDING':
      return 'bg-green-100 text-green-800';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getDocumentStatusColor = (status: string) => {
  switch (status) {
    case 'Verified':
      return 'bg-green-100 text-green-800';
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function ApplicantProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const { canEdit, canDelete } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [applicantData, setApplicantData] = useState<any>(null);
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
        currentWorkflowStageId: applicant.currentWorkflowStageId ?? null,
        currentWorkflowStage: applicant.currentWorkflowStage ?? null,
      });
    }).catch(() => {
      toast.error('Failed to load applicant');
      navigate('/dashboard/applicants');
    }).finally(() => setLoading(false));
  }, [id, navigate]);

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

  const handleConvertToEmployee = () => {
    toast.success('Applicant converted to Employee successfully!');
    navigate('/dashboard/employees');
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

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading applicant...</div>;
  }

  if (!applicantData) return <div className="flex items-center justify-center h-64 text-muted-foreground">Failed to load applicant data.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/applicants">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-[#0F172A]">
              {applicantData.fullName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Applicant ID: {applicantData.id} • Applied {applicantData.applicationDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canEdit('applicants') && (
            <Button variant="outline" asChild>
              <Link to={`/dashboard/applicants/${id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </Button>
          )}
          {canDelete('applicants') && (
            <Button variant="outline" className="text-red-600" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          {applicantData.status === 'ACCEPTED' && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowConvertDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Convert to Employee
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge & Workflow Stage */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={getStatusColor(applicantData.status)}>
          {applicantData.status}
        </Badge>
        {applicantData.currentWorkflowStage && (
          <Badge style={{ backgroundColor: applicantData.currentWorkflowStage.color ?? '#2563EB' }} className="text-white">
            {applicantData.currentWorkflowStage.name}
          </Badge>
        )}
      </div>

      {/* Workflow Stage Selector */}
      {canEdit('applicants') && allStages.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Current Workflow Stage</p>
                <p className="text-xs text-muted-foreground">Assign this applicant to a recruitment pipeline stage</p>
              </div>
              <div className="w-full sm:w-64">
                <Select
                  value={applicantData.currentWorkflowStageId ?? ''}
                  onValueChange={handleStageChange}
                  disabled={changingStage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No stage assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStages.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agency Selector */}
      {canEdit('applicants') && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Agency</p>
                <p className="text-xs text-muted-foreground">Assign this applicant to a recruitment agency</p>
              </div>
              <div className="w-full sm:w-64">
                <Select
                  value={applicantData.agencyId ?? '__none__'}
                  onValueChange={handleAgencyChange}
                  disabled={changingAgency}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No agency (Direct)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Agency (Direct)</SelectItem>
                    {agencies.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="skills">Skills & Tech</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Full Name" value={applicantData.fullName} />
                <InfoRow label="Date of Birth" value={applicantData.dateOfBirth} />
                <InfoRow label="Nationality" value={applicantData.nationality} />
                <InfoRow label="Country of Residence" value={applicantData.countryOfResidence} />
                <InfoRow label="Current Country" value={applicantData.currentCountryOfResidence} />
                <InfoRow label="Permanent Address" value={applicantData.permanentAddress} />
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Contact & Application
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Email" value={applicantData.email} icon={<Mail className="w-4 h-4" />} />
                <InfoRow label="Phone" value={applicantData.phone} icon={<Phone className="w-4 h-4" />} />
                <InfoRow label="Job Type" value={applicantData.jobType?.name} icon={<Briefcase className="w-4 h-4" />} />
                <InfoRow label="Earliest Start Date" value={applicantData.earliestStartDate} />
                <InfoRow label="How They Heard" value={applicantData.howDidYouHear} />
              </CardContent>
            </Card>

            {/* Travel Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Travel & Residence Documents
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

            {/* Driving Licence */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Driving Licence & Certifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="License Number" value={applicantData.drivingLicenseNumber} />
                <InfoRow label="Issuing Country" value={applicantData.licenseIssuingCountry} />
                <InfoRow label="Valid Until" value={applicantData.licenseValidUntil} />
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Categories:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {applicantData.categoryA && applicantData.categoryA !== '-' && (
                      <Badge variant="outline">A: {applicantData.categoryA}</Badge>
                    )}
                    {applicantData.categoryB && applicantData.categoryB !== '-' && (
                      <Badge variant="outline">B: {applicantData.categoryB}</Badge>
                    )}
                    {applicantData.categoryC && applicantData.categoryC !== '-' && (
                      <Badge variant="outline" className="border-[#2563EB] text-[#2563EB]">C: {applicantData.categoryC}</Badge>
                    )}
                    {applicantData.categoryE && applicantData.categoryE !== '-' && (
                      <Badge variant="outline" className="border-[#2563EB] text-[#2563EB]">E: {applicantData.categoryE}</Badge>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <InfoRow label="Tachograph Card" value={applicantData.hasTachographCard ? `Yes (${applicantData.tachographNumber})` : 'No'} />
                  <InfoRow label="Qualification Card Code 95" value={applicantData.hasQualificationCard ? `Yes (Valid until ${applicantData.qualificationValidUntil})` : 'No'} />
                  <InfoRow label="ADR Certificate" value={applicantData.hasADR ? `Yes (${applicantData.adrClasses})` : 'No'} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Experience Tab */}
        <TabsContent value="experience" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* International Experience */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  International Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="EU Experience" value={applicantData.hasEUExperience ? 'Yes' : 'No'} />
                <InfoRow label="Years in EU" value={applicantData.yearsEUExperience} />
                <InfoRow label="Total C+E Experience" value={applicantData.totalCEExperience} />
                <InfoRow label="Years Active Driving" value={applicantData.yearsActiveDriving} />
                <InfoRow label="Mainly Home Country" value={applicantData.mainlyHomeCountry ? 'Yes' : 'No'} />
                <InfoRow label="Driven Other Countries" value={applicantData.drivenOtherCountries ? 'Yes' : 'No'} />
                {applicantData.specifyCountries && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Countries:</p>
                    <p className="font-medium">{applicantData.specifyCountries}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Experience Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Work Experience Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Kilometers Driven" value={applicantData.kilometersRange} />
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">Transport Types:</p>
                  <div className="flex flex-wrap gap-2">
                    {(applicantData.transportTypes || []).map((type: string) => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Language Skills */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Language Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          </div>
        </TabsContent>

        {/* Skills & Technical Tab */}
        <TabsContent value="skills" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Operational Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Operational Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(applicantData.operationalSkills || []).map((skill: string) => (
                    <div key={skill} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{skill}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Technical Experience */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Technical Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Truck Brands:</p>
                  <div className="flex flex-wrap gap-2">
                    {(applicantData.truckBrands || []).map((brand: string) => (
                      <Badge key={brand} variant="outline">{brand}</Badge>
                    ))}
                  </div>
                </div>
                <InfoRow label="Gearbox Type" value={applicantData.gearboxType} />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Trailer Types:</p>
                  <div className="flex flex-wrap gap-2">
                    {(applicantData.trailerTypes || []).map((trailer: string) => (
                      <Badge key={trailer} variant="outline">{trailer}</Badge>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t space-y-2">
                  <InfoRow label="Most Used Trailer" value={applicantData.mostUsedTrailer} />
                  <InfoRow label="Years With Trailer" value={applicantData.yearsWithTrailer} />
                  <InfoRow label="Most Confident With" value={applicantData.confidentTrailers} />
                </div>
              </CardContent>
            </Card>

            {/* Work Flexibility */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Work Flexibility & Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoRow label="Double Crew" value={applicantData.doubleCrewWillingness ? 'Yes' : 'No'} />
                  <InfoRow label="Max Tour Length" value={applicantData.maxTourWeeks} />
                  <InfoRow label="Weekend Driving" value={applicantData.weekendDriving ? 'Yes' : 'No'} />
                  <InfoRow label="Night Driving" value={applicantData.nightDriving ? 'Yes' : 'No'} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Preferred Countries:</p>
                    <p className="font-medium">{applicantData.preferredCountries}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Undesired Countries:</p>
                    <p className="font-medium">{applicantData.undesiredCountries}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Safety Tab */}
        <TabsContent value="safety" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Safety & Discipline Record
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <span className="text-sm font-medium">Traffic Accidents (Last 3 years)</span>
                    <Badge className={applicantData.trafficAccidents ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                      {applicantData.trafficAccidents ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <span className="text-sm font-medium">AETR Violations</span>
                    <Badge className={applicantData.aetrViolations ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                      {applicantData.aetrViolations ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <span className="text-sm font-medium">Fines Abroad (Last 3 years)</span>
                    <Badge className={applicantData.finesAbroad ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                      {applicantData.finesAbroad ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <span className="text-sm font-medium">Eco-Driving Trained</span>
                    <Badge className={applicantData.ecoDriving ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {applicantData.ecoDriving ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Uploaded Documents</CardTitle>
              {canEdit('applicants') && (
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

              {/* Document list */}
              {docsLoading ? (
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No documents uploaded for this applicant yet.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.documentType?.name ?? 'Document'} &bull; {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}
                            {doc.expiryDate ? ` &bull; Expires ${new Date(doc.expiryDate).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getDocumentStatusColor(doc.status)}>{doc.status}</Badge>
                        <a
                          href={`${import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3000'}${doc.fileUrl}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-muted transition-colors" title="Download"
                        >
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Convert to Employee Dialog */}
      {showConvertDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Convert to Employee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to convert <strong>{applicantData.fullName}</strong> to an employee?
              </p>
              <p className="text-sm text-muted-foreground">
                This will:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Create a new employee record</li>
                <li>Transfer all applicant data and documents</li>
                <li>Set initial workflow stage to "Application Submitted"</li>
                <li>Remove applicant from the applicants list</li>
              </ul>
              <div className="flex gap-3 mt-6">
                <Button className="flex-1" onClick={handleConvertToEmployee}>
                  Confirm Conversion
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowConvertDialog(false)}>
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

// Helper component for info rows
function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value || <span className="text-muted-foreground italic">Not provided</span>}</p>
      </div>
    </div>
  );
}
