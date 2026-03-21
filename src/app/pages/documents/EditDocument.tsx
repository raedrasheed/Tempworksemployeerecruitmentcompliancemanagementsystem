import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { documentsApi } from '../../services/api';

export function EditDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    expiryDate: '',
    issueDate: '',
    documentNumber: '',
    issuer: '',
    notes: '',
  });

  useEffect(() => {
    documentsApi.get(id!).then((doc: any) => {
      setForm({
        name: doc.name ?? '',
        expiryDate: doc.expiryDate ? doc.expiryDate.slice(0, 10) : '',
        issueDate: doc.issueDate ? doc.issueDate.slice(0, 10) : '',
        documentNumber: doc.documentNumber ?? '',
        issuer: doc.issuer ?? '',
        notes: doc.notes ?? '',
      });
    }).catch(() => toast.error('Failed to load document'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name,
        documentNumber: form.documentNumber || undefined,
        issuer: form.issuer || undefined,
        notes: form.notes || undefined,
        expiryDate: form.expiryDate || undefined,
        issueDate: form.issueDate || undefined,
      };
      await documentsApi.update(id!, payload);
      toast.success('Document updated successfully');
      navigate(`/dashboard/documents/${id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update document');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/documents/${id}`}><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Edit Document</h1>
          <p className="text-muted-foreground mt-1">Update document metadata</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader><CardTitle>Document Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-2">
                <Label htmlFor="name">Document Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={form.issueDate}
                    onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={form.expiryDate}
                    onChange={e => setForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="documentNumber">Document Number</Label>
                  <Input
                    id="documentNumber"
                    placeholder="e.g. AB123456"
                    value={form.documentNumber}
                    onChange={e => setForm(prev => ({ ...prev, documentNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuer">Issuer</Label>
                  <Input
                    id="issuer"
                    placeholder="e.g. DVLA"
                    value={form.issuer}
                    onChange={e => setForm(prev => ({ ...prev, issuer: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={submitting}>
              <Save className="w-4 h-4 mr-2" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link to={`/dashboard/documents/${id}`}>Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
