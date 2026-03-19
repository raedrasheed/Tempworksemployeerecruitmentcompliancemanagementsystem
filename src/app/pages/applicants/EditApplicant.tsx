import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { ArrowLeft, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

interface FormData {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  currentCountryOfResidence: string;
  permanentAddress: string;
  phone: string;
  email: string;
  earliestStartDate: string;
  howDidYouHear: string;
  passportNumber: string;
  passportValidUntil: string;
  hasEUVisa: string;
  visaType: string;
  visaValidUntil: string;
  hasWorkPermit: string;
  hasResidenceCard: string;
  issuingCountry: string;
  drivingLicenseNumber: string;
  licenseIssuingCountry: string;
  licenseValidUntil: string;
  categoryA: string;
  categoryB: string;
  categoryC: string;
  categoryD: string;
  categoryE: string;
  hasTachographCard: string;
  tachographNumber: string;
  tachographValidUntil: string;
  hasQualificationCard: string;
  qualificationValidUntil: string;
  hasADR: string;
  adrClasses: string;
  adrValidUntil: string;
  hasEUExperience: string;
  yearsEUExperience: string;
  totalCEExperience: string;
  yearsActiveDriving: string;
  mainlyHomeCountry: string;
  drivenOtherCountries: string;
  specifyCountries: string;
  kilometersRange: string;
  transportTypes: string[];
  operationalSkills: string[];
  truckBrands: string[];
  otherBrand: string;
  gearboxType: string;
  trailerTypes: string[];
  mostUsedTrailer: string;
  yearsWithTrailer: string;
  confidentTrailers: string;
  workRegime: string[];
  trafficAccidents: string;
  accidentDescription: string;
  aetrViolations: string;
  finesAbroad: string;
  ecoDriving: string;
  englishLevel: string;
  germanLevel: string;
  russianLevel: string;
  otherLanguages: string;
  languageAtWork: string;
  doubleCrewWillingness: string;
  maxTourWeeks: string;
  preferredCountries: string;
  undesiredCountries: string;
  weekendDriving: boolean;
  nightDriving: boolean;
}

export function EditApplicant() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 10;

  // Pre-filled with existing applicant data
  const [formData, setFormData] = useState<FormData>({
    fullName: 'Andrei Popescu',
    dateOfBirth: '1988-05-15',
    nationality: 'Romania',
    countryOfResidence: 'Romania',
    currentCountryOfResidence: 'Romania',
    permanentAddress: 'Str. Victoriei 45, Bucharest',
    phone: '+40 721 234 567',
    email: 'andrei.popescu@email.com',
    earliestStartDate: '2026-04-01',
    howDidYouHear: 'linkedin',
    passportNumber: 'RO123456789',
    passportValidUntil: '2030-12-31',
    hasEUVisa: 'no',
    visaType: '',
    visaValidUntil: '',
    hasWorkPermit: 'yes',
    hasResidenceCard: 'yes',
    issuingCountry: 'Romania',
    drivingLicenseNumber: 'RO-4567-CE',
    licenseIssuingCountry: 'Romania',
    licenseValidUntil: '2028-05-15',
    categoryA: '2005-03-10',
    categoryB: '2006-04-15',
    categoryC: '2015-07-20',
    categoryD: '',
    categoryE: '2016-09-10',
    hasTachographCard: 'yes',
    tachographNumber: 'TACH123456',
    tachographValidUntil: '2027-03-15',
    hasQualificationCard: 'yes',
    qualificationValidUntil: '2027-06-30',
    hasADR: 'no',
    adrClasses: '',
    adrValidUntil: '',
    hasEUExperience: 'yes',
    yearsEUExperience: '5',
    totalCEExperience: '8',
    yearsActiveDriving: '8',
    mainlyHomeCountry: 'no',
    drivenOtherCountries: 'yes',
    specifyCountries: 'Germany, France, Netherlands, Belgium, Austria',
    kilometersRange: '> 1,000,000 km',
    transportTypes: ['international', 'bilateral'],
    operationalSkills: ['pallet', 'loading', 'cmr', 'securing', 'tachograph'],
    truckBrands: ['Volvo', 'Scania', 'DAF'],
    otherBrand: '',
    gearboxType: 'both',
    trailerTypes: ['curtain', 'reefer', 'mega'],
    mostUsedTrailer: 'Curtain Sider',
    yearsWithTrailer: '7',
    confidentTrailers: 'Curtain sider, Reefer, Mega',
    workRegime: [],
    trafficAccidents: 'no',
    accidentDescription: '',
    aetrViolations: 'no',
    finesAbroad: 'no',
    ecoDriving: 'yes',
    englishLevel: 'intermediate',
    germanLevel: 'basic',
    russianLevel: '',
    otherLanguages: 'French (basic)',
    languageAtWork: 'English',
    doubleCrewWillingness: 'yes',
    maxTourWeeks: '3',
    preferredCountries: 'Germany, Netherlands, Belgium',
    undesiredCountries: '',
    weekendDriving: true,
    nightDriving: true,
  });

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: keyof FormData, value: string) => {
    setFormData(prev => {
      const currentArray = (prev[field] as string[]) || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [field]: newArray };
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = () => {
    toast.success('Applicant updated successfully');
    navigate(`/dashboard/applicants/${id}`);
  };

  const getProgressPercentage = () => {
    return Math.round((currentStep / totalSteps) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/applicants/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit Applicant</h1>
          <p className="text-muted-foreground mt-1">Update applicant information - ID: {id}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-[#0F172A]">
              Step {currentStep} of {totalSteps}
            </p>
            <p className="text-sm text-muted-foreground">
              {getProgressPercentage()}% Complete
            </p>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2563EB] to-[#3b82f6] transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index + 1 <= currentStep
                    ? 'bg-[#2563EB] scale-125'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form Content */}
      <Card>
        <CardContent className="p-8">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Basic Information</h2>
                <p className="text-muted-foreground">Personal details and contact information</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="Full name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality *</Label>
                  <Input
                    id="nationality"
                    placeholder="Nationality"
                    value={formData.nationality}
                    onChange={(e) => handleInputChange('nationality', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="countryOfResidence">Country of Residence *</Label>
                  <Input
                    id="countryOfResidence"
                    placeholder="Country of residence"
                    value={formData.countryOfResidence}
                    onChange={(e) => handleInputChange('countryOfResidence', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentCountryOfResidence">Current Country of Residence *</Label>
                  <Input
                    id="currentCountryOfResidence"
                    placeholder="Current country"
                    value={formData.currentCountryOfResidence}
                    onChange={(e) => handleInputChange('currentCountryOfResidence', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="permanentAddress">Permanent Address *</Label>
                  <Input
                    id="permanentAddress"
                    placeholder="Permanent address"
                    value={formData.permanentAddress}
                    onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (with country code) *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+xxx xxx xxx xxx"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="earliestStartDate">Earliest Start Date *</Label>
                  <Input
                    id="earliestStartDate"
                    type="date"
                    value={formData.earliestStartDate}
                    onChange={(e) => handleInputChange('earliestStartDate', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="howDidYouHear">How did you hear about us? *</Label>
                  <Select
                    value={formData.howDidYouHear}
                    onValueChange={(value) => handleInputChange('howDidYouHear', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="jobPortal">Job Portal</SelectItem>
                      <SelectItem value="friend">Friend/Referral</SelectItem>
                      <SelectItem value="agency">Recruitment Agency</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Steps 2-10: Using simplified placeholder - In production, copy all steps from PublicDriverApplication.tsx */}
          {currentStep >= 2 && currentStep <= 10 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-2xl font-bold text-white">{currentStep}</span>
                </div>
                <h2 className="text-3xl font-bold text-[#0F172A] mb-2">
                  {currentStep === 2 && 'Travel & Residence Documents'}
                  {currentStep === 3 && 'Driving Licence Details'}
                  {currentStep === 4 && 'International Experience'}
                  {currentStep === 5 && 'Driver Experience Profile'}
                  {currentStep === 6 && 'Operational Skills'}
                  {currentStep === 7 && 'Technical Experience'}
                  {currentStep === 8 && 'Safety & Discipline'}
                  {currentStep === 9 && 'Language Skills'}
                  {currentStep === 10 && 'Work Flexibility'}
                </h2>
                <p className="text-muted-foreground">Complete the information for this section</p>
              </div>

              <div className="p-12 border-2 border-dashed rounded-lg text-center">
                <p className="text-lg font-medium text-[#0F172A] mb-2">Step {currentStep} Content</p>
                <p className="text-sm text-muted-foreground mb-4">
                  All form fields from PublicDriverApplication.tsx for Step {currentStep}
                </p>
                <p className="text-xs text-muted-foreground">
                  (Full implementation includes all fields - copy from PublicDriverApplication lines for this step)
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-8 border-t mt-8">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNext}
                className="ml-auto gap-2 bg-[#2563EB] hover:bg-[#1d4ed8]"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                className="ml-auto gap-2 bg-[#22C55E] hover:bg-[#16a34a]"
              >
                <Save className="w-4 h-4" />
                Update Applicant
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
