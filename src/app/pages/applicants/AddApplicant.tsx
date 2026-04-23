import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { applicationDraftsApi, settingsApi, agenciesApi, getCurrentUser } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, ChevronRight, ChevronLeft, UserPlus, ShieldOff, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { ApplicantFormSteps, EMPTY_FORM, getVisibleTabs, getStepErrors, getStepFieldErrors, StepIndicator, FormSettings, DEFAULT_FORM_SETTINGS, ApplicantFormData } from '../../components/applicants/ApplicantFormSteps';

export function AddApplicant() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ApplicantFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_FORM_SETTINGS);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agencyId, setAgencyId] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set once a saved draft has been hydrated so we can show the
  // "Resumed draft" affordance + a Discard button. Null means either
  // no draft existed on load or it has been submitted/discarded.
  const [draftId, setDraftId] = useState<string | null>(null);

  const visibleTabs = useMemo(() => getVisibleTabs(formData), [formData.hasDrivingLicense]);

  useEffect(() => {
    Promise.all([
      settingsApi.getJobTypes().then(setJobTypes).catch(() => {}),
      settingsApi.getAll().then((res: any) => {
        const arr: any[] = Array.isArray(res.form) ? res.form : [];
        if (arr.length > 0) {
          const formSettings = arr.reduce((acc: any, item: any) => {
            const key = String(item.key).replace(/^form\./, '');
            try { acc[key] = JSON.parse(item.value); } catch { acc[key] = item.value; }
            return acc;
          }, {});
          setSettings((prev: any) => ({ ...prev, ...formSettings }));
        }
      }).catch(() => {}),
      agenciesApi.list({ limit: 100 }).then((res: any) => setAgencies(res?.data ?? [])).catch(() => {}),
      // Hydrate an existing draft if the caller has one open. No
      // Applicant row has been created yet; this is the user's
      // own saved progress from a previous session.
      applicationDraftsApi.getMine()
        .then((draft: any) => {
          if (!draft) return;
          setDraftId(draft.id);
          const saved = (draft.formData ?? {}) as Partial<ApplicantFormData>;
          setFormData(prev => ({ ...prev, ...saved }));
          toast.info('Resumed your saved draft — finish and submit to create the applicant.');
        })
        .catch(() => { /* no draft, quiet fall-through */ }),
    ]);
  }, []);

  const handleUpdate = (updater: (prev: ApplicantFormData) => ApplicantFormData) => {
    setFormData(updater);
  };

  const handleNext = () => {
    if (currentStep < visibleTabs.length) {
      const actualTab = visibleTabs[currentStep - 1];
      const errors = getStepErrors(actualTab, formData, uploadedFiles, photoFile);
      const fErrs  = getStepFieldErrors(actualTab, formData);
      setFieldErrors(fErrs);
      if (errors.length > 0) {
        errors.forEach(msg => toast.error(msg));
        return;
      }
      setFieldErrors({});
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

  // Build the Applicant create payload from the current form state.
  // Shared between "Save for Later" (partial OK) and "Submit" (final).
  const buildPayload = () => ({
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
    jobTypeId: formData.jobTypeId || undefined,
    ...(agencyId && agencyId !== 'none' ? { agencyId } : {}),
    applicationData: formData,
  });

  // Save for Later — persists the raw formData. No Applicant is
  // created. Draft is user-scoped, at most one open per user.
  const handleSaveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const saved = await applicationDraftsApi.saveMine({ formData });
      setDraftId(saved.id);
      toast.success('Draft saved — you can come back to this page to continue.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  // Discard the saved draft and reset the form. Lets the user start a
  // fresh application when they change their mind about the one in
  // progress.
  const handleDiscardDraft = async () => {
    const ok = await confirm({
      title: 'Discard saved draft?',
      description: 'Your saved progress will be deleted and the form reset. This cannot be undone.',
      confirmText: 'Discard',
      tone: 'destructive',
    });
    if (!ok) return;
    try {
      await applicationDraftsApi.deleteMine();
      setFormData(EMPTY_FORM);
      setAgencyId('');
      setUploadedFiles([]);
      setPhotoFile(null);
      setCurrentStep(1);
      setDraftId(null);
      toast.success('Draft discarded.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to discard draft');
    }
  };

  // Final submit — creates the Applicant and deletes the draft in
  // one backend call (POST /application-drafts/mine/submit). The
  // "submitting" gate guards against double-click.
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await applicationDraftsApi.submitMine(buildPayload());
      setDraftId(null);
      toast.success('Applicant created successfully');
      // Agency submissions land on the Candidates queue (pending
      // Tempworks approval). Tempworks-staff submissions stay on
      // the Applicants (Leads) list.
      const role = getCurrentUser()?.role;
      const isAgency = role === 'Agency User' || role === 'Agency Manager';
      navigate(isAgency ? '/dashboard/candidates' : '/dashboard/applicants');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create applicant');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate('applicants')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ShieldOff className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You don't have permission to perform this action.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/applicants">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">New Applicant</h1>
          <p className="text-muted-foreground mt-1">
            {draftId
              ? 'Continuing your saved draft — no applicant has been created yet.'
              : 'Driver Application Form'}
          </p>
        </div>
        {draftId && (
          <Button variant="outline" size="sm" onClick={handleDiscardDraft} className="gap-2 text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
            Discard draft
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="max-w-sm">
            <Label htmlFor="agencyId" className="mb-2 block">Agency <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={agencyId} onValueChange={setAgencyId}>
              <SelectTrigger id="agencyId">
                <SelectValue placeholder="Select agency..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Agency</SelectItem>
                {agencies.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <StepIndicator currentStep={currentStep} visibleTabs={visibleTabs} onStepClick={(step) => { setCurrentStep(step); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-8">
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
            fieldErrors={fieldErrors}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-8 border-t mt-8">
            {currentStep > 1 ? (
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            ) : <div />}

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* Save for Later — partial persistence, no Applicant
                  row. Available at every step (including step 1). */}
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={savingDraft || submitting}
                className="gap-2"
                title="Save your progress; no applicant is created until you submit."
              >
                <Save className="w-4 h-4" />
                {savingDraft ? 'Saving…' : 'Save for Later'}
              </Button>

              {currentStep < visibleTabs.length ? (
                <Button onClick={handleNext} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || savingDraft} className="gap-2 bg-green-600 hover:bg-green-700">
                  <UserPlus className="w-4 h-4" />
                  {submitting ? 'Creating…' : 'Create Applicant'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
