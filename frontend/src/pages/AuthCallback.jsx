import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Moon } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const location = useLocation();
  const nav = useNavigate();
  const { refreshMe } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      nav("/login", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(m[1]);

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        // Clear the hash so back-nav doesn't re-trigger
        window.history.replaceState({}, "", window.location.pathname);
        await refreshMe();
        if (data.role === "spv" || data.role === "admin") nav("/dashboard", { replace: true });
        else nav("/my-workspace", { replace: true });
      } catch (e) {
        nav("/login?error=google", { replace: true });
      }
    })();
  }, [location.hash, nav, refreshMe]);

  return (
    <div className="min-h-screen flex items-center justify-center mesjid-gradient islamic-pattern text-white">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center animate-pulse">
          <Moon className="w-7 h-7" />
        </div>
        <div className="font-display text-xl font-semibold">Menyiapkan workspace Anda...</div>
        <div className="text-sm text-emerald-100/70">Sedang memverifikasi sesi Google</div>
      </div>
    </div>
  );
}
