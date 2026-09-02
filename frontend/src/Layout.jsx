import { Outlet, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: 20 }}>
      <nav style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid #ddd', paddingBottom: 12 }}>
        <Link to="/">Shifts</Link>
        {user?.role === 'COORDINATOR' && <Link to="/dashboard">Dashboard</Link>}
        <span style={{ marginLeft: 'auto' }}>
          {user?.name} ({user?.role}) <button onClick={logout}>Logout</button>
        </span>
      </nav>
      <Outlet />
    </div>
  );
}