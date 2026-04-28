import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, FileText, CheckCircle2, XCircle, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';
import { documentsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
const getFileUrl = (fileUrl: string) => `${API_BASE}${fileUrl}`;

export function DocumentPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit, canDelete, can } = usePermissions();

  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [verifying, setVerifying] = useState(false);

  // Rejection dialog
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    documentsApi.get(id!)
      .then(setDocument)
      .catch(() => toast.error('Document not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    setVerifying(true);
    try {
      const updated = await documentsApi.verify(id!, { action: 'VERIFY' });
      setDocument(updated);
      toast.success('Document approved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve document');
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    setVerifying(true);
    try {
      const updated = await documentsApi.verify(id!, {
        action: 'REJECT',
        reason: rejectionReason.trim(),
      });
      setDocument(updated);
      toast.success('Document rejected');
      setRejectOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject document');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete document?',
      description: 'This document will be permanently removed. This cannot be undone.',
      confirmText: 'Delete', tone: 'destructive',
    }))) return;
    try {
      await documentsApi.delete(id!);
      toast.success('Document deleted');
      navigate('/dashboard/documents-compliance');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete document');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':      return <Badge className="bg-[#22C55E]">Valid</Badge>;
      case 'EXPIRING_SOON': return <Badge className="bg-[#F59E0B]">Expiring Soon</Badge>;
      case 'EXPIRED':       return <Badge className="bg-[#EF4444]">Expired</Badge>;
      case 'REJECTED':      return <Badge className="bg-[#EF4444]">Rejected</Badge>;
      case 'PENDING':       return <Badge className="bg-[#64748B]">Pending Review</Badge>;
      default:              return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!document) return <div className="p-8">Document not found</div>;

  const isImage = document.mimeType?.startsWith('image/');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/documents-compliance">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Document Preview</h1>
          <p className="text-muted-foreground mt-1">
            {document.documentType?.name} — {document.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit('documents') && (
            <Button variant="outline" asChild>
              <Link to={`/dashboard/documents/${id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />Edit
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href={getFileUrl(document.fileUrl)} target="_blank" rel="noopener noreferrer" download>
              <Download className="w-4 h-4 mr-2" />Download
            </a>
          </Button>
          {canDelete('documents') && (
            <Button
              variant="outline"
              className="text-[#EF4444] border-[#EF4444]"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Preview pane */}
        <div className="col-span-2">
          <Card className="h-[600px] flex items-center justify-center overflow-hidden">
            {isImage ? (
              <img
                src={getFileUrl(document.fileUrl)}
                alt={document.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : document.mimeType === 'application/pdf' ? (
              <iframe
                src={getFileUrl(document.fileUrl)}
                title={document.name}
                className="w-full h-full"
              />
            ) : (
              <div className="text-center">
                <FileText className="w-24 h-24 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Preview not available</p>
                <p className="text-sm text-muted-foreground mt-2">{document.name}</p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href={getFileUrl(document.fileUrl)} target="_blank" rel="noopener noreferrer" download>
                    <Download className="w-4 h-4 mr-2" />Download to view
                  </a>
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Details pane */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Document Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium mt-1">{document.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium mt-1">{document.documentType?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(document.status)}</div>
              </div>
              {document.documentNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">Document Number</p>
                  <p className="font-medium mt-1">{document.documentNumber}</p>
                </div>
              )}
              {document.issuer && (
                <div>
                  <p className="text-sm text-muted-foreground">Issuer</p>
                  <p className="font-medium mt-1">{document.issuer}</p>
                </div>
              )}
              {document.issueDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium mt-1">{new Date(document.issueDate).toLocaleDateString()}</p>
                </div>
              )}
              {document.expiryDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium mt-1">{new Date(document.expiryDate).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Uploaded</p>
                <p className="font-medium mt-1">{new Date(document.createdAt).toLocaleDateString()}</p>
              </div>
              {document.uploadedBy && (
                <div>
                  <p className="text-sm text-muted-foreground">Uploaded By</p>
                  <p className="font-medium mt-1">
                    {document.uploadedBy.firstName} {document.uploadedBy.lastName}
                  </p>
                </div>
              )}
              {document.verifiedBy && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {document.status === 'REJECTED' ? 'Rejected By' : 'Verified By'}
                  </p>
                  <p className="font-medium mt-1">
                    {document.verifiedBy.firstName} {document.verifiedBy.lastName}
                  </p>
                  {document.verifiedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(document.verifiedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              {document.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium mt-1 whitespace-pre-line">{document.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approve / Reject — only for PENDING docs to authorised users */}
          {document.status === 'PENDING' && can('documents', 'verify') && (
            <div className="space-y-3">
              <Button
                className="w-full bg-[#22C55E] hover:bg-[#16A34A]"
                onClick={handleApprove}
                disabled={verifying}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {verifying ? 'Processing…' : 'Approve Document'}
              </Button>
              <Button
                variant="outline"
                className="w-full text-[#EF4444] border-[#EF4444] hover:bg-[#FEF2F2]"
                onClick={() => { setRejectionReason(''); setRejectOpen(true); }}
                disabled={verifying}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Document
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectOpen} onOpenChange={open => !open && setRejectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting:{' '}
              <span className="font-medium text-[#0F172A]">{document.name}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="reject-reason-preview">
                Rejection Reason <span className="text-[#EF4444]">*</span>
              </Label>
              <Textarea
                id="reject-reason-preview"
                placeholder="Explain why this document is being rejected…"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
              onClick={handleReject}
              disabled={verifying || !rejectionReason.trim()}
            >
              <XCircle className="w-4 h-4 mr-2" />
              {verifying ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
