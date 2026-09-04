import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext";

export default function ShiftDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [shift, setShift] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const load = async () => {
    const res = await api.get(`/shifts/${id}`);
    setShift(res.data);
  };

  const loadTimeline = async () => {
    const res = await api.get(`/shifts/${id}/timeline`);
    setTimeline(res.data);
  };

  useEffect(() => { load(); }, [id]);

  const isSignedUp = shift?.signups.some((s) => s.volunteerId === user.id || s.isYou);
  const isWaitlisted = shift?.waitlist.some((w) => w.volunteerId === user.id || w.isYou);

  const handleSignup = async () => {
    setError(""); setMessage("");
    try {
      const res = await api.post(`/shifts/${id}/signup`);
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || "failed"); }
  };

  const handleWaitlist = async () => {
    setError(""); setMessage("");
    try {
      const res = await api.post(`/shifts/${id}/waitlist`);
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || "failed"); }
  };

  const handleCancel = async () => {
    setError(""); setMessage("");
    try {
      const res = await api.delete(`/shifts/${id}/signup`);
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || "failed"); }
  };

  const handleClaim = async () => {
    setError(""); setMessage("");
    try {
      const res = await api.post(`/shifts/${id}/claim`);
      setMessage(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || "failed"); }
  };

  const handleClose = async () => {
    if (!window.confirm("Close this shift? No further signups or cancellations will be allowed.")) return;
    try {
      await api.post(`/shifts/${id}/close`);
      load();
    } catch (err) { setError(err.response?.data?.error || "failed to close shift"); }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    try {
      await api.post(`/shifts/${id}/notes`, { note });
      setNote("");
      if (showTimeline) loadTimeline();
    } catch (err) { setError(err.response?.data?.error || "failed to add note"); }
  };

  const toggleTimeline = () => {
    if (!showTimeline) loadTimeline();
    setShowTimeline(!showTimeline);
  };

  const startEdit = () => {
    setEditForm({
      title: shift.title,
      location: shift.location,
      startTime: shift.startTime.slice(0, 16),
      endTime: shift.endTime.slice(0, 16),
      capacity: shift.capacity,
    });
    setEditing(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/shifts/${id}`, editForm);
      setEditing(false);
      load();
    } catch (err) { setError(err.response?.data?.error || "failed to update shift"); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this shift permanently? This removes all signups and waitlist entries too.")) return;
    try {
      await api.delete(`/shifts/${id}`);
      window.location.href = "/";
    } catch (err) { setError(err.response?.data?.error || "failed to delete shift"); }
  };

  const handleDownloadRoster = () => {
    const token = localStorage.getItem("token");
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
    fetch(`${apiBase}/shifts/program/${shift.programId}/roster.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `roster-${shift.programId}.csv`;
        a.click();
      });
  };

  if (!shift) return <p>Loading...</p>;

  return (
    <div>
      <h2>{shift.title}</h2>
      <p>{shift.program?.name} — {shift.location}</p>
      <p>{new Date(shift.startTime).toLocaleString()} → {new Date(shift.endTime).toLocaleString()}</p>
      <p>Status: <b>{shift.fillStatus.replace("_", " ")}</b> ({shift.signups.length}/{shift.capacity})</p>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {user.role === "VOLUNTEER" && !isSignedUp && !isWaitlisted && shift.fillStatus === "OPEN" && (
        <button onClick={handleSignup}>Sign up</button>
      )}
      {user.role === "VOLUNTEER" && !isSignedUp && !isWaitlisted && shift.fillStatus === "PARTIALLY_FILLED" && (
        <button onClick={handleSignup}>Sign up</button>
      )}
      {user.role === "VOLUNTEER" && !isSignedUp && !isWaitlisted && shift.fillStatus === "FILLED" && (
        <button onClick={handleWaitlist}>Join waitlist (shift is full)</button>
      )}
      {user.role === "VOLUNTEER" && isSignedUp && (
        <button onClick={handleCancel}>Cancel my signup</button>
      )}
      {user.role === "VOLUNTEER" && isWaitlisted && (
        <button onClick={handleClaim}>Claim spot (you're on the waitlist)</button>
      )}

      {user.role === "COORDINATOR" && (
        <>
          <button onClick={handleDownloadRoster} style={{ marginLeft: 8 }}>Download program roster CSV</button>
          {!shift.isClosed && (
            <button onClick={handleClose} style={{ marginLeft: 8 }}>Close shift</button>
          )}
          {!editing && (
            <>
              <button onClick={startEdit} style={{ marginLeft: 8 }}>Edit shift</button>
              <button onClick={handleDelete} style={{ marginLeft: 8, background: "#c0392b", color: "white" }}>Delete shift</button>
            </>
          )}
        </>
      )}

      {editing && (
        <form onSubmit={handleEditSave} style={{ border: "1px solid #999", padding: 16, marginTop: 12 }}>
          <h4>Edit shift</h4>
          <label>Title:<br/>
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} style={{ width: "100%", marginBottom: 8 }} />
          </label>
          <label>Location:<br/>
            <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} style={{ width: "100%", marginBottom: 8 }} />
          </label>
          <label>Start:<br/>
            <input type="datetime-local" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} style={{ marginBottom: 8 }} />
          </label><br/>
          <label>End:<br/>
            <input type="datetime-local" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} style={{ marginBottom: 8 }} />
          </label><br/>
          <label>Capacity:<br/>
            <input type="number" value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} style={{ marginBottom: 8 }} />
          </label><br/>
          <button type="submit">Save changes</button>
          <button type="button" onClick={() => setEditing(false)} style={{ marginLeft: 8 }}>Cancel</button>
        </form>
      )}

            {user.role === "COORDINATOR" ? (
        <>
          <h3>Signed up ({shift.signups.length})</h3>
          <ul>{shift.signups.map((s) => <li key={s.id}>{s.volunteer.name} ({s.volunteer.email})</li>)}</ul>
          <h3>Waitlist ({shift.waitlist.length})</h3>
          <ul>{shift.waitlist.map((w) => <li key={w.id}>volunteer id: {w.volunteerId}</li>)}</ul>
        </>
      ) : (
        <>
          <p>Signed up: {shift.signups.length} / {shift.capacity}</p>
          <p>Waitlist: {shift.waitlist.length} {shift.waitlist.some((w) => w.isYou) && "(you're on it)"}</p>
        </>
      )}

      {user.role === "COORDINATOR" && (
        <form onSubmit={handleAddNote} style={{ marginTop: 16 }}>
          <h4>Add a note</h4>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Leave a note on this shift" style={{ width: "70%", marginRight: 8 }} />
          <button type="submit">Add note</button>
        </form>
      )}

            {user.role === "COORDINATOR" && (
        <button onClick={toggleTimeline} style={{ marginTop: 16 }}>
          {showTimeline ? "Hide timeline" : "Show timeline"}
        </button>
      )}
      {user.role === "COORDINATOR" && showTimeline && (
        <ul style={{ marginTop: 8 }}>
          {timeline.map((e) => (
            <li key={e.id}>
              {new Date(e.createdAt).toLocaleString()} — <b>{e.action}</b>
              {e.oldState && e.newState && ` (${e.oldState} → ${e.newState})`}
              {e.details && ` — ${e.details}`}
              {" "}by {e.actor?.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}