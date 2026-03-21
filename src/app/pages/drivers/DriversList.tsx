import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';
import { employeesApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

// Define columns for the filter system
const employeeColumns: Column[] = [
  { id: 'name', label: 'Employee Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'phone', label: 'Phone', type: 'text' },
  { id: 'nationality', label: 'Nationality', type: 'text' },
  { id: 'license', label: 'ID / License', type: 'text' },
  { id: 'experience', label: 'Experience (years)', type: 'number' },
  { id: 'agency', label: 'Agency', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['active', 'pending', 'inactive', 'suspended'] },
  { id: 'jobType', label: 'Job Type', type: 'enum', options: ['Truck Driver', 'Warehouse Worker', 'Forklift Operator', 'Logistics Coordinator', 'Construction Worker', 'Technician', 'General Worker'] },
  { id: 'createdDate', label: 'Created Date', type: 'date' },
];

export function DriversList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [employees, setEmployees] = useState<any[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: 1, limit: 50 };
      if (searchTerm) params.search = searchTerm;
      const result = await employeesApi.list(params);
      setEmployees(result.data || []);
      setTotalEmployees(result.meta?.total || 0);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: '1',
      name: 'Active Truck Drivers',
      rules: [
        { id: '1', columnId: 'status', operator: 'equals', value: 'active' },
        { id: '2', columnId: 'jobType', operator: 'equals', value: 'Truck Driver' }
      ],
      logic: 'AND'
    },
    {
      id: '2',
      name: 'Experienced EU Workers',
      rules: [
        { id: '1', columnId: 'experience', operator: 'greaterThan', value: '5' },
        { id: '2', columnId: 'nationality', operator: 'contains', value: 'Poland' }
      ],
      logic: 'AND'
    }
  ]);

  // Apply filters to drivers
  const applyFilters = (driver: any) => {
    if (activeFilters.length === 0) return true;

    const results = activeFilters.map(filter => {
      const column = employeeColumns.find(c => c.id === filter.columnId);
      if (!column) return true;

      let value: any;
      switch (filter.columnId) {
        case 'name':
          value = `${driver.firstName} ${driver.lastName}`.toLowerCase();
          break;
        case 'experience':
          value = parseInt(String(driver.yearsExperience ?? driver.experience ?? '0'));
          break;
        case 'createdDate':
          value = driver.createdAt || '2026-01-01';
          break;
        default:
          value = (driver as any)[filter.columnId] || '';
      }

      // Apply operator logic
      switch (filter.operator) {
        case 'contains':
          return value.toLowerCase().includes(filter.value.toLowerCase());
        case 'equals':
          return value.toString().toLowerCase() === filter.value.toLowerCase();
        case 'startsWith':
          return value.toLowerCase().startsWith(filter.value.toLowerCase());
        case 'endsWith':
          return value.toLowerCase().endsWith(filter.value.toLowerCase());
        case 'greaterThan':
          return parseFloat(value) > parseFloat(filter.value);
        case 'lessThan':
          return parseFloat(value) < parseFloat(filter.value);
        case 'greaterThanOrEqual':
          return parseFloat(value) >= parseFloat(filter.value);
        case 'lessThanOrEqual':
          return parseFloat(value) <= parseFloat(filter.value);
        case 'between':
          return parseFloat(value) >= parseFloat(filter.value) && parseFloat(value) <= parseFloat(filter.value2);
        case 'before':
          return new Date(value) < new Date(filter.value);
        case 'after':
          return new Date(value) > new Date(filter.value);
        default:
          return true;
      }
    });

    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  // Use employees from API, filtered client-side for active filters
  const filteredDrivers = employees.filter(driver => {
    const matchesFilters = applyFilters(driver);
    return matchesFilters;
  });

  const handleSavePreset = (name: string, rules: FilterRule[], logic: 'AND' | 'OR') => {
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name,
      rules,
      logic
    };
    setSavedPresets([...savedPresets, newPreset]);
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    setActiveFilters(preset.rules);
    setFilterLogic(preset.logic);
  };

  const handleDeletePreset = (presetId: string) => {
    setSavedPresets(savedPresets.filter(p => p.id !== presetId));
  };

  const handleDelete = async (employee: any) => {
    if (!confirm(`Delete "${employee.firstName} ${employee.lastName}"? This cannot be undone.`)) return;
    try {
      await employeesApi.delete(employee.id);
      setEmployees(prev => prev.filter(e => e.id !== employee.id));
      setTotalEmployees(prev => prev - 1);
      toast.success('Employee deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete employee');
    }
  };

  const handleExport = () => {
    console.log('Exporting', filteredDrivers.length, 'employees');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage and track all employees in the system</p>
        </div>
        {canCreate('employees') && (
          <Button asChild>
            <Link to="/dashboard/employees/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Link>
          </Button>
        )}
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

            <FilterSystem
              columns={employeeColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={handleSavePreset}
              onLoadPreset={handleLoadPreset}
              onDeletePreset={handleDeletePreset}
            />

            <Button variant="outline" onClick={handleExport}>
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
                          src={driver.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.firstName}`}
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
                      {driver.agency ? (
                        <div className="text-sm">
                          <div>{driver.agency.name ?? driver.agencyName}</div>
                        </div>
                      ) : driver.agencyName ? (
                        <div className="text-sm">{driver.agencyName}</div>
                      ) : (
                        <span className="text-muted-foreground">Direct</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          driver.status === 'ACTIVE'     ? 'bg-[#22C55E]' :
                          driver.status === 'PENDING'    ? 'bg-[#F59E0B]' :
                          driver.status === 'ONBOARDING' ? 'bg-[#2563EB]' :
                          driver.status === 'ON_LEAVE'   ? 'bg-[#8B5CF6]' :
                          'bg-gray-500'
                        }
                      >
                        {driver.status?.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {driver.currentStage ? driver.currentStage.replace(/_/g, ' ') : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/employees/${driver.id}`}>
                            <Eye className="w-4 h-4 mr-1" />View
                          </Link>
                        </Button>
                        {canEdit('employees') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/employees/${driver.id}/edit`}>
                              <Edit className="w-4 h-4 mr-1" />Edit
                            </Link>
                          </Button>
                        )}
                        {canDelete('employees') && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleDelete(driver)}
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredDrivers.length} of {totalEmployees} employees
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