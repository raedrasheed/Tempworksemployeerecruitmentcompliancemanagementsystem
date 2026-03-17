import { useState } from 'react';
import { Search, Download, Trash2, Filter, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';

interface SystemLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  organization: string;
  actionType: string;
  module: string;
  targetRecord: string;
  description: string;
  ipAddress: string;
}

const mockLogs: SystemLog[] = [
  {
    id: 'LOG001',
    timestamp: '2024-03-13 10:45:22',
    userName: 'Sarah Johnson',
    userRole: 'HR Manager',
    organization: 'Company Staff',
    actionType: 'Create',
    module: 'Drivers',
    targetRecord: 'DRV-2451',
    description: 'Created new driver profile for Jan Kowalski',
    ipAddress: '192.168.1.45',
  },
  {
    id: 'LOG002',
    timestamp: '2024-03-13 10:32:15',
    userName: 'Maria Schmidt',
    userRole: 'Agency Manager',
    organization: 'EuroRecruit GmbH',
    actionType: 'Upload',
    module: 'Documents',
    targetRecord: 'DOC-8934',
    description: 'Uploaded passport document for driver DRV-2450',
    ipAddress: '185.42.73.21',
  },
  {
    id: 'LOG003',
    timestamp: '2024-03-13 10:18:43',
    userName: 'Michael Chen',
    userRole: 'System Admin',
    organization: 'Company Staff',
    actionType: 'Update',
    module: 'Roles',
    targetRecord: 'ROLE-003',
    description: 'Modified permissions for Compliance Officer role',
    ipAddress: '192.168.1.12',
  },
  {
    id: 'LOG004',
    timestamp: '2024-03-13 09:56:08',
    userName: 'Anna Mueller',
    userRole: 'Agency User',
    organization: 'EuroRecruit GmbH',
    actionType: 'Download',
    module: 'Documents',
    targetRecord: 'DOC-8921',
    description: 'Downloaded medical certificate for driver DRV-2448',
    ipAddress: '185.42.73.22',
  },
  {
    id: 'LOG005',
    timestamp: '2024-03-13 09:42:31',
    userName: 'Sarah Johnson',
    userRole: 'HR Manager',
    organization: 'Company Staff',
    actionType: 'Stage Change',
    module: 'Workflow',
    targetRecord: 'APP-5421',
    description: 'Moved application to Document Verification stage',
    ipAddress: '192.168.1.45',
  },
  {
    id: 'LOG006',
    timestamp: '2024-03-13 09:25:17',
    userName: 'Thomas Weber',
    userRole: 'Agency User',
    organization: 'EuroRecruit GmbH',
    actionType: 'Create',
    module: 'Applications',
    targetRecord: 'APP-5420',
    description: 'Submitted new driver application',
    ipAddress: '185.42.73.23',
  },
  {
    id: 'LOG007',
    timestamp: '2024-03-13 09:10:54',
    userName: 'Michael Chen',
    userRole: 'System Admin',
    organization: 'Company Staff',
    actionType: 'Delete',
    module: 'Users',
    targetRecord: 'USR-0089',
    description: 'Deleted inactive user account',
    ipAddress: '192.168.1.12',
  },
  {
    id: 'LOG008',
    timestamp: '2024-03-13 08:58:42',
    userName: 'Sarah Johnson',
    userRole: 'HR Manager',
    organization: 'Company Staff',
    actionType: 'Approve',
    module: 'Applications',
    targetRecord: 'APP-5419',
    description: 'Approved driver application',
    ipAddress: '192.168.1.45',
  },
  {
    id: 'LOG009',
    timestamp: '2024-03-13 08:45:29',
    userName: 'Maria Schmidt',
    userRole: 'Agency Manager',
    organization: 'EuroRecruit GmbH',
    actionType: 'Create',
    module: 'Agency Users',
    targetRecord: 'USR-0098',
    description: 'Created new agency user account',
    ipAddress: '185.42.73.21',
  },
  {
    id: 'LOG010',
    timestamp: '2024-03-13 08:32:11',
    userName: 'Michael Chen',
    userRole: 'System Admin',
    organization: 'Company Staff',
    actionType: 'Login',
    module: 'Authentication',
    targetRecord: 'USR-0001',
    description: 'User logged into the system',
    ipAddress: '192.168.1.12',
  },
];

