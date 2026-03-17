import { useState } from 'react';
import { ArrowRight, CheckCircle, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

const workflowStages = [
  { id: 'S001', name: 'Application Review', color: '#64748B', order: 1 },
  { id: 'S002', name: 'Document Verification', color: '#2563EB', order: 2 },
  { id: 'S003', name: 'Interview', color: '#8B5CF6', order: 3 },
  { id: 'S004', name: 'Medical Examination', color: '#F59E0B', order: 4 },
  { id: 'S005', name: 'Work Permit', color: '#EC4899', order: 5 },
  { id: 'S006', name: 'Visa Processing', color: '#06B6D4', order: 6 },
  { id: 'S007', name: 'Contract Signing', color: '#22C55E', order: 7 },
];

interface StageHistory {
  stageId: string;
  stageName: string;
  movedDate: string;
  movedBy: string;
}

const mockStageHistory: StageHistory[] = [
  {
    stageId: 'S002',
    stageName: 'Document Verification',
    movedDate: '2024-03-10 14:30',
    movedBy: 'Sarah Johnson',
  },
  {
    stageId: 'S001',
    stageName: 'Application Review',
    movedDate: '2024-03-01 09:15',
    movedBy: 'Michael Chen',
  },
];

interface StageTransitionProps {
  currentStageId: string;
  employeeId: string;
  employeeName: string;
}

export function StageTransition({ currentStageId, employeeId, employeeName }: StageTransitionProps) {
  const [selectedStage, setSelectedStage] = useState(currentStageId);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const currentStage = workflowStages.find(s => s.id === currentStageId);
  const currentStageIndex = workflowStages.findIndex(s => s.id === currentStageId);
  const nextStage = workflowStages[currentStageIndex + 1];

  const handleMoveToStage = () => {
    alert(`Employee ${employeeName} moved to ${workflowStages.find(s => s.id === selectedStage)?.name}`);
  };

  const handleMoveToNext = () => {
    if (nextStage) {
      alert(`Employee ${employeeName} moved to ${nextStage.name}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workflow Stage Transition</CardTitle>
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="w-4 h-4 mr-2" />
                View History
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Stage History</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {mockStageHistory.map((history, idx) => (
                  <div key={idx} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                      backgroundColor: workflowStages.find(s => s.id === history.stageId)?.color || '#64748B' 
                    }}>
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{history.stageName}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Moved by {history.movedBy} on {history.movedDate}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Stage */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">Current Stage</p>
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-[#F8FAFC]">
            {currentStage && (
              <>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: currentStage.color }}
                >
                  {currentStage.order}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{currentStage.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Stage {currentStage.order} of {workflowStages.length}
                  </p>
                </div>
                <Badge variant="outline" style={{ borderColor: currentStage.color, color: currentStage.color }}>
                  Active
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Quick Action - Move to Next Stage */}
        {nextStage && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">Quick Action</p>
            <Button className="w-full" onClick={handleMoveToNext}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Move to {nextStage.name}
            </Button>
          </div>
        )}

        {/* Manual Stage Selection */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">Move to Different Stage</p>
          <div className="flex gap-2">
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workflowStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline"
              onClick={handleMoveToStage}
              disabled={selectedStage === currentStageId}
            >
              Move
            </Button>
          </div>
        </div>

        {/* Visual Workflow Progress */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">Workflow Progress</p>
          <div className="space-y-2">
            {workflowStages.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isCurrent = stage.id === currentStageId;
              const isPending = idx > currentStageIndex;

              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isCompleted ? 'bg-[#22C55E] text-white' :
                      isCurrent ? 'text-white' :
                      'bg-[#E2E8F0] text-[#94A3B8]'
                    }`}
                    style={isCurrent ? { backgroundColor: stage.color } : {}}
                  >
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : stage.order}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${isCurrent ? 'font-semibold' : ''}`}>{stage.name}</p>
                  </div>
                  {isCurrent && (
                    <Badge variant="outline" style={{ borderColor: stage.color, color: stage.color }}>
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}