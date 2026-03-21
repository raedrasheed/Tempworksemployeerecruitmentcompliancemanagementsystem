import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Bell, Settings, User, Lock, Globe, Moon, Sun, LogOut, ChevronDown, Eye, EyeOff, CheckCircle, X } from 'lucide-react';
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
import { authApi, getCurrentUser, setCurrentUser, notificationsApi, type AuthUser } from '../../services/api';
import { toast } from 'sonner';

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

  const strengthLabel = strength < 25 ? { text: 'Weak', color: 'text-red-500' }
    : strength < 50 ? { text: 'Fair', color: 'text-amber-500' }
    : strength < 75 ? { text: 'Good', color: 'text-blue-500' }
    : { text: 'Strong', color: 'text-green-500' };

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
    if (strength < 50) { toast.error('Please choose a stronger password'); return; }

    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to change password');
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
                      className={`h-1 flex-1 rounded-full ${strength >= threshold ? strengthLabel.color.replace('text-', 'bg-') : 'bg-muted'}`}
                    />
                  ))}
                </div>
                <span className={strengthLabel.color}>{strengthLabel.text}</span>
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveUser, setLiveUser] = useState<AuthUser | null>(getCurrentUser());
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    // Fetch fresh profile data from the API
    authApi.me()
      .then((user) => {
        setLiveUser(user);
        setCurrentUser(user);
      })
      .catch(() => {});

    notificationsApi.getUnreadCount()
      .then((res) => setUnreadCount(res?.count || 0))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    navigate('/login');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  const displayName = liveUser ? `${liveUser.firstName} ${liveUser.lastName}` : 'User';
  const displayRole = liveUser?.role || 'Staff';
  const displayEmail = liveUser?.email || '';
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${liveUser?.firstName || 'User'}`;

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center gap-4">
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees, applications, documents..."
            className="pl-10 bg-[#F8FAFC] border-0"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link to="/dashboard/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-[#EF4444] text-white text-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </Link>

        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>

        <div className="w-px h-8 bg-[#E2E8F0]" />

        {/* User Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 hover:bg-[#F8FAFC] rounded-lg px-2 py-1.5 transition-colors">
              <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full" />
              <div className="text-left">
                <p className="text-sm font-medium text-[#0F172A]">{displayName}</p>
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

            <DropdownMenuItem onClick={() => setShowChangePassword(true)} className="cursor-pointer">
              <Lock className="w-4 h-4" />
              <span>Change Password</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span>Theme: {theme === 'light' ? 'Light' : 'Dark'}</span>
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
