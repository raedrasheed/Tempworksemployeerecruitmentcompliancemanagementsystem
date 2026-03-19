import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Briefcase, ArrowLeft, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';

interface FormData {
  // Screen 1: Basic Information
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

  // Screen 2: Travel & Residence Documents
  passportNumber: string;
  passportValidUntil: string;
  hasEUVisa: string;
  visaType: string;
  visaValidUntil: string;
  hasWorkPermit: string;
  hasResidenceCard: string;
  issuingCountry: string;

  // Screen 3: License & Certifications
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

  // Screen 4: International Experience
  hasEUExperience: string;
  yearsEUExperience: string;
  totalCEExperience: string;
  yearsActiveDriving: string;
  mainlyHomeCountry: string;
  drivenOtherCountries: string;
  specifyCountries: string;

  // Screen 5: Work Experience Profile
  kilometersRange: string;
  transportTypes: string[];

  // Screen 6: Operational Skills
  operationalSkills: string[];

  // Screen 7: Technical Experience
  truckBrands: string[];
  otherBrand: string;
  gearboxType: string;
  trailerTypes: string[];
  mostUsedTrailer: string;
  yearsWithTrailer: string;
  confidentTrailers: string;

  // Screen 8: Safety
  workRegime: string[];
  trafficAccidents: string;
  accidentDescription: string;
  aetrViolations: string;
  finesAbroad: string;
  ecoDriving: string;

  // Screen 9: Language Skills
  englishLevel: string;
  germanLevel: string;
  russianLevel: string;
  otherLanguages: string;
  languageAtWork: string;

  // Screen 10: Flexibility
  doubleCrewWillingness: string;
  maxTourWeeks: string;
  preferredCountries: string;
  undesiredCountries: string;
  weekendDriving: boolean;
  nightDriving: boolean;
}

