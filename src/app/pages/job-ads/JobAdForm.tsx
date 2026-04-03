import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { jobAdsApi, settingsApi } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { CountrySelect } from '../../components/ui/CountrySelect';

interface Constants {
  statuses:      string[];
  contractTypes: string[];
  currencies:    string[];
}

const DEFAULT_CONSTANTS: Constants = {
  statuses:      ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  contractTypes: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Seasonal'],
  currencies:    ['GBP', 'EUR', 'USD', 'PLN'],
};

const EMPTY_FORM = {
  title:        '',
  category:     '',
  description:  '',
  city:         '',
  country:      '',
  contractType: 'Full-time',
  salaryMin:    '',
  salaryMax:    '',
  currency:     'GBP',
  status:       'DRAFT',
};

export function JobAdForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [constants, setConstants] = useState<Constants>(DEFAULT_CONSTANTS);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    jobAdsApi.getConstants()
      .then((c: any) => setConstants(c))
      .catch(() => {});

    settingsApi.getJobTypes()
      .then((types: any[]) => setCategories(types.filter((t: any) => t.isActive).map((t: any) => t.name)))
      .catch(() => {});

    if (isEdit && id) {
      jobAdsApi.get(id).then((ad: any) => {
        setForm({
          title:        ad.title        ?? '',
          category:     ad.category     ?? '',
          description:  ad.description  ?? '',
          city:         ad.city         ?? '',
          country:      ad.country      ?? '',
          contractType: ad.contractType ?? 'Full-time',
          salaryMin:    ad.salaryMin    != null ? String(ad.salaryMin)  : '',
          salaryMax:    ad.salaryMax    != null ? String(ad.salaryMax)  : '',
          currency:     ad.currency     ?? 'GBP',
          status:       ad.status       ?? 'DRAFT',
        });
      }).catch(() => {
        toast.error('Failed to load job ad');
        navigate('/dashboard/job-ads');
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async (publishNow = false) => {
    if (!form.title.trim())       return toast.error('Title is required');
    if (!form.category.trim())    return toast.error('Category is required');
    if (!form.description.trim()) return toast.error('Description is required');
    if (!form.city.trim())        return toast.error('City is required');
    if (!form.country.trim())     return toast.error('Country is required');

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title:        form.title,
        category:     form.category,
        description:  form.description,
        city:         form.city,
        country:      form.country,
        contractType: form.contractType,
        currency:     form.currency,
        status:       publishNow ? 'PUBLISHED' : form.status,
        ...(form.salaryMin !== '' ? { salaryMin: Number(form.salaryMin) } : {}),
        ...(form.salaryMax !== '' ? { salaryMax: Number(form.salaryMax) } : {}),
      };

      if (isEdit && id) {
        await jobAdsApi.update(id, payload);
        toast.success('Job ad updated');
      } else {
        await jobAdsApi.create(payload);
        toast.success(publishNow ? 'Job ad published' : 'Job ad created as draft');
      }
      navigate('/dashboard/job-ads');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save job ad');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/job-ads')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEdit ? 'Edit Job Ad' : 'New Job Ad'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update the job advertisement details' : 'Create a new job advertisement'}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Truck Driver – CE Licence Required"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contract Type</Label>
              <Select value={form.contractType} onValueChange={v => setForm(p => ({ ...p, contractType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {constants.contractTypes.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>City <span className="text-destructive">*</span></Label>
              <Input value={form.city} onChange={set('city')} placeholder="e.g. Warsaw" />
            </div>
            <div>
              <Label>Country <span className="text-destructive">*</span></Label>
              <CountrySelect
                value={form.country}
                onChange={v => setForm(p => ({ ...p, country: v }))}
                placeholder="Select country"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Description <span className="text-destructive">*</span></Label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={10}
            placeholder="Describe the role, requirements, responsibilities, and benefits…"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </CardContent>
      </Card>

      {/* Salary & Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salary & Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Min Salary</Label>
              <Input
                type="number" min="0"
                value={form.salaryMin}
                onChange={set('salaryMin')}
                placeholder="e.g. 2500"
              />
            </div>
            <div>
              <Label>Max Salary</Label>
              <Input
                type="number" min="0"
                value={form.salaryMax}
                onChange={set('salaryMax')}
                placeholder="e.g. 3500"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {constants.currencies.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {constants.statuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => navigate('/dashboard/job-ads')}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            Save as Draft
          </Button>
          {form.status !== 'PUBLISHED' && (
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Eye className="w-4 h-4 mr-2" />
              {isEdit ? 'Save & Publish' : 'Create & Publish'}
            </Button>
          )}
          {form.status === 'PUBLISHED' && (
            <Button
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
