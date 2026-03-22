import { User, Phone, CreditCard, Briefcase, Shield, FileText, CheckCircle2, Check, Upload, Plus, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';

export interface UploadedFileItem {
  id: string;
  type: string;
  file: File | null;
}

export const DOCUMENT_TYPES = [
  'Passport',
  "Driver's License",
  'Tachograph Card',
  'Code 95 / CPC Card',
  'ADR Certificate',
  'Visa',
  'Work Permit',
  'Residence Card',
  'Medical Certificate',
  'Birth Certificate',
  'NIN / Tax ID',
  'Other',
];

export interface JobType {
  id: string;
  name: string;
}

export interface ApplicantFormData {
  jobTypeId: string;
  // Step 1: Personal
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  currentCountryOfResidence: string;
  permanentAddress: string;
  // Step 2: Contact
  phone: string;
  email: string;
  earliestStartDate: string;
  howDidYouHear: string;
  // Step 3: License
  drivingLicenseNumber: string;
  licenseIssuingCountry: string;
  licenseIssueDate: string;
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
  // Step 4: Experience
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
  // Step 5: Background
  weekendDriving: boolean;
  nightDriving: boolean;
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
  // Step 6: Documents
  passportNumber: string;
  passportValidUntil: string;
  hasEUVisa: string;
  visaType: string;
  visaValidUntil: string;
  hasWorkPermit: string;
  hasResidenceCard: string;
  issuingCountry: string;
}

// ── Step Indicator ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Personal', icon: User },
  { label: 'Contact', icon: Phone },
  { label: 'License', icon: CreditCard },
  { label: 'Experience', icon: Briefcase },
  { label: 'Background', icon: Shield },
  { label: 'Documents', icon: FileText },
  { label: 'Review', icon: CheckCircle2 },
];

