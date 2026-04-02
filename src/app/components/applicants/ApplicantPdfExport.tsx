/**
 * Applicant PDF Export
 * Generates a structured PDF of the applicant application data and
 * optionally merges selected uploaded documents into the same file.
 */
import { useState } from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { FileText, Download, Loader2, X, CheckSquare, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');

// ── PDF Styles ────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 36, color: '#1a1a2e', backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottom: '2pt solid #2563EB' },
  headerLeft: { flex: 1 },
  headerPhoto: { width: 64, height: 64, borderRadius: 32, border: '2pt solid #2563EB', objectFit: 'cover' },
  appTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2563EB', marginBottom: 2 },
  appSubtitle: { fontSize: 9, color: '#64748b' },
  appDate: { fontSize: 8, color: '#94a3b8', marginTop: 4 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2563EB', marginBottom: 6, paddingBottom: 3, borderBottom: '1pt solid #dbeafe' },
  subTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', marginTop: 6, marginBottom: 3 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  field: { width: '50%', marginBottom: 5, paddingRight: 8 },
  fieldFull: { width: '100%', marginBottom: 5 },
  label: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 1 },
  value: { fontSize: 9, color: '#1e293b' },
  valueMuted: { fontSize: 9, color: '#94a3b8', fontStyle: 'italic' },
  badge: { backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginRight: 3, marginBottom: 3 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  entryBox: { border: '1pt solid #e2e8f0', borderRadius: 4, padding: 8, marginBottom: 6 },
  entryNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', marginBottom: 4 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1pt solid #e2e8f0', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#94a3b8' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const F = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={S.field}>
    <Text style={S.label}>{label}</Text>
    <Text style={value ? S.value : S.valueMuted}>{value || '—'}</Text>
  </View>
);

const FF = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={S.fieldFull}>
    <Text style={S.label}>{label}</Text>
    <Text style={value ? S.value : S.valueMuted}>{value || '—'}</Text>
  </View>
);

const yn = (v: string | boolean | undefined) =>
  v === 'yes' || v === true ? 'Yes' : v === 'no' || v === false ? 'No' : '—';

// ── PDF Document ──────────────────────────────────────────────────────────────

