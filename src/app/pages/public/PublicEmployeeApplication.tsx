import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Briefcase, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { publicApplicationApi, settingsApi, publicJobAdsApi, BACKEND_URL } from '../../services/api';
import { useBranding } from '../../hooks/useBranding';
import { ApplicantFormSteps, EMPTY_FORM, getVisibleTabs, StepIndicator, FormSettings, DEFAULT_FORM_SETTINGS, ApplicantFormData } from '../../components/applicants/ApplicantFormSteps';
import { ReCaptchaV2 } from '../../components/ui/ReCaptchaV2';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

export function PublicEmployeeApplication() {
  const branding = useBranding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobAdId = searchParams.get('jobAdId') || undefined;
  const jobCategory = searchParams.get('jobCategory') || undefined;
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ApplicantFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [jobTypes, setJobTypes] = useState<{ id: string; name: string }[]>([]);
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_FORM_SETTINGS);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const visibleTabs = useMemo(() => getVisibleTabs(formData), [formData.hasDrivingLicense]);

  useEffect(() => {
    if (jobAdId) {
      publicJobAdsApi.getBySlug(jobAdId).catch(() => {});
    }
  }, [jobAdId]);

  useEffect(() => {
    Promise.all([
      settingsApi.getJobTypes().then((types: any[]) => {
        setJobTypes(types);
        if (jobCategory) {
          const match = types.find((t: any) => t.name === jobCategory);
          if (match) setFormData(prev => ({ ...prev, jobTypeId: match.id }));
        }
      }).catch(() => {}),
      publicApplicationApi.getFormSettings().then((raw: any) => {
        if (!raw || typeof raw !== 'object') return;
        const parsed: Record<string, any> = {};
        for (const [k, v] of Object.entries(raw)) {
          parsed[k.replace(/^form\./, '')] = v;
        }
        setSettings(prev => ({ ...prev, ...parsed }));
      }).catch(() => {}),
    ]);
  }, []);

  const handleUpdate = (updater: (prev: ApplicantFormData) => ApplicantFormData) => {
    setFormData(updater);
  };

  const handleNext = () => {
    if (currentStep < visibleTabs.length) {
      setCurrentStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      if (currentStep === visibleTabs.length) setCaptchaToken(null);
      setCurrentStep(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!photoFile) {
      toast.error('A photo is required. Please go back to the Personal tab and upload your photo.');
      return;
    }
    if (!formData.declarationAccepted || !formData.agreeDataProcessing || !formData.agreeBackground) {
      toast.error('You must agree to all statements in the Review tab before submitting.');
      return;
    }
    if (!captchaToken) {
      toast.error('Please complete the "I am not a robot" verification before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        email: formData.email,
        phone: `${formData.phoneCode} ${formData.phone}`,
        citizenship: formData.citizenship,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        countryOfBirth: formData.countryOfBirth,
        cityOfBirth: formData.cityOfBirth,
        hasDrivingLicense: formData.hasDrivingLicense === 'yes',
        preferredStartDate: formData.preferredStartDate || undefined,
        availability: formData.availability || 'Immediate',
        willingToRelocate: formData.willingToRelocate,
        preferredLocations: formData.preferredLocations || undefined,
        salaryExpectation: formData.salaryExpectation || undefined,
        jobTypeId: formData.jobTypeId || undefined,
        jobAdId: jobAdId || undefined,
        applicationData: formData,
        recaptchaToken: captchaToken,
      };

      const applicant = await publicApplicationApi.submit(payload);

      if (photoFile && applicant?.id) {
        await publicApplicationApi.uploadDocument(applicant.id, photoFile, 'Profile Photo', 'Profile Photo').catch(() => {
          toast.warning('Application submitted but photo upload failed. Please contact us to resubmit your photo.');
        });
      }

      const fileItems = uploadedFiles.filter((f: any) => f.file);
      if (fileItems.length > 0 && applicant?.id) {
        const results = await Promise.allSettled(
          fileItems.map((item: any) => {
            const rawType: string = item.type || item.file!.name;
            const docTypeName = rawType.replace(/^Upload\s+/i, '').trim() || 'Other';
            return publicApplicationApi.uploadDocument(applicant.id, item.file!, rawType, docTypeName);
          }),
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
          toast.warning(`Application submitted, but ${failed} document(s) failed to upload.`);
        }
      }

      navigate('/application-success');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, photoFile, captchaToken, uploadedFiles, jobAdId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${BACKEND_URL}${branding.logoUrl}`} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Briefcase className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">{branding.companyName}</p>
              <p className="text-xs text-gray-500">Driver Application Form</p>
            </div>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {jobAdId && (
        <div className="bg-blue-50 border-b border-blue-100">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-blue-700">
            <Briefcase className="w-4 h-4 flex-shrink-0" />
            <span>
              Applying for a specific position.{' '}
              <Link to="/jobs" className="underline hover:text-blue-900">Browse all jobs</Link>
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <StepIndicator currentStep={currentStep} visibleTabs={visibleTabs} onStepClick={(step) => { if (step === visibleTabs.length) setCaptchaToken(null); setCurrentStep(step); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <ApplicantFormSteps
            currentStep={currentStep}
            visibleTabs={visibleTabs}
            formData={formData}
            onChange={handleUpdate}
            jobTypes={jobTypes}
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
            settings={settings}
            photoFile={photoFile}
            onPhotoChange={setPhotoFile}
          />

          {/* reCAPTCHA v2 "I am not a robot" checkbox — last step only */}
          {currentStep === visibleTabs.length && (
            <div className="mt-8">
              <ReCaptchaV2
                siteKey={RECAPTCHA_SITE_KEY}
                onVerify={(token) => setCaptchaToken(token)}
                onExpired={() => setCaptchaToken(null)}
              />
            </div>
          )}

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

            {currentStep < visibleTabs.length ? (
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
                disabled={submitting || !captchaToken}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={!captchaToken ? 'Please complete the reCAPTCHA' : undefined}
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
