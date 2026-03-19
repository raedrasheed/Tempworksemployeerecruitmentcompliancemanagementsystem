import { useState } from 'react';
import { Link } from 'react-router';
import { Search, Filter, Eye } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { mockApplications } from '../../data/mockData';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

// Define columns for the filter system
const applicationColumns: Column[] = [
  { id: 'id', label: 'Application ID', type: 'text' },
  { id: 'driverName', label: 'Employee Name', type: 'text' },
  { id: 'position', label: 'Position', type: 'text' },
  { id: 'nationality', label: 'Nationality', type: 'text' },
  { id: 'submittedDate', label: 'Submitted Date', type: 'date' },
  { id: 'status', label: 'Status', type: 'enum', options: ['submitted', 'in_review', 'approved', 'rejected', 'on_hold'] },
  { id: 'reviewedBy', label: 'Reviewed By', type: 'text' },
];

export function ApplicationsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: '1',
      name: 'Pending Review',
      rules: [
        { id: '1', columnId: 'status', operator: 'equals', value: 'in_review' }
      ],
      logic: 'AND'
    },
    {
      id: '2',
      name: 'Recent Applications',
      rules: [
        { id: '1', columnId: 'submittedDate', operator: 'after', value: '2026-02-01' }
      ],
      logic: 'AND'
    }
  ]);

  // Apply filters to applications
  const applyFilters = (app: any) => {
    if (activeFilters.length === 0) return true;

    const results = activeFilters.map(filter => {
      const column = applicationColumns.find(c => c.id === filter.columnId);
      if (!column) return true;

      const value = (app as any)[filter.columnId] || '';

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

  const filteredApplications = mockApplications.filter(app => {
    const matchesSearch = app.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesFilters = applyFilters(app);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-[#22C55E]';
      case 'in_review': return 'bg-[#2563EB]';
      case 'rejected': return 'bg-[#EF4444]';
      case 'on_hold': return 'bg-[#F59E0B]';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Applications</h1>
        <p className="text-muted-foreground mt-1">Manage driver applications and recruitment requests</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>

            <FilterSystem
              columns={applicationColumns}
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

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application ID</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.id}</TableCell>
                    <TableCell>{app.driverName}</TableCell>
                    <TableCell>{app.position}</TableCell>
                    <TableCell>{app.nationality}</TableCell>
                    <TableCell>{app.submittedDate}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(app.status)}>
                        {app.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{app.reviewedBy || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/dashboard/applications/${app.id}`}>
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