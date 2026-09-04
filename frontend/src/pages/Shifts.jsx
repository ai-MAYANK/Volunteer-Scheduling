import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext";

export default function Shifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");

  const loadShifts = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      if (date) params.date = date;
      const res = await api.get("/shifts", { params });
      setShifts(res.data.data || []);
    } catch (err) {
      console.error(err);
      setShifts([]);
    }
  };

  useEffect(() => { loadShifts(); }, [search, status, date]);

  return (
    <div>
      <h2>Shifts</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Search title or location..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="PARTIALLY_FILLED">Partially Filled</option>
          <option value="FILLED">Filled</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #999", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Shift</th>
            <th style={{ padding: "8px 4px" }}>Program</th>
            <th style={{ padding: "8px 4px" }}>Location</th>
            <th style={{ padding: "8px 4px" }}>When</th>
            <th style={{ padding: "8px 4px" }}>Status</th>
            <th style={{ padding: "8px 4px" }}>Filled</th>
            <th style={{ padding: "8px 4px" }}></th>
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => {
            const signedUp = s.signups?.some((su) => su.volunteerId === user.id);
            const waitlisted = s.waitlist?.some((w) => w.volunteerId === user.id);
            return (
              <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "8px 4px" }}><Link to={`/shifts/${s.id}`}>{s.title}</Link></td>
                <td style={{ padding: "8px 4px" }}>{s.program?.name}</td>
                <td style={{ padding: "8px 4px" }}>{s.location}</td>
                <td style={{ padding: "8px 4px", fontSize: 13 }}>
                  {new Date(s.startTime).toLocaleDateString()} {new Date(s.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ padding: "8px 4px" }}>{s.fillStatus.replace("_", " ")}</td>
                <td style={{ padding: "8px 4px" }}>{s.signups?.length}/{s.capacity}</td>
                <td style={{ padding: "8px 4px" }}>
                  {signedUp && <span style={{ color: "green", fontWeight: "bold" }}>✓ Signed up</span>}
                  {waitlisted && <span style={{ color: "orange", fontWeight: "bold" }}>⏳ Waitlisted</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shifts.length === 0 && <p>No shifts found.</p>}
    </div>
  );
}