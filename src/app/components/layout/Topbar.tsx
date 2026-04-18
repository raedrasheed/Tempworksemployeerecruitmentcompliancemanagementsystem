import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Bell, Settings, User, Lock, Globe, Moon, Sun, LogOut, ChevronDown, Eye, EyeOff, CheckCircle, X, Palette, CheckCheck, FileText, DollarSign, AlertTriangle, Info, Building2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { authApi, getCurrentUser, setCurrentUser, notificationsApi, BACKEND_URL, type AuthUser } from '../../services/api';
import { toast } from 'sonner';

// ── Notification bell dropdown ────────────────────────────────────────────────

function notifIcon(type: string, eventType?: string) {
  if (eventType?.startsWith('FINANCIAL')) return <DollarSign className="w-3.5 h-3.5" />;
  if (eventType?.startsWith('DOCUMENT'))  return <FileText className="w-3.5 h-3.5" />;
  if (type === 'WARNING' || type === 'ERROR') return <AlertTriangle className="w-3.5 h-3.5" />;
  return <Info className="w-3.5 h-3.5" />;
}

function notifDotColor(type: string) {
  switch (type) {
    case 'WARNING':        return 'bg-amber-500';
    case 'ERROR':          return 'bg-red-500';
    case 'SUCCESS':        return 'bg-green-500';
    case 'DOCUMENT_EXPIRY':return 'bg-orange-500';
    case 'FINANCIAL':      return 'bg-blue-600';
    default:               return 'bg-blue-400';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotificationBell({
  unreadCount,
  onCountChange,
}: {
  unreadCount: number;
  onCountChange: (n: number) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ page: 1, limit: 8 });
      setItems(res?.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      onCountChange(Math.max(0, unreadCount - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
      onCountChange(0);
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClickItem = (n: any) => {
    if (!n.isRead) handleMarkRead(n.id);
    setOpen(false);
    const routes: Record<string, string> = {
      EMPLOYEE:  `/dashboard/employees/${n.relatedEntityId}`,
      APPLICANT: `/dashboard/applicants/${n.relatedEntityId}`,
    };
    if (n.relatedEntity && n.relatedEntityId && routes[n.relatedEntity]) {
      navigate(routes[n.relatedEntity]);
    } else {
      navigate('/dashboard/notifications');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(v => !v)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Badge className="h-5 text-xs bg-destructive text-destructive-foreground">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {markingAll ? 'Marking…' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 px-4 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-muted mt-1.5 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-muted rounded animate-pulse w-full" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Bell className="w-8 h-8 opacity-25" />
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors ${
                    !n.isRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {/* Unread dot + icon */}
                  <div className="flex flex-col items-center gap-1 mt-0.5 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${!n.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${notifDotColor(n.type)}`}>
                      {notifIcon(n.type, n.eventType)}
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!n.isRead ? 'font-semibold' : 'font-normal'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              to="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline font-medium"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    let s = 0;
    if (newPassword.length >= 8) s += 25;
    if (newPassword.length >= 12) s += 25;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) s += 25;
    if (/[0-9]/.test(newPassword)) s += 12.5;
    if (/[^a-zA-Z0-9]/.test(newPassword)) s += 12.5;
    return Math.min(s, 100);
  })();

  const strengthLabel = strength < 25
    ? { text: 'Weak',   textColor: 'text-red-500',   barColor: 'bg-red-500' }
    : strength < 50
    ? { text: 'Fair',   textColor: 'text-amber-500', barColor: 'bg-amber-500' }
    : strength < 75
    ? { text: 'Good',   textColor: 'text-blue-500',  barColor: 'bg-blue-500' }
    : { text: 'Strong', textColor: 'text-green-500', barColor: 'bg-green-500' };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) { toast.error('Enter your current password'); return; }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      handleClose();
    } catch (err: any) {
      const msg = Array.isArray(err?.message)
        ? err.message.join(', ')
        : (err?.message || 'Failed to change password');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Current Password */}
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-10 pr-10"
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10"
                placeholder="Enter new password"
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="flex items-center justify-between text-xs mt-1">
                <div className="flex gap-1 flex-1 mr-3">
                  {[25, 50, 75, 100].map((threshold) => (
                    <div key={threshold}
                      className={`h-1 flex-1 rounded-full ${strength >= threshold ? strengthLabel.barColor : 'bg-muted'}`}
                    />
                  ))}
                </div>
                <span className={strengthLabel.textColor}>{strengthLabel.text}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10"
                placeholder="Confirm new password"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && (
              <div className="flex items-center gap-1.5 text-xs mt-1">
                {newPassword === confirmPassword
                  ? <><CheckCircle className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">Passwords match</span></>
                  : <><X className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">Passwords do not match</span></>
                }
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Topbar() {
  const navigate = useNavigate();
  const { isDark, toggleDark } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveUser, setLiveUser] = useState<AuthUser | null>(getCurrentUser());
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    authApi.me()
      .then((user) => {
        setLiveUser(user);
        setCurrentUser(user);
      })
      .catch(() => {});

    const fetchUnread = () => {
      notificationsApi.getUnreadCount()
        .then((res) => setUnreadCount(res?.count || 0))
        .catch(() => {});
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    navigate('/login');
  };

  const displayName = liveUser ? `${liveUser.firstName} ${liveUser.lastName}` : 'User';
  const displayRole = liveUser?.role || 'Staff';
  const displayEmail = liveUser?.email || '';
  const avatar = liveUser?.photoUrl
    ? `${BACKEND_URL}${liveUser.photoUrl}`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${liveUser?.firstName || 'User'}`;

  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center gap-4">
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees, applications, documents..."
            className="pl-10 bg-muted border-0"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell unreadCount={unreadCount} onCountChange={setUnreadCount} />

        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>

        <div className="w-px h-8 bg-border" />

        {/* User Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 hover:bg-accent rounded-lg px-2 py-1.5 transition-colors">
              <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full" />
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayRole}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            {/* User Info Header */}
            <div className="px-2 py-3">
              <div className="flex items-center gap-3">
                <img src={avatar} alt={displayName} className="w-10 h-10 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{displayRole}</p>
                  <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link to="/dashboard/profile" className="cursor-pointer">
                <User className="w-4 h-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>

            {liveUser?.role === 'Agency Manager' && liveUser?.agencyId && (
              <DropdownMenuItem asChild>
                <Link to="/dashboard/my-agency" className="cursor-pointer">
                  <Building2 className="w-4 h-4" />
                  <span>Agency Profile</span>
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => setShowChangePassword(true)} className="cursor-pointer">
              <Lock className="w-4 h-4" />
              <span>Change Password</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={toggleDark}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>Theme: {isDark ? 'Dark' : 'Light'}</span>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings/color-scheme" className="cursor-pointer">
                <Palette className="w-4 h-4" />
                <span>Color Scheme</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Globe className="w-4 h-4" />
              <span>Language: English</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </header>
  );
}
