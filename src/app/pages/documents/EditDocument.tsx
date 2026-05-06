import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { documentsApi, settingsApi } from '../../services/api';
import { apiError } from '../../../i18n/apiError';
import { useValidationErrors } from '../../../i18n/useValidationErrors';
import { FieldError } from '../../components/ui/field-error';
import { ValidationSummary } from '../../components/ui/validation-summary';

export function EditDocument() {
  const { t } = useTranslation('pages');
  const { t: tc } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<{ id: string; name: string }[]>([]);
  const { errors: fieldErrs, setFromError, clearAll: clearFieldErrors } = useValidationErrors();
  const [form, setForm] = useState({
    name: '',
    documentTypeId: '',
    expiryDate: '',
    issueDate: '',
    documentNumber: '',
    issuer: '',
    notes: '',
  });

  useEffect(() => {
    settingsApi.getDocumentTypes().then((types: any[]) => setDocumentTypes(types)).catch(() => {});
    documentsApi.get(id!).then((doc: any) => {
      setForm({
        name: doc.name ?? '',
        documentTypeId: doc.documentTypeId ?? doc.documentType?.id ?? '',
        expiryDate: doc.expiryDate ? doc.expiryDate.slice(0, 10) : '',
        issueDate: doc.issueDate ? doc.issueDate.slice(0, 10) : '',
        documentNumber: doc.documentNumber ?? '',
        issuer: doc.issuer ?? '',
        notes: doc.notes ?? '',
      });
    }).catch(() => toast.error(t('documents.edit.loadFailed')))
      .finally(() => setLoading(false));
  }, [id, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFieldErrors();
    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name,
        documentTypeId: form.documentTypeId || undefined,
        documentNumber: form.documentNumber || undefined,
        issuer: form.issuer || undefined,
        notes: form.notes || undefined,
        expiryDate: form.expiryDate || undefined,
        issueDate: form.issueDate || undefined,
      };
      await documentsApi.update(id!, payload);
      toast.success(t('documents.edit.updateSuccess'));
      navigate(`/dashboard/documents/${id}`);
    } catch (err: any) {
      setFromError(err);
      toast.error(apiError(err, t('documents.edit.updateFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">{tc('states.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/documents/${id}`}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">{t('documents.edit.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('documents.edit.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">
          <ValidationSummary errors={fieldErrs} />
          <Card>
            <CardHeader><CardTitle>{t('documents.edit.infoTitle')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-2">
                <Label htmlFor="name">{t('documents.edit.name')}</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  aria-invalid={!!fieldErrs.name}
                  className={fieldErrs.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                <FieldError errors={fieldErrs} name="name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentTypeId">{t('documents.edit.documentType')}</Label>
                <select
                  id="documentTypeId"
                  value={form.documentTypeId}
                  onChange={e => setForm(prev => ({ ...prev, documentTypeId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{t('documents.edit.selectTypePh')}</option>
                  {documentTypes.map(dt => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">{t('documents.edit.issueDate')}</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={form.issueDate}
                    onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">{t('documents.edit.expiryDate')}</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={form.expiryDate}
                    onChange={e => setForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="documentNumber">{t('documents.edit.documentNumber')}</Label>
                  <Input
                    id="documentNumber"
                    placeholder={t('documents.edit.documentNumberPh')}
                    value={form.documentNumber}
                    onChange={e => setForm(prev => ({ ...prev, documentNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuer">{t('documents.edit.issuer')}</Label>
                  <Input
                    id="issuer"
                    placeholder={t('documents.edit.issuerPh')}
                    value={form.issuer}
                    onChange={e => setForm(prev => ({ ...prev, issuer: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('documents.edit.notes')}</Label>
                <Input
                  id="notes"
                  placeholder={t('documents.edit.notesPh')}
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={submitting}>
              <Save className="w-4 h-4 me-2" />
              {submitting ? t('documents.edit.saving') : t('documents.edit.saveChanges')}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to={`/dashboard/documents/${id}`}>{tc('actions.cancel')}</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
