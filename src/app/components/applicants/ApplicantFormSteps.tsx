import { useState } from 'react';
import { User, Phone, Shield, CreditCard, Briefcase, GraduationCap, Star, Info, FileText, CheckCircle2, Check, Upload, Plus, X, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { AddressForm, AddressData, EMPTY_ADDRESS } from '../ui/AddressForm';
import { CountrySelect } from '../ui/CountrySelect';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UploadedFileItem {
  id: string;
  type: string;
  file: File | null;
}

export interface JobType {
  id: string;
  name: string;
}

export interface QualificationEntry {
  id: string;
  type: string;
  issueDate: string;
  expiryDate: string;
  noExpiry: boolean;
  country: string;
}

export interface EducationEntry {
  id: string;
  level: string;
  institution: string;
  fieldOfStudy: string;
  country: string;
  startDate: string;
  endDate: string;
  ongoing: boolean;
  degree: string;
}

export interface WorkHistoryEntry {
  id: string;
  company: string;
  jobTitle: string;
  country: string;
  startDate: string;
  endDate: string;
  current: boolean;
  responsibilities: string;
  references: string;
}

export interface LanguageEntry {
  id: string;
  language: string;
  proficiency: string;
  hasCertificate: boolean;
  certificate: string;
}

export interface FormSettings {
  visaTypes: string[];
  familyRelations: string[];
  drivingQualifications: string[];
  gpsSystemTypes: string[];
  howDidYouHear: string[];
  educationLevels: string[];
  declarationText: string;
}

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  visaTypes: ['Tourist', 'Business', 'Work', 'Student', 'Transit', 'Family Reunification', 'Schengen', 'Long-stay', 'Other'],
  familyRelations: ['Spouse', 'Partner', 'Parent', 'Child', 'Sibling', 'Friend', 'Colleague', 'Other'],
  drivingQualifications: ['Tachograph Card', 'C95 / CPC Card', 'ADR Certificate', 'Medical Certificate', 'DVLA Check', 'Transport Manager CPC'],
  gpsSystemTypes: ['TomTom', 'Garmin', 'Webfleet', 'Sygic', 'HERE', 'Google Maps', 'Other'],
  howDidYouHear: ['Facebook', 'LinkedIn', 'Job Portal', 'Friend / Referral', 'Recruitment Agency', 'Google Search', 'Company Website', 'Other'],
  educationLevels: ["Primary School", "Secondary School", "High School / A-Levels", "Vocational Training", "Associate Degree", "Bachelor's Degree", "Master's Degree", "Doctoral Degree", "Professional Certification", "Other"],
  declarationText: 'I declare that the information provided in this application is true, complete and accurate to the best of my knowledge. I understand that providing false or misleading information may result in my application being rejected or employment being terminated.',
};

export interface ApplicantFormData {
  jobTypeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  citizenship: string;
  countryOfBirth: string;
  cityOfBirth: string;
  homeAddress: AddressData;
  currentAddress: AddressData;
  sameAsHomeAddress: boolean;
  phoneCode: string;
  phone: string;
  email: string;
  emailConfirm: string;
  emergencyFirstName: string;
  emergencyLastName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  emergencyEmail: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportNoExpiry: boolean;
  passportCountry: string;
  hasIdCard: string;
  idCardNumber: string;
  idCardExpiryDate: string;
  idCardNoExpiry: boolean;
  idCardCountry: string;
  hasEuVisa: string;
  euVisaType: string;
  euVisaNumber: string;
  euVisaExpiryDate: string;
  euVisaNoExpiry: boolean;
  hasEuResidence: string;
  euResidenceType: string;
  euResidenceNumber: string;
  euResidenceExpiryDate: string;
  euResidenceNoExpiry: boolean;
  euResidenceCountry: string;
  hasWorkPermit: string;
  workPermitType: string;
  workPermitNumber: string;
  workPermitExpiryDate: string;
  workPermitNoExpiry: boolean;
  workPermitCountry: string;
  hasConvictions: string;
  convictionDetails: string;
  hasDrivingLicense: string;
  licenseNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  licenseNoExpiry: boolean;
  licenseCountry: string;
  licenseCategories: string[];
  qualifications: QualificationEntry[];
  drivingExpType: string;
  euExpYears: string;
  euExpCountries: string;
  euExpKm: string;
  domesticExpYears: string;
  domesticExpRegions: string;
  transportTypes: string[];
  truckBrands: string[];
  otherBrand: string;
  selectedGpsSystems: string[];
  trailerTypes: string[];
  mostUsedTrailer: string;
  gearboxType: string;
  weekendDriving: boolean;
  nightDriving: boolean;
  workRegime: string[];
  trafficAccidents: string;
  accidentDescription: string;
  education: EducationEntry[];
  workHistory: WorkHistoryEntry[];
  languages: LanguageEntry[];
  computerSkills: string[];
  hasFirstAid: string;
  firstAidExpiry: string;
  firstAidNoExpiry: boolean;
  softSkills: string[];
  toolsDescription: string;
  preferredStartDate: string;
  howDidYouHear: string;
  availability: string;
  willingToRelocate: boolean;
  preferredLocations: string;
  salaryExpectation: string;
  additionalNotes: string;
  declarationAccepted: boolean;
}

export const EMPTY_FORM: ApplicantFormData = {
  jobTypeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  citizenship: '',
  countryOfBirth: '',
  cityOfBirth: '',
  homeAddress: { ...EMPTY_ADDRESS },
  currentAddress: { ...EMPTY_ADDRESS },
  sameAsHomeAddress: false,
  phoneCode: '+44',
  phone: '',
  email: '',
  emailConfirm: '',
  emergencyFirstName: '',
  emergencyLastName: '',
  emergencyRelation: '',
  emergencyPhone: '',
  emergencyEmail: '',
  passportNumber: '',
  passportIssueDate: '',
  passportExpiryDate: '',
  passportNoExpiry: false,
  passportCountry: '',
  hasIdCard: '',
  idCardNumber: '',
  idCardExpiryDate: '',
  idCardNoExpiry: false,
  idCardCountry: '',
  hasEuVisa: '',
  euVisaType: '',
  euVisaNumber: '',
  euVisaExpiryDate: '',
  euVisaNoExpiry: false,
  hasEuResidence: '',
  euResidenceType: '',
  euResidenceNumber: '',
  euResidenceExpiryDate: '',
  euResidenceNoExpiry: false,
  euResidenceCountry: '',
  hasWorkPermit: '',
  workPermitType: '',
  workPermitNumber: '',
  workPermitExpiryDate: '',
  workPermitNoExpiry: false,
  workPermitCountry: '',
  hasConvictions: '',
  convictionDetails: '',
  hasDrivingLicense: '',
  licenseNumber: '',
  licenseIssueDate: '',
  licenseExpiryDate: '',
  licenseNoExpiry: false,
  licenseCountry: '',
  licenseCategories: [],
  qualifications: [],
  drivingExpType: '',
  euExpYears: '',
  euExpCountries: '',
  euExpKm: '',
  domesticExpYears: '',
  domesticExpRegions: '',
  transportTypes: [],
  truckBrands: [],
  otherBrand: '',
  selectedGpsSystems: [],
  trailerTypes: [],
  mostUsedTrailer: '',
  gearboxType: '',
  weekendDriving: false,
  nightDriving: false,
  workRegime: [],
  trafficAccidents: '',
  accidentDescription: '',
  education: [],
  workHistory: [],
  languages: [],
  computerSkills: [],
  hasFirstAid: '',
  firstAidExpiry: '',
  firstAidNoExpiry: false,
  softSkills: [],
  toolsDescription: '',
  preferredStartDate: '',
  howDidYouHear: '',
  availability: '',
  willingToRelocate: false,
  preferredLocations: '',
  salaryExpectation: '',
  additionalNotes: '',
  declarationAccepted: false,
};

