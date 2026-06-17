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
          // Step 1: Proactively refresh the token BEFORE calling /auth/me
          // This ensures we always use a fresh token, avoiding the
          // "Auth session missing!" / "token is expired" errors from the backend.
          let freshSession = session;
          try {
            const refreshResult = await auth.refresh();
            if (refreshResult.success && refreshResult.session?.access_token) {
              freshSession = refreshResult.session;
            }
          } catch {
            // Refresh might fail if the refresh_token is also expired.
            // We'll try /auth/me anyway - it might still work.
          }

          // Step 2: Get fresh user data from backend (includes latest role from DB)
          try {
            const result = await auth.getMe();
            if (result.success) {
              // Backend is the single source of truth for user data (role, name, etc.)
              setUser(result.user);
              localStorage.setItem('assertiq_user', JSON.stringify(result.user));
              return;
            }
          } catch {
            // getMe failed even after refresh - likely network error or invalid session
            console.warn('Could not verify session with backend');
          }

          // Step 3: Fall back to stored user data (keeps app functional)
          // Role may be stale from cache, but better than logging the user out.
          const cachedUser = auth.getUser();
          if (cachedUser) {
            setUser(cachedUser);
          } else {
            setUser(null);
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

  const googleSignIn = useCallback(async (idToken) => {
    const result = await auth.googleSignIn(idToken);
    if (result.success) {
      // Always re-fetch from /auth/me to get the true role from the database
      try {
        const meResult = await auth.getMe();
        if (meResult.success) {
          setUser(meResult.user);
          localStorage.setItem('assertiq_user', JSON.stringify(meResult.user));
          return { ...result, user: meResult.user };
        }
      } catch (e) {
        console.warn('Could not refresh user after login, using login response', e);
      }
      setUser({ ...result.user, organizations: result.organizations || [] });
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
    googleSignIn,
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