import { Link, useParams } from 'react-router';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, FileText, Shield, Briefcase, Clock, Award, GraduationCap, TrendingUp, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { StageTransition } from '../../components/workflow/StageTransition';
import { mockDrivers, mockDocuments, workflowStages } from '../../data/mockData';

export function DriverProfile() {
  const { id } = useParams();
  const driver = mockDrivers.find(d => d.id === id);
  
  if (!driver) {
    return <div>Employee not found</div>;
  }

  const employeeDocuments = mockDocuments.filter(d => d.driverId === id);
  const currentStageIndex = workflowStages.findIndex(s => s.id === driver.currentStage);
  const workflowProgress = ((currentStageIndex + 1) / workflowStages.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/employees">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Employee Profile</h1>
          <p className="text-muted-foreground mt-1">View and manage employee information</p>
        </div>
        <Button asChild>
          <Link to={`/dashboard/employees/${id}/edit`}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Link>
        </Button>
      </div>

      {/* Employee Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <img 
              src={driver.photo} 
              alt={driver.firstName}
              className="w-24 h-24 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F172A]">
                    {driver.firstName} {driver.lastName}
                  </h2>
                  <p className="text-muted-foreground mt-1">Employee ID: {driver.id}</p>
                </div>
                <Badge 
                  className={
                    driver.status === 'active' ? 'bg-[#22C55E]' :
                    driver.status === 'pending' ? 'bg-[#F59E0B]' :
                    'bg-gray-500'
                  }
                >
                  {driver.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{driver.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{driver.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nationality</p>
                    <p className="text-sm font-medium">{driver.nationality}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-sm font-medium">{driver.joinedDate}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button variant="outline" className="justify-between" asChild>
          <Link to={`/dashboard/drivers/${id}/certifications`}>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>Certifications</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
        <Button variant="outline" className="justify-between" asChild>
          <Link to={`/dashboard/drivers/${id}/training`}>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <span>Training History</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
        <Button variant="outline" className="justify-between" asChild>
          <Link to={`/dashboard/drivers/${id}/compliance-timeline`}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Compliance Timeline</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
        <Button variant="outline" className="justify-between" asChild>
          <Link to={`/dashboard/drivers/${id}/performance`}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Performance Reviews</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{driver.firstName} {driver.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{driver.dateOfBirth}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nationality</p>
                    <p className="font-medium">{driver.nationality}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">License Number</p>
                    <p className="font-medium">{driver.licenseNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{driver.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium">{driver.city}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium">{driver.country}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Years of Experience</p>
                    <p className="font-medium">{driver.yearsExperience} years</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{employeeDocuments.length}</p>
                      <p className="text-sm text-muted-foreground">Documents</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <Shield className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">
                        {employeeDocuments.filter(d => d.status === 'valid').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Valid Docs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                      <Clock className="w-5 h-5 text-[#F59E0B]" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">
                        {employeeDocuments.filter(d => d.status === 'expiring_soon').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Expiring Soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {driver.agencyName && (
                <Card>
                  <CardHeader>
                    <CardTitle>Agency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <div>
                        <p className="font-medium">{driver.agencyName}</p>
                        <p className="text-sm text-muted-foreground">{driver.agencyId}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Employee Documents</CardTitle>
              <Button asChild>
                <Link to="/dashboard/documents/upload">Upload Document</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {employeeDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.type}</p>
                        <p className="text-sm text-muted-foreground">{doc.fileName} • {doc.fileSize}</p>
                        {doc.expiryDate && (
                          <p className="text-xs text-muted-foreground mt-1">Expires: {doc.expiryDate}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline"
                        className={
                          doc.status === 'valid' ? 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]' :
                          doc.status === 'expiring_soon' ? 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]' :
                          doc.status === 'expired' ? 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]' :
                          'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]'
                        }
                      >
                        {doc.status.replace(/_/g, ' ')}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/dashboard/documents/${doc.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="space-y-6">
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
                  <div className="space-y-4">
                    {workflowStages.map((stage, index) => {
                      const isCompleted = index <= currentStageIndex;
                      const isCurrent = index === currentStageIndex;
                      
                      return (
                        <div key={stage.id} className="flex items-start gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted 
                              ? 'bg-[#22C55E] text-white' 
                              : 'bg-[#F8FAFC] text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 pb-4 border-b last:border-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={`font-medium ${isCurrent ? 'text-[#2563EB]' : ''}`}>
                                  {stage.name}
                                </p>
                                {isCurrent && (
                                  <p className="text-sm text-muted-foreground mt-1">Current stage</p>
                                )}
                              </div>
                              {isCompleted && !isCurrent && (
                                <Badge className="bg-[#22C55E]">Completed</Badge>
                              )}
                              {isCurrent && (
                                <Badge className="bg-[#2563EB]">In Progress</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <StageTransition 
                currentStageId={driver.currentStage}
                driverId={driver.id}
                driverName={`${driver.firstName} ${driver.lastName}`}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Compliance information and status for this employee</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment">
          <Card>
            <CardHeader>
              <CardTitle>Employment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Employment contract and work history</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes & Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Internal notes and comments about this employee</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}