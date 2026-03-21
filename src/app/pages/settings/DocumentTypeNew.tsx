import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
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

export function DocumentTypeNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    required: false,
    expiryTracking: false,
    expiryWarningDays: '30',
    allowMultiple: false,
    verificationRequired: true,
    applicableJobTypes: [] as string[],
    fileFormats: [] as string[],
    maxFileSize: '10',
    validationRules: '',
  });

  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

  const jobTypes = [
    'Truck Driver',
    'Delivery Driver',
    'Warehouse Worker',
    'Forklift Operator',
    'Logistics Coordinator',
    'Construction Worker',
    'Technician',
    'General Worker',
  ];

  const fileFormats = ['PDF', 'JPG', 'PNG', 'DOCX', 'XLSX'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.createDocumentType({
        name: formData.name,
        description: formData.description || undefined,
        category: CATEGORY_LABELS[formData.category] ?? formData.category,
        required: formData.required,
        trackExpiry: formData.expiryTracking,
        renewalPeriodDays: formData.expiryTracking && formData.expiryWarningDays
          ? parseInt(formData.expiryWarningDays, 10)
          : undefined,
        isActive: true,
      });
      toast.success('Document type created successfully');
      navigate('/dashboard/settings/document-types');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create document type');
    } finally {
      setSaving(false);
    }
  };

  const handleJobTypeToggle = (jobType: string) => {
    setSelectedJobTypes(prev =>
      prev.includes(jobType)
        ? prev.filter(j => j !== jobType)
        : [...prev, jobType]
    );
  };

  const handleFormatToggle = (format: string) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/settings/document-types">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">New Document Type</h1>
          <p className="text-muted-foreground mt-1">Create a new document type configuration</p>
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

            {/* Job Type Applicability */}
            <Card>
              <CardHeader>
                <CardTitle>Job Type Applicability</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Select which job types require this document (leave empty for all)
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {jobTypes.map((jobType) => (
                    <div
                      key={jobType}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedJobTypes.includes(jobType)
                          ? 'border-[#2563EB] bg-[#EFF6FF]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleJobTypeToggle(jobType)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedJobTypes.includes(jobType)
                              ? 'border-[#2563EB] bg-[#2563EB]'
                              : 'border-gray-300'
                          }`}
                        >
                          {selectedJobTypes.includes(jobType) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">{jobType}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedJobTypes.length === 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex gap-2">
                      <Info className="w-4 h-4 text-[#2563EB] mt-0.5" />
                      <p className="text-sm text-[#2563EB]">
                        No job types selected. This document will apply to all job types.
                      </p>
                    </div>
                  </div>
                )}
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
                    <span className="font-medium">
                      {formData.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expiry Tracking:</span>
                    <span className="font-medium">
                      {formData.expiryTracking ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verification:</span>
                    <span className="font-medium">
                      {formData.verificationRequired ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Multiple Files:</span>
                    <span className="font-medium">
                      {formData.allowMultiple ? 'Allowed' : 'Single File'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">File Formats:</span>
                    <span className="font-medium">
                      {selectedFormats.length || 'Any'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Size:</span>
                    <span className="font-medium">
                      {formData.maxFileSize || '10'} MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job Types:</span>
                    <span className="font-medium">
                      {selectedJobTypes.length || 'All'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-[#FEF3C7] border-[#F59E0B]">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Important Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Document types affect employee onboarding requirements</li>
                  <li>• Required documents must be uploaded before workflow completion</li>
                  <li>• Expiry tracking will generate automatic notifications</li>
                  <li>• Changes will apply to all future uploads</li>
                </ul>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <Button type="submit" className="w-full" size="lg" disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Creating...' : 'Create Document Type'}
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to="/dashboard/settings/document-types">Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
