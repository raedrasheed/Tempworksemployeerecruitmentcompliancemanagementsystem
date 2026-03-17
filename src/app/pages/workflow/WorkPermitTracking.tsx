import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { mockDrivers } from '../../data/mockData';

export function WorkPermitTracking() {
  const workPermitDrivers = mockDrivers.filter(d => 
    d.currentStage === 'work_permit' || d.currentStage === 'visa_application'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Work Permit Tracking</h1>
        <p className="text-muted-foreground mt-1">Monitor work permit applications and status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Work Permit Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workPermitDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">
                      {driver.firstName} {driver.lastName}
                    </TableCell>
                    <TableCell>{driver.nationality}</TableCell>
                    <TableCell>{driver.joinedDate}</TableCell>
                    <TableCell>{driver.currentStage.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge className="bg-[#F59E0B]">In Progress</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
