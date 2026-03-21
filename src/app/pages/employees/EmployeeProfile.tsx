import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, FileText, Shield, Briefcase, Clock, Award, GraduationCap, TrendingUp, ChevronRight, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { toast } from 'sonner';
import { employeesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');

export function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const [employee, setEmployee] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      employeesApi.get(id!),
      employeesApi.getDocuments(id!),
      employeesApi.getWorkflow(id!),
    ]).then(([emp, docs, wf]) => {
      setEmployee(emp);
      setDocuments(Array.isArray(docs) ? docs : []);
      setWorkflow(Array.isArray(wf) ? wf : []);
    }).catch(() => toast.error('Failed to load employee'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(`Delete ${employee?.firstName} ${employee?.lastName}? This cannot be undone.`)) return;
    try {
      await employeesApi.delete(id!);
      toast.success('Employee deleted');
      navigate('/dashboard/employees');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete employee');
    }
  };

  const statusBadgeClass = (status: string) => {
    if (status === 'ACTIVE') return 'bg-[#22C55E]';
    if (status === 'PENDING') return 'bg-[#F59E0B]';
    if (status === 'ONBOARDING') return 'bg-[#2563EB]';
    if (status === 'ON_LEAVE') return 'bg-[#8B5CF6]';
    return 'bg-gray-500';
  };

  const docStatusClass = (status: string) => {
    if (status === 'VERIFIED') return 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]';
    if (status === 'EXPIRING_SOON') return 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]';
    if (status === 'EXPIRED' || status === 'REJECTED') return 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]';
    return 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]';
  };

  const validDocs = documents.filter(d => d.status === 'VERIFIED').length;
  const expiringSoon = documents.filter(d => d.status === 'EXPIRING_SOON').length;

  const completedStages = workflow.filter(s => s.status === 'COMPLETED').length;
  const workflowProgress = workflow.length > 0 ? (completedStages / workflow.length) * 100 : 0;

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!employee) return <div className="p-8">Employee not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/employees"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Employee Profile</h1>
          <p className="text-muted-foreground mt-1">View and manage employee information</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit('employees') && (
            <Button asChild>
              <Link to={`/dashboard/employees/${id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />Edit Profile
              </Link>
            </Button>
          )}
          {canDelete('employees') && (
            <Button variant="outline" className="text-[#EF4444] border-[#EF4444]" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-3xl font-semibold">
              {employee.firstName?.[0]}{employee.lastName?.[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F172A]">
                    {employee.firstName} {employee.lastName}
                  </h2>
                  <p className="text-muted-foreground mt-1">Employee ID: {employee.id}</p>
                </div>
                <Badge className={statusBadgeClass(employee.status)}>
                  {employee.status?.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{employee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{employee.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nationality</p>
                    <p className="text-sm font-medium">{employee.nationality}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-sm font-medium">{new Date(employee.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Nav */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { to: `/dashboard/employees/${id}/certifications`, icon: Award, label: 'Certifications' },
          { to: `/dashboard/employees/${id}/training`, icon: GraduationCap, label: 'Training History' },
          { to: `/dashboard/employees/${id}/compliance-timeline`, icon: Shield, label: 'Compliance Timeline' },
          { to: `/dashboard/employees/${id}/performance`, icon: TrendingUp, label: 'Performance Reviews' },
        ].map(({ to, icon: Icon, label }) => (
          <Button key={to} variant="outline" className="justify-between" asChild>
            <Link to={to}>
              <div className="flex items-center gap-2"><Icon className="w-4 h-4" /><span>{label}</span></div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Full Name', `${employee.firstName} ${employee.lastName}`],
                    ['Date of Birth', employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : '—'],
                    ['Nationality', employee.nationality],
                    ['License Number', employee.licenseNumber ?? '—'],
                    ['License Category', employee.licenseCategory ?? '—'],
                    ['Years Experience', `${employee.yearsExperience ?? 0} years`],
                    ['Address', `${employee.addressLine1}${employee.addressLine2 ? ', ' + employee.addressLine2 : ''}`],
                    ['City', employee.city],
                    ['Country', employee.country],
                    ['Postal Code', employee.postalCode],
                    employee.emergencyContact ? ['Emergency Contact', `${employee.emergencyContact} · ${employee.emergencyPhone ?? ''}`] : null,
                  ].filter(Boolean).map(([label, value]: any) => (
                    <div key={label}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Quick Stats</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { icon: FileText, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', value: documents.length, label: 'Documents' },
                    { icon: Shield, color: 'text-[#22C55E]', bg: 'bg-[#F0FDF4]', value: validDocs, label: 'Valid Docs' },
                    { icon: Clock, color: 'text-[#F59E0B]', bg: 'bg-[#FEF3C7]', value: expiringSoon, label: 'Expiring Soon' },
                  ].map(({ icon: Icon, color, bg, value, label }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold">{value}</p>
                        <p className="text-sm text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {employee.agency && (
                <Card>
                  <CardHeader><CardTitle>Agency</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <div>
                        <p className="font-medium">{employee.agency.name}</p>
                        <p className="text-sm text-muted-foreground">{employee.agencyId}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Employee Documents</CardTitle>
              <Button asChild>
                <Link to="/dashboard/documents/upload">Upload Document</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#2563EB]" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{doc.documentType?.name} · {(doc.fileSize / 1024).toFixed(1)} KB</p>
                          {doc.expiryDate && (
                            <p className="text-xs text-muted-foreground mt-1">Expires: {new Date(doc.expiryDate).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={docStatusClass(doc.status)}>
                          {doc.status?.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`${API_BASE}${doc.fileUrl}`} target="_blank" rel="noopener noreferrer" download>
                            <Download className="w-4 h-4 mr-1" />Download
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/documents/${doc.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow */}
        <TabsContent value="workflow">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recruitment Workflow Progress</CardTitle>
                  <div className="flex items-center gap-4 mt-2">
                    <Progress value={workflowProgress} className="flex-1" />
                    <span className="text-sm font-medium">{Math.round(workflowProgress)}%</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {workflow.length === 0 ? (
                    <p className="text-muted-foreground">No workflow stages configured.</p>
                  ) : (
                    <div className="space-y-4">
                      {workflow.map((ws: any, index: number) => {
                        const isCompleted = ws.status === 'COMPLETED';
                        const isCurrent = ws.status === 'IN_PROGRESS';
                        return (
                          <div key={ws.id} className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCompleted ? 'bg-[#22C55E] text-white' :
                              isCurrent   ? 'bg-[#2563EB] text-white' :
                              'bg-[#F8FAFC] text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 pb-4 border-b last:border-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className={`font-medium ${isCurrent ? 'text-[#2563EB]' : ''}`}>
                                    {ws.stage?.name}
                                  </p>
                                  {ws.stage?.description && (
                                    <p className="text-sm text-muted-foreground mt-0.5">{ws.stage.description}</p>
                                  )}
                                  {isCurrent && <p className="text-sm text-muted-foreground mt-1">Current stage</p>}
                                </div>
                                {isCompleted && <Badge className="bg-[#22C55E]">Completed</Badge>}
                                {isCurrent && <Badge className="bg-[#2563EB]">In Progress</Badge>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader><CardTitle>Compliance Status</CardTitle></CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground">No compliance data available. Upload documents to begin tracking compliance.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc: any) => {
                    const daysLeft = doc.expiryDate
                      ? Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{doc.documentType?.name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={docStatusClass(doc.status)}>
                            {doc.status?.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                          {daysLeft !== null && (
                            <p className={`text-xs mt-1 ${daysLeft <= 0 ? 'text-[#EF4444]' : daysLeft <= 30 ? 'text-[#F59E0B]' : 'text-muted-foreground'}`}>
                              {daysLeft <= 0 ? `Expired ${Math.abs(daysLeft)} days ago` : `${daysLeft} days remaining`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes">
          <Card>
            <CardHeader><CardTitle>Notes & Comments</CardTitle></CardHeader>
            <CardContent>
              {employee.notes ? (
                <p className="whitespace-pre-wrap">{employee.notes}</p>
              ) : (
                <p className="text-muted-foreground">No notes for this employee. You can add notes when editing the profile.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
