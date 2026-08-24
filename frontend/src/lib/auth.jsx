import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myWorkspace, setMyWorkspace] = useState(null);

  const refreshMe = useCallback(async () => {
    // If returning from OAuth callback, skip auto-me check; AuthCallback will handle it
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      // load owned workspaces
      const wsRes = await api.get("/workspaces");
      const owned = wsRes.data.find((w) => w.owner_id === data.id) || wsRes.data[0];
      setMyWorkspace(owned || null);
    } catch {
      setUser(null);
      setMyWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.access_token) localStorage.setItem("spv_token", data.access_token);
    await refreshMe();
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    if (data.access_token) localStorage.setItem("spv_token", data.access_token);
    await refreshMe();
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("spv_token");
    setUser(null);
    setMyWorkspace(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, myWorkspace, login, register, logout, refreshMe }}>
      {children}
    </AuthCtx.Provider>
  );
}
