import { Search, Bell, Settings } from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export function Topbar() {
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-[#EF4444] text-white text-xs">
            3
          </Badge>
        </Button>
        
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>
        
        <div className="w-px h-8 bg-[#E2E8F0]" />
        
        <div className="flex items-center gap-3">
          <img 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" 
            alt="User" 
            className="w-8 h-8 rounded-full"
          />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Sarah Johnson</p>
            <p className="text-xs text-muted-foreground">HR Manager</p>
          </div>
        </div>
      </div>
    </header>
  );
}