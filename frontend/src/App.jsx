import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Programs from "./pages/Programs";
import ProgramDetail from "./pages/ProgramDetail";
import Shifts from "./pages/Shifts";
import ShiftDetail from "./pages/ShiftDetail";
import Layout from "./Layout";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return children;
}

function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={user.role === "COORDINATOR" ? "/home" : "/shifts"} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<RoleHome />} />
        <Route path="home" element={<Dashboard />} />
        <Route path="programs" element={<Programs />} />
        <Route path="programs/:id" element={<ProgramDetail />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="shifts/:id" element={<ShiftDetail />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}