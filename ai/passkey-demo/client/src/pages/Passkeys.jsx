import { useCallback, useEffect, useState } from 'react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';

function friendlyError(code, message) {
  const map = {
    LAST_PASSKEY: 'Cannot delete your last passkey. You would be unable to sign in.',
    CHALLENGE_EXPIRED: 'Passkey registration expired. Please try again.',
    USER_CANCELLED: 'Registration was cancelled.',
    RATE_LIMITED: 'Too many attempts. Please wait and try again.',
  };
  return map[code] || message || 'Something went wrong.';
}

const LOCAL_PASSKEY_NOTE =
  'Deleting a passkey only removes it from this app\'s server. It may still appear in your browser or system passkey store. To remove it from this device, delete it manually in your browser or OS password manager (e.g. Chrome → Password Manager → Passkeys, Safari → Passwords).';

const DELETE_SUCCESS_MESSAGE =
  'Passkey removed from the server. It may still appear in your browser profile—delete it manually in browser or system passkey settings if you want it gone from this device.';

export default function Passkeys() {
  const [passkeys, setPasskeys] = useState([]);
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const supported = browserSupportsWebAuthn();

  const loadPasskeys = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/api/passkeys');
    if (res.ok) {
      setPasskeys(res.data.passkeys);
    } else {
      setError(res.error?.message || 'Failed to load passkeys');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  async function handleAdd() {
    setError('');
    setMessage('');
    setBusy(true);

    try {
      const begin = await api.post('/api/passkeys/begin', {});
      if (!begin.ok) {
        setError(friendlyError(begin.error?.code, begin.error?.message));
        return;
      }

      const credential = await startRegistration({ optionsJSON: begin.data });
      const finish = await api.post('/api/passkeys/finish', {
        credential,
        deviceName: deviceName.trim() || undefined,
      });

      if (!finish.ok) {
        setError(friendlyError(finish.error?.code, finish.error?.message));
        return;
      }

      setDeviceName('');
      setMessage('Passkey added successfully.');
      await loadPasskeys();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError(friendlyError('USER_CANCELLED'));
      } else {
        setError(err.message || 'Failed to add passkey.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id, isLast) {
    if (isLast) {
      setError(friendlyError('LAST_PASSKEY'));
      return;
    }

    const confirmMessage =
      'Delete this passkey from the server? You will not be able to sign in with it again.\n\n' +
      LOCAL_PASSKEY_NOTE;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setError('');
    setMessage('');
    const res = await api.delete(`/api/passkeys/${encodeURIComponent(id)}`);
    if (!res.ok) {
      setError(friendlyError(res.error?.code, res.error?.message));
      return;
    }
    setMessage(DELETE_SUCCESS_MESSAGE);
    await loadPasskeys();
  }

  return (
    <Layout>
      <div className="card">
        <h1>Passkeys</h1>
        <p className="muted">Manage the passkeys registered to your account.</p>

        <div className="alert info">{LOCAL_PASSKEY_NOTE}</div>

        {!supported && (
          <div className="alert warn">
            Your browser does not support WebAuthn on this device.
          </div>
        )}

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <section className="section">
          <h2>Add Passkey</h2>
          <div className="inline-form">
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Device name (optional)"
              disabled={busy || !supported}
            />
            <button
              type="button"
              className="btn primary"
              onClick={handleAdd}
              disabled={busy || !supported}
            >
              {busy ? 'Waiting for device…' : 'Add Passkey'}
            </button>
          </div>
        </section>

        <section className="section">
          <h2>Registered Passkeys</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : passkeys.length === 0 ? (
            <p className="muted">No passkeys found.</p>
          ) : (
            <ul className="passkey-list">
              {passkeys.map((pk) => {
                const isLast = passkeys.length === 1;
                return (
                  <li key={pk.id} className="passkey-item">
                    <div>
                      <strong>{pk.deviceName}</strong>
                      <div className="muted small">
                        Added {new Date(pk.createdAt).toLocaleString()}
                        {pk.lastUsedAt && ` · Last used ${new Date(pk.lastUsedAt).toLocaleString()}`}
                      </div>
                      <div className="muted small">
                        {pk.backedUp ? 'Synced (multi-device)' : 'This device only'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn danger"
                      disabled={isLast}
                      title={isLast ? 'Cannot delete your last passkey' : 'Delete passkey from server'}
                      onClick={() => handleDelete(pk.id, isLast)}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
