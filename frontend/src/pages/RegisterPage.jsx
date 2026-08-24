import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { formatErr } from "@/lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "anggota", division: "" });
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { register } = useAuth();

  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register(form);
      toast.success(`Selamat datang, ${u.name}!`);
      nav(u.role === "spv" ? "/dashboard" : "/my-workspace");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md p-8 border border-slate-200 shadow-sm">
        <div className="text-emerald-700 text-xs font-bold uppercase tracking-[0.2em] mb-3">Daftar</div>
        <h2 className="font-display text-3xl font-bold text-slate-900 mb-6">Buat Akun Baru</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input required value={form.name} onChange={(e) => change("name", e.target.value)} data-testid="reg-name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required value={form.email} onChange={(e) => change("email", e.target.value)} data-testid="reg-email" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" required minLength={6} value={form.password} onChange={(e) => change("password", e.target.value)} data-testid="reg-password" />
          </div>
          <div className="space-y-2">
            <Label>Divisi</Label>
            <Input value={form.division} onChange={(e) => change("division", e.target.value)} placeholder="Multimedia" data-testid="reg-division" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => change("role", v)}>
              <SelectTrigger data-testid="reg-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anggota">Anggota Tim</SelectItem>
                <SelectItem value="spv">SPV / Supervisor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy} data-testid="reg-submit"
                  className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 h-11 font-semibold">
            {busy ? "Memuat..." : "Daftar"}
          </Button>
        </form>
        <div className="mt-5 text-sm text-slate-500 text-center">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-emerald-700 font-semibold hover:underline">Masuk</Link>
        </div>
      </Card>
    </div>
  );
}
