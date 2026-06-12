/**
 * Auth routes: register, login, logout, me, profile
 */
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../auth');

// Health check (public)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /auth/register
 * Create a new user account via Supabase Auth
 * Body: { email, password, full_name? }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email.split('@')[0] }
    });

    if (error) {
      console.error('Registration error:', error.message);

      if (error.message.includes('already registered')) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists'
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // Profile is auto-created by the database trigger (handle_new_user)
    // Sign them in to get a token
    const { data: signInData, error: signInError } = 
      await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

    if (signInError) {
      // User was created but sign-in failed - still return success
      return res.status(201).json({
        success: true,
        message: 'Account created. Please sign in.',
        user: {
          id: data.user.id,
          email: data.user.email
        }
      });
    }

    // Auto-join the default org for new users
    try {
      const { data: defaultOrg } = await supabaseAdmin
        .from('orgs')
        .select('id')
        .eq('slug', 'default')
        .single();

      if (defaultOrg) {
        // Check if already a member
        const { data: existingMembership } = await supabaseAdmin
          .from('user_orgs')
          .select('id')
          .eq('user_id', data.user.id)
          .eq('org_id', defaultOrg.id)
          .maybeSingle();

        if (!existingMembership) {
          await supabaseAdmin
            .from('user_orgs')
            .insert({
              user_id: data.user.id,
              org_id: defaultOrg.id,
              role: 'member'
            });
        }
      }
    } catch (orgErr) {
      console.error('Auto-join default org error:', orgErr.message);
      // Non-critical, don't fail registration
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_in: signInData.session.expires_in
      },
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        full_name: full_name || email.split('@')[0]
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
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
        role: profile?.role || 'member',
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
        role: profile?.role || 'member',
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