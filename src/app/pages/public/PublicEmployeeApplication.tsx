import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Briefcase, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { publicApplicationApi, settingsApi, publicJobAdsApi } from '../../services/api';
import { ApplicantFormSteps, EMPTY_FORM, getVisibleTabs, StepIndicator, FormSettings, DEFAULT_FORM_SETTINGS, ApplicantFormData } from '../../components/applicants/ApplicantFormSteps';
import { SimpleCaptcha } from '../../components/ui/SimpleCaptcha';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

// ── Inner form (needs reCAPTCHA context) ────────────────────────────────────

function ApplicationForm() {
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
  const [captchaVerified, setCaptchaVerified] = useState(false);

  const { executeRecaptcha } = useGoogleReCaptcha();
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
      if (currentStep === visibleTabs.length) setCaptchaVerified(false);
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
    if (!captchaVerified) {
      toast.error('Please complete the CAPTCHA verification before submitting.');
      return;
    }
    if (!executeRecaptcha) {
      toast.error('reCAPTCHA is not ready yet. Please try again in a moment.');
      return;
    }

    setSubmitting(true);
    try {
      // Execute reCAPTCHA v3 silently — returns a token for backend verification
      const recaptchaToken = await executeRecaptcha('submit_application');

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
        recaptchaToken,
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
  }, [executeRecaptcha, captchaVerified, formData, photoFile, uploadedFiles, jobAdId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
          <StepIndicator currentStep={currentStep} visibleTabs={visibleTabs} />
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

          {/* Visible CAPTCHA challenge on last step */}
          {currentStep === visibleTabs.length && (
            <div className="mt-8 p-5 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">Security Verification — please solve the puzzle below</p>
              <SimpleCaptcha onVerify={setCaptchaVerified} />
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
                disabled={submitting || !captchaVerified}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

// ── Public export — wraps with reCAPTCHA v3 provider ────────────────────────

export function PublicEmployeeApplication() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <ApplicationForm />
    </GoogleReCaptchaProvider>
  );
}
