import { useEffect, useState } from "react";
import { api, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit3, Trash2, KeyRound, Users2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function UserManagementPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwdTarget, setPwdTarget] = useState(null);

  const initial = { name: "", email: "", password: "", role: "anggota", division: "" };
  const [form, setForm] = useState(initial);
  const [editForm, setEditForm] = useState({});
  const [newPwd, setNewPwd] = useState("");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/users"); setUsers(data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post("/admin/users", form);
      toast.success("User dibuat");
      setOpenCreate(false); setForm(initial); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const saveEdit = async () => {
    try {
      await api.patch(`/admin/users/${editing.id}`, editForm);
      toast.success("User diperbarui"); setEditing(null); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const resetPwd = async () => {
    if (newPwd.length < 6) return toast.error("Password minimal 6 karakter");
    try {
      await api.post(`/admin/users/${pwdTarget.id}/reset-password`, { new_password: newPwd });
      toast.success("Password direset"); setPwdTarget(null); setNewPwd("");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Hapus ${u.name}? Semua workspace & data terkait akan dihapus.`)) return;
    try { await api.delete(`/admin/users/${u.id}`); toast.success("User dihapus"); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const filtered = users.filter(u =>
    !q || u.name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="user-mgmt-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-emerald-700 text-xs font-bold uppercase tracking-[0.2em]">Manajemen User</div>
          <h1 className="font-display text-4xl font-bold text-slate-900 mt-2">Anggota Tim</h1>
          <p className="text-slate-500 mt-2">Kelola akses SPV & Anggota, reset password, dan atur divisi.</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button data-testid="user-add" className="rounded-full bg-emerald-700 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> Tambah User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Tambah User</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nama Lengkap</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="new-user-name" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} data-testid="new-user-email" /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} data-testid="new-user-password" placeholder="min 6 karakter" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger data-testid="new-user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anggota">Anggota</SelectItem>
                      <SelectItem value="spv">SPV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Divisi</Label><Input value={form.division} onChange={(e) => setForm(f => ({ ...f, division: e.target.value }))} data-testid="new-user-division" /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={create} className="bg-emerald-700 hover:bg-emerald-800" data-testid="new-user-save">Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 flex-wrap">
          <Users2 className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-500">Total: <b className="text-slate-900">{users.length}</b></span>
          <div className="flex-1" />
          <Input placeholder="Cari nama / email..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" data-testid="user-search" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Memuat...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Tidak ada user.</TableCell></TableRow>}
              {filtered.map((u) => (
                <TableRow key={u.id} className="hover:bg-slate-50" data-testid={`user-row-${u.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-semibold text-sm">{u.name?.slice(0, 1)?.toUpperCase()}</div>
                      <div>
                        <div className="font-medium text-slate-900">{u.name}{u.id === me?.id && <span className="ml-2 text-[10px] text-emerald-700 font-bold">(Anda)</span>}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                  <TableCell>
                    <Badge className={u.role === "spv" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0" : "bg-slate-100 text-slate-700 hover:bg-slate-100 border-0"}>
                      {u.role === "spv" ? "SPV" : "Anggota"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{u.division || "-"}</TableCell>
                  <TableCell className="text-xs text-slate-500">{u.auth_provider === "google" ? "Google" : "Email/Password"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(u); setEditForm({ name: u.name, role: u.role, division: u.division || "" }); }} data-testid={`user-edit-${u.id}`}><Edit3 className="w-4 h-4" /></Button>
                    {u.auth_provider !== "google" && <Button variant="ghost" size="sm" onClick={() => { setPwdTarget(u); setNewPwd(""); }} data-testid={`user-pwd-${u.id}`}><KeyRound className="w-4 h-4" /></Button>}
                    {u.id !== me?.id && <Button variant="ghost" size="sm" onClick={() => remove(u)} data-testid={`user-delete-${u.id}`}><Trash2 className="w-4 h-4 text-rose-500" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={editForm.name || ""} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="edit-user-name" /></div>
            <div><Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="edit-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anggota">Anggota</SelectItem>
                  <SelectItem value="spv">SPV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Divisi</Label><Input value={editForm.division || ""} onChange={(e) => setEditForm(f => ({ ...f, division: e.target.value }))} data-testid="edit-user-division" /></div>
          </div>
          <DialogFooter><Button onClick={saveEdit} className="bg-emerald-700 hover:bg-emerald-800" data-testid="edit-user-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdTarget} onOpenChange={(v) => !v && setPwdTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="text-sm text-slate-600 mb-3">Set password baru untuk <b>{pwdTarget?.name}</b>.</div>
          <div><Label>Password Baru</Label><Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="min 6 karakter" data-testid="reset-pwd-input" /></div>
          <DialogFooter><Button onClick={resetPwd} className="bg-emerald-700 hover:bg-emerald-800" data-testid="reset-pwd-save">Reset</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
