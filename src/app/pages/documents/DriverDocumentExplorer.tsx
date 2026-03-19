import { useState } from 'react';
import { Download, Search, Filter, CheckSquare, Square, FileArchive, FileDown, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { mockDrivers, mockDocuments, mockAgencies } from '../../data/mockData';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

// Define columns for the filter system
const employeeColumns: Column[] = [
  { id: 'name', label: 'Employee Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'nationality', label: 'Nationality', type: 'text' },
  { id: 'agency', label: 'Agency', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['active', 'pending', 'inactive'] },
  { id: 'jobType', label: 'Job Type', type: 'enum', options: ['Truck Driver', 'Warehouse Worker', 'Forklift Operator', 'Logistics Coordinator', 'Construction Worker', 'Technician', 'General Worker'] },
];

export function DriverDocumentExplorer() {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [nationalityFilter, setNationalityFilter] = useState('all');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: '1',
      name: 'Active Employees',
      rules: [
        { id: '1', columnId: 'status', operator: 'equals', value: 'active' }
      ],
      logic: 'AND'
    }
  ]);

  // Get unique nationalities and agencies for filters
  const nationalities = Array.from(new Set(mockDrivers.map(d => d.nationality)));
  const agencies = mockAgencies;

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
        case 'agency':
          value = driver.agencyName || '';
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
        default:
          return true;
      }
    });

    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  // Filter drivers based on search and filters
  const filteredDrivers = mockDrivers.filter(driver => {
    const matchesSearch = driver.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         driver.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         driver.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNationality = nationalityFilter === 'all' || driver.nationality === nationalityFilter;
    const matchesAgency = agencyFilter === 'all' || driver.agencyId === agencyFilter;
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    const matchesFilters = applyFilters(driver);
    
    return matchesSearch && matchesNationality && matchesAgency && matchesStatus && matchesFilters;
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

  // Get documents for selected drivers
  const selectedDriverDocuments = selectedDrivers.length > 0
    ? mockDocuments.filter(doc => selectedDrivers.includes(doc.driverId))
    : [];

  const toggleDriverSelection = (driverId: string) => {
    setSelectedDrivers(prev =>
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
    setSelectedDocuments([]); // Clear document selection when driver selection changes
  };

  const toggleAllDrivers = () => {
    if (selectedDrivers.length === filteredDrivers.length) {
      setSelectedDrivers([]);
    } else {
      setSelectedDrivers(filteredDrivers.map(d => d.id));
    }
    setSelectedDocuments([]);
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const toggleAllDocuments = () => {
    if (selectedDocuments.length === selectedDriverDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(selectedDriverDocuments.map(d => d.id));
    }
  };

  const handleDownloadSelected = () => {
    alert(`Downloading ${selectedDocuments.length} selected document(s)`);
  };

  const handleDownloadAll = () => {
    alert(`Downloading all ${selectedDriverDocuments.length} documents as ZIP file`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Employee Document Explorer</h1>
        <p className="text-muted-foreground mt-1">Search employees and download their documents</p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Nationality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Nationalities</SelectItem>
                  {nationalities.map(nat => (
                    <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Agency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agencies</SelectItem>
                  {agencies.map(agency => (
                    <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Employees ({filteredDrivers.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {selectedDrivers.length} selected
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b">
                <tr>
                  <th className="text-left p-4 w-12">
                    <Checkbox
                      checked={selectedDrivers.length === filteredDrivers.length && filteredDrivers.length > 0}
                      onCheckedChange={toggleAllDrivers}
                    />
                  </th>
                  <th className="text-left p-4 font-semibold text-sm">Employee Name</th>
                  <th className="text-left p-4 font-semibold text-sm">Nationality</th>
                  <th className="text-left p-4 font-semibold text-sm">Agency</th>
                  <th className="text-left p-4 font-semibold text-sm">Status</th>
                  <th className="text-left p-4 font-semibold text-sm">Documents</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => {
                  const driverDocs = mockDocuments.filter(d => d.driverId === driver.id);
                  const isSelected = selectedDrivers.includes(driver.id);
                  
                  return (
                    <tr 
                      key={driver.id} 
                      className={`border-b hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : ''}`}
                    >
                      <td className="p-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleDriverSelection(driver.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={driver.photo} 
                            alt={driver.firstName}
                            className="w-8 h-8 rounded-full"
                          />
                          <div>
                            <p className="font-medium">{driver.firstName} {driver.lastName}</p>
                            <p className="text-sm text-muted-foreground">{driver.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{driver.nationality}</td>
                      <td className="p-4">{driver.agencyName || '-'}</td>
                      <td className="p-4">
                        <Badge className={
                          driver.status === 'active' ? 'bg-[#22C55E]' :
                          driver.status === 'pending' ? 'bg-[#F59E0B]' :
                          'bg-gray-500'
                        }>
                          {driver.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{driverDocs.length} docs</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Documents Section - Shows when drivers are selected */}
      {selectedDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedDrivers.length === 1 
                    ? 'Employee Documents' 
                    : `Documents from ${selectedDrivers.length} Employees`}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDriverDocuments.length} total documents
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedDocuments.length} selected
                </Badge>
                <Button 
                  variant="outline" 
                  onClick={handleDownloadSelected}
                  disabled={selectedDocuments.length === 0}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download Selected
                </Button>
                <Button onClick={handleDownloadAll}>
                  <FileArchive className="w-4 h-4 mr-2" />
                  Download All as ZIP
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#F8FAFC] border-b">
                  <tr>
                    <th className="text-left p-4 w-12">
                      <Checkbox
                        checked={selectedDocuments.length === selectedDriverDocuments.length && selectedDriverDocuments.length > 0}
                        onCheckedChange={toggleAllDocuments}
                      />
                    </th>
                    {selectedDrivers.length > 1 && (
                      <th className="text-left p-4 font-semibold text-sm">Employee Name</th>
                    )}
                    <th className="text-left p-4 font-semibold text-sm">Document Name</th>
                    <th className="text-left p-4 font-semibold text-sm">Document Type</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-left p-4 font-semibold text-sm">Expiry Date</th>
                    <th className="text-left p-4 font-semibold text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDriverDocuments.map((doc) => {
                    const isSelected = selectedDocuments.includes(doc.id);
                    
                    return (
                      <tr 
                        key={doc.id} 
                        className={`border-b hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : ''}`}
                      >
                        <td className="p-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleDocumentSelection(doc.id)}
                          />
                        </td>
                        {selectedDrivers.length > 1 && (
                          <td className="p-4">
                            <p className="font-medium">{doc.driverName}</p>
                          </td>
                        )}
                        <td className="p-4">
                          <p className="font-medium">{doc.fileName}</p>
                          <p className="text-sm text-muted-foreground">{doc.fileSize}</p>
                        </td>
                        <td className="p-4">{doc.type}</td>
                        <td className="p-4">
                          <Badge 
                            variant="outline"
                            className={
                              doc.status === 'valid' ? 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]' :
                              doc.status === 'expiring_soon' ? 'bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]' :
                              doc.status === 'expired' ? 'bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]' :
                              'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                            }
                          >
                            {doc.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-4">{doc.expiryDate || '-'}</td>
                        <td className="p-4">
                          <Button size="sm" variant="ghost">
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {selectedDrivers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F8FAFC] flex items-center justify-center mx-auto mb-4">
              <FileArchive className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Employees Selected</h3>
            <p className="text-muted-foreground">
              Select one or more employees from the table above to view and download their documents
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}