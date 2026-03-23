import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { applicantsApi, settingsApi, documentsApi, agenciesApi } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, ChevronRight, ChevronLeft, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ApplicantFormSteps, ApplicantFormData, JobType, StepIndicator, UploadedFileItem } from '../../components/applicants/ApplicantFormSteps';

const EMPTY_FORM: ApplicantFormData = {
  jobTypeId: '',
  fullName: '', dateOfBirth: '', nationality: '', countryOfResidence: '',
  currentCountryOfResidence: '', permanentAddress: '', phone: '', email: '',
  earliestStartDate: '', howDidYouHear: '', passportNumber: '', passportValidUntil: '',
  hasEUVisa: '', visaType: '', visaValidUntil: '', hasWorkPermit: '', hasResidenceCard: '',
  issuingCountry: '', drivingLicenseNumber: '', licenseIssuingCountry: '', licenseIssueDate: '', licenseValidUntil: '',
  categoryA: '', categoryB: '', categoryC: '', categoryD: '', categoryE: '',
  hasTachographCard: '', tachographNumber: '', tachographValidUntil: '',
  hasQualificationCard: '', qualificationValidUntil: '', hasADR: '', adrClasses: '',
  adrValidUntil: '', hasEUExperience: '', yearsEUExperience: '', totalCEExperience: '',
  yearsActiveDriving: '', mainlyHomeCountry: '', drivenOtherCountries: '', specifyCountries: '',
  kilometersRange: '', transportTypes: [], operationalSkills: [], truckBrands: [], otherBrand: '',
  gearboxType: '', trailerTypes: [], mostUsedTrailer: '', yearsWithTrailer: '', confidentTrailers: '',
  workRegime: [], trafficAccidents: '', accidentDescription: '', aetrViolations: '', finesAbroad: '',
  ecoDriving: '', englishLevel: '', germanLevel: '', russianLevel: '', otherLanguages: '',
  languageAtWork: '', doubleCrewWillingness: '', maxTourWeeks: '', preferredCountries: '',
  undesiredCountries: '', weekendDriving: false, nightDriving: false,
};

