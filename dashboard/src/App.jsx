import { useEffect, useState } from 'react';

function App() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState([]);

  const fetchRuns = async () => {
    try {
      const response = await fetch('http://localhost:7000/test-runs');

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
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        color: 'white',
        padding: '40px',
        fontFamily: 'Arial'
      }}
    >
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
        {loading ? 'Starting...' : '▶ Run Playwright Tests'}
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
    </div>
  );
}

export default App;