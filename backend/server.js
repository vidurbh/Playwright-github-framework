require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const supabase = require('./supabase');

const WORKFLOW_ID = 259296608;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Backend running' });
});

app.post('/trigger-tests', async (req, res) => {
  try {
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
      const error = await response.text();

      return res.status(500).json({
        success: false,
        error
      });
    }

    res.json({
      success: true,
      message: 'Workflow triggered successfully'
    });

  } catch (err) {
    console.error('Trigger error:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

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

    res.json({
      success: true,
      runs: data
    });

  } catch (err) {
    console.error('Supabase error:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

console.log('TEST RUN ROUTE REGISTERED');

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});