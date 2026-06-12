/**
 * AuthContext - React context for authentication state
 * Manages user session globally across the app
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = auth.getSession();
        const storedUser = auth.getUser();

        if (session && storedUser) {
          setUser(storedUser);

          // Verify token is still valid
          try {
            const result = await auth.getMe();
            if (result.success) {
              setUser(result.user);
              // Update stored user
              localStorage.setItem('assertiq_user', JSON.stringify(result.user));
            } else {
              // Token invalid, try refresh
              throw new Error('Token invalid');
            }
          } catch {
            // Token expired or invalid, try refresh via login
            // If refresh fails, user needs to login again
            const refreshedUser = auth.getUser();
            if (refreshedUser) {
              setUser(refreshedUser);
            } else {
              setUser(null);
              auth.logout(); // Clean up
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setUser(null);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await auth.login(email, password);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    const result = await auth.register(email, password, fullName);
    if (result.success && result.session) {
      // If registration returned a session, login was also performed
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
    window.location.href = '/';
  }, []);

  const value = {
    user,
    loading,
    initialized,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    setUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;