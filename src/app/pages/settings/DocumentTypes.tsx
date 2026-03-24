import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Plus, Eye, Edit, Trash2, ShieldOff } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { settingsApi } from '../../services/api';
import { toast } from 'sonner';

interface DocumentType {
  id: string;
  name: string;
  category: string;
  required: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  _count: { documents: number };
}

export function DocumentTypes() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  async function loadDocumentTypes() {
    try {
      const data = await settingsApi.getDocumentTypes();
      setDocumentTypes(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load document types');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await settingsApi.deleteDocumentType(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deactivated successfully`);
      setDocumentTypes((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete document type');
    } finally {
      setDeleting(false);
    }
  }

  const totalDocuments = documentTypes.reduce((sum, d) => sum + (d._count?.documents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/settings"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Document Types</h1>
          <p className="text-muted-foreground mt-1">Manage document types and requirements</p>
        </div>
        {canCreate('settings') && (
          <Button asChild>
            <Link to="/dashboard/settings/document-types/new">
              <Plus className="w-4 h-4 mr-2" />
              Add Document Type
            </Link>
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{documentTypes.length}</div>
            <p className="text-sm text-muted-foreground">Total Document Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{documentTypes.filter((d) => d.required).length}</div>
            <p className="text-sm text-muted-foreground">Required Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{documentTypes.filter((d) => d.trackExpiry).length}</div>
            <p className="text-sm text-muted-foreground">With Expiry Tracking</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{totalDocuments}</div>
            <p className="text-sm text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Type Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading document types...</div>
          ) : documentTypes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No document types found.{' '}
              <Link to="/dashboard/settings/document-types/new" className="text-[#2563EB] underline">
                Add one
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Document Type</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Uploads</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documentTypes.map((docType) => (
                    <tr key={docType.id} className="border-b hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-[#0F172A]">{docType.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{docType.id.slice(0, 8)}…</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm">{docType.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          {docType.required && <Badge variant="outline">Required</Badge>}
                          {docType.trackExpiry && (
                            <Badge variant="outline" className="bg-[#EFF6FF]">Expiry Tracking</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium">{docType._count?.documents ?? 0}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/settings/document-types/${docType.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          {canEdit('settings') && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/dashboard/settings/document-types/${docType.id}/edit`}>
                                <Edit className="w-4 h-4" />
                              </Link>
                            </Button>
                          )}
                          {canDelete('settings') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteTarget(docType)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{deleteTarget?.name}</strong>? It will no longer appear in
              document type lists, but existing documents will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
