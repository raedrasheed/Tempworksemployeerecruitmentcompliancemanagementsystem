import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';

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

interface StepProps {
  formData: FormData;
  handleInputChange: (field: keyof FormData, value: any) => void;
  handleArrayToggle: (field: keyof FormData, value: string) => void;
}

export function Step1BasicInformation({ formData, handleInputChange }: StepProps) {
  return (
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
  );
}

export function Step2TravelDocuments({ formData, handleInputChange }: StepProps) {
  return (
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
          <Input
            id="passportNumber"
            placeholder="Passport number"
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
          <Label>Do you have EU Visa? *</Label>
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
              <span>Yes</span>
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
              <span>No</span>
            </label>
          </div>
        </div>

        {formData.hasEUVisa === 'yes' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="visaType">Visa Type</Label>
              <Input
                id="visaType"
                placeholder="Visa type"
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
          <Label>Work Permit in EU? *</Label>
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
              <span>Yes</span>
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
              <span>No</span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Residence Card in EU? *</Label>
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
              <span>Yes</span>
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
              <span>No</span>
            </label>
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="issuingCountry">Issuing Country</Label>
          <Input
            id="issuingCountry"
            placeholder="Country"
            value={formData.issuingCountry}
            onChange={(e) => handleInputChange('issuingCountry', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// Export step components array for easy mapping
export const formSteps = [
  Step1BasicInformation,
  Step2TravelDocuments,
  // Add more steps as needed...
];