const TAB_DEFS = [
  { id: 1, label: 'Personal', Icon: User },
  { id: 2, label: 'Contact', Icon: Phone },
  { id: 3, label: 'ID & Legal', Icon: Shield },
  { id: 4, label: 'Driving License', Icon: CreditCard },
  { id: 5, label: 'Driving Exp.', Icon: Briefcase },
  { id: 6, label: 'Education', Icon: GraduationCap },
  { id: 7, label: 'Experience', Icon: Briefcase },
  { id: 8, label: 'Skills', Icon: Star },
  { id: 9, label: 'Additional', Icon: Info },
  { id: 10, label: 'Documents', Icon: FileText },
  { id: 11, label: 'Review', Icon: CheckCircle2 },
];

export function getVisibleTabs(formData: Pick<ApplicantFormData, 'hasDrivingLicense'>): number[] {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  if (formData.hasDrivingLicense !== 'yes') return all.filter(t => t !== 5);
  return all;
}

const PHONE_CODES: { label: string; code: string }[] = [
  { label: 'Afghanistan', code: '+93' },
  { label: 'Albania', code: '+355' },
  { label: 'Algeria', code: '+213' },
  { label: 'Andorra', code: '+376' },
  { label: 'Angola', code: '+244' },
  { label: 'Antigua and Barbuda', code: '+1' },
  { label: 'Argentina', code: '+54' },
  { label: 'Armenia', code: '+374' },
  { label: 'Australia', code: '+61' },
  { label: 'Austria', code: '+43' },
  { label: 'Azerbaijan', code: '+994' },
  { label: 'Bahamas', code: '+1' },
  { label: 'Bahrain', code: '+973' },
  { label: 'Bangladesh', code: '+880' },
  { label: 'Barbados', code: '+1' },
  { label: 'Belarus', code: '+375' },
  { label: 'Belgium', code: '+32' },
  { label: 'Belize', code: '+501' },
  { label: 'Benin', code: '+229' },
  { label: 'Bhutan', code: '+975' },
  { label: 'Bolivia', code: '+591' },
  { label: 'Bosnia and Herzegovina', code: '+387' },
  { label: 'Botswana', code: '+267' },
  { label: 'Brazil', code: '+55' },
  { label: 'Brunei', code: '+673' },
  { label: 'Bulgaria', code: '+359' },
  { label: 'Burkina Faso', code: '+226' },
  { label: 'Burundi', code: '+257' },
  { label: 'Cambodia', code: '+855' },
  { label: 'Cameroon', code: '+237' },
  { label: 'Canada', code: '+1' },
  { label: 'Cape Verde', code: '+238' },
  { label: 'Central African Republic', code: '+236' },
  { label: 'Chad', code: '+235' },
  { label: 'Chile', code: '+56' },
  { label: 'China', code: '+86' },
  { label: 'Colombia', code: '+57' },
  { label: 'Comoros', code: '+269' },
  { label: 'Congo (DRC)', code: '+243' },
  { label: 'Congo (Republic)', code: '+242' },
  { label: 'Costa Rica', code: '+506' },
  { label: 'Croatia', code: '+385' },
  { label: 'Cuba', code: '+53' },
  { label: 'Cyprus', code: '+357' },
  { label: 'Czech Republic', code: '+420' },
  { label: 'Denmark', code: '+45' },
  { label: 'Djibouti', code: '+253' },
  { label: 'Dominica', code: '+1' },
  { label: 'Dominican Republic', code: '+1' },
  { label: 'Ecuador', code: '+593' },
  { label: 'Egypt', code: '+20' },
  { label: 'El Salvador', code: '+503' },
  { label: 'Equatorial Guinea', code: '+240' },
  { label: 'Eritrea', code: '+291' },
  { label: 'Estonia', code: '+372' },
  { label: 'Eswatini', code: '+268' },
  { label: 'Ethiopia', code: '+251' },
  { label: 'Fiji', code: '+679' },
  { label: 'Finland', code: '+358' },
  { label: 'France', code: '+33' },
  { label: 'Gabon', code: '+241' },
  { label: 'Gambia', code: '+220' },
  { label: 'Georgia', code: '+995' },
  { label: 'Germany', code: '+49' },
  { label: 'Ghana', code: '+233' },
  { label: 'Greece', code: '+30' },
  { label: 'Grenada', code: '+1' },
  { label: 'Guatemala', code: '+502' },
  { label: 'Guinea', code: '+224' },
  { label: 'Guinea-Bissau', code: '+245' },
  { label: 'Guyana', code: '+592' },
  { label: 'Haiti', code: '+509' },
  { label: 'Honduras', code: '+504' },
  { label: 'Hungary', code: '+36' },
  { label: 'Iceland', code: '+354' },
  { label: 'India', code: '+91' },
  { label: 'Indonesia', code: '+62' },
  { label: 'Iran', code: '+98' },
  { label: 'Iraq', code: '+964' },
  { label: 'Ireland', code: '+353' },
  { label: 'Israel', code: '+972' },
  { label: 'Italy', code: '+39' },
  { label: 'Jamaica', code: '+1' },
  { label: 'Japan', code: '+81' },
  { label: 'Jordan', code: '+962' },
  { label: 'Kazakhstan', code: '+7' },
  { label: 'Kenya', code: '+254' },
  { label: 'Kiribati', code: '+686' },
  { label: 'Kosovo', code: '+383' },
  { label: 'Kuwait', code: '+965' },
  { label: 'Kyrgyzstan', code: '+996' },
  { label: 'Laos', code: '+856' },
  { label: 'Latvia', code: '+371' },
  { label: 'Lebanon', code: '+961' },
  { label: 'Lesotho', code: '+266' },
  { label: 'Liberia', code: '+231' },
  { label: 'Libya', code: '+218' },
  { label: 'Liechtenstein', code: '+423' },
  { label: 'Lithuania', code: '+370' },
  { label: 'Luxembourg', code: '+352' },
  { label: 'Madagascar', code: '+261' },
  { label: 'Malawi', code: '+265' },
  { label: 'Malaysia', code: '+60' },
  { label: 'Maldives', code: '+960' },
  { label: 'Mali', code: '+223' },
  { label: 'Malta', code: '+356' },
  { label: 'Marshall Islands', code: '+692' },
  { label: 'Mauritania', code: '+222' },
  { label: 'Mauritius', code: '+230' },
  { label: 'Mexico', code: '+52' },
  { label: 'Micronesia', code: '+691' },
  { label: 'Moldova', code: '+373' },
  { label: 'Monaco', code: '+377' },
  { label: 'Mongolia', code: '+976' },
  { label: 'Montenegro', code: '+382' },
  { label: 'Morocco', code: '+212' },
  { label: 'Mozambique', code: '+258' },
  { label: 'Myanmar', code: '+95' },
  { label: 'Namibia', code: '+264' },
  { label: 'Nauru', code: '+674' },
  { label: 'Nepal', code: '+977' },
  { label: 'Netherlands', code: '+31' },
  { label: 'New Zealand', code: '+64' },
  { label: 'Nicaragua', code: '+505' },
  { label: 'Niger', code: '+227' },
  { label: 'Nigeria', code: '+234' },
  { label: 'North Korea', code: '+850' },
  { label: 'North Macedonia', code: '+389' },
  { label: 'Norway', code: '+47' },
  { label: 'Oman', code: '+968' },
  { label: 'Pakistan', code: '+92' },
  { label: 'Palau', code: '+680' },
  { label: 'Palestine', code: '+970' },
  { label: 'Panama', code: '+507' },
  { label: 'Papua New Guinea', code: '+675' },
  { label: 'Paraguay', code: '+595' },
  { label: 'Peru', code: '+51' },
  { label: 'Philippines', code: '+63' },
  { label: 'Poland', code: '+48' },
  { label: 'Portugal', code: '+351' },
  { label: 'Qatar', code: '+974' },
  { label: 'Romania', code: '+40' },
  { label: 'Russia', code: '+7' },
  { label: 'Rwanda', code: '+250' },
  { label: 'Saint Kitts and Nevis', code: '+1' },
  { label: 'Saint Lucia', code: '+1' },
  { label: 'Saint Vincent', code: '+1' },
  { label: 'Samoa', code: '+685' },
  { label: 'San Marino', code: '+378' },
  { label: 'Saudi Arabia', code: '+966' },
  { label: 'Senegal', code: '+221' },
  { label: 'Serbia', code: '+381' },
  { label: 'Seychelles', code: '+248' },
  { label: 'Sierra Leone', code: '+232' },
  { label: 'Singapore', code: '+65' },
  { label: 'Slovakia', code: '+421' },
  { label: 'Slovenia', code: '+386' },
  { label: 'Solomon Islands', code: '+677' },
  { label: 'Somalia', code: '+252' },
  { label: 'South Africa', code: '+27' },
  { label: 'South Korea', code: '+82' },
  { label: 'South Sudan', code: '+211' },
  { label: 'Spain', code: '+34' },
  { label: 'Sri Lanka', code: '+94' },
  { label: 'Sudan', code: '+249' },
  { label: 'Suriname', code: '+597' },
  { label: 'Sweden', code: '+46' },
  { label: 'Switzerland', code: '+41' },
  { label: 'Syria', code: '+963' },
  { label: 'Taiwan', code: '+886' },
  { label: 'Tajikistan', code: '+992' },
  { label: 'Tanzania', code: '+255' },
  { label: 'Thailand', code: '+66' },
  { label: 'Timor-Leste', code: '+670' },
  { label: 'Togo', code: '+228' },
  { label: 'Tonga', code: '+676' },
  { label: 'Trinidad and Tobago', code: '+1' },
  { label: 'Tunisia', code: '+216' },
  { label: 'Turkey', code: '+90' },
  { label: 'Turkmenistan', code: '+993' },
  { label: 'Tuvalu', code: '+688' },
  { label: 'Uganda', code: '+256' },
  { label: 'Ukraine', code: '+380' },
  { label: 'United Arab Emirates', code: '+971' },
  { label: 'United Kingdom', code: '+44' },
  { label: 'United States', code: '+1' },
  { label: 'Uruguay', code: '+598' },
  { label: 'Uzbekistan', code: '+998' },
  { label: 'Vanuatu', code: '+678' },
  { label: 'Venezuela', code: '+58' },
  { label: 'Vietnam', code: '+84' },
  { label: 'Yemen', code: '+967' },
  { label: 'Zambia', code: '+260' },
  { label: 'Zimbabwe', code: '+263' },
];

