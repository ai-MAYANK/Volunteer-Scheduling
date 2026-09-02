import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';

function CreateProgramForm({ onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/programs', { name, description });
      setName(''); setDescription('');
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'failed to create program');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 16, padding: 12, border: '1px solid #ccc' }}>
      <h4>Create a program</h4>
      <input placeholder="Program name" value={name} onChange={e => setName(e.target.value)} required style={{ display: 'block', marginBottom: 8, padding: 6, width: '100%' }} />
      <input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} style={{ display: 'block', marginBottom: 8, padding: 6, width: '100%' }} />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit">Create Program</button>
    </form>
  );
}

export default function Shifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ programId: '', title: '', startTime: '', endTime: '', capacity: 5 });
  const [error, setError] = useState('');

  const loadShifts = async () => {
  try {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    const res = await api.get('/shifts', { params });
    setShifts(res.data.data || []);
  } catch (err) {
    console.error('Failed to load shifts:', err);
    setShifts([]);
  }
};

  const loadPrograms = async () => {
  try {
    const res = await api.get('/programs');
    setPrograms(res.data || []);
  } catch (err) {
    console.error('Failed to load programs:', err);
    setPrograms([]);
  }
};

  useEffect(() => { loadShifts(); loadPrograms(); }, [search, status]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/shifts', form);
      setShowForm(false);
      setForm({ programId: '', title: '', startTime: '', endTime: '', capacity: 5 });
      loadShifts();
    } catch (err) {
      setError(err.response?.data?.error || 'failed to create shift');
    }
  };

  const handleJoinProgram = async (programId) => {
    try {
      await api.post(`/programs/${programId}/join`);
      alert('joined program');
    } catch (err) {
      alert(err.response?.data?.error || 'failed to join');
    }
  };

  return (
    <div>
      <h2>Shifts</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Search title..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: 6 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: 6 }}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="PARTIALLY_FILLED">Partially Filled</option>
          <option value="FILLED">Filled</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {user.role === 'COORDINATOR' && (
        <div style={{ marginBottom: 16 }}>
          <CreateProgramForm onCreated={loadPrograms} />
          <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Shift'}</button>
          {showForm && (
            <form onSubmit={handleCreate} style={{ marginTop: 12, padding: 12, border: '1px solid #ddd' }}>
              <select value={form.programId} onChange={e => setForm({ ...form, programId: e.target.value })} required style={{ display: 'block', marginBottom: 8, padding: 6, width: '100%' }}>
                <option value="">Select program</option>
                {programs.filter(p => p.coordinatorId === user.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={{ display: 'block', marginBottom: 8, padding: 6, width: '100%' }} />
              <label>Start: <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required style={{ padding: 6, marginBottom: 8 }} /></label><br/>
              <label>End: <input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} required style={{ padding: 6, marginBottom: 8 }} /></label><br/>
              <label>Capacity: <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required style={{ padding: 6, marginBottom: 8 }} /></label>
              {error && <p style={{ color: 'red' }}>{error}</p>}
              <button type="submit">Create Shift</button>
            </form>
          )}
        </div>
      )}

      <div>
        {shifts.map(s => (
          <div key={s.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 8, borderRadius: 4 }}>
            <Link to={`/shifts/${s.id}`}><strong>{s.title}</strong></Link> — {s.program?.name}
            <div>{new Date(s.startTime).toLocaleString()} → {new Date(s.endTime).toLocaleString()}</div>
            <div>Status: <b>{s.fillStatus}</b> ({s.signups.length}/{s.capacity})</div>
          </div>
        ))}
        {shifts.length === 0 && <p>No shifts found.</p>}
      </div>
    </div>
  );
}