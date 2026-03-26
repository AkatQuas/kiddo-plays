import UserMenu from './components/UserMenu';

export default function App() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        User Module
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        This is a remote Module Federation app that exposes user/auth components.
      </p>
      <UserMenu />
    </div>
  );
}
