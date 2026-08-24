import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit3, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const STATUS = ["BELUM_MULAI", "ON_TRACKER", "PROSES", "SELESAI", "TERKENDALA"];
const KATEGORI = ["RUTIN", "TIDAK_RUTIN"];
const FREKUENSI = ["SEKALI", "HARIAN", "MINGGUAN", "BULANAN"];

function statusClass(s) {
  return {
    SELESAI: "status-selesai", PROSES: "status-proses",
    ON_TRACKER: "status-on", TERKENDALA: "status-terkendala",
    BELUM_MULAI: "status-belum",
  }[s] || "status-belum";
}

export default function ExecutionPanel({ workspaceId, isSpv, onChange }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrek, setFilterFrek] = useState("all");
  const initial = { name: "", kategori: "RUTIN", frekuensi: "HARIAN", status: "BELUM_MULAI", pemberi_tugas: "", waktu_mulai: "", batas_waktu: "", catatan_tim: "", catatan_spv: "", link_dokumen: "" };
  const [form, setForm] = useState(initial);

  const load = async () => {
    const { data } = await api.get(`/workspaces/${workspaceId}/tasks`);
    setItems(data);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const filtered = useMemo(() => items.filter(i =>
    (filterStatus === "all" || i.status === filterStatus) &&
    (filterFrek === "all" || i.frekuensi === filterFrek)
  ), [items, filterStatus, filterFrek]);

  const openNew = () => { setEditing(null); setForm(initial); setOpen(true); };
  const openEdit = (i) => { setEditing(i); setForm({ ...initial, ...i }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) await api.patch(`/tasks/${editing.id}`, form);
      else await api.post(`/workspaces/${workspaceId}/tasks`, form);
      toast.success("Task disimpan"); setOpen(false); load(); onChange?.();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const remove = async (it) => { if (!window.confirm("Hapus?")) return; await api.delete(`/tasks/${it.id}`); load(); onChange?.(); };

  const quickStatus = async (it, v) => {
    await api.patch(`/tasks/${it.id}`, { ...it, status: v });
    load(); onChange?.();
  };

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-emerald-700 text-[10px] font-bold uppercase tracking-[0.2em]">Execution Scoreboard</div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-1">Task Tim</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUS.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterFrek} onValueChange={setFilterFrek}>
            <SelectTrigger className="w-40" data-testid="filter-frek"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Frekuensi</SelectItem>
              {FREKUENSI.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew} data-testid="task-add" className="rounded-full bg-emerald-700 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> Task</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit Task" : "Tambah Task"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nama Tugas</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="task-name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Kategori</Label>
                    <Select value={form.kategori} onValueChange={(v) => setForm(f => ({ ...f, kategori: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{KATEGORI.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Frekuensi</Label>
                    <Select value={form.frekuensi} onValueChange={(v) => setForm(f => ({ ...f, frekuensi: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FREKUENSI.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map(k => <SelectItem key={k} value={k}>{k.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Pemberi Tugas</Label><Input value={form.pemberi_tugas} onChange={(e) => setForm(f => ({ ...f, pemberi_tugas: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Mulai</Label><Input type="date" value={form.waktu_mulai} onChange={(e) => setForm(f => ({ ...f, waktu_mulai: e.target.value }))} /></div>
                  <div><Label>Deadline</Label><Input type="date" value={form.batas_waktu} onChange={(e) => setForm(f => ({ ...f, batas_waktu: e.target.value }))} /></div>
                </div>
                <div><Label>Catatan Tim</Label><Textarea rows={2} value={form.catatan_tim} onChange={(e) => setForm(f => ({ ...f, catatan_tim: e.target.value }))} /></div>
                {isSpv && <div><Label>Arahan SPV</Label><Textarea rows={2} value={form.catatan_spv} onChange={(e) => setForm(f => ({ ...f, catatan_spv: e.target.value }))} /></div>}
                <div><Label>Link Dokumen</Label><Input value={form.link_dokumen} onChange={(e) => setForm(f => ({ ...f, link_dokumen: e.target.value }))} placeholder="https://..." /></div>
              </div>
              <DialogFooter><Button onClick={save} className="bg-emerald-700 hover:bg-emerald-800" data-testid="task-save">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Nama Tugas</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Frekuensi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Tidak ada task.</TableCell></TableRow>
            )}
            {filtered.map((it, idx) => {
              const overdue = it.batas_waktu && it.status !== "SELESAI" && it.batas_waktu < new Date().toISOString().slice(0, 10);
              return (
                <TableRow key={it.id} className="hover:bg-slate-50" data-testid={`task-row-${it.id}`}>
                  <TableCell className="text-slate-500 text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{it.name}</div>
                    {it.catatan_spv && <div className="text-xs text-amber-700 mt-0.5">Arahan SPV: {it.catatan_spv}</div>}
                    {it.link_dokumen && <a href={it.link_dokumen} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1 mt-1"><ExternalLink className="w-3 h-3" />Dokumen</a>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{it.kategori}</TableCell>
                  <TableCell className="text-xs text-slate-600">{it.frekuensi}</TableCell>
                  <TableCell>
                    <Select value={it.status} onValueChange={(v) => quickStatus(it, v)}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className={`text-xs ${overdue ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
                    {it.batas_waktu || "-"}{overdue && " (overdue)"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(it)}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(it)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
