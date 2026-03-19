import { Link, useParams } from 'react-router';
import { ArrowLeft, Edit, Trash2, FileText, CheckCircle2, XCircle, Users, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

// Mock data
const mockDocumentType = {
  id: 'DT001',
  name: 'Passport',
  description: 'Valid passport required for identity verification and international travel authorization',
  category: 'Identity Documents',
  required: true,
  expiryTracking: true,
  expiryWarningDays: 30,
  allowMultiple: false,
  verificationRequired: true,
  fileFormats: ['PDF', 'JPG', 'PNG'],
  maxFileSize: 10,
  applicableJobTypes: ['All'],
  validationRules: 'Must be valid for at least 6 months from date of upload. Must show clear photo and personal details.',
  createdAt: '2024-01-15',
  createdBy: 'Sarah Johnson',
  updatedAt: '2024-03-10',
  updatedBy: 'Michael Chen',
  status: 'Active',
  usageStats: {
    totalUploads: 156,
    verified: 142,
    pending: 8,
    rejected: 6,
    expiringSoon: 12,
  },
  recentActivity: [
    {
      id: 1,
      employeeName: 'Jan Kowalski',
      action: 'Document Uploaded',
      date: '2026-03-16',
      status: 'Verified',
    },
    {
      id: 2,
      employeeName: 'Maria Silva',
      action: 'Document Verified',
      date: '2026-03-15',
      status: 'Verified',
    },
    {
      id: 3,
      employeeName: 'Andrei Popescu',
      action: 'Document Uploaded',
      date: '2026-03-14',
      status: 'Pending',
    },
    {
      id: 4,
      employeeName: 'Olena Kovalenko',
      action: 'Document Rejected',
      date: '2026-03-13',
      status: 'Rejected',
    },
    {
      id: 5,
      employeeName: 'Dmitri Ivanov',
      action: 'Document Verified',
      date: '2026-03-12',
      status: 'Verified',
    },
  ],
};

export function DocumentTypeView() {
  const { id } = useParams();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
            <h1 className="text-3xl font-semibold text-[#0F172A]">{mockDocumentType.name}</h1>
            <p className="text-muted-foreground mt-1">Document Type ID: {mockDocumentType.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link to={`/dashboard/settings/document-types/${id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge className="bg-green-100 text-green-800">
          {mockDocumentType.status}
        </Badge>
        {mockDocumentType.required && (
          <Badge variant="outline">Required Document</Badge>
        )}
        {mockDocumentType.expiryTracking && (
          <Badge variant="outline" className="bg-[#EFF6FF]">Expiry Tracking Enabled</Badge>
        )}
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{mockDocumentType.usageStats.totalUploads}</p>
                <p className="text-sm text-muted-foreground">Total Uploads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{mockDocumentType.usageStats.verified}</p>
                <p className="text-sm text-muted-foreground">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{mockDocumentType.usageStats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                <XCircle className="w-5 h-5 text-[#EF4444]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{mockDocumentType.usageStats.rejected}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{mockDocumentType.usageStats.expiringSoon}</p>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
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
                  <p className="font-medium">{mockDocumentType.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Category</p>
                  <p className="font-medium">{mockDocumentType.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="font-medium">{mockDocumentType.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge className="bg-green-100 text-green-800">
                    {mockDocumentType.status}
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
                  <Badge variant={mockDocumentType.required ? 'default' : 'outline'}>
                    {mockDocumentType.required ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expiry Tracking</span>
                  <Badge variant={mockDocumentType.expiryTracking ? 'default' : 'outline'}>
                    {mockDocumentType.expiryTracking ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {mockDocumentType.expiryTracking && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Warning Period</span>
                    <span className="font-medium">{mockDocumentType.expiryWarningDays} days</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Allow Multiple Uploads</span>
                  <Badge variant={mockDocumentType.allowMultiple ? 'default' : 'outline'}>
                    {mockDocumentType.allowMultiple ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Verification Required</span>
                  <Badge variant={mockDocumentType.verificationRequired ? 'default' : 'outline'}>
                    {mockDocumentType.verificationRequired ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* File Settings */}
            <Card>
              <CardHeader>
                <CardTitle>File Upload Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Allowed File Formats</p>
                  <div className="flex flex-wrap gap-2">
                    {mockDocumentType.fileFormats.map((format) => (
                      <Badge key={format} variant="outline">
                        {format}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Maximum File Size</p>
                  <p className="font-medium">{mockDocumentType.maxFileSize} MB</p>
                </div>
              </CardContent>
            </Card>

            {/* Job Type Applicability */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Job Type Applicability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockDocumentType.applicableJobTypes.map((jobType) => (
                    <Badge key={jobType} variant="outline" className="mr-2">
                      {jobType}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  This document type applies to all job types
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Validation Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Validation Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{mockDocumentType.validationRules}</p>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Created On</p>
                <p className="font-medium">{mockDocumentType.createdAt}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Created By</p>
                <p className="font-medium">{mockDocumentType.createdBy}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                <p className="font-medium">{mockDocumentType.updatedAt}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Updated By</p>
                <p className="font-medium">{mockDocumentType.updatedBy}</p>
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
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Basic Settings</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Document Type:</span>
                        <span className="font-medium">{mockDocumentType.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category:</span>
                        <span className="font-medium">{mockDocumentType.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge className="bg-green-100 text-green-800">{mockDocumentType.status}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Requirements</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Required:</span>
                        <span className="font-medium">{mockDocumentType.required ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Verification:</span>
                        <span className="font-medium">{mockDocumentType.verificationRequired ? 'Required' : 'Optional'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Multiple Files:</span>
                        <span className="font-medium">{mockDocumentType.allowMultiple ? 'Allowed' : 'Single Only'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">Expiry Settings</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tracking:</span>
                        <span className="font-medium">{mockDocumentType.expiryTracking ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      {mockDocumentType.expiryTracking && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Warning Period:</span>
                            <span className="font-medium">{mockDocumentType.expiryWarningDays} days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Currently Expiring:</span>
                            <span className="font-medium text-[#F59E0B]">{mockDocumentType.usageStats.expiringSoon}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-3">File Settings</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Size:</span>
                        <span className="font-medium">{mockDocumentType.maxFileSize} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Formats:</span>
                        <span className="font-medium">{mockDocumentType.fileFormats.length} types</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {mockDocumentType.fileFormats.map((format) => (
                          <Badge key={format} variant="outline" className="text-xs">
                            {format}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Recent uploads and actions for this document type
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockDocumentType.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.status === 'Verified' ? 'bg-green-100' :
                        activity.status === 'Pending' ? 'bg-yellow-100' :
                        'bg-red-100'
                      }`}>
                        {activity.status === 'Verified' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : activity.status === 'Pending' ? (
                          <Calendar className="w-5 h-5 text-yellow-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{activity.employeeName}</p>
                        <p className="text-sm text-muted-foreground">{activity.action}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(activity.status)}>
                        {activity.status}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">{activity.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
