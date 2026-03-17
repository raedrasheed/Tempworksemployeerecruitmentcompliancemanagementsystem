import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft, Upload, FileText, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export function PublicDriverApplication() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    // Personal Information
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    passportNumber: '',
    
    // Contact Information
    phone: '',
    email: '',
    countryOfResidence: '',
    
    // Professional Information
    jobType: '',
    licenseType: '',
    yearsExperience: '',
    previousEmployer: '',
  });

  const [documents, setDocuments] = useState({
    passport: null as File | null,
    drivingLicense: null as File | null,
    criminalRecord: null as File | null,
    medicalCertificate: null as File | null,
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: keyof typeof documents, file: File | null) => {
    setDocuments(prev => ({ ...prev, [field]: file }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate form submission
    setTimeout(() => {
      setLoading(false);
      navigate('/application-success');
    }, 2000);
  };

  const handleSaveDraft = () => {
    // Simulate saving draft
    alert('Draft saved successfully!');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8">
      {/* Header */}
      <div className="container mx-auto px-4 mb-8">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-[#0F172A] block">TempWorks Europe</span>
              <span className="text-xs text-muted-foreground">Employment Application</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-center border-b">
            <CardTitle className="text-3xl mb-2">Employment Application Form</CardTitle>
            <p className="text-muted-foreground">
              Apply for a career opportunity with our partner companies in Europe. Complete all fields and upload required documents.
            </p>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  Personal Information
                </h3>

                <div className="grid md:grid-cols-2 gap-4 ml-10">
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-sm font-medium">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="dateOfBirth" className="text-sm font-medium">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="nationality" className="text-sm font-medium">
                      Nationality <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="nationality"
                      placeholder="e.g., Ukrainian"
                      value={formData.nationality}
                      onChange={(e) => handleInputChange('nationality', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="passportNumber" className="text-sm font-medium">
                      Passport Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="passportNumber"
                      placeholder="AA1234567"
                      value={formData.passportNumber}
                      onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  Contact Information
                </h3>

                <div className="grid md:grid-cols-2 gap-4 ml-10">
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+380 12 345 6789"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="countryOfResidence" className="text-sm font-medium">
                      Country of Residence <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="countryOfResidence"
                      placeholder="e.g., Ukraine"
                      value={formData.countryOfResidence}
                      onChange={(e) => handleInputChange('countryOfResidence', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  Professional Information
                </h3>

                <div className="grid md:grid-cols-2 gap-4 ml-10">
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="jobType" className="text-sm font-medium">
                      Job Type <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.jobType}
                      onValueChange={(value) => handleInputChange('jobType', value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="truckDriver">Truck Driver</SelectItem>
                        <SelectItem value="deliveryDriver">Delivery Driver</SelectItem>
                        <SelectItem value="warehouseWorker">Warehouse Worker</SelectItem>
                        <SelectItem value="forkliftOperator">Forklift Operator</SelectItem>
                        <SelectItem value="logisticsCoordinator">Logistics Coordinator</SelectItem>
                        <SelectItem value="constructionWorker">Construction Worker</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="generalWorker">General Worker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="licenseType" className="text-sm font-medium">
                      Driving License Type {formData.jobType?.includes('Driver') && <span className="text-red-500">*</span>}
                    </label>
                    <Select
                      value={formData.licenseType}
                      onValueChange={(value) => handleInputChange('licenseType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select license type (if applicable)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B">B - Cars</SelectItem>
                        <SelectItem value="C">C - Medium trucks</SelectItem>
                        <SelectItem value="CE">CE - Heavy trucks with trailer</SelectItem>
                        <SelectItem value="C1">C1 - Light trucks</SelectItem>
                        <SelectItem value="C1E">C1E - Light trucks with trailer</SelectItem>
                        <SelectItem value="none">No license</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="yearsExperience" className="text-sm font-medium">
                      Years of Experience <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="yearsExperience"
                      type="number"
                      min="0"
                      placeholder="e.g., 5"
                      value={formData.yearsExperience}
                      onChange={(e) => handleInputChange('yearsExperience', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="previousEmployer" className="text-sm font-medium">
                      Previous Employer
                    </label>
                    <Input
                      id="previousEmployer"
                      placeholder="Company name (optional)"
                      value={formData.previousEmployer}
                      onChange={(e) => handleInputChange('previousEmployer', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Document Upload */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  Required Documents
                </h3>

                <div className="grid md:grid-cols-2 gap-4 ml-10">
                  {/* Passport */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      Passport Copy <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-[#2563EB] transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="passport"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('passport', e.target.files?.[0] || null)}
                        className="hidden"
                        required
                      />
                      <label htmlFor="passport" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        {documents.passport ? (
                          <div className="flex items-center justify-center gap-2 text-[#22C55E]">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">{documents.passport.name}</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Driving License */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      Driving License <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-[#2563EB] transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="drivingLicense"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('drivingLicense', e.target.files?.[0] || null)}
                        className="hidden"
                        required
                      />
                      <label htmlFor="drivingLicense" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        {documents.drivingLicense ? (
                          <div className="flex items-center justify-center gap-2 text-[#22C55E]">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">{documents.drivingLicense.name}</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Criminal Record */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      Criminal Record <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-[#2563EB] transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="criminalRecord"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('criminalRecord', e.target.files?.[0] || null)}
                        className="hidden"
                        required
                      />
                      <label htmlFor="criminalRecord" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        {documents.criminalRecord ? (
                          <div className="flex items-center justify-center gap-2 text-[#22C55E]">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">{documents.criminalRecord.name}</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Medical Certificate */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      Medical Certificate <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-[#2563EB] transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="medicalCertificate"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('medicalCertificate', e.target.files?.[0] || null)}
                        className="hidden"
                        required
                      />
                      <label htmlFor="medicalCertificate" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        {documents.medicalCertificate ? (
                          <div className="flex items-center justify-center gap-2 text-[#22C55E]">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">{documents.medicalCertificate.name}</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="bg-[#F8FAFC] p-4 rounded-lg ml-10">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" required className="mt-1" />
                  <span className="text-sm text-muted-foreground">
                    I confirm that all information provided is accurate and complete. I understand that false information 
                    may result in the rejection of my application. I agree to the processing of my personal data for 
                    recruitment purposes.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={loading}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  type="submit"
                  className="bg-[#2563EB] hover:bg-[#1d4ed8]"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="container mx-auto px-4 mt-8">
        <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          Your application will be reviewed by our recruitment team within 5-7 business days. 
          You will receive an email confirmation and updates about your application status.
        </p>
      </div>
    </div>
  );
}