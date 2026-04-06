import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, Filter, RefreshCw,
  FileText, DollarSign, AlertTriangle, Info, Settings, ChevronDown, X,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { notificationsApi } from '../../services/api';
import { toast } from 'sonner';

// ── Type helpers ─────────────────────────────────────────────────────────────

function typeColor(type: string) {
  switch (type) {
    case 'WARNING':        return 'bg-amber-500';
    case 'ERROR':          return 'bg-red-500';
    case 'SUCCESS':        return 'bg-green-500';
    case 'DOCUMENT_EXPIRY':return 'bg-orange-500';
    case 'FINANCIAL':      return 'bg-blue-600';
    case 'COMPLIANCE':     return 'bg-purple-500';
    default:               return 'bg-blue-400';
  }
}

function typeIcon(type: string, eventType?: string) {
  if (eventType?.startsWith('FINANCIAL')) return <DollarSign className="w-4 h-4" />;
  if (eventType?.startsWith('DOCUMENT'))  return <FileText className="w-4 h-4" />;
  switch (type) {
    case 'WARNING':
    case 'ERROR':          return <AlertTriangle className="w-4 h-4" />;
    default:               return <Info className="w-4 h-4" />;
  }
}

function eventTypeLabel(eventType?: string): string {
  const labels: Record<string, string> = {
    DOCUMENT_UPLOADED:        'Document Uploaded',
    DOCUMENT_EXPIRING_SOON:   'Expiring Soon',
    DOCUMENT_EXPIRED:         'Expired',
    FINANCIAL_RECORD_CREATED: 'Record Added',
    FINANCIAL_RECORD_UPDATED: 'Record Updated',
    FINANCIAL_RECORD_DELETED: 'Record Deleted',
    FINANCIAL_RECORD_DEDUCTED:'Deduction',
    FINANCIAL_HIGH_BALANCE:   'High Balance',
  };
  return eventType ? (labels[eventType] ?? eventType) : '';
}

// ── Notification row ─────────────────────────────────────────────────────────

function NotificationRow({
  n,
  onMarkRead,
  onDelete,
}: {
  n: any;
  onMarkRead: (id: string) => void;
  onDelete:   (id: string) => void;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!n.isRead) onMarkRead(n.id);
    // Navigate to related entity
    if (n.relatedEntity && n.relatedEntityId) {
      const entityRoutes: Record<string, string> = {
        EMPLOYEE:  `/dashboard/employees/${n.relatedEntityId}`,
        APPLICANT: `/dashboard/applicants/${n.relatedEntityId}`,
      };
      const route = entityRoutes[n.relatedEntity];
      if (route) navigate(route);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer group ${
        n.isRead ? 'bg-card border-border' : 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
      } hover:bg-accent`}
      onClick={handleClick}
    >
      {/* Dot + icon */}
      <div className="flex flex-col items-center gap-1 mt-0.5 flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${n.isRead ? 'bg-muted-foreground/30' : 'bg-blue-500'}`} />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${typeColor(n.type)}`}>
          {typeIcon(n.type, n.eventType)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-sm truncate ${n.isRead ? 'font-normal' : 'font-semibold'}`}>{n.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {n.eventType && (
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {eventTypeLabel(n.eventType)}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions (show on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1" onClick={e => e.stopPropagation()}>
        {!n.isRead && (
          <button
            title="Mark as read"
            onClick={() => onMarkRead(n.id)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          title="Delete"
          onClick={() => onDelete(n.id)}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-muted-foreground hover:text-red-500"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterIsRead, setFilterIsRead]       = useState<string>('all');   // 'all' | 'unread' | 'read'
  const [filterType, setFilterType]           = useState<string>('all');
  const [filterEventType, setFilterEventType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom]   = useState('');
  const [filterDateTo, setFilterDateTo]       = useState('');

  const LIMIT = 20;

  const buildParams = useCallback(() => {
    const p: Record<string, any> = { page, limit: LIMIT };
    if (filterIsRead === 'unread') p.isRead = false;
    if (filterIsRead === 'read')   p.isRead = true;
    if (filterType !== 'all')      p.type   = filterType;
    if (filterEventType !== 'all') p.eventType = filterEventType;
    if (filterDateFrom)            p.dateFrom  = filterDateFrom;
    if (filterDateTo)              p.dateTo    = filterDateTo;
    return p;
  }, [page, filterIsRead, filterType, filterEventType, filterDateFrom, filterDateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, countRes] = await Promise.all([
        notificationsApi.list(buildParams()),
        notificationsApi.getUnreadCount(),
      ]);
      setNotifications(res?.data ?? []);
      setTotal(res?.meta?.total ?? 0);
      setUnreadCount(countRes?.count ?? 0);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationsApi.delete(id);
      const wasUnread = notifications.find(n => n.id === id)?.isRead === false;
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(t => t - 1);
      if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleResetFilters = () => {
    setFilterIsRead('all');
    setFilterType('all');
    setFilterEventType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);
  const hasActiveFilters = filterIsRead !== 'all' || filterType !== 'all' || filterEventType !== 'all' || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} · {total} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/notifications/settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters {hasActiveFilters && <Badge className="ml-1 h-4 text-xs bg-blue-500">{[filterIsRead !== 'all', filterType !== 'all', filterEventType !== 'all', !!filterDateFrom, !!filterDateTo].filter(Boolean).length}</Badge>}
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={handleMarkAllRead} disabled={markingAll}>
              <CheckCheck className="w-4 h-4 mr-2" />
              {markingAll ? 'Marking…' : 'Mark All Read'}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { setPage(1); load(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={filterIsRead} onValueChange={v => { setFilterIsRead(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread only</SelectItem>
                    <SelectItem value="read">Read only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="DOCUMENT_EXPIRY">Document</SelectItem>
                    <SelectItem value="FINANCIAL">Financial</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="SYSTEM">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Event</Label>
                <Select value={filterEventType} onValueChange={v => { setFilterEventType(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    <SelectItem value="DOCUMENT_UPLOADED">Doc Uploaded</SelectItem>
                    <SelectItem value="DOCUMENT_EXPIRING_SOON">Doc Expiring</SelectItem>
                    <SelectItem value="DOCUMENT_EXPIRED">Doc Expired</SelectItem>
                    <SelectItem value="FINANCIAL_RECORD_CREATED">Finance Added</SelectItem>
                    <SelectItem value="FINANCIAL_RECORD_UPDATED">Finance Updated</SelectItem>
                    <SelectItem value="FINANCIAL_RECORD_DELETED">Finance Deleted</SelectItem>
                    <SelectItem value="FINANCIAL_RECORD_DEDUCTED">Deduction</SelectItem>
                    <SelectItem value="FINANCIAL_HIGH_BALANCE">High Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date from</Label>
                <Input type="date" className="h-8 text-sm" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date to</Label>
                <Input type="date" className="h-8 text-sm" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }} />
              </div>
              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-8 text-muted-foreground">
                    <X className="w-3 h-3 mr-1" /> Reset
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border bg-muted/30 animate-pulse" />
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <BellOff className="w-12 h-12 opacity-30" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm">
              {hasActiveFilters ? 'No results for the current filters.' : 'You\'re all caught up!'}
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <NotificationRow
              key={n.id}
              n={n}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} notifications
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
