import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">
          Passkey Demo
        </Link>
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/about">About</NavLink>
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/passkeys">Passkeys</NavLink>
              <button type="button" className="btn-link" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
