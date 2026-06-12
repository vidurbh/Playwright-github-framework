import { useEffect, useState, useRef, useCallback } from 'react';

/* ---------- Simple Markdown Renderer ---------- */
function MarkdownRenderer({ content }) {
  if (!content) return null;

  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        // Check if it's a code block
        const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
        if (codeMatch) {
          const [, lang, code] = codeMatch;
          return (
            <div
              key={i}
              style={{
                background: '#0d0d0d',
                borderRadius: '8px',
                border: '1px solid #333',
                margin: '8px 0',
                overflow: 'hidden'
              }}
            >
              {lang && (
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: '11px',
                    color: '#888',
                    background: '#1a1a1a',
                    borderBottom: '1px solid #333',
                    textTransform: 'uppercase'
                  }}
                >
                  {lang}
                </div>
              )}
              <pre
                style={{
                  padding: '12px',
                  margin: 0,
                  overflow: 'auto',
                  fontSize: '13px',
                  lineHeight: '1.5'
                }}
              >
                <code>{code.trim()}</code>
              </pre>
            </div>
          );
        }

        // Handle inline code and bold
        const formatted = part
          .split(/(`[^`]+`)/g)
          .map((segment, j) => {
            const inlineCode = segment.match(/^`([^`]+)`$/);
            if (inlineCode) {
              return (
                <code
                  key={j}
                  style={{
                    background: '#1a1a1a',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#e06c75'
                  }}
                >
                  {inlineCode[1]}
                </code>
              );
            }

            // Handle bold **text**
            const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
            return boldParts.map((bp, k) => {
              const boldMatch = bp.match(/^\*\*([^*]+)\*\*$/);
              if (boldMatch) {
                return <strong key={k}>{boldMatch[1]}</strong>;
              }
              // Handle bullet points
              if (bp.startsWith('- ') || bp.startsWith('* ')) {
                return (
                  <div key={k} style={{ paddingLeft: '12px', margin: '2px 0' }}>
                    • {bp.slice(2)}
                  </div>
                );
              }
              // Handle numbered lists
              const numMatch = bp.match(/^(\d+)\.\s(.+)/);
              if (numMatch) {
                return (
                  <div key={k} style={{ paddingLeft: '12px', margin: '2px 0' }}>
                    {numMatch[1]}. {numMatch[2]}
                  </div>
                );
              }
              return bp;
            });
          });

        return <div key={i} style={{ lineHeight: '1.6' }}>{formatted}</div>;
      })}
    </>
  );
}

/* ---------- Typing Indicator ---------- */
function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        padding: '12px 16px'
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          padding: '12px 20px',
          borderRadius: '12px',
          background: '#1e1e1e',
          border: '1px solid #333'
        }}
      >
        <div
          className="typing-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#888',
            animation: 'typing 1.4s infinite'
          }}
        />
        <div
          className="typing-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#888',
            animation: 'typing 1.4s infinite 0.2s'
          }}
        />
        <div
          className="typing-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#888',
            animation: 'typing 1.4s infinite 0.4s'
          }}
        />
      </div>
    </div>
  );
}

/* ---------- Session Context Menu ---------- */
function SessionContextMenu({ x, y, onRename, onDelete, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        background: '#252525',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '4px',
        zIndex: 2000,
        minWidth: '160px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
      }}
    >
      <div
        onClick={onRename}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          borderRadius: '6px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background 0.15s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        ✏️ Rename
      </div>
      <div
        onClick={onDelete}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          borderRadius: '6px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#ff6b6b',
          transition: 'background 0.15s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#3a1a1a')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        🗑️ Delete
      </div>
    </div>
  );
}

