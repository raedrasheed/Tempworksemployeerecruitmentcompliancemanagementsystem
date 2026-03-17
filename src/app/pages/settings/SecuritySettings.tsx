import { Link } from 'react-router';
import { ArrowLeft, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/settings"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Security Settings</h1>
          <p className="text-muted-foreground mt-1">Manage security and access control</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="2fa">Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
            </div>
            <Switch id="2fa" defaultChecked />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Session Timeout</Label>
            <Select defaultValue="30">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ip-restriction">IP Address Restriction</Label>
              <p className="text-sm text-muted-foreground">Restrict access by IP address</p>
            </div>
            <Switch id="ip-restriction" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="audit-log">Audit Logging</Label>
              <p className="text-sm text-muted-foreground">Log all user activities</p>
            </div>
            <Switch id="audit-log" defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#EFF6FF] border-[#2563EB]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#2563EB]" />
            <CardTitle>Security Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your system security is configured correctly. Last security audit: March 1, 2026
          </p>
        </CardContent>
      </Card>
    </div>
  );
}