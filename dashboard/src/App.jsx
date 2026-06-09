import { useEffect, useState } from 'react';

function App() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState([]);
  const [activeMenu, setActiveMenu] = useState('qa');

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionPrompt, setSessionPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('groq');
  const [sessions, setSessions] = useState([]);

  const fetchSessions = async () => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/sessions`
    );

    const data = await res.json();

    if (data.success) {
      setSessions(data.sessions);
    }
  };

  const fetchRuns = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/test-runs`
      );

      const data = await response.json();

      if (data.success) {
        setRuns(data.runs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerTests = async () => {
    try {
      setLoading(true);
      setMessage('');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/trigger-tests`,
        {
          method: 'POST'
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage('✅ Tests triggered successfully');

        setTimeout(() => {
          fetchRuns();
        }, 5000);
      } else {
        setMessage('❌ Failed to trigger tests');
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    fetchSessions();

  }, []);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#0f0f0f',
        color: 'white',
        fontFamily: 'Arial'
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: '250px',
          background: '#181818',
          padding: '20px',
          borderRight: '1px solid #333'
        }}
      >
        <h2>AssertIQ</h2>

        <div
          onClick={() => setActiveMenu('qa')}
          style={{
            padding: '12px',
            cursor: 'pointer',
            borderRadius: '8px',
            background:
              activeMenu === 'qa' ? '#333' : 'transparent',
            marginBottom: '10px'
          }}
        >
          🧪 QA Command Center
        </div>

        <div
          onClick={() => setActiveMenu('chat')}
          style={{
            padding: '12px',
            cursor: 'pointer',
            borderRadius: '8px',
            background:
              activeMenu === 'chat' ? '#333' : 'transparent'
          }}
        >
          🤖 Chatbot
          <div style={{ marginTop: '20px' }}>
            <h3>Sessions</h3>

            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '10px',
                  marginTop: '8px',
                  background: '#222',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <div><b>{s.model}</b></div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  {s.prompt.slice(0, 40)}...
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '40px'
        }}
      >
        {activeMenu === 'qa' && (
          <>
            <h1>🚀 QA Command Center</h1>

            <button
              onClick={triggerTests}
              disabled={loading}
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                marginTop: '20px',
                marginBottom: '20px'
              }}
            >
              {loading
                ? 'Starting...'
                : '▶ Run Playwright Tests'}
            </button>

            {message && <p>{message}</p>}

            <h2>Recent Test Runs</h2>

            <table
              border="1"
              cellPadding="12"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: '20px'
              }}
            >
              <thead>
                <tr>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Total</th>
                  <th>Duration</th>
                  <th>Report</th>
                </tr>
              </thead>

              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.passed}</td>
                    <td>{run.failed}</td>
                    <td>{run.total}</td>
                    <td>{run.duration} ms</td>
                    <td>
                      <a
                        href={run.report_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'cyan' }}
                      >
                        Open Report
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {activeMenu === 'chat' && (
          <>
            <h1>🤖 Chatbot</h1>

            <p>Start AI testing sessions here.</p>

            <button
              onClick={() => setShowSessionModal(true)}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              New Session
            </button>
          </>
        )}
      </div>

      {/* Session Modal */}
      {showSessionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: '#1f1f1f',
              padding: '24px',
              borderRadius: '12px',
              width: '500px',
              border: '1px solid #333'
            }}
          >
            <h2>Create Session</h2>

            <div style={{ marginTop: '20px' }}>
              <label>Prompt</label>

              <textarea
                value={sessionPrompt}
                onChange={(e) =>
                  setSessionPrompt(e.target.value)
                }
                rows={5}
                placeholder="Generate Playwright tests for login page..."
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  background: '#111',
                  color: 'white',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <label>Model</label>

              <select
                value={selectedModel}
                onChange={(e) =>
                  setSelectedModel(e.target.value)
                }
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#111',
                  color: 'white',
                  border: '1px solid #444'
                }}
              >
                <option value="groq">Groq</option>
                <option value="gpt">GPT</option>
                <option value="sonnet">Sonnet</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px'
              }}
            >
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  setSessionPrompt('');
                }}
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `${import.meta.env.VITE_API_URL}/sessions`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          model: selectedModel,
                          prompt: sessionPrompt
                        })
                      }
                    );

                    const data = await res.json();

                    console.log('SESSION CREATED:', data);

                    setShowSessionModal(false);
                    setSessionPrompt('');
                  } catch (err) {
                    console.error(err);
                  }
                }}
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;