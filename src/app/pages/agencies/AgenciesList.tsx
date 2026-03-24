import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Eye, Edit, Trash2, Search } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { agenciesApi } from '../../services/api';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';
import { usePermissions } from '../../hooks/usePermissions';

const agencyColumns: Column[] = [
  { id: 'name', label: 'Agency Name', type: 'text' },
  { id: 'country', label: 'Country', type: 'text' },
  { id: 'contactPerson', label: 'Contact Person', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE': return <Badge className="bg-[#22C55E]">Active</Badge>;
    case 'INACTIVE': return <Badge className="bg-gray-500">Inactive</Badge>;
    case 'SUSPENDED': return <Badge className="bg-[#EF4444]">Suspended</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export function AgenciesList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);

  const handleDelete = async (agency: any) => {
    if (!confirm(`Are you sure you want to delete "${agency.name}"? This action cannot be undone.`)) return;
    try {
      await agenciesApi.delete(agency.id);
      setAgencies(prev => prev.filter(a => a.id !== agency.id));
      toast.success('Agency deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete agency');
    }
  };

  useEffect(() => {
    agenciesApi.list({ limit: 100 })
      .then((res: any) => setAgencies(res?.data ?? res ?? []))
      .catch(() => setAgencies([]))
      .finally(() => setLoading(false));
  }, []);

  const applyFilters = (agency: any) => {
    if (activeFilters.length === 0) return true;
    const results = activeFilters.map(filter => {
      const value = (agency[filter.columnId] ?? '').toString();
      switch (filter.operator) {
        case 'contains': return value.toLowerCase().includes(filter.value.toLowerCase());
        case 'equals': return value.toLowerCase() === filter.value.toLowerCase();
        case 'startsWith': return value.toLowerCase().startsWith(filter.value.toLowerCase());
        case 'endsWith': return value.toLowerCase().endsWith(filter.value.toLowerCase());
        default: return true;
      }
    });
    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const filteredAgencies = agencies.filter(agency => {
    const matchesSearch = agency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agency.country ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agency.status === statusFilter;
    return matchesSearch && matchesStatus && applyFilters(agency);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Agencies</h1>
          <p className="text-muted-foreground mt-1">Manage recruitment agency partnerships</p>
        </div>
        {canCreate('agencies') && (
          <Button asChild>
            <Link to="/dashboard/agencies/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Agency
            </Link>
          </Button>
        )}
      </div>

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
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <FilterSystem
              columns={agencyColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={(name, rules, logic) => setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, rules, logic }])}
              onLoadPreset={(preset) => { setActiveFilters(preset.rules); setFilterLogic(preset.logic); }}
              onDeletePreset={(id) => setSavedPresets(prev => prev.filter(p => p.id !== id))}
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredAgencies.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No agencies found</TableCell></TableRow>
                ) : filteredAgencies.map((agency) => (
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
                    <TableCell>{getStatusBadge(agency.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/agencies/${agency.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        {canEdit('agencies') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/agencies/${agency.id}/edit`}>
                              <Edit className="w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                        {canDelete('agencies') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(agency)}
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
        </CardContent>
      </Card>
    </div>
  );
}
