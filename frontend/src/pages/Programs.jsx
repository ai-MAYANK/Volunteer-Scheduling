import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Programs() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [hasArchived, setHasArchived] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await api.get("/programs", { params: { includeArchived: showArchived } });
      setPrograms(res.data || []);
      const allRes = await api.get("/programs", { params: { includeArchived: true } });
      setHasArchived((allRes.data || []).some((p) => p.isArchived));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [showArchived]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/programs", { name, description });
      setName(""); setDescription("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "failed to create program");
    }
  };

  const handleArchiveToggle = async (id, isArchived) => {
    try {
      await api.patch(`/programs/${id}/${isArchived ? "unarchive" : "archive"}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "failed to update program");
    }
  };

  return (
    <div>
      <h2>Programs</h2>

      <form onSubmit={handleCreate} style={{ marginBottom: 16, padding: 12, border: "1px solid #ccc" }}>
        <h4>Create a program</h4>
        <input placeholder="Program name" value={name} onChange={(e) => setName(e.target.value)} required style={{ display: "block", marginBottom: 8, width: "100%" }} />
        <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ display: "block", marginBottom: 8, width: "100%" }} />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Create Program</button>
      </form>

      {hasArchived && (
        <label style={{ display: "block", marginBottom: 8 }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived programs
        </label>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {programs.map((p) => (
          <li key={p.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8, borderRadius: 4 }}>
            <span onClick={() => navigate(`/programs/${p.id}`)} style={{ cursor: "pointer", fontWeight: "bold" }}>
              {p.name}
            </span>{" "}
            {p.isArchived && <em>(archived)</em>}
            <button onClick={() => handleArchiveToggle(p.id, p.isArchived)} style={{ marginLeft: 12, float: "right" }}>
              {p.isArchived ? "Unarchive" : "Archive"}
            </button>
          </li>
        ))}
        {programs.length === 0 && <p>No programs yet.</p>}
      </ul>
    </div>
  );
}