import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  CheckCircle,
  XCircle,
  Briefcase,
  Save,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';

interface JobType {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  requiredDocuments: string[];
  createdAt: string;
  totalEmployees: number;
}

export function JobTypes() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    requiredDocuments: [] as string[],
  });

  // Mock data
  const [jobTypes, setJobTypes] = useState<JobType[]>([
    {
      id: '1',
      name: 'Truck Driver',
      description: 'Professional truck drivers with HGV Class 1 license',
      isActive: true,
      requiredDocuments: ['Passport', 'Driving License', 'Driver Qualification Card', 'Medical Certificate'],
      createdAt: '2024-01-15',
      totalEmployees: 145,
    },
    {
      id: '2',
      name: 'Warehouse Worker',
      description: 'General warehouse and logistics operations',
      isActive: true,
      requiredDocuments: ['Passport', 'Work Permit', 'Employment Contract'],
      createdAt: '2024-01-20',
      totalEmployees: 89,
    },
    {
      id: '3',
      name: 'Forklift Operator',
      description: 'Licensed forklift operators for warehouse operations',
      isActive: true,
      requiredDocuments: ['Passport', 'Forklift License', 'Work Permit', 'Medical Certificate'],
      createdAt: '2024-02-01',
      totalEmployees: 56,
    },
    {
      id: '4',
      name: 'Logistics Coordinator',
      description: 'Coordination and planning of logistics operations',
      isActive: true,
      requiredDocuments: ['Passport', 'Educational Certificate', 'Work Permit', 'Employment Contract'],
      createdAt: '2024-02-10',
      totalEmployees: 34,
    },
    {
      id: '5',
      name: 'Construction Worker',
      description: 'General construction and building site workers',
      isActive: true,
      requiredDocuments: ['Passport', 'Work Permit', 'Safety Training Certificate', 'Medical Certificate'],
      createdAt: '2024-02-15',
      totalEmployees: 78,
    },
    {
      id: '6',
      name: 'Technician',
      description: 'Technical maintenance and repair specialists',
      isActive: true,
      requiredDocuments: ['Passport', 'Educational Certificate', 'Technical Certification', 'Work Permit'],
      createdAt: '2024-03-01',
      totalEmployees: 42,
    },
    {
      id: '7',
      name: 'General Worker',
      description: 'General labor positions across various industries',
      isActive: false,
      requiredDocuments: ['Passport', 'Work Permit', 'Employment Contract'],
      createdAt: '2024-03-05',
      totalEmployees: 15,
    },
  ]);

  const filteredJobTypes = jobTypes.filter(jobType =>
    jobType.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    jobType.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDialog = (jobType?: JobType) => {
    if (jobType) {
      setEditingJobType(jobType);
      setFormData({
        name: jobType.name,
        description: jobType.description,
        isActive: jobType.isActive,
        requiredDocuments: jobType.requiredDocuments,
      });
    } else {
      setEditingJobType(null);
      setFormData({
        name: '',
        description: '',
        isActive: true,
        requiredDocuments: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveJobType = () => {
    if (editingJobType) {
      // Update existing job type
      setJobTypes(prev => prev.map(jt => 
        jt.id === editingJobType.id 
          ? { ...jt, ...formData }
          : jt
      ));
    } else {
      // Create new job type
      const newJobType: JobType = {
        id: (jobTypes.length + 1).toString(),
        ...formData,
        createdAt: new Date().toISOString().split('T')[0],
        totalEmployees: 0,
      };
      setJobTypes(prev => [...prev, newJobType]);
    }
    setIsDialogOpen(false);
  };

  const handleDeleteJobType = (id: string) => {
    if (confirm('Are you sure you want to delete this job type?')) {
      setJobTypes(prev => prev.filter(jt => jt.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    setJobTypes(prev => prev.map(jt =>
      jt.id === id ? { ...jt, isActive: !jt.isActive } : jt
    ));
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Job Types Configuration</h1>
        <p className="text-muted-foreground">
          Manage job types and their document requirements for employee recruitment
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Job Types</p>
                <p className="text-2xl font-bold">{jobTypes.length}</p>
              </div>
              <Briefcase className="w-8 h-8 text-[#2563EB]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Types</p>
                <p className="text-2xl font-bold text-[#22C55E]">
                  {jobTypes.filter(jt => jt.isActive).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-[#22C55E]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Inactive Types</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {jobTypes.filter(jt => !jt.isActive).length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Employees</p>
                <p className="text-2xl font-bold">
                  {jobTypes.reduce((acc, jt) => acc + jt.totalEmployees, 0)}
                </p>
              </div>
              <Briefcase className="w-8 h-8 text-[#F59E0B]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search job types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#2563EB] hover:bg-[#1d4ed8]"
              onClick={() => handleOpenDialog()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Job Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingJobType ? 'Edit Job Type' : 'Create New Job Type'}
              </DialogTitle>
              <DialogDescription>
                Configure job type settings and required documents
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Job Type Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Truck Driver"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the job type"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="isActive">Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow new applications for this job type
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Required Documents</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Documents that employees must provide for this job type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {['Passport', 'Driving License', 'Work Permit', 'Medical Certificate', 
                    'Educational Certificate', 'Driver Qualification Card', 'Forklift License',
                    'Safety Training Certificate', 'Technical Certification', 'Employment Contract',
                    'Police Clearance', 'Visa Documents'].map((doc) => (
                    <label key={doc} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.requiredDocuments.includes(doc)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              requiredDocuments: [...formData.requiredDocuments, doc]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              requiredDocuments: formData.requiredDocuments.filter(d => d !== doc)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{doc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                className="bg-[#2563EB] hover:bg-[#1d4ed8]"
                onClick={handleSaveJobType}
                disabled={!formData.name}
              >
                <Save className="w-4 h-4 mr-2" />
                {editingJobType ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Job Types List */}
      <div className="space-y-4">
        {filteredJobTypes.map((jobType) => (
          <Card key={jobType.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{jobType.name}</h3>
                    <Badge variant={jobType.isActive ? 'default' : 'secondary'} className={jobType.isActive ? 'bg-[#22C55E]' : ''}>
                      {jobType.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">
                      {jobType.totalEmployees} {jobType.totalEmployees === 1 ? 'Employee' : 'Employees'}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {jobType.description}
                  </p>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Required Documents:</p>
                    <div className="flex flex-wrap gap-2">
                      {jobType.requiredDocuments.map((doc, index) => (
                        <Badge key={index} variant="outline" className="bg-[#F8FAFC]">
                          {doc}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    Created: {new Date(jobType.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(jobType.id)}
                  >
                    {jobType.isActive ? (
                      <>
                        <XCircle className="w-4 h-4 mr-1" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(jobType)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteJobType(jobType.id)}
                    disabled={jobType.totalEmployees > 0}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredJobTypes.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No job types found matching your search
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
