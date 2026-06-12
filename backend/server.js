require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const supabase = require('./supabase');

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

/* ---------------- HEALTH CHECK ---------------- */

app.get('/', (req, res) => {
  res.json({ status: 'Backend running' });
});

/* ---------------- TRIGGER GITHUB WORKFLOW ---------------- */

app.post('/trigger-tests', async (req, res) => {
  try {
    const { org_id } = req.body;
    console.log("OWNER:", process.env.GITHUB_OWNER);
    console.log("REPO:", process.env.GITHUB_REPO);
    console.log("WORKFLOW_ID:", WORKFLOW_ID);
    console.log("TOKEN EXISTS:", !!process.env.GITHUB_TOKEN);
    console.log("ORG_ID:", org_id);

    // Save a pending run with org_id BEFORE triggering
    // This way parse-results can look it up later
    const pendingRunData = {
      status: 'triggered',
      triggered_at: new Date().toISOString()
    };
    if (org_id) {
      pendingRunData.org_id = org_id;
    }
    const { data: pendingRun, error: pendingError } = await supabase
      .from('test_runs')
      .insert([pendingRunData])
      .select();

    if (pendingError) {
      console.error('Pending run save error:', pendingError.message);
    } else {
      console.log('✅ Pending run saved with id:', pendingRun?.[0]?.id, 'org_id:', org_id);
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
        body: JSON.stringify({
          ref: 'main'
        })
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

    let query = supabase
      .from('orgs')
      .select('*')
      .order('id', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, orgs: data });
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

/* ---------- CREATE ORG ---------- */

app.post('/orgs', async (req, res) => {
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

/* ---------- UPDATE ORG ---------- */

app.patch('/orgs/:id', async (req, res) => {
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

/* ---------- DELETE ORG ---------- */

app.delete('/orgs/:id', async (req, res) => {
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

/* ---------------- TEST RUNS FROM SUPABASE ---------------- */

app.get('/test-runs', async (req, res) => {
  try {
    const { org_id } = req.query;

    // Reconciliation: find any pending "triggered" runs and try to match them
    // with orphaned completed runs (inserted by CI without org_id).
    // This handles the case where CI runs old code that doesn't include org_id.
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

              // Delete the pending triggered marker
              await supabase
                .from('test_runs')
                .delete()
                .eq('id', pending.id);

              console.log(`🔄 Reconciled run ${orphan.id} -> org ${pending.org_id}`);
            }
          }
        }
      }
    } catch (reconErr) {
      console.error('Reconciliation error:', reconErr.message);
    }

    let query = supabase
      .from('test_runs')
      .select('*')
      .order('id', { ascending: false })
      .limit(10);

    if (org_id) {
      query = query.eq('org_id', org_id);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, runs: data });
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

    // 2. Try to get AI response
    let aiMessage = null;

    try {
      // Fetch previous messages for context
      const { data: history } = await supabase
        .from('session_messages')
        .select('role, content')
        .eq('session_id', id)
        .order('id', { ascending: true });

      // Build conversation history for AI
      const messages = [
        {
          role: 'system',
          content: 'You are AssertIQ, an AI assistant specialized in Playwright test automation, QA testing, and software quality. Help users write tests, debug issues, and improve their testing strategy. Be concise and practical.'
        },
        ...(history || []).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      ];

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.7,
        max_tokens: 2048
      });

      const aiContent = completion.choices[0]?.message?.content || '';

      if (aiContent) {
        // Store AI response
        const { data: aiMsgData, error: aiMsgError } = await supabase
          .from('session_messages')
          .insert([{ session_id: id, content: aiContent, role: 'assistant' }])
          .select();

        if (!aiMsgError) {
          aiMessage = aiMsgData[0];
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