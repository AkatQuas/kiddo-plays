import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
