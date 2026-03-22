import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';

export interface ApplicantFormData {
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

interface Props {
  currentStep: number;
  formData: ApplicantFormData;
  onInputChange: (field: keyof ApplicantFormData, value: any) => void;
  onArrayToggle: (field: keyof ApplicantFormData, value: string) => void;
}

export function ApplicantFormSteps({ currentStep, formData, onInputChange, onArrayToggle }: Props) {
  return (
    <>
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
              <Input id="fullName" placeholder="Full name" value={formData.fullName} onChange={(e) => onInputChange('fullName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={(e) => onInputChange('dateOfBirth', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality *</Label>
              <Input id="nationality" placeholder="Nationality" value={formData.nationality} onChange={(e) => onInputChange('nationality', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="countryOfResidence">Country of Residence *</Label>
              <Input id="countryOfResidence" placeholder="Country of residence" value={formData.countryOfResidence} onChange={(e) => onInputChange('countryOfResidence', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentCountryOfResidence">Current Country of Residence *</Label>
              <Input id="currentCountryOfResidence" placeholder="Current country" value={formData.currentCountryOfResidence} onChange={(e) => onInputChange('currentCountryOfResidence', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="permanentAddress">Permanent Address *</Label>
              <Input id="permanentAddress" placeholder="Permanent address" value={formData.permanentAddress} onChange={(e) => onInputChange('permanentAddress', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (with country code) *</Label>
              <Input id="phone" type="tel" placeholder="+xxx xxx xxx xxx" value={formData.phone} onChange={(e) => onInputChange('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" placeholder="email@example.com" value={formData.email} onChange={(e) => onInputChange('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="earliestStartDate">Earliest Start Date *</Label>
              <Input id="earliestStartDate" type="date" value={formData.earliestStartDate} onChange={(e) => onInputChange('earliestStartDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="howDidYouHear">How did you hear about us? *</Label>
              <Select value={formData.howDidYouHear} onValueChange={(value) => onInputChange('howDidYouHear', value)}>
                <SelectTrigger><SelectValue placeholder="Select option" /></SelectTrigger>
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
            <p className="text-muted-foreground">Passport, visa, and residence information</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="passportNumber">Passport Number *</Label>
              <Input id="passportNumber" placeholder="Passport number" value={formData.passportNumber} onChange={(e) => onInputChange('passportNumber', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passportValidUntil">Passport Valid Until *</Label>
              <Input id="passportValidUntil" type="date" value={formData.passportValidUntil} onChange={(e) => onInputChange('passportValidUntil', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Do you have EU Visa? *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasEUVisa" value="yes" checked={formData.hasEUVisa === 'yes'} onChange={(e) => onInputChange('hasEUVisa', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasEUVisa" value="no" checked={formData.hasEUVisa === 'no'} onChange={(e) => onInputChange('hasEUVisa', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            {formData.hasEUVisa === 'yes' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="visaType">Visa Type</Label>
                  <Input id="visaType" placeholder="Visa type" value={formData.visaType} onChange={(e) => onInputChange('visaType', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visaValidUntil">Visa Valid Until</Label>
                  <Input id="visaValidUntil" type="date" value={formData.visaValidUntil} onChange={(e) => onInputChange('visaValidUntil', e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Work Permit in EU? *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasWorkPermit" value="yes" checked={formData.hasWorkPermit === 'yes'} onChange={(e) => onInputChange('hasWorkPermit', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasWorkPermit" value="no" checked={formData.hasWorkPermit === 'no'} onChange={(e) => onInputChange('hasWorkPermit', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Residence Card in EU? *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasResidenceCard" value="yes" checked={formData.hasResidenceCard === 'yes'} onChange={(e) => onInputChange('hasResidenceCard', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasResidenceCard" value="no" checked={formData.hasResidenceCard === 'no'} onChange={(e) => onInputChange('hasResidenceCard', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="issuingCountry">Issuing Country</Label>
              <Input id="issuingCountry" placeholder="Country" value={formData.issuingCountry} onChange={(e) => onInputChange('issuingCountry', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Driving Licence Details */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl font-bold text-white">3</span>
            </div>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Driving Licence Details</h2>
            <p className="text-muted-foreground">Licence categories and certifications</p>
          </div>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="drivingLicenseNumber">Driving Licence Number *</Label>
                <Input id="drivingLicenseNumber" placeholder="Licence number" value={formData.drivingLicenseNumber} onChange={(e) => onInputChange('drivingLicenseNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseIssuingCountry">Issuing Country *</Label>
                <Input id="licenseIssuingCountry" placeholder="Country of issue" value={formData.licenseIssuingCountry} onChange={(e) => onInputChange('licenseIssuingCountry', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="licenseValidUntil">Licence Valid Until *</Label>
                <Input id="licenseValidUntil" type="date" value={formData.licenseValidUntil} onChange={(e) => onInputChange('licenseValidUntil', e.target.value)} />
              </div>
            </div>
            <div className="p-6 border rounded-lg bg-[#F8FAFC]">
              <Label className="text-base font-semibold mb-4 block">Categories - Date Obtained</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="categoryA">A:</Label><Input id="categoryA" type="date" value={formData.categoryA} onChange={(e) => onInputChange('categoryA', e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="categoryB">B:</Label><Input id="categoryB" type="date" value={formData.categoryB} onChange={(e) => onInputChange('categoryB', e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="categoryC">C: *</Label><Input id="categoryC" type="date" value={formData.categoryC} onChange={(e) => onInputChange('categoryC', e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="categoryD">D:</Label><Input id="categoryD" type="date" value={formData.categoryD} onChange={(e) => onInputChange('categoryD', e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="categoryE">E: *</Label><Input id="categoryE" type="date" value={formData.categoryE} onChange={(e) => onInputChange('categoryE', e.target.value)} /></div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Driver Tachograph Card</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasTachographCard" value="yes" checked={formData.hasTachographCard === 'yes'} onChange={(e) => onInputChange('hasTachographCard', e.target.value)} className="w-4 h-4" />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasTachographCard" value="no" checked={formData.hasTachographCard === 'no'} onChange={(e) => onInputChange('hasTachographCard', e.target.value)} className="w-4 h-4" />
                    <span>No</span>
                  </label>
                </div>
                {formData.hasTachographCard === 'yes' && (
                  <div className="space-y-2 mt-2">
                    <Input placeholder="Number" value={formData.tachographNumber} onChange={(e) => onInputChange('tachographNumber', e.target.value)} />
                    <Input type="date" placeholder="Valid until" value={formData.tachographValidUntil} onChange={(e) => onInputChange('tachographValidUntil', e.target.value)} />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <Label>Qualification Card - Code 95</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasQualificationCard" value="yes" checked={formData.hasQualificationCard === 'yes'} onChange={(e) => onInputChange('hasQualificationCard', e.target.value)} className="w-4 h-4" />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasQualificationCard" value="no" checked={formData.hasQualificationCard === 'no'} onChange={(e) => onInputChange('hasQualificationCard', e.target.value)} className="w-4 h-4" />
                    <span>No</span>
                  </label>
                </div>
                {formData.hasQualificationCard === 'yes' && (
                  <Input type="date" placeholder="Valid until" value={formData.qualificationValidUntil} onChange={(e) => onInputChange('qualificationValidUntil', e.target.value)} />
                )}
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label>ADR Certificate</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasADR" value="yes" checked={formData.hasADR === 'yes'} onChange={(e) => onInputChange('hasADR', e.target.value)} className="w-4 h-4" />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasADR" value="no" checked={formData.hasADR === 'no'} onChange={(e) => onInputChange('hasADR', e.target.value)} className="w-4 h-4" />
                    <span>No</span>
                  </label>
                </div>
                {formData.hasADR === 'yes' && (
                  <div className="grid md:grid-cols-2 gap-4 mt-2">
                    <Input placeholder="ADR Classes" value={formData.adrClasses} onChange={(e) => onInputChange('adrClasses', e.target.value)} />
                    <Input type="date" placeholder="Valid until" value={formData.adrValidUntil} onChange={(e) => onInputChange('adrValidUntil', e.target.value)} />
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
            <p className="text-muted-foreground">Experience with international transport</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Have you driven in the EU? *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasEUExperience" value="yes" checked={formData.hasEUExperience === 'yes'} onChange={(e) => onInputChange('hasEUExperience', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasEUExperience" value="no" checked={formData.hasEUExperience === 'no'} onChange={(e) => onInputChange('hasEUExperience', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            {formData.hasEUExperience === 'yes' && (
              <div className="space-y-2">
                <Label htmlFor="yearsEUExperience">Years of EU Experience</Label>
                <Input id="yearsEUExperience" type="number" min="0" placeholder="Number of years" value={formData.yearsEUExperience} onChange={(e) => onInputChange('yearsEUExperience', e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="totalCEExperience">Total C+E Experience (years) *</Label>
              <Input id="totalCEExperience" type="number" min="0" placeholder="Total years with C+E license" value={formData.totalCEExperience} onChange={(e) => onInputChange('totalCEExperience', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearsActiveDriving">Years of Active Truck Driving (C+E) *</Label>
              <Input id="yearsActiveDriving" type="number" min="0" placeholder="Years actively driving trucks" value={formData.yearsActiveDriving} onChange={(e) => onInputChange('yearsActiveDriving', e.target.value)} />
            </div>
            <div className="space-y-3">
              <Label>Have you driven mainly in your home country?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="mainlyHomeCountry" value="yes" checked={formData.mainlyHomeCountry === 'yes'} onChange={(e) => onInputChange('mainlyHomeCountry', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="mainlyHomeCountry" value="no" checked={formData.mainlyHomeCountry === 'no'} onChange={(e) => onInputChange('mainlyHomeCountry', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Have you also driven in other countries?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="drivenOtherCountries" value="yes" checked={formData.drivenOtherCountries === 'yes'} onChange={(e) => onInputChange('drivenOtherCountries', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="drivenOtherCountries" value="no" checked={formData.drivenOtherCountries === 'no'} onChange={(e) => onInputChange('drivenOtherCountries', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            {formData.drivenOtherCountries === 'yes' && (
              <div className="space-y-2">
                <Label htmlFor="specifyCountries">Specify Countries</Label>
                <Textarea id="specifyCountries" placeholder="e.g., Germany, France, Netherlands..." rows={3} value={formData.specifyCountries} onChange={(e) => onInputChange('specifyCountries', e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Driver Experience Profile */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl font-bold text-white">5</span>
            </div>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Driver Experience Profile</h2>
            <p className="text-muted-foreground">Kilometers and transport types</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Total Kilometers Driven on C+E *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {['< 500,000 km', '500,000 - 1,000,000 km', '> 1,000,000 km', 'More than specified'].map((range) => (
                  <label key={range} className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.kilometersRange === range ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="kilometersRange" value={range} checked={formData.kilometersRange === range} onChange={(e) => onInputChange('kilometersRange', e.target.value)} className="w-4 h-4" />
                    <span className="font-medium">{range}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Transport Types *</Label>
              <p className="text-sm text-muted-foreground">Select all that apply</p>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'international', label: 'International Transport' },
                  { value: 'domestic', label: 'Domestic Transport' },
                  { value: 'bilateral', label: 'Bilateral Transport' },
                  { value: 'cabotage', label: 'Cabotage' },
                ].map((type) => (
                  <label key={type.value} className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${(formData.transportTypes || []).includes(type.value) ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Checkbox checked={(formData.transportTypes || []).includes(type.value)} onCheckedChange={() => onArrayToggle('transportTypes', type.value)} />
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
            <p className="text-muted-foreground">Select all applicable skills</p>
          </div>
          <div className="space-y-3">
            <Label>Select your operational skills</Label>
            <p className="text-sm text-muted-foreground">Mark all that apply</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { value: 'pallet', label: 'EUR Pallet Exchange' },
                { value: 'loading', label: 'Driver Loading and Unloading' },
                { value: 'cmr', label: 'CMR Documentation' },
                { value: 'securing', label: 'Load Securing (lashing)' },
                { value: 'tachograph', label: 'Digital Tachograph Operation' },
              ].map((skill) => (
                <label key={skill.value} className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${(formData.operationalSkills || []).includes(skill.value) ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Checkbox checked={(formData.operationalSkills || []).includes(skill.value)} onCheckedChange={() => onArrayToggle('operationalSkills', skill.value)} />
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
            <p className="text-muted-foreground">Truck brands, gearbox, and trailer experience</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Truck Brands *</Label>
              <p className="text-sm text-muted-foreground">Select all brands you have experience with</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['Volvo', 'Scania', 'DAF', 'MAN', 'Mercedes-Benz', 'Iveco'].map((brand) => (
                  <label key={brand} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${(formData.truckBrands || []).includes(brand) ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Checkbox checked={(formData.truckBrands || []).includes(brand)} onCheckedChange={() => onArrayToggle('truckBrands', brand)} />
                    <span className="font-medium">{brand}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2 mt-3">
                <Label htmlFor="otherBrand">Other Brand</Label>
                <input type="text" id="otherBrand" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder="Specify other brands" value={formData.otherBrand} onChange={(e) => onInputChange('otherBrand', e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Gearbox Type *</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: 'manual', label: 'Manual' },
                  { value: 'automatic', label: 'Automatic' },
                  { value: 'both', label: 'Both' },
                ].map((type) => (
                  <label key={type.value} className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.gearboxType === type.value ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="gearboxType" value={type.value} checked={formData.gearboxType === type.value} onChange={(e) => onInputChange('gearboxType', e.target.value)} className="w-4 h-4" />
                    <span className="font-medium">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Trailer Types - Mark All Experience</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { value: 'curtain', label: 'Curtain Sider' },
                  { value: 'reefer', label: 'Reefer' },
                  { value: 'tanker', label: 'Tanker' },
                  { value: 'container', label: 'Container' },
                  { value: 'walking', label: 'Walking Floor' },
                  { value: 'lowdeck', label: 'Lowdeck' },
                  { value: 'mega', label: 'Mega' },
                  { value: 'swap', label: 'Swap Body' },
                ].map((trailer) => (
                  <label key={trailer.value} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${(formData.trailerTypes || []).includes(trailer.value) ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Checkbox checked={(formData.trailerTypes || []).includes(trailer.value)} onCheckedChange={() => onArrayToggle('trailerTypes', trailer.value)} />
                    <span className="font-medium">{trailer.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="mostUsedTrailer">Which trailer did you use most often?</Label>
                <Input id="mostUsedTrailer" placeholder="e.g., Curtain Sider" value={formData.mostUsedTrailer} onChange={(e) => onInputChange('mostUsedTrailer', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearsWithTrailer">Years of experience with this trailer</Label>
                <Input id="yearsWithTrailer" type="number" min="0" placeholder="Number of years" value={formData.yearsWithTrailer} onChange={(e) => onInputChange('yearsWithTrailer', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="confidentTrailers">Which trailers are you most confident with? (max. 3)</Label>
                <Input id="confidentTrailers" placeholder="e.g., Curtain sider, Reefer, Container" value={formData.confidentTrailers} onChange={(e) => onInputChange('confidentTrailers', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 8: Safety & Discipline */}
      {currentStep === 8 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl font-bold text-white">8</span>
            </div>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Safety & Discipline</h2>
            <p className="text-muted-foreground">Safety record and work regime</p>
          </div>
          <div className="space-y-6">
            <div className="p-6 border rounded-lg bg-[#F8FAFC]">
              <Label className="text-base font-semibold mb-4 block">Work Regime</Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <Checkbox checked={formData.weekendDriving} onCheckedChange={(checked) => onInputChange('weekendDriving', checked)} />
                  <span>Weekend Driving</span>
                </label>
                <label className="flex items-center gap-3">
                  <Checkbox checked={formData.nightDriving} onCheckedChange={(checked) => onInputChange('nightDriving', checked)} />
                  <span>Night Driving</span>
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Traffic Accidents in the Last 3 Years *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="trafficAccidents" value="yes" checked={formData.trafficAccidents === 'yes'} onChange={(e) => onInputChange('trafficAccidents', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="trafficAccidents" value="no" checked={formData.trafficAccidents === 'no'} onChange={(e) => onInputChange('trafficAccidents', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
              {formData.trafficAccidents === 'yes' && (
                <div className="space-y-2 mt-3">
                  <Label htmlFor="accidentDescription">If yes - description</Label>
                  <Textarea id="accidentDescription" rows={3} placeholder="Please describe the accident(s)" value={formData.accidentDescription} onChange={(e) => onInputChange('accidentDescription', e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label>AETR Violations *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="aetrViolations" value="yes" checked={formData.aetrViolations === 'yes'} onChange={(e) => onInputChange('aetrViolations', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="aetrViolations" value="no" checked={formData.aetrViolations === 'no'} onChange={(e) => onInputChange('aetrViolations', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Fines Abroad in the Last 3 Years *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="finesAbroad" value="yes" checked={formData.finesAbroad === 'yes'} onChange={(e) => onInputChange('finesAbroad', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="finesAbroad" value="no" checked={formData.finesAbroad === 'no'} onChange={(e) => onInputChange('finesAbroad', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Eco-driving (fuel-efficient driving) *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="ecoDriving" value="yes" checked={formData.ecoDriving === 'yes'} onChange={(e) => onInputChange('ecoDriving', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="ecoDriving" value="no" checked={formData.ecoDriving === 'no'} onChange={(e) => onInputChange('ecoDriving', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
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
            <p className="text-muted-foreground">Language proficiency levels</p>
          </div>
          <div className="space-y-6">
            {[
              { field: 'englishLevel' as keyof ApplicantFormData, label: 'English *' },
              { field: 'germanLevel' as keyof ApplicantFormData, label: 'German' },
              { field: 'russianLevel' as keyof ApplicantFormData, label: 'Russian' },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-3">
                <Label>{label}</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {['basic', 'intermediate', 'advanced'].map((level) => (
                    <label key={level} className={`flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData[field] === level ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name={field} value={level} checked={formData[field] === level} onChange={(e) => onInputChange(field, e.target.value)} className="w-4 h-4" />
                      <span className="font-medium capitalize">{level}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="otherLanguages">Other Languages</Label>
              <Input id="otherLanguages" placeholder="e.g., French, Italian..." value={formData.otherLanguages} onChange={(e) => onInputChange('otherLanguages', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="languageAtWork">Language Used at Work</Label>
              <Input id="languageAtWork" placeholder="Which language do you primarily use?" value={formData.languageAtWork} onChange={(e) => onInputChange('languageAtWork', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Step 10: Work Flexibility */}
      {currentStep === 10 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3b82f6] flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl font-bold text-white">10</span>
            </div>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-2">Work Flexibility</h2>
            <p className="text-muted-foreground">Availability and work preferences</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Willingness to Work in a Double Crew *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="doubleCrewWillingness" value="yes" checked={formData.doubleCrewWillingness === 'yes'} onChange={(e) => onInputChange('doubleCrewWillingness', e.target.value)} className="w-4 h-4" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="doubleCrewWillingness" value="no" checked={formData.doubleCrewWillingness === 'no'} onChange={(e) => onInputChange('doubleCrewWillingness', e.target.value)} className="w-4 h-4" />
                  <span>No</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTourWeeks">Maximum Tour Length (weeks) *</Label>
              <Input id="maxTourWeeks" type="number" min="1" max="12" placeholder="Number of weeks" value={formData.maxTourWeeks} onChange={(e) => onInputChange('maxTourWeeks', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredCountries">Preferred Countries of Work</Label>
              <Textarea id="preferredCountries" rows={3} placeholder="List your preferred countries (e.g., Germany, Netherlands, Belgium)" value={formData.preferredCountries} onChange={(e) => onInputChange('preferredCountries', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="undesiredCountries">Undesired Countries</Label>
              <Textarea id="undesiredCountries" rows={3} placeholder="List countries you prefer not to work in (optional)" value={formData.undesiredCountries} onChange={(e) => onInputChange('undesiredCountries', e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
