import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export function DocumentVerification() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/documents"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Document Verification</h1>
          <p className="text-muted-foreground mt-1">Verify and validate driver documents</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Verification Process</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Document verification interface</p></CardContent>
      </Card>
    </div>
  );
}