import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Upload, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { documentsApi, employeesApi, settingsApi } from '../../services/api';
import { apiError } from '../../../i18n/apiError';

export function DocumentUpload() {
  const { t } = useTranslation('pages');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    entityId: '',
    documentTypeId: '',
    name: '',
    expiryDate: '',
    issueDate: '',
    documentNumber: '',
    issuer: '',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    Promise.all([
      employeesApi.list({ limit: 500 }),
      settingsApi.getDocumentTypes(),
    ]).then(([empResult, types]) => {
      setEmployees((empResult as any)?.data ?? []);
      setDocTypes(Array.isArray(types) ? types : []);
    }).catch(() => toast.error(t('documents.upload.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error(t('documents.upload.fileRequired')); return; }
    if (!form.entityId) { toast.error(t('documents.upload.employeeRequired')); return; }
    if (!form.documentTypeId) { toast.error(t('documents.upload.docTypeRequired')); return; }
    if (!form.name.trim()) { toast.error(t('documents.upload.nameRequired')); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', form.name);
      formData.append('documentTypeId', form.documentTypeId);
      formData.append('entityType', 'EMPLOYEE');
      formData.append('entityId', form.entityId);
      if (form.expiryDate) formData.append('expiryDate', form.expiryDate);
      if (form.issueDate) formData.append('issueDate', form.issueDate);
      if (form.documentNumber) formData.append('documentNumber', form.documentNumber);
      if (form.issuer) formData.append('issuer', form.issuer);
      if (form.notes) formData.append('notes', form.notes);

      await documentsApi.upload(formData);
      toast.success(t('documents.upload.uploadSuccess'));
      navigate('/dashboard/documents-compliance');
    } catch (err: any) {
      toast.error(apiError(err, t('documents.upload.uploadFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">{tc('states.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/documents-compliance">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">{t('documents.upload.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('documents.upload.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('documents.upload.infoCardTitle')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-2">
                <Label htmlFor="employee">{t('documents.upload.selectEmployee')}</Label>
                <Select value={form.entityId} onValueChange={val => setForm(prev => ({ ...prev, entityId: val }))}>
                  <SelectTrigger id="employee">
                    <SelectValue placeholder={t('documents.upload.chooseEmployeePh')} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} — {emp.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="docType">{t('documents.upload.documentType')}</Label>
                <Select value={form.documentTypeId} onValueChange={val => setForm(prev => ({ ...prev, documentTypeId: val }))}>
                  <SelectTrigger id="docType">
                    <SelectValue placeholder={t('documents.upload.selectDocTypePh')} />
                  </SelectTrigger>
                  <SelectContent>
                    {docTypes.map(dt => (
                      <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('documents.upload.documentName')}</Label>
                <Input
                  id="name"
                  placeholder={t('documents.upload.documentNamePh')}
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">{t('documents.upload.issueDate')}</Label>
                  <Input id="issueDate" type="date" value={form.issueDate} onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">{t('documents.upload.expiryDate')}</Label>
                  <Input id="expiryDate" type="date" value={form.expiryDate} onChange={e => setForm(prev => ({ ...prev, expiryDate: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="documentNumber">{t('documents.upload.documentNumber')}</Label>
                  <Input id="documentNumber" placeholder={t('documents.upload.documentNumberPh')} value={form.documentNumber} onChange={e => setForm(prev => ({ ...prev, documentNumber: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuer">{t('documents.upload.issuer')}</Label>
                  <Input id="issuer" placeholder={t('documents.upload.issuerPh')} value={form.issuer} onChange={e => setForm(prev => ({ ...prev, issuer: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('documents.upload.notes')}</Label>
                <Input id="notes" placeholder={t('documents.upload.notesPh')} value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">{t('documents.upload.uploadFile')}</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-[#2563EB] transition-colors">
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-[#2563EB]" />
                      <div className="text-start">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">{t('documents.upload.clickOrDrag')}</p>
                      <p className="text-xs text-muted-foreground">{t('documents.upload.fileTypesHelp')}</p>
                    </>
                  )}
                  <Input
                    id="file"
                    type="file"
                    className="mt-4"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={submitting}>
              <Upload className="w-4 h-4 me-2" />
              {submitting ? t('documents.upload.uploading') : t('documents.upload.uploadButton')}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard/documents-compliance">{tc('actions.cancel')}</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
