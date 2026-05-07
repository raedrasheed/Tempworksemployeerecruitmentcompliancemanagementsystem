import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShieldOff, Camera, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { CountrySelect } from '../../components/ui/CountrySelect';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { toast } from 'sonner';
import { usersApi, rolesApi, agenciesApi, settingsApi, getCurrentUser } from '../../services/api';
import { apiError } from '../../../i18n/apiError';
import { useValidationErrors } from '../../../i18n/useValidationErrors';
import { FieldError } from '../../components/ui/field-error';
import { ValidationSummary } from '../../components/ui/validation-summary';

const GENDER_VALUES = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const GENDER_KEYS: Record<string, string> = {
  MALE: 'male', FEMALE: 'female', OTHER: 'other', PREFER_NOT_TO_SAY: 'preferNotToSay',
};
const LANGUAGES = ['English', 'Arabic', 'Polish', 'German', 'French', 'Spanish', 'Italian', 'Romanian', 'Ukrainian'];
const TIMEZONES = [
  'UTC', 'Europe/London', 'Europe/Warsaw', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Bucharest', 'Europe/Kiev',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Dubai', 'Asia/Riyadh',
];

export function AddUser() {
  const { t } = useTranslation('pages');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const currentUser = getCurrentUser();
  const isAgencyManager = currentUser?.role === 'Agency Manager';

  const [roles, setRoles] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [myAgency, setMyAgency] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agencyUserCount, setAgencyUserCount] = useState<number | null>(null);
  const [maxUsersLimit, setMaxUsersLimit] = useState<number | null>(null);
  const [sendActivationEmail, setSendActivationEmail] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { errors: fieldErrs, setFromError, clearAll: clearFieldErrors, clearError } = useValidationErrors();

  const [form, setForm] = useState({
    // Identity
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    // Work Information
    roleId: '',
    agencyId: isAgencyManager ? (currentUser?.agencyId ?? '') : '',
    jobTitle: '',
    department: '',
    startDate: '',
    status: 'PENDING',
    // Personal Details
    dateOfBirth: '',
    gender: '',
    citizenship: '',
    phone: '',
    // Address
    addressLine1: '',
    addressLine2: '',
    city: '',
    country: '',
    postalCode: '',
    // Preferences
    preferredLanguage: 'English',
    timeZone: 'Europe/London',
    // Auth
    password: '',
  });

  useEffect(() => {
    if (isAgencyManager && currentUser?.agencyId) {
      // Agency Manager can't call GET /roles (403) and always creates
      // "Agency User" anyway — the backend force-overrides roleId.
      // Skip the roles fetch entirely, show "Agency User" as the
      // locked label, and pull only the own-agency + limit info.
      setRoles([{ id: '__agency_user__', name: 'Agency User' }]);
      setForm(prev => prev.roleId ? prev : { ...prev, roleId: '__agency_user__' });
      Promise.all([
        agenciesApi.get(currentUser.agencyId).catch(() => null),
        usersApi.list({ agencyId: currentUser.agencyId, limit: 1 }).catch(() => null),
        settingsApi.getAll(true).catch(() => null),
      ]).then(([agency, usersResult, settingsResult]) => {
        if (agency) setMyAgency(agency);
        if (usersResult) setAgencyUserCount((usersResult as any)?.total ?? 0);
        if (settingsResult) {
          const agencySettings: any[] = (settingsResult as any)?.agency ?? [];
          const s = agencySettings.find((x: any) => x.key === 'agency.maxUsersPerAgency');
          if (s) setMaxUsersLimit(parseInt(s.value, 10));
        }
      });
      return;
    }

    Promise.all([rolesApi.list(), agenciesApi.list({ limit: 100 })])
      .then(([roleList, agencyResult]) => {
        setRoles(Array.isArray(roleList) ? roleList : []);
        setAgencies((agencyResult as any)?.data ?? []);
      }).catch(() => {
        toast.error(t('users.add.loadFailed'));
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
    if (fieldErrs[e.target.id]) clearError(e.target.id);
  };

  const handleSelect = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (fieldErrs[field]) clearError(field);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFieldErrors();
    if (!form.roleId) {
      toast.error(t('users.add.selectRole'));
      return;
    }
    if (!form.agencyId) {
      toast.error(t('users.add.selectAgency'));
      return;
    }
    if (!sendActivationEmail && !form.password) {
      toast.error(t('users.add.passwordRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        email: form.email,
        roleId: form.roleId,
        agencyId: form.agencyId,
        jobTitle: form.jobTitle || undefined,
        department: form.department || undefined,
        startDate: form.startDate || undefined,
        status: form.status,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        citizenship: form.citizenship || undefined,
        phone: form.phone || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        postalCode: form.postalCode || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        timeZone: form.timeZone || undefined,
        sendActivationEmail,
      };
      if (!sendActivationEmail && form.password) {
        payload.password = form.password;
      }

      const newUser = await usersApi.create(payload);
      if (photoFile && newUser?.id) {
        await usersApi.uploadPhoto(newUser.id, photoFile);
      }
      toast.success(t('users.add.createSuccess'));
      navigate('/dashboard/users');
    } catch (err: any) {
      const wasValidation = setFromError(err);
      if (!wasValidation) {
        toast.error(apiError(err, t('users.add.createFailed')));
      } else {
        toast.error(apiError(err, t('users.add.createFailed')));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate('users')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <ShieldOff className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold text-[#0F172A]">{tc('permissions.accessDenied')}</p>
        <p className="text-sm">{tc('permissions.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/users"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">{t('users.add.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('users.add.subtitle')}</p>
        </div>
      </div>

      {isAgencyManager && maxUsersLimit !== null && agencyUserCount !== null && (
        <div className={`max-w-2xl rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
          agencyUserCount >= maxUsersLimit
            ? 'border-[#EF4444] bg-[#FEF2F2] text-[#EF4444]'
            : 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
        }`}>
          <span className="font-medium">
            {agencyUserCount >= maxUsersLimit
              ? t('users.add.userLimitReached', { count: agencyUserCount, limit: maxUsersLimit })
              : t('users.add.usersOf', { count: agencyUserCount, limit: maxUsersLimit })}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">

          <ValidationSummary errors={fieldErrs} />

          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>{t('users.form.identity')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt={t('users.form.preview')} className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-7 h-7 text-gray-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('users.form.photoLabel')}</p>
                  <p className="text-xs text-muted-foreground">{t('users.form.photoHint')}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()}>
                      <Camera className="w-3.5 h-3.5 me-1" />
                      {photoPreview ? t('users.form.photoChange') : t('users.form.photoUpload')}
                    </Button>
                    {photoPreview && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('users.form.firstName')}</Label>
                  <Input id="firstName" placeholder={t('users.form.firstNamePh')} value={form.firstName} onChange={handleChange} required
                    aria-invalid={!!fieldErrs.firstName}
                    className={fieldErrs.firstName ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  <FieldError errors={fieldErrs} name="firstName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">{t('users.form.middleName')}</Label>
                  <Input id="middleName" placeholder={t('users.form.middleNamePh')} value={form.middleName} onChange={handleChange}
                    aria-invalid={!!fieldErrs.middleName}
                    className={fieldErrs.middleName ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  <FieldError errors={fieldErrs} name="middleName" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('users.form.lastName')}</Label>
                <Input id="lastName" placeholder={t('users.form.lastNamePh')} value={form.lastName} onChange={handleChange} required
                  aria-invalid={!!fieldErrs.lastName}
                  className={fieldErrs.lastName ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                <FieldError errors={fieldErrs} name="lastName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('users.form.email')}</Label>
                <Input id="email" type="email" placeholder={t('users.form.emailPh')} value={form.email} onChange={handleChange} required
                  aria-invalid={!!fieldErrs.email}
                  className={fieldErrs.email ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                <FieldError errors={fieldErrs} name="email" />
              </div>
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('users.form.workInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('users.form.role')}</Label>
                {isAgencyManager ? (
                  <Input
                    value={roles[0]?.name ?? t('users.form.loadingShort')}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                ) : (
                  <Select value={form.roleId} onValueChange={val => handleSelect('roleId', val)} required>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.form.selectRole')} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.length > 0 ? (
                        roles.map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="placeholder" disabled>{t('users.form.loadingRoles')}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('users.form.agency')}</Label>
                {isAgencyManager ? (
                  <Input
                    value={myAgency ? `${myAgency.name} — ${myAgency.country}` : t('users.form.loadingShort')}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                ) : (
                  <Select value={form.agencyId} onValueChange={val => handleSelect('agencyId', val)} required>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.form.selectAgency')} />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies.length > 0 ? (
                        agencies.map((agency: any) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name} — {agency.country}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="placeholder" disabled>{t('users.form.loadingAgencies')}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">{t('users.form.jobTitle')}</Label>
                  <Input id="jobTitle" placeholder={t('users.form.jobTitlePh')} value={form.jobTitle} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">{t('users.form.department')}</Label>
                  <Input id="department" placeholder={t('users.form.departmentPh')} value={form.department} onChange={handleChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t('users.form.startDate')}</Label>
                  <Input id="startDate" type="date" value={form.startDate} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>{t('users.form.status')}</Label>
                  <Select value={form.status} onValueChange={val => handleSelect('status', val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t('users.form.statusOptions.ACTIVE')}</SelectItem>
                      <SelectItem value="INACTIVE">{t('users.form.statusOptions.INACTIVE')}</SelectItem>
                      <SelectItem value="SUSPENDED">{t('users.form.statusOptions.SUSPENDED')}</SelectItem>
                      <SelectItem value="PENDING">{t('users.form.statusOptions.PENDING')}</SelectItem>
                      <SelectItem value="TERMINATED">{t('users.form.statusOptions.TERMINATED')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('users.form.personal')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">{t('users.form.dateOfBirth')}</Label>
                  <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>{t('users.form.gender')}</Label>
                  <Select value={form.gender} onValueChange={val => handleSelect('gender', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.form.selectGender')} />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_VALUES.map(v => (
                        <SelectItem key={v} value={v}>{t(`users.form.genders.${GENDER_KEYS[v]}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('users.form.citizenship')}</Label>
                  <CountrySelect
                    value={form.citizenship}
                    onChange={(v) => handleSelect('citizenship', v)}
                    placeholder={t('users.form.selectCitizenship')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('users.form.phone')}</Label>
                  <PhoneInput
                    id="phone"
                    value={form.phone}
                    onChange={(v) => handleSelect('phone', v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>{t('users.form.address')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">{t('users.form.addressLine1')}</Label>
                <Input id="addressLine1" placeholder={t('users.form.addressLine1Ph')} value={form.addressLine1} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">{t('users.form.addressLine2')}</Label>
                <Input id="addressLine2" placeholder={t('users.form.addressLine2Ph')} value={form.addressLine2} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('users.form.city')}</Label>
                  <Input id="city" placeholder={t('users.form.cityPh')} value={form.city} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>{t('users.form.country')}</Label>
                  <CountrySelect
                    value={form.country}
                    onChange={(v) => handleSelect('country', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">{t('users.form.postalCode')}</Label>
                  <Input id="postalCode" placeholder={t('users.form.postalCodePh')} value={form.postalCode} onChange={handleChange} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>{t('users.form.preferences')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('users.form.preferredLanguage')}</Label>
                  <Select value={form.preferredLanguage} onValueChange={val => handleSelect('preferredLanguage', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.form.selectLanguage')} />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('users.form.timeZone')}</Label>
                  <Select value={form.timeZone} onValueChange={val => handleSelect('timeZone', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.form.selectTimeZone')} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Setup */}
          <Card>
            <CardHeader>
              <CardTitle>{t('users.form.accountSetup')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="sendActivationEmail"
                  checked={sendActivationEmail}
                  onCheckedChange={(checked) => setSendActivationEmail(!!checked)}
                />
                <div>
                  <Label htmlFor="sendActivationEmail" className="cursor-pointer font-medium">
                    {t('users.form.sendActivationEmail')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('users.form.sendActivationHelp')}
                  </p>
                </div>
              </div>

              {!sendActivationEmail && (
                <div className="space-y-2">
                  <Label htmlFor="password">{t('users.form.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('users.form.passwordPh')}
                    value={form.password}
                    onChange={handleChange}
                    aria-invalid={!!fieldErrs.password}
                    className={fieldErrs.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    required={!sendActivationEmail}
                    minLength={8}
                  />
                  <FieldError errors={fieldErrs} name="password" />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting || (isAgencyManager && maxUsersLimit !== null && agencyUserCount !== null && agencyUserCount >= maxUsersLimit)}
            >
              {submitting ? tc('states.saving') : t('users.add.submit')}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard/users">{tc('actions.cancel')}</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
