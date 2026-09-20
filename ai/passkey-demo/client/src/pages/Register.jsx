import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

function friendlyError(code, message) {
  const map = {
    REGISTRATION_FAILED: 'Registration could not be completed. Try a different username.',
    CHALLENGE_EXPIRED: 'Registration session expired. Please try again.',
    USER_CANCELLED: 'Registration was cancelled.',
    INVALID_USERNAME: 'Username must be 3–32 characters: letters, numbers, _ or -',
    RATE_LIMITED: 'Too many attempts. Please wait and try again.',
  };
  return map[code] || message || 'Something went wrong.';
}

export default function Register() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const supported = browserSupportsWebAuthn();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const trimmed = username.trim();
      const begin = await api.post('/api/auth/register/begin', { username: trimmed });
      if (!begin.ok) {
        setError(friendlyError(begin.error?.code, begin.error?.message));
        return;
      }

      const credential = await startRegistration({ optionsJSON: begin.data });
      const finish = await api.post('/api/auth/register/finish', {
        username: trimmed,
        credential,
      });

      if (!finish.ok) {
        setError(friendlyError(finish.error?.code, finish.error?.message));
        return;
      }

      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError(friendlyError('USER_CANCELLED'));
      } else {
        setError(err.message || 'Registration failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="card narrow">
        <h1>Create Account</h1>
        <p className="muted">Choose a username and register a Passkey on this device.</p>

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
            autoComplete="username"
            required
            disabled={busy || !supported}
          />
          {error && <div className="alert error">{error}</div>}
          <button type="submit" className="btn primary" disabled={busy || !supported}>
            {busy ? 'Waiting for device…' : 'Register Passkey'}
          </button>
        </form>

        <p className="muted center">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </Layout>
  );
}
