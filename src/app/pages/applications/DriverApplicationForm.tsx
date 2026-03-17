import { useState } from 'react';
import { Upload, FileText, CheckCircle, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export function DriverApplicationForm() {
  const [formData, setFormData] = useState({
    fullName: '',
    nationality: '',
    passportNumber: '',
    phone: '',
    email: '',
    licenseType: '',
    experience: '',
  });

  const [uploadedFiles, setUploadedFiles] = useState({
    passport: false,
    license: false,
    criminalRecord: false,
    medicalCertificate: false,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (documentType: keyof typeof uploadedFiles) => {
    setUploadedFiles(prev => ({ ...prev, [documentType]: true }));
  };

  const handleSubmit = () => {
    alert('Application submitted successfully! We will review your application and contact you soon.');
  };

  const isFormValid = Object.values(formData).every(val => val !== '') && 
                      Object.values(uploadedFiles).every(val => val === true);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-[#0F172A] mb-2">Driver Application Form</h1>
          <p className="text-muted-foreground text-lg">
            Apply to join our professional driver network across Europe
          </p>
        </div>

        {/* Personal Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality *</Label>
                <Select value={formData.nationality} onValueChange={(val) => handleInputChange('nationality', val)}>
                  <SelectTrigger id="nationality" className="mt-1.5">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Poland">Poland</SelectItem>
                    <SelectItem value="Ukraine">Ukraine</SelectItem>
                    <SelectItem value="Romania">Romania</SelectItem>
                    <SelectItem value="Bulgaria">Bulgaria</SelectItem>
                    <SelectItem value="Moldova">Moldova</SelectItem>
                    <SelectItem value="Belarus">Belarus</SelectItem>
                    <SelectItem value="Lithuania">Lithuania</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="passportNumber">Passport Number *</Label>
              <Input
                id="passportNumber"
                placeholder="Enter passport number"
                value={formData.passportNumber}
                onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+48 123 456 789"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Professional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="licenseType">Driving License Type *</Label>
                <Select value={formData.licenseType} onValueChange={(val) => handleInputChange('licenseType', val)}>
                  <SelectTrigger id="licenseType" className="mt-1.5">
                    <SelectValue placeholder="Select license type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="C">C - Medium trucks</SelectItem>
                    <SelectItem value="CE">CE - Heavy trucks with trailer</SelectItem>
                    <SelectItem value="C1">C1 - Light trucks</SelectItem>
                    <SelectItem value="C1E">C1E - Light trucks with trailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="experience">Years of Experience *</Label>
                <Select value={formData.experience} onValueChange={(val) => handleInputChange('experience', val)}>
                  <SelectTrigger id="experience" className="mt-1.5">
                    <SelectValue placeholder="Select experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-2">1-2 years</SelectItem>
                    <SelectItem value="3-5">3-5 years</SelectItem>
                    <SelectItem value="6-10">6-10 years</SelectItem>
                    <SelectItem value="10+">10+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Required Documents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Please upload all required documents (PDF, JPG, or PNG format)
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'passport' as const, label: 'Passport Copy' },
              { key: 'license' as const, label: 'Driving License' },
              { key: 'criminalRecord' as const, label: 'Criminal Record Check' },
              { key: 'medicalCertificate' as const, label: 'Medical Certificate' },
            ].map((doc) => (
              <div
                key={doc.key}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {uploadedFiles[doc.key] ? (
                    <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                  ) : (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{doc.label}</p>
                    {uploadedFiles[doc.key] && (
                      <p className="text-sm text-[#22C55E]">Uploaded successfully</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={uploadedFiles[doc.key] ? 'outline' : 'default'}
                  onClick={() => handleFileUpload(doc.key)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadedFiles[doc.key] ? 'Replace' : 'Upload'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#0F172A]">Ready to submit your application?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFormValid 
                    ? 'All required fields are completed. Click submit to send your application.' 
                    : 'Please complete all required fields and upload all documents before submitting.'}
                </p>
              </div>
              <Button
                size="lg"
                disabled={!isFormValid}
                onClick={handleSubmit}
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Application
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Information */}
        <Card className="mt-6 border-[#2563EB] bg-[#EFF6FF]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#2563EB] mt-0.5" />
              <div>
                <p className="font-medium text-[#2563EB]">What happens next?</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Our HR team will review your application within 2-3 business days</li>
                  <li>• We will verify your documents and professional background</li>
                  <li>• You will receive an email with the application status</li>
                  <li>• Qualified candidates will be invited for an interview</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
