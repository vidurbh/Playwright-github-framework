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
    console.log("OWNER:", process.env.GITHUB_OWNER);
    console.log("REPO:", process.env.GITHUB_REPO);
    console.log("WORKFLOW_ID:", WORKFLOW_ID);
    console.log("TOKEN EXISTS:", !!process.env.GITHUB_TOKEN);

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

/* ---------------- TEST RUNS FROM SUPABASE ---------------- */

app.get('/test-runs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('test_runs')
      .select('*')
      .order('id', { ascending: false })
      .limit(10);

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
    const { model, prompt } = req.body;

    // Auto-generate a title from the prompt
    const title = prompt
      ? prompt.slice(0, 80) + (prompt.length > 80 ? '...' : '')
      : 'New Session';

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([{ model, prompt, title, status: 'active' }])
      .select();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, session: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- LIST SESSIONS ---------- */

app.get('/sessions', async (req, res) => {
  try {
    const { search, model } = req.query;

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