export function StepIndicator({ currentStep }: { currentStep: number }) {
  const total = STEPS.length;
  const progress = Math.round((currentStep / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Step {currentStep} of {total}</span>
        <span className="text-sm text-gray-500">{progress}% Complete</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-start justify-between">
        {STEPS.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isCompleted
                  ? 'bg-green-500'
                  : isCurrent
                    ? 'bg-blue-600'
                    : 'bg-gray-100 border-2 border-gray-200'
              }`}>
                {isCompleted
                  ? <Check className="w-4 h-4 text-white" />
                  : <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                }
              </div>
              <span className={`text-xs font-medium text-center leading-tight ${
                isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function RadioGroup({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-4">
      {['yes', 'no'].map((v) => (
        <label key={v} className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="w-4 h-4 accent-blue-600" />
          <span className="capitalize">{v}</span>
        </label>
      ))}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-blue-600 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  currentStep: number;
  formData: ApplicantFormData;
  onInputChange: (field: keyof ApplicantFormData, value: any) => void;
  onArrayToggle: (field: keyof ApplicantFormData, value: string) => void;
  jobTypes?: JobType[];
  uploadedFiles?: UploadedFileItem[];
  onFilesChange?: (files: UploadedFileItem[]) => void;
}

function DocumentRow({
  item, onTypeChange, onFileChange, onRemove,
}: {
  item: UploadedFileItem;
  onTypeChange: (type: string) => void;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-3 hover:border-blue-400 transition-colors">
      <div className="flex items-start gap-3">
        {/* Document type selector */}
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Document Type *</label>
          <select
            value={item.type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select document type…</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-5 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove document"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* File picker */}
      <label className="block cursor-pointer">
        <div className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
          item.file
            ? 'bg-green-50 border-green-300 text-green-800'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'
        }`}>
          {item.file ? (
            <>
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="truncate font-medium">{item.file.name}</span>
              <span className="ml-auto text-xs text-green-600 shrink-0">
                {(item.file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-400 text-xs border border-gray-300 rounded px-2 py-0.5 bg-white">Choose File</span>
              <span className="text-gray-400">No file chosen</span>
            </>
          )}
        </div>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

export function ApplicantFormSteps({ currentStep, formData, onInputChange, onArrayToggle, jobTypes = [], uploadedFiles = [], onFilesChange }: Props) {
  const addDocument = () => {
    const newItem: UploadedFileItem = { id: crypto.randomUUID(), type: '', file: null };
    onFilesChange?.([...uploadedFiles, newItem]);
  };

  const updateItem = (id: string, patch: Partial<UploadedFileItem>) => {
    onFilesChange?.(uploadedFiles.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeItem = (id: string) => {
    onFilesChange?.(uploadedFiles.filter((f) => f.id !== id));
  };
  return (
    <>
      {/* ── Step 1: Personal ── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <SectionTitle title="Personal Information" subtitle="Tell us about yourself" />
          {jobTypes.length > 0 && (
            <div className="space-y-2">
              <Label>Position / Job Type *</Label>
              <Select value={formData.jobTypeId} onValueChange={(v) => onInputChange('jobTypeId', v)}>
                <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                <SelectContent>
                  {jobTypes.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="Full name" value={formData.fullName} onChange={(e) => onInputChange('fullName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth *</Label>
              <Input type="date" value={formData.dateOfBirth} onChange={(e) => onInputChange('dateOfBirth', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nationality *</Label>
              <Input placeholder="Nationality" value={formData.nationality} onChange={(e) => onInputChange('nationality', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country of Residence *</Label>
              <Input placeholder="Country of residence" value={formData.countryOfResidence} onChange={(e) => onInputChange('countryOfResidence', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Current Country of Residence *</Label>
              <Input placeholder="Current country" value={formData.currentCountryOfResidence} onChange={(e) => onInputChange('currentCountryOfResidence', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Permanent Address *</Label>
              <Input placeholder="Permanent address" value={formData.permanentAddress} onChange={(e) => onInputChange('permanentAddress', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Contact ── */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <SectionTitle title="Contact Details" subtitle="How can we reach you?" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Phone (with country code) *</Label>
              <Input type="tel" placeholder="+xxx xxx xxx xxx" value={formData.phone} onChange={(e) => onInputChange('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" placeholder="email@example.com" value={formData.email} onChange={(e) => onInputChange('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Earliest Start Date *</Label>
              <Input type="date" value={formData.earliestStartDate} onChange={(e) => onInputChange('earliestStartDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>How did you hear about us? *</Label>
              <Select value={formData.howDidYouHear} onValueChange={(v) => onInputChange('howDidYouHear', v)}>
                <SelectTrigger><SelectValue placeholder="Select option" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="jobPortal">Job Portal</SelectItem>
                  <SelectItem value="friend">Friend / Referral</SelectItem>
                  <SelectItem value="agency">Recruitment Agency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: License & Qualifications ── */}
      {currentStep === 3 && (
        <div className="space-y-8">
          <SectionTitle title="Driver's License & Qualifications" subtitle="Information about your driving qualifications" />

          {/* Driver's License Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <CreditCard className="w-4 h-4 text-gray-500" />
              <h4 className="font-semibold text-gray-800">Driver's License Details</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>License Number *</Label>
                <Input placeholder="License number" value={formData.drivingLicenseNumber} onChange={(e) => onInputChange('drivingLicenseNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Issuing Authority *</Label>
                <Input placeholder="Country/Region" value={formData.licenseIssuingCountry} onChange={(e) => onInputChange('licenseIssuingCountry', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Issue Date *</Label>
                <Input type="date" value={formData.licenseIssueDate} onChange={(e) => onInputChange('licenseIssueDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input type="date" value={formData.licenseValidUntil} onChange={(e) => onInputChange('licenseValidUntil', e.target.value)} />
              </div>
            </div>
          </div>

          {/* License Categories */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">License Categories Held *</Label>
              <p className="text-sm text-gray-500 mt-0.5">Select all that apply</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((cat) => {
                const field = `category${cat}` as keyof ApplicantFormData;
                const isSelected = !!(formData[field] as string);
                return (
                  <div key={cat} className="space-y-2">
                    <label className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onInputChange(field, checked ? 'yes' : '')}
                      />
                      <span className="font-semibold text-sm">Category {cat}</span>
                    </label>
                    {isSelected && (
                      <Input
                        type="date"
                        placeholder="Date obtained"
                        value={formData[field] === 'yes' ? '' : formData[field] as string}
                        onChange={(e) => onInputChange(field, e.target.value || 'yes')}
                        className="text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Qualifications */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">Additional Qualifications</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-medium">Driver Tachograph Card</Label>
                <RadioGroup name="hasTachographCard" value={formData.hasTachographCard} onChange={(v) => onInputChange('hasTachographCard', v)} />
                {formData.hasTachographCard === 'yes' && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input placeholder="Card number" value={formData.tachographNumber} onChange={(e) => onInputChange('tachographNumber', e.target.value)} />
                    <Input type="date" value={formData.tachographValidUntil} onChange={(e) => onInputChange('tachographValidUntil', e.target.value)} />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <Label className="font-medium">Qualification Card – Code 95</Label>
                <RadioGroup name="hasQualificationCard" value={formData.hasQualificationCard} onChange={(v) => onInputChange('hasQualificationCard', v)} />
                {formData.hasQualificationCard === 'yes' && (
                  <Input type="date" placeholder="Valid until" value={formData.qualificationValidUntil} onChange={(e) => onInputChange('qualificationValidUntil', e.target.value)} />
                )}
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label className="font-medium">ADR Certificate</Label>
                <RadioGroup name="hasADR" value={formData.hasADR} onChange={(v) => onInputChange('hasADR', v)} />
                {formData.hasADR === 'yes' && (
                  <div className="grid md:grid-cols-2 gap-4 mt-2">
                    <Input placeholder="ADR classes" value={formData.adrClasses} onChange={(e) => onInputChange('adrClasses', e.target.value)} />
                    <Input type="date" placeholder="Valid until" value={formData.adrValidUntil} onChange={(e) => onInputChange('adrValidUntil', e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Experience ── */}
      {currentStep === 4 && (
        <div className="space-y-8">
          <SectionTitle title="Driving Experience" subtitle="Your professional driving background" />

          {/* International Experience */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">International Experience</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>EU/International Driving Experience? *</Label>
                <RadioGroup name="hasEUExperience" value={formData.hasEUExperience} onChange={(v) => onInputChange('hasEUExperience', v)} />
              </div>
              {formData.hasEUExperience === 'yes' && (
                <>
                  <div className="space-y-2">
                    <Label>Years of EU Experience</Label>
                    <Input type="number" min="0" placeholder="Years" value={formData.yearsEUExperience} onChange={(e) => onInputChange('yearsEUExperience', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Total C+E Experience (years)</Label>
                    <Input type="number" min="0" placeholder="Years" value={formData.totalCEExperience} onChange={(e) => onInputChange('totalCEExperience', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Years Active Driving</Label>
                    <Input type="number" min="0" placeholder="Years" value={formData.yearsActiveDriving} onChange={(e) => onInputChange('yearsActiveDriving', e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Mainly drove in home country?</Label>
                <RadioGroup name="mainlyHomeCountry" value={formData.mainlyHomeCountry} onChange={(v) => onInputChange('mainlyHomeCountry', v)} />
              </div>
              <div className="space-y-2">
                <Label>Driven in other EU countries?</Label>
                <RadioGroup name="drivenOtherCountries" value={formData.drivenOtherCountries} onChange={(v) => onInputChange('drivenOtherCountries', v)} />
              </div>
              {formData.drivenOtherCountries === 'yes' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Specify countries</Label>
                  <Textarea rows={2} placeholder="e.g. Germany, France, Netherlands..." value={formData.specifyCountries} onChange={(e) => onInputChange('specifyCountries', e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* KM & Transport */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">Driver Experience Profile</h4>
            </div>
            <div className="space-y-3">
              <Label>Total Kilometers Driven on C+E *</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['< 500,000 km', '500,000 – 1,000,000 km', '> 1,000,000 km', 'More than specified'].map((range) => (
                  <label key={range} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer text-sm transition-all ${formData.kilometersRange === range ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="kilometersRange" value={range} checked={formData.kilometersRange === range} onChange={(e) => onInputChange('kilometersRange', e.target.value)} className="w-4 h-4 accent-blue-600" />
                    <span className="font-medium">{range}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Transport Types *</Label>
              <div className="grid grid-cols-2 gap-3">
                {[{ value: 'international', label: 'International Transport' }, { value: 'domestic', label: 'Domestic Transport' }, { value: 'bilateral', label: 'Bilateral Transport' }, { value: 'cabotage', label: 'Cabotage' }].map((t) => (
                  <label key={t.value} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${(formData.transportTypes || []).includes(t.value) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Checkbox checked={(formData.transportTypes || []).includes(t.value)} onCheckedChange={() => onArrayToggle('transportTypes', t.value)} />
                    <span className="font-medium text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Operational Skills */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">Operational Skills</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[{ value: 'pallet', label: 'EUR Pallet Exchange' }, { value: 'loading', label: 'Driver Loading and Unloading' }, { value: 'cmr', label: 'CMR Documentation' }, { value: 'securing', label: 'Load Securing (lashing)' }, { value: 'tachograph', label: 'Digital Tachograph Operation' }].map((s) => (
                <label key={s.value} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${(formData.operationalSkills || []).includes(s.value) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Checkbox checked={(formData.operationalSkills || []).includes(s.value)} onCheckedChange={() => onArrayToggle('operationalSkills', s.value)} />
                  <span className="font-medium text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Technical */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">Technical Experience</h4>
            </div>
            <div className="space-y-3">
              <Label>Truck Brands *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['Volvo', 'Scania', 'DAF', 'MAN', 'Mercedes-Benz', 'Iveco'].map((brand) => (
                  <label key={brand} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${(formData.truckBrands || []).includes(brand) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Checkbox checked={(formData.truckBrands || []).includes(brand)} onCheckedChange={() => onArrayToggle('truckBrands', brand)} />
                    <span className="font-medium text-sm">{brand}</span>
                  </label>
                ))}
              </div>
              <Input placeholder="Other brands" value={formData.otherBrand} onChange={(e) => onInputChange('otherBrand', e.target.value)} />
            </div>
            <div className="space-y-3">
              <Label>Gearbox Type *</Label>
              <div className="grid grid-cols-3 gap-3">
                {[{ value: 'manual', label: 'Manual' }, { value: 'automatic', label: 'Automatic' }, { value: 'both', label: 'Both' }].map((g) => (
                  <label key={g.value} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${formData.gearboxType === g.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="gearboxType" value={g.value} checked={formData.gearboxType === g.value} onChange={(e) => onInputChange('gearboxType', e.target.value)} className="w-4 h-4 accent-blue-600" />
                    <span className="font-medium text-sm">{g.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Trailer Types</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{ value: 'curtain', label: 'Curtain Sider' }, { value: 'reefer', label: 'Reefer' }, { value: 'tanker', label: 'Tanker' }, { value: 'container', label: 'Container' }, { value: 'walking', label: 'Walking Floor' }, { value: 'lowdeck', label: 'Lowdeck' }, { value: 'mega', label: 'Mega' }, { value: 'swap', label: 'Swap Body' }].map((t) => (
                  <label key={t.value} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${(formData.trailerTypes || []).includes(t.value) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Checkbox checked={(formData.trailerTypes || []).includes(t.value)} onCheckedChange={() => onArrayToggle('trailerTypes', t.value)} />
                    <span className="font-medium text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <Input placeholder="Most used trailer" value={formData.mostUsedTrailer} onChange={(e) => onInputChange('mostUsedTrailer', e.target.value)} />
                <Input type="number" min="0" placeholder="Years with that trailer" value={formData.yearsWithTrailer} onChange={(e) => onInputChange('yearsWithTrailer', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Background ── */}
      {currentStep === 5 && (
        <div className="space-y-8">
          <SectionTitle title="Safety & Background" subtitle="Safety record, languages, and work preferences" />

          {/* Safety */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">Safety & Discipline</h4>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <Label className="font-medium">Work Regime</Label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={formData.weekendDriving} onCheckedChange={(c) => onInputChange('weekendDriving', c)} />
                <span className="text-sm">Weekend Driving</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={formData.nightDriving} onCheckedChange={(c) => onInputChange('nightDriving', c)} />
                <span className="text-sm">Night Driving</span>
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Traffic Accidents (last 3 years) *</Label>
                <RadioGroup name="trafficAccidents" value={formData.trafficAccidents} onChange={(v) => onInputChange('trafficAccidents', v)} />
                {formData.trafficAccidents === 'yes' && (
                  <Textarea rows={2} placeholder="Please describe" value={formData.accidentDescription} onChange={(e) => onInputChange('accidentDescription', e.target.value)} />
                )}
              </div>
              <div className="space-y-2">
                <Label>AETR Violations *</Label>
                <RadioGroup name="aetrViolations" value={formData.aetrViolations} onChange={(v) => onInputChange('aetrViolations', v)} />
              </div>
              <div className="space-y-2">
                <Label>Fines Abroad (last 3 years) *</Label>
                <RadioGroup name="finesAbroad" value={formData.finesAbroad} onChange={(v) => onInputChange('finesAbroad', v)} />
              </div>
              <div className="space-y-2">
                <Label>Eco-Driving (fuel-efficient) *</Label>
                <RadioGroup name="ecoDriving" value={formData.ecoDriving} onChange={(v) => onInputChange('ecoDriving', v)} />
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">Language Skills</h4>
            </div>
            {[
              { field: 'englishLevel' as keyof ApplicantFormData, label: 'English *' },
              { field: 'germanLevel' as keyof ApplicantFormData, label: 'German' },
              { field: 'russianLevel' as keyof ApplicantFormData, label: 'Russian' },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <div className="grid grid-cols-3 gap-3">
                  {['basic', 'intermediate', 'advanced'].map((level) => (
                    <label key={level} className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${formData[field] === level ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name={field} value={level} checked={formData[field] === level} onChange={() => onInputChange(field, level)} className="w-4 h-4 accent-blue-600" />
                      <span className="font-medium text-sm capitalize">{level}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Other Languages</Label>
                <Input placeholder="e.g. French, Italian…" value={formData.otherLanguages} onChange={(e) => onInputChange('otherLanguages', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Language Used at Work</Label>
                <Input placeholder="Primary work language" value={formData.languageAtWork} onChange={(e) => onInputChange('languageAtWork', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Work Flexibility */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <h4 className="font-semibold text-gray-800">Work Flexibility</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Willing to Work in Double Crew? *</Label>
                <RadioGroup name="doubleCrewWillingness" value={formData.doubleCrewWillingness} onChange={(v) => onInputChange('doubleCrewWillingness', v)} />
              </div>
              <div className="space-y-2">
                <Label>Maximum Tour Length (weeks) *</Label>
                <Input type="number" min="1" max="12" placeholder="Number of weeks" value={formData.maxTourWeeks} onChange={(e) => onInputChange('maxTourWeeks', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Preferred Countries</Label>
                <Textarea rows={2} placeholder="e.g. Germany, Netherlands…" value={formData.preferredCountries} onChange={(e) => onInputChange('preferredCountries', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Undesired Countries</Label>
                <Textarea rows={2} placeholder="Countries to avoid (optional)" value={formData.undesiredCountries} onChange={(e) => onInputChange('undesiredCountries', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 6: Documents ── */}
      {currentStep === 6 && (
        <div className="space-y-8">
          {/* Travel info fields */}
          <div className="space-y-6">
            <SectionTitle title="Travel & Residence Documents" subtitle="Passport, visa, and residence information" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Passport Number *</Label>
                <Input placeholder="Passport number" value={formData.passportNumber} onChange={(e) => onInputChange('passportNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Passport Valid Until *</Label>
                <Input type="date" value={formData.passportValidUntil} onChange={(e) => onInputChange('passportValidUntil', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>EU Visa? *</Label>
                <RadioGroup name="hasEUVisa" value={formData.hasEUVisa} onChange={(v) => onInputChange('hasEUVisa', v)} />
              </div>
              {formData.hasEUVisa === 'yes' && (
                <>
                  <div className="space-y-2">
                    <Label>Visa Type</Label>
                    <Input placeholder="Visa type" value={formData.visaType} onChange={(e) => onInputChange('visaType', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Visa Valid Until</Label>
                    <Input type="date" value={formData.visaValidUntil} onChange={(e) => onInputChange('visaValidUntil', e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Work Permit in EU? *</Label>
                <RadioGroup name="hasWorkPermit" value={formData.hasWorkPermit} onChange={(v) => onInputChange('hasWorkPermit', v)} />
              </div>
              <div className="space-y-2">
                <Label>Residence Card in EU? *</Label>
                <RadioGroup name="hasResidenceCard" value={formData.hasResidenceCard} onChange={(v) => onInputChange('hasResidenceCard', v)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Issuing Country</Label>
                <Input placeholder="Country" value={formData.issuingCountry} onChange={(e) => onInputChange('issuingCountry', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Document uploads */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-1 border-b">
              <Upload className="w-4 h-4 text-gray-500" />
              <h4 className="font-semibold text-gray-800">Document Upload</h4>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <span className="font-semibold shrink-0">Note:</span>
              <span>All documents must be clear, legible scans or photos. Accepted formats: PDF, JPG, PNG. Maximum size: 5MB per file.</span>
            </div>

            {/* Dynamic document rows */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-3">
                {uploadedFiles.map((item) => (
                  <DocumentRow
                    key={item.id}
                    item={item}
                    onTypeChange={(type) => updateItem(item.id, { type })}
                    onFileChange={(file) => updateItem(item.id, { file })}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            )}

            {uploadedFiles.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                No documents added yet. Click "Add Document" to upload files.
              </p>
            )}

            <button
              type="button"
              onClick={addDocument}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 font-medium text-sm hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Document
            </button>
          </div>
        </div>
      )}

      {/* ── Step 7: Review ── */}
      {currentStep === 7 && (
        <div className="space-y-6">
          <SectionTitle title="Review Your Application" subtitle="Please review your information before submitting" />
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', value: formData.fullName },
              { label: 'Date of Birth', value: formData.dateOfBirth },
              { label: 'Nationality', value: formData.nationality },
              { label: 'Country of Residence', value: formData.countryOfResidence },
              { label: 'Phone', value: formData.phone },
              { label: 'Email', value: formData.email },
              { label: 'Earliest Start Date', value: formData.earliestStartDate },
              { label: 'License Number', value: formData.drivingLicenseNumber },
              { label: 'Issuing Authority', value: formData.licenseIssuingCountry },
              { label: 'License Expiry', value: formData.licenseValidUntil },
              { label: 'English Level', value: formData.englishLevel },
              { label: 'Passport Number', value: formData.passportNumber },
            ].map(({ label, value }) => value ? (
              <div key={label} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
              </div>
            ) : null)}
          </div>
          {formData.transportTypes?.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Transport Types</p>
              <div className="flex flex-wrap gap-2">
                {formData.transportTypes.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              By submitting this application you confirm all information provided is accurate and complete.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
