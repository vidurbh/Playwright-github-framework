const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const supabase = require('./supabase');
const { authenticate } = require('./auth');
const github = require('./github');
const { generateScaffold } = require('./scaffold-repo');

const WORKFLOW_ID = 259296608;

/* ---------------- GROQ AI CLIENT (OpenAI-compatible) ---------------- */

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'gsk_your_groq_api_key_here',
  baseURL: 'https://api.groq.com/openai/v1'
});

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Auth middleware - runs on all routes except public ones
app.use(authenticate);

/* ---------------- PUBLIC ROUTES ---------------- */

app.get('/', (req, res) => {
  res.json({ status: 'AssertIQ Backend', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ---------------- AUTH ROUTES ---------------- */

const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

/* ---------------- TRIGGER GITHUB WORKFLOW ---------------- */

app.post('/trigger-tests', async (req, res) => {
  try {
    const { org_id } = req.body;
    console.log("OWNER:", process.env.GITHUB_OWNER);
    console.log("REPO:", process.env.GITHUB_REPO);
    console.log("WORKFLOW_ID:", WORKFLOW_ID);
    console.log("TOKEN EXISTS:", !!process.env.GITHUB_TOKEN);
    console.log("ORG_ID:", org_id);

    // If no org_id provided, resolve to the default org's DB id
    // The SQL migration assigned all existing runs to the default org, so
    // "Default Org" in the UI maps to the default org's actual DB id.
    let resolvedOrgId = org_id;
    if (!resolvedOrgId) {
      const { data: defaultOrg } = await supabase
        .from('orgs')
        .select('id')
        .eq('slug', 'default')
        .single();
      if (defaultOrg) {
        resolvedOrgId = defaultOrg.id;
      }
    }

    // Save a pending run with org_id BEFORE triggering
    // This way parse-results can look it up later
    const pendingRunData = {
      status: 'triggered',
      triggered_at: new Date().toISOString()
    };
    if (resolvedOrgId) {
      pendingRunData.org_id = resolvedOrgId;
    }
    const { data: pendingRun, error: pendingError } = await supabase
      .from('test_runs')
      .insert([pendingRunData])
      .select();

    if (pendingError) {
      console.error('Pending run save error:', pendingError.message);
    } else {
      console.log('✅ Pending run saved with id:', pendingRun?.[0]?.id, 'org_id:', resolvedOrgId);
    }

    // Pass org_id as workflow input so parse-results receives ORG_ID env var
    const dispatchBody = {
      ref: 'main'
    };
    if (resolvedOrgId) {
      dispatchBody.inputs = { org_id: String(resolvedOrgId) };
    }

    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dispatchBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ success: false, error: errorText });
    }

    return res.json({ success: true, message: 'Workflow triggered successfully' });
  } catch (err) {
    console.error('Trigger error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================
   ORGS MANAGEMENT (Admin Panel)
   ================================================================ */

/* ---------- LIST ORGS ---------- */

app.get('/orgs', async (req, res) => {
  try {
    const { search } = req.query;
    const isAdmin = req.profile?.role === 'admin';
    const userId = req.user.id;

    let query;

    if (isAdmin) {
      // Admin sees all orgs
      query = supabase
        .from('orgs')
        .select('*')
        .order('id', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,email.ilike.%${search}%`);
      }
    } else {
      // Regular users only see orgs they belong to
      query = supabase
        .from('user_orgs')
        .select('org:orgs(*)')
        .eq('user_id', userId);

      if (search) {
        query = query.ilike('org.name', `%${search}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // For non-admin users, extract orgs from the join
    const orgs = isAdmin ? data : data.map(uo => uo.org).filter(Boolean);

    res.json({ success: true, orgs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- GET SINGLE ORG ---------- */

app.get('/orgs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('orgs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, org: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- CREATE ORG (admin only) ---------- */

app.post('/orgs', async (req, res) => {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  try {
    const { name, slug, email, plan, status } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, error: 'Name and slug are required' });
    }

    const { data, error } = await supabase
      .from('orgs')
      .insert([{ name, slug, email, plan: plan || 'free', status: status || 'active' }])
      .select();

    if (error) {
      // Handle unique slug violation
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'An org with this slug already exists' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, org: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- UPDATE ORG (admin only) ---------- */

app.patch('/orgs/:id', async (req, res) => {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  try {
    const { id } = req.params;
    const { name, slug, email, plan, status } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (email !== undefined) updateData.email = email;
    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('orgs')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'An org with this slug already exists' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, org: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- DELETE ORG (admin only) ---------- */

app.delete('/orgs/:id', async (req, res) => {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  try {
    const { id } = req.params;

    // Check if it's the default org (prevent deletion)
    const { data: org } = await supabase
      .from('orgs')
      .select('slug')
      .eq('id', id)
      .single();

    if (org && org.slug === 'default') {
      return res.status(400).json({ success: false, error: 'Cannot delete the default org' });
    }

    // Update orphaned sessions and test_runs to default org
    const { data: defaultOrg } = await supabase
      .from('orgs')
      .select('id')
      .eq('slug', 'default')
      .single();

    if (defaultOrg) {
      await supabase
        .from('chat_sessions')
        .update({ org_id: defaultOrg.id })
        .eq('org_id', id);

      await supabase
        .from('test_runs')
        .update({ org_id: defaultOrg.id })
        .eq('org_id', id);
    }

    const { error } = await supabase
      .from('orgs')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Org deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- GET ORG STATS (session count, test run count) ---------- */

app.get('/orgs/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [sessionCount, testRunCount, activeSessions] = await Promise.all([
      supabase
        .from('chat_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', id),
      supabase
        .from('test_runs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', id),
      supabase
        .from('chat_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', id)
        .eq('status', 'active')
    ]);

    res.json({
      success: true,
      stats: {
        session_count: sessionCount.count || 0,
        test_run_count: testRunCount.count || 0,
        active_sessions: activeSessions.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================
   MEMBER MANAGEMENT (Admin only)
   ================================================================ */

/* ---------- LIST PENDING USERS (users without any org) ---------- */

app.get('/users/pending', async (req, res) => {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  try {
    // Find users who have no entries in user_orgs
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        role,
        created_at
      `)
      .not('id', 'in', (
        supabase
          .from('user_orgs')
          .select('user_id')
      ));

    if (error) {
      // Fallback: use a simpler query since 'not in' with subquery may not work in all Supabase versions
      // Get all profiles and all memberships, then filter client-side
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false });

      const { data: allMemberships } = await supabase
        .from('user_orgs')
        .select('user_id');

      const memberUserIds = new Set((allMemberships || []).map(m => m.user_id));
      const pendingUsers = (allProfiles || []).filter(p => !memberUserIds.has(p.id));

      return res.json({ success: true, users: pendingUsers });
    }

    res.json({ success: true, users: data || [] });
  } catch (err) {
    // Final fallback: separate queries
    try {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false });

      const { data: allMemberships } = await supabase
        .from('user_orgs')
        .select('user_id');

      const memberUserIds = new Set((allMemberships || []).map(m => m.user_id));
      const pendingUsers = (allProfiles || []).filter(p => !memberUserIds.has(p.id));

      return res.json({ success: true, users: pendingUsers });
    } catch (fallbackErr) {
      return res.status(500).json({ success: false, error: fallbackErr.message });
    }
  }
});

/* ---------- LIST ORG MEMBERS ---------- */

app.get('/orgs/:id/members', async (req, res) => {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('user_orgs')
      .select('id, user_id, role, created_at, profile:profiles(id, email, full_name)')
      .eq('org_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, members: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- ADD USER TO ORG ---------- */

app.post('/orgs/:id/members', async (req, res) => {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  try {
    const { id } = req.params;
    const { user_id, role } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('user_orgs')
      .select('id')
      .eq('user_id', user_id)
      .eq('org_id', id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ success: false, error: 'User is already a member of this organization' });
    }

    const { data, error } = await supabase
      .from('user_orgs')
      .insert([{
        user_id,
        org_id: parseInt(id),
        role: role || 'member'
      }])
      .select('id, user_id, role, profile:profiles(id, email, full_name)');

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, member: data[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- REMOVE USER FROM ORG ---------- */

app.delete('/orgs/:id/members/:userId', async (req, res) => {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  try {
    const { id, userId } = req.params;

    const { error } = await supabase
      .from('user_orgs')
      .delete()
      .eq('org_id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Member removed from organization' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------------- TEST RUNS FROM SUPABASE ---------------- */

app.get('/test-runs', async (req, res) => {
  try {
    const { org_id, page: pageStr, limit: limitStr } = req.query;
    const page = Math.max(1, parseInt(pageStr, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 10));
    const offset = (page - 1) * limit;

    const isAdmin = req.profile?.role === 'admin';
    const userId = req.user.id;

    // Resolve which org(s) the user has access to
    let accessibleOrgIds = null; // null = admin can access all

    if (!isAdmin) {
      // Non-admin users: fetch their org memberships
      const { data: memberships } = await supabase
        .from('user_orgs')
        .select('org_id')
        .eq('user_id', userId);

      if (!memberships || memberships.length === 0) {
        return res.json({
          success: true,
          runs: [],
          total: 0,
          page,
          limit,
          totalPages: 0
        });
      }

      accessibleOrgIds = memberships.map(m => m.org_id);

      // If a specific org_id is requested, verify the user belongs to it
      if (org_id) {
        const requestedOrgId = parseInt(org_id, 10);
        if (!accessibleOrgIds.includes(requestedOrgId)) {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to this organization\'s test runs'
          });
        }
      }
    }

    // Reconciliation: find any pending "triggered" runs and try to match them
    // with orphaned completed runs (inserted by CI without org_id).
    // This handles the case where CI runs old code that doesn't include org_id.
    // NOTE: We do NOT delete pending runs here, because CI's parse-results may
    // still need to find them. Instead, we just update orphan runs' org_id.
    try {
      const { data: pendingRuns } = await supabase
        .from('test_runs')
        .select('id, org_id')
        .eq('status', 'triggered')
        .order('id', { ascending: false });

      if (pendingRuns && pendingRuns.length > 0) {
        // Find orphaned completed runs (have passed/failed stats but no org_id)
        const { data: orphanRuns } = await supabase
          .from('test_runs')
          .select('id')
          .is('org_id', null)
          .not('passed', 'is', null)
          .order('id', { ascending: false });

        if (orphanRuns && orphanRuns.length > 0) {
          // Match pending runs to orphan runs by order (most recent pending -> most recent orphan)
          for (let i = 0; i < Math.min(pendingRuns.length, orphanRuns.length); i++) {
            const pending = pendingRuns[i];
            const orphan = orphanRuns[i];

            if (pending.org_id) {
              await supabase
                .from('test_runs')
                .update({ org_id: pending.org_id })
                .eq('id', orphan.id);

              console.log(`🔄 Reconciled run ${orphan.id} -> org ${pending.org_id}`);
            }
          }
        }
      }
    } catch (reconErr) {
      console.error('Reconciliation error:', reconErr.message);
    }

    // Resolve org_id: if no org_id specified, determine scope based on user role
    let resolvedOrgId = org_id;
    if (!resolvedOrgId) {
      if (!isAdmin && accessibleOrgIds) {
        // Non-admin users see runs from ALL orgs they belong to
        // Skip resolving to default org — use their membership list instead
        const { data: defaultOrg } = await supabase
          .from('orgs')
          .select('id')
          .eq('slug', 'default')
          .single();
        if (defaultOrg && accessibleOrgIds.includes(defaultOrg.id)) {
          // User is member of default org, resolve to that (preserves existing behavior)
          resolvedOrgId = defaultOrg.id;
        }
        // If user is NOT a member of default org, leave resolvedOrgId null
        // and filter by their accessible orgs below
      } else {
        // Admin or no org context: resolve to the default org's db id
        // This is because the SQL migration assigned all existing runs to the default org's id.
        const { data: defaultOrg } = await supabase
          .from('orgs')
          .select('id')
          .eq('slug', 'default')
          .single();
        if (defaultOrg) {
          resolvedOrgId = defaultOrg.id;
        }
      }
    }

    // Build query for count
    let countQuery = supabase
      .from('test_runs')
      .select('id', { count: 'exact', head: true });

    // Build query for data
    let dataQuery = supabase
      .from('test_runs')
      .select('*')
      .order('id', { ascending: false });

    if (resolvedOrgId) {
      // Filter to a specific org (including default)
      countQuery = countQuery.eq('org_id', resolvedOrgId);
      dataQuery = dataQuery.eq('org_id', resolvedOrgId);
    } else if (!isAdmin && accessibleOrgIds) {
      // Non-admin without explicit org: show runs from all their accessible orgs
      countQuery = countQuery.in('org_id', accessibleOrgIds);
      dataQuery = dataQuery.in('org_id', accessibleOrgIds);
    } else {
      // Fallback: only show runs without any org_id
      countQuery = countQuery.is('org_id', null);
      dataQuery = dataQuery.is('org_id', null);
    }

    // Apply pagination to data query
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    // Execute both queries
    const [{ count: total }, { data, error }] = await Promise.all([
      countQuery,
      dataQuery
    ]);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const totalPages = Math.ceil((total || 0) / limit);

    return res.json({
      success: true,
      runs: data || [],
      total: total || 0,
      page,
      limit,
      totalPages
    });
  } catch (err) {
    console.error('Supabase error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------------- DEBUG WORKFLOWS ---------------- */

app.get('/debug-workflows', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/actions/workflows`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json'
        }
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================
   SESSION MANAGEMENT (CRUD + AI)
   ================================================================ */

/* ---------- CREATE SESSION ---------- */

app.post('/sessions', async (req, res) => {
  try {
    const { model, prompt, org_id } = req.body;

    // Auto-generate a title from the prompt
    const title = prompt
      ? prompt.slice(0, 80) + (prompt.length > 80 ? '...' : '')
      : 'New Session';

    const insertData = { model, prompt, title, status: 'active' };
    if (org_id) {
      insertData.org_id = org_id;
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([insertData])
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const session = data[0];

    // If a prompt was provided, save it as the first user message and get AI response
    let userMessage = null;
    let aiMessage = null;

    if (prompt && prompt.trim()) {
      // 1. Save the prompt as the first user message
      const { data: userMsgData, error: userMsgError } = await supabase
        .from('session_messages')
        .insert([{ session_id: session.id, content: prompt.trim(), role: 'user' }])
        .select();

      if (!userMsgError) {
        userMessage = userMsgData[0];
      }

      // 2. Try to get AI response
      try {
        const messages = [
          {
            role: 'system',
            content: 'You are AssertIQ, an AI assistant specialized in Playwright test automation, QA testing, and software quality. Help users write tests, debug issues, and improve their testing strategy. Be concise and practical.'
          },
          { role: 'user', content: prompt.trim() }
        ];

        const completion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages,
          temperature: 0.7,
          max_tokens: 2048
        });

        const aiContent = completion.choices[0]?.message?.content || '';

        if (aiContent) {
          const { data: aiMsgData, error: aiMsgError } = await supabase
            .from('session_messages')
            .insert([{ session_id: session.id, content: aiContent, role: 'assistant' }])
            .select();

          if (!aiMsgError) {
            aiMessage = aiMsgData[0];
          }
        }
      } catch (aiErr) {
        console.error('AI generation error during session creation:', aiErr.message);
      }
    }

    res.json({
      success: true,
      session,
      userMessage,
      aiMessage
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- LIST SESSIONS ---------- */

app.get('/sessions', async (req, res) => {
  try {
    const { search, model, org_id } = req.query;

    let query = supabase
      .from('chat_sessions')
      .select('*')
      .order('id', { ascending: false });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (model) {
      query = query.eq('model', model);
    }
    if (org_id) {
      query = query.eq('org_id', org_id);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, sessions: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- GET SINGLE SESSION ---------- */

app.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, session: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- UPDATE SESSION (rename, status) ---------- */

app.patch('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status, model } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (model !== undefined) updateData.model = model;

    const { data, error } = await supabase
      .from('chat_sessions')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, session: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- DELETE SESSION (and cascade messages) ---------- */

app.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete messages first
    await supabase
      .from('session_messages')
      .delete()
      .eq('session_id', id);

    // Delete session
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================
   MESSAGE MANAGEMENT
   ================================================================ */

/* ---------- GET MESSAGES FOR A SESSION ---------- */

app.get('/sessions/:id/messages', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', id)
      .order('id', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, messages: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- SEND MESSAGE + GET AI RESPONSE ---------- */

/**
 * Tool definitions for Groq AI function calling
 */
const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_org_repo',
      description: 'Create a new private GitHub repository for an organization with a Playwright test suite scaffolded. The repo will contain a full Playwright automation framework with CI/CD, page objects, fixtures, API helpers, and sample tests.',
      parameters: {
        type: 'object',
        properties: {
          repo_name: {
            type: 'string',
            description: 'Name of the GitHub repository to create (e.g. "acme-corp-test-suite"). Auto-generate from the org slug if not provided.'
          },
          org_name: {
            type: 'string',
            description: 'The organization name (e.g. "Acme Corp") used for README and package.json'
          },
          org_slug: {
            type: 'string',
            description: 'The organization slug used for naming (e.g. "acme-corp")'
          },
          description: {
            type: 'string',
            description: 'Description for the GitHub repository'
          }
        },
        required: ['org_name', 'org_slug']
      }
    }
  }
];

/**
 * Execute the create_org_repo tool: create repo, scaffold files, create PR
 */
async function executeCreateOrgRepo(args) {
  const { repo_name, org_name, org_slug, description } = args;
  const actualRepoName = repo_name || `${org_slug}-test-suite`;
  const repoDescription = description || `Playwright Test Suite for ${org_name}`;

  console.log(`🛠️ Creating repo "${actualRepoName}" for org "${org_name}"...`);

  // 1. Create the private repo
  const repo = await github.createRepo(actualRepoName, repoDescription);
  const { owner, repo: repoName, htmlUrl } = repo;

  // 2. Generate scaffold files
  const { files, branch } = generateScaffold(org_name, org_slug);
  console.log(`📦 Generated ${files.length} scaffold files for branch "${branch}"`);

  // 3. Create a branch from main (repo auto-inits with main branch after first commit)
  // We need to create an initial commit first, then branch
  // Strategy: create the initial commit on main, then branch off
  const defaultBranch = await github.getDefaultBranch(owner, repoName);

  // 4. Create a feature branch
  const featureBranch = `${branch}`;
  await github.createBranch(owner, repoName, featureBranch, defaultBranch);

  // 5. Push all scaffold files to the feature branch
  for (const file of files) {
    await github.createOrUpdateFile(
      owner, repoName, file.path, file.content, file.message, featureBranch
    );
  }

  // 6. Create a Pull Request
  const prTitle = `feat: add Playwright test suite for ${org_name}`;
  const prBody = `## 🚀 Automated Test Suite Setup

This PR sets up a complete Playwright automation framework for **${org_name}**.

### What's included:

- ✅ Playwright configuration with Chromium, Firefox, and WebKit
- ✅ Page Object Model pattern
- ✅ Test fixtures for dependency injection
- ✅ API helper layer
- ✅ Example tests
- ✅ TypeScript configuration
- ✅ GitHub Actions CI/CD pipeline
- ✅ Project documentation

### Getting Started

\`\`\`bash
npm install
npx playwright install
npx playwright test
\`\`\`

### CI/CD

Tests run automatically on every push to main/master via GitHub Actions.
`;
  const pr = await github.createPullRequest(
    owner, repoName, prTitle, prBody, featureBranch, defaultBranch
  );

  // Return a summary for the AI to present to the user
  const summaryLines = [
    `✅ **Repository created**: [${owner}/${repoName}](${htmlUrl})`,
    `📂 **Branch**: \`${featureBranch}\``,
    `🔀 **Pull Request**: [#${pr.number}](${pr.url})`,
    ``,
    `The PR contains ${files.length} files setting up a complete Playwright automation framework.`,
    `Once merged, tests will automatically run via GitHub Actions on every push.`
  ];

  return {
    success: true,
    summary: summaryLines.join('\n'),
    repo: { owner, name: repoName, url: htmlUrl },
    pullRequest: { number: pr.number, url: pr.url },
    filesCreated: files.length
  };
}

app.post('/sessions/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { content, role } = req.body;

  try {
    // 1. Store user message
    const { data: userMsgData, error: userMsgError } = await supabase
      .from('session_messages')
      .insert([{ session_id: id, content, role: role || 'user' }])
      .select();

    if (userMsgError) {
      return res.status(500).json({ success: false, error: userMsgError.message });
    }

    const userMessage = userMsgData[0];

    // 2. Try to get AI response (with tool support)
    let aiMessage = null;

    try {
      // Fetch previous messages for context
      const { data: history } = await supabase
        .from('session_messages')
        .select('role, content')
        .eq('session_id', id)
        .order('id', { ascending: true });

      // Fetch session to get org context
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('id, org_id')
        .eq('id', id)
        .single();

      let orgContext = '';
      if (sessionData?.org_id) {
        const { data: orgData } = await supabase
          .from('orgs')
          .select('name, slug')
          .eq('id', sessionData.org_id)
          .single();
        if (orgData) {
          orgContext = `\nThe current organization context is: Name="${orgData.name}", Slug="${orgData.slug}". When the user asks to create a repo, use this org context.`;
        }
      }

      // Build conversation history for AI
      const messages = [
        {
          role: 'system',
          content: 'You are AssertIQ, an AI assistant specialized in Playwright test automation, QA testing, and software quality. Help users write tests, debug issues, and improve their testing strategy. Be concise and practical.' +
            ' You have the ability to create GitHub repositories with a full Playwright test suite scaffold.' +
            ' When the user asks to create a repo, use the `create_org_repo` tool.' +
            orgContext
        },
        ...(history || []).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      ];

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 4096
      });

      const responseMessage = completion.choices[0]?.message;

      // Check if AI wants to call a tool
      if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
        // Process each tool call
        const toolResults = [];

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.function.name === 'create_org_repo') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await executeCreateOrgRepo(args);

              // Save the tool result as a message so the AI can see it in history
              if (result.success) {
                await supabase
                  .from('session_messages')
                  .insert([{
                    session_id: id,
                    content: `[System] create_org_repo executed successfully:\n${result.summary}`,
                    role: 'system'
                  }]);
              }

              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });
            } catch (err) {
              console.error('Tool execution error:', err);
              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: err.message
                })
              });
            }
          }
        }

        // Now send the tool results back to Groq for a natural language summary
        const followUpMessages = [
          ...messages,
          responseMessage,
          ...toolResults
        ];

        const followUpCompletion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: followUpMessages,
          temperature: 0.7,
          max_tokens: 2048
        });

        const finalContent = followUpCompletion.choices[0]?.message?.content || '';

        if (finalContent) {
          const { data: aiMsgData, error: aiMsgError } = await supabase
            .from('session_messages')
            .insert([{ session_id: id, content: finalContent, role: 'assistant' }])
            .select();

          if (!aiMsgError) {
            aiMessage = aiMsgData[0];
          }
        }

        // Update session status
        await supabase
          .from('chat_sessions')
          .update({ status: 'active' })
          .eq('id', id);
      } else {
        // No tool calls — normal text response
        const aiContent = responseMessage?.content || '';

        if (aiContent) {
          const { data: aiMsgData, error: aiMsgError } = await supabase
            .from('session_messages')
            .insert([{ session_id: id, content: aiContent, role: 'assistant' }])
            .select();

          if (!aiMsgError) {
            aiMessage = aiMsgData[0];
          }
        }

        // Update session status
        await supabase
          .from('chat_sessions')
          .update({ status: 'active' })
          .eq('id', id);
      }
    } catch (aiErr) {
      console.error('AI generation error:', aiErr.message);
      // Don't fail the request - user message was saved
    }

    // 3. Return both messages
    res.json({
      success: true,
      message: userMessage,
      aiMessage: aiMessage || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- DELETE A SINGLE MESSAGE ---------- */

app.delete('/sessions/:id/messages/:msgId', async (req, res) => {
  try {
    const { id, msgId } = req.params;

    const { error } = await supabase
      .from('session_messages')
      .delete()
      .eq('id', msgId)
      .eq('session_id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================
   START SERVER
   ================================================================ */

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});