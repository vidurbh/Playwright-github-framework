/**
 * Auth Page - Google Sign-In only
 * Uses Google Identity Services for OAuth
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

export default function AuthPage() {
  const { googleSignIn, loading: authLoading } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const googleBtnRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: false
        });
        window.google.accounts.id.renderButton(
          googleBtnRef.current,
          { theme: 'outline', size: 'large', width: 320, text: 'signin_with', shape: 'pill' }
        );
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      const scriptEl = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (scriptEl) document.head.removeChild(scriptEl);
    };
  }, []);

  const handleGoogleResponse = async (response) => {
    if (!response?.credential) {
      setError('Google sign-in failed: no credential received');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await googleSignIn(response.credential);
      if (!result.success) {
        setError(result.error || 'Sign-in failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div className="loading-spinner" />
          <div style={styles.loadingText}>Loading AssertIQ...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.backgroundGlow} />
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoSection}>
          <div style={styles.logoIcon}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <rect width="52" height="52" rx="14" fill="url(#logo-gradient)" />
              <text x="26" y="34" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">🧪</text>
              <defs>
                <linearGradient id="logo-gradient" x1="0" y1="0" x2="52" y2="52">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 style={styles.title}>AssertIQ</h1>
          <p style={styles.subtitle}>AI-Powered Test Automation Platform</p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <div style={styles.buttonSection}>
          <div ref={googleBtnRef} id="google-signin-button" style={styles.googleButton} />
          {submitting && (
            <div style={styles.submittingOverlay}>
              <div className="loading-spinner small" />
              <span style={{ fontSize: '14px', color: '#888' }}>Signing in...</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>secure access</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Sign in with your Google account to access AssertIQ.
          </p>
          <p style={styles.footerHint}>
            Only authorized users can access this platform.
          </p>
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
    background: '#0a0a0f',
    color: 'white',
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    padding: '20px',
    position: 'relative',
    overflow: 'hidden'
  },
  backgroundGlow: {
    position: 'absolute',
    top: '20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
    pointerEvents: 'none'
  },
  loadingContainer: {
    textAlign: 'center'
  },
  loadingText: {
    marginTop: '16px',
    color: '#888',
    fontSize: '15px',
    letterSpacing: '0.3px'
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#121218',
    borderRadius: '20px',
    border: '1px solid #1e1e2a',
    padding: '48px 36px',
    boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
    position: 'relative',
    backdropFilter: 'blur(10px)'
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '36px'
  },
  logoIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px'
  },
  title: {
    fontSize: '30px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
    fontWeight: 400
  },
  errorBox: {
    padding: '12px 16px',
    background: '#1a0f0f',
    border: '1px solid rgba(255,68,68,0.2)',
    borderRadius: '10px',
    color: '#ff6b6b',
    fontSize: '14px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  buttonSection: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '28px',
    minHeight: '50px'
  },
  googleButton: {
    display: 'flex',
    justifyContent: 'center'
  },
  submittingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: 'rgba(18,18,24,0.8)',
    borderRadius: '12px'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#1e1e2a'
  },
  dividerText: {
    fontSize: '11px',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    fontWeight: 600
  },
  footer: {
    textAlign: 'center'
  },
  footerText: {
    margin: '0 0 6px 0',
    fontSize: '13px',
    color: '#64748b',
    lineHeight: '1.5'
  },
  footerHint: {
    margin: 0,
    fontSize: '12px',
    color: '#475569'
  }
};