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
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionMessages, setSessionMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchSessions = async () => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/sessions`
    );

    const data = await res.json();

    if (data.success) {
      setSessions(data.sessions);
    }
  };

  const fetchSessionMessages = async (sessionId) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/sessions/${sessionId}/messages`
      );
      const data = await res.json();
      if (data.success) {
        setSessionMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedSession) return;

    try {
      setSendingMessage(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/sessions/${selectedSession.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage.trim(), role: 'user' })
        }
      );

      const data = await res.json();

      if (data.success) {
        setSessionMessages((prev) => [...prev, data.message]);
        setNewMessage('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSessionClick = (session) => {
    setSelectedSession(session);
    fetchSessionMessages(session.id);
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setSessionMessages([]);
    setNewMessage('');
  };

  useEffect(() => {
    fetchRuns();
    fetchSessions();
  }, []);

  const handleCreateSession = async () => {
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

      if (data.success) {
        // Refresh sessions and auto-select the new session
        await fetchSessions();
        setShowSessionModal(false);
        setSessionPrompt('');
        setSelectedSession(data.session);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
          onClick={() => {
            setActiveMenu('qa');
            setSelectedSession(null);
            setSessionMessages([]);
          }}
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
          onClick={() => {
            setActiveMenu('chat');
            setSelectedSession(null);
            setSessionMessages([]);
          }}
          style={{
            padding: '12px',
            cursor: 'pointer',
            borderRadius: '8px',
            background:
              activeMenu === 'chat' ? '#333' : 'transparent'
          }}
        >
          🤖 Chatbot
        </div>

      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '40px',
          display: 'flex',
          flexDirection: 'column'
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

        {activeMenu === 'chat' && !selectedSession && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}
            >
              <h1>🤖 Chatbot</h1>

              <button
                onClick={() => setShowSessionModal(true)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: '#333',
                  color: 'white',
                  fontSize: '14px'
                }}
              >
                + New Session
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <h3 style={{ margin: 0 }}>Sessions</h3>

              {sessions.length === 0 && (
                <p style={{ opacity: 0.6 }}>
                  No sessions yet. Create one to get started.
                </p>
              )}

              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSessionClick(s)}
                  style={{
                    padding: '16px',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = '#555')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = '#333')
                  }
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}
                  >
                    <span
                      style={{
                        background: '#333',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      {s.model}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        opacity: 0.5
                      }}
                    >
                      {new Date(
                        s.created_at
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    {s.prompt.slice(0, 100)}
                    {s.prompt.length > 100 ? '...' : ''}
                  </div>
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      opacity: 0.5,
                      textTransform: 'capitalize'
                    }}
                  >
                    Status: {s.status}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Chat Screen - when a session is selected */}
        {activeMenu === 'chat' && selectedSession && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 80px)'
            }}
          >
            {/* Chat Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #333',
                marginBottom: '16px'
              }}
            >
              <button
                onClick={handleBackToSessions}
                style={{
                  background: 'none',
                  border: '1px solid #444',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ← Back
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>
                  {selectedSession.model} Session
                </h2>
                <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '4px' }}>
                  {selectedSession.prompt.slice(0, 60)}
                  {selectedSession.prompt.length > 60 ? '...' : ''}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingRight: '8px'
              }}
            >
              {sessionMessages.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    opacity: 0.5,
                    marginTop: '40px'
                  }}
                >
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}

              {sessionMessages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '75%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: msg.role === 'user' ? '#2b5278' : '#1e1e1e',
                      border: msg.role === 'user' ? 'none' : '1px solid #333',
                      fontSize: '14px',
                      lineHeight: '1.5'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        opacity: 0.5,
                        marginBottom: '6px',
                        textTransform: 'uppercase'
                      }}
                    >
                      {msg.role}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                    {msg.created_at && (
                      <div
                        style={{
                          fontSize: '11px',
                          opacity: 0.4,
                          marginTop: '8px',
                          textAlign: 'right'
                        }}
                      >
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                paddingTop: '16px',
                borderTop: '1px solid #333',
                marginTop: '16px'
              }}
            >
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your prompt here... (Enter to send, Shift+Enter for new line)"
                rows={2}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  background: '#111',
                  color: 'white',
                  fontSize: '14px',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: newMessage.trim() && !sendingMessage ? 'pointer' : 'not-allowed',
                  background: newMessage.trim() && !sendingMessage ? '#2b5278' : '#333',
                  color: 'white',
                  fontSize: '14px',
                  alignSelf: 'flex-end',
                  opacity: newMessage.trim() && !sendingMessage ? 1 : 0.5
                }}
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
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
                onClick={handleCreateSession}
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