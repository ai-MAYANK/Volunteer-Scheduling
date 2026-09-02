import { useState, useEffect } from 'react';
import api from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    api.get('/dashboard').then(res => setStats(res.data));
    api.get('/alerts/understaffed').then(res => setAlerts(res.data));
  }, []);

  if (!stats) return <p>Loading...</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Stat label="Programs" value={stats.totalPrograms} />
        <Stat label="Total Shifts" value={stats.totalShifts} />
        <Stat label="Open" value={stats.openShifts} />
        <Stat label="Partially Filled" value={stats.partiallyFilledShifts} />
        <Stat label="Filled" value={stats.filledShifts} />
        <Stat label="Volunteers" value={stats.totalVolunteers} />
      </div>

      <h3>Understaffed shifts (next 48h)</h3>
      {alerts.length === 0 && <p>None — you're fully staffed for the next 48 hours.</p>}
      {alerts.map(a => (
        <div key={a.id} style={{ border: '1px solid orange', padding: 8, marginBottom: 8 }}>
          <b>{a.title}</b> ({a.programName}) — {a.filled}/{a.capacity} filled, {a.spotsOpen} spots open
          <div>{new Date(a.startTime).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 4, minWidth: 100 }}>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</div>
      <div>{label}</div>
    </div>
  );
}