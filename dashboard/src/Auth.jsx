/**
 * Auth Page - Login & Signup
 * Toggles between Login and Register modes
 */
import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function AuthPage() {
  const { login, register, loading: authLoading } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      setError('Full name is required');
      return;
    }

    setSubmitting(true);
    try {
      let result;
      if (mode === 'login') {
        result = await login(email.trim(), password);
      } else {
        result = await register(email.trim(), password, fullName.trim());
      }

      if (!result.success) {
        setError(result.error || 'Something went wrong');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧪</div>
          <div style={{ color: '#888', fontSize: '16px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoSection}>
          <span style={{ fontSize: '48px' }}>🧪</span>
          <h1 style={styles.title}>AssertIQ</h1>
          <p style={styles.subtitle}>
            {mode === 'login' 
              ? 'Sign in to your account' 
              : 'Create a new account'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorBox}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                style={styles.input}
                autoFocus
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={styles.input}
              autoFocus={mode === 'login'}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
            />
            {mode === 'register' && (
              <span style={styles.hint}>At least 6 characters</span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.button,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting 
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...') 
              : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={styles.toggleSection}>
          <span style={{ opacity: 0.6 }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </span>
          <button
            onClick={switchMode}
            style={styles.linkButton}
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#0f0f0f',
    color: 'white',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    padding: '20px'
  },
  loadingContainer: {
    textAlign: 'center'
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#181818',
    borderRadius: '16px',
    border: '1px solid #2a2a2a',
    padding: '40px 36px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '8px 0 4px 0'
  },
  subtitle: {
    fontSize: '14px',
    opacity: 0.5,
    margin: 0
  },
  errorBox: {
    padding: '12px 16px',
    background: '#3a1a1a',
    border: '1px solid #ff444444',
    borderRadius: '8px',
    color: '#ff6b6b',
    fontSize: '14px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.6
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#111',
    color: 'white',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s'
  },
  hint: {
    fontSize: '11px',
    opacity: 0.4,
    marginTop: '2px'
  },
  button: {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: 'white',
    fontWeight: 600,
    fontSize: '15px',
    marginTop: '8px',
    transition: 'all 0.2s'
  },
  toggleSection: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '14px',
    display: 'flex',
    justifyContent: 'center',
    gap: '6px'
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    padding: 0,
    textDecoration: 'underline'
  }
};