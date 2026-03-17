import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Filter, Download, Eye } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { mockDrivers } from '../../data/mockData';

export function DriversList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');

  const filteredDrivers = mockDrivers.filter(driver => {
    const matchesSearch = 
      driver.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.nationality.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    const matchesJobType = jobTypeFilter === 'all' || (driver as any).jobType === jobTypeFilter;
    
    return matchesSearch && matchesStatus && matchesJobType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage and track all employees in the system</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/employees/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employees by name, email, or nationality..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Types</SelectItem>
                <SelectItem value="Truck Driver">Truck Driver</SelectItem>
                <SelectItem value="Warehouse Worker">Warehouse Worker</SelectItem>
                <SelectItem value="Forklift Operator">Forklift Operator</SelectItem>
                <SelectItem value="Logistics Coordinator">Logistics Coordinator</SelectItem>
                <SelectItem value="Construction Worker">Construction Worker</SelectItem>
                <SelectItem value="Technician">Technician</SelectItem>
                <SelectItem value="General Worker">General Worker</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>

            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>ID/License</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img 
                          src={driver.photo} 
                          alt={driver.firstName}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <div className="font-medium text-[#0F172A]">
                            {driver.firstName} {driver.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">{driver.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{driver.email}</div>
                        <div className="text-muted-foreground">{driver.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>{driver.nationality}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{driver.licenseNumber}</div>
                      </div>
                    </TableCell>
                    <TableCell>{driver.yearsExperience} years</TableCell>
                    <TableCell>
                      {driver.agencyName ? (
                        <div className="text-sm">
                          <div>{driver.agencyName}</div>
                          <div className="text-muted-foreground">{driver.agencyId}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Direct</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={driver.status === 'active' ? 'default' : 'secondary'}
                        className={
                          driver.status === 'active' ? 'bg-[#22C55E]' :
                          driver.status === 'pending' ? 'bg-[#F59E0B]' :
                          'bg-gray-500'
                        }
                      >
                        {driver.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {driver.currentStage.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/dashboard/employees/${driver.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredDrivers.length} of {mockDrivers.length} employees
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}