import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { mockDrivers, mockDocuments } from '../../data/mockData';

export function DriverCompliance() {
  const { id } = useParams();
  const driver = mockDrivers.find(d => d.id === id);
  const driverDocs = mockDocuments.filter(d => d.driverId === id);

  if (!driver) return <div>Driver not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/compliance"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">
            {driver.firstName} {driver.lastName} - Compliance
          </h1>
          <p className="text-muted-foreground mt-1">Compliance status and document overview</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Detailed compliance information for this driver</p>
        </CardContent>
      </Card>
    </div>
  );
}