export function PublicDriverApplication() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 11; // 10 form steps + 1 review step

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    countryOfResidence: '',
    currentCountryOfResidence: '',
    permanentAddress: '',
    phone: '',
    email: '',
    earliestStartDate: '',
    howDidYouHear: '',
    passportNumber: '',
    passportValidUntil: '',
    hasEUVisa: '',
    visaType: '',
    visaValidUntil: '',
    hasWorkPermit: '',
    hasResidenceCard: '',
    issuingCountry: '',
    drivingLicenseNumber: '',
    licenseIssuingCountry: '',
    licenseValidUntil: '',
    categoryA: '',
    categoryB: '',
    categoryC: '',
    categoryD: '',
    categoryE: '',
    hasTachographCard: '',
    tachographNumber: '',
    tachographValidUntil: '',
    hasQualificationCard: '',
    qualificationValidUntil: '',
    hasADR: '',
    adrClasses: '',
    adrValidUntil: '',
    hasEUExperience: '',
    yearsEUExperience: '',
    totalCEExperience: '',
    yearsActiveDriving: '',
    mainlyHomeCountry: '',
    drivenOtherCountries: '',
    specifyCountries: '',
    kilometersRange: '',
    transportTypes: [],
    operationalSkills: [],
    truckBrands: [],
    otherBrand: '',
    gearboxType: '',
    trailerTypes: [],
    mostUsedTrailer: '',
    yearsWithTrailer: '',
    confidentTrailers: '',
    workRegime: [],
    trafficAccidents: '',
    accidentDescription: '',
    aetrViolations: '',
    finesAbroad: '',
    ecoDriving: '',
    englishLevel: '',
    germanLevel: '',
    russianLevel: '',
    otherLanguages: '',
    languageAtWork: '',
    doubleCrewWillingness: '',
    maxTourWeeks: '',
    preferredCountries: '',
    undesiredCountries: '',
    weekendDriving: false,
    nightDriving: false,
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
    navigate('/application-success');
  };

  const getProgressPercentage = () => {
    return Math.round((currentStep / totalSteps) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF]">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] flex items-center justify-center shadow-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-[#0F172A] block">TempWorks Europe</span>
                <span className="text-xs text-muted-foreground">C+E Driver Application</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
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
                className="h-full bg-gradient-to-r from-[#2563EB] to-[#3b82f6] transition-all duration-500 ease-out"
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
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto shadow-xl">
          <CardContent className="p-8 md:p-12">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Basic Information</h2>
                  <p className="text-muted-foreground">Please provide your personal details</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="Meno a priezvisko / Full name"
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
                      placeholder="Štátna príslušnosť / Nationality"
                      value={formData.nationality}
                      onChange={(e) => handleInputChange('nationality', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="countryOfResidence">Country of Residence *</Label>
                    <Input
                      id="countryOfResidence"
                      placeholder="Krajina trvalého pobytu"
                      value={formData.countryOfResidence}
                      onChange={(e) => handleInputChange('countryOfResidence', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currentCountryOfResidence">Current Country of Residence *</Label>
                    <Input
                      id="currentCountryOfResidence"
                      placeholder="Aktuálna krajina pobytu"
                      value={formData.currentCountryOfResidence}
                      onChange={(e) => handleInputChange('currentCountryOfResidence', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="permanentAddress">Permanent Address *</Label>
                    <Input
                      id="permanentAddress"
                      placeholder="Adresa trvalého pobytu"
                      value={formData.permanentAddress}
                      onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (with country code) *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+421 xxx xxx xxx"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
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

            {/* Step 2: Travel & Residence Documents */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Travel & Residence Documents</h2>
                  <p className="text-muted-foreground">Cestovné a pobytové doklady</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="passportNumber">Passport Number *</Label>
                    <Input
                      id="passportNumber"
                      placeholder="Číslo pasu / Passport number"
                      value={formData.passportNumber}
                      onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passportValidUntil">Passport Valid Until *</Label>
                    <Input
                      id="passportValidUntil"
                      type="date"
                      value={formData.passportValidUntil}
                      onChange={(e) => handleInputChange('passportValidUntil', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Do you have EU Visa? / Máte vízum do EÚ? *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasEUVisa"
                          value="yes"
                          checked={formData.hasEUVisa === 'yes'}
                          onChange={(e) => handleInputChange('hasEUVisa', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasEUVisa"
                          value="no"
                          checked={formData.hasEUVisa === 'no'}
                          onChange={(e) => handleInputChange('hasEUVisa', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  {formData.hasEUVisa === 'yes' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="visaType">Visa Type</Label>
                        <Input
                          id="visaType"
                          placeholder="Typ víza / Visa type"
                          value={formData.visaType}
                          onChange={(e) => handleInputChange('visaType', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visaValidUntil">Visa Valid Until</Label>
                        <Input
                          id="visaValidUntil"
                          type="date"
                          value={formData.visaValidUntil}
                          onChange={(e) => handleInputChange('visaValidUntil', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Work Permit in EU? / Pracovné povolenie v EÚ? *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasWorkPermit"
                          value="yes"
                          checked={formData.hasWorkPermit === 'yes'}
                          onChange={(e) => handleInputChange('hasWorkPermit', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasWorkPermit"
                          value="no"
                          checked={formData.hasWorkPermit === 'no'}
                          onChange={(e) => handleInputChange('hasWorkPermit', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Residence Card in EU? / Pobytová karta v EÚ? *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasResidenceCard"
                          value="yes"
                          checked={formData.hasResidenceCard === 'yes'}
                          onChange={(e) => handleInputChange('hasResidenceCard', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasResidenceCard"
                          value="no"
                          checked={formData.hasResidenceCard === 'no'}
                          onChange={(e) => handleInputChange('hasResidenceCard', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="issuingCountry">Issuing Country / Krajina vydania dokladov</Label>
                    <Input
                      id="issuingCountry"
                      placeholder="Country"
                      value={formData.issuingCountry}
                      onChange={(e) => handleInputChange('issuingCountry', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Licence & Certifications */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Driving Licence Details</h2>
                  <p className="text-muted-foreground">Vodičské oprávnenia</p>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="drivingLicenseNumber">Driving Licence Number *</Label>
                      <Input
                        id="drivingLicenseNumber"
                        placeholder="Číslo vodičského preukazu"
                        value={formData.drivingLicenseNumber}
                        onChange={(e) => handleInputChange('drivingLicenseNumber', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="licenseIssuingCountry">Issuing Country *</Label>
                      <Input
                        id="licenseIssuingCountry"
                        placeholder="Krajina vydania"
                        value={formData.licenseIssuingCountry}
                        onChange={(e) => handleInputChange('licenseIssuingCountry', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="licenseValidUntil">Licence Valid Until *</Label>
                      <Input
                        id="licenseValidUntil"
                        type="date"
                        value={formData.licenseValidUntil}
                        onChange={(e) => handleInputChange('licenseValidUntil', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="p-6 border rounded-lg bg-[#F8FAFC]">
                    <Label className="text-base font-semibold mb-4 block">Categories - Date Obtained / Kategórie - dátum získania</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="categoryA">A:</Label>
                        <Input
                          id="categoryA"
                          type="date"
                          value={formData.categoryA}
                          onChange={(e) => handleInputChange('categoryA', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="categoryB">B:</Label>
                        <Input
                          id="categoryB"
                          type="date"
                          value={formData.categoryB}
                          onChange={(e) => handleInputChange('categoryB', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="categoryC">C: *</Label>
                        <Input
                          id="categoryC"
                          type="date"
                          value={formData.categoryC}
                          onChange={(e) => handleInputChange('categoryC', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="categoryD">D:</Label>
                        <Input
                          id="categoryD"
                          type="date"
                          value={formData.categoryD}
                          onChange={(e) => handleInputChange('categoryD', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="categoryE">E: *</Label>
                        <Input
                          id="categoryE"
                          type="date"
                          value={formData.categoryE}
                          onChange={(e) => handleInputChange('categoryE', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label>Driver Tachograph Card / Karta vodiča (tachograf)</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasTachographCard"
                            value="yes"
                            checked={formData.hasTachographCard === 'yes'}
                            onChange={(e) => handleInputChange('hasTachographCard', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span>Yes / Áno</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasTachographCard"
                            value="no"
                            checked={formData.hasTachographCard === 'no'}
                            onChange={(e) => handleInputChange('hasTachographCard', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span>No / Nie</span>
                        </label>
                      </div>
                      {formData.hasTachographCard === 'yes' && (
                        <div className="space-y-2 mt-2">
                          <Input
                            placeholder="Number / Číslo"
                            value={formData.tachographNumber}
                            onChange={(e) => handleInputChange('tachographNumber', e.target.value)}
                          />
                          <Input
                            type="date"
                            placeholder="Valid until"
                            value={formData.tachographValidUntil}
                            onChange={(e) => handleInputChange('tachographValidUntil', e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label>Qualification Card - Code 95 / Kvalifikačná karta - kód 95</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasQualificationCard"
                            value="yes"
                            checked={formData.hasQualificationCard === 'yes'}
                            onChange={(e) => handleInputChange('hasQualificationCard', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span>Yes / Áno</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasQualificationCard"
                            value="no"
                            checked={formData.hasQualificationCard === 'no'}
                            onChange={(e) => handleInputChange('hasQualificationCard', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span>No / Nie</span>
                        </label>
                      </div>
                      {formData.hasQualificationCard === 'yes' && (
                        <Input
                          type="date"
                          placeholder="Valid until"
                          value={formData.qualificationValidUntil}
                          onChange={(e) => handleInputChange('qualificationValidUntil', e.target.value)}
                        />
                      )}
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <Label>ADR Certificate / ADR oprávnenie</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasADR"
                            value="yes"
                            checked={formData.hasADR === 'yes'}
                            onChange={(e) => handleInputChange('hasADR', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span>Yes / Áno</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasADR"
                            value="no"
                            checked={formData.hasADR === 'no'}
                            onChange={(e) => handleInputChange('hasADR', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span>No / Nie</span>
                        </label>
                      </div>
                      {formData.hasADR === 'yes' && (
                        <div className="grid md:grid-cols-2 gap-4 mt-2">
                          <Input
                            placeholder="ADR Classes / Triedy ADR"
                            value={formData.adrClasses}
                            onChange={(e) => handleInputChange('adrClasses', e.target.value)}
                          />
                          <Input
                            type="date"
                            placeholder="Valid until"
                            value={formData.adrValidUntil}
                            onChange={(e) => handleInputChange('adrValidUntil', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: International Experience */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">4</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">International Experience</h2>
                  <p className="text-muted-foreground">Skúsenosti s medzinárodnou dopravou</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Have you driven in the EU? / Jazdili ste v EÚ? *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasEUExperience"
                          value="yes"
                          checked={formData.hasEUExperience === 'yes'}
                          onChange={(e) => handleInputChange('hasEUExperience', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasEUExperience"
                          value="no"
                          checked={formData.hasEUExperience === 'no'}
                          onChange={(e) => handleInputChange('hasEUExperience', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  {formData.hasEUExperience === 'yes' && (
                    <div className="space-y-2">
                      <Label htmlFor="yearsEUExperience">Years of EU Experience / Počet rokov praxe v EÚ</Label>
                      <Input
                        id="yearsEUExperience"
                        type="number"
                        min="0"
                        placeholder="Number of years"
                        value={formData.yearsEUExperience}
                        onChange={(e) => handleInputChange('yearsEUExperience', e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="totalCEExperience">Total C+E Experience (years) / Celková prax na C+E (roky) *</Label>
                    <Input
                      id="totalCEExperience"
                      type="number"
                      min="0"
                      placeholder="Total years with C+E license"
                      value={formData.totalCEExperience}
                      onChange={(e) => handleInputChange('totalCEExperience', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearsActiveDriving">Years of Active Truck Driving (C+E) / Koľko rokov aktívne jazdíte na kamióne (C+E)? *</Label>
                    <Input
                      id="yearsActiveDriving"
                      type="number"
                      min="0"
                      placeholder="Years actively driving trucks"
                      value={formData.yearsActiveDriving}
                      onChange={(e) => handleInputChange('yearsActiveDriving', e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Have you driven mainly in your home country? / Jazdili ste prevažne len vo svojej domovskej krajine?</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="mainlyHomeCountry"
                          value="yes"
                          checked={formData.mainlyHomeCountry === 'yes'}
                          onChange={(e) => handleInputChange('mainlyHomeCountry', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="mainlyHomeCountry"
                          value="no"
                          checked={formData.mainlyHomeCountry === 'no'}
                          onChange={(e) => handleInputChange('mainlyHomeCountry', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Have you also driven in other countries? / Jazdili ste aj v iných krajinách?</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="drivenOtherCountries"
                          value="yes"
                          checked={formData.drivenOtherCountries === 'yes'}
                          onChange={(e) => handleInputChange('drivenOtherCountries', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="drivenOtherCountries"
                          value="no"
                          checked={formData.drivenOtherCountries === 'no'}
                          onChange={(e) => handleInputChange('drivenOtherCountries', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  {formData.drivenOtherCountries === 'yes' && (
                    <div className="space-y-2">
                      <Label htmlFor="specifyCountries">Specify Countries / Uveďte konkrétne krajiny</Label>
                      <Textarea
                        id="specifyCountries"
                        placeholder="e.g., Germany, France, Netherlands..."
                        rows={3}
                        value={formData.specifyCountries}
                        onChange={(e) => handleInputChange('specifyCountries', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Work Experience Profile */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">5</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Driver Experience Profile</h2>
                  <p className="text-muted-foreground">Profil praxe vodiča</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Total Kilometers Driven on C+E / Najazdené kilometre na C+E *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {['< 500,000 km', '500,000 - 1,000,000 km', '> 1,000,000 km', 'More than specified'].map((range) => (
                        <label
                          key={range}
                          className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.kilometersRange === range
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="kilometersRange"
                            value={range}
                            checked={formData.kilometersRange === range}
                            onChange={(e) => handleInputChange('kilometersRange', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium">{range}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Transport Types (Definitions) / Typy prepráv (popis) *</Label>
                    <p className="text-sm text-muted-foreground">Select all that apply</p>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { value: 'international', label: 'International Transport / Medzinárodná doprava' },
                        { value: 'domestic', label: 'Domestic Transport / Vnútroštátna doprava' },
                        { value: 'bilateral', label: 'Bilateral Transport / Bilaterálna doprava' },
                        { value: 'cabotage', label: 'Cabotage / Kabotáž' },
                      ].map((type) => (
                        <label
                          key={type.value}
                          className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.transportTypes.includes(type.value)
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Checkbox
                            checked={formData.transportTypes.includes(type.value)}
                            onCheckedChange={() => handleArrayToggle('transportTypes', type.value)}
                          />
                          <span className="font-medium">{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Operational Skills */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">6</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Operational Skills</h2>
                  <p className="text-muted-foreground">Operatívne zručnosti</p>
                </div>

                <div className="space-y-3">
                  <Label>Select your operational skills / Vyberte svoje zručnosti</Label>
                  <p className="text-sm text-muted-foreground">Mark all that apply</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { value: 'pallet', label: 'EUR Pallet Exchange / Výmena EUR paliet' },
                      { value: 'loading', label: 'Driver Loading and Unloading / Nakládka/vykládka vodičom' },
                      { value: 'cmr', label: 'CMR Documentation / CMR dokumentácia' },
                      { value: 'securing', label: 'Load Securing (lashing) / Zabezpečenie nákladu (kurtovanie)' },
                      { value: 'tachograph', label: 'Digital Tachograph Operation / Obsluha digitálneho tachografu' },
                    ].map((skill) => (
                      <label
                        key={skill.value}
                        className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          formData.operationalSkills.includes(skill.value)
                            ? 'border-[#2563EB] bg-[#EFF6FF]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Checkbox
                          checked={formData.operationalSkills.includes(skill.value)}
                          onCheckedChange={() => handleArrayToggle('operationalSkills', skill.value)}
                        />
                        <span className="font-medium">{skill.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Technical Experience */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">7</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Technical Experience</h2>
                  <p className="text-muted-foreground">Technické skúsenosti</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Truck Brands / Značky vozidiel *</Label>
                    <p className="text-sm text-muted-foreground">Select all brands you have experience with</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['Volvo', 'Scania', 'DAF', 'MAN', 'Mercedes-Benz', 'Iveco'].map((brand) => (
                        <label
                          key={brand}
                          className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.truckBrands.includes(brand)
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Checkbox
                            checked={formData.truckBrands.includes(brand)}
                            onCheckedChange={() => handleArrayToggle('truckBrands', brand)}
                          />
                          <span className="font-medium">{brand}</span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="otherBrand">Other Brand / Iné značky</Label>
                      <Input
                        id="otherBrand"
                        placeholder="Specify other brands"
                        value={formData.otherBrand}
                        onChange={(e) => handleInputChange('otherBrand', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Gearbox Type / Typ prevodovky *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { value: 'manual', label: 'Manual / Manuál' },
                        { value: 'automatic', label: 'Automatic / Automat' },
                        { value: 'both', label: 'Both / Oboje' },
                      ].map((type) => (
                        <label
                          key={type.value}
                          className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.gearboxType === type.value
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="gearboxType"
                            value={type.value}
                            checked={formData.gearboxType === type.value}
                            onChange={(e) => handleInputChange('gearboxType', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium">{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Trailer Types - Mark All Experience / Typy návesov - označte všetky skúsenosti</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { value: 'curtain', label: 'Curtain Sider / Plachta' },
                        { value: 'reefer', label: 'Reefer / Chladiar' },
                        { value: 'tanker', label: 'Tanker / Cisterna' },
                        { value: 'container', label: 'Container / Kontajner' },
                        { value: 'walking', label: 'Walking Floor' },
                        { value: 'lowdeck', label: 'Lowdeck' },
                        { value: 'mega', label: 'Mega' },
                        { value: 'swap', label: 'Swap Body / Výmenná nadstavba' },
                      ].map((trailer) => (
                        <label
                          key={trailer.value}
                          className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.trailerTypes.includes(trailer.value)
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Checkbox
                            checked={formData.trailerTypes.includes(trailer.value)}
                            onCheckedChange={() => handleArrayToggle('trailerTypes', trailer.value)}
                          />
                          <span className="font-medium">{trailer.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="mostUsedTrailer">Which trailer did you use most often? / Ktorý náves ste používali najčastejšie?</Label>
                      <Input
                        id="mostUsedTrailer"
                        placeholder="e.g., Curtain Sider"
                        value={formData.mostUsedTrailer}
                        onChange={(e) => handleInputChange('mostUsedTrailer', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="yearsWithTrailer">Years of experience with this trailer / Koľko rokov praxe s týmto návesom?</Label>
                      <Input
                        id="yearsWithTrailer"
                        type="number"
                        min="0"
                        placeholder="Number of years"
                        value={formData.yearsWithTrailer}
                        onChange={(e) => handleInputChange('yearsWithTrailer', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="confidentTrailers">Which trailers are you most confident with? (max. 3) / S ktorými návesmi sa cítite najistejšie? (max. 3)</Label>
                      <Input
                        id="confidentTrailers"
                        placeholder="e.g., Curtain sider, Reefer, Container"
                        value={formData.confidentTrailers}
                        onChange={(e) => handleInputChange('confidentTrailers', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 8: Safety */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">8</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Safety & Discipline</h2>
                  <p className="text-muted-foreground">Bezpečnosť a disciplína</p>
                </div>

                <div className="space-y-6">
                  <div className="p-6 border rounded-lg bg-[#F8FAFC]">
                    <Label className="text-base font-semibold mb-4 block">Work Regime / Režim práce</Label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.weekendDriving}
                          onCheckedChange={(checked) => handleInputChange('weekendDriving', checked)}
                        />
                        <span>Weekend Driving / Víkendové jazdy</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.nightDriving}
                          onCheckedChange={(checked) => handleInputChange('nightDriving', checked)}
                        />
                        <span>Night Driving / Nočné jazdy</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Traffic Accidents in the Last 3 Years / Dopravné nehody za posledné 3 roky *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="trafficAccidents"
                          value="yes"
                          checked={formData.trafficAccidents === 'yes'}
                          onChange={(e) => handleInputChange('trafficAccidents', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="trafficAccidents"
                          value="no"
                          checked={formData.trafficAccidents === 'no'}
                          onChange={(e) => handleInputChange('trafficAccidents', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                    {formData.trafficAccidents === 'yes' && (
                      <div className="space-y-2 mt-3">
                        <Label htmlFor="accidentDescription">If yes - description / Ak áno - popis</Label>
                        <Textarea
                          id="accidentDescription"
                          rows={3}
                          placeholder="Please describe the accident(s)"
                          value={formData.accidentDescription}
                          onChange={(e) => handleInputChange('accidentDescription', e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>AETR Violations / Porušenia AETR *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aetrViolations"
                          value="yes"
                          checked={formData.aetrViolations === 'yes'}
                          onChange={(e) => handleInputChange('aetrViolations', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aetrViolations"
                          value="no"
                          checked={formData.aetrViolations === 'no'}
                          onChange={(e) => handleInputChange('aetrViolations', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Fines Abroad in the Last 3 Years / Pokuty v zahraničí za posledné 3 roky *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="finesAbroad"
                          value="yes"
                          checked={formData.finesAbroad === 'yes'}
                          onChange={(e) => handleInputChange('finesAbroad', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="finesAbroad"
                          value="no"
                          checked={formData.finesAbroad === 'no'}
                          onChange={(e) => handleInputChange('finesAbroad', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Eco-driving (fuel-efficient driving) / Eco-driving (úsporný štýl jazdy) *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ecoDriving"
                          value="yes"
                          checked={formData.ecoDriving === 'yes'}
                          onChange={(e) => handleInputChange('ecoDriving', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ecoDriving"
                          value="no"
                          checked={formData.ecoDriving === 'no'}
                          onChange={(e) => handleInputChange('ecoDriving', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 9: Language Skills */}
            {currentStep === 9 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">9</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Language Skills</h2>
                  <p className="text-muted-foreground">Jazykové znalosti</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>English / Angličtina *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {['basic', 'intermediate', 'advanced'].map((level) => (
                        <label
                          key={level}
                          className={`flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.englishLevel === level
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="englishLevel"
                            value={level}
                            checked={formData.englishLevel === level}
                            onChange={(e) => handleInputChange('englishLevel', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium capitalize">{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>German / Nemčina</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {['basic', 'intermediate', 'advanced'].map((level) => (
                        <label
                          key={level}
                          className={`flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.germanLevel === level
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="germanLevel"
                            value={level}
                            checked={formData.germanLevel === level}
                            onChange={(e) => handleInputChange('germanLevel', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium capitalize">{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Russian / Ruština</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {['basic', 'intermediate', 'advanced'].map((level) => (
                        <label
                          key={level}
                          className={`flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.russianLevel === level
                              ? 'border-[#2563EB] bg-[#EFF6FF]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="russianLevel"
                            value={level}
                            checked={formData.russianLevel === level}
                            onChange={(e) => handleInputChange('russianLevel', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium capitalize">{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otherLanguages">Other Languages / Iné jazyky</Label>
                    <Input
                      id="otherLanguages"
                      placeholder="e.g., French, Italian..."
                      value={formData.otherLanguages}
                      onChange={(e) => handleInputChange('otherLanguages', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="languageAtWork">Language Used at Work / Používaný jazyk v práci</Label>
                    <Input
                      id="languageAtWork"
                      placeholder="Which language do you primarily use?"
                      value={formData.languageAtWork}
                      onChange={(e) => handleInputChange('languageAtWork', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 10: Flexibility */}
            {currentStep === 10 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-2xl font-bold text-white">10</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Work Flexibility</h2>
                  <p className="text-muted-foreground">Pracovná flexibilita</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Willingness to Work in a Double Crew / Ochota pracovať v dvojposádke *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="doubleCrewWillingness"
                          value="yes"
                          checked={formData.doubleCrewWillingness === 'yes'}
                          onChange={(e) => handleInputChange('doubleCrewWillingness', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>Yes / Áno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="doubleCrewWillingness"
                          value="no"
                          checked={formData.doubleCrewWillingness === 'no'}
                          onChange={(e) => handleInputChange('doubleCrewWillingness', e.target.value)}
                          className="w-4 h-4"
                        />
                        <span>No / Nie</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxTourWeeks">Maximum Tour Length (weeks) / Maximálna dĺžka turnusu (týždne) *</Label>
                    <Input
                      id="maxTourWeeks"
                      type="number"
                      min="1"
                      max="12"
                      placeholder="Number of weeks"
                      value={formData.maxTourWeeks}
                      onChange={(e) => handleInputChange('maxTourWeeks', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredCountries">Preferred Countries of Work / Preferované krajiny práce</Label>
                    <Textarea
                      id="preferredCountries"
                      rows={3}
                      placeholder="List your preferred countries (e.g., Germany, Netherlands, Belgium)"
                      value={formData.preferredCountries}
                      onChange={(e) => handleInputChange('preferredCountries', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="undesiredCountries">Undesired Countries / Neželaané krajiny</Label>
                    <Textarea
                      id="undesiredCountries"
                      rows={3}
                      placeholder="List countries you prefer not to work in (optional)"
                      value={formData.undesiredCountries}
                      onChange={(e) => handleInputChange('undesiredCountries', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 11: Review & Submit */}
            {currentStep === 11 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#22C55E] to-[#16a34a] flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Review Your Application</h2>
                  <p className="text-muted-foreground">Please review all information before submitting</p>
                </div>

                {/* Summary Sections */}
                <div className="space-y-4">
                  <ReviewSection title="1. Basic Information" step={1} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="Full Name" value={formData.fullName} />
                    <ReviewItem label="Date of Birth" value={formData.dateOfBirth} />
                    <ReviewItem label="Nationality" value={formData.nationality} />
                    <ReviewItem label="Email" value={formData.email} />
                    <ReviewItem label="Phone" value={formData.phone} />
                  </ReviewSection>

                  <ReviewSection title="2. Travel Documents" step={2} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="Passport Number" value={formData.passportNumber} />
                    <ReviewItem label="Passport Valid Until" value={formData.passportValidUntil} />
                    <ReviewItem label="EU Visa" value={formData.hasEUVisa === 'yes' ? 'Yes' : 'No'} />
                  </ReviewSection>

                  <ReviewSection title="3. Driving Licence" step={3} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="License Number" value={formData.drivingLicenseNumber} />
                    <ReviewItem label="Issuing Country" value={formData.licenseIssuingCountry} />
                    <ReviewItem label="Valid Until" value={formData.licenseValidUntil} />
                    <ReviewItem label="Category C Date" value={formData.categoryC} />
                    <ReviewItem label="Category E Date" value={formData.categoryE} />
                  </ReviewSection>

                  <ReviewSection title="4. International Experience" step={4} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="EU Experience" value={formData.hasEUExperience === 'yes' ? 'Yes' : 'No'} />
                    <ReviewItem label="Total C+E Experience" value={`${formData.totalCEExperience} years`} />
                    <ReviewItem label="Years Active Driving" value={`${formData.yearsActiveDriving} years`} />
                  </ReviewSection>

                  <ReviewSection title="5. Work Profile" step={5} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="Kilometers Range" value={formData.kilometersRange} />
                    <ReviewItem label="Transport Types" value={formData.transportTypes.join(', ') || 'Not specified'} />
                  </ReviewSection>

                  <ReviewSection title="6. Operational Skills" step={6} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="Skills" value={formData.operationalSkills.join(', ') || 'Not specified'} />
                  </ReviewSection>

                  <ReviewSection title="7. Technical Experience" step={7} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="Truck Brands" value={formData.truckBrands.join(', ') || 'Not specified'} />
                    <ReviewItem label="Gearbox Type" value={formData.gearboxType} />
                    <ReviewItem label="Trailer Types" value={formData.trailerTypes.join(', ') || 'Not specified'} />
                  </ReviewSection>

                  <ReviewSection title="8. Safety Record" step={8} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="Traffic Accidents" value={formData.trafficAccidents === 'yes' ? 'Yes' : 'No'} />
                    <ReviewItem label="AETR Violations" value={formData.aetrViolations === 'yes' ? 'Yes' : 'No'} />
                    <ReviewItem label="Eco-driving" value={formData.ecoDriving === 'yes' ? 'Yes' : 'No'} />
                  </ReviewSection>

                  <ReviewSection title="9. Language Skills" step={9} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="English" value={formData.englishLevel || 'Not specified'} />
                    <ReviewItem label="German" value={formData.germanLevel || 'Not specified'} />
                    <ReviewItem label="Russian" value={formData.russianLevel || 'Not specified'} />
                  </ReviewSection>

                  <ReviewSection title="10. Flexibility" step={10} setCurrentStep={setCurrentStep}>
                    <ReviewItem label="Double Crew" value={formData.doubleCrewWillingness === 'yes' ? 'Yes' : 'No'} />
                    <ReviewItem label="Max Tour Weeks" value={formData.maxTourWeeks} />
                    <ReviewItem label="Weekend Driving" value={formData.weekendDriving ? 'Yes' : 'No'} />
                    <ReviewItem label="Night Driving" value={formData.nightDriving ? 'Yes' : 'No'} />
                  </ReviewSection>
                </div>

                {/* Declaration */}
                <div className="p-6 border-2 rounded-lg bg-[#F8FAFC]">
                  <h3 className="font-semibold mb-4">Honest Declaration / Čestné prehlásenie</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    I declare that all provided information is true and complete and that I have not concealed any facts that could affect the performance of the driver position.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Prehlasujem, že všetky uvedené údaje sú pravdivé a úplné a že som nezamlčal skutočnosti, ktoré by mohli ovplyvniť výkon práce vodiča.
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" required className="mt-1 w-5 h-5" />
                    <span className="text-sm font-medium">
                      I agree and confirm the above declaration / Súhlasím a potvrdzujem vyššie uvedené prehlásenie *
                    </span>
                  </label>
                </div>

                {/* GDPR Consent */}
                <div className="p-6 border-2 rounded-lg bg-[#EFF6FF]">
                  <h3 className="font-semibold mb-4">GDPR Data Processing Consent / Súhlas so spracovaním osobných údajov (GDPR)</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong>Purpose:</strong> Recruitment process for the driver position
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong>Retention period:</strong> Maximum 24 months
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    I consent to the processing of my personal data in accordance with the GDPR.
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" required className="mt-1 w-5 h-5" />
                    <span className="text-sm font-medium">
                      I agree / Súhlasím *
                    </span>
                  </label>
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
                  <Check className="w-4 h-4" />
                  Submit Application
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper component for review sections
function ReviewSection({
  title,
  step,
  setCurrentStep,
  children,
}: {
  title: string;
  step: number;
  setCurrentStep: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentStep(step);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-[#2563EB]"
          >
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component for review items
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || <span className="text-muted-foreground italic">Not provided</span>}</p>
    </div>
  );
}