/* ---------- Confirm Dialog ---------- */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3000
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1f1f1f',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #444',
          maxWidth: '400px',
          width: '90%'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Confirm</h3>
        <p style={{ opacity: 0.8, margin: 0 }}>{message}</p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px'
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #444',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#ff4444',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN APP COMPONENT
   ================================================================ */

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
  const [aiThinking, setAiThinking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingSession, setRenamingSession] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingMsgId, setDeletingMsgId] = useState(null);

  // Org management state
  const [orgs, setOrgs] = useState([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [orgForm, setOrgForm] = useState({ name: '', slug: '', email: '', plan: 'free', status: 'active' });
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState(null);
  const [orgStats, setOrgStats] = useState({});

  // Selected org for sessions filtering (persisted in localStorage)
  const [selectedOrgId, setSelectedOrgIdState] = useState(() => {
    return localStorage.getItem('selectedOrgId') || null;
  });
  const setSelectedOrgId = (id) => {
    setSelectedOrgIdState(id);
    if (id) {
      localStorage.setItem('selectedOrgId', id);
    } else {
      localStorage.removeItem('selectedOrgId');
    }
  };
  const [orgsList, setOrgsList] = useState([]);

  /* ---------- Auto-scroll ---------- */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    if (sessionMessages.length > 0) {
      scrollToBottom();
    }
  }, [sessionMessages.length, aiThinking, scrollToBottom]);

  /* ---------- Data fetching ---------- */
  const fetchSessions = async () => {
    try {
      let url = `${import.meta.env.VITE_API_URL}/sessions`;
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedOrgId) params.set('org_id', selectedOrgId);
      const qs = params.toString();
      if (qs) url += '?' + qs;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error(err);
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
      let url = `${import.meta.env.VITE_API_URL}/test-runs`;
      if (selectedOrgId) url += `?org_id=${selectedOrgId}`;

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setRuns(data.runs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrgs = async () => {
    try {
      let url = `${import.meta.env.VITE_API_URL}/orgs`;
      if (orgSearchQuery) url += `?search=${encodeURIComponent(orgSearchQuery)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrgs(data.orgs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrgsList = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/orgs`);
      const data = await res.json();
      if (data.success) {
        setOrgsList(data.orgs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrgStats = async (orgId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/orgs/${orgId}/stats`);
      const data = await res.json();
      if (data.success) {
        setOrgStats((prev) => ({ ...prev, [orgId]: data.stats }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRuns();
    fetchSessions();
    fetchOrgsList();
  }, []);

  // Re-fetch sessions when search or org changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSessions();
      fetchRuns();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedOrgId]);

  // Re-fetch orgs when search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeMenu === 'admin') fetchOrgs();
    }, 300);
    return () => clearTimeout(timer);
  }, [orgSearchQuery, activeMenu]);

  /* ---------- Trigger tests ---------- */
  const triggerTests = async () => {
    try {
      setLoading(true);
      setMessage('');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/trigger-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: selectedOrgId })
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Tests triggered successfully');
        setTimeout(() => fetchRuns(), 5000);
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

  /* ---------- Session CRUD ---------- */
  const handleCreateSession = async () => {
    try {
      const body = { model: selectedModel, prompt: sessionPrompt };
      if (selectedOrgId) body.org_id = selectedOrgId;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        await fetchSessions();
        setShowSessionModal(false);
        setSessionPrompt('');
        setSelectedSession(data.session);

        // If the backend returned initial messages (from the prompt), populate them
        const initialMessages = [];
        if (data.userMessage) initialMessages.push(data.userMessage);
        if (data.aiMessage) initialMessages.push(data.aiMessage);
        setSessionMessages(initialMessages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameSession = async (id, newTitle) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
        );
        if (selectedSession?.id === id) {
          setSelectedSession({ ...selectedSession, title: newTitle });
        }
      }
    } catch (err) {
      console.error(err);
    }
    setRenamingSession(null);
  };

  const handleDeleteSession = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (selectedSession?.id === id) {
          setSelectedSession(null);
          setSessionMessages([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
    setDeleteConfirm(null);
  };

  /* ---------- Messages ---------- */
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

        // If there's an AI response, show thinking indicator then add it
        if (data.aiMessage) {
          setAiThinking(true);
          // Simulate slight delay for typing indicator
          setTimeout(() => {
            setSessionMessages((prev) => [...prev, data.aiMessage]);
            setAiThinking(false);
          }, 600);
        } else {
          // No AI response (maybe Groq key not set), show typing then nothing
          setAiThinking(true);
          setTimeout(() => {
            setAiThinking(false);
          }, 1500);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/sessions/${selectedSession.id}/messages/${msgId}`,
        { method: 'DELETE' }
      );
      setSessionMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) {
      console.error(err);
    }
    setDeletingMsgId(null);
  };

  /* ---------- Handlers ---------- */
  const handleSessionClick = (session) => {
    setSelectedSession(session);
    fetchSessionMessages(session.id);
    setContextMenu(null);
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setSessionMessages([]);
    setNewMessage('');
    setAiThinking(false);
  };

  const handleSessionContextMenu = (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  };

  /* ---------- Org CRUD ---------- */
  const handleOrgFormChange = (field, value) => {
    setOrgForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetOrgForm = () => {
    setOrgForm({ name: '', slug: '', email: '', plan: 'free', status: 'active' });
    setEditOrg(null);
  };

  const handleOpenCreateOrg = () => {
    resetOrgForm();
    setShowOrgModal(true);
  };

  const handleOpenEditOrg = (org) => {
    setEditOrg(org);
    setOrgForm({
      name: org.name || '',
      slug: org.slug || '',
      email: org.email || '',
      plan: org.plan || 'free',
      status: org.status || 'active'
    });
    setShowOrgModal(true);
  };

  const handleSaveOrg = async () => {
    try {
      const body = {
        name: orgForm.name,
        slug: orgForm.slug,
        email: orgForm.email,
        plan: orgForm.plan,
        status: orgForm.status
      };

      let url = `${import.meta.env.VITE_API_URL}/orgs`;
      let method = 'POST';

      if (editOrg) {
        url += `/${editOrg.id}`;
        method = 'PATCH';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        await fetchOrgs();
        await fetchOrgsList();
        setShowOrgModal(false);
        resetOrgForm();
      } else {
        alert('Error: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error saving org');
    }
  };

  const handleDeleteOrg = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/orgs/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        await fetchOrgs();
        await fetchOrgsList();
        if (selectedOrgId === id) {
          setSelectedOrgId(null);
        }
      } else {
        alert('Error: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
    }
    setDeleteOrgConfirm(null);
  };

  const handleOrgClick = (orgId) => {
    fetchOrgStats(orgId);
  };

  /* ---------- Styles ---------- */
  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      background: '#0f0f0f',
      color: 'white',
      fontFamily: "'Segoe UI', Arial, sans-serif"
    },
    sidebar: {
      width: '270px',
      background: '#181818',
      padding: '20px 16px',
      borderRight: '1px solid #222',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    },
    logo: {
      fontSize: '22px',
      fontWeight: 'bold',
      marginBottom: '30px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    menuItem: {
      padding: '12px 14px',
      cursor: 'pointer',
      borderRadius: '10px',
      marginBottom: '6px',
      fontSize: '14px',
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      transition: 'all 0.2s'
    },
    content: {
      flex: 1,
      padding: '40px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    btn: {
      padding: '14px 24px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '14px',
      transition: 'all 0.2s'
    },
    card: {
      padding: '16px',
      background: '#1a1a1a',
      borderRadius: '10px',
      border: '1px solid #2a2a2a',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    input: {
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid #333',
      background: '#111',
      color: 'white',
      fontSize: '14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontFamily: 'inherit'
    },
    select: {
      width: '100%',
      marginTop: '8px',
      padding: '10px',
      borderRadius: '8px',
      background: '#111',
      color: 'white',
      border: '1px solid #333',
      outline: 'none'
    },
    userBubble: {
      maxWidth: '75%',
      padding: '12px 16px',
      borderRadius: '16px 16px 4px 16px',
      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      fontSize: '14px',
      lineHeight: '1.5'
    },
    aiBubble: {
      maxWidth: '75%',
      padding: '12px 16px',
      borderRadius: '16px 16px 16px 4px',
      background: '#1e1e1e',
      border: '1px solid #333',
      fontSize: '14px',
      lineHeight: '1.5'
    }
  };

  return (
    <div style={styles.container}>
      {/* Keyframes for typing animation */}
      <style>{`
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={{ fontSize: '26px' }}>🧪</span> AssertIQ
        </div>

        <div
          onClick={() => {
            setActiveMenu('qa');
            setSelectedSession(null);
            setSessionMessages([]);
            setAiThinking(false);
          }}
          style={{
            ...styles.menuItem,
            background: activeMenu === 'qa' ? '#2a2a2a' : 'transparent'
          }}
        >
          <span>🧪</span> QA Command Center
        </div>

        <div
          onClick={() => {
            setActiveMenu('chat');
            setSelectedSession(null);
            setSessionMessages([]);
            setAiThinking(false);
          }}
          style={{
            ...styles.menuItem,
            background: activeMenu === 'chat' ? '#2a2a2a' : 'transparent'
          }}
        >
          <span>🤖</span> Chatbot
        </div>

        <div
          onClick={() => {
            setActiveMenu('admin');
            setSelectedSession(null);
            setSessionMessages([]);
            setAiThinking(false);
            fetchOrgs();
          }}
          style={{
            ...styles.menuItem,
            background: activeMenu === 'admin' ? '#2a2a2a' : 'transparent'
          }}
        >
          <span>🏢</span> Admin - Orgs
        </div>

        {/* Org Selector in Sidebar */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '20px',
            borderTop: '1px solid #222'
          }}
        >
          <label
            style={{
              fontSize: '11px',
              fontWeight: 600,
              opacity: 0.5,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              marginBottom: '8px'
            }}
          >
            Active Organization
          </label>
          <select
            value={selectedOrgId || ''}
            onChange={(e) => setSelectedOrgId(e.target.value || null)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#111',
              color: 'white',
              border: '1px solid #333',
              outline: 'none',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="">Default Org</option>
            {orgsList.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div style={styles.content}>
        {/* ======= QA COMMAND CENTER ======= */}
        {activeMenu === 'qa' && (
          <>
            <h1 style={{ fontSize: '28px', margin: 0 }}>🚀 QA Command Center</h1>
            <p style={{ opacity: 0.6, marginTop: '8px' }}>
              Trigger and monitor Playwright test runs
            </p>

            <button
              onClick={triggerTests}
              disabled={loading}
              style={{
                ...styles.btn,
                background: loading ? '#333' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white',
                alignSelf: 'flex-start',
                marginTop: '20px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '⏳ Starting...' : '▶ Run Playwright Tests'}
            </button>

            {message && (
              <p style={{ marginTop: '12px', fontSize: '14px' }}>{message}</p>
            )}

            <h2
              style={{
                fontSize: '20px',
                marginTop: '32px',
                marginBottom: '16px'
              }}
            >
              Recent Test Runs
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table
                border="0"
                cellPadding="12"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ textAlign: 'left', opacity: 0.6 }}>Passed</th>
                    <th style={{ textAlign: 'left', opacity: 0.6 }}>Failed</th>
                    <th style={{ textAlign: 'left', opacity: 0.6 }}>Total</th>
                    <th style={{ textAlign: 'left', opacity: 0.6 }}>Duration</th>
                    <th style={{ textAlign: 'left', opacity: 0.6 }}>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      style={{ borderBottom: '1px solid #222' }}
                    >
                      <td style={{ color: '#4ade80' }}>{run.passed}</td>
                      <td style={{ color: '#f87171' }}>{run.failed}</td>
                      <td>{run.total}</td>
                      <td style={{ opacity: 0.6 }}>{run.duration} ms</td>
                      <td>
                        <a
                          href={run.report_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#60a5fa',
                            textDecoration: 'none',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            background: '#1a1a2e',
                            fontSize: '13px'
                          }}
                        >
                          Open Report ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', opacity: 0.5, padding: '24px' }}>
                        No test runs yet. Trigger a run to see results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ======= CHATBOT - SESSION LIST ======= */}
        {activeMenu === 'chat' && !selectedSession && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <h1 style={{ fontSize: '28px', margin: 0 }}>🤖 Chatbot</h1>
                <p style={{ opacity: 0.6, margin: '4px 0 0 0', fontSize: '14px' }}>
                  AI-powered assistant for test automation
                </p>
              </div>
              <button
                onClick={() => setShowSessionModal(true)}
                style={{
                  ...styles.btn,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white'
                }}
              >
                + New Session
              </button>
            </div>

            {/* Org Filter */}
            <div style={{ marginBottom: '16px', maxWidth: '300px' }}>
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#111',
                  color: 'white',
                  border: '1px solid #333',
                  outline: 'none',
                  fontSize: '13px'
                }}
              >
                <option value="">All Orgs</option>
                {orgsList.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '12px', opacity: 0.4 }}>🔍</span>
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  ...styles.input,
                  paddingLeft: '40px'
                }}
              />
            </div>

            {/* Session list */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              {sessions.length === 0 && (
                <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '60px' }}>
                  <p style={{ fontSize: '16px' }}>No sessions yet</p>
                  <p style={{ fontSize: '13px' }}>
                    Create a session to start chatting with the AI assistant
                  </p>
                </div>
              )}

              {sessions.map((s) => (
                <div key={s.id}>
                  {renamingSession === s.id ? (
                    <div style={styles.card}>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameSession(s.id, renameValue);
                          }
                          if (e.key === 'Escape') {
                            setRenamingSession(null);
                          }
                        }}
                        autoFocus
                        style={styles.input}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameSession(s.id, renameValue);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#2563eb',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingSession(null);
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #444',
                            background: 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleSessionClick(s)}
                      onContextMenu={(e) => handleSessionContextMenu(e, s)}
                      style={{
                        ...styles.card,
                        borderColor:
                          selectedSession?.id === s.id ? '#2563eb' : '#2a2a2a',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#555';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor =
                          selectedSession?.id === s.id ? '#2563eb' : '#2a2a2a';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '6px'
                        }}
                      >
                        <span
                          style={{
                            background: '#2a2a2a',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#888'
                          }}
                        >
                          {s.model}
                        </span>
                        <span style={{ fontSize: '11px', opacity: 0.4 }}>
                          {s.created_at
                            ? new Date(s.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              })
                            : ''}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          marginBottom: '4px'
                        }}
                      >
                        {s.title || s.prompt?.slice(0, 60)}
                        {(s.title?.length > 60 || (!s.title && s.prompt?.length > 60))
                          ? '...'
                          : ''}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            opacity: 0.5,
                            display: 'flex',
                            gap: '12px'
                          }}
                        >
                          <span
                            style={{
                              textTransform: 'capitalize',
                              color: s.status === 'active' ? '#4ade80' : '#888'
                            }}
                          >
                            ● {s.status}
                          </span>
                          {s.message_count && (
                            <span>{s.message_count} messages</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ======= CHAT SCREEN ======= */}
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
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid #2a2a2a',
                marginBottom: '16px',
                flexShrink: 0
              }}
            >
              <button
                onClick={handleBackToSessions}
                style={{
                  background: 'none',
                  border: '1px solid #333',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#555')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333')}
              >
                ← Back
              </button>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>
                  {selectedSession.title || `${selectedSession.model} Session`}
                </h2>
                <div
                  style={{
                    fontSize: '12px',
                    opacity: 0.5,
                    marginTop: '2px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  <span>{selectedSession.model}</span>
                  <span>•</span>
                  <span>{sessionMessages.length} messages</span>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={chatContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '8px'
              }}
            >
              {sessionMessages.length === 0 && !aiThinking && (
                <div
                  style={{
                    textAlign: 'center',
                    opacity: 0.5,
                    marginTop: '60px'
                  }}
                >
                  <p style={{ fontSize: '18px', margin: 0 }}>💬</p>
                  <p style={{ marginTop: '12px' }}>
                    No messages yet. Start the conversation!
                  </p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>
                    Ask about test automation, Playwright, or QA strategies
                  </p>
                </div>
              )}

              {sessionMessages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    position: 'relative',
                    group: true
                  }}
                  onMouseEnter={(e) => {
                    const del = e.currentTarget.querySelector('.msg-delete-btn');
                    if (del) del.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    const del = e.currentTarget.querySelector('.msg-delete-btn');
                    if (del) del.style.opacity = '0';
                  }}
                >
                  <div
                    style={
                      msg.role === 'user' ? styles.userBubble : styles.aiBubble
                    }
                  >
                    <div
                      className="msg-delete-btn"
                      onClick={() => setDeletingMsgId(msg.id)}
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: msg.role === 'user' ? '-6px' : 'auto',
                        left: msg.role === 'user' ? 'auto' : '-6px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        cursor: 'pointer',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        border: '1px solid #555',
                        color: '#888'
                      }}
                      title="Delete message"
                    >
                      ✕
                    </div>
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    )}
                    {msg.created_at && (
                      <div
                        style={{
                          fontSize: '10px',
                          opacity: 0.4,
                          marginTop: '6px',
                          textAlign: 'right'
                        }}
                      >
                        {new Date(msg.created_at).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {aiThinking && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                paddingTop: '16px',
                borderTop: '1px solid #2a2a2a',
                marginTop: '16px',
                flexShrink: 0
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
                disabled={sendingMessage || aiThinking}
                style={{
                  ...styles.input,
                  resize: 'none',
                  opacity: sendingMessage || aiThinking ? 0.5 : 1
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage || aiThinking}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor:
                    newMessage.trim() && !sendingMessage && !aiThinking
                      ? 'pointer'
                      : 'not-allowed',
                  background:
                    newMessage.trim() && !sendingMessage && !aiThinking
                      ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                      : '#333',
                  color: 'white',
                  fontSize: '14px',
                  alignSelf: 'flex-end',
                  opacity:
                    newMessage.trim() && !sendingMessage && !aiThinking ? 1 : 0.4,
                  transition: 'all 0.2s'
                }}
              >
                {sendingMessage ? '⏳' : aiThinking ? '⏳' : 'Send →'}
              </button>
            </div>
          </div>
        )}

        {/* ======= ADMIN - ORGS ======= */}
        {activeMenu === 'admin' && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <h1 style={{ fontSize: '28px', margin: 0 }}>🏢 Admin - Organizations</h1>
                <p style={{ opacity: 0.6, margin: '4px 0 0 0', fontSize: '14px' }}>
                  Manage organizations (companies) and their subscriptions
                </p>
              </div>
              <button
                onClick={handleOpenCreateOrg}
                style={{
                  ...styles.btn,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white'
                }}
              >
                + New Organization
              </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '12px', opacity: 0.4 }}>🔍</span>
              <input
                type="text"
                placeholder="Search orgs by name, slug, or email..."
                value={orgSearchQuery}
                onChange={(e) => setOrgSearchQuery(e.target.value)}
                style={{
                  ...styles.input,
                  paddingLeft: '40px'
                }}
              />
            </div>

            {/* Org list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
              {orgs.length === 0 && (
                <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '60px' }}>
                  <p style={{ fontSize: '16px' }}>No organizations yet</p>
                  <p style={{ fontSize: '13px' }}>
                    Create an organization to manage subscriptions and sessions
                  </p>
                </div>
              )}

              {orgs.map((org) => (
                <div
                  key={org.id}
                  style={{
                    ...styles.card,
                    cursor: 'default'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px' }}>{org.name}</h3>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background:
                              org.plan === 'paid' ? '#059669' : '#6b7280',
                            color: 'white'
                          }}
                        >
                          {org.plan}
                        </span>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 500,
                            background:
                              org.status === 'active' ? '#064e3b' :
                              org.status === 'suspended' ? '#7f1d1d' : '#374151',
                            color:
                              org.status === 'active' ? '#4ade80' :
                              org.status === 'suspended' ? '#f87171' : '#9ca3af'
                          }}
                        >
                          {org.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', opacity: 0.6 }}>
                        <span>Slug: {org.slug}</span>
                        {org.email && <span>📧 {org.email}</span>}
                        <span>📅 {new Date(org.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEditOrg(org)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: '1px solid #444',
                          background: 'transparent',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#60a5fa')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#444')}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setDeleteOrgConfirm(org.id)}
                        disabled={org.slug === 'default'}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: '1px solid #444',
                          background: 'transparent',
                          color: org.slug === 'default' ? '#555' : '#f87171',
                          cursor: org.slug === 'default' ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          opacity: org.slug === 'default' ? 0.5 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (org.slug !== 'default') e.currentTarget.style.borderColor = '#f87171';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#444';
                        }}
                        title={org.slug === 'default' ? 'Cannot delete default org' : 'Delete org'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Org Stats */}
                  <div
                    onClick={() => handleOrgClick(org.id)}
                    style={{
                      display: 'flex',
                      gap: '24px',
                      padding: '12px',
                      background: '#0f0f0f',
                      borderRadius: '8px',
                      marginTop: '8px'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>
                        {orgStats[org.id]?.session_count ?? '...'}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.5 }}>Sessions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ade80' }}>
                        {orgStats[org.id]?.active_sessions ?? '...'}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.5 }}>Active</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24' }}>
                        {orgStats[org.id]?.test_run_count ?? '...'}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.5 }}>Test Runs</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ======= CONTEXT MENU ======= */}
      {contextMenu && (
        <SessionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => {
            setRenamingSession(contextMenu.session.id);
            setRenameValue(
              contextMenu.session.title ||
                contextMenu.session.prompt?.slice(0, 60) ||
                'Session'
            );
            setContextMenu(null);
          }}
          onDelete={() => {
            setDeleteConfirm(contextMenu.session.id);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ======= DELETE SESSION CONFIRMATION ======= */}
      {deleteConfirm && (
        <ConfirmDialog
          message="Are you sure you want to delete this session? All messages will be permanently removed."
          onConfirm={() => handleDeleteSession(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* ======= DELETE MESSAGE CONFIRMATION ======= */}
      {deletingMsgId && (
        <ConfirmDialog
          message="Delete this message?"
          onConfirm={() => handleDeleteMessage(deletingMsgId)}
          onCancel={() => setDeletingMsgId(null)}
        />
      )}

      {/* ======= DELETE ORG CONFIRMATION ======= */}
      {deleteOrgConfirm && (
        <ConfirmDialog
          message="Are you sure you want to delete this organization? Its sessions and test runs will be reassigned to the default org."
          onConfirm={() => handleDeleteOrg(deleteOrgConfirm)}
          onCancel={() => setDeleteOrgConfirm(null)}
        />
      )}

      {/* ======= CREATE/EDIT ORG MODAL ======= */}
      {showOrgModal && (
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
          onClick={() => {
            setShowOrgModal(false);
            resetOrgForm();
          }}
        >
          <div
            style={{
              background: '#1f1f1f',
              padding: '28px',
              borderRadius: '16px',
              width: '520px',
              border: '1px solid #333',
              maxWidth: '90vw'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: '22px' }}>
              {editOrg ? 'Edit Organization' : 'Create Organization'}
            </h2>
            <p style={{ opacity: 0.5, fontSize: '13px', marginTop: '6px' }}>
              {editOrg ? 'Update organization details' : 'Add a new organization (company)'}
            </p>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}>Name *</label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => handleOrgFormChange('name', e.target.value)}
                  placeholder="Acme Corp"
                  style={{ ...styles.input, marginTop: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}>Slug *</label>
                <input
                  type="text"
                  value={orgForm.slug}
                  onChange={(e) => handleOrgFormChange('slug', e.target.value.replace(/\s+/g, '-').toLowerCase())}
                  placeholder="acme-corp"
                  disabled={!!editOrg}
                  style={{
                    ...styles.input,
                    marginTop: '6px',
                    opacity: editOrg ? 0.5 : 1
                  }}
                />
                <div style={{ fontSize: '11px', opacity: 0.4, marginTop: '4px' }}>
                  URL-friendly identifier. Cannot be changed after creation.
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}>Email</label>
                <input
                  type="email"
                  value={orgForm.email}
                  onChange={(e) => handleOrgFormChange('email', e.target.value)}
                  placeholder="admin@acme.com"
                  style={{ ...styles.input, marginTop: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}>Plan</label>
                  <select
                    value={orgForm.plan}
                    onChange={(e) => handleOrgFormChange('plan', e.target.value)}
                    style={styles.select}
                  >
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}>Status</label>
                  <select
                    value={orgForm.status}
                    onChange={(e) => handleOrgFormChange('status', e.target.value)}
                    style={styles.select}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '28px'
              }}
            >
              <button
                onClick={() => {
                  setShowOrgModal(false);
                  resetOrgForm();
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  background: 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOrg}
                disabled={!orgForm.name.trim() || !orgForm.slug.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: orgForm.name.trim() && orgForm.slug.trim()
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : '#333',
                  color: 'white',
                  cursor: orgForm.name.trim() && orgForm.slug.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  opacity: orgForm.name.trim() && orgForm.slug.trim() ? 1 : 0.5
                }}
              >
                {editOrg ? 'Update Organization' : 'Create Organization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======= CREATE SESSION MODAL ======= */}
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
          onClick={() => {
            setShowSessionModal(false);
            setSessionPrompt('');
          }}
        >
          <div
            style={{
              background: '#1f1f1f',
              padding: '28px',
              borderRadius: '16px',
              width: '520px',
              border: '1px solid #333',
              maxWidth: '90vw'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: '22px' }}>Create Session</h2>
            <p style={{ opacity: 0.5, fontSize: '13px', marginTop: '6px' }}>
              Start a new AI-powered chat session
            </p>

            <div style={{ marginTop: '24px' }}>
              <label
                style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}
              >
                Org (optional)
              </label>
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value || null)}
                style={styles.select}
              >
                <option value="">Default Org</option>
                {orgsList.map((org) => (
                  <option key={org.id} value={org.id}>{org.name} ({org.plan})</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label
                style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}
              >
                Prompt
              </label>

              <textarea
                value={sessionPrompt}
                onChange={(e) => setSessionPrompt(e.target.value)}
                rows={4}
                placeholder="Generate Playwright tests for login page..."
                style={{
                  ...styles.input,
                  marginTop: '8px',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <label
                style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8 }}
              >
                Model
              </label>

              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={styles.select}
              >
                <option value="groq">Groq (mixtral-8x7b)</option>
                <option value="gpt">GPT</option>
                <option value="sonnet">Sonnet</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '28px'
              }}
            >
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  setSessionPrompt('');
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  background: 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleCreateSession}
                disabled={!sessionPrompt.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: sessionPrompt.trim()
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : '#333',
                  color: 'white',
                  cursor: sessionPrompt.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  opacity: sessionPrompt.trim() ? 1 : 0.5
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