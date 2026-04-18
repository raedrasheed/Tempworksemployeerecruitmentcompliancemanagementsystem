import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, getCurrentUser, setCurrentUser as persistUser, AuthUser } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  updateUser: (user: AuthUser) => void;
  clearUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  updateUser: () => {},
  clearUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());

  const updateUser = (freshUser: AuthUser) => {
    persistUser(freshUser);
    setUser(freshUser);
  };

  const clearUser = () => {
    setUser(null);
  };

  /**
   * Re-fetch the signed-in user's permissions when the tab becomes
   * visible or regains focus. Keeps the effective permission set live
   * so role/permission edits made in the admin UI take effect without
   * forcing a manual logout. Skips when no user is signed in.
   */
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      authApi.me()
        .then((fresh) => {
          if (fresh) {
            persistUser(fresh);
            setUser(fresh);
          }
        })
        .catch(() => { /* leave cached user — network/auth errors handled elsewhere */ });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    // Refresh once on mount so a reloaded tab picks up any permission
    // changes made since the cached session was persisted.
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  // Re-arm listeners if the signed-in user changes.
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, updateUser, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
