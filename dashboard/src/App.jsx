import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import AuthPage from './Auth';
import { apiRequest } from './api';

/* ---------- Simple Markdown Renderer ---------- */
function MarkdownRenderer({ content }) {
  if (!content) return null;
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
        if (codeMatch) {
          const [, lang, code] = codeMatch;
          return (
            <div key={i} style={{ background: '#0d0d0d', borderRadius: '8px', border: '1px solid #333', margin: '8px 0', overflow: 'hidden' }}>
              {lang && <div style={{ padding: '4px 12px', fontSize: '11px', color: '#888', background: '#1a1a1a', borderBottom: '1px solid #333', textTransform: 'uppercase' }}>{lang}</div>}
              <pre style={{ padding: '12px', margin: 0, overflow: 'auto', fontSize: '13px', lineHeight: '1.5' }}><code>{code.trim()}</code></pre>
            </div>
          );
        }
        const formatted = part
          .split(/(`[^`]+`)/g)
          .map((segment, j) => {
            const inlineCode = segment.match(/^`([^`]+)`$/);
            if (inlineCode) {
              return <code key={j} style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#e06c75' }}>{inlineCode[1]}</code>;
            }
            const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
            return boldParts.map((bp, k) => {
              const boldMatch = bp.match(/^\*\*([^*]+)\*\*$/);
              if (boldMatch) return <strong key={k}>{boldMatch[1]}</strong>;
              if (bp.startsWith('- ') || bp.startsWith('* ')) {
                return <div key={k} style={{ paddingLeft: '12px', margin: '2px 0' }}>• {bp.slice(2)}</div>;
              }
              const numMatch = bp.match(/^(\d+)\.\s(.+)/);
              if (numMatch) {
                return <div key={k} style={{ paddingLeft: '12px', margin: '2px 0' }}>{numMatch[1]}. {numMatch[2]}</div>;
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
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '12px 16px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '12px 20px', borderRadius: '12px', background: '#1e1e1e', border: '1px solid #333' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="typing-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#888', animation: 'typing 1.4s infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Session Context Menu ---------- */
function SessionContextMenu({ x, y, onRename, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: 'fixed', top: y, left: x, background: '#252525', border: '1px solid #444', borderRadius: '8px', padding: '4px', zIndex: 2000, minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <div onClick={onRename} style={{ padding: '10px 14px', cursor: 'pointer', borderRadius: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#333')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>✏️ Rename</div>
      <div onClick={onDelete} style={{ padding: '10px 14px', cursor: 'pointer', borderRadius: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff6b6b', transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#3a1a1a')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>🗑️ Delete</div>
    </div>
  );
}

/* ---------- Confirm Dialog ---------- */
function ConfirmDialog({ message, onConfirm, onCancel, confirmText = 'Delete', danger = true }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }} onClick={onCancel}>
      <div style={{ background: '#1f1f1f', padding: '24px', borderRadius: '12px', border: '1px solid #444', maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Confirm</h3>
        <p style={{ opacity: 0.8, margin: 0 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: danger ? '#ff4444' : '#2563eb', color: 'white', cursor: 'pointer' }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- No Org Screen ---------- */
function NoOrgScreen({ user, logout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0f', color: 'white', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '24px', lineHeight: 1 }}>🔒</div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 12px 0', letterSpacing: '-0.3px' }}>No Organization Access</h1>
        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 8px 0' }}>
          You're not added to any organizations yet.
        </p>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 32px 0' }}>
          Contact your administrator to get access. Once you're added, you'll be able to run tests, view reports, and collaborate with your team.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { logout(); }} style={{ padding: '12px 28px', borderRadius: '10px', border: '1px solid #333', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = 'white'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#94a3b8'; }}>Sign Out</button>
        </div>
      </div>
      <div style={{ marginTop: '48px', padding: '16px 24px', background: '#121218', borderRadius: '12px', border: '1px solid #1e1e2a', maxWidth: '400px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
          <strong style={{ color: '#94a3b8' }}>Account:</strong> {user?.email}<br />
          <strong style={{ color: '#94a3b8' }}>Role:</strong> {user?.role || 'member'}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main App ---------- */
function App() {
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a0f', color: 'white', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" />
          <div style={{ marginTop: '16px', color: '#64748b', fontSize: '15px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <AuthPage />;

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState([]);
  const [activeMenu, setActiveMenu] = useState('qa');
  const [runsPage, setRunsPage] = useState(1);
  const [runsTotalPages, setRunsTotalPages] = useState(1);
  const [runsTotal, setRunsTotal] = useState(0);
  const RUNS_PER_PAGE = 10;

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

  const [contextMenu, setContextMenu] = useState(null);
  const [renamingSession, setRenamingSession] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingMsgId, setDeletingMsgId] = useState(null);

  // Org management
  const [orgs, setOrgs] = useState([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [orgForm, setOrgForm] = useState({ name: '', slug: '', email: '', plan: 'free', status: 'active' });
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState(null);
  const [orgStats, setOrgStats] = useState({});

  const [selectedOrgId, setSelectedOrgIdState] = useState(() => localStorage.getItem('selectedOrgId') || null);
  const setSelectedOrgId = (id) => {
    setSelectedOrgIdState(id);
    if (id) localStorage.setItem('selectedOrgId', id);
    else localStorage.removeItem('selectedOrgId');
  };
  const [orgsList, setOrgsList] = useState([]);

  // Member management
  const [pendingUsers, setPendingUsers] = useState([]);
  const [showPendingUsers, setShowPendingUsers] = useState(false);
  const [orgMembers, setOrgMembers] = useState({});
  const [expandedOrgMembers, setExpandedOrgMembers] = useState({});
  const [assigningUser, setAssigningUser] = useState(null);
  const [selectedOrgForAssignment, setSelectedOrgForAssignment] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');

  // Check if user has any orgs
  const [userOrgs, setUserOrgs] = useState([]);
  const [checkingOrgs, setCheckingOrgs] = useState(true);

  useEffect(() => {
    fetchOrgsList();
  }, []);

  // Check user's org access on mount
  useEffect(() => {
    const checkOrgAccess = async () => {
      try {
        const data = await apiRequest('/auth/me');
        if (data.success) {
          setUserOrgs(data.organizations || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingOrgs(false);
      }
    };
    if (isAuthenticated) checkOrgAccess();
  }, [isAuthenticated]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => {
    if (sessionMessages.length > 0) scrollToBottom();
  }, [sessionMessages.length, aiThinking, scrollToBottom]);

  const fetchSessions = async () => {
    try {
      let url = `/sessions`;
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedOrgId) params.set('org_id', selectedOrgId);
      const qs = params.toString();
      if (qs) url += '?' + qs;
      const data = await apiRequest(url);
      if (data.success) setSessions(data.sessions);
    } catch (err) { console.error(err); }
  };

  const fetchSessionMessages = async (sessionId) => {
    try {
      const data = await apiRequest(`/sessions/${sessionId}/messages`);
      if (data.success) setSessionMessages(data.messages);
    } catch (err) { console.error(err); }
  };

  const fetchRuns = async (page = 1) => {
    try {
      const params = new URLSearchParams();
      if (selectedOrgId) params.set('org_id', selectedOrgId);
      params.set('page', String(page));
      params.set('limit', String(RUNS_PER_PAGE));
      const url = `/test-runs?${params.toString()}`;
      const data = await apiRequest(url);
      if (data.success) {
        setRuns(data.runs);
        setRunsPage(data.page || 1);
        setRunsTotalPages(data.totalPages || 1);
        setRunsTotal(data.total || 0);
      }
    } catch (err) { console.error(err); }
  };

  const fetchOrgs = async () => {
    try {
      let url = `/orgs`;
      if (orgSearchQuery) url += `?search=${encodeURIComponent(orgSearchQuery)}`;
      const data = await apiRequest(url);
      if (data.success) setOrgs(data.orgs);
    } catch (err) { console.error(err); }
  };

  const fetchOrgsList = async () => {
    try {
      const data = await apiRequest('/orgs');
      if (data.success) setOrgsList(data.orgs);
    } catch (err) { console.error(err); }
  };

  const fetchOrgStats = async (orgId) => {
    try {
      const data = await apiRequest(`/orgs/${orgId}/stats`);
      if (data.success) setOrgStats((prev) => ({ ...prev, [orgId]: data.stats }));
    } catch (err) { console.error(err); }
  };

  const fetchPendingUsers = async () => {
    try {
      const data = await apiRequest('/users/pending');
      if (data.success) setPendingUsers(data.users || []);
    } catch (err) { console.error(err); }
  };

  const fetchOrgMembers = async (orgId) => {
    try {
      const data = await apiRequest(`/orgs/${orgId}/members`);
      if (data.success) setOrgMembers((prev) => ({ ...prev, [orgId]: data.members || [] }));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchRuns();
    fetchSessions();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchSessions(); fetchRuns(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedOrgId]);

  useEffect(() => {
    const timer = setTimeout(() => { if (activeMenu === 'admin') fetchOrgs(); }, 300);
    return () => clearTimeout(timer);
  }, [orgSearchQuery, activeMenu]);

  const triggerTests = async () => {
    try {
      setLoading(true);
      setMessage('');
      const data = await apiRequest('/trigger-tests', { method: 'POST', body: JSON.stringify({ org_id: selectedOrgId }) });
      if (data.success) { setMessage('✅ Tests triggered'); setTimeout(() => fetchRuns(), 5000); }
      else setMessage('❌ Failed to trigger tests');
    } catch (err) { console.error(err); setMessage('❌ Something went wrong');
    } finally { setLoading(false); }
  };

  const handleCreateSession = async () => {
    try {
      const body = { model: selectedModel, prompt: sessionPrompt };
      if (selectedOrgId) body.org_id = selectedOrgId;
      const data = await apiRequest('/sessions', { method: 'POST', body: JSON.stringify(body) });
      if (data.success) {
        await fetchSessions();
        setShowSessionModal(false);
        setSessionPrompt('');
        setSelectedSession(data.session);
        const msgs = [];
        if (data.userMessage) msgs.push(data.userMessage);
        if (data.aiMessage) msgs.push(data.aiMessage);
        setSessionMessages(msgs);
      }
    } catch (err) { console.error(err); }
  };

  const handleRenameSession = async (id, newTitle) => {
    try {
      const data = await apiRequest(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title: newTitle }) });
      if (data.success) {
        setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s)));
        if (selectedSession?.id === id) setSelectedSession({ ...selectedSession, title: newTitle });
      }
    } catch (err) { console.error(err); }
    setRenamingSession(null);
  };

  const handleDeleteSession = async (id) => {
    try {
      const data = await apiRequest(`/sessions/${id}`, { method: 'DELETE' });
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (selectedSession?.id === id) { setSelectedSession(null); setSessionMessages([]); }
      }
    } catch (err) { console.error(err); }
    setDeleteConfirm(null);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedSession) return;
    try {
      setSendingMessage(true);
      const data = await apiRequest(`/sessions/${selectedSession.id}/messages`, { method: 'POST', body: JSON.stringify({ content: newMessage.trim(), role: 'user' }) });
      if (data.success) {
        setSessionMessages((prev) => [...prev, data.message]);
        setNewMessage('');
        if (data.aiMessage) {
          setAiThinking(true);
          setTimeout(() => { setSessionMessages((prev) => [...prev, data.aiMessage]); setAiThinking(false); }, 600);
        } else {
          setAiThinking(true);
          setTimeout(() => setAiThinking(false), 1500);
        }
      }
    } catch (err) { console.error(err);
    } finally { setSendingMessage(false); }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await apiRequest(`/sessions/${selectedSession.id}/messages/${msgId}`, { method: 'DELETE' });
      setSessionMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) { console.error(err); }
    setDeletingMsgId(null);
  };

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

  // Org CRUD
  const handleOrgFormChange = (field, value) => setOrgForm((prev) => ({ ...prev, [field]: value }));
  const resetOrgForm = () => { setOrgForm({ name: '', slug: '', email: '', plan: 'free', status: 'active' }); setEditOrg(null); };
  const handleOpenCreateOrg = () => { resetOrgForm(); setShowOrgModal(true); };
  const handleOpenEditOrg = (org) => {
    setEditOrg(org);
    setOrgForm({ name: org.name || '', slug: org.slug || '', email: org.email || '', plan: org.plan || 'free', status: org.status || 'active' });
    setShowOrgModal(true);
  };

  const handleSaveOrg = async () => {
    try {
      const body = { name: orgForm.name, slug: orgForm.slug, email: orgForm.email, plan: orgForm.plan, status: orgForm.status };
      let url = `${import.meta.env.VITE_API_URL}/orgs`;
      let method = 'POST';
      if (editOrg) { url += `/${editOrg.id}`; method = 'PATCH'; }
      const data = await apiRequest(url, { method, body: JSON.stringify(body) });
      if (data.success) { await fetchOrgs(); await fetchOrgsList(); setShowOrgModal(false); resetOrgForm(); }
      else alert('Error: ' + (data.error || 'Unknown error'));
    } catch (err) { console.error(err); alert('Error saving org'); }
  };

  const handleDeleteOrg = async (id) => {
    try {
      const data = await apiRequest(`/orgs/${id}`, { method: 'DELETE' });
      if (data.success) { await fetchOrgs(); await fetchOrgsList(); if (selectedOrgId === id) setSelectedOrgId(null); }
      else alert('Error: ' + (data.error || 'Unknown error'));
    } catch (err) { console.error(err); }
    setDeleteOrgConfirm(null);
  };

  const handleOrgClick = (orgId) => { fetchOrgStats(orgId); };

  // Member management
  const handleToggleMembers = (orgId) => {
    const isExpanded = expandedOrgMembers[orgId];
    if (!isExpanded) fetchOrgMembers(orgId);
    setExpandedOrgMembers((prev) => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const handleAssignUser = async () => {
    if (!assigningUser || !selectedOrgForAssignment) return;
    try {
      const data = await apiRequest(`/orgs/${selectedOrgForAssignment}/members`, { method: 'POST', body: JSON.stringify({ user_id: assigningUser, role: selectedRole }) });
      if (data.success) {
        await fetchPendingUsers();
        await fetchOrgMembers(selectedOrgForAssignment);
        setAssigningUser(null);
        setSelectedOrgForAssignment('');
        setSelectedRole('member');
      } else alert('Error: ' + (data.error || 'Failed to assign user'));
    } catch (err) { console.error(err); alert('Error assigning user'); }
  };

  const handleRemoveMember = async (orgId, userId) => {
    try {
      const data = await apiRequest(`/orgs/${orgId}/members/${userId}`, { method: 'DELETE' });
      if (data.success) {
        await fetchOrgMembers(orgId);
        await fetchPendingUsers();
      } else alert('Error: ' + (data.error || 'Failed to remove member'));
    } catch (err) { console.error(err); alert('Error removing member'); }
  };

  // If user has no orgs, show the NoOrgScreen
  if (!checkingOrgs && userOrgs.length === 0 && user?.role !== 'admin') {
    return <NoOrgScreen user={user} logout={logout} />;
  }

  const styles = {
    container: { display: 'flex', minHeight: '100vh', background: '#0a0a0f', color: 'white', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" },
    sidebar: { width: '270px', background: '#0f0f14', padding: '20px 16px', borderRight: '1px solid #1a1a24', display: 'flex', flexDirection: 'column', flexShrink: 0 },
    logo: { fontSize: '22px', fontWeight: 'bold', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '8px' },
    menuItem: { padding: '11px 14px', cursor: 'pointer', borderRadius: '10px', marginBottom: '4px', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.15s', color: '#94a3b8' },
    content: { flex: 1, padding: '36px 40px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    btn: { padding: '12px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: 'all 0.2s' },
    card: { padding: '16px', background: '#121218', borderRadius: '10px', border: '1px solid #1e1e2a', cursor: 'pointer', transition: 'all 0.2s' },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #2a2a30', background: '#0f0f14', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' },
    select: { width: '100%', marginTop: '8px', padding: '10px', borderRadius: '8px', background: '#0f0f14', color: 'white', border: '1px solid #2a2a30', outline: 'none', fontSize: '13px', cursor: 'pointer' },
    userBubble: { maxWidth: '75%', padding: '12px 16px', borderRadius: '16px 16px 4px 16px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontSize: '14px', lineHeight: '1.5' },
    aiBubble: { maxWidth: '75%', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: '#121218', border: '1px solid #1e1e2a', fontSize: '14px', lineHeight: '1.5' }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a30; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #444; }
        .loading-spinner { width: 32px; height: 32px; border: 3px solid #1e1e2a; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        .loading-spinner.small { width: 18px; height: 18px; border-width: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        tr:hover { background: rgba(37,99,235,0.03); }
      `}</style>

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={{ fontSize: '24px', background: 'linear-gradient(135deg, #2563eb, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🧪</span>
          <span style={{ letterSpacing: '-0.3px' }}>AssertIQ</span>
        </div>

        <div onClick={() => { setActiveMenu('qa'); setSelectedSession(null); setSessionMessages([]); setAiThinking(false); }}
          style={{ ...styles.menuItem, background: activeMenu === 'qa' ? 'rgba(37,99,235,0.1)' : 'transparent', color: activeMenu === 'qa' ? '#60a5fa' : '#94a3b8' }}>
          <span>🧪</span> QA Command Center
        </div>

        <div onClick={() => { setActiveMenu('chat'); setSelectedSession(null); setSessionMessages([]); setAiThinking(false); }}
          style={{ ...styles.menuItem, background: activeMenu === 'chat' ? 'rgba(37,99,235,0.1)' : 'transparent', color: activeMenu === 'chat' ? '#60a5fa' : '#94a3b8' }}>
          <span>🤖</span> Chatbot
        </div>

        {user?.role === 'admin' && (
          <div onClick={() => { setActiveMenu('admin'); setSelectedSession(null); setSessionMessages([]); setAiThinking(false); fetchOrgs(); }}
            style={{ ...styles.menuItem, background: activeMenu === 'admin' ? 'rgba(37,99,235,0.1)' : 'transparent', color: activeMenu === 'admin' ? '#60a5fa' : '#94a3b8' }}>
            <span>🏢</span> Admin - Orgs
          </div>
        )}

        <div style={{ marginTop: 'auto', padding: '16px 0', borderTop: '1px solid #1a1a24' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', flexShrink: 0 }}>
              {user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e2e8f0' }}>
                {user?.full_name || user?.email?.split('@')[0] || 'User'}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || ''}
              </div>
            </div>
            <button onClick={logout} title="Sign out" style={{ background: 'none', border: '1px solid #2a2a30', color: '#475569', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a30'; e.currentTarget.style.color = '#475569'; }}>
              Sign Out
            </button>
          </div>

          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            Organization
          </label>
          <select value={selectedOrgId || ''} onChange={(e) => setSelectedOrgId(e.target.value || null)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0a0a0f', color: '#e2e8f0', border: '1px solid #2a2a30', outline: 'none', fontSize: '13px', cursor: 'pointer' }}>
            {orgsList.length === 0 && <option value="">No orgs available</option>}
            {orgsList.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div style={styles.content}>
        {/* ======= QA COMMAND CENTER ======= */}
        {activeMenu === 'qa' && (
          <>
            <div style={{ marginBottom: '28px' }}>
              <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 700 }}>🚀 QA Command Center</h1>
              <p style={{ color: '#64748b', marginTop: '6px', fontSize: '14px' }}>Trigger and monitor Playwright test runs across your organizations</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '32px' }}>
              <button onClick={triggerTests} disabled={loading}
                style={{ ...styles.btn, background: loading ? '#1e1e2a' : 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '⏳ Starting...' : '▶ Run Tests'}
              </button>
              {message && <span style={{ fontSize: '14px', color: '#94a3b8' }}>{message}</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 600 }}>Recent Test Runs</h2>
              {runsTotal > 0 && <span style={{ fontSize: '12px', color: '#475569' }}>{runsTotal} total</span>}
            </div>

            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table border="0" cellPadding="12" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e2a' }}>
                    {['ID', 'Date', 'Passed', 'Failed', 'Total', 'Duration', 'Branch', 'Report'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', color: '#475569', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...runs].sort((a, b) => new Date(b.created_at || b.triggered_at || 0) - new Date(a.created_at || a.triggered_at || 0)).map((run) => (
                    <tr key={run.id} style={{ borderBottom: '1px solid #1a1a24', transition: 'background 0.15s' }}>
                      <td style={{ color: '#475569', fontSize: '12px' }}>#{run.id}</td>
                      <td style={{ fontSize: '13px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {run.created_at
                          ? new Date(run.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : run.triggered_at
                            ? new Date(run.triggered_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                      </td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{run.passed ?? '—'}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{run.failed ?? '—'}</td>
                      <td style={{ color: '#94a3b8' }}>{run.total ?? '—'}</td>
                      <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                        {run.duration_ms || run.duration ? `${Math.round((run.duration_ms || run.duration) / 1000)}s` : '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {run.branch || '—'}
                      </td>
                      <td>
                        {run.report_url ? (
                          <a href={run.report_url} target="_blank" rel="noreferrer"
                            style={{ color: '#60a5fa', textDecoration: 'none', padding: '4px 12px', borderRadius: '6px', background: 'rgba(37,99,235,0.1)', fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.1)'}>
                            Open Report ↗
                          </a>
                        ) : <span style={{ color: '#475569', fontSize: '12px' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#475569', padding: '40px', fontSize: '14px' }}>No test runs yet. Click "Run Tests" to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {runsTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', padding: '12px' }}>
                <button onClick={() => fetchRuns(runsPage - 1)} disabled={runsPage <= 1}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #2a2a30', background: runsPage <= 1 ? '#0a0a0f' : '#121218', color: runsPage <= 1 ? '#2a2a30' : '#94a3b8', cursor: runsPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '13px', transition: 'all 0.15s' }}>
                  ← Previous
                </button>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Page {runsPage} of {runsTotalPages} <span style={{ color: '#475569', marginLeft: '6px' }}>({runsTotal} runs)</span></span>
                <button onClick={() => fetchRuns(runsPage + 1)} disabled={runsPage >= runsTotalPages}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #2a2a30', background: runsPage >= runsTotalPages ? '#0a0a0f' : '#121218', color: runsPage >= runsTotalPages ? '#2a2a30' : '#94a3b8', cursor: runsPage >= runsTotalPages ? 'not-allowed' : 'pointer', fontSize: '13px', transition: 'all 0.15s' }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* ======= CHATBOT ======= */}
        {activeMenu === 'chat' && !selectedSession && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 700 }}>🤖 Chatbot</h1>
                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>AI-powered assistant for test automation</p>
              </div>
              <button onClick={() => setShowSessionModal(true)}
                style={{ ...styles.btn, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white' }}>
                + New Session
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', top: '12px' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search sessions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...styles.input, paddingLeft: '40px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
              {sessions.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', marginTop: '60px' }}>
                  <p style={{ fontSize: '38px', margin: 0, lineHeight: 1 }}>💬</p>
                  <p style={{ fontSize: '16px', marginTop: '16px' }}>No sessions yet</p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>Create a session to start chatting with the AI assistant</p>
                </div>
              )}

              {sessions.map((s) => (
                <div key={s.id}>
                  {renamingSession === s.id ? (
                    <div style={styles.card}>
                      <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSession(s.id, renameValue); if (e.key === 'Escape') setRenamingSession(null); }}
                        autoFocus style={styles.input} onClick={(e) => e.stopPropagation()} />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleRenameSession(s.id, renameValue); }}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                        <button onClick={(e) => { e.stopPropagation(); setRenamingSession(null); }}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #2a2a30', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => handleSessionClick(s)} onContextMenu={(e) => handleSessionContextMenu(e, s)}
                      style={{ ...styles.card, borderColor: selectedSession?.id === s.id ? '#2563eb' : '#1e1e2a', cursor: 'pointer' }}
                      onMouseEnter={(e) => { if (selectedSession?.id !== s.id) e.currentTarget.style.borderColor = '#2a2a30'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = selectedSession?.id === s.id ? '#2563eb' : '#1e1e2a'; }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ background: '#1a1a24', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', color: '#64748b' }}>{s.model}</span>
                        <span style={{ fontSize: '11px', color: '#475569' }}>
                          {s.created_at ? new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: '#e2e8f0' }}>
                        {s.title || s.prompt?.slice(0, 60)}
                        {(s.title?.length > 60 || (!s.title && s.prompt?.length > 60)) ? '...' : ''}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '12px', display: 'flex', gap: '12px' }}>
                          <span style={{ textTransform: 'capitalize', color: s.status === 'active' ? '#22c55e' : '#64748b' }}>● {s.status}</span>
                          {s.message_count && <span style={{ color: '#64748b' }}>{s.message_count} messages</span>}
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
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #1a1a24', marginBottom: '16px', flexShrink: 0 }}>
              <button onClick={handleBackToSessions}
                style={{ background: 'none', border: '1px solid #2a2a30', color: '#94a3b8', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#475569'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a30'}>
                ← Back
              </button>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{selectedSession.title || `${selectedSession.model} Session`}</h2>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>{selectedSession.model}</span>
                  <span>•</span>
                  <span>{sessionMessages.length} messages</span>
                </div>
              </div>
            </div>

            <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
              {sessionMessages.length === 0 && !aiThinking && (
                <div style={{ textAlign: 'center', color: '#475569', marginTop: '60px' }}>
                  <p style={{ fontSize: '38px', margin: 0, lineHeight: 1 }}>💬</p>
                  <p style={{ marginTop: '12px' }}>No messages yet. Start the conversation!</p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>Ask about test automation, Playwright, or QA strategies</p>
                </div>
              )}

              {sessionMessages.map((msg, idx) => (
                <div key={msg.id || idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', position: 'relative' }}
                  onMouseEnter={(e) => { const d = e.currentTarget.querySelector('.msg-del'); if (d) d.style.opacity = '1'; }}
                  onMouseLeave={(e) => { const d = e.currentTarget.querySelector('.msg-del'); if (d) d.style.opacity = '0'; }}>
                  <div style={msg.role === 'user' ? styles.userBubble : styles.aiBubble}>
                    <div className="msg-del" onClick={() => setDeletingMsgId(msg.id)}
                      style={{ position: 'absolute', top: '-6px', right: msg.role === 'user' ? '-6px' : 'auto', left: msg.role === 'user' ? 'auto' : '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#2a2a30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s', border: '1px solid #444', color: '#64748b' }} title="Delete message">✕</div>
                    {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} /> : <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
                    {msg.created_at && <div style={{ fontSize: '10px', opacity: 0.4, marginTop: '6px', textAlign: 'right' }}>{new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>}
                  </div>
                </div>
              ))}

              {aiThinking && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid #1a1a24', marginTop: '16px', flexShrink: 0 }}>
              <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)" rows={2}
                disabled={sendingMessage || aiThinking}
                style={{ ...styles.input, resize: 'none', opacity: sendingMessage || aiThinking ? 0.5 : 1 }} />
              <button onClick={handleSendMessage} disabled={!newMessage.trim() || sendingMessage || aiThinking}
                style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: newMessage.trim() && !sendingMessage && !aiThinking ? 'pointer' : 'not-allowed', background: newMessage.trim() && !sendingMessage && !aiThinking ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#1e1e2a', color: 'white', fontSize: '14px', alignSelf: 'flex-end', opacity: newMessage.trim() && !sendingMessage && !aiThinking ? 1 : 0.4, transition: 'all 0.2s' }}>
                {sendingMessage ? '⏳' : aiThinking ? '⏳' : 'Send →'}
              </button>
            </div>
          </div>
        )}

        {/* ======= ADMIN - ORGS + MEMBERS ======= */}
        {activeMenu === 'admin' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 700 }}>🏢 Admin</h1>
                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>Manage organizations and team members</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setShowPendingUsers(true); fetchPendingUsers(); }}
                  style={{ ...styles.btn, background: 'transparent', border: '1px solid #2a2a30', color: '#94a3b8' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#475569'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a30'}>
                  👥 Pending Users {pendingUsers.length > 0 && <span style={{ background: '#f59e0b', color: '#0a0a0f', borderRadius: '50%', padding: '1px 7px', fontSize: '11px', fontWeight: 700, marginLeft: '6px' }}>{pendingUsers.length}</span>}
                </button>
                <button onClick={handleOpenCreateOrg}
                  style={{ ...styles.btn, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white' }}>
                  + New Organization
                </button>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', top: '12px' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search orgs by name, slug, or email..." value={orgSearchQuery} onChange={(e) => setOrgSearchQuery(e.target.value)} style={{ ...styles.input, paddingLeft: '40px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
              {orgs.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', marginTop: '60px' }}>
                  <p style={{ fontSize: '16px' }}>No organizations yet</p>
                  <p style={{ fontSize: '13px' }}>Create an organization to manage subscriptions and sessions</p>
                </div>
              )}

              {orgs.map((org) => (
                <div key={org.id} style={{ ...styles.card, cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#e2e8f0' }}>{org.name}</h3>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', background: org.plan === 'paid' ? 'rgba(34,197,94,0.1)' : '#1e1e2a', color: org.plan === 'paid' ? '#22c55e' : '#64748b' }}>{org.plan}</span>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 500, background: org.status === 'active' ? 'rgba(34,197,94,0.1)' : org.status === 'suspended' ? 'rgba(239,68,68,0.1)' : '#1e1e2a', color: org.status === 'active' ? '#22c55e' : org.status === 'suspended' ? '#ef4444' : '#64748b' }}>{org.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#64748b' }}>
                        <span>/{org.slug}</span>
                        {org.email && <span>{org.email}</span>}
                        <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleOpenEditOrg(org)}
                        style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #2a2a30', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#60a5fa'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a30'}>✏️ Edit</button>
                      <button onClick={() => setDeleteOrgConfirm(org.id)} disabled={org.slug === 'default'}
                        style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #2a2a30', background: 'transparent', color: org.slug === 'default' ? '#2a2a30' : '#f87171', cursor: org.slug === 'default' ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: org.slug === 'default' ? 0.5 : 1, transition: 'all 0.15s' }}
                        onMouseEnter={(e) => { if (org.slug !== 'default') e.currentTarget.style.borderColor = '#f87171'; }} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a30'}>🗑️ Delete</button>
                    </div>
                  </div>

                  <div onClick={() => handleOrgClick(org.id)} style={{ display: 'flex', gap: '24px', padding: '12px', background: '#0a0a0f', borderRadius: '8px', marginTop: '4px', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#60a5fa' }}>{orgStats[org.id]?.session_count ?? '...'}</div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>Sessions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#22c55e' }}>{orgStats[org.id]?.active_sessions ?? '...'}</div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>Active</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b' }}>{orgStats[org.id]?.test_run_count ?? '...'}</div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>Test Runs</div>
                    </div>
                  </div>

                  {/* Members section */}
                  <div style={{ marginTop: '12px' }}>
                    <button onClick={() => handleToggleMembers(org.id)}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: expandedOrgMembers[org.id] ? 'rotate(90deg)' : 'none' }}>▶</span>
                      {expandedOrgMembers[org.id] ? 'Hide' : 'Show'} Members
                    </button>
                    {expandedOrgMembers[org.id] && (
                      <div style={{ marginTop: '8px', padding: '12px', background: '#0a0a0f', borderRadius: '8px' }}>
                        {(orgMembers[org.id] || []).length === 0 ? (
                          <div style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '16px' }}>No members in this org</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(orgMembers[org.id] || []).map((member) => (
                              <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#121218', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                                    {(member.profile?.full_name?.[0] || member.profile?.email?.[0] || '?').toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{member.profile?.full_name || member.profile?.email || 'Unknown'}</div>
                                    <div style={{ fontSize: '11px', color: '#475569' }}>{member.role} · {member.profile?.email || ''}</div>
                                  </div>
                                </div>
                                <button onClick={() => handleRemoveMember(org.id, member.user_id)}
                                  style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #2a2a30', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}
                                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#f87171'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a30'}>Remove</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <SessionContextMenu x={contextMenu.x} y={contextMenu.y}
          onRename={() => { setRenamingSession(contextMenu.session.id); setRenameValue(contextMenu.session.title || contextMenu.session.prompt?.slice(0, 60) || 'Session'); setContextMenu(null); }}
          onDelete={() => { setDeleteConfirm(contextMenu.session.id); setContextMenu(null); }}
          onClose={() => setContextMenu(null)} />
      )}

      {/* Delete Confirmations */}
      {deleteConfirm && typeof deleteConfirm === 'number' && (
        <ConfirmDialog message="Are you sure you want to delete this session? All messages will be permanently removed."
          onConfirm={() => handleDeleteSession(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      )}
      {deletingMsgId && (
        <ConfirmDialog message="Delete this message?" onConfirm={() => handleDeleteMessage(deletingMsgId)} onCancel={() => setDeletingMsgId(null)} />
      )}
      {deleteOrgConfirm && (
        <ConfirmDialog message="Are you sure you want to delete this organization? Its sessions and test runs will be reassigned to the default org."
          onConfirm={() => handleDeleteOrg(deleteOrgConfirm)} onCancel={() => setDeleteOrgConfirm(null)} />
      )}

      {/* Pending Users Modal */}
      {showPendingUsers && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => { setShowPendingUsers(false); setAssigningUser(null); }}>
          <div style={{ background: '#121218', padding: '28px', borderRadius: '16px', width: '560px', border: '1px solid #1e1e2a', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>👥 Pending Users</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Users who haven't been assigned to any organization yet</p>

            {pendingUsers.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#475569', padding: '40px' }}>
                <p style={{ fontSize: '14px' }}>No pending users</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>All registered users have been assigned to an organization.</p>
              </div>
            ) : (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {pendingUsers.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0a0a0f', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', flexShrink: 0, color: '#0a0a0f' }}>
                        {(u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>{u.full_name || 'No name'}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      {assigningUser === u.id ? (
                        <>
                          <select value={selectedOrgForAssignment} onChange={(e) => setSelectedOrgForAssignment(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '6px', background: '#0a0a0f', color: '#e2e8f0', border: '1px solid #2a2a30', fontSize: '12px' }}>
                            <option value="">Select org...</option>
                            {orgs.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
                          </select>
                          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '6px', background: '#0a0a0f', color: '#e2e8f0', border: '1px solid #2a2a30', fontSize: '12px' }}>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button onClick={handleAssignUser} disabled={!selectedOrgForAssignment}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: selectedOrgForAssignment ? '#2563eb' : '#1e1e2a', color: 'white', cursor: selectedOrgForAssignment ? 'pointer' : 'not-allowed', fontSize: '12px', opacity: selectedOrgForAssignment ? 1 : 0.5 }}>
                            Assign
                          </button>
                          <button onClick={() => setAssigningUser(null)}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #2a2a30', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                        </>
                      ) : (
                        <button onClick={() => { setAssigningUser(u.id); setSelectedOrgForAssignment(''); setSelectedRole('member'); }}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #2563eb', background: 'transparent', color: '#60a5fa', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          + Assign to Org
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => { setShowPendingUsers(false); setAssigningUser(null); }}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #2a2a30', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Org Modal */}
      {showOrgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => { setShowOrgModal(false); resetOrgForm(); }}>
          <div style={{ background: '#121218', padding: '28px', borderRadius: '16px', width: '520px', border: '1px solid #1e1e2a', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{editOrg ? 'Edit Organization' : 'Create Organization'}</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>{editOrg ? 'Update organization details' : 'Add a new organization'}</p>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>Name *</label>
                <input type="text" value={orgForm.name} onChange={(e) => handleOrgFormChange('name', e.target.value)} placeholder="Acme Corp" style={{ ...styles.input, marginTop: '6px' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>Slug *</label>
                <input type="text" value={orgForm.slug} onChange={(e) => handleOrgFormChange('slug', e.target.value.replace(/\s+/g, '-').toLowerCase())} placeholder="acme-corp" disabled={!!editOrg}
                  style={{ ...styles.input, marginTop: '6px', opacity: editOrg ? 0.5 : 1 }} />
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>URL-friendly identifier. Cannot be changed after creation.</div>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>Email</label>
                <input type="email" value={orgForm.email} onChange={(e) => handleOrgFormChange('email', e.target.value)} placeholder="admin@acme.com" style={{ ...styles.input, marginTop: '6px' }} />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>Plan</label>
                  <select value={orgForm.plan} onChange={(e) => handleOrgFormChange('plan', e.target.value)} style={styles.select}>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>Status</label>
                  <select value={orgForm.status} onChange={(e) => handleOrgFormChange('status', e.target.value)} style={styles.select}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '28px' }}>
              <button onClick={() => { setShowOrgModal(false); resetOrgForm(); }}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #2a2a30', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={handleSaveOrg} disabled={!orgForm.name.trim() || !orgForm.slug.trim()}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: orgForm.name.trim() && orgForm.slug.trim() ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#1e1e2a', color: 'white', cursor: orgForm.name.trim() && orgForm.slug.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', opacity: orgForm.name.trim() && orgForm.slug.trim() ? 1 : 0.5 }}>
                {editOrg ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showSessionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => { setShowSessionModal(false); setSessionPrompt(''); }}>
          <div style={{ background: '#121218', padding: '28px', borderRadius: '16px', width: '520px', border: '1px solid #1e1e2a', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Create Session</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Start a new AI-powered chat session</p>

            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>Prompt</label>
              <textarea value={sessionPrompt} onChange={(e) => setSessionPrompt(e.target.value)} rows={4}
                placeholder="Generate Playwright tests for login page..."
                style={{ ...styles.input, marginTop: '8px', resize: 'vertical', minHeight: '80px' }} />
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>Model</label>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={styles.select}>
                <option value="groq">Groq (mixtral-8x7b)</option>
                <option value="gpt">GPT</option>
                <option value="sonnet">Sonnet</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '28px' }}>
              <button onClick={() => { setShowSessionModal(false); setSessionPrompt(''); }}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #2a2a30', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={handleCreateSession} disabled={!sessionPrompt.trim()}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: sessionPrompt.trim() ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#1e1e2a', color: 'white', cursor: sessionPrompt.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', opacity: sessionPrompt.trim() ? 1 : 0.5 }}>
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