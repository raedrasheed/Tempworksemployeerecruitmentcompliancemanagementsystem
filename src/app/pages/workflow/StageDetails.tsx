import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Users, Clock, AlertTriangle, TrendingUp, CheckCircle, Search, Filter, ChevronRight, MoveRight } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { mockDrivers } from '../../data/mockData';

const workflowStages = [
  {
    id: 'application_submitted',
    name: 'Application Submitted',
    order: 1,
    avgDaysInStage: 5,
    completionRate: 92,
    requirements: [
      { name: 'Application Form', description: 'Complete driver application form' },
      { name: 'Initial Screening', description: 'Preliminary background check' },
    ],
  },
  {
    id: 'document_verification',
    name: 'Document Verification',
    order: 2,
    avgDaysInStage: 7,
    completionRate: 85,
    requirements: [
      { name: 'Valid Passport', description: 'Passport must be valid for at least 6 months' },
      { name: 'Driving License Verification', description: 'Verify CE category driving licenses' },
      { name: 'Criminal Background Check', description: 'Complete background check clearance' },
      { name: 'Educational Certificates', description: 'Verify driving school certificates' },
    ],
  },
  {
    id: 'work_permit_application',
    name: 'Work Permit Application',
    order: 3,
    avgDaysInStage: 21,
    completionRate: 78,
    requirements: [
      { name: 'Work Permit Application', description: 'Submit work permit application form' },
      { name: 'Employment Contract', description: 'Signed employment contract' },
      { name: 'Proof of Employment', description: 'Letter from employer' },
    ],
  },
  {
    id: 'visa_application',
    name: 'Visa Application',
    order: 4,
    avgDaysInStage: 14,
    completionRate: 82,
    requirements: [
      { name: 'Submit Visa Application', description: 'Complete visa application form' },
      { name: 'Biometric Data Collection', description: 'Biometric data submission' },
      { name: 'Financial Documents', description: 'Proof of financial stability' },
    ],
  },
  {
    id: 'visa_approved',
    name: 'Visa Approved',
    order: 5,
    avgDaysInStage: 3,
    completionRate: 95,
    requirements: [
      { name: 'Visa Approval Confirmation', description: 'Receive visa approval notification' },
    ],
  },
  {
    id: 'embassy_appointment',
    name: 'Embassy Appointment',
    order: 6,
    avgDaysInStage: 10,
    completionRate: 88,
    requirements: [
      { name: 'Schedule Embassy Appointment', description: 'Book appointment slot' },
      { name: 'Attend Embassy Interview', description: 'Complete embassy interview' },
    ],
  },
  {
    id: 'arrival_registration',
    name: 'Arrival Registration',
    order: 7,
    avgDaysInStage: 5,
    completionRate: 90,
    requirements: [
      { name: 'Register Arrival', description: 'Complete arrival registration' },
      { name: 'Address Verification', description: 'Verify local address' },
    ],
  },
  {
    id: 'residence_permit',
    name: 'Residence Permit',
    order: 8,
    avgDaysInStage: 18,
    completionRate: 80,
    requirements: [
      { name: 'Residence Permit Application', description: 'Submit residence permit application' },
      { name: 'Biometric Registration', description: 'Complete biometric registration' },
    ],
  },
  {
    id: 'medical_examination',
    name: 'Medical Examination',
    order: 9,
    avgDaysInStage: 8,
    completionRate: 92,
    requirements: [
      { name: 'Medical Certificate', description: 'Valid medical fitness certificate' },
      { name: 'Schedule Medical Exam', description: 'Book appointment with certified physician' },
    ],
  },
  {
    id: 'interview',
    name: 'Interview',
    order: 10,
    avgDaysInStage: 6,
    completionRate: 85,
    requirements: [
      { name: 'Schedule Interview', description: 'Book interview slot with hiring manager' },
      { name: 'Conduct Interview', description: 'Face-to-face or video interview' },
      { name: 'Interview Assessment', description: 'Complete assessment form' },
    ],
  },
  {
    id: 'contract_signing',
    name: 'Contract Signing',
    order: 11,
    avgDaysInStage: 4,
    completionRate: 95,
    requirements: [
      { name: 'Employment Contract', description: 'Final employment contract' },
      { name: 'Terms Agreement', description: 'Terms and conditions acceptance' },
      { name: 'Sign Contract', description: 'Contract signature' },
    ],
  },
  {
    id: 'training',
    name: 'Training',
    order: 12,
    avgDaysInStage: 15,
    completionRate: 88,
    requirements: [
      { name: 'Complete Onboarding Training', description: 'Company onboarding program' },
      { name: 'Safety Training', description: 'Safety and compliance training' },
    ],
  },
  {
    id: 'deployment',
    name: 'Deployment',
    order: 13,
    avgDaysInStage: 2,
    completionRate: 98,
    requirements: [
      { name: 'Vehicle Assignment', description: 'Assign vehicle to driver' },
      { name: 'Route Planning', description: 'Initial route assignment' },
    ],
  },
  {
    id: 'completed',
    name: 'Onboarding Completed',
    order: 14,
    avgDaysInStage: 0,
    completionRate: 100,
    requirements: [
      { name: 'Stage Requirements', description: 'Complete all required tasks for this stage' },
    ],
  },
];

