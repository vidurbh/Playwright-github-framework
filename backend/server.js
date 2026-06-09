require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const supabase = require('./supabase');

const WORKFLOW_ID = 259296608;

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    console.log("TOKEN LENGTH:", process.env.GITHUB_TOKEN?.length);
    console.log(
      "TOKEN PREFIX:",
      process.env.GITHUB_TOKEN?.substring(0, 10)
    );
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

      console.log("GITHUB STATUS:", response.status);
      console.log("GITHUB ERROR:", errorText);

      return res.status(500).json({
        success: false,
        error: errorText
      });
    }

    return res.json({
      success: true,
      message: 'Workflow triggered successfully'
    });

  } catch (err) {
    console.error('Trigger error:', err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
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
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      runs: data
    });

  } catch (err) {
    console.error('Supabase error:', err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ---------------- DEBUG WORKFLOWS ---------------- */

app.get('/debug-workflows', async (req, res) => {
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
});

/* ---------------- START SERVER ---------------- */

console.log('TEST RUN ROUTE REGISTERED');

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});