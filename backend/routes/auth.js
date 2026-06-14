/**
 * Auth routes: register, login, google auth, logout, me, profile
 */
const express = require('express');
const router = express.Router();
const { supabaseAdmin, resolveRole } = require('../auth');

// Health check (public)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /auth/google
 * Authenticate with Google ID token (from Google One Tap / Google Identity Services)
 * Body: { id_token }  or  { access_token }
 */
router.post('/google', async (req, res) => {
  try {
    const { id_token, access_token } = req.body;

    if (!id_token && !access_token) {
      return res.status(400).json({
        success: false,
        error: 'Google id_token or access_token is required'
      });
    }

    let authResult;

    if (id_token) {
      // Authenticate with Google ID token via Supabase
      authResult = await supabaseAdmin.auth.signInWithIdToken({
        provider: 'google',
        token: id_token
      });
    } else {
      // Alternative: use the Supabase client-side session
      return res.status(400).json({
        success: false,
        error: 'id_token is required. Use Google Identity Services to get an id_token.'
      });
    }

    const { data, error } = authResult;

    if (error) {
      console.error('Google auth error:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Google authentication failed: ' + error.message
      });
    }

    const user = data.user;

    // Ensure profile exists (created by handle_new_user trigger, but just in case)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      // Create profile manually if trigger didn't fire
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          role: resolveRole(null, user.email)
        });
    }

    // Fetch user's orgs (may be empty — user won't see any content until admin adds them)
    const { data: userOrgs } = await supabaseAdmin
      .from('user_orgs')
      .select('*, org:orgs(*)')
      .eq('user_id', user.id);

    return res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      },
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        role: resolveRole(profile || null, user.email),
        avatar_url: user.user_metadata?.avatar_url || null
      },
      organizations: userOrgs || []
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({
      success: false,
      error: 'Google authentication failed'
    });
  }
});

/**
 * POST /auth/login
 * Authenticate user with email/password
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error.message);

      if (error.message.includes('Invalid login credentials')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Fetch user's orgs
    const { data: userOrgs } = await supabaseAdmin
      .from('user_orgs')
      .select('*, org:orgs(*)')
      .eq('user_id', data.user.id);

    return res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name || data.user.email?.split('@')[0],
        role: resolveRole(profile, data.user.email),
        avatar_url: profile?.avatar_url
      },
      organizations: userOrgs || []
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /auth/logout
 * Invalidate the user's session
 * Requires: Authorization header
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await supabaseAdmin.auth.admin.signOut(token);
    }

    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * GET /auth/me
 * Get the currently authenticated user's profile and orgs
 * Requires: Authorization header
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const token = authHeader.split(' ')[1];

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch user's orgs
    const { data: userOrgs } = await supabaseAdmin
      .from('user_orgs')
      .select('*, org:orgs(*)')
      .eq('user_id', user.id);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.email?.split('@')[0],
        role: resolveRole(profile, user.email),
        avatar_url: profile?.avatar_url
      },
      organizations: userOrgs || []
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh an expired access token
 * Body: { refresh_token }
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    return res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      }
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

module.exports = router;