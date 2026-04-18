import { useState, useEffect, type ReactNode } from 'react';
import { settingsApi } from '../../services/api';
import { User, Phone, Shield, CreditCard, Briefcase, GraduationCap, Star, Info, FileText, CheckCircle2, Check, Upload, Plus, X, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { AddressForm, AddressData, EMPTY_ADDRESS } from '../ui/AddressForm';
import { CountrySelect } from '../ui/CountrySelect';
import { EU_COUNTRIES } from '../../data/countries';
import { PHONE_CODES } from '../../data/phoneCodes';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UploadedFileItem {
  id: string;
  type: string;
  file: File | null;
  sectionKey?: string;
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
  companyStreet: string;
  companyCity: string;
  companyPostalCode: string;
  country: string;
  companyPhoneCode: string;
  companyPhone: string;
  startDate: string;
  endDate: string;
  current: boolean;
  responsibilities: string;
  reasonForLeaving: string;
  referenceName: string;
  referencePhoneCode: string;
  referencePhone: string;
  referenceEmail: string;
}

export interface SkillEntry {
  id: string;
  skill: string;
  level: string;
  isCustom?: boolean;
}

export interface LanguageEntry {
  id: string;
  language: string;
  motherTongue: boolean;
  speakingLevel: string;
  readingLevel: string;
  writingLevel: string;
  listeningLevel: string;
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
  skills: string[];
  transportTypes: string[];
  truckBrands: string[];
  trailerTypes: string[];
}

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  visaTypes: ['Tourist', 'Business', 'Work', 'Student', 'Transit', 'Family Reunification', 'Schengen', 'Long-stay', 'Other'],
  familyRelations: ['Spouse', 'Partner', 'Parent', 'Child', 'Sibling', 'Friend', 'Colleague', 'Other'],
  drivingQualifications: ['Tachograph Card', 'C95 / CPC Card', 'ADR Certificate', 'Medical Certificate', 'DVLA Check', 'Transport Manager CPC'],
  gpsSystemTypes: ['TomTom', 'Garmin', 'Webfleet', 'Sygic', 'HERE', 'Google Maps', 'Other'],
  howDidYouHear: ['Facebook', 'LinkedIn', 'Job Portal', 'Friend / Referral', 'Recruitment Agency', 'Google Search', 'Company Website', 'Other'],
  transportTypes: ['International', 'Domestic', 'Bilateral', 'Cabotage', 'Hazardous', 'Refrigerated'],
  truckBrands: ['Volvo', 'Scania', 'DAF', 'MAN', 'Mercedes-Benz', 'Iveco'],
  trailerTypes: ['Curtain Sider', 'Reefer', 'Tanker', 'Container', 'Walking Floor', 'Lowdeck', 'Mega', 'Swap Body'],
  educationLevels: ["Primary School", "Secondary School", "High School / A-Levels", "Vocational Training", "Associate Degree", "Bachelor's Degree", "Master's Degree", "Doctoral Degree", "Professional Certification", "Other"],
  declarationText: 'I declare that the information provided in this application is true, complete and accurate to the best of my knowledge. I understand that providing false or misleading information may result in my application being rejected or employment being terminated.',
  skills: ['Microsoft Office', 'Email', 'GPS / Navigation', 'Transport Management Software', 'Tachograph Software', 'Teamwork', 'Communication', 'Time Management', 'Problem Solving', 'Customer Service', 'Self-motivated', 'Adaptability'],
};

export interface ApplicantFormData {
  jobTypeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  citizenship: string;
  otherCitizenships: string[];
  countryOfBirth: string;
  cityOfBirth: string;
  homeAddress: AddressData;
  currentAddress: AddressData;
  sameAsHomeAddress: boolean;
  phoneCode: string;
  phone: string;
  phoneIsWhatsApp: boolean;
  whatsappCode: string;
  whatsapp: string;
  email: string;
  emailConfirm: string;
  emergencyFirstName: string;
  emergencyLastName: string;
  emergencyRelation: string;
  emergencyPhoneCode: string;
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
  euVisaCountry: string;
  euVisaNumber: string;
  euVisaExpiryDate: string;
  euVisaNoExpiry: boolean;
  hasEuResidence: string;
  euResidenceType: string;
  euResidenceNumber: string;
  euResidenceIssueDate: string;
  euResidenceExpiryDate: string;
  euResidenceNoExpiry: boolean;
  euResidenceCountry: string;
  euResidenceCity: string;
  hasWorkPermit: string;
  workPermitType: string;
  workPermitNumber: string;
  workPermitIssueDate: string;
  workPermitExpiryDate: string;
  workPermitNoExpiry: boolean;
  workPermitCountry: string;
  hasHomeCriminalRecord: string;
  homeCriminalRecordDate: string;
  homeCriminalRecordCountry: string;
  hasEuCriminalRecord: string;
  euCriminalRecordDate: string;
  euCriminalRecordCountry: string;
  purposeOfIssue: string;
  hasDrivingLicense: string;
  licenseNumber: string;
  licenseFirstIssueDate: string;
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
  domesticExpKm: string;
  domesticExpCountry: string;
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
  skills: SkillEntry[];
  hasFirstAid: string;
  firstAidExpiry: string;
  firstAidNoExpiry: boolean;
  toolsDescription: string;
  preferredStartDate: string;
  howDidYouHear: string;
  availability: string;
  willingToRelocate: boolean;
  preferredLocations: string;
  salaryExpectation: string;
  additionalNotes: string;
  declarationAccepted: boolean;
  agreeDataProcessing: boolean;
  agreeBackground: boolean;
  agreeDataSharing: boolean;
  livedAbroadRecently: string;
  abroadCountry: string;
  abroadAddress: AddressData;
  abroadDateFrom: string;
  abroadDateTo: string;
}

