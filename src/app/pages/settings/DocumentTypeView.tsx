import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { ArrowLeft, Edit, Trash2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
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
  description?: string;
  category: string;
  required: boolean;
  trackExpiry: boolean;
  renewalPeriodDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { documents: number };
}

export function DocumentTypeView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [docType, setDocType] = useState<DocumentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    settingsApi.getDocumentType(id)
      .then((data: any) => setDocType(data))
      .catch((err: any) => {
        toast.error(err?.message || 'Failed to load document type');
        navigate('/dashboard/settings/document-types');
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!docType) return;
    setDeleting(true);
    try {
      await settingsApi.deleteDocumentType(docType.id);
      toast.success(`"${docType.name}" deactivated successfully`);
      navigate('/dashboard/settings/document-types');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deactivate document type');
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Loading document type...
      </div>
    );
  }

  if (!docType) return null;

  const totalUploads = docType._count?.documents ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/settings/document-types">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-[#0F172A]">{docType.name}</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">ID: {docType.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link to={`/dashboard/settings/document-types/${id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Deactivate
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge className={docType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
          {docType.isActive ? 'Active' : 'Inactive'}
        </Badge>
        {docType.required && <Badge variant="outline">Required Document</Badge>}
        {docType.trackExpiry && (
          <Badge variant="outline" className="bg-[#EFF6FF]">Expiry Tracking Enabled</Badge>
        )}
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{totalUploads}</p>
                <p className="text-sm text-muted-foreground">Total Uploads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {docType.renewalPeriodDays && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                  <span className="text-[#F59E0B] font-bold text-sm">{docType.renewalPeriodDays}d</span>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{docType.renewalPeriodDays}</p>
                  <p className="text-sm text-muted-foreground">Days Warning Before Expiry</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Document Type Name</p>
                  <p className="font-medium">{docType.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Category</p>
                  <p className="font-medium">{docType.category}</p>
                </div>
                {docType.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="font-medium">{docType.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge className={docType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                    {docType.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Required Document</span>
                  <Badge variant={docType.required ? 'default' : 'outline'}>
                    {docType.required ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expiry Tracking</span>
                  <Badge variant={docType.trackExpiry ? 'default' : 'outline'}>
                    {docType.trackExpiry ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {docType.trackExpiry && docType.renewalPeriodDays && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Warning Period</span>
                    <span className="font-medium">{docType.renewalPeriodDays} days</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Created On</p>
                <p className="font-medium">{new Date(docType.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                <p className="font-medium">{new Date(docType.updatedAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Document Type Settings</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Comprehensive configuration and requirements for this document type
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-3">Basic Settings</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Document Type:</span>
                      <span className="font-medium">{docType.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium">{docType.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={docType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                        {docType.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-3">Requirements</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Required:</span>
                      <span className="font-medium">{docType.required ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Uploads:</span>
                      <span className="font-medium">{totalUploads}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-3">Expiry Settings</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tracking:</span>
                      <span className="font-medium">{docType.trackExpiry ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    {docType.trackExpiry && docType.renewalPeriodDays && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Warning Period:</span>
                        <span className="font-medium">{docType.renewalPeriodDays} days</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{docType.name}</strong>? It will no longer appear in
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
