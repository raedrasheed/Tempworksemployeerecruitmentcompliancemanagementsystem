import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, FileCheck, Plus, Play, Download,
  Trash2, Edit3, FileSpreadsheet, FileText, File, AlertTriangle,
  RefreshCw, Database, Filter, SortAsc, Layers, Link2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { reportsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

const PALETTE = ['#2563EB', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  excel: <FileSpreadsheet className="w-4 h-4 text-[#22C55E]" />,
  pdf:   <FileText         className="w-4 h-4 text-[#EF4444]" />,
  word:  <File             className="w-4 h-4 text-[#2563EB]" />,
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const OPERATORS = [
  { value: 'eq',          label: 'Equals' },
  { value: 'ne',          label: 'Not Equals' },
  { value: 'gt',          label: 'Greater Than' },
  { value: 'gte',         label: 'Greater or Equal' },
  { value: 'lt',          label: 'Less Than' },
  { value: 'lte',         label: 'Less or Equal' },
  { value: 'like',        label: 'Contains' },
  { value: 'between',     label: 'Between' },
  { value: 'in',          label: 'In (comma-separated)' },
  { value: 'is_null',     label: 'Is Empty' },
  { value: 'is_not_null', label: 'Is Not Empty' },
];

const AGG_TYPES = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

function emptyBuilder() {
  return { name: '', description: '', dataSource: '', filters: [] as any[], columns: [] as any[], sorting: [] as any[] };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, icon, value, sub, loading, color }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span style={{ color }}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-[#0F172A]" style={loading ? { color: '#CBD5E1' } : {}}>{loading ? '—' : value}</div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Preview Table ─────────────────────────────────────────────────────────────
function PreviewTable({ result, maxRows }: { result: any; maxRows?: number }) {
  const cols: any[] = result.columns ?? [];
  const rows: any[] = (result.rows ?? []).slice(0, maxRows ?? 9999);
  if (!cols.length) return <p className="p-4 text-sm text-muted-foreground">No columns selected.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-[#F8FAFC] border-b">
        <tr>
          {cols.map((c: any) => (
            <th key={c.key} className="text-left p-3 font-semibold text-xs whitespace-nowrap border-r last:border-r-0">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={cols.length} className="p-6 text-center text-muted-foreground">No data returned</td></tr>
        ) : rows.map((row: any, ri: number) => (
          <tr key={ri} className={`border-b ${ri % 2 === 1 ? 'bg-[#F8FAFC]' : ''} hover:bg-[#EFF6FF] transition-colors`}>
            {cols.map((c: any) => (
              <td key={c.key} className="p-3 border-r last:border-r-0 text-xs max-w-[180px] truncate">
                {row[c.key] instanceof Date
                  ? new Date(row[c.key]).toLocaleDateString()
                  : typeof row[c.key] === 'boolean'
                  ? (row[c.key] ? 'Yes' : 'No')
                  : (row[c.key] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export function ReportsDashboard() {
  const { canEdit } = usePermissions();

  const [kpis, setKpis]           = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [savedReports, setSavedReports]     = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [builder, setBuilder]         = useState(emptyBuilder());
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [previewResult, setPreviewResult]   = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runningId, setRunningId]       = useState<string | null>(null);
  const [runResult, setRunResult]       = useState<Record<string, any>>({});
  const [exporting, setExporting]       = useState<Record<string, boolean>>({});

  useEffect(() => {
    reportsApi.getDashboard()
      .then(setKpis).catch(() => {}).finally(() => setKpiLoading(false));
    reportsApi.list()
      .then((res: any) => setSavedReports(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {}).finally(() => setReportsLoading(false));
    reportsApi.getDataSources()
      .then((res: any) => setDataSources(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, []);

  const sourceFields = dataSources.find((ds: any) => ds.key === builder.dataSource)?.fields ?? [];

  // ── Builder helpers ───────────────────────────────────────────────────────
  const addFilter = () => setBuilder(b => ({ ...b, filters: [...b.filters, { id: Date.now(), fieldName: sourceFields[0]?.key ?? '', operator: 'eq', value: '', value2: '', valueType: sourceFields[0]?.type ?? 'string' }] }));
  const removeFilter = (i: number) => setBuilder(b => ({ ...b, filters: b.filters.filter((_, j) => j !== i) }));
  const updateFilter = (i: number, patch: any) => setBuilder(b => { const f = [...b.filters]; f[i] = { ...f[i], ...patch }; return { ...b, filters: f }; });
  const toggleColumn = (key: string, label: string) => setBuilder(b => {
    const ex = b.columns.find((c: any) => c.columnName === key);
    if (ex) return { ...b, columns: b.columns.filter((c: any) => c.columnName !== key) };
    return { ...b, columns: [...b.columns, { columnName: key, displayName: label, dataType: 'string', isGrouped: false, isAggregated: false, aggregationType: null, position: b.columns.length }] };
  });
  const updateColumn = (key: string, patch: any) => setBuilder(b => ({ ...b, columns: b.columns.map((c: any) => c.columnName === key ? { ...c, ...patch } : c) }));
  const addSort = (key: string) => setBuilder(b => {
    if (b.sorting.find((s: any) => s.columnName === key)) return b;
    return { ...b, sorting: [...b.sorting, { columnName: key, direction: 'ASC', position: b.sorting.length }] };
  });
  const removeSort = (i: number) => setBuilder(b => ({ ...b, sorting: b.sorting.filter((_, j) => j !== i) }));
  const updateSort = (i: number, patch: any) => setBuilder(b => { const s = [...b.sorting]; s[i] = { ...s[i], ...patch }; return { ...b, sorting: s }; });
  const loadIntoBuilder = (r: any) => { setBuilder({ name: r.name, description: r.description ?? '', dataSource: r.dataSource, filters: r.filters ?? [], columns: r.columns ?? [], sorting: r.sorting ?? [] }); setEditingId(r.id); setPreviewResult(null); };
  const resetBuilder = () => { setBuilder(emptyBuilder()); setEditingId(null); setPreviewResult(null); };
  const buildPayload = () => ({ name: builder.name.trim(), description: builder.description.trim() || undefined, dataSource: builder.dataSource, filters: builder.filters.map(({ id: _id, ...f }: any) => f), columns: builder.columns, sorting: builder.sorting });
  const refreshList = async () => { const r: any = await reportsApi.list(); setSavedReports(Array.isArray(r) ? r : (r?.data ?? [])); };

  const handleSave = async () => {
    if (!builder.name.trim()) { toast.error('Report name is required'); return; }
    if (!builder.dataSource)  { toast.error('Select a data source');    return; }
    setSaving(true);
    try {
      if (editingId) { await reportsApi.update(editingId, buildPayload()); toast.success('Report updated'); }
      else           { await reportsApi.create(buildPayload());             toast.success('Report saved');   }
      await refreshList(); resetBuilder();
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    if (!builder.name.trim()) { toast.error('Give the report a name first'); return; }
    if (!builder.dataSource)  { toast.error('Select a data source');          return; }
    setPreviewLoading(true);
    try {
      const pl = buildPayload();
      const saved: any = editingId ? await reportsApi.update(editingId, pl) : await reportsApi.create(pl);
      if (!editingId) setEditingId(saved.id);
      const result = await reportsApi.run(saved.id, { page: 1, limit: 50 });
      setPreviewResult(result);
      await refreshList();
    } catch (err: any) { toast.error(err?.message || 'Preview failed'); }
    finally { setPreviewLoading(false); }
  };

  const handleRunReport = async (id: string) => {
    setRunningId(id);
    try { const r = await reportsApi.run(id, { page: 1, limit: 100 }); setRunResult(p => ({ ...p, [id]: r })); }
    catch (err: any) { toast.error(err?.message || 'Run failed'); }
    finally { setRunningId(null); }
  };

  const handleExport = async (id: string, format: 'excel' | 'pdf' | 'word', name: string) => {
    const key = `${id}-${format}`;
    setExporting(p => ({ ...p, [key]: true }));
    try {
      const blob = await reportsApi.export(id, format);
      const ext  = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf';
      triggerDownload(blob, `${name.replace(/\s+/g, '_')}_${Date.now()}.${ext}`);
      toast.success(`Downloaded as ${ext.toUpperCase()}`);
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
    finally { setExporting(p => ({ ...p, [key]: false })); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    try { await reportsApi.delete(id); setSavedReports(p => p.filter(r => r.id !== id)); if (editingId === id) resetBuilder(); toast.success('Deleted'); }
    catch (err: any) { toast.error(err?.message || 'Delete failed'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">Dynamic report builder with Excel, PDF, and Word export</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="w-full grid grid-cols-3 mb-2">
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="builder"><Plus className="w-4 h-4 mr-2" />Report Builder</TabsTrigger>
          <TabsTrigger value="saved">
            <Database className="w-4 h-4 mr-2" />Saved Reports
            {savedReports.length > 0 && <Badge className="ml-2 bg-[#2563EB] text-white text-xs px-1.5">{savedReports.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD ─────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Total Employees"     icon={<Users className="w-4 h-4" />}         value={kpis?.employees?.total ?? '—'}              sub={`${kpis?.employees?.active ?? 0} active`}                     loading={kpiLoading} color="#2563EB" />
            <KpiCard title="Total Applicants"    icon={<TrendingUp className="w-4 h-4" />}    value={kpis?.applicants?.total ?? '—'}             sub={`+${kpis?.applicants?.newThisMonth ?? 0} this month`}          loading={kpiLoading} color="#22C55E" />
            <KpiCard title="Open Alerts"         icon={<AlertTriangle className="w-4 h-4" />} value={kpis?.compliance?.openAlerts ?? '—'}        sub={`${kpis?.compliance?.criticalAlerts ?? 0} critical`}           loading={kpiLoading} color="#EF4444" />
            <KpiCard title="Docs Expiring (30d)" icon={<FileCheck className="w-4 h-4" />}     value={kpis?.compliance?.expiringDocuments ?? '—'} sub="within next 30 days"                                          loading={kpiLoading} color="#F59E0B" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Employees by Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={kpis?.employees?.byStatus ?? []} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {(kpis?.employees?.byStatus ?? []).map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Applicants by Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={kpis?.applicants?.byStatus ?? []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={95} label={({ status, percent }: any) => `${status} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {(kpis?.applicants?.byStatus ?? []).map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── REPORT BUILDER ────────────────────────────────────────── */}
        <TabsContent value="builder" className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">{editingId ? 'Edit Report' : 'New Report'}</h2>
              <p className="text-sm text-muted-foreground">Select a source, pick columns, add filters, define sorting</p>
            </div>
            {editingId && <Button variant="outline" size="sm" onClick={resetBuilder}>New / Clear</Button>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Config panel */}
            <div className="space-y-4">

              {/* Info */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4 text-[#2563EB]" />Report Info</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Name *</Label>
                    <Input className="mt-1" placeholder="Active Employees by Country" value={builder.name} onChange={e => setBuilder(b => ({ ...b, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input className="mt-1" placeholder="Optional" value={builder.description} onChange={e => setBuilder(b => ({ ...b, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data Source *</Label>
                    <Select value={builder.dataSource} onValueChange={v => setBuilder(b => ({ ...emptyBuilder(), name: b.name, description: b.description, dataSource: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {dataSources.some((ds: any) => ds.group === 'single') && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Single Table</div>
                            {dataSources.filter((ds: any) => ds.group === 'single').map((ds: any) => (
                              <SelectItem key={ds.key} value={ds.key}>
                                <div className="flex items-center gap-2">
                                  <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  {ds.label}
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {dataSources.some((ds: any) => ds.group === 'combined') && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-t mt-1 pt-2">Combined (Multi-Table)</div>
                            {dataSources.filter((ds: any) => ds.group === 'combined').map((ds: any) => (
                              <SelectItem key={ds.key} value={ds.key}>
                                <div className="flex items-center gap-2">
                                  <Link2 className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                                  {ds.label}
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {/* Show join indicator when a combined source is selected */}
                    {(() => {
                      const sel = dataSources.find((ds: any) => ds.key === builder.dataSource);
                      if (!sel || sel.group !== 'combined') return null;
                      return (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#8B5CF6]">
                          <Link2 className="w-3 h-3" />
                          <span className="font-medium">Joining:</span>
                          {(sel.tables as string[]).map((t: string, i: number) => (
                            <span key={t}>
                              {i > 0 && <span className="text-muted-foreground mx-0.5">+</span>}
                              <Badge variant="outline" className="text-xs px-1 py-0 border-[#8B5CF6] text-[#8B5CF6]">{t}</Badge>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Columns */}
              {builder.dataSource && (
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-[#8B5CF6]" />Columns</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {sourceFields.map((f: any) => {
                      const col = builder.columns.find((c: any) => c.columnName === f.key);
                      return (
                        <div key={f.key} className={`border rounded-lg p-2.5 space-y-2 ${col ? 'bg-[#EFF6FF] border-[#BFDBFE]' : ''}`}>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={!!col} onCheckedChange={() => toggleColumn(f.key, f.label)} />
                            <span className="text-sm flex-1 font-medium">{f.label}</span>
                            <Badge variant="outline" className="text-xs px-1.5">{f.type}</Badge>
                          </div>
                          {col && (
                            <div className="pl-6 space-y-2">
                              <Input className="h-7 text-xs" placeholder="Display name" value={col.displayName} onChange={e => updateColumn(f.key, { displayName: e.target.value })} />
                              <div className="flex gap-3">
                                <label className="flex items-center gap-1 text-xs cursor-pointer">
                                  <Checkbox checked={col.isGrouped} onCheckedChange={v => updateColumn(f.key, { isGrouped: !!v })} />
                                  Group by
                                </label>
                                <label className="flex items-center gap-1 text-xs cursor-pointer">
                                  <Checkbox checked={col.isAggregated} onCheckedChange={v => updateColumn(f.key, { isAggregated: !!v, aggregationType: v ? 'COUNT' : null })} />
                                  Aggregate
                                </label>
                              </div>
                              {col.isAggregated && (
                                <Select value={col.aggregationType ?? 'COUNT'} onValueChange={v => updateColumn(f.key, { aggregationType: v })}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{AGG_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                                </Select>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Sorting */}
              {builder.dataSource && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><SortAsc className="w-4 h-4 text-[#F59E0B]" />Sorting</CardTitle>
                    <Select onValueChange={addSort}>
                      <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="+ Add field" /></SelectTrigger>
                      <SelectContent>{sourceFields.map((f: any) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {builder.sorting.length === 0 && <p className="text-xs text-muted-foreground">No sort rules</p>}
                    {builder.sorting.map((s: any, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs flex-1 truncate font-medium">{s.columnName}</span>
                        <Select value={s.direction} onValueChange={v => updateSort(i, { direction: v })}>
                          <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="ASC">ASC</SelectItem><SelectItem value="DESC">DESC</SelectItem></SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-[#EF4444]" onClick={() => removeSort(i)}>×</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Filters + Actions + Preview */}
            <div className="lg:col-span-2 space-y-4">
              {/* Filters */}
              {builder.dataSource && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4 text-[#06B6D4]" />Filters <Badge variant="outline">{builder.filters.length}</Badge></CardTitle>
                    <Button size="sm" variant="outline" onClick={addFilter}><Plus className="w-3.5 h-3.5 mr-1" />Add Filter</Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {builder.filters.length === 0 && <p className="text-sm text-muted-foreground">No filters — all rows will be included.</p>}
                    {builder.filters.map((f: any, i: number) => (
                      <div key={f.id ?? i} className="border rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                        <div>
                          <Label className="text-xs">Field</Label>
                          <Select value={f.fieldName} onValueChange={v => { const m = sourceFields.find((sf: any) => sf.key === v); updateFilter(i, { fieldName: v, valueType: m?.type ?? 'string', value: '', value2: '' }); }}>
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>{sourceFields.map((sf: any) => <SelectItem key={sf.key} value={sf.key}>{sf.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Operator</Label>
                          <Select value={f.operator} onValueChange={v => updateFilter(i, { operator: v })}>
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>{OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {!['is_null', 'is_not_null'].includes(f.operator) && (
                          <div>
                            <Label className="text-xs">Value{f.operator === 'between' ? ' (from)' : ''}</Label>
                            <Input className="h-8 text-xs mt-0.5" placeholder={f.operator === 'in' ? 'a,b,c' : 'value'} value={f.value} onChange={e => updateFilter(i, { value: e.target.value })} />
                          </div>
                        )}
                        {f.operator === 'between' ? (
                          <div>
                            <Label className="text-xs">Value (to)</Label>
                            <Input className="h-8 text-xs mt-0.5" placeholder="end" value={f.value2 ?? ''} onChange={e => updateFilter(i, { value2: e.target.value })} />
                          </div>
                        ) : (
                          <div className="flex items-end">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-[#EF4444]" onClick={() => removeFilter(i)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                        {f.operator === 'between' && (
                          <div className="col-span-2 sm:col-span-4 flex justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-[#EF4444]" onClick={() => removeFilter(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <Button onClick={handlePreview} disabled={previewLoading} className="bg-[#2563EB] hover:bg-[#1D4ED8]">
                  {previewLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  {previewLoading ? 'Running preview…' : 'Preview (50 rows)'}
                </Button>
                <Button onClick={handleSave} disabled={saving} variant="outline">
                  {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {saving ? 'Saving…' : editingId ? 'Update Report' : 'Save Report'}
                </Button>
                {editingId && (['excel', 'pdf', 'word'] as const).map(fmt => (
                  <Button key={fmt} variant="outline" size="sm" className="flex items-center gap-1.5" disabled={!!exporting[`${editingId}-${fmt}`]} onClick={() => handleExport(editingId!, fmt, builder.name)}>
                    {FORMAT_ICONS[fmt]}
                    {exporting[`${editingId}-${fmt}`] ? 'Exporting…' : fmt.toUpperCase()}
                  </Button>
                ))}
              </div>

              {/* Preview table */}
              {previewResult && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Preview — {previewResult.rows?.length ?? 0} of {previewResult.total ?? 0} total rows</CardTitle></CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <PreviewTable result={previewResult} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── SAVED REPORTS ─────────────────────────────────────────── */}
        <TabsContent value="saved" className="space-y-4">
          {reportsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading saved reports…</div>
          ) : savedReports.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Database className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <h3 className="font-semibold mb-1">No saved reports yet</h3>
                <p className="text-sm text-muted-foreground">Use the Report Builder tab to create and save your first report.</p>
              </CardContent>
            </Card>
          ) : savedReports.map(report => (
            <Card key={report.id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-[#0F172A] truncate">{report.name}</h3>
                      {(() => {
                        const ds = dataSources.find((d: any) => d.key === report.dataSource);
                        const isCombined = ds?.group === 'combined';
                        return (
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 flex items-center gap-1 ${isCombined ? 'border-[#8B5CF6] text-[#8B5CF6]' : ''}`}
                          >
                            {isCombined && <Link2 className="w-3 h-3" />}
                            {ds?.label ?? report.dataSource?.replace(/_/g, ' ')}
                          </Badge>
                        );
                      })()}
                    </div>
                    {report.description && <p className="text-sm text-muted-foreground mb-2 truncate">{report.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{report.columns?.length ?? 0} columns</span>
                      <span className="flex items-center gap-1"><Filter className="w-3 h-3" />{report.filters?.length ?? 0} filters</span>
                      <span className="flex items-center gap-1"><SortAsc className="w-3 h-3" />{report.sorting?.length ?? 0} sorts</span>
                      <span>Updated {new Date(report.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleRunReport(report.id)} disabled={runningId === report.id}>
                      {runningId === report.id ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                      Run
                    </Button>
                    {canEdit('reports') && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => loadIntoBuilder(report)}>
                          <Edit3 className="w-3.5 h-3.5 mr-1" />Edit
                        </Button>
                        {(['excel', 'pdf', 'word'] as const).map(fmt => (
                          <Button key={fmt} size="sm" variant="ghost" title={`Export as ${fmt}`} disabled={!!exporting[`${report.id}-${fmt}`]} onClick={() => handleExport(report.id, fmt, report.name)}>
                            {FORMAT_ICONS[fmt]}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" className="text-[#EF4444] hover:text-[#DC2626]" onClick={() => handleDelete(report.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {runResult[report.id] && (
                <div className="border-t">
                  <div className="px-5 py-2 bg-[#F8FAFC] flex items-center justify-between text-xs text-muted-foreground">
                    <span>{runResult[report.id].rows?.length} of {runResult[report.id].total} rows (page 1, limit 100)</span>
                    <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setRunResult(p => { const c = { ...p }; delete c[report.id]; return c; })}>Collapse</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <PreviewTable result={runResult[report.id]} maxRows={20} />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
