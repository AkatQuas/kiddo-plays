import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

function friendlyError(code, message) {
  const map = {
    AUTH_FAILED: 'Authentication failed. Check your username and try again.',
    CHALLENGE_EXPIRED: 'Login session expired. Please try again.',
    USER_CANCELLED: 'Authentication was cancelled.',
    RATE_LIMITED: 'Too many attempts. Please wait and try again.',
  };
  return map[code] || message || 'Something went wrong.';
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const supported = browserSupportsWebAuthn();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const begin = await api.post('/api/auth/login/begin', { username: username.trim() });
      if (!begin.ok) {
        setError(friendlyError(begin.error?.code, begin.error?.message));
        return;
      }

      const credential = await startAuthentication({ optionsJSON: begin.data });
      const finish = await api.post('/api/auth/login/finish', {
        username: username.trim(),
        credential,
      });

      if (!finish.ok) {
        setError(friendlyError(finish.error?.code, finish.error?.message));
        return;
      }

      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError(friendlyError('USER_CANCELLED'));
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="card narrow">
        <h1>Sign In with Passkey</h1>
        <p className="muted">Enter your username, then verify with your device.</p>

        {!supported && (
          <div className="alert warn">
            Your browser does not support WebAuthn. Try Chrome, Safari, or Edge on localhost.
          </div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-username"
            autoComplete="username webauthn"
            required
            disabled={busy || !supported}
          />
          {error && <div className="alert error">{error}</div>}
          <button type="submit" className="btn primary" disabled={busy || !supported}>
            {busy ? 'Waiting for device…' : 'Continue with Passkey'}
          </button>
        </form>

        <p className="muted center">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </Layout>
  );
}
