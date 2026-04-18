/**
 * Employee PDF Document
 * React-PDF document used for single-profile and bulk employee exports.
 * Mirrors the layout conventions of ApplicantPDF for visual consistency.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

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
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1pt solid #e2e8f0', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#94a3b8' },
});

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

const fmtDate = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB');
};

export function EmployeePDF({ employee, photoDataUrl }: { employee: any; photoDataUrl?: string }) {
  const e = employee ?? {};
  const now = new Date().toLocaleDateString('en-GB');
  const fullName = [e.firstName, e.lastName].filter(Boolean).join(' ') || '—';
  const status = typeof e.status === 'string' ? e.status.replace(/_/g, ' ').toLowerCase() : '';
  const address = [e.addressLine1, e.addressLine2].filter(Boolean).join(', ');

  return (
    <Document title={`${fullName} — Employee Profile`}>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.appTitle}>{fullName}</Text>
            <Text style={S.appSubtitle}>Employee ID: {e.employeeNumber ?? e.id ?? '—'}</Text>
            <Text style={S.appDate}>Status: {status || '—'} · Generated: {now}</Text>
          </View>
          {photoDataUrl && <Image src={photoDataUrl} style={S.headerPhoto} />}
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>Personal Information</Text>
          <View style={S.grid2}>
            <F label="First Name" value={e.firstName} />
            <F label="Last Name" value={e.lastName} />
            <F label="Date of Birth" value={fmtDate(e.dateOfBirth)} />
            <F label="Citizenship" value={e.nationality || e.citizenship} />
            <F label="Gender" value={e.gender} />
            <F label="Job Category" value={e.jobType?.name} />
            <F label="License Number" value={e.licenseNumber} />
            <F label="License Category" value={e.licenseCategory} />
            <F label="Years Experience" value={e.yearsExperience != null ? `${e.yearsExperience} years` : ''} />
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>Contact Details</Text>
          <View style={S.grid2}>
            <F label="Email" value={e.email} />
            <F label="Phone" value={e.phone} />
          </View>
          {(address || e.city || e.country || e.postalCode) && (
            <>
              <Text style={S.subTitle}>Address</Text>
              <View style={S.grid2}>
                {address && <FF label="Street" value={address} />}
                <F label="City" value={e.city} />
                <F label="Postal Code" value={e.postalCode} />
                <F label="Country" value={e.country} />
              </View>
            </>
          )}
          {(e.emergencyContact || e.emergencyPhone) && (
            <>
              <Text style={S.subTitle}>Emergency Contact</Text>
              <View style={S.grid2}>
                <F label="Name" value={e.emergencyContact} />
                <F label="Phone" value={e.emergencyPhone} />
              </View>
            </>
          )}
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>Employment</Text>
          <View style={S.grid2}>
            <F label="Agency" value={e.agency?.name} />
            <F label="Department" value={e.department} />
            <F label="Position" value={e.position || e.jobTitle} />
            <F label="Hire Date" value={fmtDate(e.hireDate || e.startDate)} />
            <F label="Status" value={status} />
            <F label="Contract Type" value={e.contractType} />
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>TempWorks Europe — Confidential</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
