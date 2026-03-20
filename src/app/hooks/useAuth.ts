import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { authApi, getCurrentUser, clearTokens } from '../services/api';
import type { AuthUser } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser());
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { user: loggedInUser } = await authApi.login(email, password);
      setUser(loggedInUser);
      navigate('/dashboard');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearTokens();
      setUser(null);
      navigate('/login');
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    return authApi.changePassword(currentPassword, newPassword);
  };

  return { user, loading, login, logout, changePassword, isAuthenticated: !!user };
}