export function AddApplicant() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const [formData, setFormData] = useState<ApplicantFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agencyId, setAgencyId] = useState<string>('');

  useEffect(() => {
    settingsApi.getJobTypes().then(setJobTypes).catch(() => {});
    settingsApi.getDocumentTypes().then((res: any) => setDocTypes(res?.data ?? res ?? [])).catch(() => {});
    agenciesApi.list({ limit: 100 }).then((res: any) => setAgencies(res?.data ?? [])).catch(() => {});
  }, []);

  const handleInputChange = (field: keyof ApplicantFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: keyof ApplicantFormData, value: string) => {
    setFormData(prev => {
      const currentArray = (prev[field] as string[]) || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [field]: newArray };
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '-';

      const extraData = {
        passportNumber: formData.passportNumber,
        passportValidUntil: formData.passportValidUntil,
        hasEUVisa: formData.hasEUVisa,
        visaType: formData.visaType,
        visaValidUntil: formData.visaValidUntil,
        hasWorkPermit: formData.hasWorkPermit,
        hasResidenceCard: formData.hasResidenceCard,
        issuingCountry: formData.issuingCountry,
        drivingLicenseNumber: formData.drivingLicenseNumber,
        licenseIssuingCountry: formData.licenseIssuingCountry,
        licenseValidUntil: formData.licenseValidUntil,
        categoryA: formData.categoryA,
        categoryB: formData.categoryB,
        categoryC: formData.categoryC,
        categoryD: formData.categoryD,
        categoryE: formData.categoryE,
        hasTachographCard: formData.hasTachographCard,
        tachographNumber: formData.tachographNumber,
        tachographValidUntil: formData.tachographValidUntil,
        hasQualificationCard: formData.hasQualificationCard,
        qualificationValidUntil: formData.qualificationValidUntil,
        hasADR: formData.hasADR,
        adrClasses: formData.adrClasses,
        adrValidUntil: formData.adrValidUntil,
        hasEUExperience: formData.hasEUExperience,
        yearsEUExperience: formData.yearsEUExperience,
        totalCEExperience: formData.totalCEExperience,
        yearsActiveDriving: formData.yearsActiveDriving,
        mainlyHomeCountry: formData.mainlyHomeCountry,
        drivenOtherCountries: formData.drivenOtherCountries,
        specifyCountries: formData.specifyCountries,
        kilometersRange: formData.kilometersRange,
        transportTypes: formData.transportTypes,
        operationalSkills: formData.operationalSkills,
        truckBrands: formData.truckBrands,
        otherBrand: formData.otherBrand,
        gearboxType: formData.gearboxType,
        trailerTypes: formData.trailerTypes,
        mostUsedTrailer: formData.mostUsedTrailer,
        yearsWithTrailer: formData.yearsWithTrailer,
        confidentTrailers: formData.confidentTrailers,
        workRegime: formData.workRegime,
        trafficAccidents: formData.trafficAccidents,
        accidentDescription: formData.accidentDescription,
        aetrViolations: formData.aetrViolations,
        finesAbroad: formData.finesAbroad,
        ecoDriving: formData.ecoDriving,
        englishLevel: formData.englishLevel,
        germanLevel: formData.germanLevel,
        russianLevel: formData.russianLevel,
        otherLanguages: formData.otherLanguages,
        languageAtWork: formData.languageAtWork,
        doubleCrewWillingness: formData.doubleCrewWillingness,
        maxTourWeeks: formData.maxTourWeeks,
        preferredCountries: formData.preferredCountries,
        undesiredCountries: formData.undesiredCountries,
        weekendDriving: formData.weekendDriving,
        nightDriving: formData.nightDriving,
        countryOfResidence: formData.countryOfResidence,
        currentCountryOfResidence: formData.currentCountryOfResidence,
        permanentAddress: formData.permanentAddress,
        howDidYouHear: formData.howDidYouHear,
      };

      const jobTypeId = formData.jobTypeId || undefined;

      const applicantPayload = {
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone,
        nationality: formData.nationality,
        dateOfBirth: formData.dateOfBirth,
        residencyStatus: formData.hasWorkPermit === 'yes' ? 'Work Permit' : formData.hasResidenceCard === 'yes' ? 'Residence Card' : 'Other',
        availability: formData.earliestStartDate || 'Immediate',
        preferredStartDate: formData.earliestStartDate || undefined,
        willingToRelocate: true,
        notes: JSON.stringify(extraData),
        ...(jobTypeId ? { jobTypeId } : {}),
        ...(agencyId && agencyId !== 'none' ? { agencyId } : {}),
      };

      const applicant = await applicantsApi.create(applicantPayload);

      // Upload any documents attached to the application
      const fileItems = uploadedFiles.filter(f => f.file);
      if (fileItems.length > 0 && applicant?.id) {
        const results = await Promise.allSettled(
          fileItems.map(item => {
            const docType = docTypes.find(
              dt => dt.name?.toLowerCase() === item.type?.toLowerCase(),
            ) ?? docTypes[0];
            if (!docType) return Promise.reject(new Error('No document types configured'));
            const fd = new FormData();
            fd.append('file', item.file!);
            fd.append('name', item.type || item.file!.name);
            fd.append('documentTypeId', docType.id);
            fd.append('entityType', 'APPLICANT');
            fd.append('entityId', applicant.id);
            return documentsApi.upload(fd);
          }),
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
          toast.warning(`Applicant created, but ${failed} document(s) failed to upload.`);
        }
      }

      toast.success('Applicant created successfully');
      navigate(`/dashboard/applicants/${applicant.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create applicant. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/applicants">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">New Applicant</h1>
          <p className="text-muted-foreground mt-1">Driver Application Form</p>
        </div>
      </div>

      {/* Agency */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="max-w-sm">
            <Label htmlFor="agencyId" className="mb-2 block">Agency <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={agencyId} onValueChange={setAgencyId}>
              <SelectTrigger id="agencyId">
                <SelectValue placeholder="Select agency..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Agency (Direct)</SelectItem>
                {agencies.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Step Indicator */}
      <Card>
        <CardContent className="pt-6">
          <StepIndicator currentStep={currentStep} />
        </CardContent>
      </Card>

      {/* Form Content */}
      <Card>
        <CardContent className="p-8">
          <ApplicantFormSteps
            currentStep={currentStep}
            formData={formData}
            onInputChange={handleInputChange}
            onArrayToggle={handleArrayToggle}
            jobTypes={jobTypes}
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
          />

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-8 border-t mt-8">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button type="button" onClick={handleNext} className="ml-auto gap-2 bg-[#2563EB] hover:bg-[#1d4ed8]">
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting} className="ml-auto gap-2 bg-[#22C55E] hover:bg-[#16a34a]">
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Creating...' : 'Create Applicant'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
