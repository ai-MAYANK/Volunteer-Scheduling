import { useState, useEffect } from "react";
import api from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const loadAlerts = async () => {
    const res = await api.get("/alerts/understaffed");
    setAlerts(res.data);
  };

  useEffect(() => {
    api.get("/dashboard").then((res) => setStats(res.data));
    loadAlerts();
  }, []);

  const handleDismiss = async (shiftId) => {
    try {
      await api.post(`/alerts/${shiftId}/dismiss`);
      loadAlerts();
    } catch (err) {
      alert(err.response?.data?.error || "failed to dismiss");
    }
  };

  if (!stats) return <p>Loading...</p>;

  const maxSignups = Math.max(
    ...stats.weeklySignupChart.map((w) => w.signups),
    1,
  );

  return (
    <div>
      <h2>Welcome back, {JSON.parse(localStorage.getItem("user"))?.name}</h2>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Stat label="Shifts this week" value={stats.shiftsThisWeek} />
        <Stat label="Open this week" value={stats.openShiftsThisWeek} />
        <Stat label="Signups this week" value={stats.signupsThisWeek} />
        <Stat label="Closed this week" value={stats.closedShiftsThisWeek} />
      </div>

      <h3>By fill state</h3>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Stat label="Open" value={stats.byFillState.OPEN} />
        <Stat
          label="Partially Filled"
          value={stats.byFillState.PARTIALLY_FILLED}
        />
        <Stat label="Filled" value={stats.byFillState.FILLED} />
        <Stat label="Closed" value={stats.byFillState.CLOSED} />
      </div>

      <h3>By program</h3>
      <table
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #999", textAlign: "left" }}>
            <th style={{ padding: "6px 4px" }}>Program</th>
            <th style={{ padding: "6px 4px" }}>Total shifts</th>
            <th style={{ padding: "6px 4px" }}>Open shifts</th>
          </tr>
        </thead>
        <tbody>
          {stats.byProgram.map((p) => (
            <tr key={p.programName} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "6px 4px" }}>{p.programName}</td>
              <td style={{ padding: "6px 4px" }}>{p.totalShifts}</td>
              <td style={{ padding: "6px 4px" }}>{p.openShifts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Signups per week (last 8 weeks)</h3>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          height: 120,
          marginBottom: 24,
          borderBottom: "1px solid #999",
        }}
      >
        {stats.weeklySignupChart.map((w) => (
          <div key={w.weekStart} style={{ textAlign: "center", fontSize: 11 }}>
            <div
              style={{
                height: `${(w.signups / maxSignups) * 100}px`,
                width: 30,
                background: "#999",
                marginBottom: 4,
              }}
            />
            {w.signups}
          </div>
        ))}
      </div>

      <h3>Understaffed shifts (next 3 days) — {alerts.length}</h3>
      {alerts.length === 0 && (
        <p>None — you're fully staffed for the next 3 days.</p>
      )}
      {alerts.map((a) => (
        <div
          key={a.id}
          style={{ border: "1px solid orange", padding: 8, marginBottom: 8 }}
        >
          <b>{a.title}</b> ({a.programName}, {a.location}) — {a.filled}/
          {a.capacity} filled, {a.spotsOpen} spots open
          <div>{new Date(a.startTime).toLocaleString()}</div>
          <button onClick={() => handleDismiss(a.id)} style={{ marginTop: 4 }}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #999",
        padding: "10px 16px",
        minWidth: 110,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: "bold" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
    </div>
  );
}
