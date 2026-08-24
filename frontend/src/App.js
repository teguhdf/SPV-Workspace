import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import SpvDashboard from "@/pages/SpvDashboard";
import WorkspacePage from "@/pages/WorkspacePage";
import AppLayout from "@/components/AppLayout";

function ProtectedRoute({ children, spvOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-800" data-testid="auth-loading">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (spvOnly && user.role !== "spv" && user.role !== "admin") return <Navigate to="/my-workspace" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-800">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "spv" || user.role === "admin") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/my-workspace" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/dashboard" element={
            <ProtectedRoute spvOnly>
              <AppLayout><SpvDashboard /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/my-workspace" element={
            <ProtectedRoute>
              <AppLayout><MyWorkspaceRedirect /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/workspaces/:id" element={
            <ProtectedRoute>
              <AppLayout><WorkspacePage /></AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function MyWorkspaceRedirect() {
  const { user, myWorkspace, loading } = useAuth();
  if (loading || !myWorkspace) return <div className="text-emerald-800">Memuat workspace...</div>;
  return <Navigate to={`/workspaces/${myWorkspace.id}`} replace />;
}
