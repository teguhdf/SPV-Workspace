import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import SpvDashboard from "@/pages/SpvDashboard";
import WorkspacePage from "@/pages/WorkspacePage";
import StrategyPage from "@/pages/StrategyPage";
import UserManagementPage from "@/pages/UserManagementPage";
import AuthCallback from "@/pages/AuthCallback";
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

function AppRouter() {
  const location = useLocation();
  // CRITICAL: detect OAuth session_id in URL fragment BEFORE running routes / ProtectedRoute
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

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
      <Route path="/strategy" element={
        <ProtectedRoute spvOnly>
          <AppLayout><StrategyPageWrapper /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute spvOnly>
          <AppLayout><UserManagementPage /></AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

function MyWorkspaceRedirect() {
  const { myWorkspace, loading } = useAuth();
  if (loading || !myWorkspace) return <div className="text-emerald-800">Memuat workspace...</div>;
  return <Navigate to={`/workspaces/${myWorkspace.id}`} replace />;
}

function StrategyPageWrapper() {
  const { user } = useAuth();
  return <StrategyPage isSpv={user?.role === "spv" || user?.role === "admin"} />;
}
