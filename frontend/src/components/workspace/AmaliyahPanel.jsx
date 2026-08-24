import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit3, Sparkles } from "lucide-react";
import { toast } from "sonner";

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function fmt(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

export default function AmaliyahPanel({ workspaceId, isSpv, onChange }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const initial = { name: "", target_metric: "Istiqomah > 40 hari", target_days: 40, category: "harian", spv_note: "" };
  const [form, setForm] = useState(initial);

  const load = async () => {
    const [h, l] = await Promise.all([
      api.get(`/workspaces/${workspaceId}/habits`),
      api.get(`/workspaces/${workspaceId}/habit-logs`, { params: { start: fmt(year, month, 1), end: fmt(year, month, daysInMonth(year, month)) } }),
    ]);
    setHabits(h.data);
    const map = {};
    l.data.forEach((x) => { map[`${x.habit_id}_${x.date}`] = x.completed; });
    setLogs(map);
  };
  useEffect(() => { load(); }, [workspaceId, year, month]);

  const dim = daysInMonth(year, month);
  const dayList = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim]);

  const toggle = async (h, day) => {
    const date = fmt(year, month, day);
    const key = `${h.id}_${date}`;
    const current = !!logs[key];
    setLogs((p) => ({ ...p, [key]: !current }));
    try {
      await api.post(`/workspaces/${workspaceId}/habit-logs`, { habit_id: h.id, date, completed: !current });
      onChange?.();
    } catch {
      setLogs((p) => ({ ...p, [key]: current }));
      toast.error("Gagal update");
    }
  };

  const openNew = () => { setEditing(null); setForm(initial); setOpen(true); };
  const openEdit = (h) => { setEditing(h); setForm({ ...initial, ...h }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, target_days: Number(form.target_days) };
      if (editing) await api.patch(`/habits/${editing.id}`, payload);
      else await api.post(`/workspaces/${workspaceId}/habits`, payload);
      toast.success("Amaliyah disimpan");
      setOpen(false); load(); onChange?.();
    } catch { toast.error("Gagal"); }
  };

  const remove = async (h) => { if (!window.confirm("Hapus?")) return; await api.delete(`/habits/${h.id}`); load(); onChange?.(); };

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const todayStr = fmt(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="text-emerald-700 text-[10px] font-bold uppercase tracking-[0.2em]">Tracker Amaliyah Spiritual</div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-1 flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-700" /> Yaumiyah</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{monthNames.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew} data-testid="habit-add" className="rounded-full bg-emerald-700 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> Amalan</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit Amalan" : "Tambah Amalan"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nama Amalan</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="habit-name" placeholder="Sedekah Subuh, Tilawah, Dzikir Pagi..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Target Metrik</Label><Input value={form.target_metric} onChange={(e) => setForm(f => ({ ...f, target_metric: e.target.value }))} /></div>
                  <div><Label>Target Hari</Label><Input type="number" value={form.target_days} onChange={(e) => setForm(f => ({ ...f, target_days: e.target.value }))} /></div>
                </div>
                {isSpv && <div><Label>Arahan SPV</Label><Textarea rows={2} value={form.spv_note || ""} onChange={(e) => setForm(f => ({ ...f, spv_note: e.target.value }))} /></div>}
              </div>
              <DialogFooter><Button onClick={save} className="bg-emerald-700 hover:bg-emerald-800" data-testid="habit-save">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm">Belum ada amalan. Tambahkan sedekah subuh, tilawah, dzikir pagi/petang, tahajud, dll.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200">
                <th className="text-left font-semibold py-2 pr-3 min-w-[200px]">Amalan</th>
                <th className="text-left font-semibold py-2 pr-3 min-w-[120px]">Target</th>
                {dayList.map((d) => (
                  <th key={d} className="font-medium px-0.5 py-2 text-slate-400 w-7 text-center">{d}</th>
                ))}
                <th className="text-right font-semibold py-2 pl-3 min-w-[80px]">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => {
                const done = dayList.filter((d) => logs[`${h.id}_${fmt(year, month, d)}`]).length;
                const pct = Math.round((done / dim) * 100);
                return (
                  <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`habit-row-${h.id}`}>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{h.name}</div>
                      {h.spv_note && <div className="text-[10px] text-amber-700 mt-0.5">SPV: {h.spv_note}</div>}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{h.target_metric}</td>
                    {dayList.map((d) => {
                      const date = fmt(year, month, d);
                      const completed = !!logs[`${h.id}_${date}`];
                      const isToday = date === todayStr;
                      return (
                        <td key={d} className="p-0.5">
                          <div className="habit-cell" data-completed={completed} data-today={isToday}
                               onClick={() => toggle(h, d)}
                               title={`${date} - ${completed ? "Selesai" : "Belum"}`}
                               data-testid={`habit-cell-${h.id}-${d}`} />
                        </td>
                      );
                    })}
                    <td className="py-2 pl-3 text-right">
                      <div className="font-semibold text-emerald-700">{pct}%</div>
                      <div className="text-[10px] text-slate-500">{done}/{dim}</div>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <button onClick={() => openEdit(h)} className="text-slate-400 hover:text-emerald-700"><Edit3 className="w-3 h-3" /></button>
                        <button onClick={() => remove(h)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
