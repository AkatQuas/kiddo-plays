import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <Layout>
      <section className="hero">
        <h1>Passwordless Authentication with Passkeys</h1>
        <p>
          A demo web app showing the full Passkey lifecycle: register, login, protected pages,
          logout, and passkey management. Sessions are stored in Redis via HttpOnly cookies.
        </p>
        <div className="actions">
          {user ? (
            <Link to="/dashboard" className="btn primary">Go to Dashboard</Link>
          ) : (
            <>
              <Link to="/register" className="btn primary">Get Started</Link>
              <Link to="/login" className="btn secondary">Sign In</Link>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
