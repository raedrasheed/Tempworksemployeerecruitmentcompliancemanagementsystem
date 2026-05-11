import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Edit, Archive, Power, Trash2, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { tenantsApi, getCurrentUser, type TenantRecord } from '../../services/api';
import { apiError } from '../../../i18n/apiError';
import { toast } from 'sonner';
import { confirm } from '../../components/ui/ConfirmDialog';

// Phase 3.15 — Tenant Details page.
// @tenant-reviewed: phase315-tenant-management-module
export function TenantDetails() {
  const { t } = useTranslation('pages');
  const { id } = useParams();
  const me = getCurrentUser();
  const level = me?.platformAdmin?.level ?? 'NONE';
  const isSuper = level === 'SUPER';
  const canWrite = level === 'SUPER' || level === 'OPERATOR';

  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([tenantsApi.get(id), tenantsApi.stats(id).catch(() => null)])
      .then(([rec, s]) => { setTenant(rec); setStats(s); })
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  if (loading || !tenant) return <div className="p-6 text-muted-foreground">{t('tenants.list.loading')}</div>;

  const softDeleted = !!tenant.deletedAt;

  const onArchive = async () => {
    if (!await confirm({ title: t('tenants.confirmArchiveTitle'), description: t('tenants.confirmArchiveDesc') })) return;
    try { await tenantsApi.archive(tenant.id); toast.success(t('tenants.toastArchived')); load(); }
    catch (err) { toast.error(apiError(err)); }
  };
  const onActivate = async () => {
    try { await tenantsApi.activate(tenant.id); toast.success(t('tenants.toastActivated')); load(); }
    catch (err) { toast.error(apiError(err)); }
  };
  const onDelete = async () => {
    if (!await confirm({ title: t('tenants.confirmDeleteTitle'), description: t('tenants.confirmDeleteDesc'), variant: 'destructive' })) return;
    try { await tenantsApi.remove(tenant.id); toast.success(t('tenants.toastDeleted')); load(); }
    catch (err) { toast.error(apiError(err)); }
  };
  const onRestore = async () => {
    try { await tenantsApi.restore(tenant.id); toast.success(t('tenants.toastRestored')); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const statusCls =
    tenant.status === 'ACTIVE'    ? 'bg-green-500' :
    tenant.status === 'SUSPENDED' ? 'bg-amber-500' :
    'bg-gray-500';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">{tenant.name}</h1>
            <Badge className={statusCls}>{t(`tenants.statuses.${tenant.status.toLowerCase()}`)}</Badge>
            {softDeleted && <Badge variant="outline" className="border-red-500 text-red-600">{t('tenants.deleted')}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground font-mono">{tenant.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && !softDeleted && (
            <Button asChild variant="outline"><Link to={`/dashboard/tenants/${tenant.id}/edit`}><Edit className="w-4 h-4 me-1.5" />{t('tenants.list.edit')}</Link></Button>
          )}
          {canWrite && !softDeleted && tenant.status === 'ACTIVE' && (
            <Button variant="outline" onClick={onArchive}><Archive className="w-4 h-4 me-1.5" />{t('tenants.list.archive')}</Button>
          )}
          {canWrite && !softDeleted && tenant.status !== 'ACTIVE' && (
            <Button variant="outline" onClick={onActivate}><Power className="w-4 h-4 me-1.5" />{t('tenants.list.activate')}</Button>
          )}
          {isSuper && softDeleted && (
            <Button variant="outline" onClick={onRestore}><RotateCcw className="w-4 h-4 me-1.5" />{t('tenants.list.restore')}</Button>
          )}
          {isSuper && !softDeleted && (
            <Button variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700 border-red-300"><Trash2 className="w-4 h-4 me-1.5" />{t('tenants.list.delete')}</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t('tenants.tabs.general')}</TabsTrigger>
          <TabsTrigger value="branding">{t('tenants.tabs.branding')}</TabsTrigger>
          <TabsTrigger value="access">{t('tenants.tabs.access')}</TabsTrigger>
          <TabsTrigger value="stats">{t('tenants.tabs.stats')}</TabsTrigger>
          <TabsTrigger value="flags">{t('tenants.tabs.flags')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card><CardContent className="py-6 grid sm:grid-cols-2 gap-3 text-sm">
            <Row label={t('tenants.fields.name')} value={tenant.name} />
            <Row label={t('tenants.fields.slug')} value={tenant.slug} mono />
            <Row label={t('tenants.fields.status')} value={t(`tenants.statuses.${tenant.status.toLowerCase()}`)} />
            <Row label={t('tenants.fields.region')} value={tenant.region} />
            <Row label={t('tenants.fields.contactEmail')} value={tenant.contactEmail} />
            <Row label={t('tenants.fields.contactPhone')} value={tenant.contactPhone} />
            <Row label={t('tenants.fields.address')} value={tenant.address} />
            <Row label={t('tenants.fields.notes')} value={tenant.notes} />
            <Row label={t('tenants.fields.createdAt')} value={new Date(tenant.createdAt).toLocaleString()} />
            <Row label={t('tenants.fields.updatedAt')} value={new Date(tenant.updatedAt).toLocaleString()} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card><CardContent className="py-6 grid sm:grid-cols-2 gap-3 text-sm">
            <Row label={t('tenants.fields.logoUrl')} value={tenant.logoUrl} />
            <Row label={t('tenants.fields.primaryColor')} value={
              tenant.primaryColor ? <span className="inline-flex items-center gap-2"><span className="inline-block w-4 h-4 rounded border" style={{ background: tenant.primaryColor }} />{tenant.primaryColor}</span> : '—'
            } />
            <Row label={t('tenants.fields.locale')} value={tenant.locale} />
            <Row label={t('tenants.fields.timezone')} value={tenant.timezone} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="access">
          <Card><CardContent className="py-6 grid sm:grid-cols-2 gap-3 text-sm">
            <Row label={t('tenants.fields.customDomain')} value={tenant.customDomain} />
            <Row label={t('tenants.fields.planId')} value={tenant.planId} />
            <Row label={t('tenants.fields.onboardingStatus')} value={tenant.onboardingStatus} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card><CardContent className="py-6 grid sm:grid-cols-3 gap-3 text-sm">
            {stats ? (
              <>
                <StatBox label={t('tenants.stats.agencies')}   value={stats.agencies ?? 0} />
                <StatBox label={t('tenants.stats.users')}      value={stats.users ?? 0} />
                <StatBox label={t('tenants.stats.employees')}  value={stats.employees ?? 0} />
                <StatBox label={t('tenants.stats.applicants')} value={stats.applicants ?? 0} />
                <StatBox label={t('tenants.stats.documents')}  value={stats.documents ?? 0} />
                <StatBox label={t('tenants.stats.memberships')} value={stats.memberships ?? 0} />
              </>
            ) : <div className="text-muted-foreground col-span-3">{t('tenants.stats.unavailable')}</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="flags">
          <Card><CardContent className="py-6 text-sm">
            {Object.keys(tenant.featureFlags ?? {}).length === 0
              ? <span className="text-muted-foreground">{t('tenants.flags.empty')}</span>
              : <ul className="space-y-1">{Object.entries(tenant.featureFlags).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-2 border-b py-1">
                  <span className="font-mono text-xs">{k}</span>
                  <Badge className={v ? 'bg-green-500' : 'bg-gray-500'}>{String(v)}</Badge>
                </li>
              ))}</ul>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value ?? '—'}</div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
