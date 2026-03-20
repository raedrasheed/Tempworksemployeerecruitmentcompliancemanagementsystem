import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Bell, Settings, User, Lock, Globe, Moon, Sun, LogOut, ChevronDown } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { authApi, getCurrentUser, notificationsApi } from '../../services/api';
import { toast } from 'sonner';

export function Topbar() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [unreadCount, setUnreadCount] = useState(0);
  const storedUser = getCurrentUser();

  useEffect(() => {
    if (storedUser) {
      notificationsApi.getUnreadCount()
        .then((res) => setUnreadCount(res?.count || 0))
        .catch(() => {});
    }
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    navigate('/login');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  const currentUser = {
    name: storedUser ? `${storedUser.firstName} ${storedUser.lastName}` : 'User',
    role: storedUser?.role || 'Staff',
    email: storedUser?.email || '',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${storedUser?.firstName || 'User'}`
  };

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
              <img 
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full"
              />
              <div className="text-left">
                <p className="text-sm font-medium text-[#0F172A]">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser.role}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-64">
            {/* User Info Header */}
            <div className="px-2 py-3">
              <div className="flex items-center gap-3">
                <img 
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">{currentUser.role}</p>
                  <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            {/* Menu Items */}
            <DropdownMenuItem asChild>
              <Link to="/dashboard/profile" className="cursor-pointer">
                <User className="w-4 h-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings" className="cursor-pointer">
                <Settings className="w-4 h-4" />
                <span>Account Settings</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild>
              <Link to="/dashboard/change-password" className="cursor-pointer">
                <Lock className="w-4 h-4" />
                <span>Change Password</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild>
              <Link to="/dashboard/notifications" className="cursor-pointer">
                <Bell className="w-4 h-4" />
                <span>Notification Preferences</span>
              </Link>
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
            
            <DropdownMenuItem 
              onClick={handleLogout}
              variant="destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}