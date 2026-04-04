import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
const photoUrl = (url?: string | null) => url ? `${API_BASE}${url}` : null;
import {
  ArrowLeft, Users, Clock, AlertTriangle, TrendingUp,
  CheckCircle, Search, ChevronRight, UserCircle, Flag,
  ThumbsUp, ThumbsDown, X,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { workflowApi } from '../../services/api';

// ─── Approve Modal ────────────────────────────────────────────────────────────

function ApproveModal({
  person,
  stageId,
  onClose,
  onDone,
}: {
  person: any;
  stageId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      if (person.personType === 'EMPLOYEE') {
        await workflowApi.approveEmployeeStage(person.personId, stageId, notes || undefined);
      } else {
        await workflowApi.submitApproval(person.progressId, { decision, notes: notes || undefined });
      }
      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to submit approval');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Stage Approval</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Submitting approval for <span className="font-medium text-foreground">{person.firstName} {person.lastName}</span>
        </p>

        {/* Decision — not shown for employees (employee approval is always "approved") */}
        {person.personType !== 'EMPLOYEE' && (
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setDecision('APPROVED')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                decision === 'APPROVED'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <ThumbsUp className="w-4 h-4" /> Approve
            </button>
            <button
              onClick={() => setDecision('REJECTED')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                decision === 'REJECTED'
                  ? 'bg-red-50 border-red-400 text-red-700'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <ThumbsDown className="w-4 h-4" /> Reject
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            rows={3}
            placeholder="Add any notes or reasons..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className={`flex-1 ${decision === 'REJECTED' && person.personType !== 'EMPLOYEE' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            onClick={submit}
            disabled={saving}
          >
            {saving ? 'Submitting...' : person.personType === 'EMPLOYEE' ? 'Approve' : decision === 'APPROVED' ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkflowStageDetailsPage() {
  const { stageId } = useParams<{ stageId: string }>();
  const navigate = useNavigate();
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [approvePerson, setApprovePerson] = useState<any>(null);

  const load = () => {
    if (!stageId) return;
    workflowApi.getWorkflowStageDetails(stageId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [stageId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded" />)}
        </div>
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Stage Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested workflow stage could not be found.</p>
          <Button onClick={() => navigate(-1)}>Return to Workflow</Button>
        </div>
      </div>
    );
  }

  const { stage, allStages, people, stats } = data;
  const totalStages = allStages?.length ?? 0;

  const filtered = (people ?? []).filter((p: any) => {
    const name = `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.email ?? ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">{stage.name}</h1>
          <p className="text-muted-foreground mt-1">
            Stage {stage.order} of {totalStages}
            {stage.description ? ` • ${stage.description}` : ''}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">{stats.total}</p>
                <p className="text-sm text-muted-foreground mt-1">Total in Stage</p>
                <p className="text-xs text-muted-foreground">{stats.employeesCount} employees · {stats.candidatesCount} applicants</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">{stats.avgDays}</p>
                <p className="text-sm text-muted-foreground mt-1">Avg. Days in Stage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">{stats.atRiskCount}</p>
                <p className="text-sm text-muted-foreground mt-1">At Risk (&gt;14 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#0F172A]">Stage {stage.order}</p>
                <p className="text-sm text-muted-foreground mt-1">of {totalStages} total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Requirements + Responsible */}
      {(stage.requiredDocs?.length > 0 || stage.assignedUsers?.length > 0) && (
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold text-lg mb-4">Stage Requirements</h2>
            <div className="space-y-3">
              {stage.requiredDocs?.map((rd: any) => (
                <div key={rd.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    <p className="font-medium text-[#0F172A]">{rd.documentType?.name ?? rd.documentTypeId}</p>
                  </div>
                  <Badge variant="outline" className="border-[#2563EB] text-[#2563EB]">Document</Badge>
                </div>
              ))}

              {/* Responsible approvers */}
              {stage.assignedUsers?.map((au: any) => (
                <div key={au.userId} className="flex items-center justify-between p-4 border rounded-lg bg-purple-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-[#0F172A]">
                        {au.user ? `${au.user.firstName} ${au.user.lastName}` : 'Reviewer'}
                      </p>
                      <p className="text-xs text-muted-foreground">Responsible approver</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-[#8B5CF6] text-[#8B5CF6]">Responsible</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* People in Stage */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">People in {stage.name}</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">
                {(people ?? []).length === 0 ? 'No one in this stage' : 'No results found'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {(people ?? []).length === 0
                  ? 'People will appear here when assigned to this stage.'
                  : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item: any) => (
                <div key={item.progressId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-[#F8FAFC] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center overflow-hidden shrink-0">
                      {item.photoUrl
                        ? <img src={photoUrl(item.photoUrl)!} alt={item.firstName} className="w-full h-full object-cover" />
                        : <UserCircle className="w-6 h-6 text-[#2563EB]" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-[#0F172A]">{item.firstName} {item.lastName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.nationality}{item.email ? ` · ${item.email}` : ''}
                        {item.systemId ? ` · ${item.systemId}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium text-[#0F172A]">{item.daysInStage}d</p>
                      <p className="text-xs text-muted-foreground">in stage</p>
                    </div>

                    {item.daysInStage > 14 && (
                      <Badge variant="outline" className="border-[#F59E0B] text-[#F59E0B] bg-[#FEF3C7]">
                        At Risk
                      </Badge>
                    )}

                    {item.flagged && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                        <Flag className="w-3 h-3 mr-1" /> Flagged
                      </Badge>
                    )}

                    <Badge
                      variant="outline"
                      className={item.personType === 'EMPLOYEE'
                        ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                        : 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]'}
                    >
                      {item.personType === 'EMPLOYEE' ? 'Employee' : 'Applicant'}
                    </Badge>

                    {item.latestApproval && (
                      <Badge
                        variant="outline"
                        className={
                          item.latestApproval.decision === 'APPROVED'
                            ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                            : item.latestApproval.decision === 'REJECTED'
                            ? 'border-red-400 text-red-600 bg-red-50'
                            : 'border-amber-400 text-amber-600 bg-amber-50'
                        }
                      >
                        {item.latestApproval.decision}
                      </Badge>
                    )}

                    {/* Approve button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setApprovePerson(item)}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>

                    {item.profileLink && (
                      <Link to={item.profileLink}>
                        <Button variant="outline" size="sm">
                          View Profile <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Modal */}
      {approvePerson && stageId && (
        <ApproveModal
          person={approvePerson}
          stageId={stageId}
          onClose={() => setApprovePerson(null)}
          onDone={() => { setApprovePerson(null); load(); }}
        />
      )}
    </div>
  );
}