const LICENSE_CATEGORIES = ['AM', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'T'];

const TRUCK_BRANDS = ['Volvo', 'Scania', 'DAF', 'MAN', 'Mercedes-Benz', 'Iveco'];

const PROFICIENCY_LEVELS = ['A1 - Beginner', 'A2 - Elementary', 'B1 - Intermediate', 'B2 - Upper Intermediate', 'C1 - Advanced', 'C2 - Mastery', 'Native'];

const COMPUTER_SKILLS = ['Microsoft Office', 'Email', 'Transport Management Software', 'GPS / Navigation', 'Tachograph Software', 'Other'];

const SOFT_SKILLS = ['Teamwork', 'Communication', 'Time Management', 'Problem Solving', 'Customer Service', 'Self-motivated', 'Adaptability'];

// ── Step Indicator ────────────────────────────────────────────────────────────

export function StepIndicator({ currentStep, visibleTabs }: { currentStep: number; visibleTabs: number[] }) {
  const total = visibleTabs.length;
  const progress = Math.round((currentStep / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Step {currentStep} of {total}</span>
        <span className="text-sm text-gray-500">{progress}% Complete</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="hidden md:flex items-start justify-between overflow-x-auto gap-1">
        {visibleTabs.map((tabId, index) => {
          const def = TAB_DEFS.find(t => t.id === tabId)!;
          const visIdx = index + 1;
          const isCompleted = visIdx < currentStep;
          const isCurrent = visIdx === currentStep;
          const { Icon } = def;
          return (
            <div key={tabId} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-600' : 'bg-gray-100 border-2 border-gray-200'}`}>
                {isCompleted ? <Check className="w-4 h-4 text-white" /> : <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />}
              </div>
              <span className={`text-xs font-medium text-center leading-tight truncate w-full ${isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                {def.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-blue-600 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SubSection({ title }: { title: string }) {
  return <div className="flex items-center gap-2 pb-2 border-b border-gray-200 mb-4"><h3 className="text-base font-semibold text-gray-800">{title}</h3></div>;
}

function RadioYN({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-4">
      {['yes', 'no'].map(v => (
        <label key={v} className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="w-4 h-4 accent-blue-600" />
          <span className="capitalize text-sm">{v}</span>
        </label>
      ))}
    </div>
  );
}

function ExpiryFields({ expiryDate, noExpiry, onExpiry, onNoExpiry }: { expiryDate: string; noExpiry: boolean; onExpiry: (v: string) => void; onNoExpiry: (v: boolean) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Input type="date" value={noExpiry ? '' : expiryDate} onChange={e => onExpiry(e.target.value)} disabled={noExpiry} className="flex-1" placeholder="Expiry date" />
        <label className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer text-sm text-gray-600">
          <Checkbox checked={noExpiry} onCheckedChange={c => { onNoExpiry(!!c); if (c) onExpiry(''); }} />
          No expiry
        </label>
      </div>
    </div>
  );
}

// ── Step Components ───────────────────────────────────────────────────────────

function Step1Personal({ d, u, jobTypes, photoFile, onPhotoChange, existingPhotoUrl }: {
  d: ApplicantFormData;
  u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void;
  jobTypes: JobType[];
  photoFile?: File | null;
  onPhotoChange?: (file: File | null) => void;
  existingPhotoUrl?: string;
}) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));

  // Build preview URL: newly selected file takes priority over existing URL
  const previewUrl = photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl ?? null;

  return (
    <div className="space-y-8">
      <SectionTitle title="Personal Information" subtitle="Your personal details and address" />

      {/* ── Photo Upload ── */}
      <div className="space-y-3">
        <SubSection title="Applicant Photo" />
        <div className="flex items-start gap-6">
          {/* Preview circle */}
          <div className={`w-28 h-28 rounded-full shrink-0 border-2 flex items-center justify-center overflow-hidden ${previewUrl ? 'border-blue-400' : 'border-dashed border-gray-300 bg-gray-50'}`}>
            {previewUrl ? (
              <img src={previewUrl} alt="Photo preview" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Upload Photo <span className="text-red-500">*</span></p>
              <p className="text-xs text-gray-500 mt-0.5">JPG or PNG, max 5 MB. Clear, front-facing passport-style photo required.</p>
            </div>
            <label className="inline-flex cursor-pointer">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${photoFile ? 'border-green-400 bg-green-50 text-green-700' : 'border-blue-300 bg-blue-50 text-blue-700 hover:border-blue-500'}`}>
                <Upload className="w-4 h-4 shrink-0" />
                {photoFile ? photoFile.name : 'Choose photo'}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  onPhotoChange?.(f);
                }}
              />
            </label>
            {photoFile && (
              <button
                type="button"
                onClick={() => onPhotoChange?.(null)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" /> Remove photo
              </button>
            )}
            {!photoFile && !existingPhotoUrl && (
              <p className="text-xs text-red-500">A photo is required to complete your application.</p>
            )}
          </div>
        </div>
      </div>
      {jobTypes.length > 0 && (
        <div className="space-y-2">
          <Label>Position / Job Type *</Label>
          <Select value={d.jobTypeId} onValueChange={set('jobTypeId')}>
            <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
            <SelectContent>
              {jobTypes.map(jt => <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-4">
        <SubSection title="Full Name" />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">First Name *</Label>
            <Input placeholder="First name" value={d.firstName} onChange={e => set('firstName')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Middle Name</Label>
            <Input placeholder="Middle name (optional)" value={d.middleName} onChange={e => set('middleName')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Last Name *</Label>
            <Input placeholder="Last name" value={d.lastName} onChange={e => set('lastName')(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <SubSection title="Personal Details" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Date of Birth *</Label>
            <Input type="date" value={d.dateOfBirth} onChange={e => set('dateOfBirth')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gender</Label>
            <Select value={d.gender} onValueChange={set('gender')}>
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
                <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Citizenship *</Label>
            <CountrySelect value={d.citizenship} onChange={set('citizenship')} placeholder="Select citizenship" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Country of Birth</Label>
            <CountrySelect value={d.countryOfBirth} onChange={set('countryOfBirth')} placeholder="Country of birth" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">City of Birth</Label>
            <Input placeholder="City of birth" value={d.cityOfBirth} onChange={e => set('cityOfBirth')(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <SubSection title="Home Address" />
        <AddressForm label="" value={d.homeAddress} onChange={set('homeAddress')} required />
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SubSection title="Current Address" />
          <label className="flex items-center gap-2 text-sm cursor-pointer -mt-4">
            <Checkbox
              checked={d.sameAsHomeAddress}
              onCheckedChange={c => {
                u(prev => ({
                  ...prev,
                  sameAsHomeAddress: !!c,
                  currentAddress: c ? { ...prev.homeAddress } : { ...EMPTY_ADDRESS },
                }));
              }}
            />
            Same as home
          </label>
        </div>
        {!d.sameAsHomeAddress && <AddressForm label="" value={d.currentAddress} onChange={set('currentAddress')} required />}
        {d.sameAsHomeAddress && <div className="p-3 bg-gray-50 rounded border text-sm text-gray-600">Same as home address above.</div>}
      </div>
    </div>
  );
}

function Step2Contact({ d, u, settings }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  return (
    <div className="space-y-8">
      <SectionTitle title="Contact Details" subtitle="Phone, email and emergency contact" />
      <div className="space-y-4">
        <SubSection title="Phone & Email" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Phone *</Label>
            <div className="flex gap-2">
              <Select value={d.phoneCode} onValueChange={set('phoneCode')}>
                <SelectTrigger className="w-36 shrink-0">
                  <span className="text-sm">{d.phoneCode || 'Code'}</span>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PHONE_CODES.map(c => (
                    <SelectItem key={`${c.label}-${c.code}`} value={c.code}>
                      {c.label} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Phone" value={d.phone} onChange={e => set('phone')(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email *</Label>
            <Input type="email" placeholder="email@example.com" value={d.email} onChange={e => set('email')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirm Email *</Label>
            <Input type="email" placeholder="Repeat email" value={d.emailConfirm} onChange={e => set('emailConfirm')(e.target.value)} onPaste={e => e.preventDefault()} />
            {d.emailConfirm && d.email !== d.emailConfirm && <p className="text-xs text-red-500 mt-1">Emails do not match</p>}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <SubSection title="Emergency Contact" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">First Name *</Label>
            <Input placeholder="First name" value={d.emergencyFirstName} onChange={e => set('emergencyFirstName')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Last Name *</Label>
            <Input placeholder="Last name" value={d.emergencyLastName} onChange={e => set('emergencyLastName')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Relationship *</Label>
            <Select value={d.emergencyRelation} onValueChange={set('emergencyRelation')}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {(settings.familyRelations ?? []).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone *</Label>
            <Input type="tel" placeholder="+xx xxx xxx" value={d.emergencyPhone} onChange={e => set('emergencyPhone')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" placeholder="emergency@email.com" value={d.emergencyEmail} onChange={e => set('emergencyEmail')(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3Identification({ d, u, settings }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  return (
    <div className="space-y-8">
      <SectionTitle title="Identification & Legal Status" subtitle="Passport, ID and residency documents" />
      <div className="space-y-4">
        <SubSection title="Passport" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Passport Number *</Label>
            <Input placeholder="AB123456" value={d.passportNumber} onChange={e => set('passportNumber')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Issuing Country</Label>
            <CountrySelect value={d.passportCountry} onChange={set('passportCountry')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Issue Date</Label>
            <Input type="date" value={d.passportIssueDate} onChange={e => set('passportIssueDate')(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expiry Date</Label>
            <ExpiryFields expiryDate={d.passportExpiryDate} noExpiry={d.passportNoExpiry} onExpiry={set('passportExpiryDate')} onNoExpiry={set('passportNoExpiry')} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <SubSection title="National ID Card" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have a National ID Card?</Label>
          <RadioYN name="hasIdCard" value={d.hasIdCard} onChange={set('hasIdCard')} />
        </div>
        {d.hasIdCard === 'yes' && (
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1">
              <Label className="text-xs">ID Number</Label>
              <Input placeholder="ID number" value={d.idCardNumber} onChange={e => set('idCardNumber')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <CountrySelect value={d.idCardCountry} onChange={set('idCardCountry')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.idCardExpiryDate} noExpiry={d.idCardNoExpiry} onExpiry={set('idCardExpiryDate')} onNoExpiry={set('idCardNoExpiry')} />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SubSection title="EU Visa" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have an EU Visa?</Label>
          <RadioYN name="hasEuVisa" value={d.hasEuVisa} onChange={set('hasEuVisa')} />
        </div>
        {d.hasEuVisa === 'yes' && (
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1">
              <Label className="text-xs">Visa Type</Label>
              <Select value={d.euVisaType} onValueChange={set('euVisaType')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {(settings.visaTypes ?? []).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Visa Number</Label>
              <Input placeholder="Number" value={d.euVisaNumber} onChange={e => set('euVisaNumber')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.euVisaExpiryDate} noExpiry={d.euVisaNoExpiry} onExpiry={set('euVisaExpiryDate')} onNoExpiry={set('euVisaNoExpiry')} />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SubSection title="EU Residence Permit" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have an EU Residence Permit?</Label>
          <RadioYN name="hasEuResidence" value={d.hasEuResidence} onChange={set('hasEuResidence')} />
        </div>
        {d.hasEuResidence === 'yes' && (
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1">
              <Label className="text-xs">Permit Number</Label>
              <Input placeholder="Number" value={d.euResidenceNumber} onChange={e => set('euResidenceNumber')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <CountrySelect value={d.euResidenceCountry} onChange={set('euResidenceCountry')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.euResidenceExpiryDate} noExpiry={d.euResidenceNoExpiry} onExpiry={set('euResidenceExpiryDate')} onNoExpiry={set('euResidenceNoExpiry')} />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SubSection title="Work Permit" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have a Work Permit?</Label>
          <RadioYN name="hasWorkPermit" value={d.hasWorkPermit} onChange={set('hasWorkPermit')} />
        </div>
        {d.hasWorkPermit === 'yes' && (
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1">
              <Label className="text-xs">Permit Type</Label>
              <Input placeholder="e.g. Tier 2, Blue Card" value={d.workPermitType} onChange={e => set('workPermitType')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Permit Number</Label>
              <Input placeholder="Number" value={d.workPermitNumber} onChange={e => set('workPermitNumber')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <CountrySelect value={d.workPermitCountry} onChange={set('workPermitCountry')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.workPermitExpiryDate} noExpiry={d.workPermitNoExpiry} onExpiry={set('workPermitExpiryDate')} onNoExpiry={set('workPermitNoExpiry')} />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SubSection title="Criminal Records" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have any criminal convictions?</Label>
          <RadioYN name="hasConvictions" value={d.hasConvictions} onChange={set('hasConvictions')} />
        </div>
        {d.hasConvictions === 'yes' && (
          <div className="space-y-1 mt-3">
            <Label className="text-xs">Please describe</Label>
            <Textarea rows={3} placeholder="Details..." value={d.convictionDetails} onChange={e => set('convictionDetails')(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Step4DrivingLicense({ d, u, settings }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const toggleCat = (cat: string) => {
    u(prev => ({
      ...prev,
      licenseCategories: prev.licenseCategories.includes(cat) ? prev.licenseCategories.filter(c => c !== cat) : [...prev.licenseCategories, cat],
    }));
  };
  const addQual = () => {
    u(prev => ({
      ...prev,
      qualifications: [...prev.qualifications, { id: crypto.randomUUID(), type: '', issueDate: '', expiryDate: '', noExpiry: false, country: '' }],
    }));
  };
  const updateQual = (id: string, field: keyof QualificationEntry, value: any) => {
    u(prev => ({ ...prev, qualifications: prev.qualifications.map(q => q.id === id ? { ...q, [field]: value } : q) }));
  };
  const removeQual = (id: string) => {
    u(prev => ({ ...prev, qualifications: prev.qualifications.filter(q => q.id !== id) }));
  };

  return (
    <div className="space-y-8">
      <SectionTitle title="Driving License" subtitle="Your license details, categories and qualifications" />
      <div className="space-y-3">
        <Label className="font-medium">Do you hold a driving license? *</Label>
        <div className="flex gap-6">
          {['yes', 'no'].map(v => (
            <label key={v} className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-xl cursor-pointer text-sm font-medium transition-all ${d.hasDrivingLicense === v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="hasDrivingLicense" value={v} checked={d.hasDrivingLicense === v} onChange={() => set('hasDrivingLicense')(v)} className="sr-only" />
              {v === 'yes' ? '✅ Yes' : '❌ No'}
            </label>
          ))}
        </div>
      </div>
      {d.hasDrivingLicense === 'yes' && (
        <>
          <div className="space-y-4">
            <SubSection title="License Details" />
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">License Number *</Label>
                <Input placeholder="Number" value={d.licenseNumber} onChange={e => set('licenseNumber')(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Issuing Country *</Label>
                <CountrySelect value={d.licenseCountry} onChange={set('licenseCountry')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Issue Date</Label>
                <Input type="date" value={d.licenseIssueDate} onChange={e => set('licenseIssueDate')(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiry Date</Label>
                <ExpiryFields expiryDate={d.licenseExpiryDate} noExpiry={d.licenseNoExpiry} onExpiry={set('licenseExpiryDate')} onNoExpiry={set('licenseNoExpiry')} />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <SubSection title="License Categories" />
            <div className="flex flex-wrap gap-2">
              {LICENSE_CATEGORIES.map(cat => (
                <label key={cat} className={`px-3 py-1.5 border-2 rounded-lg cursor-pointer text-sm font-medium transition-all ${d.licenseCategories.includes(cat) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Checkbox checked={d.licenseCategories.includes(cat)} onCheckedChange={() => toggleCat(cat)} className="sr-only" />
                  {cat}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <SubSection title="Professional Qualifications" />
            {d.qualifications.map((q, i) => (
              <div key={q.id} className="p-4 border-2 border-gray-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Qualification {i + 1}</span>
                  <button type="button" onClick={() => removeQual(q.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={q.type} onValueChange={v => updateQual(q.id, 'type', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(settings.drivingQualifications ?? []).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Country</Label>
                    <CountrySelect value={q.country} onChange={v => updateQual(q.id, 'country', v)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Issue Date</Label>
                    <Input type="date" value={q.issueDate} onChange={e => updateQual(q.id, 'issueDate', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expiry Date</Label>
                    <ExpiryFields expiryDate={q.expiryDate} noExpiry={q.noExpiry} onExpiry={v => updateQual(q.id, 'expiryDate', v)} onNoExpiry={v => updateQual(q.id, 'noExpiry', v)} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addQual} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50">
              <Plus className="w-4 h-4" /> Add Qualification
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Step5DrivingExperience({ d, u, settings }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const toggle = (field: 'transportTypes' | 'truckBrands' | 'selectedGpsSystems' | 'trailerTypes' | 'workRegime', value: string) => {
    u(prev => {
      const arr = prev[field] as string[];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] };
    });
  };

  return (
    <div className="space-y-8">
      <SectionTitle title="Driving Experience" subtitle="Your professional driving background" />
      <div className="space-y-3">
        <SubSection title="Experience Type" />
        <div className="grid md:grid-cols-3 gap-3">
          {[{ v: 'eu', l: 'EU / International' }, { v: 'domestic', l: 'Domestic' }, { v: 'both', l: 'Both' }].map(({ v, l }) => (
            <label key={v} className={`flex items-center gap-2 p-4 border-2 rounded-xl cursor-pointer text-sm font-medium transition-all ${d.drivingExpType === v ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="drivingExpType" value={v} checked={d.drivingExpType === v} onChange={() => set('drivingExpType')(v)} className="w-4 h-4 accent-blue-600" />
              {l}
            </label>
          ))}
        </div>
      </div>
      {(d.drivingExpType === 'eu' || d.drivingExpType === 'both') && (
        <div className="space-y-4">
          <SubSection title="EU Experience" />
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Years</Label>
              <Input type="number" min="0" placeholder="Years" value={d.euExpYears} onChange={e => set('euExpYears')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total KM</Label>
              <Input placeholder="e.g. 500000" value={d.euExpKm} onChange={e => set('euExpKm')(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Countries</Label>
              <Textarea rows={2} placeholder="Germany, France, Netherlands..." value={d.euExpCountries} onChange={e => set('euExpCountries')(e.target.value)} />
            </div>
          </div>
        </div>
      )}
      {(d.drivingExpType === 'domestic' || d.drivingExpType === 'both') && (
        <div className="space-y-4">
          <SubSection title="Domestic Experience" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Years</Label>
              <Input type="number" min="0" placeholder="Years" value={d.domesticExpYears} onChange={e => set('domesticExpYears')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Regions</Label>
              <Input placeholder="Regions driven" value={d.domesticExpRegions} onChange={e => set('domesticExpRegions')(e.target.value)} />
            </div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        <SubSection title="Transport Types" />
        <div className="grid grid-cols-2 gap-2">
          {['International', 'Domestic', 'Bilateral', 'Cabotage', 'Hazardous', 'Refrigerated'].map(t => (
            <label key={t} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer text-sm transition-all ${d.transportTypes.includes(t) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Checkbox checked={d.transportTypes.includes(t)} onCheckedChange={() => toggle('transportTypes', t)} />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SubSection title="Truck Brands" />
        <div className="flex flex-wrap gap-2">
          {TRUCK_BRANDS.map(b => (
            <label key={b} className={`px-3 py-1.5 border-2 rounded-lg cursor-pointer text-sm transition-all ${d.truckBrands.includes(b) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Checkbox checked={d.truckBrands.includes(b)} onCheckedChange={() => toggle('truckBrands', b)} className="sr-only" />
              {b}
            </label>
          ))}
        </div>
        <Input placeholder="Other brands" value={d.otherBrand} onChange={e => set('otherBrand')(e.target.value)} />
      </div>
      <div className="space-y-3">
        <SubSection title="Gearbox Type" />
        <div className="flex gap-3">
          {['Manual', 'Automatic', 'Both'].map(g => (
            <label key={g} className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer text-sm font-medium transition-all ${d.gearboxType === g ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="gearboxType" value={g} checked={d.gearboxType === g} onChange={() => set('gearboxType')(g)} className="w-4 h-4 accent-blue-600" />
              {g}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SubSection title="GPS Systems" />
        <div className="flex flex-wrap gap-2">
          {(settings.gpsSystemTypes ?? []).map(g => (
            <label key={g} className={`px-3 py-1.5 border-2 rounded-lg cursor-pointer text-sm transition-all ${d.selectedGpsSystems.includes(g) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Checkbox checked={d.selectedGpsSystems.includes(g)} onCheckedChange={() => toggle('selectedGpsSystems', g)} className="sr-only" />
              {g}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SubSection title="Trailer Types" />
        <div className="grid grid-cols-2 gap-2">
          {['Curtain Sider', 'Reefer', 'Tanker', 'Container', 'Walking Floor', 'Lowdeck', 'Mega', 'Swap Body'].map(t => (
            <label key={t} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer text-sm transition-all ${d.trailerTypes.includes(t) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Checkbox checked={d.trailerTypes.includes(t)} onCheckedChange={() => toggle('trailerTypes', t)} />
              {t}
            </label>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-2">
          <Input placeholder="Most used trailer" value={d.mostUsedTrailer} onChange={e => set('mostUsedTrailer')(e.target.value)} />
        </div>
      </div>
      <div className="space-y-4">
        <SubSection title="Work Preferences" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Work Regime</Label>
            <div className="flex gap-4">
              {['Weekend Driving', 'Night Driving'].map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={r === 'Weekend Driving' ? d.weekendDriving : d.nightDriving}
                    onCheckedChange={c => set(r === 'Weekend Driving' ? 'weekendDriving' : 'nightDriving')(!!c)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Traffic Accidents (last 3 years)?</Label>
            <RadioYN name="trafficAccidents" value={d.trafficAccidents} onChange={set('trafficAccidents')} />
          </div>
          {d.trafficAccidents === 'yes' && (
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Please describe</Label>
              <Textarea rows={2} placeholder="Details..." value={d.accidentDescription} onChange={e => set('accidentDescription')(e.target.value)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step6Education({ d, u, settings }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings }) {
  const addEntry = () => {
    u(prev => ({
      ...prev,
      education: [...prev.education, { id: crypto.randomUUID(), level: '', institution: '', fieldOfStudy: '', country: '', startDate: '', endDate: '', ongoing: false, degree: '' }],
    }));
  };
  const updateEntry = (id: string, field: keyof EducationEntry, value: any) => {
    u(prev => ({ ...prev, education: prev.education.map(e => e.id === id ? { ...e, [field]: value } : e) }));
  };
  const removeEntry = (id: string) => {
    u(prev => ({ ...prev, education: prev.education.filter(e => e.id !== id) }));
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Education" subtitle="Your educational background" />
      {d.education.map((entry, i) => (
        <div key={entry.id} className="p-5 border-2 border-gray-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Entry {i + 1}</span>
            <button type="button" onClick={() => removeEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Level</Label>
              <Select value={entry.level} onValueChange={v => updateEntry(entry.id, 'level', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {(settings.educationLevels ?? []).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Institution</Label>
              <Input placeholder="School / University" value={entry.institution} onChange={e => updateEntry(entry.id, 'institution', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Field of Study</Label>
              <Input placeholder="Field" value={entry.fieldOfStudy} onChange={e => updateEntry(entry.id, 'fieldOfStudy', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <CountrySelect value={entry.country} onChange={v => updateEntry(entry.id, 'country', v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={entry.startDate} onChange={e => updateEntry(entry.id, 'startDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={entry.ongoing ? '' : entry.endDate} onChange={e => updateEntry(entry.id, 'endDate', e.target.value)} disabled={entry.ongoing} className="flex-1" />
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                  <Checkbox checked={entry.ongoing} onCheckedChange={c => updateEntry(entry.id, 'ongoing', !!c)} />
                  Ongoing
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Degree / Certificate</Label>
              <Input placeholder="Qualification" value={entry.degree} onChange={e => updateEntry(entry.id, 'degree', e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      {d.education.length === 0 && <p className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">No entries yet.</p>}
      <button type="button" onClick={addEntry} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50">
        <Plus className="w-4 h-4" /> Add Education
      </button>
    </div>
  );
}

function Step7WorkHistory({ d, u }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void }) {
  const addEntry = () => {
    u(prev => ({
      ...prev,
      workHistory: [...prev.workHistory, { id: crypto.randomUUID(), company: '', jobTitle: '', country: '', startDate: '', endDate: '', current: false, responsibilities: '', references: '' }],
    }));
  };
  const updateEntry = (id: string, field: keyof WorkHistoryEntry, value: any) => {
    u(prev => ({ ...prev, workHistory: prev.workHistory.map(e => e.id === id ? { ...e, [field]: value } : e) }));
  };
  const removeEntry = (id: string) => {
    u(prev => ({ ...prev, workHistory: prev.workHistory.filter(e => e.id !== id) }));
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Work Experience" subtitle="Your employment history" />
      {d.workHistory.map((entry, i) => (
        <div key={entry.id} className="p-5 border-2 border-gray-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Position {i + 1}</span>
            <button type="button" onClick={() => removeEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Company</Label>
              <Input placeholder="Company" value={entry.company} onChange={e => updateEntry(entry.id, 'company', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Job Title</Label>
              <Input placeholder="Title" value={entry.jobTitle} onChange={e => updateEntry(entry.id, 'jobTitle', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <CountrySelect value={entry.country} onChange={v => updateEntry(entry.id, 'country', v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={entry.startDate} onChange={e => updateEntry(entry.id, 'startDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={entry.current ? '' : entry.endDate} onChange={e => updateEntry(entry.id, 'endDate', e.target.value)} disabled={entry.current} className="flex-1" />
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                  <Checkbox checked={entry.current} onCheckedChange={c => updateEntry(entry.id, 'current', !!c)} />
                  Current
                </label>
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Responsibilities</Label>
              <Textarea rows={2} placeholder="Main duties..." value={entry.responsibilities} onChange={e => updateEntry(entry.id, 'responsibilities', e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Reference Contact</Label>
              <Input placeholder="Name & phone (optional)" value={entry.references} onChange={e => updateEntry(entry.id, 'references', e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      {d.workHistory.length === 0 && <p className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">No entries yet.</p>}
      <button type="button" onClick={addEntry} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50">
        <Plus className="w-4 h-4" /> Add Work Experience
      </button>
    </div>
  );
}

function Step8Skills({ d, u }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const toggleSkill = (field: 'computerSkills' | 'softSkills', value: string) => {
    u(prev => {
      const arr = prev[field] as string[];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] };
    });
  };
  const addLang = () => {
    u(prev => ({
      ...prev,
      languages: [...prev.languages, { id: crypto.randomUUID(), language: '', proficiency: '', hasCertificate: false, certificate: '' }],
    }));
  };
  const updateLang = (id: string, field: keyof LanguageEntry, value: any) => {
    u(prev => ({ ...prev, languages: prev.languages.map(l => l.id === id ? { ...l, [field]: value } : l) }));
  };
  const removeLang = (id: string) => {
    u(prev => ({ ...prev, languages: prev.languages.filter(l => l.id !== id) }));
  };

  return (
    <div className="space-y-8">
      <SectionTitle title="Skills & Qualifications" subtitle="Languages, computer skills and certifications" />
      <div className="space-y-4">
        <SubSection title="Languages" />
        {d.languages.map((lang, i) => (
          <div key={lang.id} className="p-4 border-2 border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Language {i + 1}</span>
              <button type="button" onClick={() => removeLang(lang.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Language</Label>
                <Input placeholder="e.g. English" value={lang.language} onChange={e => updateLang(lang.id, 'language', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Proficiency</Label>
                <Select value={lang.proficiency} onValueChange={v => updateLang(lang.id, 'proficiency', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {PROFICIENCY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Checkbox checked={lang.hasCertificate} onCheckedChange={c => updateLang(lang.id, 'hasCertificate', !!c)} />
                <Label className="text-xs cursor-pointer">Has Certificate</Label>
              </div>
              {lang.hasCertificate && (
                <div className="space-y-1">
                  <Label className="text-xs">Certificate</Label>
                  <Input placeholder="e.g. IELTS 7.5" value={lang.certificate} onChange={e => updateLang(lang.id, 'certificate', e.target.value)} />
                </div>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={addLang} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50">
          <Plus className="w-4 h-4" /> Add Language
        </button>
      </div>
      <div className="space-y-3">
        <SubSection title="Computer Skills" />
        <div className="flex flex-wrap gap-2">
          {COMPUTER_SKILLS.map(s => (
            <label key={s} className={`px-3 py-1.5 border-2 rounded-lg cursor-pointer text-sm transition-all ${d.computerSkills.includes(s) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Checkbox checked={d.computerSkills.includes(s)} onCheckedChange={() => toggleSkill('computerSkills', s)} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SubSection title="First Aid Certificate" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have a First Aid Certificate?</Label>
          <RadioYN name="hasFirstAid" value={d.hasFirstAid} onChange={set('hasFirstAid')} />
        </div>
        {d.hasFirstAid === 'yes' && (
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Expiry Date</Label>
            <ExpiryFields expiryDate={d.firstAidExpiry} noExpiry={d.firstAidNoExpiry} onExpiry={set('firstAidExpiry')} onNoExpiry={set('firstAidNoExpiry')} />
          </div>
        )}
      </div>
      <div className="space-y-3">
        <SubSection title="Soft Skills" />
        <div className="flex flex-wrap gap-2">
          {SOFT_SKILLS.map(s => (
            <label key={s} className={`px-3 py-1.5 border-2 rounded-lg cursor-pointer text-sm transition-all ${d.softSkills.includes(s) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Checkbox checked={d.softSkills.includes(s)} onCheckedChange={() => toggleSkill('softSkills', s)} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <SubSection title="Tools & Equipment" />
        <Textarea rows={3} placeholder="List tools you're proficient with..." value={d.toolsDescription} onChange={e => set('toolsDescription')(e.target.value)} />
      </div>
    </div>
  );
}

function Step9Additional({ d, u, settings }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  return (
    <div className="space-y-8">
      <SectionTitle title="Additional Information" subtitle="Availability, preferences and more" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <Label className="text-xs">Preferred Start Date *</Label>
          <Input type="date" value={d.preferredStartDate} onChange={e => set('preferredStartDate')(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Availability</Label>
          <Select value={d.availability} onValueChange={set('availability')}>
            <SelectTrigger><SelectValue placeholder="When can you start?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Immediate">Immediately</SelectItem>
              <SelectItem value="1 Week">Within 1 week</SelectItem>
              <SelectItem value="2 Weeks">Within 2 weeks</SelectItem>
              <SelectItem value="1 Month">Within 1 month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">How did you hear about us? *</Label>
          <Select value={d.howDidYouHear} onValueChange={set('howDidYouHear')}>
            <SelectTrigger><SelectValue placeholder="Select option" /></SelectTrigger>
            <SelectContent>
              {(settings.howDidYouHear ?? []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Salary Expectation</Label>
          <Input placeholder="e.g. £35,000" value={d.salaryExpectation} onChange={e => set('salaryExpectation')(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={d.willingToRelocate} onCheckedChange={c => set('willingToRelocate')(!!c)} />
            <span className="text-sm font-medium">Willing to relocate</span>
          </label>
        </div>
        {d.willingToRelocate && (
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Preferred Locations</Label>
            <Input placeholder="Cities / countries" value={d.preferredLocations} onChange={e => set('preferredLocations')(e.target.value)} />
          </div>
        )}
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Additional Notes</Label>
          <Textarea rows={4} placeholder="Anything else you'd like us to know..." value={d.additionalNotes} onChange={e => set('additionalNotes')(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function Step10Documents({ uploadedFiles, onFilesChange }: { uploadedFiles: UploadedFileItem[]; onFilesChange: (files: UploadedFileItem[]) => void }) {
  const DOC_TYPES = ['Passport', "Driver's License", 'Tachograph Card', 'C95 / CPC Card', 'ADR Certificate', 'Visa', 'Work Permit', 'Residence Card', 'Medical Certificate', 'First Aid Certificate', 'Other'];
  const addDoc = () => {
    onFilesChange([...uploadedFiles, { id: crypto.randomUUID(), type: '', file: null }]);
  };
  const updateItem = (id: string, patch: Partial<UploadedFileItem>) => {
    onFilesChange(uploadedFiles.map(f => f.id === id ? { ...f, ...patch } : f));
  };
  const removeItem = (id: string) => {
    onFilesChange(uploadedFiles.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Document Uploads" subtitle="Upload supporting documents (PDF, JPG, PNG — max 5MB)" />
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        Upload clear scans of your passport, license, and qualifications.
      </div>
      {uploadedFiles.map((item, i) => (
        <div key={item.id} className="p-4 border-2 border-dashed border-gray-300 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Document Type *</Label>
              <Select value={item.type} onValueChange={type => updateItem(item.id, { type })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <button type="button" onClick={() => removeItem(item.id)} className="mt-5 p-1.5 text-gray-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          <label className="block cursor-pointer">
            <div className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${item.file ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'}`}>
              {item.file ? (
                <><Check className="w-4 h-4 text-green-600 shrink-0" /><span className="truncate">{item.file.name}</span><span className="ml-auto text-xs">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span></>
              ) : (
                <><Upload className="w-4 h-4" /><span>Choose file</span></>
              )}
            </div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => updateItem(item.id, { file: e.target.files?.[0] ?? null })} />
          </label>
        </div>
      ))}
      {uploadedFiles.length === 0 && <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">No documents yet.</p>}
      <button type="button" onClick={addDoc} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50">
        <Plus className="w-4 h-4" /> Add Document
      </button>
    </div>
  );
}

function Step11Review({ d, u, settings, photoFile, existingPhotoUrl }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings; photoFile?: File | null; existingPhotoUrl?: string }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const previewUrl = photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl ?? null;
  const rows: { label: string; value: string | undefined }[] = [
    { label: 'Name', value: [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ') },
    { label: 'Email', value: d.email },
    { label: 'Phone', value: d.phone ? `${d.phoneCode} ${d.phone}` : undefined },
    { label: 'Passport', value: d.passportNumber },
    { label: 'Driving License', value: d.hasDrivingLicense === 'yes' ? 'Yes' : 'No' },
    { label: 'Preferred Start Date', value: d.preferredStartDate },
  ];

  return (
    <div className="space-y-8">
      <SectionTitle title="Review Your Application" subtitle="Please review all details before submitting" />

      {/* Photo preview in review */}
      {previewUrl && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
          <img src={previewUrl} alt="Applicant photo" className="w-16 h-16 rounded-full object-cover border-2 border-blue-200" />
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Applicant Photo</p>
            <p className="text-sm font-semibold text-green-700 mt-0.5">✓ Photo uploaded</p>
          </div>
        </div>
      )}
      {!previewUrl && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">⚠ No photo uploaded — please go back to Tab 1 and upload a photo (required).</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {rows.filter(r => r.value).map(({ label, value }) => (
          <div key={label} className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 font-medium uppercase">{label}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>
      {d.education.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 font-medium uppercase mb-1">Education</p>
          {d.education.map(e => <p key={e.id} className="text-sm text-gray-800">{e.level} — {e.institution}</p>)}
        </div>
      )}
      <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
        <h4 className="text-sm font-semibold text-amber-900">Declaration</h4>
        <p className="text-sm text-amber-800 leading-relaxed">{settings.declarationText}</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={d.declarationAccepted} onCheckedChange={c => set('declarationAccepted')(!!c)} className="mt-0.5" />
          <span className="text-sm font-medium text-amber-900">I confirm that the information provided is true and accurate. *</span>
        </label>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface ApplicantFormStepsProps {
  currentStep: number;
  visibleTabs: number[];
  formData: ApplicantFormData;
  onChange: (updater: (prev: ApplicantFormData) => ApplicantFormData) => void;
  jobTypes?: JobType[];
  uploadedFiles?: UploadedFileItem[];
  onFilesChange?: (files: UploadedFileItem[]) => void;
  settings?: FormSettings;
  photoFile?: File | null;
  onPhotoChange?: (file: File | null) => void;
  existingPhotoUrl?: string;
}

export function ApplicantFormSteps({
  currentStep,
  visibleTabs,
  formData: d,
  onChange: u,
  jobTypes = [],
  uploadedFiles = [],
  onFilesChange = () => {},
  settings = DEFAULT_FORM_SETTINGS,
  photoFile = null,
  onPhotoChange = () => {},
  existingPhotoUrl,
}: ApplicantFormStepsProps) {
  const actualTab = visibleTabs[currentStep - 1] ?? 1;

  return (
    <>
      {actualTab === 1 && <Step1Personal d={d} u={u} jobTypes={jobTypes} photoFile={photoFile} onPhotoChange={onPhotoChange} existingPhotoUrl={existingPhotoUrl} />}
      {actualTab === 2 && <Step2Contact d={d} u={u} settings={settings} />}
      {actualTab === 3 && <Step3Identification d={d} u={u} settings={settings} />}
      {actualTab === 4 && <Step4DrivingLicense d={d} u={u} settings={settings} />}
      {actualTab === 5 && <Step5DrivingExperience d={d} u={u} settings={settings} />}
      {actualTab === 6 && <Step6Education d={d} u={u} settings={settings} />}
      {actualTab === 7 && <Step7WorkHistory d={d} u={u} />}
      {actualTab === 8 && <Step8Skills d={d} u={u} />}
      {actualTab === 9 && <Step9Additional d={d} u={u} settings={settings} />}
      {actualTab === 10 && <Step10Documents uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />}
      {actualTab === 11 && <Step11Review d={d} u={u} settings={settings} photoFile={photoFile} existingPhotoUrl={existingPhotoUrl} />}
    </>
  );
}
