import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { publicApplicationApi, settingsApi } from '../../services/api';
import { ApplicantFormSteps, EMPTY_FORM, getVisibleTabs, StepIndicator, FormSettings, DEFAULT_FORM_SETTINGS, ApplicantFormData } from '../../components/applicants/ApplicantFormSteps';

export function PublicEmployeeApplication() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ApplicantFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [jobTypes, setJobTypes] = useState<{ id: string; name: string }[]>([]);
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_FORM_SETTINGS);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const visibleTabs = useMemo(() => getVisibleTabs(formData), [formData.hasDrivingLicense]);

  useEffect(() => {
    Promise.all([
      settingsApi.getJobTypes().then(setJobTypes).catch(() => {}),
      publicApplicationApi.getFormSettings().then((raw: any) => {
        if (!raw || typeof raw !== 'object') return;
        // Strip "form." prefix from keys (handles both old and new backend)
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
      setCurrentStep(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
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
        applicationData: formData,
      };

      const applicant = await publicApplicationApi.submit(payload);

      const fileItems = uploadedFiles.filter((f: any) => f.file);
      if (fileItems.length > 0 && applicant?.id) {
        const results = await Promise.allSettled(
          fileItems.map((item: any) =>
            publicApplicationApi.uploadDocument(applicant.id, item.file!, item.type || item.file!.name, item.type || 'Other'),
          ),
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
  };

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
          />

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
