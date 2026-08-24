import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Briefcase, LogOut, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }) {
  const { user, myWorkspace, logout } = useAuth();
  const nav = useNavigate();
  const isSpv = user?.role === "spv" || user?.role === "admin";

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200
     ${isActive ? "bg-white/15 text-white" : "text-emerald-50/70 hover:bg-white/10 hover:text-white"}`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 mesjid-gradient islamic-pattern text-white flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-semibold">Sanad Workspace</div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-100/70">SPV Monitoring</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          {isSpv && (
            <NavLink to="/dashboard" className={linkCls} data-testid="nav-dashboard">
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard SPV</span>
            </NavLink>
          )}
          {myWorkspace && (
            <NavLink to={`/workspaces/${myWorkspace.id}`} className={linkCls} data-testid="nav-my-workspace">
              <Briefcase className="w-4 h-4" />
              <span>{isSpv ? "Workspace Saya" : "Workspace"}</span>
            </NavLink>
          )}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-emerald-300/30 flex items-center justify-center text-sm font-semibold">
              {user?.name?.slice(0, 1)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-100/70">{user?.role}</div>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} data-testid="nav-logout"
                  className="w-full justify-start text-emerald-50/80 hover:text-white hover:bg-white/10">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