export const EMPTY_FORM: ApplicantFormData = {
  jobTypeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  citizenship: '',
  otherCitizenships: [],
  countryOfBirth: '',
  cityOfBirth: '',
  homeAddress: { ...EMPTY_ADDRESS },
  currentAddress: { ...EMPTY_ADDRESS },
  sameAsHomeAddress: false,
  // Phone country codes start empty so the dropdown shows a 'Code'
  // prompt — same convention as every other phone field on the site.
  phoneCode: '',
  phone: '',
  phoneIsWhatsApp: false,
  whatsappCode: '',
  whatsapp: '',
  email: '',
  emailConfirm: '',
  emergencyFirstName: '',
  emergencyLastName: '',
  emergencyRelation: '',
  emergencyPhoneCode: '',
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
  euVisaCountry: '',
  euVisaNumber: '',
  euVisaExpiryDate: '',
  euVisaNoExpiry: false,
  hasEuResidence: '',
  euResidenceType: '',
  euResidenceNumber: '',
  euResidenceIssueDate: '',
  euResidenceExpiryDate: '',
  euResidenceNoExpiry: false,
  euResidenceCountry: '',
  euResidenceCity: '',
  hasWorkPermit: '',
  workPermitType: '',
  workPermitNumber: '',
  workPermitIssueDate: '',
  workPermitExpiryDate: '',
  workPermitNoExpiry: false,
  workPermitCountry: '',
  hasHomeCriminalRecord: '',
  homeCriminalRecordDate: '',
  homeCriminalRecordCountry: '',
  hasEuCriminalRecord: '',
  euCriminalRecordDate: '',
  euCriminalRecordCountry: '',
  purposeOfIssue: '',
  hasDrivingLicense: '',
  licenseNumber: '',
  licenseFirstIssueDate: '',
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
  domesticExpKm: '',
  domesticExpCountry: '',
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
  skills: [],
  hasFirstAid: '',
  firstAidExpiry: '',
  firstAidNoExpiry: false,
  toolsDescription: '',
  preferredStartDate: '',
  howDidYouHear: '',
  availability: '',
  willingToRelocate: false,
  preferredLocations: '',
  salaryExpectation: '',
  additionalNotes: '',
  declarationAccepted: false,
  agreeDataProcessing: false,
  agreeBackground: false,
  agreeDataSharing: false,
  livedAbroadRecently: '',
  abroadCountry: '',
  abroadAddress: { ...EMPTY_ADDRESS },
  abroadDateFrom: '',
  abroadDateTo: '',
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

/** Returns validation error messages for the current step before allowing navigation to the next step. */
export function getStepErrors(
  actualTab: number,
  d: ApplicantFormData,
  uploadedFiles: UploadedFileItem[],
  photoFile: File | null,
  requiredDocuments?: string[],
): string[] {
  const errors: string[] = [];
  const hasFile = (key: string) => uploadedFiles.some(f => f.sectionKey === key && f.file);
  const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ── Tab 1: Personal ───────────────────────────────────────────────────────
  if (actualTab === 1) {
    if (!d.jobTypeId) errors.push('Please select a Job Category before proceeding.');
    if (!photoFile) errors.push('A profile photo is required before proceeding.');
    if (!d.firstName?.trim()) errors.push('First Name is required.');
    if (!d.lastName?.trim()) errors.push('Last Name is required.');
    if (!d.dateOfBirth) errors.push('Date of Birth is required.');
    if (!d.citizenship) errors.push('Citizenship is required.');
    if (!d.homeAddress?.line1?.trim()) errors.push('Home Address: Street / Address Line 1 is required.');
    if (!d.homeAddress?.city?.trim()) errors.push('Home Address: City is required.');
    if (!d.homeAddress?.country?.trim()) errors.push('Home Address: Country is required.');
    if (!d.livedAbroadRecently) errors.push('Please answer whether you have lived abroad in the past 12 months.');
    if (d.livedAbroadRecently === 'yes') {
      if (!d.abroadCountry) errors.push('Country of previous residence is required.');
      if (!d.abroadDateFrom) errors.push('Date From (abroad period) is required.');
      if (!d.abroadDateTo) errors.push('Date To (abroad period) is required.');
    }
  }

  // ── Tab 2: Contact ────────────────────────────────────────────────────────
  if (actualTab === 2) {
    if (!d.phone?.trim()) errors.push('Phone number is required.');
    if (!d.email?.trim()) errors.push('Email address is required.');
    else if (!validEmail(d.email)) errors.push('Please enter a valid email address.');
    if (!d.emailConfirm?.trim()) errors.push('Please confirm your email address.');
    else if (d.email !== d.emailConfirm) errors.push('Email addresses do not match.');
    if (!d.phoneIsWhatsApp && !d.whatsapp?.trim())
      errors.push('WhatsApp number is required (or tick "This phone number is also my WhatsApp number").');
    if (!d.emergencyFirstName?.trim()) errors.push('Emergency contact First Name is required.');
    if (!d.emergencyLastName?.trim()) errors.push('Emergency contact Last Name is required.');
    if (!d.emergencyRelation) errors.push('Emergency contact Relationship is required.');
    if (!d.emergencyPhone?.trim()) errors.push('Emergency contact Phone is required.');
  }

  // ── Tab 3: Identification & Legal Status ──────────────────────────────────
  if (actualTab === 3) {
    if (!d.passportNumber?.trim()) errors.push('Passport Number is required.');
    // Job-ad required uploads handled on this tab (upload widgets are here)
    const passportDocName = requiredDocuments?.find(n => n.toLowerCase() === 'passport');
    if (passportDocName && !hasFile(`required:${passportDocName}`))
      errors.push('This position requires a Passport upload — please upload your passport before continuing.');
    const nationalIdDocName = requiredDocuments?.find(n => n.toLowerCase().includes('national id'));
    if (nationalIdDocName && !hasFile(`required:${nationalIdDocName}`))
      errors.push('This position requires a National ID Card upload — please upload it before continuing.');
    if (!d.hasIdCard) errors.push('Please answer whether you have a National ID Card.');
    if (!d.hasEuVisa) errors.push('Please answer whether you have an EU Visa.');
    if (!d.hasEuResidence) errors.push('Please answer whether you have an EU Residence Permit.');
    if (!d.hasWorkPermit) errors.push('Please answer whether you have a Work Permit.');
    if (!d.hasHomeCriminalRecord) errors.push('Please answer whether you have a Home Country Criminal Record.');
    if (!d.hasEuCriminalRecord) errors.push('Please answer whether you have an EU Country Criminal Record.');
    // Only check regular 'idCard' slot when National ID Card is not a job-ad required doc
    // (when required, the 'required:...' check above already covers it)
    if (!nationalIdDocName && d.hasIdCard === 'yes' && !hasFile('idCard'))
      errors.push('You indicated you have a National ID Card — please upload it.');
    if (d.hasEuVisa === 'yes' && !hasFile('euVisa'))
      errors.push('You indicated you have an EU Visa — please upload it.');
    if (d.hasEuResidence === 'yes' && !hasFile('euResidence'))
      errors.push('You indicated you have an EU Residence Permit — please upload it.');
    if (d.hasWorkPermit === 'yes' && !hasFile('workPermit'))
      errors.push('You indicated you have a Work Permit — please upload it.');
    if (d.hasHomeCriminalRecord === 'yes' && !hasFile('homeCriminalRecord'))
      errors.push('You indicated you have a Home Country Criminal Record — please upload it.');
    if (d.hasEuCriminalRecord === 'yes' && !hasFile('euCriminalRecord'))
      errors.push('You indicated you have an EU Criminal Record — please upload it.');
  }

  // ── Tab 4: Driving License ────────────────────────────────────────────────
  if (actualTab === 4) {
    if (!d.hasDrivingLicense) errors.push('Please answer whether you hold a driving license.');
    const dlDocName = requiredDocuments?.find(n => n.toLowerCase().includes('driving'));
    if (dlDocName && !hasFile(`required:${dlDocName}`))
      errors.push('This position requires a Driving License upload — please upload it before continuing.');
    if (d.hasDrivingLicense === 'yes') {
      if (!d.licenseNumber?.trim()) errors.push('License Number is required.');
      if (!d.licenseCountry) errors.push('License Issuing Country is required.');
      if (!d.licenseCategories || d.licenseCategories.length === 0)
        errors.push('Please select at least one License Category.');
      // Only check regular 'drivingLicense' slot when not a job-ad required doc
      if (!dlDocName && !hasFile('drivingLicense'))
        errors.push('You indicated you have a Driving License — please upload it.');
    }
  }

  // ── Tab 5: Driving Experience (only visible when hasDrivingLicense = yes) ─
  if (actualTab === 5) {
    if (!d.trafficAccidents)
      errors.push('Please answer whether you have been involved in any traffic accidents in the past 3 years.');
  }

  // ── Tab 7: Work Experience ────────────────────────────────────────────────
  if (actualTab === 7) {
    d.workHistory.forEach((entry, i) => {
      const n = i + 1;
      if (!entry.companyStreet?.trim()) errors.push(`Work Experience #${n}: Company Street Address is required.`);
      if (!entry.companyCity?.trim()) errors.push(`Work Experience #${n}: City is required.`);
      if (!entry.companyPostalCode?.trim()) errors.push(`Work Experience #${n}: Postal Code is required.`);
      if (!entry.country?.trim()) errors.push(`Work Experience #${n}: Country is required.`);
      if (!entry.companyPhone?.trim()) errors.push(`Work Experience #${n}: Company Phone is required.`);
    });
  }

  // ── Tab 8: Skills ─────────────────────────────────────────────────────────
  if (actualTab === 8) {
    if (!d.hasFirstAid) errors.push('Please answer whether you have a First Aid Certificate.');
    if (d.hasFirstAid === 'yes' && !hasFile('firstAid'))
      errors.push('You indicated you have a First Aid Certificate — please upload it.');
  }

  // ── Tab 9: Additional ─────────────────────────────────────────────────────
  if (actualTab === 9) {
    if (!d.preferredStartDate) errors.push('Preferred Start Date is required.');
    if (!d.howDidYouHear) errors.push('Please select how you heard about us.');
  }

  // ── Tab 10: Documents ─────────────────────────────────────────────────────
  if (actualTab === 10 && requiredDocuments && requiredDocuments.length > 0) {
    for (const docName of requiredDocuments) {
      if (!uploadedFiles.some(f => f.sectionKey === `required:${docName}` && f.file))
        errors.push(`"${docName}" is required for this position — please upload it before continuing.`);
    }
  }

  return errors;
}

const LICENSE_CATEGORIES = ['AM', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'T'];


const PROFICIENCY_LEVELS = ['A1 - Beginner', 'A2 - Elementary', 'B1 - Intermediate', 'B2 - Upper Intermediate', 'C1 - Advanced', 'C2 - Mastery', 'Native'];

const LANGUAGES = ['Albanian', 'Arabic', 'Bosnian', 'Bulgarian', 'Chinese (Cantonese)', 'Chinese (Mandarin)', 'Croatian', 'Czech', 'Danish', 'Dutch', 'English', 'Estonian', 'Finnish', 'French', 'German', 'Greek', 'Hungarian', 'Italian', 'Latvian', 'Lithuanian', 'Macedonian', 'Maltese', 'Norwegian', 'Persian', 'Polish', 'Portuguese', 'Romanian', 'Russian', 'Serbian', 'Slovak', 'Slovenian', 'Spanish', 'Swedish', 'Turkish', 'Ukrainian', 'Urdu', 'Other'];

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

// ── Step Indicator ────────────────────────────────────────────────────────────

export function StepIndicator({ currentStep, visibleTabs, onStepClick }: { currentStep: number; visibleTabs: number[]; onStepClick?: (step: number) => void }) {
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
            <button
              key={tabId}
              type="button"
              onClick={() => onStepClick?.(visIdx)}
              className={`flex flex-col items-center gap-1 flex-1 min-w-0 ${onStepClick ? 'cursor-pointer group' : 'cursor-default'}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-600' : 'bg-gray-100 border-2 border-gray-200'} ${onStepClick && !isCurrent ? 'group-hover:ring-2 group-hover:ring-blue-300' : ''}`}>
                {isCompleted ? <Check className="w-4 h-4 text-white" /> : <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />}
              </div>
              <span className={`text-xs font-medium text-center leading-tight truncate w-full ${isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                {def.label}
              </span>
            </button>
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

function RadioYN({ name, value, onChange, disabledValues = [] }: { name: string; value: string; onChange: (v: string) => void; disabledValues?: string[] }) {
  return (
    <div className="flex gap-4">
      {['yes', 'no'].map(v => {
        const disabled = disabledValues.includes(v);
        return (
          <label key={v} className={`flex items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} disabled={disabled} className="w-4 h-4 accent-blue-600" />
            <span className="capitalize text-sm">{v}</span>
          </label>
        );
      })}
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

