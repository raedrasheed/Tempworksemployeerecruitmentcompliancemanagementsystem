import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { applicationsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from 'sonner';

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'APPROVED': return 'bg-green-100 text-green-800';
    case 'UNDER_REVIEW': return 'bg-blue-100 text-blue-800';
    case 'REJECTED': return 'bg-red-100 text-red-800';
    case 'SUBMITTED': return 'bg-purple-100 text-purple-800';
    case 'WITHDRAWN': return 'bg-gray-100 text-gray-800';
    default: return 'bg-yellow-100 text-yellow-800';
  }
};

export function ApplicationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canDelete } = usePermissions();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    applicationsApi.get(id)
      .then(setApplication)
      .catch(() => {
        toast.error('Application not found');
        navigate('/dashboard/applications');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    try {
      const updated = await applicationsApi.updateStatus(id, status);
      setApplication(updated);
      toast.success(`Application ${status.toLowerCase().replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNote = async () => {
    if (!id || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const updated = await applicationsApi.addNote(id, newNote.trim());
      setApplication(updated);
      setNewNote('');
      toast.success('Note added');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this application? This cannot be undone.')) return;
    try {
      await applicationsApi.delete(id);
      toast.success('Application deleted');
      navigate('/dashboard/applications');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete application');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading application...</div>;
  }
  if (!application) return null;

  const applicantName = application.applicant
    ? `${application.applicant.firstName} ${application.applicant.lastName}`
    : 'Unknown';
  const reviewerName = application.reviewedBy
    ? `${application.reviewedBy.firstName} ${application.reviewedBy.lastName}`
    : null;

  // Parse notes into blocks
  const noteBlocks = (application.notes || '').split('---').map((s: string) => s.trim()).filter(Boolean);

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
          <p className="text-muted-foreground mt-1 font-mono text-sm">ID: {application.id}</p>
        </div>
        <div className="flex gap-2">
          {application.status !== 'REJECTED' && (
            <Button
              variant="outline"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('REJECTED')}
              className="text-[#EF4444] border-[#EF4444]"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          )}
          {application.status !== 'UNDER_REVIEW' && (
            <Button
              variant="outline"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('UNDER_REVIEW')}
            >
              <Clock className="w-4 h-4 mr-2" />
              Mark Under Review
            </Button>
          )}
          {application.status !== 'APPROVED' && (
            <Button
              disabled={updatingStatus}
              onClick={() => handleStatusChange('APPROVED')}
              className="bg-[#22C55E] hover:bg-[#16A34A]"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve
            </Button>
          )}
          {canDelete('applications') && (
            <Button variant="outline" className="text-red-600" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#0F172A]">{applicantName}</h2>
              <p className="text-muted-foreground mt-1">{application.jobType?.name || 'No position specified'}</p>
            </div>
            <Badge className={getStatusColor(application.status)}>
              {application.status?.replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
            <div>
              <p className="text-sm text-muted-foreground">Submitted Date</p>
              <p className="font-medium mt-1">
                {application.submittedAt
                  ? new Date(application.submittedAt).toLocaleDateString()
                  : new Date(application.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nationality</p>
              <p className="font-medium mt-1">{application.applicant?.nationality || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reviewed By</p>
              <p className="font-medium mt-1">{reviewerName || 'Pending'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Review Date</p>
              <p className="font-medium mt-1">
                {application.reviewedAt
                  ? new Date(application.reviewedAt).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Position Applied For</p>
                <p className="font-medium mt-1">{application.jobType?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Applicant Email</p>
                <p className="font-medium mt-1">{application.applicant?.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Applicant Phone</p>
                <p className="font-medium mt-1">{application.applicant?.phone || '-'}</p>
              </div>
              {application.applicant?.id && (
                <div>
                  <Button variant="outline" asChild>
                    <Link to={`/dashboard/applicants/${application.applicant.id}`}>
                      <FileText className="w-4 h-4 mr-2" />
                      View Applicant Profile
                    </Link>
                  </Button>
                </div>
              )}
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
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Application Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(application.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {application.submittedAt && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Application Submitted</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(application.submittedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {application.reviewedAt && (
                  <div className="flex gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${application.status === 'APPROVED' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {application.status === 'APPROVED'
                        ? <CheckCircle2 className="w-4 h-4 text-white" />
                        : <XCircle className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        Application {application.status?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(application.reviewedAt).toLocaleString()}
                        {reviewerName ? ` by ${reviewerName}` : ''}
                      </p>
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
            <CardContent className="space-y-4">
              {/* Existing notes */}
              {noteBlocks.length > 0 && (
                <div className="space-y-3 mb-4">
                  {noteBlocks.map((block: string, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {block}
                    </div>
                  ))}
                </div>
              )}
              {/* Add new note */}
              <div>
                <p className="text-sm font-medium mb-2">Add a note</p>
                <Textarea
                  placeholder="Add notes about this application..."
                  rows={4}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button
                  className="mt-3"
                  disabled={savingNote || !newNote.trim()}
                  onClick={handleSaveNote}
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
