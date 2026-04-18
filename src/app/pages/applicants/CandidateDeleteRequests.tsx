import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Trash2, CheckCircle, XCircle, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { applicantsApi } from '../../services/api';

const STATUS_TABS = ['All', 'Pending', 'Approved', 'Rejected'] as const;

function statusBadge(status: string) {
  switch (status?.toUpperCase()) {
    case 'PENDING':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">Pending</Badge>;
    case 'APPROVED':
      return <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100">Approved</Badge>;
    case 'REJECTED':
      return <Badge className="bg-red-100 text-red-800 border-red-300 hover:bg-red-100">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function CandidateDeleteRequests() {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus !== 'All') params.status = filterStatus.toUpperCase();
      const result = await applicantsApi.getDeleteRequests(params);
      setRequests(Array.isArray(result) ? result : (result?.data ?? []));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load delete requests');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    if (!(await confirm({
      title: 'Approve delete request?',
      description: 'The candidate will be permanently deleted. This action cannot be undone.',
      confirmText: 'Approve & delete',
      tone: 'destructive',
    }))) return;
    setProcessing(true);
    try {
      await applicantsApi.reviewDeleteRequest(id, 'APPROVED');
      toast.success('Delete request approved');
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectNotes('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setProcessing(true);
    try {
      await applicantsApi.reviewDeleteRequest(rejectingId, 'REJECTED', rejectNotes || undefined);
      toast.success('Delete request rejected');
      setRejectModalOpen(false);
      setRejectingId(null);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject request');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/applicants"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Candidate Delete Requests</h1>
          <p className="text-muted-foreground mt-1">Review and manage data deletion requests</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filterStatus === tab
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-muted-foreground hover:text-[#0F172A]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Delete Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Inbox className="w-12 h-12 opacity-30" />
              <p className="text-base font-semibold text-[#0F172A]">No delete requests</p>
              <p className="text-sm">There are no {filterStatus !== 'All' ? filterStatus.toLowerCase() : ''} delete requests at this time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium pr-4">Candidate Name</th>
                    <th className="pb-3 font-medium pr-4">Candidate ID</th>
                    <th className="pb-3 font-medium pr-4">Requested By</th>
                    <th className="pb-3 font-medium pr-4">Date</th>
                    <th className="pb-3 font-medium pr-4">Reason</th>
                    <th className="pb-3 font-medium pr-4">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((req: any) => {
                    const candidateName = req.applicant
                      ? `${req.applicant.firstName ?? ''} ${req.applicant.lastName ?? ''}`.trim()
                      : req.candidateName ?? '—';
                    const candidateId = req.applicant?.applicantNumber ?? req.applicantId ?? '—';
                    const requestedBy = req.requestedBy
                      ? `${req.requestedBy.firstName ?? ''} ${req.requestedBy.lastName ?? ''}`.trim()
                      : req.requestedByName ?? '—';
                    const date = req.createdAt
                      ? new Date(req.createdAt).toLocaleDateString('en-GB')
                      : '—';
                    const isPending = req.status?.toUpperCase() === 'PENDING';

                    return (
                      <tr key={req.id} className="hover:bg-muted/30">
                        <td className="py-3 pr-4 font-medium text-[#0F172A]">{candidateName || '—'}</td>
                        <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{candidateId}</td>
                        <td className="py-3 pr-4">{requestedBy || '—'}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{date}</td>
                        <td className="py-3 pr-4 max-w-[200px]">
                          <span className="line-clamp-2 text-muted-foreground">{req.reason ?? '—'}</span>
                        </td>
                        <td className="py-3 pr-4">{statusBadge(req.status)}</td>
                        <td className="py-3">
                          {isPending ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleApprove(req.id)}
                                disabled={processing}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-400 text-red-600 hover:bg-red-50"
                                onClick={() => openRejectModal(req.id)}
                                disabled={processing}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString('en-GB') : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold text-[#0F172A]">Reject Delete Request</h2>
            <p className="text-sm text-muted-foreground">
              Optionally provide a reason for rejecting this delete request.
            </p>
            <div className="space-y-2">
              <label htmlFor="rejectNotes" className="text-sm font-medium">Review Notes</label>
              <textarea
                id="rejectNotes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={4}
                placeholder="Reason for rejection (optional)..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleReject}
                disabled={processing}
              >
                {processing ? 'Rejecting...' : 'Reject Request'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setRejectModalOpen(false); setRejectingId(null); }}
                disabled={processing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
