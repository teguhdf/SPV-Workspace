import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { formatErr } from "@/lib/api";
import { Moon } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Selamat datang, ${u.name}`);
      if (u.role === "spv" || u.role === "admin") nav("/dashboard");
      else nav("/my-workspace");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex mesjid-gradient islamic-pattern relative overflow-hidden">
        <div className="relative z-10 p-12 flex flex-col justify-between text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Moon className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">Sanad Workspace</div>
              <div className="text-xs text-emerald-100/80">SPV Monitoring Suite</div>
            </div>
          </div>
          <div className="max-w-md space-y-4">
            <div className="text-emerald-200/80 text-xs uppercase tracking-[0.2em] font-semibold">Barakallah</div>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Pantau amanah tim dengan rapi, istiqomah, dan penuh keberkahan.
            </h1>
            <p className="text-emerald-100/90 leading-relaxed">
              OKR, Action Plan, Execution Scoreboard, dan Amaliyah Yaumiyah dalam satu ruang kerja yang bersih dan fokus.
            </p>
            <p className="font-arabic text-2xl text-emerald-100/90 pt-4">
              وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ
            </p>
          </div>
          <div className="text-xs text-emerald-100/60">© 2026 Sanad Workspace</div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <Card className="w-full max-w-md p-8 border border-slate-200 shadow-sm">
          <div className="mb-8">
            <div className="text-emerald-700 text-xs font-bold uppercase tracking-[0.2em] mb-3">Assalamu'alaikum</div>
            <h2 className="font-display text-3xl font-bold text-slate-900">Masuk ke Workspace</h2>
            <p className="text-slate-500 mt-2 text-sm">Kelola OKR dan pantau progres tim Anda hari ini.</p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                     data-testid="login-email" placeholder="nama@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                     data-testid="login-password" placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={busy} data-testid="login-submit"
                    className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 h-11 font-semibold">
              {busy ? "Memuat..." : "Masuk"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">atau</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
              const redirectUrl = window.location.origin + "/auth/callback";
              window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
            }}
            data-testid="login-google"
            className="w-full rounded-full h-11 font-semibold border-slate-300 hover:bg-slate-50"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.24 1.26-1.63 3.7-5.4 3.7-3.25 0-5.9-2.7-5.9-6s2.65-6 5.9-6c1.85 0 3.09.79 3.8 1.47l2.59-2.5C16.83 3.33 14.63 2.4 12 2.4 6.94 2.4 2.8 6.5 2.8 11.9s4.14 9.5 9.2 9.5c5.32 0 8.83-3.74 8.83-9 0-.6-.07-1.06-.15-1.5H12z"/>
            </svg>
            Masuk dengan Google
          </Button>
          <div className="mt-6 text-sm text-slate-500 text-center">
            Belum punya akun?{" "}
            <Link to="/register" className="text-emerald-700 font-semibold hover:underline" data-testid="go-register">
              Daftar sekarang
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
