import { useState } from 'react';
import { toast } from 'sonner';
import { authApi } from '../../services/api';
import { Eye, EyeOff, Lock, CheckCircle, X, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  // Password strength calculation
  const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  const getStrengthLabel = (strength: number): { label: string; color: string } => {
    if (strength < 25) return { label: 'Weak', color: 'bg-[#EF4444]' };
    if (strength < 50) return { label: 'Fair', color: 'bg-[#F59E0B]' };
    if (strength < 75) return { label: 'Good', color: 'bg-[#3B82F6]' };
    return { label: 'Strong', color: 'bg-[#22C55E]' };
  };

  const strengthInfo = getStrengthLabel(passwordStrength);

  // Password validation rules
  const validationRules = [
    { label: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
    { label: 'Contains uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
    { label: 'Contains lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
    { label: 'Contains number', test: (pwd: string) => /[0-9]/.test(pwd) },
    { label: 'Contains special character', test: (pwd: string) => /[^a-zA-Z0-9]/.test(pwd) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccessMessage(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
      setTimeout(() => setSuccessMessage(false), 5000);
    } catch (err: any) {
      const msg = Array.isArray(err?.message)
        ? err.message.join(', ')
        : (err?.message || 'Failed to change password');
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Change Password</h1>
        <p className="text-muted-foreground mt-1">Update your password to keep your account secure</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-[#F0FDF4] border border-[#22C55E] rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-[#22C55E] mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-[#22C55E]">Password Updated Successfully</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your password has been changed. Please use your new password for future logins.
            </p>
          </div>
          <button onClick={() => setSuccessMessage(false)}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Password Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#0F172A]"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Enter your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#0F172A]"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Password Strength:</Label>
                    <span className={`text-sm font-medium ${
                      strengthInfo.color.replace('bg-', 'text-')
                    }`}>
                      {strengthInfo.label}
                    </span>
                  </div>
                  <Progress 
                    value={passwordStrength} 
                    className={`h-2 ${strengthInfo.color}`}
                  />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#0F172A]"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Match Indicator */}
              {confirmPassword && (
                <div className="flex items-center gap-2 mt-2">
                  {newPassword === confirmPassword ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                      <span className="text-sm text-[#22C55E]">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-sm text-[#EF4444]">Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Password Requirements */}
            <div className="p-4 bg-[#F8FAFC] border rounded-lg">
              <p className="text-sm font-medium mb-3">Password Requirements:</p>
              <div className="space-y-2">
                {validationRules.map((rule, index) => {
                  const isValid = rule.test(newPassword);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      {newPassword ? (
                        isValid ? (
                          <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                        ) : (
                          <X className="w-4 h-4 text-[#EF4444]" />
                        )
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                      )}
                      <span className={`text-sm ${
                        newPassword ? (isValid ? 'text-[#22C55E]' : 'text-[#EF4444]') : 'text-muted-foreground'
                      }`}>
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Security Tips */}
            <div className="p-4 bg-[#EFF6FF] border border-[#2563EB] rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-[#2563EB] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#2563EB]">Security Tips</p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Use a unique password that you don't use for other accounts</li>
                    <li>Consider using a passphrase or password manager</li>
                    <li>Change your password regularly (every 3-6 months)</li>
                    <li>Never share your password with anyone</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                Update Password
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
