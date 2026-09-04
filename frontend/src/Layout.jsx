import { Outlet, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import api from "./api";

export default function Layout() {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (user?.role === "COORDINATOR") {
      api.get("/alerts/understaffed/count").then((res) => setAlertCount(res.data.count));
    }
  }, [user]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px" }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 20, paddingBottom: 10, borderBottom: "1px solid #ccc" }}>
        {user?.role === "COORDINATOR" && (
          <>
            <Link to="/home">
              Home {alertCount > 0 && <span style={{ background: "red", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 11 }}>{alertCount}</span>}
            </Link>
            <Link to="/programs">Program</Link>
          </>
        )}
        <Link to="/shifts">Shift</Link>
        <span style={{ marginLeft: "auto" }}>
          Logged in as {user?.name} ({user?.role}) &nbsp;
          <button onClick={logout}>Logout</button>
        </span>
      </nav>
      <Outlet />
    </div>
  );
}