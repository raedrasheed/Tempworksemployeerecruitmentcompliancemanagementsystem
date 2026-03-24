import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { settingsApi } from '../../services/api';

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  license: 'License',
  medical: 'Medical',
  legal: 'Legal',
  employment: 'Employment',
  insurance: 'Insurance',
  training: 'Training',
  other: 'Other',
};

function toCategoryKey(category: string): string {
  return category.toLowerCase();
}

export function DocumentTypeEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    required: false,
    expiryTracking: false,
    expiryWarningDays: '30',
    allowMultiple: false,
    verificationRequired: true,
    maxFileSize: '10',
    validationRules: '',
  });

  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const fileFormats = ['PDF', 'JPG', 'PNG', 'DOCX', 'XLSX'];

  useEffect(() => {
    if (!id) return;
    settingsApi.getDocumentType(id)
      .then((dt: any) => {
        setFormData({
          name: dt.name ?? '',
          description: dt.description ?? '',
          category: toCategoryKey(dt.category ?? ''),
          required: dt.required ?? false,
          expiryTracking: dt.trackExpiry ?? false,
          expiryWarningDays: dt.renewalPeriodDays ? String(dt.renewalPeriodDays) : '30',
          allowMultiple: false,
          verificationRequired: true,
          maxFileSize: '10',
          validationRules: '',
        });
        setDocumentCount(dt._count?.documents ?? 0);
      })
      .catch((err: any) => {
        toast.error(err?.message || 'Failed to load document type');
        navigate('/dashboard/settings/document-types');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.updateDocumentType(id!, {
        name: formData.name,
        description: formData.description || undefined,
        category: CATEGORY_LABELS[formData.category] ?? formData.category,
        required: formData.required,
        trackExpiry: formData.expiryTracking,
        renewalPeriodDays: formData.expiryTracking && formData.expiryWarningDays
          ? parseInt(formData.expiryWarningDays, 10)
          : undefined,
      });
      toast.success('Document type updated successfully');
      navigate(`/dashboard/settings/document-types/${id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update document type');
    } finally {
      setSaving(false);
    }
  };

  const handleFormatToggle = (format: string) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Loading document type...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/settings/document-types/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit Document Type</h1>
          <p className="text-muted-foreground mt-1">Update document type configuration</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Document Type Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Passport, Driving License, Work Permit"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose and requirements of this document type..."
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="identity">Identity Documents</SelectItem>
                      <SelectItem value="license">Licenses & Certifications</SelectItem>
                      <SelectItem value="medical">Medical & Health</SelectItem>
                      <SelectItem value="legal">Legal & Immigration</SelectItem>
                      <SelectItem value="employment">Employment Documents</SelectItem>
                      <SelectItem value="insurance">Insurance & Coverage</SelectItem>
                      <SelectItem value="training">Training & Education</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Document Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Document Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="required">Required Document</Label>
                    <p className="text-sm text-muted-foreground">
                      This document must be submitted by all employees
                    </p>
                  </div>
                  <Switch
                    id="required"
                    checked={formData.required}
                    onCheckedChange={(checked) => setFormData({ ...formData, required: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="expiryTracking">Expiry Date Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Track expiration dates and send renewal reminders
                    </p>
                  </div>
                  <Switch
                    id="expiryTracking"
                    checked={formData.expiryTracking}
                    onCheckedChange={(checked) => setFormData({ ...formData, expiryTracking: checked })}
                  />
                </div>

                {formData.expiryTracking && (
                  <div className="space-y-2 pl-4 border-l-2 border-[#2563EB]">
                    <Label htmlFor="expiryWarningDays">Warning Period (Days Before Expiry)</Label>
                    <Input
                      id="expiryWarningDays"
                      type="number"
                      min="1"
                      placeholder="30"
                      value={formData.expiryWarningDays}
                      onChange={(e) => setFormData({ ...formData, expiryWarningDays: e.target.value })}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allowMultiple">Allow Multiple Uploads</Label>
                    <p className="text-sm text-muted-foreground">
                      Employees can upload multiple files for this document type
                    </p>
                  </div>
                  <Switch
                    id="allowMultiple"
                    checked={formData.allowMultiple}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowMultiple: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="verificationRequired">Verification Required</Label>
                    <p className="text-sm text-muted-foreground">
                      Document must be verified by an administrator
                    </p>
                  </div>
                  <Switch
                    id="verificationRequired"
                    checked={formData.verificationRequired}
                    onCheckedChange={(checked) => setFormData({ ...formData, verificationRequired: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* File Upload Settings */}
            <Card>
              <CardHeader>
                <CardTitle>File Upload Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Allowed File Formats</Label>
                  <div className="flex flex-wrap gap-2">
                    {fileFormats.map((format) => (
                      <Button
                        key={format}
                        type="button"
                        variant={selectedFormats.includes(format) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFormatToggle(format)}
                      >
                        {format}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFormats.length > 0 ? selectedFormats.join(', ') : 'None'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxFileSize">Maximum File Size (MB)</Label>
                  <Input
                    id="maxFileSize"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="10"
                    value={formData.maxFileSize}
                    onChange={(e) => setFormData({ ...formData, maxFileSize: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Validation Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Validation Rules (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="validationRules">Custom Validation Rules</Label>
                  <Textarea
                    id="validationRules"
                    placeholder="Enter any specific validation requirements or rules for this document type..."
                    rows={4}
                    value={formData.validationRules}
                    onChange={(e) => setFormData({ ...formData, validationRules: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Example: Must be issued within the last 6 months, Must contain specific fields, etc.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="bg-gradient-to-br from-[#EFF6FF] to-white border-[#2563EB]">
              <CardHeader>
                <CardTitle className="text-sm">Configuration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium">{formData.required ? 'Required' : 'Optional'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expiry Tracking:</span>
                    <span className="font-medium">{formData.expiryTracking ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verification:</span>
                    <span className="font-medium">
                      {formData.verificationRequired ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Multiple Files:</span>
                    <span className="font-medium">{formData.allowMultiple ? 'Allowed' : 'Single File'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Size:</span>
                    <span className="font-medium">{formData.maxFileSize || '10'} MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warning Card */}
            <Card className="bg-[#FEF3C7] border-[#F59E0B]">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Important Notice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Changes will affect existing documents of this type</li>
                  <li>• Making a required document optional may affect compliance</li>
                  <li>• Expiry tracking changes apply to all future notifications</li>
                </ul>
              </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Uploads:</span>
                  <span className="font-semibold">{documentCount}</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <Button type="submit" className="w-full" size="lg" disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to={`/dashboard/settings/document-types/${id}`}>Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
