import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Link } from 'react-router';
import { Clock, BarChart3, ChevronRight } from 'lucide-react';
import { mockDrivers } from '../../data/mockData';

const workflowStages = [
  { id: 'application_submitted', name: 'Application Submitted', order: 1, color: '#2563EB' },
  { id: 'document_verification', name: 'Document Verification', order: 2, color: '#2563EB' },
  { id: 'work_permit_application', name: 'Work Permit Application', order: 3, color: '#2563EB' },
  { id: 'visa_application', name: 'Visa Application', order: 4, color: '#2563EB' },
  { id: 'visa_approved', name: 'Visa Approved', order: 5, color: '#2563EB' },
  { id: 'embassy_appointment', name: 'Embassy Appointment', order: 6, color: '#2563EB' },
  { id: 'arrival_registration', name: 'Arrival Registration', order: 7, color: '#2563EB' },
  { id: 'residence_permit', name: 'Residence Permit', order: 8, color: '#2563EB' },
  { id: 'medical_examination', name: 'Medical Examination', order: 9, color: '#2563EB' },
  { id: 'interview', name: 'Interview', order: 10, color: '#2563EB' },
  { id: 'contract_signing', name: 'Contract Signing', order: 11, color: '#2563EB' },
  { id: 'training', name: 'Training', order: 12, color: '#2563EB' },
  { id: 'deployment', name: 'Deployment', order: 13, color: '#2563EB' },
  { id: 'completed', name: 'Onboarding Completed', order: 14, color: '#22C55E' },
];

export function WorkflowOverview() {
  const getDriversInStage = (stageId: string) => {
    return mockDrivers.filter(d => d.currentStage === stageId).length;
  };

  const getStageProgress = (stageId: string) => {
    const count = getDriversInStage(stageId);
    // Mock progress percentages
    const progressMap: Record<string, number> = {
      'application_submitted': 0,
      'document_verification': 20,
      'work_permit_application': 20,
      'visa_application': 20,
      'visa_approved': 0,
      'embassy_appointment': 0,
      'arrival_registration': 0,
      'residence_permit': 0,
      'medical_examination': 0,
      'interview': 15,
      'contract_signing': 10,
      'training': 5,
      'deployment': 0,
      'completed': 100,
    };
    return progressMap[stageId] || 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Workflow Overview</h1>
          <p className="text-muted-foreground mt-1">Track recruitment workflow and driver progression</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/dashboard/workflow/timeline">
              <Clock className="w-4 h-4 mr-2" />
              Activity Timeline
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/workflow/analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Link>
          </Button>
        </div>
      </div>

      {/* Workflow Pipeline - Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflowStages.map((stage) => {
          const driversCount = getDriversInStage(stage.id);
          const progress = getStageProgress(stage.id);

          return (
            <Card key={stage.id} className="relative hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                {/* Stage Badge */}
                <div className="absolute top-4 right-4">
                  <Badge className="bg-[#2563EB] text-white rounded-full w-7 h-7 flex items-center justify-center p-0">
                    {driversCount}
                  </Badge>
                </div>

                {/* Stage Name */}
                <h3 className="font-semibold text-[#0F172A] mb-4 pr-8">{stage.name}</h3>

                {/* Progress */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>

                {/* Stage Info */}
                <p className="text-sm text-muted-foreground mb-4">Stage {stage.order} of 14</p>

                {/* View Details Link */}
                <Link 
                  to={`/dashboard/workflow/stage/${stage.id}`}
                  className="text-sm text-[#2563EB] hover:text-[#1d4ed8] flex items-center gap-1 font-medium"
                >
                  View Details
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}