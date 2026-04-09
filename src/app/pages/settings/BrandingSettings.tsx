import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Upload, Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { settingsApi } from '../../services/api';
import { BACKEND_URL } from '../../services/api';
import { invalidateBrandingCache } from '../../hooks/useBranding';

export function BrandingSettings() {
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsApi.getBranding().then(data => {
      setCompanyName(data.companyName || '');
      setLogoUrl(data.logoUrl);
    }).catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadLogo = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const result = await settingsApi.uploadLogo(selectedFile);
      setLogoUrl(result.logoUrl);
      setPreviewUrl(undefined);
      setSelectedFile(null);
      invalidateBrandingCache();
      toast.success('Logo uploaded successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!companyName.trim()) {
      toast.error('Company name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await settingsApi.update({ 'branding.companyName': companyName.trim() });
      invalidateBrandingCache();
      toast.success('Company name saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resolvedLogoUrl = previewUrl
    ? previewUrl
    : logoUrl
      ? (logoUrl.startsWith('http') ? logoUrl : `${BACKEND_URL}${logoUrl}`)
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Company Branding</h1>
          <p className="text-muted-foreground mt-1">Customize the company name and logo shown across the platform</p>
        </div>
      </div>

      {/* Company Name */}
      <Card>
        <CardHeader>
          <CardTitle>Company Name</CardTitle>
          <CardDescription>This name appears in the sidebar, login page, and public pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <div className="flex gap-3">
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. TempWorks Europe"
                className="max-w-sm"
              />
              <Button onClick={handleSaveName} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
          <CardDescription>Upload a logo to replace the default icon. Recommended: square PNG/SVG, max 2 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current logo preview */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
              {resolvedLogoUrl ? (
                <img src={resolvedLogoUrl} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-8 h-8 text-primary-foreground" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {logoUrl ? 'Current logo' : 'No logo uploaded — default icon is shown'}
            </div>
          </div>

          {/* Upload control */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
            {selectedFile && (
              <Button onClick={handleUploadLogo} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload Logo'}
              </Button>
            )}
            {selectedFile && (
              <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