export function LogsDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const filteredLogs = mockLogs.filter(log => {
    const matchesSearch = log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.targetRecord.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    const matchesAction = actionFilter === 'all' || log.actionType === actionFilter;
    
    return matchesSearch && matchesModule && matchesAction;
  });

  const handleExportLogs = () => {
    alert('Exporting logs to CSV file...');
  };

  const handleDeleteAllLogs = () => {
    alert('All system logs have been deleted.');
    setIsDeleteDialogOpen(false);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'Create':
        return <Badge className="bg-[#22C55E]">{action}</Badge>;
      case 'Update':
        return <Badge className="bg-[#2563EB]">{action}</Badge>;
      case 'Delete':
        return <Badge className="bg-[#EF4444]">{action}</Badge>;
      case 'Download':
        return <Badge className="bg-[#8B5CF6]">{action}</Badge>;
      case 'Upload':
        return <Badge className="bg-[#06B6D4]">{action}</Badge>;
      case 'Approve':
        return <Badge className="bg-[#22C55E]">{action}</Badge>;
      case 'Stage Change':
        return <Badge className="bg-[#F59E0B]">{action}</Badge>;
      case 'Login':
        return <Badge variant="outline">{action}</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">System Logs</h1>
          <p className="text-muted-foreground mt-1">Audit trail and activity monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-[#EF4444] border-[#EF4444]">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Logs
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete All System Logs</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently remove all audit trail records.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-[#FEE2E2] border border-[#EF4444]">
                  <AlertTriangle className="w-5 h-5 text-[#EF4444] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#EF4444]">Warning: This action cannot be undone</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Are you sure you want to delete all system logs? This will permanently remove all audit trail records.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleDeleteAllLogs}
                    className="bg-[#EF4444] hover:bg-[#DC2626]"
                  >
                    Delete All Logs
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{mockLogs.length}</p>
                <p className="text-sm text-muted-foreground">Total Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {mockLogs.filter(l => l.timestamp.startsWith('2024-03-13')).length}
                </p>
                <p className="text-sm text-muted-foreground">Today's Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {new Set(mockLogs.map(l => l.userName)).size}
                </p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F8FAFC] flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#64748B]" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {new Set(mockLogs.map(l => l.module)).size}
                </p>
                <p className="text-sm text-muted-foreground">Modules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="Drivers">Drivers</SelectItem>
                <SelectItem value="Documents">Documents</SelectItem>
                <SelectItem value="Applications">Applications</SelectItem>
                <SelectItem value="Workflow">Workflow</SelectItem>
                <SelectItem value="Users">Users</SelectItem>
                <SelectItem value="Roles">Roles</SelectItem>
                <SelectItem value="Agency Users">Agency Users</SelectItem>
                <SelectItem value="Authentication">Authentication</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="Create">Create</SelectItem>
                <SelectItem value="Update">Update</SelectItem>
                <SelectItem value="Delete">Delete</SelectItem>
                <SelectItem value="Upload">Upload</SelectItem>
                <SelectItem value="Download">Download</SelectItem>
                <SelectItem value="Approve">Approve</SelectItem>
                <SelectItem value="Stage Change">Stage Change</SelectItem>
                <SelectItem value="Login">Login</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Logs ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-[#F8FAFC] border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-sm">Timestamp</th>
                  <th className="text-left p-4 font-semibold text-sm">User</th>
                  <th className="text-left p-4 font-semibold text-sm">Role</th>
                  <th className="text-left p-4 font-semibold text-sm">Organization</th>
                  <th className="text-left p-4 font-semibold text-sm">Module</th>
                  <th className="text-left p-4 font-semibold text-sm">Action</th>
                  <th className="text-left p-4 font-semibold text-sm">Target</th>
                  <th className="text-left p-4 font-semibold text-sm">Description</th>
                  <th className="text-left p-4 font-semibold text-sm">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-4 text-sm">{log.timestamp}</td>
                    <td className="p-4">
                      <p className="font-medium">{log.userName}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{log.userRole}</Badge>
                    </td>
                    <td className="p-4 text-sm">{log.organization}</td>
                    <td className="p-4">
                      <Badge variant="outline">{log.module}</Badge>
                    </td>
                    <td className="p-4">{getActionBadge(log.actionType)}</td>
                    <td className="p-4">
                      <code className="text-sm bg-[#F8FAFC] px-2 py-1 rounded">{log.targetRecord}</code>
                    </td>
                    <td className="p-4 text-sm">{log.description}</td>
                    <td className="p-4 text-sm text-muted-foreground">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}