function InlineDocUpload({ label = 'Upload Document', sectionKey, uploadedFiles, onFilesChange }: {
  label?: string;
  sectionKey: string;
  uploadedFiles: UploadedFileItem[];
  onFilesChange: (files: UploadedFileItem[]) => void;
}) {
  // Find any entry with this sectionKey, including placeholder entries (file=null).
  // This ensures required-doc placeholders are updated in-place rather than duplicated.
  const entry = uploadedFiles.find(f => f.sectionKey === sectionKey);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (entry) {
      onFilesChange(uploadedFiles.map(f => f.sectionKey === sectionKey ? { ...f, file, type: label } : f));
    } else {
      onFilesChange([...uploadedFiles, { id: crypto.randomUUID(), type: label, sectionKey, file }]);
    }
    e.target.value = '';
  };
  // Required-doc entries (sectionKey starts with 'required:') keep their placeholder entry so
  // Step 10 can still render the slot — just clear the file. Optional entries are removed entirely.
  const handleRemove = () => {
    if (sectionKey.startsWith('required:')) {
      onFilesChange(uploadedFiles.map(f => f.sectionKey === sectionKey ? { ...f, file: null } : f));
    } else {
      onFilesChange(uploadedFiles.filter(f => f.sectionKey !== sectionKey));
    }
  };
  return (
    <div className="space-y-1 md:col-span-2">
      <Label className="text-xs">{label}</Label>
      {entry?.file ? (
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-green-50 border-green-200">
          <FileText className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-700 truncate flex-1">{entry.file.name}</span>
          <button type="button" onClick={handleRemove} className="p-0.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <label className="flex items-center gap-2 p-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Upload className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Click to upload (PDF, JPG, PNG)</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

// ── Step Components ───────────────────────────────────────────────────────────

function Step1Personal({ d, u, jobTypes, photoFile, onPhotoChange, existingPhotoUrl, jobAdTitle }: {
  d: ApplicantFormData;
  u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void;
  jobTypes: JobType[];
  photoFile?: File | null;
  onPhotoChange?: (file: File | null) => void;
  existingPhotoUrl?: string;
  jobAdTitle?: string;
}) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));

  // Build preview URL: newly selected file takes priority over existing URL
  const previewUrl = photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl ?? null;

  return (
    <div className="space-y-8">
      <SectionTitle title="Personal Information" subtitle="Your personal details and address" />

      {/* ── Job Category / Job Title ── */}
      <div className="space-y-2">
        {jobAdTitle ? (
          <>
            <SubSection title="Job Title" />
            <Input value={jobAdTitle} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
          </>
        ) : (
          <>
            <SubSection title="Job Category" />
            <Select value={d.jobTypeId} onValueChange={set('jobTypeId')} disabled={jobTypes.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={jobTypes.length === 0 ? 'Loading categories…' : 'Select job category'} />
              </SelectTrigger>
              <SelectContent>
                {jobTypes.map(jt => <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

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
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Citizenship *</Label>
            <div className="space-y-2">
              <CountrySelect value={d.citizenship} onChange={set('citizenship')} placeholder="Select citizenship" />
              {(d.otherCitizenships ?? []).map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <CountrySelect
                      value={c}
                      onChange={v => {
                        const updated = [...(d.otherCitizenships ?? [])];
                        updated[idx] = v;
                        set('otherCitizenships')(updated);
                      }}
                      placeholder="Select additional citizenship"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => set('otherCitizenships')((d.otherCitizenships ?? []).filter((_, i) => i !== idx))}
                    className="p-1.5 text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('otherCitizenships')([...(d.otherCitizenships ?? []), ''])}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add another citizenship
              </button>
            </div>
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
      <div className="space-y-4">
        <SubSection title="Previous Country of Residence" />
        <div className="space-y-3">
          <Label className="text-sm font-medium">Have you lived in another country for 6 months or more within the last 12 months?</Label>
          <RadioYN name="livedAbroadRecently" value={d.livedAbroadRecently} onChange={set('livedAbroadRecently')} />
        </div>
        {d.livedAbroadRecently === 'yes' && (
          <div className="space-y-4 pt-2 border-l-2 border-blue-100 pl-4">
            <div className="space-y-1">
              <Label className="text-xs">Country *</Label>
              <CountrySelect value={d.abroadCountry} onChange={set('abroadCountry')} placeholder="Select country" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Full Address *</Label>
              <AddressForm label="" value={d.abroadAddress ?? { ...EMPTY_ADDRESS }} onChange={set('abroadAddress')} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Date From *</Label>
                <Input type="date" value={d.abroadDateFrom} onChange={e => set('abroadDateFrom')(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date To *</Label>
                <Input type="date" value={d.abroadDateTo} onChange={e => set('abroadDateTo')(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step2Contact({ d, u, settings }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const [touched, setTouched] = useState({ email: false, emailConfirm: false, emergencyEmail: false });
  const touch = (field: 'email' | 'emailConfirm' | 'emergencyEmail') => () => setTouched(t => ({ ...t, [field]: true }));
  const emailInvalid = (touched.email || !!d.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email);
  const confirmMismatch = (touched.emailConfirm || !!d.emailConfirm) && d.email !== d.emailConfirm;
  const emergencyEmailInvalid = (touched.emergencyEmail || !!d.emergencyEmail) && !!d.emergencyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.emergencyEmail);
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
                  {d.phoneCode
                    ? <span className="text-sm flex items-center gap-1.5">
                        <img src={`https://flagcdn.com/w20/${(PHONE_CODES.find(p => p.code === d.phoneCode)?.iso ?? 'un').toLowerCase()}.png`} width={20} height={15} alt="" className="inline-block rounded-sm" />
                        {d.phoneCode}
                      </span>
                    : <span className="text-sm text-muted-foreground">Code</span>}
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PHONE_CODES.map(c => (
                    <SelectItem key={`${c.label}-${c.code}`} value={c.code}>
                      <span className="flex items-center gap-2">
                        <img src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`} width={20} height={15} alt={c.iso} className="inline-block rounded-sm" />
                        <span>{c.label} ({c.code})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Phone" value={d.phone} onChange={e => set('phone')(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={d.phoneIsWhatsApp}
                onCheckedChange={c => u(prev => ({ ...prev, phoneIsWhatsApp: !!c, whatsapp: !!c ? '' : prev.whatsapp }))}
              />
              <span>This phone number is also my WhatsApp number</span>
            </label>
          </div>
          {!d.phoneIsWhatsApp && (
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp Number *</Label>
              <div className="flex gap-2">
                <Select value={d.whatsappCode} onValueChange={set('whatsappCode')}>
                  <SelectTrigger className="w-36 shrink-0">
                    {d.whatsappCode
                      ? <span className="text-sm flex items-center gap-1.5">
                          <img src={`https://flagcdn.com/w20/${(PHONE_CODES.find(p => p.code === d.whatsappCode)?.iso ?? 'un').toLowerCase()}.png`} width={20} height={15} alt="" className="inline-block rounded-sm" />
                          {d.whatsappCode}
                        </span>
                      : <span className="text-sm text-muted-foreground">Code</span>}
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PHONE_CODES.map(c => (
                      <SelectItem key={`wa-${c.label}-${c.code}`} value={c.code}>
                        <span className="flex items-center gap-2">
                          <img src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`} width={20} height={15} alt={c.iso} className="inline-block rounded-sm" />
                          <span>{c.label} ({c.code})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="WhatsApp number" value={d.whatsapp} onChange={e => set('whatsapp')(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              placeholder="email@example.com"
              value={d.email}
              onChange={e => set('email')(e.target.value)}
              onBlur={touch('email')}
              className={emailInvalid ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {emailInvalid && <p className="text-xs text-red-500 mt-1">Please enter a valid email address</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirm Email *</Label>
            <Input
              type="email"
              placeholder="Repeat email"
              value={d.emailConfirm}
              onChange={e => set('emailConfirm')(e.target.value)}
              onBlur={touch('emailConfirm')}
              onPaste={e => e.preventDefault()}
              className={confirmMismatch ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {confirmMismatch && <p className="text-xs text-red-500 mt-1">Emails do not match</p>}
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
            <div className="flex gap-2">
              <Select value={d.emergencyPhoneCode} onValueChange={set('emergencyPhoneCode')}>
                <SelectTrigger className="w-36 shrink-0">
                  {d.emergencyPhoneCode
                    ? <span className="text-sm flex items-center gap-1.5">
                        <img src={`https://flagcdn.com/w20/${(PHONE_CODES.find(p => p.code === d.emergencyPhoneCode)?.iso ?? 'un').toLowerCase()}.png`} width={20} height={15} alt="" className="inline-block rounded-sm" />
                        {d.emergencyPhoneCode}
                      </span>
                    : <span className="text-sm text-muted-foreground">Code</span>}
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PHONE_CODES.map(c => (
                    <SelectItem key={`${c.label}-${c.code}`} value={c.code}>
                      <span className="flex items-center gap-2">
                        <img src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`} width={20} height={15} alt={c.iso} className="inline-block rounded-sm" />
                        <span>{c.label} ({c.code})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Phone" value={d.emergencyPhone} onChange={e => set('emergencyPhone')(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              placeholder="emergency@email.com"
              value={d.emergencyEmail}
              onChange={e => set('emergencyEmail')(e.target.value)}
              onBlur={touch('emergencyEmail')}
              className={emergencyEmailInvalid ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {emergencyEmailInvalid && <p className="text-xs text-red-500 mt-1">Please enter a valid email address</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3Identification({ d, u, settings, uploadedFiles, onFilesChange, requiredDocuments = [] }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings; uploadedFiles: UploadedFileItem[]; onFilesChange: (files: UploadedFileItem[]) => void; requiredDocuments?: string[] }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  // Wire job-ad required docs to their required: sectionKeys so uploads on this tab
  // satisfy the required-doc checks in both getStepErrors and the Documents (Tab 10) gate.
  const passportDocName = requiredDocuments.find(n => n.toLowerCase() === 'passport');
  const passportSectionKey = passportDocName ? `required:${passportDocName}` : 'passport';
  const nationalIdDocName = requiredDocuments.find(n => n.toLowerCase().includes('national id'));
  const nationalIdSectionKey = nationalIdDocName ? `required:${nationalIdDocName}` : 'idCard';
  // Auto-select "yes" and lock out "no" when National ID is required by the job ad
  useEffect(() => {
    if (nationalIdDocName && d.hasIdCard !== 'yes') {
      u(prev => ({ ...prev, hasIdCard: 'yes' }));
    }
  }, [nationalIdDocName]);
  return (
    <div className="space-y-8">
      <SectionTitle title="Identification & Legal Status" subtitle="Passport, ID and residency documents" />
      <div className="space-y-4">
        <SubSection title="Passport" />
        {passportDocName && (
          <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            Passport upload is required for this position
          </div>
        )}
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
        <InlineDocUpload label={passportDocName ? 'Upload Passport (Required)' : 'Upload Passport'} sectionKey={passportSectionKey} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
      </div>
      <div className="space-y-4">
        <SubSection title="National ID Card" />
        {nationalIdDocName && (
          <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            National ID Card upload is required for this position
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-xs">Do you have a National ID Card?</Label>
          <RadioYN name="hasIdCard" value={d.hasIdCard} onChange={set('hasIdCard')} disabledValues={nationalIdDocName ? ['no'] : []} />
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
            {/* Only render optional upload inside the yes-block when NOT a required doc */}
            {!nationalIdDocName && <InlineDocUpload label="Upload ID Card" sectionKey="idCard" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />}
          </div>
        )}
        {/* Required upload shown unconditionally so user can upload regardless of yes/no answer */}
        {nationalIdDocName && (
          <InlineDocUpload label="Upload National ID Card (Required)" sectionKey={nationalIdSectionKey} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
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
              <Label className="text-xs">Issuing Country</Label>
              <CountrySelect value={d.euVisaCountry} onChange={set('euVisaCountry')} countries={EU_COUNTRIES} placeholder="Select EU country" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Visa Number</Label>
              <Input placeholder="Number" value={d.euVisaNumber} onChange={e => set('euVisaNumber')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.euVisaExpiryDate} noExpiry={d.euVisaNoExpiry} onExpiry={set('euVisaExpiryDate')} onNoExpiry={set('euVisaNoExpiry')} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Purpose of Issue <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea rows={2} placeholder="Describe the purpose for which this visa was issued…" value={d.purposeOfIssue} onChange={e => set('purposeOfIssue')(e.target.value)} />
            </div>
            <InlineDocUpload label="Upload EU Visa" sectionKey="euVisa" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
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
              <CountrySelect value={d.euResidenceCountry} onChange={set('euResidenceCountry')} countries={EU_COUNTRIES} placeholder="Select EU country" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Issue Date</Label>
              <Input type="date" value={d.euResidenceIssueDate} onChange={e => set('euResidenceIssueDate')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City of Issue</Label>
              <Input placeholder="City" value={d.euResidenceCity} onChange={e => set('euResidenceCity')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.euResidenceExpiryDate} noExpiry={d.euResidenceNoExpiry} onExpiry={set('euResidenceExpiryDate')} onNoExpiry={set('euResidenceNoExpiry')} />
            </div>
            <InlineDocUpload label="Upload Residence Permit" sectionKey="euResidence" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SubSection title="EU Work Permit" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have an EU Work Permit?</Label>
          <RadioYN name="hasWorkPermit" value={d.hasWorkPermit} onChange={set('hasWorkPermit')} />
        </div>
        {d.hasWorkPermit === 'yes' && (
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1">
              <Label className="text-xs">Permit Type</Label>
              <Input placeholder="e.g. Blue Card, Seasonal Worker" value={d.workPermitType} onChange={e => set('workPermitType')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Permit Number</Label>
              <Input placeholder="Number" value={d.workPermitNumber} onChange={e => set('workPermitNumber')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Issuing EU Country</Label>
              <CountrySelect value={d.workPermitCountry} onChange={set('workPermitCountry')} countries={EU_COUNTRIES} placeholder="Select EU country" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Issue Date</Label>
              <Input type="date" value={d.workPermitIssueDate} onChange={e => set('workPermitIssueDate')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.workPermitExpiryDate} noExpiry={d.workPermitNoExpiry} onExpiry={set('workPermitExpiryDate')} onNoExpiry={set('workPermitNoExpiry')} />
            </div>
            <InlineDocUpload label="Upload Work Permit" sectionKey="workPermit" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SubSection title="Criminal Record Declaration" />
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-xs font-medium">Home Country Criminal Record</Label>
            <RadioYN name="hasHomeCriminalRecord" value={d.hasHomeCriminalRecord} onChange={set('hasHomeCriminalRecord')} />
            {d.hasHomeCriminalRecord === 'yes' && (
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Date of Issue</Label>
                  <Input type="date" value={d.homeCriminalRecordDate} onChange={e => set('homeCriminalRecordDate')(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Country of Issue</Label>
                  <CountrySelect value={d.homeCriminalRecordCountry} onChange={set('homeCriminalRecordCountry')} placeholder="Select country" />
                </div>
                <InlineDocUpload label="Upload Home Country Criminal Record" sectionKey="homeCriminalRecord" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Label className="text-xs font-medium">EU Country Criminal Record</Label>
            <RadioYN name="hasEuCriminalRecord" value={d.hasEuCriminalRecord} onChange={set('hasEuCriminalRecord')} />
            {d.hasEuCriminalRecord === 'yes' && (
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Date of Issue</Label>
                  <Input type="date" value={d.euCriminalRecordDate} onChange={e => set('euCriminalRecordDate')(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Country of Issue</Label>
                  <CountrySelect value={d.euCriminalRecordCountry} onChange={set('euCriminalRecordCountry')} countries={EU_COUNTRIES} placeholder="Select EU country" />
                </div>
                <InlineDocUpload label="Upload EU Criminal Record" sectionKey="euCriminalRecord" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4DrivingLicense({ d, u, settings, uploadedFiles, onFilesChange, requiredDocuments = [] }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings; uploadedFiles: UploadedFileItem[]; onFilesChange: (files: UploadedFileItem[]) => void; requiredDocuments?: string[] }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const dlDocName = requiredDocuments.find(n => n.toLowerCase().includes('driving'));
  const dlSectionKey = dlDocName ? `required:${dlDocName}` : 'drivingLicense';
  // Auto-select "yes" and lock out "no" when Driving License is required by the job ad
  useEffect(() => {
    if (dlDocName && d.hasDrivingLicense !== 'yes') {
      u(prev => ({ ...prev, hasDrivingLicense: 'yes' }));
    }
  }, [dlDocName]);
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
      {dlDocName && (
        <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          Driving License upload is required for this position
        </div>
      )}
      <div className="space-y-3">
        <Label className="font-medium">Do you hold a driving license? *</Label>
        <div className="flex gap-6">
          {['yes', 'no'].map(v => {
            const disabled = dlDocName ? v === 'no' : false;
            return (
              <label key={v} className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-xl text-sm font-medium transition-all ${disabled ? 'opacity-40 cursor-not-allowed border-gray-200' : 'cursor-pointer'} ${d.hasDrivingLicense === v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="hasDrivingLicense" value={v} checked={d.hasDrivingLicense === v} onChange={() => !disabled && set('hasDrivingLicense')(v)} disabled={disabled} className="sr-only" />
                {v === 'yes' ? '✅ Yes' : '❌ No'}
              </label>
            );
          })}
        </div>
      </div>
      {/* Required upload shown unconditionally when DL is a job-ad required document */}
      {dlDocName && (
        <InlineDocUpload label="Upload Driving License (Required)" sectionKey={dlSectionKey} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
      )}
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
                <Label className="text-xs">First Issue Date <span className="text-gray-400">(optional)</span></Label>
                <Input type="date" value={d.licenseFirstIssueDate} onChange={e => set('licenseFirstIssueDate')(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Issue Date</Label>
                <Input type="date" value={d.licenseIssueDate} onChange={e => set('licenseIssueDate')(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiry Date</Label>
                <ExpiryFields expiryDate={d.licenseExpiryDate} noExpiry={d.licenseNoExpiry} onExpiry={set('licenseExpiryDate')} onNoExpiry={set('licenseNoExpiry')} />
              </div>
              {/* Only show the optional upload inside the yes-block when not a required doc */}
              {!dlDocName && <InlineDocUpload label="Upload Driving License" sectionKey="drivingLicense" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />}
            </div>
          </div>
          <div className="space-y-3">
            <SubSection title="License Categories *" />
            <p className="text-xs text-muted-foreground -mt-3">Select at least one category.</p>
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
  const addCustom = (field: 'transportTypes' | 'truckBrands' | 'trailerTypes', value: string) => {
    const v = value.trim();
    if (!v) return;
    u(prev => {
      const arr = prev[field] as string[];
      if (arr.includes(v)) return prev;
      return { ...prev, [field]: [...arr, v] };
    });
  };
  const [customInputs, setCustomInputs] = useState({ transportTypes: '', truckBrands: '', trailerTypes: '' });
  const setCustom = (field: keyof typeof customInputs) => (val: string) => setCustomInputs(p => ({ ...p, [field]: val }));
  const confirmCustom = (field: 'transportTypes' | 'truckBrands' | 'trailerTypes') => {
    addCustom(field, customInputs[field]);
    setCustomInputs(p => ({ ...p, [field]: '' }));
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
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <CountrySelect value={d.euExpCountries} onChange={set('euExpCountries')} />
            </div>
          </div>
        </div>
      )}
      {(d.drivingExpType === 'domestic' || d.drivingExpType === 'both') && (
        <div className="space-y-4">
          <SubSection title="Domestic Experience" />
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Years</Label>
              <Input type="number" min="0" placeholder="Years" value={d.domesticExpYears} onChange={e => set('domesticExpYears')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total KM</Label>
              <Input placeholder="e.g. 100000" value={d.domesticExpKm} onChange={e => set('domesticExpKm')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <CountrySelect value={d.domesticExpCountry} onChange={set('domesticExpCountry')} />
            </div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        <SubSection title="Transport Types" />
        <div className="flex flex-wrap gap-2">
          {d.transportTypes.map(t => (
            <span key={t} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              {t}
              <button type="button" onClick={() => toggle('transportTypes', t)} className="text-gray-400 hover:text-red-500 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(settings.transportTypes ?? []).filter(t => !d.transportTypes.includes(t)).map(t => (
            <button key={t} type="button" onClick={() => toggle('transportTypes', t)}
              className="px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
              + {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="+ Add custom type" value={customInputs.transportTypes} onChange={e => setCustom('transportTypes')(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmCustom('transportTypes')} className="text-sm" />
          {customInputs.transportTypes.trim() && (
            <button type="button" onClick={() => confirmCustom('transportTypes')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Add</button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <SubSection title="Truck Brands" />
        <div className="flex flex-wrap gap-2">
          {d.truckBrands.map(b => (
            <span key={b} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              {b}
              <button type="button" onClick={() => toggle('truckBrands', b)} className="text-gray-400 hover:text-red-500 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(settings.truckBrands ?? []).filter(b => !d.truckBrands.includes(b)).map(b => (
            <button key={b} type="button" onClick={() => toggle('truckBrands', b)}
              className="px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
              + {b}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="+ Add custom brand" value={customInputs.truckBrands} onChange={e => setCustom('truckBrands')(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmCustom('truckBrands')} className="text-sm" />
          {customInputs.truckBrands.trim() && (
            <button type="button" onClick={() => confirmCustom('truckBrands')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Add</button>
          )}
        </div>
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
          {d.selectedGpsSystems.map(g => (
            <span key={g} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              {g}
              <button type="button" onClick={() => toggle('selectedGpsSystems', g)} className="text-gray-400 hover:text-red-500 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(settings.gpsSystemTypes ?? []).filter(g => !d.selectedGpsSystems.includes(g)).map(g => (
            <button key={g} type="button" onClick={() => toggle('selectedGpsSystems', g)}
              className="px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
              + {g}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SubSection title="Trailer Types" />
        <div className="flex flex-wrap gap-2">
          {d.trailerTypes.map(t => (
            <span key={t} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              {t}
              <button type="button" onClick={() => toggle('trailerTypes', t)} className="text-gray-400 hover:text-red-500 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(settings.trailerTypes ?? []).filter(t => !d.trailerTypes.includes(t)).map(t => (
            <button key={t} type="button" onClick={() => toggle('trailerTypes', t)}
              className="px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
              + {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="+ Add custom trailer type" value={customInputs.trailerTypes} onChange={e => setCustom('trailerTypes')(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmCustom('trailerTypes')} className="text-sm" />
          {customInputs.trailerTypes.trim() && (
            <button type="button" onClick={() => confirmCustom('trailerTypes')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Add</button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-2">
          <Input placeholder="Most used trailer" value={d.mostUsedTrailer} onChange={e => set('mostUsedTrailer')(e.target.value)} />
        </div>
      </div>
      <div className="space-y-4">
        <SubSection title="Work Preferences" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Have you been involved in any traffic accidents within the past three years?</Label>
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

function Step6Education({ d, u, settings, uploadedFiles, onFilesChange }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings; uploadedFiles: UploadedFileItem[]; onFilesChange: (files: UploadedFileItem[]) => void }) {
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
            <InlineDocUpload label="Upload Certificate / Diploma" sectionKey={`education-${entry.id}`} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
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

function Step7WorkHistory({ d, u, uploadedFiles, onFilesChange }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; uploadedFiles: UploadedFileItem[]; onFilesChange: (files: UploadedFileItem[]) => void }) {
  const addEntry = () => {
    u(prev => ({
      ...prev,
      workHistory: [...prev.workHistory, { id: crypto.randomUUID(), company: '', jobTitle: '', companyStreet: '', companyCity: '', companyPostalCode: '', country: '', companyPhoneCode: '', companyPhone: '', startDate: '', endDate: '', current: false, responsibilities: '', reasonForLeaving: '', referenceName: '', referencePhoneCode: '', referencePhone: '', referenceEmail: '' }],
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
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Company Street Address *</Label>
              <Input placeholder="Street address" value={entry.companyStreet} onChange={e => updateEntry(entry.id, 'companyStreet', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City *</Label>
              <Input placeholder="City" value={entry.companyCity} onChange={e => updateEntry(entry.id, 'companyCity', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Postal Code *</Label>
              <Input placeholder="Postal code" value={entry.companyPostalCode} onChange={e => updateEntry(entry.id, 'companyPostalCode', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country *</Label>
              <CountrySelect value={entry.country} onChange={v => updateEntry(entry.id, 'country', v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Company Phone *</Label>
              <div className="flex gap-2">
                <Select value={entry.companyPhoneCode} onValueChange={v => updateEntry(entry.id, 'companyPhoneCode', v)}>
                  <SelectTrigger className="w-36 shrink-0">
                    {entry.companyPhoneCode
                      ? <span className="text-sm flex items-center gap-1.5">
                          <img src={`https://flagcdn.com/w20/${(PHONE_CODES.find(p => p.code === entry.companyPhoneCode)?.iso ?? 'un').toLowerCase()}.png`} width={20} height={15} alt="" className="inline-block rounded-sm" />
                          {entry.companyPhoneCode}
                        </span>
                      : <span className="text-sm text-muted-foreground">Code</span>}
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PHONE_CODES.map(pc => (
                      <SelectItem key={`${pc.label}-${pc.code}`} value={pc.code}>
                        <span className="flex items-center gap-2">
                          <img src={`https://flagcdn.com/w20/${pc.iso.toLowerCase()}.png`} width={20} height={15} alt={pc.iso} className="inline-block rounded-sm" />
                          <span>{pc.label} ({pc.code})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Phone number" value={entry.companyPhone} onChange={e => updateEntry(entry.id, 'companyPhone', e.target.value)} className="flex-1" />
              </div>
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
              <Label className="text-xs">Reason for Leaving</Label>
              <Input placeholder="e.g. Contract ended, career change..." value={entry.reasonForLeaving} onChange={e => updateEntry(entry.id, 'reasonForLeaving', e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs font-semibold">Reference <span className="text-gray-400 font-normal">(optional)</span></Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference Name</Label>
              <Input placeholder="Full name" value={entry.referenceName} onChange={e => updateEntry(entry.id, 'referenceName', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference Phone</Label>
              <div className="flex gap-2">
                <Select value={entry.referencePhoneCode} onValueChange={v => updateEntry(entry.id, 'referencePhoneCode', v)}>
                  <SelectTrigger className="w-36 shrink-0">
                    {entry.referencePhoneCode
                      ? <span className="text-sm flex items-center gap-1.5">
                          <img src={`https://flagcdn.com/w20/${(PHONE_CODES.find(p => p.code === entry.referencePhoneCode)?.iso ?? 'un').toLowerCase()}.png`} width={20} height={15} alt="" className="inline-block rounded-sm" />
                          {entry.referencePhoneCode}
                        </span>
                      : <span className="text-sm text-muted-foreground">Code</span>}
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PHONE_CODES.map(pc => (
                      <SelectItem key={`${pc.label}-${pc.code}`} value={pc.code}>
                        <span className="flex items-center gap-2">
                          <img src={`https://flagcdn.com/w20/${pc.iso.toLowerCase()}.png`} width={20} height={15} alt={pc.iso} className="inline-block rounded-sm" />
                          <span>{pc.label} ({pc.code})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Phone number" value={entry.referencePhone} onChange={e => updateEntry(entry.id, 'referencePhone', e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference Email</Label>
              <Input
                type="email"
                placeholder="reference@company.com"
                value={entry.referenceEmail}
                onChange={e => updateEntry(entry.id, 'referenceEmail', e.target.value)}
                className={entry.referenceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.referenceEmail) ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              {entry.referenceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.referenceEmail) && (
                <p className="text-xs text-red-500 mt-0.5">Please enter a valid email address</p>
              )}
            </div>
            <InlineDocUpload
              label={`Work Experience Document — ${entry.company || `Position ${i + 1}`}`}
              sectionKey={`work-exp-${entry.id}`}
              uploadedFiles={uploadedFiles}
              onFilesChange={onFilesChange}
            />
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

function Step8Skills({ d, u, settings, uploadedFiles, onFilesChange }: { d: ApplicantFormData; u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void; settings: FormSettings; uploadedFiles: UploadedFileItem[]; onFilesChange: (files: UploadedFileItem[]) => void }) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const addPresetSkill = (skill: string) => {
    u(prev => ({ ...prev, skills: [...prev.skills, { id: crypto.randomUUID(), skill, level: '', isCustom: false }] }));
  };
  const addCustomSkill = () => {
    u(prev => ({ ...prev, skills: [...prev.skills, { id: crypto.randomUUID(), skill: '', level: '', isCustom: true }] }));
  };
  const updateSkill = (id: string, field: keyof SkillEntry, value: any) => {
    u(prev => ({ ...prev, skills: prev.skills.map(s => s.id === id ? { ...s, [field]: value } : s) }));
  };
  const removeSkill = (id: string) => {
    u(prev => ({ ...prev, skills: prev.skills.filter(s => s.id !== id) }));
  };
  const addLang = () => {
    u(prev => ({
      ...prev,
      languages: [...prev.languages, { id: crypto.randomUUID(), language: '', motherTongue: false, speakingLevel: '', readingLevel: '', writingLevel: '', listeningLevel: '', hasCertificate: false, certificate: '' }],
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
                <Select value={lang.language} onValueChange={v => updateLang(lang.id, 'language', v)}>
                  <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-5">
                <Checkbox checked={lang.motherTongue} onCheckedChange={c => updateLang(lang.id, 'motherTongue', !!c)} />
                <Label className="text-xs cursor-pointer">Mother Tongue</Label>
              </div>
              {(['Speaking', 'Reading', 'Writing', 'Listening'] as const).map(skill => (
                <div key={skill} className="space-y-1">
                  <Label className="text-xs">{skill}</Label>
                  <Select value={(lang as any)[`${skill.toLowerCase()}Level`]} onValueChange={v => updateLang(lang.id, `${skill.toLowerCase()}Level` as keyof LanguageEntry, v)}>
                    <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                    <SelectContent>
                      {PROFICIENCY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1 md:col-span-2">
                <Checkbox checked={lang.hasCertificate} onCheckedChange={c => updateLang(lang.id, 'hasCertificate', !!c)} />
                <Label className="text-xs cursor-pointer">Has Certificate</Label>
              </div>
              {lang.hasCertificate && (
                <div className="space-y-1 md:col-span-2">
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
      <div className="space-y-4">
        <SubSection title="Skills" />
        {d.skills.map(entry => (
          <div key={entry.id} className="flex items-center gap-2">
            {entry.isCustom ? (
              <Input
                value={entry.skill}
                onChange={e => updateSkill(entry.id, 'skill', e.target.value)}
                placeholder="Skill name"
                className="flex-1"
              />
            ) : (
              <span className="flex-1 text-sm px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">{entry.skill}</span>
            )}
            <Select value={entry.level} onValueChange={v => updateSkill(entry.id, 'level', v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                {SKILL_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <button type="button" onClick={() => removeSkill(entry.id)} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {(settings.skills ?? []).filter(s => !d.skills.some(e => e.skill === s)).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {(settings.skills ?? []).filter(s => !d.skills.some(e => e.skill === s)).map(s => (
              <button key={s} type="button" onClick={() => addPresetSkill(s)}
                className="px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                + {s}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={addCustomSkill} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50">
          <Plus className="w-4 h-4" /> Add Custom Skill
        </button>
      </div>
      <div className="space-y-3">
        <SubSection title="First Aid Certificate" />
        <div className="space-y-2">
          <Label className="text-xs">Do you have a First Aid Certificate?</Label>
          <RadioYN name="hasFirstAid" value={d.hasFirstAid} onChange={set('hasFirstAid')} />
        </div>
        {d.hasFirstAid === 'yes' && (
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <ExpiryFields expiryDate={d.firstAidExpiry} noExpiry={d.firstAidNoExpiry} onExpiry={set('firstAidExpiry')} onNoExpiry={set('firstAidNoExpiry')} />
            </div>
            <InlineDocUpload label="Upload First Aid Certificate" sectionKey="firstAid" uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />
          </div>
        )}
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
              <SelectItem value="1 Week">1 week</SelectItem>
              <SelectItem value="2 Weeks">2 weeks</SelectItem>
              <SelectItem value="3 Weeks">3 weeks</SelectItem>
              <SelectItem value="1 Month">1 month</SelectItem>
              <SelectItem value="2 Months">2 months</SelectItem>
              <SelectItem value="3 Months">3 months</SelectItem>
              <SelectItem value="6 Months">6 months</SelectItem>
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
          <Label className="text-xs">Annual Salary Expectation (in EUR)</Label>
          <Input placeholder="e.g. 35,000" value={d.salaryExpectation} onChange={e => set('salaryExpectation')(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={d.willingToRelocate} onCheckedChange={c => set('willingToRelocate')(!!c)} />
            <span className="text-sm">I am fully willing to relocate and remain flexible regarding location in alignment with the role and organizational requirements.</span>
          </label>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Work Regime (if required)</Label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={d.weekendDriving} onCheckedChange={c => set('weekendDriving')(!!c)} />
              Open to weekend work shifts
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={d.nightDriving} onCheckedChange={c => set('nightDriving')(!!c)} />
              Open to evening work shifts
            </label>
          </div>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Additional Notes</Label>
          <Textarea rows={4} placeholder="Anything else you'd like us to know..." value={d.additionalNotes} onChange={e => set('additionalNotes')(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

const FALLBACK_DOC_TYPES = ['Passport', "Driver's License", 'Tachograph Card', 'C95 / CPC Card', 'ADR Certificate', 'Visa', 'Work Permit', 'Residence Card', 'Medical Certificate', 'First Aid Certificate', 'Other'];

function Step10Documents({ uploadedFiles, onFilesChange, requiredDocuments = [] }: { uploadedFiles: UploadedFileItem[]; onFilesChange: (files: UploadedFileItem[]) => void; requiredDocuments?: string[] }) {
  const [docTypes, setDocTypes] = useState<string[]>(FALLBACK_DOC_TYPES);

  useEffect(() => {
    settingsApi.getDocumentTypes()
      .then((data: any[]) => {
        const names = data.filter(d => d.isActive !== false).map(d => d.name).filter(Boolean);
        if (names.length > 0) setDocTypes(names);
      })
      .catch(() => {});
  }, []);

  const addDoc = () => {
    onFilesChange([...uploadedFiles, { id: crypto.randomUUID(), type: '', file: null }]);
  };
  const updateItem = (id: string, patch: Partial<UploadedFileItem>) => {
    onFilesChange(uploadedFiles.map(f => f.id === id ? { ...f, ...patch } : f));
  };
  const removeItem = (id: string) => {
    onFilesChange(uploadedFiles.filter(f => f.id !== id));
  };

  // Separate required (locked) entries from optional ones
  const optionalItems = uploadedFiles.filter(f => !f.sectionKey?.startsWith('required:'));

  return (
    <div className="space-y-6">
      <SectionTitle title="Document Uploads" subtitle="Upload supporting documents (PDF, JPG, PNG — max 5MB)" />

      {/* Required documents section */}
      {requiredDocuments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-red-700">Required Documents</span>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Mandatory</span>
          </div>
          <p className="text-xs text-red-600">The following documents are required for this position. You cannot submit without uploading all of them.</p>
          {requiredDocuments.map(docName => {
            const item = uploadedFiles.find(f => f.sectionKey === `required:${docName}`);
            if (!item) return null;
            return (
              <div key={docName} className={`p-4 border-2 rounded-lg space-y-3 ${item.file ? 'border-green-300 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 shrink-0 ${item.file ? 'text-green-600' : 'text-red-500'}`} />
                  <span className={`text-sm font-medium ${item.file ? 'text-green-800' : 'text-red-800'}`}>{docName}</span>
                  {item.file
                    ? <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Uploaded</span>
                    : <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Required *</span>
                  }
                </div>
                <label className="block cursor-pointer">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${item.file ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-red-300 text-red-500 hover:border-red-400'}`}>
                    {item.file ? (
                      <><Check className="w-4 h-4 text-green-600 shrink-0" /><span className="truncate">{item.file.name}</span><span className="ml-auto text-xs">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span></>
                    ) : (
                      <><Upload className="w-4 h-4" /><span>Choose file (required)</span></>
                    )}
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => updateItem(item.id, { file: e.target.files?.[0] ?? null })} />
                </label>
              </div>
            );
          })}
        </div>
      )}

      {/* Optional documents */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        Upload clear scans of your passport, license, and qualifications.
      </div>
      {optionalItems.map((item) => (
        <div key={item.id} className="p-4 border-2 border-dashed border-gray-300 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Document Type *</Label>
              {item.sectionKey && !item.sectionKey.startsWith('required:') ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-blue-800 font-medium">{item.type.replace(/^Upload\s+/i, '')}</span>
                  <span className="ml-auto text-xs text-blue-500 italic">auto-detected</span>
                </div>
              ) : (
                <Select value={item.type} onValueChange={type => updateItem(item.id, { type })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
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
      {optionalItems.length === 0 && requiredDocuments.length === 0 && <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">No documents yet.</p>}
      <button type="button" onClick={addDoc} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50">
        <Plus className="w-4 h-4" /> Add Document
      </button>
    </div>
  );
}

async function printApplicationSummary(d: ApplicantFormData, uploadedFiles: UploadedFileItem[]) {
  const field = (label: string, value: string | undefined | null | boolean) => {
    const v = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
    if (!v) return '';
    return `<div class="field"><span class="label">${label}</span><span class="value">${v}</span></div>`;
  };
  const section = (title: string, content: string) =>
    content.trim() ? `<div class="section"><h2>${title}</h2>${content}</div>` : '';

  // Read image files as data URLs for embedding
  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const filesWithData = await Promise.all(
    uploadedFiles.filter(f => f.file).map(async f => {
      const isImage = f.file!.type.startsWith('image/');
      const dataUrl = isImage ? await readAsDataUrl(f.file!).catch(() => null) : null;
      return { label: f.type || f.sectionKey || 'Document', name: f.file!.name, isImage, isPdf: f.file!.type === 'application/pdf', dataUrl };
    })
  );

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Application Summary</title>
<style>
  body{font-family:Arial,sans-serif;margin:32px;color:#1f2937;font-size:13px;}
  h1{color:#1a56db;margin-bottom:4px;}
  .ref{font-size:12px;color:#6b7280;margin-bottom:24px;}
  h2{font-size:13px;font-weight:700;color:#1a56db;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:20px 0 8px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .field{display:flex;flex-direction:column;gap:2px;}
  .label{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:600;}
  .value{color:#111827;}
  .entry{border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;margin-bottom:6px;}
  .entry-title{font-weight:700;margin-bottom:4px;}
  @media print{body{margin:16px;}}
</style></head><body>
<h1>Application Summary</h1>
<p class="ref">Submitted by: ${[d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ')} &nbsp;|&nbsp; ${d.email}</p>
<div class="grid">
${section('Personal Information', `<div class="grid">
  ${field('First Name', d.firstName)}${field('Middle Name', d.middleName)}${field('Last Name', d.lastName)}
  ${field('Date of Birth', d.dateOfBirth)}${field('Gender', d.gender)}${field('Citizenship', [d.citizenship, ...(d.otherCitizenships ?? [])].filter(Boolean).join(', '))}
  ${field('Country of Birth', d.countryOfBirth)}${field('City of Birth', d.cityOfBirth)}
  ${field('Lived abroad 6+ months (last 12 months)', d.livedAbroadRecently)}
  ${d.livedAbroadRecently === 'yes' ? field('Country (Abroad)', d.abroadCountry) + field('Address (Abroad)', [d.abroadAddress?.line1, d.abroadAddress?.city, d.abroadAddress?.country].filter(Boolean).join(', ')) + field('Period Abroad', d.abroadDateFrom && d.abroadDateTo ? d.abroadDateFrom + ' \u2013 ' + d.abroadDateTo : '') : ''}
</div>`)}
${section('Contact', `<div class="grid">
  ${field('Email', d.email)}${field('Phone', d.phone ? `${d.phoneCode} ${d.phone}` : '')}
  ${field('WhatsApp', d.phoneIsWhatsApp ? `${d.phoneCode} ${d.phone} (same as phone)` : d.whatsapp ? `${d.whatsappCode} ${d.whatsapp}` : '')}
  ${field('Emergency Contact', d.emergencyContact)}${field('Emergency Phone', d.emergencyPhone)}
</div>`)}
</div>
${d.hasDrivingLicense === 'yes' ? section('Driving License', `<div class="grid">
  ${field('License Number', d.licenseNumber)}${field('Issuing Country', d.licenseCountry)}
  ${field('Categories', d.licenseCategories?.join(', '))}${field('Issue Date', d.licenseIssueDate)}
  ${field('First Issue Date', d.licenseFirstIssueDate)}${field('Expiry', d.licenseNoExpiry ? 'No Expiry' : d.licenseExpiryDate)}
</div>`) : ''}
${d.drivingExpType ? section('Driving Experience', `<div class="grid">
  ${field('Experience Type', d.drivingExpType)}
  ${(d.drivingExpType === 'eu' || d.drivingExpType === 'both') ? field('EU Years', d.euExpYears) + field('EU KM', d.euExpKm) + field('EU Country', d.euExpCountries) : ''}
  ${(d.drivingExpType === 'domestic' || d.drivingExpType === 'both') ? field('Domestic Years', d.domesticExpYears) + field('Domestic KM', d.domesticExpKm) + field('Domestic Country', d.domesticExpCountry) : ''}
  ${field('Transport Types', d.transportTypes?.join(', '))}${field('Truck Brands', d.truckBrands?.join(', '))}
  ${field('Gearbox', d.gearboxType)}
</div>`) : ''}
${d.education.length > 0 ? section('Education', d.education.map(e => `<div class="entry"><div class="entry-title">${e.level || 'Degree'} — ${e.institution || ''}</div>${field('Field', e.fieldOfStudy)}${field('Country', e.country)}${field('Period', [e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' – '))}</div>`).join('')) : ''}
${d.workHistory.length > 0 ? section('Work Experience', d.workHistory.map(w => `<div class="entry"><div class="entry-title">${w.jobTitle || 'Position'} — ${w.company || ''}</div>${field('Country', w.country)}${field('Period', [w.startDate, w.current ? 'Present' : w.endDate].filter(Boolean).join(' – '))}${field('Reason for Leaving', w.reasonForLeaving)}${field('Reference', w.referenceName ? `${w.referenceName} | ${w.referencePhone} | ${w.referenceEmail}` : '')}</div>`).join('')) : ''}
${d.languages.length > 0 ? section('Languages', d.languages.map(l => `<div class="entry"><div class="entry-title">${l.language}${l.motherTongue ? ' (Mother Tongue)' : ''}</div>${field('Speaking', l.speakingLevel)}${field('Reading', l.readingLevel)}${field('Writing', l.writingLevel)}${field('Listening', l.listeningLevel)}</div>`).join('')) : ''}
${d.skills.length > 0 ? section('Skills', `<div class="grid">${d.skills.map(s => field(s.skill, s.level || '—')).join('')}</div>`) : ''}
${section('Additional Information', `<div class="grid">
  ${field('Preferred Start Date', d.preferredStartDate)}${field('Availability', d.availability)}
  ${field('Annual Salary Expectation (EUR)', d.salaryExpectation)}${field('Willing to Relocate', d.willingToRelocate)}
  ${field('Weekend Driving', d.weekendDriving)}${field('Night Driving', d.nightDriving)}
  ${field('How did you hear', d.howDidYouHear)}
</div>`)}
${filesWithData.length > 0 ? section('Uploaded Documents', filesWithData.map(f => `
<div class="entry">
  <div class="entry-title">${f.label} — <span style="font-weight:normal;color:#6b7280;">${f.name}</span></div>
  ${f.isImage && f.dataUrl ? `<img src="${f.dataUrl}" style="max-width:100%;max-height:320px;margin-top:8px;border-radius:4px;border:1px solid #e5e7eb;" />` : ''}
  ${f.isPdf ? `<p style="color:#6b7280;font-size:12px;margin:4px 0 0;">PDF document — open original file to view contents.</p>` : ''}
</div>`).join('')) : ''}
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }
}

function ReviewField({ label, value }: { label: string; value?: string | null | boolean }) {
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  if (!display) return null;
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{display}</p>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-blue-700 border-b border-blue-100 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function Step11Review({ d, u, settings, photoFile, existingPhotoUrl, uploadedFiles = [] }: {
  d: ApplicantFormData;
  u: (fn: (p: ApplicantFormData) => ApplicantFormData) => void;
  settings: FormSettings;
  photoFile?: File | null;
  existingPhotoUrl?: string;
  uploadedFiles?: UploadedFileItem[];
}) {
  const set = (field: keyof ApplicantFormData) => (value: any) => u(prev => ({ ...prev, [field]: value }));
  const previewUrl = photoFile ? URL.createObjectURL(photoFile) : existingPhotoUrl ?? null;

  const STATEMENTS: { field: 'declarationAccepted' | 'agreeDataProcessing' | 'agreeBackground' | 'agreeDataSharing'; label: ReactNode }[] = [
    { field: 'declarationAccepted', label: 'I confirm that all information provided in this application is true, complete and accurate to the best of my knowledge.' },
    {
      field: 'agreeDataProcessing',
      label: (
        <span>
          I consent to the collection and processing of my personal data for recruitment and employment compliance purposes in accordance with applicable data protection legislation.{' '}
          <a href="/data-processing-agreement" target="_blank" rel="noopener noreferrer" className="underline text-blue-700 hover:text-blue-900" onClick={e => e.stopPropagation()}>
            Read the full agreement
          </a>
        </span>
      ),
    },
    { field: 'agreeBackground', label: 'I understand that providing false, misleading or incomplete information may result in my application being rejected or, if employed, in immediate dismissal.' },
    { field: 'agreeDataSharing', label: 'I agree to provide my data and profile to other agencies, partners, or customers of the employer or the purposes of their selection process.' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <SectionTitle title="Review Your Application" subtitle="Please review all details before submitting" />
        <button
          type="button"
          onClick={() => printApplicationSummary(d, uploadedFiles)}
          className="flex items-center gap-2 px-4 py-2 border-2 border-blue-300 rounded-lg text-blue-600 text-sm font-medium hover:border-blue-500 hover:bg-blue-50 transition-all flex-shrink-0"
        >
          <FileText className="w-4 h-4" />
          Download Application
        </button>
      </div>

      {/* Photo */}
      {previewUrl ? (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
          <img src={previewUrl} alt="Applicant photo" className="w-16 h-16 rounded-full object-cover border-2 border-blue-200" />
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Applicant Photo</p>
            <p className="text-sm font-semibold text-green-700 mt-0.5">✓ Photo uploaded</p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">⚠ No photo uploaded — please go back to Tab 1 and upload a photo (required).</p>
        </div>
      )}

      {/* Personal */}
      <ReviewSection title="Personal Information">
        <div className="grid md:grid-cols-2 gap-3">
          <ReviewField label="Full Name" value={[d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ')} />
          <ReviewField label="Date of Birth" value={d.dateOfBirth} />
          <ReviewField label="Gender" value={d.gender} />
          <ReviewField label="Citizenship" value={[d.citizenship, ...(d.otherCitizenships ?? [])].filter(Boolean).join(', ')} />
          <ReviewField label="Country of Birth" value={d.countryOfBirth} />
          <ReviewField label="City of Birth" value={d.cityOfBirth} />
          <ReviewField label="Lived abroad 6+ months (last 12 months)" value={d.livedAbroadRecently} />
          {d.livedAbroadRecently === 'yes' && <>
            <ReviewField label="Country (Abroad)" value={d.abroadCountry} />
            <ReviewField label="Address (Abroad)" value={[d.abroadAddress?.line1, d.abroadAddress?.city, d.abroadAddress?.country].filter(Boolean).join(', ')} />
            <ReviewField label="Period Abroad" value={d.abroadDateFrom && d.abroadDateTo ? `${d.abroadDateFrom} – ${d.abroadDateTo}` : d.abroadDateFrom || d.abroadDateTo} />
          </>}
        </div>
      </ReviewSection>

      {/* Contact */}
      <ReviewSection title="Contact Details">
        <div className="grid md:grid-cols-2 gap-3">
          <ReviewField label="Email" value={d.email} />
          <ReviewField label="Phone" value={d.phone ? `${d.phoneCode} ${d.phone}` : undefined} />
          <ReviewField label="WhatsApp" value={d.phoneIsWhatsApp ? `${d.phoneCode} ${d.phone} (same as phone)` : d.whatsapp ? `${d.whatsappCode} ${d.whatsapp}` : undefined} />
          <ReviewField label="Emergency Contact" value={d.emergencyContact} />
          <ReviewField label="Emergency Phone" value={d.emergencyPhone} />
        </div>
      </ReviewSection>

      {/* Driving License */}
      {d.hasDrivingLicense === 'yes' && (
        <ReviewSection title="Driving License">
          <div className="grid md:grid-cols-2 gap-3">
            <ReviewField label="License Number" value={d.licenseNumber} />
            <ReviewField label="Issuing Country" value={d.licenseCountry} />
            <ReviewField label="Categories" value={d.licenseCategories?.join(', ')} />
            <ReviewField label="First Issue Date" value={d.licenseFirstIssueDate} />
            <ReviewField label="Issue Date" value={d.licenseIssueDate} />
            <ReviewField label="Expiry" value={d.licenseNoExpiry ? 'No Expiry' : d.licenseExpiryDate} />
          </div>
        </ReviewSection>
      )}

      {/* Driving Experience */}
      {d.drivingExpType && (
        <ReviewSection title="Driving Experience">
          <div className="grid md:grid-cols-2 gap-3">
            <ReviewField label="Type" value={d.drivingExpType} />
            {(d.drivingExpType === 'eu' || d.drivingExpType === 'both') && <>
              <ReviewField label="EU Years" value={d.euExpYears} />
              <ReviewField label="EU Total KM" value={d.euExpKm} />
              <ReviewField label="EU Country" value={d.euExpCountries} />
            </>}
            {(d.drivingExpType === 'domestic' || d.drivingExpType === 'both') && <>
              <ReviewField label="Domestic Years" value={d.domesticExpYears} />
              <ReviewField label="Domestic Total KM" value={d.domesticExpKm} />
              <ReviewField label="Domestic Country" value={d.domesticExpCountry} />
            </>}
            <ReviewField label="Transport Types" value={d.transportTypes?.join(', ')} />
            <ReviewField label="Truck Brands" value={d.truckBrands?.join(', ')} />
            <ReviewField label="Gearbox" value={d.gearboxType} />
            <ReviewField label="Traffic Accidents" value={d.trafficAccidents} />
            {d.trafficAccidents === 'yes' && <ReviewField label="Accident Details" value={d.accidentDescription} />}
          </div>
        </ReviewSection>
      )}

      {/* Education */}
      {d.education.length > 0 && (
        <ReviewSection title="Education">
          {d.education.map(e => (
            <div key={e.id} className="p-3 bg-gray-50 rounded-lg space-y-1">
              <p className="text-sm font-semibold text-gray-900">{e.level} — {e.institution}</p>
              {e.fieldOfStudy && <p className="text-xs text-gray-500">{e.fieldOfStudy}</p>}
              {e.country && <p className="text-xs text-gray-500">{e.country} · {e.startDate} – {e.current ? 'Present' : e.endDate}</p>}
            </div>
          ))}
        </ReviewSection>
      )}

      {/* Work History */}
      {d.workHistory.length > 0 && (
        <ReviewSection title="Work Experience">
          {d.workHistory.map(w => (
            <div key={w.id} className="p-3 bg-gray-50 rounded-lg space-y-1">
              <p className="text-sm font-semibold text-gray-900">{w.jobTitle} — {w.company}</p>
              <p className="text-xs text-gray-500">{w.country} · {w.startDate} – {w.current ? 'Present' : w.endDate}</p>
              {w.reasonForLeaving && <p className="text-xs text-gray-500">Left: {w.reasonForLeaving}</p>}
              {w.referenceName && <p className="text-xs text-gray-500">Ref: {w.referenceName} · {w.referencePhone} · {w.referenceEmail}</p>}
            </div>
          ))}
        </ReviewSection>
      )}

      {/* Languages */}
      {d.languages.length > 0 && (
        <ReviewSection title="Languages">
          <div className="grid md:grid-cols-2 gap-3">
            {d.languages.map(l => (
              <div key={l.id} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-semibold text-gray-900">{l.language}{l.motherTongue ? ' (Mother Tongue)' : ''}</p>
                <p className="text-xs text-gray-500 mt-0.5">Speaking: {l.speakingLevel || '—'} · Reading: {l.readingLevel || '—'} · Writing: {l.writingLevel || '—'} · Listening: {l.listeningLevel || '—'}</p>
              </div>
            ))}
          </div>
        </ReviewSection>
      )}

      {/* Skills */}
      {d.skills.length > 0 && (
        <ReviewSection title="Skills">
          <div className="grid md:grid-cols-2 gap-3">
            {d.skills.map(s => (
              <div key={s.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{s.skill}</span>
                {s.level && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{s.level}</span>}
              </div>
            ))}
          </div>
        </ReviewSection>
      )}

      {/* Additional */}
      <ReviewSection title="Additional Information">
        <div className="grid md:grid-cols-2 gap-3">
          <ReviewField label="Preferred Start Date" value={d.preferredStartDate} />
          <ReviewField label="Availability" value={d.availability} />
          <ReviewField label="Annual Salary Expectation (EUR)" value={d.salaryExpectation} />
          <ReviewField label="Willing to Relocate" value={d.willingToRelocate} />
          <ReviewField label="Weekend Driving" value={d.weekendDriving} />
          <ReviewField label="Night Driving" value={d.nightDriving} />
          <ReviewField label="How did you hear about us" value={d.howDidYouHear} />
          {d.additionalNotes && <div className="md:col-span-2"><ReviewField label="Additional Notes" value={d.additionalNotes} /></div>}
        </div>
      </ReviewSection>

      {/* Uploaded Documents */}
      {uploadedFiles.filter(f => f.file).length > 0 && (
        <ReviewSection title="Uploaded Documents">
          <div className="space-y-2">
            {uploadedFiles.filter(f => f.file).map(f => (
              <div key={f.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{f.type || f.sectionKey || 'Document'}</p>
                  <p className="text-xs text-gray-500">{f.file!.name}</p>
                </div>
              </div>
            ))}
          </div>
        </ReviewSection>
      )}

      {/* Declaration */}
      <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-5">
        <div>
          <h4 className="text-sm font-bold text-amber-900 mb-1">Declaration & Agreement</h4>
          <p className="text-xs text-amber-700">You must agree to all statements below before submitting your application.</p>
        </div>
        {settings.declarationText && (
          <p className="text-sm text-amber-800 leading-relaxed border-l-4 border-amber-300 pl-3">{settings.declarationText}</p>
        )}
        <div className="space-y-3">
          {STATEMENTS.map(({ field, label }) => (
            <label key={field} className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${d[field] ? 'bg-green-50 border-green-300' : 'bg-white border-amber-200 hover:border-amber-400'}`}>
              <Checkbox checked={d[field] as boolean} onCheckedChange={c => set(field)(!!c)} className="mt-0.5 shrink-0" />
              <span className="text-sm text-gray-800 leading-relaxed">{label}</span>
            </label>
          ))}
        </div>
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
  jobAdTitle?: string;
  requiredDocuments?: string[];
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
  jobAdTitle,
  requiredDocuments = [],
}: ApplicantFormStepsProps) {
  const actualTab = visibleTabs[currentStep - 1] ?? 1;

  return (
    <>
      {actualTab === 1 && <Step1Personal d={d} u={u} jobTypes={jobTypes} photoFile={photoFile} onPhotoChange={onPhotoChange} existingPhotoUrl={existingPhotoUrl} jobAdTitle={jobAdTitle} />}
      {actualTab === 2 && <Step2Contact d={d} u={u} settings={settings} />}
      {actualTab === 3 && <Step3Identification d={d} u={u} settings={settings} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} requiredDocuments={requiredDocuments} />}
      {actualTab === 4 && <Step4DrivingLicense d={d} u={u} settings={settings} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} requiredDocuments={requiredDocuments} />}
      {actualTab === 5 && <Step5DrivingExperience d={d} u={u} settings={settings} />}
      {actualTab === 6 && <Step6Education d={d} u={u} settings={settings} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />}
      {actualTab === 7 && <Step7WorkHistory d={d} u={u} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />}
      {actualTab === 8 && <Step8Skills d={d} u={u} settings={settings} uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} />}
      {actualTab === 9 && <Step9Additional d={d} u={u} settings={settings} />}
      {actualTab === 10 && <Step10Documents uploadedFiles={uploadedFiles} onFilesChange={onFilesChange} requiredDocuments={requiredDocuments} />}
      {actualTab === 11 && <Step11Review d={d} u={u} settings={settings} photoFile={photoFile} existingPhotoUrl={existingPhotoUrl} uploadedFiles={uploadedFiles} />}
    </>
  );
}
