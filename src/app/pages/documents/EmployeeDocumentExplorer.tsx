import { useState, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useNavigate } from 'react-router';
import {
  Download, Search, FileArchive, FileDown, ArrowLeft,
  ArrowUp, ArrowDown, ArrowUpDown, Columns2, Check, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { employeesApi, agenciesApi, documentsApi, applicantsApi } from '../../services/api';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';

type SortOrder = 'asc' | 'desc';

// ── Column definitions per table ──
type EmpColKey = 'name' | 'nationality' | 'agency' | 'status' | 'documents';
const EMP_COLUMNS: { key: EmpColKey; label: string }[] = [
  { key: 'name',        label: 'Employee Name' },
  { key: 'nationality', label: 'Citizenship' },
  { key: 'agency',      label: 'Agency' },
  { key: 'status',      label: 'Status' },
  { key: 'documents',   label: 'Documents' },
];
const EMP_DEFAULT: Record<EmpColKey, boolean> = { name: true, nationality: true, agency: true, status: true, documents: true };
const EMP_STORAGE = 'docexplorer-employees-columns';

type AppColKey = 'name' | 'nationality' | 'status' | 'documents';
const APP_COLUMNS: { key: AppColKey; label: string }[] = [
  { key: 'name',        label: 'Applicant Name' },
  { key: 'nationality', label: 'Citizenship' },
  { key: 'status',      label: 'Status' },
  { key: 'documents',   label: 'Documents' },
];
const APP_DEFAULT: Record<AppColKey, boolean> = { name: true, nationality: true, status: true, documents: true };
const APP_STORAGE = 'docexplorer-applicants-columns';

type DocColKey = 'owner' | 'name' | 'type' | 'status' | 'expiry' | 'docId' | 'documentNumber' | 'uploadDate' | 'fileSize';
const DOC_COLUMNS: { key: DocColKey; label: string }[] = [
  { key: 'owner',          label: 'Owner' },
  { key: 'name',           label: 'Document Name' },
  { key: 'type',           label: 'Document Type' },
  { key: 'status',         label: 'Status' },
  { key: 'expiry',         label: 'Expiry Date' },
  { key: 'docId',          label: 'Doc ID' },
  { key: 'documentNumber', label: 'Doc Number' },
  { key: 'uploadDate',     label: 'Upload Date' },
  { key: 'fileSize',       label: 'File Size' },
];
const DOC_DEFAULT: Record<DocColKey, boolean> = {
  owner: true, name: true, type: true, status: true, expiry: true,
  docId: false, documentNumber: false, uploadDate: false, fileSize: false,
};
const EMP_DOCS_STORAGE = 'docexplorer-employee-docs-columns';
const APP_DOCS_STORAGE = 'docexplorer-applicant-docs-columns';

function loadCols<K extends string>(key: string, defaults: Record<K, boolean>): Record<K, boolean> {
  try {
    const saved = localStorage.getItem(key);
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
}

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />;
  return order === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
}

function useClickOutside(ref: RefObject<HTMLElement | null>, enabled: boolean, onOutside: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [enabled, onOutside, ref]);
}

