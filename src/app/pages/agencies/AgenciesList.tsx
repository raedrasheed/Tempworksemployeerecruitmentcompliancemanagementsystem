import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Eye, Search } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { mockAgencies } from '../../data/mockData';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

// Define columns for the filter system
const agencyColumns: Column[] = [
  { id: 'name', label: 'Agency Name', type: 'text' },
  { id: 'country', label: 'Country', type: 'text' },
  { id: 'contactPerson', label: 'Contact Person', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'phone', label: 'Phone', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['active', 'inactive', 'suspended'] },
  { id: 'activeDrivers', label: 'Active Employees', type: 'number' },
  { id: 'totalDrivers', label: 'Total Employees', type: 'number' },
];

export function AgenciesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: '1',
      name: 'Active Agencies',
      rules: [
        { id: '1', columnId: 'status', operator: 'equals', value: 'active' }
      ],
      logic: 'AND'
    },
    {
      id: '2',
      name: 'Large Agencies',
      rules: [
        { id: '1', columnId: 'totalDrivers', operator: 'greaterThan', value: '50' }
      ],
      logic: 'AND'
    }
  ]);

  // Apply filters to agencies
  const applyFilters = (agency: any) => {
    if (activeFilters.length === 0) return true;

    const results = activeFilters.map(filter => {
      const column = agencyColumns.find(c => c.id === filter.columnId);
      if (!column) return true;

      const value = (agency as any)[filter.columnId] || '';

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
        default:
          return true;
      }
    });

    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const filteredAgencies = mockAgencies.filter(agency => {
    const matchesSearch = agency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agency.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agency.status === statusFilter;
    const matchesFilters = applyFilters(agency);
    return matchesSearch && matchesStatus && matchesFilters;
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-[#22C55E]">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500">Inactive</Badge>;
      case 'suspended':
        return <Badge className="bg-[#EF4444]">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Agencies</h1>
          <p className="text-muted-foreground mt-1">Manage recruitment agency partnerships</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/agencies/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Agency
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            <FilterSystem
              columns={agencyColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={handleSavePreset}
              onLoadPreset={handleLoadPreset}
              onDeletePreset={handleDeletePreset}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Active Drivers</TableHead>
                  <TableHead>Total Drivers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgencies.map((agency) => (
                  <TableRow key={agency.id}>
                    <TableCell className="font-medium">{agency.name}</TableCell>
                    <TableCell>{agency.country}</TableCell>
                    <TableCell>{agency.contactPerson}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{agency.email}</div>
                        <div className="text-muted-foreground">{agency.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>{agency.activeDrivers}</TableCell>
                    <TableCell>{agency.totalDrivers}</TableCell>
                    <TableCell>{getStatusBadge(agency.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/dashboard/agencies/${agency.id}`}>
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
        </CardContent>
      </Card>
    </div>
  );
}