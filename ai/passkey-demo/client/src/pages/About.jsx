import Layout from '../components/Layout.jsx';

export default function About() {
  return (
    <Layout>
      <article className="card">
        <h1>About This Demo</h1>
        <p>
          This application demonstrates WebAuthn Passkey authentication with an Express backend
          and React SPA frontend. All persistent data lives in Redis — no relational database, no JWT.
        </p>
        <h2>Architecture</h2>
        <ul>
          <li><strong>Frontend:</strong> React SPA with route guards (AuthContext + ProtectedRoute)</li>
          <li><strong>Backend:</strong> Express with session middleware and requireAuth on protected APIs</li>
          <li><strong>Storage:</strong> Redis keys for users, credentials, sessions (24h TTL), and challenges (5min TTL)</li>
          <li><strong>Auth:</strong> HttpOnly session cookie — not accessible to JavaScript (XSS resistant)</li>
        </ul>
        <h2>Security Highlights</h2>
        <ul>
          <li>Server-generated one-time challenges with 5-minute expiry</li>
          <li>Signature verification with stored public keys</li>
          <li>Monotonic counter checks to detect cloned credentials</li>
          <li>Rate limiting on WebAuthn begin/finish endpoints</li>
          <li>SameSite=Lax cookies for CSRF mitigation</li>
        </ul>
      </article>
    </Layout>
  );
}
