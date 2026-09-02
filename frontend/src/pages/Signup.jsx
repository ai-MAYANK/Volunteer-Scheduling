import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('VOLUNTEER');
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signup(name, email, password, role);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'signup failed');
    }
  };

  return (
    <div style={{ maxWidth: 340, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h2>Sign up</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
        <select value={role} onChange={e => setRole(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}>
          <option value="VOLUNTEER">Volunteer</option>
          <option value="COORDINATOR">Coordinator</option>
        </select>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ width: '100%', padding: 8 }}>Sign up</button>
      </form>
      <p>Have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}