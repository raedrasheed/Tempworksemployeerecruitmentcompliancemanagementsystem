import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { publicApplicationApi, settingsApi } from '../../services/api';
import { ApplicantFormSteps, ApplicantFormData, StepIndicator, UploadedFileItem } from '../../components/applicants/ApplicantFormSteps';

const EMPTY_FORM: ApplicantFormData = {
  jobTypeId: '',
  fullName: '', dateOfBirth: '', nationality: '', countryOfResidence: '',
  currentCountryOfResidence: '', permanentAddress: '',
  phone: '', email: '', earliestStartDate: '', howDidYouHear: '',
  drivingLicenseNumber: '', licenseIssuingCountry: '', licenseIssueDate: '', licenseValidUntil: '',
  categoryA: '', categoryB: '', categoryC: '', categoryD: '', categoryE: '',
  hasTachographCard: '', tachographNumber: '', tachographValidUntil: '',
  hasQualificationCard: '', qualificationValidUntil: '', hasADR: '', adrClasses: '', adrValidUntil: '',
  hasEUExperience: '', yearsEUExperience: '', totalCEExperience: '',
  yearsActiveDriving: '', mainlyHomeCountry: '', drivenOtherCountries: '', specifyCountries: '',
  kilometersRange: '', transportTypes: [], operationalSkills: [],
  truckBrands: [], otherBrand: '', gearboxType: '', trailerTypes: [],
  mostUsedTrailer: '', yearsWithTrailer: '', confidentTrailers: '',
  weekendDriving: false, nightDriving: false, workRegime: [],
  trafficAccidents: '', accidentDescription: '', aetrViolations: '', finesAbroad: '', ecoDriving: '',
  englishLevel: '', germanLevel: '', russianLevel: '', otherLanguages: '', languageAtWork: '',
  doubleCrewWillingness: '', maxTourWeeks: '', preferredCountries: '', undesiredCountries: '',
  passportNumber: '', passportValidUntil: '', hasEUVisa: '', visaType: '', visaValidUntil: '',
  hasWorkPermit: '', hasResidenceCard: '', issuingCountry: '',
};

const TOTAL_STEPS = 7;

export function PublicEmployeeApplication() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ApplicantFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [jobTypes, setJobTypes] = useState<{ id: string; name: string }[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);

  useEffect(() => {
    settingsApi.getJobTypes().then(setJobTypes).catch(() => {});
  }, []);

  const handleInputChange = (field: keyof ApplicantFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: keyof ApplicantFormData, value: string) => {
    setFormData(prev => {
      const arr = (prev[field] as string[]) || [];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(i => i !== value) : [...arr, value] };
    });
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '-';

      const payload = {
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
        jobTypeId: formData.jobTypeId || undefined,
        notes: JSON.stringify({
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
          licenseIssueDate: formData.licenseIssueDate,
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
          weekendDriving: formData.weekendDriving,
          nightDriving: formData.nightDriving,
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
          countryOfResidence: formData.countryOfResidence,
          currentCountryOfResidence: formData.currentCountryOfResidence,
          permanentAddress: formData.permanentAddress,
          howDidYouHear: formData.howDidYouHear,
        }),
      };

      const applicant = await publicApplicationApi.submit(payload);

      // Upload any documents attached to the application
      const fileItems = uploadedFiles.filter(f => f.file);
      if (fileItems.length > 0 && applicant?.id) {
        const results = await Promise.allSettled(
          fileItems.map(item =>
            publicApplicationApi.uploadDocument(applicant.id, item.file!, item.type || item.file!.name, item.type || 'Other'),
          ),
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
          toast.warning(`Application submitted, but ${failed} document(s) failed to upload. You can contact us to resubmit them.`);
        }
      }

      navigate('/application-success');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top header — matches Figma */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">TempWorks Europe</p>
              <p className="text-xs text-gray-500">Driver Application Form</p>
            </div>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Step indicator bar */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <StepIndicator currentStep={currentStep} />
        </div>
      </div>

      {/* Form card */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <ApplicantFormSteps
            currentStep={currentStep}
            formData={formData}
            onInputChange={handleInputChange}
            onArrayToggle={handleArrayToggle}
            jobTypes={jobTypes}
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
          />

          {/* Navigation */}
          <div className="flex justify-between pt-8 border-t mt-8">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : <div />}

            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
