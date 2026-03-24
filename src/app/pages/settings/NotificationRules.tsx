import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { usePermissions } from '../../hooks/usePermissions';

export function NotificationRules() {
  const { canEdit, canCreate, canDelete } = usePermissions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/settings"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Notification Rules</h1>
          <p className="text-muted-foreground mt-1">Configure notification preferences</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="new-application">New Application Received</Label>
              <p className="text-sm text-muted-foreground">Notify when a new driver application is submitted</p>
            </div>
            <Switch id="new-application" defaultChecked disabled={!canEdit('settings')} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="doc-expiry">Document Expiry Alerts</Label>
              <p className="text-sm text-muted-foreground">Send alerts 30 days before document expiration</p>
            </div>
            <Switch id="doc-expiry" defaultChecked disabled={!canEdit('settings')} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="visa-update">Visa Status Updates</Label>
              <p className="text-sm text-muted-foreground">Notify when visa application status changes</p>
            </div>
            <Switch id="visa-update" defaultChecked disabled={!canEdit('settings')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="workflow-progress">Workflow Progress</Label>
              <p className="text-sm text-muted-foreground">Notify when driver moves to next workflow stage</p>
            </div>
            <Switch id="workflow-progress" defaultChecked disabled={!canEdit('settings')} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="compliance-alerts">Compliance Alerts</Label>
              <p className="text-sm text-muted-foreground">Send alerts for compliance issues</p>
            </div>
            <Switch id="compliance-alerts" defaultChecked disabled={!canEdit('settings')} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}