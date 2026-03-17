import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { mockNotifications } from '../../data/mockData';

export function ComplianceAlerts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Compliance Alerts</h1>
        <p className="text-muted-foreground mt-1">Review and manage compliance notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockNotifications.map((notification) => (
              <div key={notification.id} className="flex items-start gap-4 p-4 rounded-lg border">
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
                      {notification.read ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
