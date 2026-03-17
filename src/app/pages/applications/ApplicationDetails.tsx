import { Link, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { mockApplications } from '../../data/mockData';
import { toast } from 'sonner';

export function ApplicationDetails() {
  const { id } = useParams();
  const application = mockApplications.find(a => a.id === id);

  if (!application) {
    return <div>Application not found</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-[#22C55E]';
      case 'in_review': return 'bg-[#2563EB]';
      case 'rejected': return 'bg-[#EF4444]';
      case 'on_hold': return 'bg-[#F59E0B]';
      default: return 'bg-gray-500';
    }
  };

  const handleApprove = () => {
    toast.success('Application approved successfully');
  };

  const handleReject = () => {
    toast.error('Application rejected');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/applications">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Application Details</h1>
          <p className="text-muted-foreground mt-1">Application ID: {application.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReject} className="text-[#EF4444] border-[#EF4444]">
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button onClick={handleApprove} className="bg-[#22C55E] hover:bg-[#16A34A]">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#0F172A]">{application.driverName}</h2>
              <p className="text-muted-foreground mt-1">{application.position}</p>
            </div>
            <Badge className={getStatusColor(application.status)}>
              {application.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="grid grid-cols-4 gap-6 mt-6">
            <div>
              <p className="text-sm text-muted-foreground">Submitted Date</p>
              <p className="font-medium mt-1">{application.submittedDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nationality</p>
              <p className="font-medium mt-1">{application.nationality}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reviewed By</p>
              <p className="font-medium mt-1">{application.reviewedBy || 'Pending'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Review Date</p>
              <p className="font-medium mt-1">{application.reviewedDate || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Position Applied For</p>
                <p className="font-medium mt-1">{application.position}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Application Notes</p>
                <p className="mt-1">{application.notes}</p>
              </div>
              <div>
                <Button variant="outline" asChild>
                  <Link to={`/dashboard/drivers/${application.driverId}`}>
                    <FileText className="w-4 h-4 mr-2" />
                    View Driver Profile
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Application Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Application Submitted</p>
                    <p className="text-sm text-muted-foreground">{application.submittedDate}</p>
                  </div>
                </div>
                {application.reviewedDate && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Application Reviewed</p>
                      <p className="text-sm text-muted-foreground">{application.reviewedDate} by {application.reviewedBy}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Application Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Add notes about this application..." rows={6} />
              <Button className="mt-4">Save Notes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Application History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Application modification history will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}