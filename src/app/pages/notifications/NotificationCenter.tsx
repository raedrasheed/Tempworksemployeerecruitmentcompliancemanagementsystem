import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { mockNotifications } from '../../data/mockData';

export function NotificationCenter() {
  const unreadNotifications = mockNotifications.filter(n => !n.read);
  const readNotifications = mockNotifications.filter(n => n.read);

  const NotificationItem = ({ notification }: { notification: typeof mockNotifications[0] }) => (
    <div className="flex items-start gap-4 p-4 rounded-lg border hover:bg-[#F8FAFC] transition-colors">
      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
        notification.type === 'warning' ? 'bg-[#F59E0B]' :
        notification.type === 'success' ? 'bg-[#22C55E]' :
        notification.type === 'error' ? 'bg-[#EF4444]' :
        'bg-[#2563EB]'
      }`} />
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{notification.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
            <p className="text-xs text-muted-foreground mt-2">{notification.timestamp}</p>
          </div>
          <Badge variant={notification.read ? 'secondary' : 'default'}>
            {notification.read ? 'Read' : 'New'}
          </Badge>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Notifications</h1>
          <p className="text-muted-foreground mt-1">View and manage system notifications</p>
        </div>
        <Button>Mark All as Read</Button>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All ({mockNotifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadNotifications.length})</TabsTrigger>
          <TabsTrigger value="read">Read ({readNotifications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          {mockNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </TabsContent>

        <TabsContent value="unread" className="space-y-3">
          {unreadNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </TabsContent>

        <TabsContent value="read" className="space-y-3">
          {readNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
