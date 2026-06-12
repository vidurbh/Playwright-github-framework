/**
 * Auth middleware for Express
 * Verifies Supabase JWT tokens and attaches user to request
 */
const { createClient } = require('@supabase/supabase-js');

// Create a Supabase admin client (uses service_role key for auth verification)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  { method: 'POST', path: '/auth/register' },
  { method: 'POST', path: '/auth/login' },
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/health' }
];

/**
 * Middleware to verify JWT from Authorization header
 */
async function authenticate(req, res, next) {
  // Check if route is public
  const isPublic = PUBLIC_ROUTES.some(
    (route) => route.method === req.method && route.path === req.path
  );

  if (isPublic) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Missing or invalid authorization header' 
      });
    }

    const token = authHeader.split(' ')[1];

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('Auth verification failed:', error?.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    // Attach user to request
    req.user = user;

    // Also fetch profile data
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    req.profile = profile || null;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
}

/**
 * Middleware to check if user has admin role
 */
function requireAdmin(req, res, next) {
  if (!req.profile || req.profile.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }
  next();
}

/**
 * Middleware to check if user has access to a specific org
 */
async function requireOrgAccess(req, res, next) {
  const orgId = req.params.id || req.params.orgId || req.query.org_id || req.body.org_id;

  if (!orgId) {
    return next(); // No org specified, continue
  }

  try {
    // Admin users have access to all orgs
    if (req.profile?.role === 'admin') {
      return next();
    }

    // Check if user has a membership to this org
    const { data: membership } = await supabaseAdmin
      .from('user_orgs')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('org_id', orgId)
      .single();

    if (!membership) {
      return res.status(403).json({ 
        success: false, 
        error: 'You do not have access to this organization' 
      });
    }

    req.orgMembership = membership;
    next();
  } catch (err) {
    console.error('Org access check error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Error checking org access' 
    });
  }
}

/**
 * Create a Supabase client with the user's JWT for user-scoped queries
 * (uses the anon key + the user's token)
 */
function getUserClient(req) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}`
        }
      }
    }
  );
}

module.exports = {
  authenticate,
  requireAdmin,
  requireOrgAccess,
  getUserClient,
  supabaseAdmin
};