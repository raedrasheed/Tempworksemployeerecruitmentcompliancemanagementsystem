import { Link, useParams } from 'react-router';
import { ArrowLeft, Download, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { mockDocuments } from '../../data/mockData';

export function DocumentPreview() {
  const { id } = useParams();
  const document = mockDocuments.find(d => d.id === id);

  if (!document) return <div>Document not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/documents"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold text-[#0F172A]">Document Preview</h1>
          <p className="text-muted-foreground mt-1">{document.type} - {document.driverName}</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card className="h-[600px] flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-24 h-24 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Document preview would appear here</p>
              <p className="text-sm text-muted-foreground mt-2">{document.fileName}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium mt-1">{document.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Driver</p>
                <p className="font-medium mt-1">{document.driverName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className="mt-1">{document.status.replace(/_/g, ' ')}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uploaded</p>
                <p className="font-medium mt-1">{document.uploadedDate}</p>
              </div>
              {document.expiryDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium mt-1">{document.expiryDate}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {document.status === 'pending_review' && (
            <div className="space-y-3">
              <Button className="w-full bg-[#22C55E] hover:bg-[#16A34A]">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve Document
              </Button>
              <Button variant="outline" className="w-full text-[#EF4444] border-[#EF4444]">
                <XCircle className="w-4 h-4 mr-2" />
                Reject Document
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}