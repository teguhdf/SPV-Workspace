import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit3, Zap } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS = { belum_mulai: "Belum Mulai", proses: "Dalam Proses", selesai: "Selesai", terkendala: "Terkendala" };

export default function InitiativePanel({ workspaceId, isSpv, onChange }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const initial = { name: "", output: "", linked_kr: "", status: "belum_mulai", percentage: 0, deadline: "", comments: "", spv_note: "" };
  const [form, setForm] = useState(initial);

  const load = async () => {
    const { data } = await api.get(`/workspaces/${workspaceId}/initiatives`);
    setItems(data);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const openNew = () => { setEditing(null); setForm(initial); setOpen(true); };
  const openEdit = (i) => { setEditing(i); setForm({ ...initial, ...i }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, percentage: Number(form.percentage) };
      if (editing) await api.patch(`/initiatives/${editing.id}`, payload);
      else await api.post(`/workspaces/${workspaceId}/initiatives`, payload);
      toast.success("Initiative disimpan");
      setOpen(false); load(); onChange?.();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const remove = async (it) => { if (!window.confirm("Hapus?")) return; await api.delete(`/initiatives/${it.id}`); load(); onChange?.(); };

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-emerald-700 text-[10px] font-bold uppercase tracking-[0.2em]">Action Plan</div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-1">Initiative</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew} data-testid="init-add" className="rounded-full bg-emerald-700 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> Tambah</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit Initiative" : "Tambah Initiative"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nama Initiative</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="init-name" /></div>
              <div><Label>Output / Hasil</Label><Input value={form.output} onChange={(e) => setForm(f => ({ ...f, output: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Linked KR</Label><Input value={form.linked_kr} onChange={(e) => setForm(f => ({ ...f, linked_kr: e.target.value }))} placeholder="KR 1-2" /></div>
                <div><Label>Deadline</Label><Input type="date" value={form.deadline || ""} onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Progres (%)</Label><Input type="number" min={0} max={100} value={form.percentage} onChange={(e) => setForm(f => ({ ...f, percentage: e.target.value }))} /></div>
              </div>
              <div><Label>Catatan Tim</Label><Textarea rows={2} value={form.comments || ""} onChange={(e) => setForm(f => ({ ...f, comments: e.target.value }))} /></div>
              {isSpv && <div><Label>Arahan SPV</Label><Textarea rows={2} value={form.spv_note || ""} onChange={(e) => setForm(f => ({ ...f, spv_note: e.target.value }))} /></div>}
            </div>
            <DialogFooter><Button onClick={save} className="bg-emerald-700 hover:bg-emerald-800" data-testid="init-save">Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm">Belum ada initiative.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="border border-slate-200 rounded-lg p-4 flex items-start gap-4">
              <Zap className="w-4 h-4 text-emerald-700 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-slate-900">{it.name}</div>
                  <span className={`status-pill status-${it.status === "selesai" ? "selesai" : it.status === "terkendala" ? "terkendala" : it.status === "proses" ? "proses" : "belum"}`}>{STATUS_LABELS[it.status]}</span>
                  {it.linked_kr && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{it.linked_kr}</span>}
                </div>
                {it.output && <div className="text-sm text-slate-500 mt-1">Output: {it.output}</div>}
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={it.percentage} className="h-1.5 flex-1 [&>div]:bg-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700 w-10 text-right">{it.percentage}%</span>
                </div>
                {it.spv_note && <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 px-3 py-2 rounded">Arahan SPV: {it.spv_note}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(it)}><Edit3 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remove(it)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
