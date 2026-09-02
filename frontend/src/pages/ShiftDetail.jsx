import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function ShiftDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [shift, setShift] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api.get(`/shifts/${id}`);
    setShift(res.data);
  };

  useEffect(() => { load(); }, [id]);

  const isSignedUp = shift?.signups.some(s => s.volunteerId === user.id);
  const isWaitlisted = shift?.waitlist.some(w => w.volunteerId === user.id);

  const handleSignup = async () => {
    setError(''); setMessage('');
    try {
      const res = await api.post(`/shifts/${id}/signup`);
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || 'failed'); }
  };

  const handleCancel = async () => {
    setError(''); setMessage('');
    try {
      const res = await api.delete(`/shifts/${id}/signup`);
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || 'failed'); }
  };

  const handleClaim = async () => {
    setError(''); setMessage('');
    try {
      const res = await api.post(`/shifts/${id}/claim`);
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || 'failed'); }
  };

  const handleDownloadRoster = () => {
    const token = localStorage.getItem('token');
    window.open(`http://localhost:4000/api/shifts/${id}/roster.csv?token=${token}`, '_blank');
    // note: this simple approach works for demo; a production app would fetch with auth header and trigger a blob download
  };

  if (!shift) return <p>Loading...</p>;

  return (
    <div>
      <h2>{shift.title}</h2>
      <p>{shift.program?.name}</p>
      <p>{new Date(shift.startTime).toLocaleString()} → {new Date(shift.endTime).toLocaleString()}</p>
      <p>Status: <b>{shift.fillStatus}</b> ({shift.signups.length}/{shift.capacity})</p>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {user.role === 'VOLUNTEER' && !isSignedUp && !isWaitlisted && (
        <button onClick={handleSignup}>Sign up</button>
      )}
      {user.role === 'VOLUNTEER' && isSignedUp && (
        <button onClick={handleCancel}>Cancel my signup</button>
      )}
      {user.role === 'VOLUNTEER' && isWaitlisted && (
        <button onClick={handleClaim}>Claim spot (you're on the waitlist)</button>
      )}

      {user.role === 'COORDINATOR' && (
        <button onClick={handleDownloadRoster} style={{ marginLeft: 8 }}>Download roster CSV</button>
      )}

      <h3>Signed up ({shift.signups.length})</h3>
      <ul>{shift.signups.map(s => <li key={s.id}>{s.volunteer.name} ({s.volunteer.email})</li>)}</ul>

      <h3>Waitlist ({shift.waitlist.length})</h3>
      <ul>{shift.waitlist.map(w => <li key={w.id}>volunteer id: {w.volunteerId}</li>)}</ul>
    </div>
  );
}