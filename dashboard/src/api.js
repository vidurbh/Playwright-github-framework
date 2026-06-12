/**
 * API helper with automatic auth token injection
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7000';

/**
 * Get stored auth token
 */
function getToken() {
  try {
    const session = JSON.parse(localStorage.getItem('assertiq_session') || 'null');
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Get refresh token
 */
function getRefreshToken() {
  try {
    const session = JSON.parse(localStorage.getItem('assertiq_session') || 'null');
    return session?.refresh_token || null;
  } catch {
    return null;
  }
}

/**
 * Store session data
 */
function setSession(session) {
  localStorage.setItem('assertiq_session', JSON.stringify(session));
}

/**
 * Clear session data
 */
function clearSession() {
  localStorage.removeItem('assertiq_session');
  localStorage.removeItem('assertiq_user');
  localStorage.removeItem('selectedOrgId');
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token })
  });

  const data = await response.json();
  if (!data.success) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  // Update stored session with new tokens
  const currentSession = JSON.parse(localStorage.getItem('assertiq_session') || '{}');
  setSession({
    ...currentSession,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });

  return data.session.access_token;
}

/**
 * Make an authenticated API request
 * Automatically injects the Bearer token and handles token refresh
 */
export async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  let response = await fetch(url, {
    ...options,
    headers
  });

  // If 401, try refreshing the token
  if (response.status === 401 && token) {
    try {
      const newToken = await refreshAccessToken();
      headers.Authorization = `Bearer ${newToken}`;

      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (err) {
      console.error('Auth refresh failed:', err);
      throw new Error('Session expired');
    }
  }

  const data = await response.json();
  return data;
}

/**
 * Auth-specific API functions
 */
export const auth = {
  async register(email, password, fullName) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName })
    });
    const data = await response.json();
    if (data.success && data.session) {
      setSession(data.session);
      localStorage.setItem('assertiq_user', JSON.stringify(data.user));
      if (data.organizations?.length > 0) {
        localStorage.setItem('selectedOrgId', data.organizations[0].org_id);
      }
    }
    return data;
  },

  async login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
      setSession(data.session);
      localStorage.setItem('assertiq_user', JSON.stringify(data.user));
      if (data.organizations?.length > 0) {
        localStorage.setItem('selectedOrgId', data.organizations[0].org_id);
      }
    }
    return data;
  },

  async logout() {
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // Ignore errors on logout
      }
    }
    clearSession();
  },

  async getMe() {
    return apiRequest('/auth/me');
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem('assertiq_session') || 'null');
    } catch {
      return null;
    }
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('assertiq_user') || 'null');
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getSession();
  }
};

export default apiRequest;