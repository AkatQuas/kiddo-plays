import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [protectedData, setProtectedData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/protected/data').then((res) => {
      if (res.ok) {
        setProtectedData(res.data);
      } else {
        setError(res.error?.message || 'Failed to load protected data');
      }
    });
  }, []);

  return (
    <Layout>
      <div className="card">
        <h1>Dashboard</h1>
        <p className="muted">Welcome back, <strong>{user?.displayName || user?.username}</strong></p>

        <div className="info-grid">
          <div className="info-item">
            <span className="label">User ID</span>
            <code>{user?.userId}</code>
          </div>
          <div className="info-item">
            <span className="label">Username</span>
            <span>{user?.username}</span>
          </div>
          <div className="info-item">
            <span className="label">Member since</span>
            <span>{user?.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</span>
          </div>
        </div>

        <h2>Protected API</h2>
        {error && <div className="alert error">{error}</div>}
        {protectedData && (
          <pre className="code-block">{JSON.stringify(protectedData, null, 2)}</pre>
        )}

        <div className="actions">
          <Link to="/passkeys" className="btn primary">Manage Passkeys</Link>
          <button type="button" className="btn secondary" onClick={logout}>Logout</button>
        </div>
      </div>
    </Layout>
  );
}