function ColumnPicker<K extends string>({
  columns, visible, setVisible, storageKey, defaults,
}: {
  columns: { key: K; label: string }[];
  visible: Record<K, boolean>;
  setVisible: (v: Record<K, boolean>) => void;
  storageKey: string;
  defaults: Record<K, boolean>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const hiddenCount = columns.filter(c => !visible[c.key]).length;
  const set = (v: Record<K, boolean>) => { setVisible(v); localStorage.setItem(storageKey, JSON.stringify(v)); };
  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline" size="sm"
        onClick={() => setOpen(v => !v)}
        className={open ? 'border-primary text-primary' : ''}
      >
        <Columns2 className="w-4 h-4 mr-1.5" />Columns
        {hiddenCount > 0 && (
          <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {hiddenCount}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border rounded-lg shadow-lg p-3 min-w-[200px]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Toggle columns</p>
          <div className="space-y-0.5 max-h-72 overflow-y-auto">
            {columns.map(c => (
              <button
                key={c.key}
                onClick={() => set({ ...visible, [c.key]: !visible[c.key] })}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 text-sm text-left"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visible[c.key] ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                  {visible[c.key] && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </span>
                {c.label}
              </button>
            ))}
          </div>
          <div className="border-t mt-2 pt-2 flex gap-1.5">
            <button
              onClick={() => set(Object.fromEntries(columns.map(c => [c.key, true])) as Record<K, boolean>)}
              className="flex-1 text-xs text-center text-primary hover:underline py-0.5"
            >Show all</button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => set(defaults)}
              className="flex-1 text-xs text-center text-gray-500 hover:underline py-0.5"
            >Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTh<F extends string>({
  label, field, sortBy, sortOrder, onSort, className,
}: {
  label: string; field: F; sortBy: F; sortOrder: SortOrder; onSort: (f: F) => void; className?: string;
}) {
  return (
    <th className={`text-left p-4 font-semibold text-sm ${className ?? ''}`}>
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground group">
        {label}
        <SortIcon active={sortBy === field} order={sortOrder} />
      </button>
    </th>
  );
}

function sortBy<T>(data: T[], key: keyof T | ((x: T) => any), order: SortOrder): T[] {
  const getter = typeof key === 'function' ? (key as (x: T) => any) : (x: T) => x[key];
  return [...data].sort((a, b) => {
    const av = getter(a); const bv = getter(b);
    const aStr = av == null ? '' : (typeof av === 'string' ? av.toLowerCase() : av);
    const bStr = bv == null ? '' : (typeof bv === 'string' ? bv.toLowerCase() : bv);
    const cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
    return order === 'asc' ? cmp : -cmp;
  });
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
const getFileUrl = (fileUrl: string) => `${API_BASE}${fileUrl}`;

const employeeColumns: Column[] = [
  { id: 'name', label: 'Employee Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'nationality', label: 'Citizenship', type: 'text' },
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'employees' | 'applicants'>('employees');

  // ── Employees state ──
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

  // Extra employee filters
  const [empEmailFilter, setEmpEmailFilter] = useState('');
  const [empMinDocs, setEmpMinDocs] = useState('');

  // ── Applicants state ──
  const [applicants, setApplicants] = useState<any[]>([]);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [applicantDocuments, setApplicantDocuments] = useState<Record<string, any[]>>({});
  const [selectedApplicantDocs, setSelectedApplicantDocs] = useState<string[]>([]);
  const [applicantDocCounts, setApplicantDocCounts] = useState<Record<string, number>>({});
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('all');
  const [appNationalityFilter, setAppNationalityFilter] = useState('all');
  const [appEmailFilter, setAppEmailFilter] = useState('');
  const [appMinDocs, setAppMinDocs] = useState('');

  // ── Sort state per table ──
  type EmpSortField = 'name' | 'nationality' | 'agency' | 'status' | 'documents';
  const [empSortBy, setEmpSortBy] = useState<EmpSortField>('name');
  const [empSortOrder, setEmpSortOrder] = useState<SortOrder>('asc');
  const handleEmpSort = (f: EmpSortField) => {
    if (empSortBy === f) setEmpSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setEmpSortBy(f); setEmpSortOrder('asc'); }
  };

  type AppSortField = 'name' | 'nationality' | 'status' | 'documents';
  const [appSortBy, setAppSortBy] = useState<AppSortField>('name');
  const [appSortOrder, setAppSortOrder] = useState<SortOrder>('asc');
  const handleAppSort = (f: AppSortField) => {
    if (appSortBy === f) setAppSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setAppSortBy(f); setAppSortOrder('asc'); }
  };

  type DocSortField = 'owner' | 'name' | 'type' | 'status' | 'expiry' | 'docId' | 'documentNumber' | 'uploadDate' | 'fileSize';
  const [empDocsSortBy, setEmpDocsSortBy] = useState<DocSortField>('name');
  const [empDocsSortOrder, setEmpDocsSortOrder] = useState<SortOrder>('asc');
  const handleEmpDocsSort = (f: DocSortField) => {
    if (empDocsSortBy === f) setEmpDocsSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setEmpDocsSortBy(f); setEmpDocsSortOrder('asc'); }
  };
  const [appDocsSortBy, setAppDocsSortBy] = useState<DocSortField>('name');
  const [appDocsSortOrder, setAppDocsSortOrder] = useState<SortOrder>('asc');
  const handleAppDocsSort = (f: DocSortField) => {
    if (appDocsSortBy === f) setAppDocsSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setAppDocsSortBy(f); setAppDocsSortOrder('asc'); }
  };

  // ── Extra filters for document tables ──
  const [empDocsStatusFilter, setEmpDocsStatusFilter] = useState('all');
  const [empDocsTypeFilter, setEmpDocsTypeFilter] = useState('');
  const [empDocsSearch, setEmpDocsSearch] = useState('');
  const [empDocsExpFrom, setEmpDocsExpFrom] = useState('');
  const [empDocsExpTo, setEmpDocsExpTo] = useState('');
  const [appDocsStatusFilter, setAppDocsStatusFilter] = useState('all');
  const [appDocsTypeFilter, setAppDocsTypeFilter] = useState('');
  const [appDocsSearch, setAppDocsSearch] = useState('');
  const [appDocsExpFrom, setAppDocsExpFrom] = useState('');
  const [appDocsExpTo, setAppDocsExpTo] = useState('');

  // ── Column visibility state ──
  const [empCols, setEmpCols]         = useState<Record<EmpColKey, boolean>>(() => loadCols(EMP_STORAGE, EMP_DEFAULT));
  const [appCols, setAppCols]         = useState<Record<AppColKey, boolean>>(() => loadCols(APP_STORAGE, APP_DEFAULT));
  const [empDocsCols, setEmpDocsCols] = useState<Record<DocColKey, boolean>>(() => loadCols(EMP_DOCS_STORAGE, DOC_DEFAULT));
  const [appDocsCols, setAppDocsCols] = useState<Record<DocColKey, boolean>>(() => loadCols(APP_DOCS_STORAGE, DOC_DEFAULT));

  useEffect(() => {
    Promise.all([
      employeesApi.list({ limit: 500 }),
      agenciesApi.list({ limit: 200 }),
      applicantsApi.list({ limit: 500 }),
    ]).then(([empResult, agencyResult, appResult]) => {
      const emps: any[] = (empResult as any)?.data ?? [];
      const apps: any[] = (appResult as any)?.data ?? [];
      setEmployees(emps);
      setAgencies((agencyResult as any)?.data ?? []);
      setApplicants(apps);
      // load doc counts for all employees (use total from paginated response)
      Promise.all(
        emps.map(emp =>
          documentsApi.getByEntity('EMPLOYEE', emp.id)
            .then((res: any) => ({ id: emp.id, count: (res as any)?.total ?? (res?.data ?? res ?? []).length }))
            .catch(() => ({ id: emp.id, count: 0 }))
        )
      ).then(counts => {
        const map: Record<string, number> = {};
        counts.forEach(c => { map[c.id] = c.count; });
        setDocCounts(map);
      });
      // load doc counts for all applicants
      Promise.all(
        apps.map(app =>
          documentsApi.getByEntity('APPLICANT', app.id)
            .then((res: any) => ({ id: app.id, count: (res as any)?.total ?? (res?.data ?? res ?? []).length }))
            .catch(() => ({ id: app.id, count: 0 }))
        )
      ).then(counts => {
        const map: Record<string, number> = {};
        counts.forEach(c => { map[c.id] = c.count; });
        setApplicantDocCounts(map);
      });
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  // Load documents when applicant selection changes
  useEffect(() => {
    const toLoad = selectedApplicants.filter(id => !applicantDocuments[id]);
    if (toLoad.length === 0) return;
    Promise.all(
      toLoad.map(id =>
        documentsApi.getByEntity('APPLICANT', id)
          .then((res: any) => ({ id, docs: res?.data ?? res ?? [] }))
          .catch(() => ({ id, docs: [] }))
      )
    ).then(results => {
      setApplicantDocuments(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.id] = r.docs; });
        return next;
      });
    });
  }, [selectedApplicants]);

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

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNationality = nationalityFilter === 'all' || emp.nationality === nationalityFilter;
      const matchesAgency = agencyFilter === 'all' || emp.agencyId === agencyFilter;
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      const matchesEmail = !empEmailFilter || (emp.email ?? '').toLowerCase().includes(empEmailFilter.toLowerCase());
      const matchesMinDocs = !empMinDocs || (docCounts[emp.id] ?? 0) >= Number(empMinDocs);
      return matchesSearch && matchesNationality && matchesAgency && matchesStatus
        && matchesEmail && matchesMinDocs && applyFilters(emp);
    });
    return sortBy(filtered, (e: any) => {
      switch (empSortBy) {
        case 'name':        return `${e.firstName ?? ''} ${e.lastName ?? ''}`.toLowerCase();
        case 'nationality': return (e.nationality ?? '').toLowerCase();
        case 'agency':      return (e.agency?.name ?? e.agencyName ?? '').toLowerCase();
        case 'status':      return e.status ?? '';
        case 'documents':   return docCounts[e.id] ?? 0;
        default: return '';
      }
    }, empSortOrder);
  }, [employees, searchQuery, nationalityFilter, agencyFilter, statusFilter,
      empEmailFilter, empMinDocs, activeFilters, filterLogic,
      empSortBy, empSortOrder, docCounts]);

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

  const allSelectedDocs = useMemo(
    () => selectedEmployees.flatMap(id => employeeDocuments[id] ?? []),
    [selectedEmployees, employeeDocuments]
  );

  const filterAndSortDocs = (
    docs: any[],
    entities: any[],
    search: string, status: string, type: string, expFrom: string, expTo: string,
    sortField: DocSortField, order: SortOrder,
  ) => {
    let result = docs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        (d.name ?? '').toLowerCase().includes(q)
        || (d.documentNumber ?? '').toLowerCase().includes(q)
        || (d.docId ?? '').toLowerCase().includes(q)
      );
    }
    if (status !== 'all') result = result.filter(d => d.status === status);
    if (type) {
      const q = type.toLowerCase();
      result = result.filter(d => (d.documentType?.name ?? '').toLowerCase().includes(q));
    }
    if (expFrom || expTo) {
      const from = expFrom ? new Date(expFrom).getTime() : -Infinity;
      const to   = expTo   ? new Date(expTo + 'T23:59:59').getTime() : Infinity;
      result = result.filter(d => {
        if (!d.expiryDate) return false;
        const t = new Date(d.expiryDate).getTime();
        return t >= from && t <= to;
      });
    }
    return sortBy(result, (d: any) => {
      switch (sortField) {
        case 'owner': {
          const e = entities.find(x => x.id === d.entityId);
          return e ? `${e.firstName ?? ''} ${e.lastName ?? ''}`.toLowerCase() : '';
        }
        case 'name':           return (d.name ?? '').toLowerCase();
        case 'type':           return (d.documentType?.name ?? '').toLowerCase();
        case 'status':         return d.status ?? '';
        case 'expiry':         return d.expiryDate ? new Date(d.expiryDate).getTime() : 0;
        case 'docId':          return (d.docId ?? '').toLowerCase();
        case 'documentNumber': return (d.documentNumber ?? '').toLowerCase();
        case 'uploadDate':     return d.createdAt ? new Date(d.createdAt).getTime() : 0;
        case 'fileSize':       return Number(d.fileSize ?? 0);
        default: return '';
      }
    }, order);
  };

  const displayEmpDocs = useMemo(
    () => filterAndSortDocs(
      allSelectedDocs, employees,
      empDocsSearch, empDocsStatusFilter, empDocsTypeFilter, empDocsExpFrom, empDocsExpTo,
      empDocsSortBy, empDocsSortOrder,
    ),
    [allSelectedDocs, employees, empDocsSearch, empDocsStatusFilter, empDocsTypeFilter,
     empDocsExpFrom, empDocsExpTo, empDocsSortBy, empDocsSortOrder]
  );

  const toggleAllDocuments = () => {
    if (selectedDocuments.length === displayEmpDocs.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(displayEmpDocs.map(d => d.id));
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

  // ── Applicant helpers ──
  const applicantNationalities = useMemo(
    () => Array.from(new Set(applicants.map(a => a.nationality).filter(Boolean))),
    [applicants]
  );

  const filteredApplicants = useMemo(() => {
    const filtered = applicants.filter(app => {
      const fullName = `${app.firstName} ${app.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(appSearchQuery.toLowerCase()) ||
        app.email?.toLowerCase().includes(appSearchQuery.toLowerCase());
      const matchesStatus = appStatusFilter === 'all' || app.status === appStatusFilter;
      const matchesNationality = appNationalityFilter === 'all' || app.nationality === appNationalityFilter;
      const matchesEmail = !appEmailFilter || (app.email ?? '').toLowerCase().includes(appEmailFilter.toLowerCase());
      const matchesMinDocs = !appMinDocs || (applicantDocCounts[app.id] ?? 0) >= Number(appMinDocs);
      return matchesSearch && matchesStatus && matchesNationality && matchesEmail && matchesMinDocs;
    });
    return sortBy(filtered, (a: any) => {
      switch (appSortBy) {
        case 'name':        return `${a.firstName ?? ''} ${a.lastName ?? ''}`.toLowerCase();
        case 'nationality': return (a.nationality ?? '').toLowerCase();
        case 'status':      return a.status ?? '';
        case 'documents':   return applicantDocCounts[a.id] ?? 0;
        default: return '';
      }
    }, appSortOrder);
  }, [applicants, appSearchQuery, appStatusFilter, appNationalityFilter,
      appEmailFilter, appMinDocs, appSortBy, appSortOrder, applicantDocCounts]);

  const toggleApplicant = (appId: string) => {
    setSelectedApplicants(prev =>
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
    setSelectedApplicantDocs([]);
  };

  const toggleAllApplicants = () => {
    if (selectedApplicants.length === filteredApplicants.length) {
      setSelectedApplicants([]);
    } else {
      setSelectedApplicants(filteredApplicants.map(a => a.id));
    }
    setSelectedApplicantDocs([]);
  };

  const allSelectedAppDocs = useMemo(
    () => selectedApplicants.flatMap(id => applicantDocuments[id] ?? []),
    [selectedApplicants, applicantDocuments]
  );

  const displayAppDocs = useMemo(
    () => filterAndSortDocs(
      allSelectedAppDocs, applicants,
      appDocsSearch, appDocsStatusFilter, appDocsTypeFilter, appDocsExpFrom, appDocsExpTo,
      appDocsSortBy, appDocsSortOrder,
    ),
    [allSelectedAppDocs, applicants, appDocsSearch, appDocsStatusFilter, appDocsTypeFilter,
     appDocsExpFrom, appDocsExpTo, appDocsSortBy, appDocsSortOrder]
  );

  const toggleApplicantDoc = (docId: string) => {
    setSelectedApplicantDocs(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const toggleAllApplicantDocs = () => {
    if (selectedApplicantDocs.length === displayAppDocs.length) {
      setSelectedApplicantDocs([]);
    } else {
      setSelectedApplicantDocs(displayAppDocs.map(d => d.id));
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Document Explorer</h1>
        </div>
        <p className="text-muted-foreground mt-1">Search employees and applicants to view and download their documents</p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'employees' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
        >
          Employees
        </button>
        <button
          onClick={() => setActiveTab('applicants')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'applicants' ? 'border-[#7C3AED] text-[#7C3AED]' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
        >
          Applicants
        </button>
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === 'employees' && <>
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
                <SelectTrigger><SelectValue placeholder="Citizenship" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Citizenships</SelectItem>
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
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                placeholder="Email contains…"
                value={empEmailFilter}
                onChange={e => setEmpEmailFilter(e.target.value)}
                className="w-56"
              />
              <Input
                type="number"
                min={0}
                placeholder="Min docs"
                value={empMinDocs}
                onChange={e => setEmpMinDocs(e.target.value)}
                className="w-32"
              />
              {(empEmailFilter || empMinDocs) && (
                <Button variant="ghost" size="sm" onClick={() => { setEmpEmailFilter(''); setEmpMinDocs(''); }}>
                  <X className="w-3 h-3 mr-1" />Clear extras
                </Button>
              )}
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
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedEmployees.length} selected</Badge>
              <ColumnPicker
                columns={EMP_COLUMNS}
                visible={empCols}
                setVisible={setEmpCols}
                storageKey={EMP_STORAGE}
                defaults={EMP_DEFAULT}
              />
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
                      checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onCheckedChange={toggleAllEmployees}
                    />
                  </th>
                  {empCols.name        && <SortableTh label="Employee Name" field="name"        sortBy={empSortBy} sortOrder={empSortOrder} onSort={handleEmpSort} />}
                  {empCols.nationality && <SortableTh label="Citizenship"   field="nationality" sortBy={empSortBy} sortOrder={empSortOrder} onSort={handleEmpSort} />}
                  {empCols.agency      && <SortableTh label="Agency"        field="agency"      sortBy={empSortBy} sortOrder={empSortOrder} onSort={handleEmpSort} />}
                  {empCols.status      && <SortableTh label="Status"        field="status"      sortBy={empSortBy} sortOrder={empSortOrder} onSort={handleEmpSort} />}
                  {empCols.documents   && <SortableTh label="Documents"     field="documents"   sortBy={empSortBy} sortOrder={empSortOrder} onSort={handleEmpSort} />}
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
                      {empCols.name && (
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {emp.photoUrl ? (
                              <img
                                src={emp.photoUrl.startsWith('http') ? emp.photoUrl : `${API_BASE}${emp.photoUrl}`}
                                alt={emp.firstName}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-semibold flex-shrink-0">
                                {emp.firstName?.[0]}{emp.lastName?.[0]}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                              <p className="text-sm text-muted-foreground">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      {empCols.nationality && <td className="p-4">{emp.nationality ?? '-'}</td>}
                      {empCols.agency      && <td className="p-4">{emp.agency?.name ?? '-'}</td>}
                      {empCols.status && (
                        <td className="p-4">
                          <Badge className={
                            emp.status === 'ACTIVE' ? 'bg-[#22C55E]' :
                            emp.status === 'PENDING' ? 'bg-[#F59E0B]' : 'bg-gray-500'
                          }>
                            {emp.status?.toLowerCase()}
                          </Badge>
                        </td>
                      )}
                      {empCols.documents && (
                        <td className="p-4">
                          <Badge variant="outline">{docCounts[emp.id] ?? 0} docs</Badge>
                        </td>
                      )}
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
          <CardContent className="space-y-4">
            {/* Document filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents by name, number, ID…"
                  value={empDocsSearch}
                  onChange={e => setEmpDocsSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={empDocsStatusFilter} onValueChange={setEmpDocsStatusFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="VERIFIED">Valid</SelectItem>
                  <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Type contains…"
                value={empDocsTypeFilter}
                onChange={e => setEmpDocsTypeFilter(e.target.value)}
                className="w-44"
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Expiry from</span>
                <Input type="date" value={empDocsExpFrom} onChange={e => setEmpDocsExpFrom(e.target.value)} className="w-36" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={empDocsExpTo} onChange={e => setEmpDocsExpTo(e.target.value)} className="w-36" />
              </div>
              {(empDocsSearch || empDocsStatusFilter !== 'all' || empDocsTypeFilter || empDocsExpFrom || empDocsExpTo) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setEmpDocsSearch(''); setEmpDocsStatusFilter('all'); setEmpDocsTypeFilter('');
                  setEmpDocsExpFrom(''); setEmpDocsExpTo('');
                }}>
                  <X className="w-3 h-3 mr-1" />Clear
                </Button>
              )}
              <div className="ml-auto">
                <ColumnPicker
                  columns={DOC_COLUMNS}
                  visible={empDocsCols}
                  setVisible={setEmpDocsCols}
                  storageKey={EMP_DOCS_STORAGE}
                  defaults={DOC_DEFAULT}
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8FAFC] border-b">
                  <tr>
                    <th className="text-left p-4 w-12">
                      <Checkbox
                        checked={selectedDocuments.length === displayEmpDocs.length && displayEmpDocs.length > 0}
                        onCheckedChange={toggleAllDocuments}
                      />
                    </th>
                    {empDocsCols.owner && selectedEmployees.length > 1 && (
                      <SortableTh label="Employee" field="owner" sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />
                    )}
                    {empDocsCols.name           && <SortableTh label="Document Name" field="name"           sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    {empDocsCols.type           && <SortableTh label="Document Type" field="type"           sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    {empDocsCols.status         && <SortableTh label="Status"        field="status"         sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    {empDocsCols.expiry         && <SortableTh label="Expiry Date"   field="expiry"         sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    {empDocsCols.docId          && <SortableTh label="Doc ID"        field="docId"          sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    {empDocsCols.documentNumber && <SortableTh label="Doc Number"    field="documentNumber" sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    {empDocsCols.uploadDate     && <SortableTh label="Upload Date"   field="uploadDate"     sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    {empDocsCols.fileSize       && <SortableTh label="File Size"     field="fileSize"       sortBy={empDocsSortBy} sortOrder={empDocsSortOrder} onSort={handleEmpDocsSort} />}
                    <th className="text-left p-4 font-semibold text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayEmpDocs.length === 0 ? (
                    <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">No documents found for selected employees</td></tr>
                  ) : displayEmpDocs.map(doc => {
                    const isSelected = selectedDocuments.includes(doc.id);
                    const emp = employees.find(e => e.id === doc.entityId);
                    return (
                      <tr key={doc.id} className={`border-b hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : ''}`}>
                        <td className="p-4">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleDocument(doc.id)} />
                        </td>
                        {empDocsCols.owner && selectedEmployees.length > 1 && (
                          <td className="p-4">
                            <p className="font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : doc.entityId}</p>
                          </td>
                        )}
                        {empDocsCols.name && (
                          <td className="p-4">
                            <p className="font-medium">{doc.name}</p>
                          </td>
                        )}
                        {empDocsCols.type           && <td className="p-4">{doc.documentType?.name ?? '-'}</td>}
                        {empDocsCols.status         && <td className="p-4">{getStatusBadge(doc.status)}</td>}
                        {empDocsCols.expiry         && <td className="p-4">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '-'}</td>}
                        {empDocsCols.docId          && <td className="p-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{doc.docId ?? '—'}</code></td>}
                        {empDocsCols.documentNumber && <td className="p-4 text-sm font-mono">{doc.documentNumber ?? '-'}</td>}
                        {empDocsCols.uploadDate     && <td className="p-4 text-sm">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '-'}</td>}
                        {empDocsCols.fileSize       && <td className="p-4 text-sm text-muted-foreground">{doc.fileSize != null ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '-'}</td>}
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
      </>}

      {/* ── APPLICANTS TAB ── */}
      {activeTab === 'applicants' && <>
        {/* Applicant search */}
        <Card>
          <CardHeader><CardTitle>Search & Filter Applicants</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={appSearchQuery}
                  onChange={e => setAppSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={appStatusFilter} onValueChange={setAppStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="HIRED">Hired</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={appNationalityFilter} onValueChange={setAppNationalityFilter}>
                <SelectTrigger><SelectValue placeholder="Citizenship" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Citizenships</SelectItem>
                  {applicantNationalities.map(nat => (
                    <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                placeholder="Email contains…"
                value={appEmailFilter}
                onChange={e => setAppEmailFilter(e.target.value)}
                className="w-56"
              />
              <Input
                type="number"
                min={0}
                placeholder="Min docs"
                value={appMinDocs}
                onChange={e => setAppMinDocs(e.target.value)}
                className="w-32"
              />
              {(appEmailFilter || appMinDocs || appNationalityFilter !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setAppEmailFilter(''); setAppMinDocs(''); setAppNationalityFilter('all');
                }}>
                  <X className="w-3 h-3 mr-1" />Clear extras
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Applicants table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Applicants ({filteredApplicants.length})</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedApplicants.length} selected</Badge>
                <ColumnPicker
                  columns={APP_COLUMNS}
                  visible={appCols}
                  setVisible={setAppCols}
                  storageKey={APP_STORAGE}
                  defaults={APP_DEFAULT}
                />
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
                        checked={selectedApplicants.length === filteredApplicants.length && filteredApplicants.length > 0}
                        onCheckedChange={toggleAllApplicants}
                      />
                    </th>
                    {appCols.name        && <SortableTh label="Applicant Name" field="name"        sortBy={appSortBy} sortOrder={appSortOrder} onSort={handleAppSort} />}
                    {appCols.nationality && <SortableTh label="Citizenship"    field="nationality" sortBy={appSortBy} sortOrder={appSortOrder} onSort={handleAppSort} />}
                    {appCols.status      && <SortableTh label="Status"         field="status"      sortBy={appSortBy} sortOrder={appSortOrder} onSort={handleAppSort} />}
                    {appCols.documents   && <SortableTh label="Documents"      field="documents"   sortBy={appSortBy} sortOrder={appSortOrder} onSort={handleAppSort} />}
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No applicants found</td></tr>
                  ) : filteredApplicants.map(app => {
                    const isSelected = selectedApplicants.includes(app.id);
                    return (
                      <tr key={app.id} className={`border-b hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#F5F3FF]' : ''}`}>
                        <td className="p-4">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleApplicant(app.id)} />
                        </td>
                        {appCols.name && (
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {app.photoUrl ? (
                                <img
                                  src={app.photoUrl.startsWith('http') ? app.photoUrl : `${API_BASE}${app.photoUrl}`}
                                  alt={app.firstName}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED] text-sm font-semibold flex-shrink-0">
                                  {app.firstName?.[0]}{app.lastName?.[0]}
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{app.firstName} {app.lastName}</p>
                                <p className="text-sm text-muted-foreground">{app.email}</p>
                              </div>
                            </div>
                          </td>
                        )}
                        {appCols.nationality && <td className="p-4">{app.nationality ?? '-'}</td>}
                        {appCols.status && (
                          <td className="p-4">
                            <Badge className={
                              app.status === 'HIRED' ? 'bg-[#22C55E]' :
                              app.status === 'PENDING' ? 'bg-[#F59E0B]' :
                              app.status === 'REJECTED' ? 'bg-[#EF4444]' : 'bg-gray-500'
                            }>
                              {app.status?.toLowerCase()}
                            </Badge>
                          </td>
                        )}
                        {appCols.documents && (
                          <td className="p-4">
                            <Badge variant="outline">{applicantDocCounts[app.id] ?? 0} docs</Badge>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Applicant documents */}
        {selectedApplicants.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {selectedApplicants.length === 1 ? 'Applicant Documents' : `Documents from ${selectedApplicants.length} Applicants`}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{allSelectedAppDocs.length} total documents</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedApplicantDocs.length} selected</Badge>
                  <Button
                    variant="outline"
                    disabled={selectedApplicantDocs.length === 0 || downloading}
                    onClick={async () => {
                      setDownloading(true);
                      try {
                        const blob = await documentsApi.bulkDownload(selectedApplicantDocs);
                        triggerZipDownload(blob, `selected_applicant_documents_${Date.now()}.zip`);
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
                    disabled={allSelectedAppDocs.length === 0 || downloading}
                    onClick={async () => {
                      setDownloading(true);
                      try {
                        const ids = allSelectedAppDocs.map(d => d.id);
                        const blob = await documentsApi.bulkDownload(ids);
                        triggerZipDownload(blob, `all_applicant_documents_${Date.now()}.zip`);
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
            <CardContent className="space-y-4">
              {/* Document filters */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents by name, number, ID…"
                    value={appDocsSearch}
                    onChange={e => setAppDocsSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={appDocsStatusFilter} onValueChange={setAppDocsStatusFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="VERIFIED">Valid</SelectItem>
                    <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Type contains…"
                  value={appDocsTypeFilter}
                  onChange={e => setAppDocsTypeFilter(e.target.value)}
                  className="w-44"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Expiry from</span>
                  <Input type="date" value={appDocsExpFrom} onChange={e => setAppDocsExpFrom(e.target.value)} className="w-36" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" value={appDocsExpTo} onChange={e => setAppDocsExpTo(e.target.value)} className="w-36" />
                </div>
                {(appDocsSearch || appDocsStatusFilter !== 'all' || appDocsTypeFilter || appDocsExpFrom || appDocsExpTo) && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setAppDocsSearch(''); setAppDocsStatusFilter('all'); setAppDocsTypeFilter('');
                    setAppDocsExpFrom(''); setAppDocsExpTo('');
                  }}>
                    <X className="w-3 h-3 mr-1" />Clear
                  </Button>
                )}
                <div className="ml-auto">
                  <ColumnPicker
                    columns={DOC_COLUMNS}
                    visible={appDocsCols}
                    setVisible={setAppDocsCols}
                    storageKey={APP_DOCS_STORAGE}
                    defaults={DOC_DEFAULT}
                  />
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F8FAFC] border-b">
                    <tr>
                      <th className="text-left p-4 w-12">
                        <Checkbox
                          checked={selectedApplicantDocs.length === displayAppDocs.length && displayAppDocs.length > 0}
                          onCheckedChange={toggleAllApplicantDocs}
                        />
                      </th>
                      {appDocsCols.owner && selectedApplicants.length > 1 && (
                        <SortableTh label="Applicant" field="owner" sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />
                      )}
                      {appDocsCols.name           && <SortableTh label="Document Name" field="name"           sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      {appDocsCols.type           && <SortableTh label="Document Type" field="type"           sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      {appDocsCols.status         && <SortableTh label="Status"        field="status"         sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      {appDocsCols.expiry         && <SortableTh label="Expiry Date"   field="expiry"         sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      {appDocsCols.docId          && <SortableTh label="Doc ID"        field="docId"          sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      {appDocsCols.documentNumber && <SortableTh label="Doc Number"    field="documentNumber" sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      {appDocsCols.uploadDate     && <SortableTh label="Upload Date"   field="uploadDate"     sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      {appDocsCols.fileSize       && <SortableTh label="File Size"     field="fileSize"       sortBy={appDocsSortBy} sortOrder={appDocsSortOrder} onSort={handleAppDocsSort} />}
                      <th className="text-left p-4 font-semibold text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayAppDocs.length === 0 ? (
                      <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">No documents found for selected applicants</td></tr>
                    ) : displayAppDocs.map(doc => {
                      const isSelected = selectedApplicantDocs.includes(doc.id);
                      const app = applicants.find(a => a.id === doc.entityId);
                      return (
                        <tr key={doc.id} className={`border-b hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#F5F3FF]' : ''}`}>
                          <td className="p-4">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleApplicantDoc(doc.id)} />
                          </td>
                          {appDocsCols.owner && selectedApplicants.length > 1 && (
                            <td className="p-4">
                              <p className="font-medium">{app ? `${app.firstName} ${app.lastName}` : doc.entityId}</p>
                            </td>
                          )}
                          {appDocsCols.name && (
                            <td className="p-4">
                              <p className="font-medium">{doc.name}</p>
                            </td>
                          )}
                          {appDocsCols.type           && <td className="p-4">{doc.documentType?.name ?? '-'}</td>}
                          {appDocsCols.status         && <td className="p-4">{getStatusBadge(doc.status)}</td>}
                          {appDocsCols.expiry         && <td className="p-4">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '-'}</td>}
                          {appDocsCols.docId          && <td className="p-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{doc.docId ?? '—'}</code></td>}
                          {appDocsCols.documentNumber && <td className="p-4 text-sm font-mono">{doc.documentNumber ?? '-'}</td>}
                          {appDocsCols.uploadDate     && <td className="p-4 text-sm">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '-'}</td>}
                          {appDocsCols.fileSize       && <td className="p-4 text-sm text-muted-foreground">{doc.fileSize != null ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '-'}</td>}
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

        {selectedApplicants.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F8FAFC] flex items-center justify-center mx-auto mb-4">
                <FileArchive className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Applicants Selected</h3>
              <p className="text-muted-foreground">
                Select one or more applicants from the table above to view and download their documents
              </p>
            </CardContent>
          </Card>
        )}
      </>}
    </div>
  );
}