function ApplicantPDF({ applicant, photoDataUrl }: { applicant: any; photoDataUrl?: string }) {
  const ad = applicant.applicationData ?? {};
  const now = new Date().toLocaleDateString('en-GB');

  return (
    <Document title={`${applicant.fullName} — Application`}>
      {/* ── Page 1: Personal + Contact + Identification ── */}
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.appTitle}>{applicant.fullName}</Text>
            <Text style={S.appSubtitle}>Applicant ID: {applicant.id}</Text>
            <Text style={S.appDate}>Applied: {applicant.applicationDate} · Generated: {now}</Text>
          </View>
          {photoDataUrl && <Image src={photoDataUrl} style={S.headerPhoto} />}
        </View>

        {/* Personal */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Personal Information</Text>
          <View style={S.grid2}>
            <F label="First Name" value={applicant.firstName} />
            <F label="Last Name" value={applicant.lastName} />
            <F label="Middle Name" value={applicant.middleName} />
            <F label="Gender" value={ad.gender} />
            <F label="Date of Birth" value={ad.dateOfBirth || applicant.dateOfBirth} />
            <F label="Country of Birth" value={ad.countryOfBirth || applicant.countryOfBirth} />
            <F label="City of Birth" value={ad.cityOfBirth || applicant.cityOfBirth} />
            <F label="Citizenship" value={ad.citizenship || applicant.citizenship} />
            <F label="Job Type" value={applicant.jobType?.name} />
            <F label="Preferred Start Date" value={applicant.preferredStartDate} />
            <F label="Availability" value={applicant.availability} />
            <F label="Willing to Relocate" value={yn(applicant.willingToRelocate)} />
          </View>
          {applicant.preferredLocations && <FF label="Preferred Locations" value={applicant.preferredLocations} />}
          {applicant.salaryExpectation && <FF label="Salary Expectation" value={applicant.salaryExpectation} />}
        </View>

        {/* Contact */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Contact Details</Text>
          <View style={S.grid2}>
            <F label="Email" value={applicant.email} />
            <F label="Phone" value={applicant.phone} />
          </View>
          {(ad.homeAddress?.addressLine1 || ad.currentAddress?.addressLine1) && (
            <>
              {ad.homeAddress?.addressLine1 && (
                <>
                  <Text style={S.subTitle}>Home Address</Text>
                  <View style={S.grid2}>
                    <FF label="Address" value={[ad.homeAddress.addressLine1, ad.homeAddress.addressLine2].filter(Boolean).join(', ')} />
                    <F label="City" value={ad.homeAddress.city} />
                    <F label="Postal Code" value={ad.homeAddress.postalCode} />
                    <F label="Country" value={ad.homeAddress.country} />
                  </View>
                </>
              )}
            </>
          )}
          {ad.emergencyFirstName && (
            <>
              <Text style={S.subTitle}>Emergency Contact</Text>
              <View style={S.grid2}>
                <F label="Name" value={`${ad.emergencyFirstName} ${ad.emergencyLastName}`} />
                <F label="Relationship" value={ad.emergencyRelation} />
                <F label="Phone" value={`${ad.emergencyPhoneCode ?? ''} ${ad.emergencyPhone ?? ''}`.trim()} />
                <F label="Email" value={ad.emergencyEmail} />
              </View>
            </>
          )}
        </View>

        {/* Identification */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Identification & Legal Status</Text>
          <Text style={S.subTitle}>Passport</Text>
          <View style={S.grid2}>
            <F label="Passport Number" value={ad.passportNumber} />
            <F label="Issuing Country" value={ad.passportCountry} />
            <F label="Issue Date" value={ad.passportIssueDate} />
            <F label="Expiry Date" value={ad.passportNoExpiry ? 'No Expiry' : ad.passportExpiryDate} />
          </View>
          {ad.hasIdCard === 'yes' && (
            <>
              <Text style={S.subTitle}>National ID Card</Text>
              <View style={S.grid2}>
                <F label="ID Number" value={ad.idCardNumber} />
                <F label="Country" value={ad.idCardCountry} />
                <F label="Expiry" value={ad.idCardNoExpiry ? 'No Expiry' : ad.idCardExpiryDate} />
              </View>
            </>
          )}
          {ad.hasEuVisa === 'yes' && (
            <>
              <Text style={S.subTitle}>EU Visa</Text>
              <View style={S.grid2}>
                <F label="Type" value={ad.euVisaType} />
                <F label="Issuing Country" value={ad.euVisaCountry} />
                <F label="Number" value={ad.euVisaNumber} />
                <F label="Expiry" value={ad.euVisaNoExpiry ? 'No Expiry' : ad.euVisaExpiryDate} />
                {ad.purposeOfIssue && <FF label="Purpose of Issue" value={ad.purposeOfIssue} />}
              </View>
            </>
          )}
          {ad.hasEuResidence === 'yes' && (
            <>
              <Text style={S.subTitle}>EU Residence Permit</Text>
              <View style={S.grid2}>
                <F label="Permit Number" value={ad.euResidenceNumber} />
                <F label="Country" value={ad.euResidenceCountry} />
                <F label="Expiry" value={ad.euResidenceNoExpiry ? 'No Expiry' : ad.euResidenceExpiryDate} />
              </View>
            </>
          )}
          {ad.hasWorkPermit === 'yes' && (
            <>
              <Text style={S.subTitle}>EU Work Permit</Text>
              <View style={S.grid2}>
                <F label="Type" value={ad.workPermitType} />
                <F label="Number" value={ad.workPermitNumber} />
                <F label="Country" value={ad.workPermitCountry} />
                <F label="Expiry" value={ad.workPermitNoExpiry ? 'No Expiry' : ad.workPermitExpiryDate} />
              </View>
            </>
          )}
          <View style={S.grid2}>
            <F label="Home Country Criminal Record" value={yn(ad.hasHomeCriminalRecord)} />
            {ad.hasHomeCriminalRecord === 'yes' && <F label="Date of Issue" value={ad.homeCriminalRecordDate} />}
            {ad.hasHomeCriminalRecord === 'yes' && <F label="Country of Issue" value={ad.homeCriminalRecordCountry} />}
            <F label="EU Criminal Record" value={yn(ad.hasEuCriminalRecord)} />
            {ad.hasEuCriminalRecord === 'yes' && <F label="Date of Issue" value={ad.euCriminalRecordDate} />}
            {ad.hasEuCriminalRecord === 'yes' && <F label="Country of Issue" value={ad.euCriminalRecordCountry} />}
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>TempWorks Europe — Confidential</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── Page 2: Driving + Education + Work ── */}
      <Page size="A4" style={S.page}>
        {/* Driving License */}
        {ad.hasDrivingLicense === 'yes' && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Driving License</Text>
            <View style={S.grid2}>
              <F label="License Number" value={ad.licenseNumber} />
              <F label="Issuing Country" value={ad.licenseCountry} />
              <F label="Issue Date" value={ad.licenseIssueDate} />
              <F label="Expiry" value={ad.licenseNoExpiry ? 'No Expiry' : ad.licenseExpiryDate} />
            </View>
            {ad.licenseCategories?.length > 0 && (
              <>
                <Text style={S.subTitle}>Categories</Text>
                <View style={S.badgesRow}>
                  {ad.licenseCategories.map((c: string) => <Text key={c} style={S.badge}>{c}</Text>)}
                </View>
              </>
            )}
            {ad.qualifications?.length > 0 && (
              <>
                <Text style={S.subTitle}>Professional Qualifications</Text>
                {ad.qualifications.map((q: any, i: number) => (
                  <View key={i} style={S.entryBox}>
                    <View style={S.grid2}>
                      <F label="Type" value={q.type} />
                      <F label="Country" value={q.country} />
                      <F label="Issue Date" value={q.issueDate} />
                      <F label="Expiry" value={q.noExpiry ? 'No Expiry' : q.expiryDate} />
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Education */}
        {ad.education?.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Education</Text>
            {ad.education.map((e: any, i: number) => (
              <View key={i} style={S.entryBox}>
                <Text style={S.entryNum}>Entry {i + 1}</Text>
                <View style={S.grid2}>
                  <F label="Level" value={e.level} />
                  <F label="Institution" value={e.institution} />
                  <F label="Field of Study" value={e.fieldOfStudy} />
                  <F label="Country" value={e.country} />
                  <F label="Start Date" value={e.startDate} />
                  <F label="End Date" value={e.ongoing ? 'Ongoing' : e.endDate} />
                  <FF label="Degree / Certificate" value={e.degree} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Work History */}
        {ad.workHistory?.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Work Experience</Text>
            {ad.workHistory.map((w: any, i: number) => (
              <View key={i} style={S.entryBox}>
                <Text style={S.entryNum}>Position {i + 1}</Text>
                <View style={S.grid2}>
                  <F label="Company" value={w.company} />
                  <F label="Job Title" value={w.jobTitle} />
                  <F label="Country" value={w.country} />
                  <F label="Start Date" value={w.startDate} />
                  <F label="End Date" value={w.current ? 'Current' : w.endDate} />
                </View>
                {w.responsibilities && <FF label="Responsibilities" value={w.responsibilities} />}
                {w.references && <FF label="References" value={w.references} />}
              </View>
            ))}
          </View>
        )}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>TempWorks Europe — Confidential</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── Page 3: Skills + Additional + Declaration ── */}
      <Page size="A4" style={S.page}>
        {/* Skills */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Skills & Qualifications</Text>
          {ad.languages?.length > 0 && (
            <>
              <Text style={S.subTitle}>Languages</Text>
              {ad.languages.map((l: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                  <Text style={{ ...S.value, width: '30%' }}>{l.language}</Text>
                  <Text style={{ ...S.valueMuted, width: '30%' }}>{l.proficiency}</Text>
                  {l.hasCertificate && <Text style={{ ...S.badge }}>Certificate</Text>}
                </View>
              ))}
            </>
          )}
          {ad.computerSkills?.length > 0 && (
            <>
              <Text style={S.subTitle}>Computer Skills</Text>
              <View style={S.badgesRow}>
                {ad.computerSkills.map((s: string) => <Text key={s} style={S.badge}>{s}</Text>)}
              </View>
            </>
          )}
          {ad.softSkills?.length > 0 && (
            <>
              <Text style={S.subTitle}>Soft Skills</Text>
              <View style={S.badgesRow}>
                {ad.softSkills.map((s: string) => <Text key={s} style={S.badge}>{s}</Text>)}
              </View>
            </>
          )}
          <View style={S.grid2}>
            <F label="First Aid Certificate" value={yn(ad.hasFirstAid)} />
            {ad.hasFirstAid === 'yes' && <F label="First Aid Expiry" value={ad.firstAidNoExpiry ? 'No Expiry' : ad.firstAidExpiry} />}
          </View>
          {ad.toolsDescription && <FF label="Tools & Equipment" value={ad.toolsDescription} />}
        </View>

        {/* Additional */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Additional Information</Text>
          <View style={S.grid2}>
            <F label="How Did You Hear" value={ad.howDidYouHear} />
            <F label="Additional Notes" value={ad.additionalNotes} />
          </View>
        </View>

        {/* Declaration */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Declaration</Text>
          <View style={S.grid2}>
            <F label="Information Declaration" value={ad.declarationAccepted ? '✓ Agreed' : '✗ Not agreed'} />
            <F label="Data Processing Consent" value={ad.agreeDataProcessing ? '✓ Agreed' : '✗ Not agreed'} />
            <F label="Background Declaration" value={ad.agreeBackground ? '✓ Agreed' : '✗ Not agreed'} />
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>TempWorks Europe — Confidential</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ── Export Dialog ─────────────────────────────────────────────────────────────

interface Props {
  applicant: any;
  documents: any[];
}

export function ApplicantPdfExportButton({ applicant, documents }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectAll = () => setSelectedDocs(new Set(documents.map(d => d.id)));
  const clearAll = () => setSelectedDocs(new Set());

  const handleExport = async () => {
    setGenerating(true);
    try {
      // 1. Load photo if available
      let photoDataUrl: string | undefined;
      if (applicant.photoUrl) {
        try {
          const res = await fetch(`${API_BASE}${applicant.photoUrl}`);
          const blob = await res.blob();
          photoDataUrl = await new Promise<string>(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.readAsDataURL(blob);
          });
        } catch { /* photo optional */ }
      }

      // 2. Generate applicant PDF
      const appPdfBlob = await pdf(<ApplicantPDF applicant={applicant} photoDataUrl={photoDataUrl} />).toBlob();

      if (selectedDocs.size === 0) {
        // No extra docs — download as-is
        downloadBlob(appPdfBlob, `${applicant.fullName}_Application.pdf`);
        setOpen(false);
        return;
      }

      // 3. Merge with selected documents using pdf-lib
      const mergedPdf = await PDFDocument.create();

      // Add applicant PDF pages
      const appPdfBytes = await appPdfBlob.arrayBuffer();
      const appPdfDoc = await PDFDocument.load(appPdfBytes);
      const appPages = await mergedPdf.copyPages(appPdfDoc, appPdfDoc.getPageIndices());
      appPages.forEach(p => mergedPdf.addPage(p));

      // Add each selected document
      const docsToMerge = documents.filter(d => selectedDocs.has(d.id));
      for (const doc of docsToMerge) {
        try {
          const res = await fetch(`${API_BASE}${doc.fileUrl}`);
          const bytes = await res.arrayBuffer();
          const mime = doc.mimeType ?? '';

          if (mime === 'application/pdf') {
            const docPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pages = await mergedPdf.copyPages(docPdf, docPdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
          } else if (mime.startsWith('image/')) {
            // Embed image as a new page
            const page = mergedPdf.addPage([595, 842]); // A4
            let img;
            if (mime === 'image/png') {
              img = await mergedPdf.embedPng(bytes);
            } else {
              img = await mergedPdf.embedJpg(bytes);
            }
            const { width, height } = img.scaleToFit(523, 770);
            page.drawImage(img, { x: (595 - width) / 2, y: (842 - height) / 2, width, height });
          }
        } catch { /* skip unreadable docs */ }
      }

      const mergedBytes = await mergedPdf.save();
      downloadBlob(new Blob([mergedBytes], { type: 'application/pdf' }), `${applicant.fullName}_Application.pdf`);
      setOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Download className="w-4 h-4" />
        Download PDF
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">Download Application PDF</h3>
                <p className="text-sm text-gray-500 mt-0.5">Optionally include uploaded documents in the PDF</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Document selection */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Uploaded Documents</span>
                <div className="flex gap-3">
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><CheckSquare className="w-3 h-3" /> All</button>
                  <button onClick={clearAll} className="text-xs text-gray-500 hover:underline flex items-center gap-1"><Square className="w-3 h-3" /> None</button>
                </div>
              </div>

              {documents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No uploaded documents</p>
              ) : (
                documents.map(doc => (
                  <label key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedDocs.has(doc.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                    <Checkbox checked={selectedDocs.has(doc.id)} onCheckedChange={() => toggleDoc(doc.id)} />
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.documentType?.name ?? '—'} · {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : ''}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">
                {selectedDocs.size > 0 ? `${selectedDocs.size} document${selectedDocs.size > 1 ? 's' : ''} will be appended` : 'Application data only'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleExport} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {generating ? 'Generating…' : 'Download PDF'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
