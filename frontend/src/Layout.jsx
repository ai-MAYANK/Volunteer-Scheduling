import { Outlet, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>
      <nav style={{ display: 'flex', gap: 16, marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #ccc' }}>
        <Link to="/">Shifts</Link>
        {user?.role === 'COORDINATOR' && <Link to="/dashboard">Dashboard</Link>}
        <span style={{ marginLeft: 'auto' }}>
          Logged in as {user?.name} ({user?.role}) &nbsp;
          <button onClick={logout}>Logout</button>
        </span>
      </nav>
      <Outlet />
    </div>
  );
}