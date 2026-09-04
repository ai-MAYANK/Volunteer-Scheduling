import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

export default function ProgramDetail() {
  const { id } = useParams();
  const [program, setProgram] = useState(null);
  const [email, setEmail] = useState("");
  const [memberError, setMemberError] = useState("");
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftForm, setShiftForm] = useState({ title: "", location: "", startTime: "", endTime: "", capacity: 5 });
  const [shiftError, setShiftError] = useState("");

  const load = async () => {
    const res = await api.get(`/programs/${id}`);
    setProgram(res.data);
  };

  useEffect(() => { load(); }, [id]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberError("");
    try {
      await api.post(`/programs/${id}/members`, { email });
      setEmail("");
      load();
    } catch (err) {
      setMemberError(err.response?.data?.error || "failed to add volunteer");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this volunteer from the program?")) return;
    try {
      await api.delete(`/programs/${id}/members/${userId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "failed to remove volunteer");
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    setShiftError("");
    try {
      await api.post("/shifts", { ...shiftForm, programId: id });
      setShowShiftForm(false);
      setShiftForm({ title: "", location: "", startTime: "", endTime: "", capacity: 5 });
      load();
    } catch (err) {
      setShiftError(err.response?.data?.error || "failed to create shift");
    }
  };

  if (!program) return <p>Loading...</p>;

  return (
    <div>
      <p><Link to="/programs">&larr; Back to Programs</Link></p>
      <h2>{program.name}</h2>
      <p>{program.description}</p>

      <h3>Members ({program.memberships.length})</h3>
      <form onSubmit={handleAddMember} style={{ marginBottom: 8 }}>
        <input placeholder="Volunteer email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginRight: 8 }} />
        <button type="submit">Add member</button>
      </form>
      {memberError && <p style={{ color: "red" }}>{memberError}</p>}
      <ul>
        {program.memberships.map((m) => (
          <li key={m.id}>
            {m.user.name} ({m.user.email})
            <button onClick={() => handleRemoveMember(m.userId)} style={{ marginLeft: 8 }}>Remove</button>
          </li>
        ))}
        {program.memberships.length === 0 && <li>No members yet.</li>}
      </ul>

      <h3>Shifts ({program.shifts.length})</h3>
      <button onClick={() => setShowShiftForm(!showShiftForm)}>{showShiftForm ? "Cancel" : "+ Add shift"}</button>
      {showShiftForm && (
        <form onSubmit={handleCreateShift} style={{ marginTop: 8, padding: 12, border: "1px solid #ddd" }}>
          <input placeholder="Title" value={shiftForm.title} onChange={(e) => setShiftForm({ ...shiftForm, title: e.target.value })} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
          <input placeholder="Location" value={shiftForm.location} onChange={(e) => setShiftForm({ ...shiftForm, location: e.target.value })} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
          <label>Start: <input type="datetime-local" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} required /></label><br />
          <label>End: <input type="datetime-local" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} required /></label><br />
          <label>Capacity: <input type="number" value={shiftForm.capacity} onChange={(e) => setShiftForm({ ...shiftForm, capacity: e.target.value })} required /></label><br />
          {shiftError && <p style={{ color: "red" }}>{shiftError}</p>}
          <button type="submit">Create Shift</button>
        </form>
      )}
      <ul style={{ marginTop: 12 }}>
        {program.shifts.map((s) => (
          <li key={s.id}>
            <Link to={`/shifts/${s.id}`}>{s.title}</Link> — {s.location} — {new Date(s.startTime).toLocaleString()}
          </li>
        ))}
        {program.shifts.length === 0 && <li>No shifts yet.</li>}
      </ul>
    </div>
  );
}