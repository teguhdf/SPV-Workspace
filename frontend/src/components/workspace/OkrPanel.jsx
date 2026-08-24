import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Target, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";

function calcKrProgress(kr) {
  const t = Number(kr.target ?? 0), b = Number(kr.baseline ?? 0), r = Number(kr.realisasi ?? 0);
  if (t === b) return r >= t ? 100 : 0;
  return Math.max(0, Math.min(100, ((r - b) / (t - b)) * 100));
}

export default function OkrPanel({ workspaceId, isSpv, onChange }) {
  const [okrs, setOkrs] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ objective: "", cycle: "Q1 2026", spv_note: "", key_results: [{ metric: "", baseline: 0, target: 0, realisasi: 0, unit: "%", confidence: "medium", deadline: "", comments: "" }] });

  const load = async () => {
    const { data } = await api.get(`/workspaces/${workspaceId}/okrs`);
    setOkrs(data);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const openNew = () => {
    setEditing(null);
    setForm({ objective: "", cycle: "Q1 2026", spv_note: "", key_results: [{ metric: "", baseline: 0, target: 0, realisasi: 0, unit: "%", confidence: "medium", deadline: "", comments: "" }] });
    setOpen(true);
  };
  const openEdit = (o) => {
    setEditing(o);
    setForm({ objective: o.objective, cycle: o.cycle, spv_note: o.spv_note || "", key_results: o.key_results.map(k => ({ ...k })) });
    setOpen(true);
  };

  const addKr = () => setForm(f => ({ ...f, key_results: [...f.key_results, { metric: "", baseline: 0, target: 0, realisasi: 0, unit: "%", confidence: "medium", deadline: "", comments: "" }] }));
  const rmKr = (i) => setForm(f => ({ ...f, key_results: f.key_results.filter((_, idx) => idx !== i) }));
  const updKr = (i, k, v) => setForm(f => ({ ...f, key_results: f.key_results.map((kr, idx) => idx === i ? { ...kr, [k]: v } : kr) }));

  const save = async () => {
    try {
      const payload = { ...form, key_results: form.key_results.map(k => ({ ...k, baseline: Number(k.baseline), target: Number(k.target), realisasi: Number(k.realisasi) })) };
      if (editing) await api.patch(`/okrs/${editing.id}`, payload);
      else await api.post(`/workspaces/${workspaceId}/okrs`, payload);
      toast.success(editing ? "OKR diperbarui" : "OKR dibuat");
      setOpen(false); load(); onChange?.();
    } catch (e) { toast.error("Gagal menyimpan OKR"); }
  };

  const remove = async (o) => {
    if (!window.confirm("Hapus OKR ini?")) return;
    await api.delete(`/okrs/${o.id}`); toast.success("OKR dihapus"); load(); onChange?.();
  };

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-emerald-700 text-[10px] font-bold uppercase tracking-[0.2em]">Objective &amp; Key Results</div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-1">OKR</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} data-testid="okr-add" className="rounded-full bg-emerald-700 hover:bg-emerald-800">
              <Plus className="w-4 h-4 mr-1" /> Tambah OKR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit OKR" : "Buat OKR"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Objective</Label><Textarea value={form.objective} onChange={(e) => setForm(f => ({ ...f, objective: e.target.value }))} data-testid="okr-objective" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Cycle</Label><Input value={form.cycle} onChange={(e) => setForm(f => ({ ...f, cycle: e.target.value }))} /></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label>Key Results</Label><Button size="sm" variant="outline" onClick={addKr}><Plus className="w-3 h-3 mr-1" /> KR</Button></div>
                {form.key_results.map((kr, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="text-xs font-semibold text-emerald-700">KR {i + 1}</div>
                      {form.key_results.length > 1 && <Button variant="ghost" size="sm" onClick={() => rmKr(i)}><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                    <Input placeholder="Metric" value={kr.metric} onChange={(e) => updKr(i, "metric", e.target.value)} />
                    <div className="grid grid-cols-4 gap-2">
                      <Input type="number" placeholder="Baseline" value={kr.baseline} onChange={(e) => updKr(i, "baseline", e.target.value)} />
                      <Input type="number" placeholder="Target" value={kr.target} onChange={(e) => updKr(i, "target", e.target.value)} />
                      <Input type="number" placeholder="Realisasi" value={kr.realisasi} onChange={(e) => updKr(i, "realisasi", e.target.value)} />
                      <Input placeholder="Unit (%)" value={kr.unit} onChange={(e) => updKr(i, "unit", e.target.value)} />
                    </div>
                    <Input placeholder="Deadline" type="date" value={kr.deadline || ""} onChange={(e) => updKr(i, "deadline", e.target.value)} />
                    <Textarea placeholder="Catatan" value={kr.comments || ""} onChange={(e) => updKr(i, "comments", e.target.value)} rows={2} />
                  </div>
                ))}
              </div>
              {isSpv && (
                <div className="space-y-2"><Label>Arahan / Catatan SPV</Label><Textarea value={form.spv_note} onChange={(e) => setForm(f => ({ ...f, spv_note: e.target.value }))} /></div>
              )}
            </div>
            <DialogFooter><Button onClick={save} data-testid="okr-save" className="bg-emerald-700 hover:bg-emerald-800">Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {okrs.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">Belum ada OKR. Klik "Tambah OKR" untuk mulai.</div>
      ) : (
        <div className="space-y-6">
          {okrs.map((o) => {
            const avg = o.key_results.length ? Math.round(o.key_results.reduce((s, kr) => s + calcKrProgress(kr), 0) / o.key_results.length) : 0;
            return (
              <div key={o.id} className="border border-slate-200 rounded-xl p-5" data-testid={`okr-item-${o.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Target className="w-4 h-4 text-emerald-700" />
                      <div className="font-semibold text-slate-900">{o.objective}</div>
                      <span className="text-xs text-slate-500">• {o.cycle}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={avg} className="h-2 flex-1 [&>div]:bg-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-700">{avg}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(o)} data-testid={`okr-edit-${o.id}`}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(o)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {o.key_results.map((kr, i) => {
                    const p = Math.round(calcKrProgress(kr));
                    return (
                      <div key={kr.id || i} className="grid grid-cols-12 items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                        <div className="col-span-12 md:col-span-5 text-slate-700"><span className="text-xs text-emerald-700 font-bold mr-2">KR{i + 1}</span>{kr.metric}</div>
                        <div className="col-span-4 md:col-span-2 text-xs text-slate-500">Target: {kr.target}{kr.unit}</div>
                        <div className="col-span-4 md:col-span-2 text-xs text-slate-500">Realisasi: {kr.realisasi}{kr.unit}</div>
                        <div className="col-span-4 md:col-span-3 flex items-center gap-2"><Progress value={p} className="h-1.5 flex-1 [&>div]:bg-emerald-500" /><span className="text-xs font-semibold text-slate-700">{p}%</span></div>
                      </div>
                    );
                  })}
                </div>
                {o.spv_note && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-900">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-amber-700 mb-1">Arahan SPV</div>
                    {o.spv_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
