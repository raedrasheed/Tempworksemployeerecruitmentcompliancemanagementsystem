import { useState, useEffect } from 'react';
import { Download, Search, FileArchive, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { employeesApi, agenciesApi, documentsApi } from '../../services/api';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
const getFileUrl = (fileUrl: string) => `${API_BASE}${fileUrl}`;

const employeeColumns: Column[] = [
  { id: 'name', label: 'Employee Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'nationality', label: 'Nationality', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED'] },
];

function triggerZipDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EmployeeDocumentExplorer() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeeDocuments, setEmployeeDocuments] = useState<Record<string, any[]>>({});
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nationalityFilter, setNationalityFilter] = useState('all');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    { id: '1', name: 'Active Employees', rules: [{ id: '1', columnId: 'status', operator: 'equals', value: 'ACTIVE' }], logic: 'AND' },
  ]);

  useEffect(() => {
    Promise.all([
      employeesApi.list({ limit: 500 }),
      agenciesApi.list({ limit: 200 }),
    ]).then(([empResult, agencyResult]) => {
      const emps: any[] = (empResult as any)?.data ?? [];
      setEmployees(emps);
      setAgencies((agencyResult as any)?.data ?? []);
      // load doc counts for all employees
      Promise.all(
        emps.map(emp =>
          documentsApi.getByEntity('EMPLOYEE', emp.id)
            .then((res: any) => ({ id: emp.id, count: (res?.data ?? res ?? []).length }))
            .catch(() => ({ id: emp.id, count: 0 }))
        )
      ).then(counts => {
        const map: Record<string, number> = {};
        counts.forEach(c => { map[c.id] = c.count; });
        setDocCounts(map);
      });
    }).catch(() => toast.error('Failed to load employees'))
      .finally(() => setLoading(false));
  }, []);

  // Load documents when employee selection changes
  useEffect(() => {
    const toLoad = selectedEmployees.filter(id => !employeeDocuments[id]);
    if (toLoad.length === 0) return;
    Promise.all(
      toLoad.map(id =>
        documentsApi.getByEntity('EMPLOYEE', id)
          .then((res: any) => ({ id, docs: res?.data ?? res ?? [] }))
          .catch(() => ({ id, docs: [] }))
      )
    ).then(results => {
      setEmployeeDocuments(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.id] = r.docs; });
        return next;
      });
    });
  }, [selectedEmployees]);

  const nationalities = Array.from(new Set(employees.map(e => e.nationality).filter(Boolean)));

  const applyFilters = (emp: any) => {
    if (activeFilters.length === 0) return true;
    const results = activeFilters.map(filter => {
      let value: any;
      if (filter.columnId === 'name') value = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      else value = (emp[filter.columnId] ?? '').toString().toLowerCase();
      switch (filter.operator) {
        case 'contains':   return value.includes(filter.value.toLowerCase());
        case 'equals':     return value === filter.value.toLowerCase();
        case 'startsWith': return value.startsWith(filter.value.toLowerCase());
        case 'endsWith':   return value.endsWith(filter.value.toLowerCase());
        default:           return true;
      }
    });
    return filterLogic === 'AND' ? results.every(r => r) : results.some(r => r);
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNationality = nationalityFilter === 'all' || emp.nationality === nationalityFilter;
    const matchesAgency = agencyFilter === 'all' || emp.agencyId === agencyFilter;
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesNationality && matchesAgency && matchesStatus && applyFilters(emp);
  });

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
    setSelectedDocuments([]);
  };

  const toggleAllEmployees = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(e => e.id));
    }
    setSelectedDocuments([]);
  };

  const toggleDocument = (docId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const allSelectedDocs = selectedEmployees.flatMap(id => employeeDocuments[id] ?? []);

  const toggleAllDocuments = () => {
    if (selectedDocuments.length === allSelectedDocs.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(allSelectedDocs.map(d => d.id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':      return <Badge variant="outline" className="bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]">Valid</Badge>;
      case 'EXPIRING_SOON': return <Badge variant="outline" className="bg-[#FEF3C7] text-[#F59E0B] border-[#F59E0B]">Expiring Soon</Badge>;
      case 'EXPIRED':       return <Badge variant="outline" className="bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]">Expired</Badge>;
      case 'REJECTED':      return <Badge variant="outline" className="bg-[#FEE2E2] text-[#EF4444] border-[#EF4444]">Rejected</Badge>;
      default:              return <Badge variant="outline" className="bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]">Pending</Badge>;
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Employee Document Explorer</h1>
        <p className="text-muted-foreground mt-1">Search employees and download their documents</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle>Search & Filter Employees</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                <SelectTrigger><SelectValue placeholder="Nationality" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Nationalities</SelectItem>
                  {nationalities.map(nat => (
                    <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger><SelectValue placeholder="Agency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agencies</SelectItem>
                  {agencies.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FilterSystem
              columns={employeeColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={(name, rules, logic) => setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, rules, logic }])}
              onLoadPreset={preset => { setActiveFilters(preset.rules); setFilterLogic(preset.logic); }}
              onDeletePreset={id => setSavedPresets(prev => prev.filter(p => p.id !== id))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
            <Badge variant="outline">{selectedEmployees.length} selected</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b">
                <tr>
                  <th className="text-left p-4 w-12">
                    <Checkbox
                      checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onCheckedChange={toggleAllEmployees}
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
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No employees found</td></tr>
                ) : filteredEmployees.map(emp => {
                  const isSelected = selectedEmployees.includes(emp.id);
                  return (
                    <tr key={emp.id} className={`border-b hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : ''}`}>
                      <td className="p-4">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleEmployee(emp.id)} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-semibold">
                            {emp.firstName?.[0]}{emp.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                            <p className="text-sm text-muted-foreground">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{emp.nationality ?? '-'}</td>
                      <td className="p-4">{emp.agency?.name ?? '-'}</td>
                      <td className="p-4">
                        <Badge className={
                          emp.status === 'ACTIVE' ? 'bg-[#22C55E]' :
                          emp.status === 'PENDING' ? 'bg-[#F59E0B]' : 'bg-gray-500'
                        }>
                          {emp.status?.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{docCounts[emp.id] ?? 0} docs</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Documents section */}
      {selectedEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedEmployees.length === 1 ? 'Employee Documents' : `Documents from ${selectedEmployees.length} Employees`}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{allSelectedDocs.length} total documents</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedDocuments.length} selected</Badge>
                <Button
                  variant="outline"
                  disabled={selectedDocuments.length === 0 || downloading}
                  onClick={async () => {
                    setDownloading(true);
                    try {
                      const blob = await documentsApi.bulkDownload(selectedDocuments);
                      triggerZipDownload(blob, `selected_documents_${Date.now()}.zip`);
                    } catch (err: any) {
                      toast.error(err?.message || 'Download failed');
                    } finally {
                      setDownloading(false);
                    }
                  }}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  {downloading ? 'Preparing…' : 'Download Selected'}
                </Button>
                <Button
                  disabled={allSelectedDocs.length === 0 || downloading}
                  onClick={async () => {
                    setDownloading(true);
                    try {
                      const ids = allSelectedDocs.map(d => d.id);
                      const blob = await documentsApi.bulkDownload(ids);
                      triggerZipDownload(blob, `all_documents_${Date.now()}.zip`);
                    } catch (err: any) {
                      toast.error(err?.message || 'Download failed');
                    } finally {
                      setDownloading(false);
                    }
                  }}
                >
                  <FileArchive className="w-4 h-4 mr-2" />
                  {downloading ? 'Preparing…' : 'Download All'}
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
                        checked={selectedDocuments.length === allSelectedDocs.length && allSelectedDocs.length > 0}
                        onCheckedChange={toggleAllDocuments}
                      />
                    </th>
                    {selectedEmployees.length > 1 && (
                      <th className="text-left p-4 font-semibold text-sm">Employee</th>
                    )}
                    <th className="text-left p-4 font-semibold text-sm">Document Name</th>
                    <th className="text-left p-4 font-semibold text-sm">Document Type</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-left p-4 font-semibold text-sm">Expiry Date</th>
                    <th className="text-left p-4 font-semibold text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allSelectedDocs.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No documents found for selected employees</td></tr>
                  ) : allSelectedDocs.map(doc => {
                    const isSelected = selectedDocuments.includes(doc.id);
                    const emp = employees.find(e => e.id === doc.entityId);
                    return (
                      <tr key={doc.id} className={`border-b hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : ''}`}>
                        <td className="p-4">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleDocument(doc.id)} />
                        </td>
                        {selectedEmployees.length > 1 && (
                          <td className="p-4">
                            <p className="font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : doc.entityId}</p>
                          </td>
                        )}
                        <td className="p-4">
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                        </td>
                        <td className="p-4">{doc.documentType?.name ?? '-'}</td>
                        <td className="p-4">{getStatusBadge(doc.status)}</td>
                        <td className="p-4">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '-'}</td>
                        <td className="p-4">
                          <Button size="sm" variant="ghost" asChild>
                            <a href={getFileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer" download>
                              <Download className="w-4 h-4 mr-1" />Download
                            </a>
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

      {selectedEmployees.length === 0 && (
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
