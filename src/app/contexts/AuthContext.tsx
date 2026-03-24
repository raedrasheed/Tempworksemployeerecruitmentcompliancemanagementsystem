import { createContext, useContext, useState, ReactNode } from 'react';
import { getCurrentUser, setCurrentUser as persistUser, AuthUser } from '../services/api';

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

  return (
    <AuthContext.Provider value={{ user, updateUser, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
