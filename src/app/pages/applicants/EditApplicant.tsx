import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { applicantsApi, settingsApi, agenciesApi } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, ChevronRight, ChevronLeft, Save, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
import { ApplicantFormSteps, EMPTY_FORM, getVisibleTabs, StepIndicator, FormSettings, DEFAULT_FORM_SETTINGS, ApplicantFormData } from '../../components/applicants/ApplicantFormSteps';

export function EditApplicant() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = usePermissions();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<ApplicantFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_FORM_SETTINGS);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | undefined>();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agencyId, setAgencyId] = useState<string>('');

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
    ]);
  }, []);

  useEffect(() => {
    if (!id) return;
    applicantsApi.get(id).then((applicant) => {
      const appData = applicant.applicationData || EMPTY_FORM;
      setFormData(appData);
      setAgencyId(applicant.agencyId || '');
      if (applicant.photoUrl) setExistingPhotoUrl(applicant.photoUrl.startsWith('http') ? applicant.photoUrl : `${API_BASE}${applicant.photoUrl}`);
    }).catch(() => {
      toast.error('Failed to load applicant data');
    }).finally(() => setLoading(false));
  }, [id]);

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
    agencyId: agencyId && agencyId !== 'none' ? agencyId : null,
    applicationData: formData,
  });

  const uploadPhotoIfNeeded = async () => {
    if (!photoFile || !id) return;
    try {
      const updated = await applicantsApi.uploadPhoto(id, photoFile);
      const resolvedUrl = updated.photoUrl?.startsWith('http')
        ? updated.photoUrl
        : `${API_BASE}${updated.photoUrl}`;
      setExistingPhotoUrl(resolvedUrl);
      setPhotoFile(null);
    } catch (photoErr: any) {
      toast.error(`Profile saved but photo upload failed: ${photoErr?.message ?? 'Unknown error'}`);
      throw photoErr;
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await applicantsApi.update(id, buildPayload());
      await uploadPhotoIfNeeded();
      toast.success('Applicant updated successfully');
    } catch (err: any) {
      if (!err?.message?.includes('photo upload failed')) {
        toast.error(err?.message || 'Failed to update applicant');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await applicantsApi.update(id, buildPayload());
      await uploadPhotoIfNeeded();
      toast.success('Applicant updated successfully');
      navigate(`/dashboard/applicants/${id}`);
    } catch (err: any) {
      if (!err?.message?.includes('photo upload failed')) {
        toast.error(err?.message || 'Failed to update applicant');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (!canEdit('applicants')) {
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
          <Link to={`/dashboard/applicants/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Edit Applicant</h1>
          <p className="text-muted-foreground mt-1">Update applicant information - ID: {id}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="max-w-sm">
            <Label htmlFor="agencyId" className="mb-2 block">Agency <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={agencyId || 'none'} onValueChange={(v) => setAgencyId(v === 'none' ? '' : v)}>
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
          <StepIndicator currentStep={currentStep} visibleTabs={visibleTabs} />
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
            existingPhotoUrl={existingPhotoUrl}
          />

          <div className="flex justify-between pt-8 border-t mt-8">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={submitting}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save'}
              </Button>
              {currentStep < visibleTabs.length ? (
                <Button onClick={handleNext} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} className="gap-2 bg-green-600 hover:bg-green-700">
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