export function StageDetails() {
  const { stageId } = useParams();
  const stage = workflowStages.find(s => s.id === stageId);
  
  const [searchQuery, setSearchQuery] = useState('');

  if (!stage) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Stage Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested workflow stage could not be found.</p>
          <Button asChild>
            <Link to="/dashboard/workflow">Return to Workflow Pipeline</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Get drivers in this stage
  const driversInStage = mockDrivers.filter(d => d.currentStage === stageId);

  // Filter drivers
  const filteredDrivers = driversInStage.filter(driver => {
    const matchesSearch = driver.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         driver.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         driver.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Calculate metrics
  const avgDaysInStage = stage.avgDaysInStage;
  const atRiskCount = Math.floor(driversInStage.length * 0.3);
  const completionRate = stage.completionRate;

  const getDaysInStage = (driver: any) => {
    return Math.floor(Math.random() * 20) + 1;
  };

  const getDriverStatus = (driver: any) => {
    const statuses = ['At Risk', 'pending', 'active'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  const handleStageChange = (driverId: string, driverName: string, newStageId: string) => {
    const targetStage = workflowStages.find(s => s.id === newStageId);
    if (targetStage) {
      alert(`Moving ${driverName} to ${targetStage.name}\n\nSystem log entry created:\nAction: Stage Transition\nUser: Current User\nDriver: ${driverName}\nFrom: ${stage.name}\nTo: ${targetStage.name}\nTimestamp: ${new Date().toLocaleString()}`);
      // In a real app, this would update the backend and refresh the data
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/workflow">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-[#0F172A]">{stage.name}</h1>
            <p className="text-muted-foreground mt-1">Stage {stage.order} of 14 • Manage drivers in this workflow stage</p>
          </div>
        </div>
        <Button>
          <ChevronRight className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Drivers in Stage */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">{driversInStage.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Drivers in Stage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Days in Stage */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">{avgDaysInStage}</p>
                <p className="text-sm text-muted-foreground mt-1">Avg. Days in Stage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* At Risk */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">{atRiskCount}</p>
                <p className="text-sm text-muted-foreground mt-1">At Risk (SLA)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">{completionRate}%</p>
                <p className="text-sm text-muted-foreground mt-1">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Requirements */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold text-lg mb-4">Stage Requirements</h2>
          <div className="space-y-3">
            {stage.requirements.map((req, index) => (
              <div key={index} className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#22C55E] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#0F172A]">{req.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-[#EF4444] text-[#EF4444] bg-[#FEF2F2]">
                  Required
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drivers in Stage */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Drivers in {stage.name}</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {filteredDrivers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No drivers in this stage</p>
              <p className="text-sm text-muted-foreground mt-1">
                Drivers will appear here when they are moved to this workflow stage
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDrivers.map((driver) => {
                const daysInStage = getDaysInStage(driver);
                const status = getDriverStatus(driver);

                return (
                  <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={driver.photo}
                        alt={driver.firstName}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <p className="font-medium text-[#0F172A]">{driver.firstName} {driver.lastName}</p>
                        <p className="text-sm text-muted-foreground">{driver.nationality} • {driver.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium text-[#0F172A]">{daysInStage} days</p>
                        <p className="text-xs text-muted-foreground">In stage</p>
                      </div>
                      
                      {status === 'At Risk' && (
                        <Badge className="bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]" variant="outline">
                          At Risk
                        </Badge>
                      )}
                      {status === 'pending' && (
                        <Badge className="bg-[#FEF3C7] text-[#F59E0B]">
                          pending
                        </Badge>
                      )}
                      {status === 'active' && (
                        <Badge className="bg-[#F0FDF4] text-[#22C55E]">
                          active
                        </Badge>
                      )}

                      {/* Stage Selector */}
                      <div className="flex items-center gap-2">
                        <MoveRight className="w-4 h-4 text-muted-foreground" />
                        <Select 
                          defaultValue={driver.currentStage}
                          onValueChange={(value) => handleStageChange(driver.id, `${driver.firstName} ${driver.lastName}`, value)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Move to stage..." />
                          </SelectTrigger>
                          <SelectContent>
                            {workflowStages.map((s) => (
                              <SelectItem 
                                key={s.id} 
                                value={s.id}
                                disabled={s.id === driver.currentStage}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>{s.name}</span>
                                  {s.id === driver.currentStage && (
                                    <Badge variant="outline" className="ml-2 text-xs">Current</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Link to={`/dashboard/drivers/${driver.id}`}>
                        <Button variant="outline">
                          View Profile
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SLA Performance */}
      {driversInStage.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold text-lg mb-4">SLA Performance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stage Completion Rate</span>
                <span className="font-semibold text-xl">{completionRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}