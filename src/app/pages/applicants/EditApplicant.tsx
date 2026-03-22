import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { applicantsApi, settingsApi } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { ArrowLeft, ChevronRight, ChevronLeft, Save } from 'lucide-react';
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

export function EditApplicant() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<ApplicantFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);

  useEffect(() => {
    settingsApi.getJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    applicantsApi.get(id).then((applicant) => {
      let extra: Record<string, any> = {};
      try { extra = JSON.parse(applicant.notes || '{}'); } catch { /* ignore */ }
      setFormData({
        ...EMPTY_FORM,
        fullName: `${applicant.firstName} ${applicant.lastName}`.trim(),
        dateOfBirth: applicant.dateOfBirth ? applicant.dateOfBirth.slice(0, 10) : '',
        nationality: applicant.nationality || '',
        phone: applicant.phone || '',
        email: applicant.email || '',
        earliestStartDate: applicant.preferredStartDate ? applicant.preferredStartDate.slice(0, 10) : '',
        jobTypeId: applicant.jobTypeId || '',
        ...extra,
      });
    }).catch(() => {
      toast.error('Failed to load applicant data');
    }).finally(() => setLoading(false));
  }, [id]);

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

  const buildUpdatePayload = () => {
    const nameParts = formData.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '-';
    const extraData = { ...formData };
    delete (extraData as any).fullName;
    delete (extraData as any).dateOfBirth;
    delete (extraData as any).nationality;
    delete (extraData as any).phone;
    delete (extraData as any).email;
    delete (extraData as any).earliestStartDate;
    return {
      firstName, lastName,
      email: formData.email,
      phone: formData.phone,
      nationality: formData.nationality,
      dateOfBirth: formData.dateOfBirth,
      preferredStartDate: formData.earliestStartDate || undefined,
      availability: formData.earliestStartDate || 'Immediate',
      notes: JSON.stringify(extraData),
      ...(formData.jobTypeId ? { jobTypeId: formData.jobTypeId } : {}),
    };
  };

  const handleSave = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await applicantsApi.update(id, buildUpdatePayload());
      toast.success('Applicant updated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update applicant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await applicantsApi.update(id, buildUpdatePayload());
      toast.success('Applicant updated successfully');
      navigate(`/dashboard/applicants/${id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update applicant');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading applicant data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/applicants/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit Applicant</h1>
          <p className="text-muted-foreground mt-1">Update applicant information - ID: {id}</p>
        </div>
      </div>

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
            {currentStep > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={submitting}
                className="gap-2 border-[#22C55E] text-[#22C55E] hover:bg-green-50"
              >
                <Save className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Update Applicant'}
              </Button>
              {currentStep < totalSteps ? (
                <Button type="button" onClick={handleNext} className="gap-2 bg-[#2563EB] hover:bg-[#1d4ed8]">
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-2 bg-[#22C55E] hover:bg-[#16a34a]">
                  <Save className="w-4 h-4" />
                  {submitting ? 'Saving...' : 'Save & Close'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
