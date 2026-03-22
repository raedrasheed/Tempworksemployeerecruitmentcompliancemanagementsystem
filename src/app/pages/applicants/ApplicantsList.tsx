import { useState, useEffect, useCallback } from 'react';
import { applicantsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { Link } from 'react-router';
import { Search, Plus, Eye, Edit, UserPlus, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

// Define columns for the filter system
const applicantColumns: Column[] = [
  { id: 'name', label: 'Full Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'phone', label: 'Phone', type: 'text' },
  { id: 'nationality', label: 'Nationality', type: 'text' },
  { id: 'jobType', label: 'Job Type', type: 'enum', options: ['Truck Driver', 'Delivery Driver', 'Warehouse Worker', 'Forklift Operator', 'Logistics Coordinator', 'Construction Worker', 'Technician', 'General Worker'] },
  { id: 'status', label: 'Status', type: 'enum', options: ['New Application', 'Under Review', 'Interview Scheduled', 'Accepted', 'Rejected'] },
  { id: 'applicationDate', label: 'Application Date', type: 'date' },
];

// Mock data
const applicants = [
  {
    id: 'APP001',
    firstName: 'Andrei',
    lastName: 'Popescu',
    nationality: 'Romania',
    phone: '+40 721 234 567',
    email: 'andrei.popescu@email.com',
    jobType: 'Truck Driver',
    applicationDate: '2026-03-15',
    status: 'Under Review',
  },
  {
    id: 'APP002',
    firstName: 'Olena',
    lastName: 'Kovalenko',
    nationality: 'Ukraine',
    phone: '+380 67 123 4567',
    email: 'olena.k@email.com',
    jobType: 'Warehouse Worker',
    applicationDate: '2026-03-14',
    status: 'New Application',
  },
  {
    id: 'APP003',
    firstName: 'Dmitri',
    lastName: 'Ivanov',
    nationality: 'Moldova',
    phone: '+373 69 123 456',
    email: 'dmitri.ivanov@email.com',
    jobType: 'Forklift Operator',
    applicationDate: '2026-03-13',
    status: 'Interview Scheduled',
  },
  {
    id: 'APP004',
    firstName: 'Maria',
    lastName: 'Silva',
    nationality: 'Portugal',
    phone: '+351 91 234 5678',
    email: 'maria.silva@email.com',
    jobType: 'Logistics Coordinator',
    applicationDate: '2026-03-12',
    status: 'Accepted',
  },
  {
    id: 'APP005',
    firstName: 'Jan',
    lastName: 'Kowalski',
    nationality: 'Poland',
    phone: '+48 501 234 567',
    email: 'jan.kowalski@email.com',
    jobType: 'Delivery Driver',
    applicationDate: '2026-03-10',
    status: 'Rejected',
  },
];

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'NEW': return 'bg-blue-100 text-blue-800';
    case 'SCREENING': case 'UNDER_REVIEW': return 'bg-yellow-100 text-yellow-800';
    case 'INTERVIEW': return 'bg-purple-100 text-purple-800';
    case 'OFFER': case 'ONBOARDING': case 'ACCEPTED': case 'APPROVED': return 'bg-green-100 text-green-800';
    case 'REJECTED': case 'WITHDRAWN': return 'bg-red-100 text-red-800';
    case 'SUBMITTED': return 'bg-indigo-100 text-indigo-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export function ApplicantsList() {
  const { canCreate, canEdit } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [applicantsData, setApplicantsData] = useState<any[]>([]);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: 1, limit: 50 };
      if (searchTerm) params.search = searchTerm;
      const result = await applicantsApi.list(params);
      setApplicantsData(result.data || []);
      setTotalApplicants(result.meta?.total || 0);
    } catch {
      setApplicantsData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(fetchApplicants, 300);
    return () => clearTimeout(timer);
  }, [fetchApplicants]);

  // Use API data or fall back to local hardcoded array if API not available
  const applicants = applicantsData.length > 0 ? applicantsData : [];
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: '1',
      name: 'Pending Applications',
      rules: [
        { id: '1', columnId: 'status', operator: 'equals', value: 'Under Review' }
      ],
      logic: 'AND'
    },
    {
      id: '2',
      name: 'New Truck Drivers',
      rules: [
        { id: '1', columnId: 'status', operator: 'equals', value: 'New Application' },
        { id: '2', columnId: 'jobType', operator: 'equals', value: 'Truck Driver' }
      ],
      logic: 'AND'
    }
  ]);

  // Apply filters
  const applyFilters = (applicant: any) => {
    if (activeFilters.length === 0) return true;

    const results = activeFilters.map(filter => {
      let value: any;
      switch (filter.columnId) {
        case 'name':
          value = `${applicant.firstName} ${applicant.lastName}`.toLowerCase();
          break;
        case 'jobType': {
          const jt = applicant.jobType;
          value = (typeof jt === 'object' && jt !== null ? jt.name : jt) || '';
          break;
        }
        default: {
          const raw = (applicant as any)[filter.columnId];
          value = (typeof raw === 'object' && raw !== null ? raw.name : raw) || '';
        }
      }

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

  const filteredApplicants = applicants.filter((applicant) => {
    const matchesSearch = 
      applicant.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      applicant.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      applicant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      applicant.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilters = applyFilters(applicant);
    
    return matchesSearch && matchesFilters;
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

  const handleExport = () => {
    console.log('Exporting', filteredApplicants.length, 'applicants');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Applicants</h1>
          <p className="text-muted-foreground mt-1">
            Manage job applicants and convert them to employees
          </p>
        </div>
        {canCreate('applicants') && (
          <Button asChild>
            <Link to="/dashboard/applicants/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Applicant
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Applicants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0F172A]">{totalApplicants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {applicants.filter((a) => a.status === 'NEW').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Screening / Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {applicants.filter((a) => a.status === 'SCREENING' || a.status === 'INTERVIEW').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Accepted / Onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {applicants.filter((a) => a.status === 'ACCEPTED' || a.status === 'ONBOARDING').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name, email, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <FilterSystem
              columns={applicantColumns}
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
        </CardContent>
      </Card>

      {/* Applicants Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Applicants ({filteredApplicants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Applicant ID
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Full Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Nationality
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Contact
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Job Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Applied
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredApplicants.map((applicant) => (
                  <tr key={applicant.id} className="border-b hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm">{applicant.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#0F172A]">
                        {applicant.firstName} {applicant.lastName}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{applicant.nationality}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <div>{applicant.email}</div>
                        <div className="text-muted-foreground">{applicant.phone}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">
                        {typeof applicant.jobType === 'object' && applicant.jobType !== null
                          ? applicant.jobType.name
                          : applicant.jobType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">
                        {applicant.createdAt ? new Date(applicant.createdAt).toLocaleDateString() : applicant.applicationDate || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(applicant.status)}>
                        {applicant.status?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/dashboard/applicants/${applicant.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        {canEdit('applicants') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/applicants/${applicant.id}/edit`}>
                              <Edit className="w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                        {canCreate('employees') && applicant.status === 'Accepted' && (
                          <Button variant="ghost" size="sm" className="text-green-600">
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredApplicants.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No applicants found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}