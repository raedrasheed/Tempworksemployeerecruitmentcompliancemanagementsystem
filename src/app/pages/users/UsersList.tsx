import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Edit, Search, Trash2, Upload, Download, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { usersApi, getCurrentUser } from '../../services/api';
import { toast } from 'sonner';
import { FilterSystem, Column, FilterRule, FilterPreset } from '../../components/filters/FilterSystem';
import { usePermissions } from '../../hooks/usePermissions';

const userColumns: Column[] = [
  { id: 'firstName', label: 'First Name', type: 'text' },
  { id: 'lastName', label: 'Last Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'status', label: 'Status', type: 'enum', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] },
];

// Simple CSV parser — splits into rows and columns
function parseCsvText(text: string): any[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const record: any = {};
    headers.forEach((h, i) => { record[h] = values[i] ?? ''; });
    return record;
  });
}

export function UsersList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);

  // Bulk import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  // Activation link modal state
  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [activationLinkUser, setActivationLinkUser] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [loadingLink, setLoadingLink] = useState<string | null>(null);

  useEffect(() => {
    usersApi.list({ limit: 100 })
      .then((res: any) => setUsers(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const applyFilters = (user: any) => {
    if (activeFilters.length === 0) return true;
    const results = activeFilters.map(filter => {
      const value = (user[filter.columnId] ?? '').toString();
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

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.role?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && applyFilters(user);
  });

  const handleDelete = async (user: any) => {
    if (!confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`)) return;
    try {
      await usersApi.delete(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      toast.success('User deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete user');
    }
  };

  const handleSavePreset = (name: string, rules: FilterRule[], logic: 'AND' | 'OR') => {
    setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, rules, logic }]);
  };

  const handleBulkImport = async () => {
    if (!csvText.trim()) {
      toast.error('Please paste CSV data first');
      return;
    }
    const records = parseCsvText(csvText);
    if (records.length === 0) {
      toast.error('No valid records found. Ensure CSV has a header row.');
      return;
    }
    setImporting(true);
    try {
      await usersApi.bulkImport(records);
      toast.success(`${records.length} record(s) imported successfully`);
      setShowImportModal(false);
      setCsvText('');
      // Reload list
      const res: any = await usersApi.list({ limit: 100 });
      setUsers(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
    } catch (err: any) {
      toast.error(err?.message || 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleGetActivationLink = async (user: any) => {
    setLoadingLink(user.id);
    try {
      const res = await usersApi.getActivationLink(user.id);
      setActivationLink(res.url);
      setActivationLinkUser(`${user.firstName} ${user.lastName}`);
      setLinkCopied(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate activation link');
    } finally {
      setLoadingLink(null);
    }
  };

  const handleCopyLink = () => {
    if (!activationLink) return;
    navigator.clipboard.writeText(activationLink).then(() => {
      setLinkCopied(true);
      toast.success('Activation link copied to clipboard');
      setTimeout(() => setLinkCopied(false), 3000);
    });
  };

  const handleExport = async () => {
    try {
      const data = await usersApi.bulkExport();
      if (!Array.isArray(data) || data.length === 0) {
        toast.info('No data to export');
        return;
      }
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {canCreate('users') && (
            <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
          )}
          {canCreate('users') && (
            <Button asChild>
              <Link to="/dashboard/users/add">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <FilterSystem
              columns={userColumns}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              filterLogic={filterLogic}
              onLogicChange={setFilterLogic}
              savedPresets={savedPresets}
              onSavePreset={handleSavePreset}
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
                  <TableHead className="w-24">#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {user.userNumber ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        user.role?.name?.toLowerCase().includes('admin') ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]' :
                        user.role?.name?.toLowerCase().includes('hr') ? 'bg-[#F0FDF4] text-[#22C55E] border-[#22C55E]' :
                        'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                      }>
                        {user.role?.name ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.agency?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={user.status === 'ACTIVE' ? 'bg-[#22C55E]' : 'bg-gray-500'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit('users') && (user.status === 'PENDING' || user.status === 'INACTIVE') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGetActivationLink(user)}
                            disabled={loadingLink === user.id}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-xs"
                            title="Get activation link"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            {loadingLink === user.id ? '...' : 'Activation Link'}
                          </Button>
                        )}
                        {canEdit('users') && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/dashboard/users/${user.id}/edit`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Link>
                          </Button>
                        )}
                        {canDelete('users') && user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user)}
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

      {/* Activation Link Modal */}
      {activationLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#0F172A]">Activation Link</h2>
              <Button variant="ghost" size="sm" onClick={() => setActivationLink(null)}>✕</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with <strong>{activationLinkUser}</strong> so they can set their password and activate their account. The link expires in <strong>60 minutes</strong>.
            </p>
            <div className="bg-gray-50 border rounded-md p-3 break-all text-sm font-mono text-gray-700">
              {activationLink}
            </div>
            <div className="flex gap-3 pt-1">
              <Button className="flex-1" onClick={handleCopyLink}>
                {linkCopied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setActivationLink(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#0F172A]">Bulk Import Users</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowImportModal(false); setCsvText(''); }}>
                ✕
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste CSV data below. The first row must be a header row with field names
              (e.g. <code className="bg-gray-100 px-1 rounded text-xs">firstName,lastName,email,roleId,agencyId</code>).
            </p>
            <div className="space-y-2">
              <Label htmlFor="csvInput">CSV Data</Label>
              <textarea
                id="csvInput"
                rows={10}
                className="w-full border rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder={`firstName,lastName,email,roleId,agencyId\nJohn,Smith,john@example.com,role-id,agency-id`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
            </div>
            {csvText.trim() && (
              <p className="text-xs text-muted-foreground">
                Preview: {parseCsvText(csvText).length} record(s) detected
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={handleBulkImport}
                disabled={importing || !csvText.trim()}
              >
                {importing ? 'Importing...' : 'Import Records'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowImportModal(false); setCsvText(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
