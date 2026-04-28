/**
 * ApplicationDataView
 * ─────────────────────────────────────────────────────────────────
 * One-stop render of every field the applicant form captures. The
 * Applicant / Candidate / Employee profiles each surface this under a
 * dedicated "Application" tab so operators can see the complete
 * submission without bouncing to the Edit page.
 *
 * Every section is guarded — nothing renders if the underlying fields
 * are empty — so the view stays compact for partial submissions while
 * still growing to a full dossier when the applicant filled in
 * everything.
 */
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  User, Phone, MapPin, Shield, CreditCard, Briefcase, Award,
  Globe, GraduationCap, Star, Info, FileText, Heart,
} from 'lucide-react';

// ── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: ReactNode }) {
  const empty = value === undefined || value === null || value === '' || value === '—';
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${empty ? 'text-muted-foreground italic' : 'font-medium'}`}>
        {empty ? '—' : value}
      </p>
    </div>
  );
}

const yn = (v: any) => v === 'yes' || v === true ? 'Yes' : v === 'no' || v === false ? 'No' : undefined;
const joinSpace = (...parts: any[]) => parts.filter(Boolean).join(' ').trim();
const joinComma = (...parts: any[]) => parts.filter(Boolean).join(', ');
const expiry = (date?: string, noExpiry?: boolean) => noExpiry ? 'No Expiry' : (date || undefined);
const asArray = (v: any): any[] => Array.isArray(v) ? v : [];

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, icon: Icon, children, span,
}: {
  title: string;
  icon: any;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <Card className={span ? 'lg:col-span-2' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-4 h-4" />{title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Renders when any of the provided values is truthy, otherwise returns null.
function hasAny(...vals: any[]): boolean {
  return vals.some(v => Array.isArray(v) ? v.length > 0 : !!v);
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  applicationData?: any;
  /** Already-derived full applicant name for the header. Optional; no
   *  header is rendered when omitted. */
  fullName?: string;
}

export function ApplicationDataView({ applicationData, fullName }: Props) {
  const ad = applicationData ?? {};

  if (!applicationData || Object.keys(ad).length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          No structured application data was captured for this profile.
        </CardContent>
      </Card>
    );
  }

  const educations = asArray(ad.education);
  const workHistory = asArray(ad.workHistory);
  const languages = asArray(ad.languages);
  const skills = asArray(ad.skills);
  const qualifications = asArray(ad.qualifications);
  const otherCitizenships = asArray(ad.otherCitizenships);
  const transportTypes = asArray(ad.transportTypes);
  const truckBrands = asArray(ad.truckBrands);
  const trailerTypes = asArray(ad.trailerTypes);
  const gpsSystems = asArray(ad.selectedGpsSystems);
  const workRegime = asArray(ad.workRegime);
  const licenseCategories = asArray(ad.licenseCategories);

  return (
    <div className="space-y-6">
      {fullName && (
        <div className="text-sm text-muted-foreground">
          Full application submitted by <span className="font-medium text-foreground">{fullName}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Personal ───────────────────────────────────────────── */}
        <Section title="Personal" icon={User} span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="First Name" value={ad.firstName} />
            <Field label="Middle Name" value={ad.middleName} />
            <Field label="Last Name" value={ad.lastName} />
            <Field label="Date of Birth" value={ad.dateOfBirth} />
            <Field label="Gender" value={ad.gender} />
            <Field label="Citizenship" value={ad.citizenship} />
            {otherCitizenships.length > 0 && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-muted-foreground">Other Citizenships</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {otherCitizenships.map((c: string) => <Badge key={c} variant="outline">{c}</Badge>)}
                </div>
              </div>
            )}
            <Field label="Country of Birth" value={ad.countryOfBirth} />
            <Field label="City of Birth" value={ad.cityOfBirth} />
            <Field label="Job Category" value={ad.jobTypeId ? undefined : undefined /* resolved elsewhere */} />
          </div>
        </Section>

        {/* ── Addresses ─────────────────────────────────────────── */}
        {hasAny(ad.homeAddress?.line1, ad.homeAddress?.city, ad.currentAddress?.line1) && (
          <Section title="Addresses" icon={MapPin} span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permanent Address</p>
                <Field label="Street" value={joinComma(ad.homeAddress?.line1, ad.homeAddress?.line2)} />
                <Field label="City" value={ad.homeAddress?.city} />
                <Field label="Postal Code" value={ad.homeAddress?.postalCode} />
                <Field label="Country" value={ad.homeAddress?.country} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Current Address {ad.sameAsHomeAddress && <span className="text-[10px] font-normal normal-case">(same as permanent)</span>}
                </p>
                {ad.sameAsHomeAddress ? (
                  <p className="text-sm text-muted-foreground italic">Same as permanent address</p>
                ) : (
                  <>
                    <Field label="Street" value={joinComma(ad.currentAddress?.line1, ad.currentAddress?.line2)} />
                    <Field label="City" value={ad.currentAddress?.city} />
                    <Field label="Postal Code" value={ad.currentAddress?.postalCode} />
                    <Field label="Country" value={ad.currentAddress?.country} />
                  </>
                )}
              </div>
            </div>

            {ad.livedAbroadRecently === 'yes' && (
              <div className="mt-6 pt-4 border-t space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lived Abroad (last 12 months)</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Field label="Country" value={ad.abroadCountry} />
                  <Field label="From" value={ad.abroadDateFrom} />
                  <Field label="To" value={ad.abroadDateTo} />
                  <Field label="Address" value={joinComma(ad.abroadAddress?.line1, ad.abroadAddress?.city, ad.abroadAddress?.country)} />
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Contact & Communications ─────────────────────────── */}
        <Section title="Contact & Communications" icon={Phone} span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Email" value={ad.email} />
            <Field label="Phone" value={joinSpace(ad.phoneCode, ad.phone)} />
            <Field
              label="WhatsApp"
              value={ad.phoneIsWhatsApp
                ? `${joinSpace(ad.phoneCode, ad.phone)} (same as phone)`
                : joinSpace(ad.whatsappCode, ad.whatsapp)}
            />
            <Field label="Emergency Contact" value={joinSpace(ad.emergencyFirstName, ad.emergencyLastName)} />
            <Field label="Relationship" value={ad.emergencyRelation} />
            <Field label="Emergency Phone" value={joinSpace(ad.emergencyPhoneCode, ad.emergencyPhone)} />
            <Field label="Emergency Email" value={ad.emergencyEmail} />
          </div>
        </Section>

        {/* ── Identification & Legal ───────────────────────────── */}
        <Section title="Identification & Legal" icon={Shield} span>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Passport</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Number" value={ad.passportNumber} />
                <Field label="Issuing Country" value={ad.passportCountry} />
                <Field label="Issue Date" value={ad.passportIssueDate} />
                <Field label="Expiry" value={expiry(ad.passportExpiryDate, ad.passportNoExpiry)} />
              </div>
            </div>

            {ad.hasIdCard === 'yes' && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">National ID Card</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Number" value={ad.idCardNumber} />
                  <Field label="Country" value={ad.idCardCountry} />
                  <Field label="Expiry" value={expiry(ad.idCardExpiryDate, ad.idCardNoExpiry)} />
                </div>
              </div>
            )}

            {ad.hasEuVisa === 'yes' && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">EU Visa</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Type" value={ad.euVisaType} />
                  <Field label="Country" value={ad.euVisaCountry} />
                  <Field label="Number" value={ad.euVisaNumber} />
                  <Field label="Expiry" value={expiry(ad.euVisaExpiryDate, ad.euVisaNoExpiry)} />
                  {ad.purposeOfIssue && <div className="col-span-2 md:col-span-4"><Field label="Purpose of Issue" value={ad.purposeOfIssue} /></div>}
                </div>
              </div>
            )}

            {ad.hasEuResidence === 'yes' && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">EU Residence</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Type" value={ad.euResidenceType} />
                  <Field label="Number" value={ad.euResidenceNumber} />
                  <Field label="Country" value={ad.euResidenceCountry} />
                  <Field label="City" value={ad.euResidenceCity} />
                  <Field label="Issue Date" value={ad.euResidenceIssueDate} />
                  <Field label="Expiry" value={expiry(ad.euResidenceExpiryDate, ad.euResidenceNoExpiry)} />
                </div>
              </div>
            )}

            {ad.hasWorkPermit === 'yes' && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">EU Work Permit</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Type" value={ad.workPermitType} />
                  <Field label="Number" value={ad.workPermitNumber} />
                  <Field label="Country" value={ad.workPermitCountry} />
                  <Field label="Issue Date" value={ad.workPermitIssueDate} />
                  <Field label="Expiry" value={expiry(ad.workPermitExpiryDate, ad.workPermitNoExpiry)} />
                </div>
              </div>
            )}

            {(hasAny(yn(ad.hasHomeCriminalRecord), yn(ad.hasEuCriminalRecord))) && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Criminal Records</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Home Country Record" value={yn(ad.hasHomeCriminalRecord)} />
                  {ad.hasHomeCriminalRecord === 'yes' && <>
                    <Field label="Date of Issue" value={ad.homeCriminalRecordDate} />
                    <Field label="Country of Issue" value={ad.homeCriminalRecordCountry} />
                  </>}
                  <Field label="EU Record" value={yn(ad.hasEuCriminalRecord)} />
                  {ad.hasEuCriminalRecord === 'yes' && <>
                    <Field label="Date of Issue" value={ad.euCriminalRecordDate} />
                    <Field label="Country of Issue" value={ad.euCriminalRecordCountry} />
                  </>}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Driving Licence ──────────────────────────────────── */}
        {ad.hasDrivingLicense === 'yes' && (
          <Section title="Driving Licence" icon={CreditCard}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Number" value={ad.licenseNumber} />
                <Field label="Issuing Country" value={ad.licenseCountry} />
                <Field label="First Issue Date" value={ad.licenseFirstIssueDate} />
                <Field label="Issue Date" value={ad.licenseIssueDate} />
                <Field label="Expiry" value={expiry(ad.licenseExpiryDate, ad.licenseNoExpiry)} />
              </div>
              {licenseCategories.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {licenseCategories.map((c: string) => <Badge key={c} variant="outline">{c}</Badge>)}
                  </div>
                </div>
              )}
              {qualifications.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Professional Qualifications</p>
                  {qualifications.map((q: any, i: number) => (
                    <div key={q.id ?? i} className="p-3 border rounded-md space-y-1">
                      <p className="text-sm font-medium">{q.type || 'Qualification'}{q.number ? ` · ${q.number}` : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {joinComma(q.country, q.issueDate && `Issued ${q.issueDate}`, expiry(q.expiryDate, q.noExpiry) && `Expires ${expiry(q.expiryDate, q.noExpiry)}`)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Driving Experience ───────────────────────────────── */}
        {hasAny(ad.drivingExpType, ad.euExpYears, ad.domesticExpYears) && (
          <Section title="Driving Experience" icon={Briefcase}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Experience Type" value={ad.drivingExpType} />
                <Field label="Gearbox" value={ad.gearboxType} />
                {(ad.drivingExpType === 'eu' || ad.drivingExpType === 'both') && <>
                  <Field label="EU Years" value={ad.euExpYears} />
                  <Field label="EU Total KM" value={ad.euExpKm} />
                  <Field label="EU Countries" value={ad.euExpCountries} />
                </>}
                {(ad.drivingExpType === 'domestic' || ad.drivingExpType === 'both') && <>
                  <Field label="Domestic Years" value={ad.domesticExpYears} />
                  <Field label="Domestic KM" value={ad.domesticExpKm} />
                  <Field label="Domestic Country" value={ad.domesticExpCountry} />
                </>}
                <Field label="Traffic Accidents (3 yrs)" value={yn(ad.trafficAccidents)} />
              </div>
              {ad.trafficAccidents === 'yes' && ad.accidentDescription && (
                <Field label="Accident Description" value={ad.accidentDescription} />
              )}
              {transportTypes.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Transport Types</p>
                  <div className="flex flex-wrap gap-1.5">{transportTypes.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                </div>
              )}
              {truckBrands.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Truck Brands</p>
                  <div className="flex flex-wrap gap-1.5">{truckBrands.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                  {ad.otherBrand && <p className="text-xs text-muted-foreground mt-1">Other: {ad.otherBrand}</p>}
                </div>
              )}
              {trailerTypes.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Trailer Types</p>
                  <div className="flex flex-wrap gap-1.5">{trailerTypes.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                  {ad.mostUsedTrailer && <p className="text-xs text-muted-foreground mt-1">Most used: {ad.mostUsedTrailer}</p>}
                </div>
              )}
              {gpsSystems.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">GPS Systems</p>
                  <div className="flex flex-wrap gap-1.5">{gpsSystems.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                </div>
              )}
              {workRegime.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Work Regime</p>
                  <div className="flex flex-wrap gap-1.5">{workRegime.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Education ────────────────────────────────────────── */}
        {educations.length > 0 && (
          <Section title="Education" icon={GraduationCap} span>
            <div className="space-y-3">
              {educations.map((e: any, i: number) => (
                <div key={e.id ?? i} className="p-3 border rounded-md">
                  <p className="text-sm font-semibold">{e.level || e.degree || 'Education'} — {e.institution || ''}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    <Field label="Field of Study" value={e.fieldOfStudy} />
                    <Field label="Country" value={e.country} />
                    <Field label="Start Date" value={e.startDate} />
                    <Field label="End Date" value={e.current || e.ongoing ? 'Ongoing' : e.endDate} />
                  </div>
                  {e.degree && e.level !== e.degree && <Field label="Degree / Certificate" value={e.degree} />}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Work History ─────────────────────────────────────── */}
        {workHistory.length > 0 && (
          <Section title="Work Experience" icon={Briefcase} span>
            <div className="space-y-3">
              {workHistory.map((w: any, i: number) => (
                <div key={w.id ?? i} className="p-3 border rounded-md">
                  <p className="text-sm font-semibold">{w.jobTitle || 'Position'} — {w.company || ''}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    <Field label="Country" value={w.country} />
                    <Field label="Start" value={w.startDate} />
                    <Field label="End" value={w.current ? 'Current' : w.endDate} />
                    <Field label="Company Phone" value={joinSpace(w.companyPhoneCode, w.companyPhone)} />
                  </div>
                  {w.responsibilities && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Responsibilities</p>
                      <p className="text-sm whitespace-pre-wrap">{w.responsibilities}</p>
                    </div>
                  )}
                  {w.reasonForLeaving && (
                    <Field label="Reason for Leaving" value={w.reasonForLeaving} />
                  )}
                  {(w.referenceName || w.referencePhone || w.referenceEmail) && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Reference</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Name" value={w.referenceName} />
                        <Field label="Phone" value={joinSpace(w.referencePhoneCode, w.referencePhone)} />
                        <Field label="Email" value={w.referenceEmail} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Languages ────────────────────────────────────────── */}
        {languages.length > 0 && (
          <Section title="Languages" icon={Globe}>
            <div className="space-y-2">
              {languages.map((l: any, i: number) => (
                <div key={l.id ?? i} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="text-sm font-medium">{l.language}{l.motherTongue ? ' (Mother Tongue)' : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {joinComma(
                        l.speakingLevel && `Speaking: ${l.speakingLevel}`,
                        l.readingLevel && `Reading: ${l.readingLevel}`,
                        l.writingLevel && `Writing: ${l.writingLevel}`,
                        l.listeningLevel && `Listening: ${l.listeningLevel}`,
                        l.proficiency,
                      )}
                    </p>
                  </div>
                  {l.hasCertificate && <Badge variant="outline">Certificate</Badge>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Skills ───────────────────────────────────────────── */}
        {skills.length > 0 && (
          <Section title="Skills" icon={Star}>
            <div className="flex flex-wrap gap-2">
              {skills.map((s: any, i: number) => (
                <Badge key={s.id ?? i} variant="outline" className="text-sm">
                  {s.skill}{s.level ? ` · ${s.level}` : ''}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {/* ── First Aid & Tools ────────────────────────────────── */}
        {hasAny(yn(ad.hasFirstAid), ad.toolsDescription) && (
          <Section title="First Aid & Tools" icon={Heart}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Aid Certificate" value={yn(ad.hasFirstAid)} />
                {ad.hasFirstAid === 'yes' && (
                  <Field label="Expiry" value={expiry(ad.firstAidExpiry, ad.firstAidNoExpiry)} />
                )}
              </div>
              {ad.toolsDescription && (
                <div>
                  <p className="text-xs text-muted-foreground">Tools & Equipment</p>
                  <p className="text-sm whitespace-pre-wrap">{ad.toolsDescription}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Work Preferences ─────────────────────────────────── */}
        <Section title="Work Preferences" icon={Award}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Preferred Start Date" value={ad.preferredStartDate} />
            <Field label="Availability" value={ad.availability} />
            <Field label="Willing to Relocate" value={yn(ad.willingToRelocate)} />
            <Field label="Preferred Locations" value={ad.preferredLocations} />
            <Field label="Weekend Driving" value={yn(ad.weekendDriving)} />
            <Field label="Night Driving" value={yn(ad.nightDriving)} />
            <Field label="Salary Expectation" value={ad.salaryExpectation} />
            <Field label="How Did You Hear" value={ad.howDidYouHear} />
          </div>
        </Section>

        {/* ── Additional Notes ─────────────────────────────────── */}
        {ad.additionalNotes && (
          <Section title="Additional Notes" icon={Info} span>
            <p className="text-sm whitespace-pre-wrap">{ad.additionalNotes}</p>
          </Section>
        )}

        {/* ── Declarations ─────────────────────────────────────── */}
        {hasAny(ad.declarationAccepted, ad.agreeDataProcessing, ad.agreeBackground, ad.agreeDataSharing) && (
          <Section title="Declarations & Consent" icon={FileText} span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Truthful information" value={ad.declarationAccepted ? '✓ Agreed' : '✗ Not agreed'} />
              <Field label="Data processing consent" value={ad.agreeDataProcessing ? '✓ Agreed' : '✗ Not agreed'} />
              <Field label="Background declaration" value={ad.agreeBackground ? '✓ Agreed' : '✗ Not agreed'} />
              <Field label="Data sharing with partners" value={ad.agreeDataSharing ? '✓ Agreed' : '✗ Not agreed'} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
