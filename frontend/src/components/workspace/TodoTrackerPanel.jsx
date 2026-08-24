import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function fmt(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function startOfIsoWeek(date) { const d = new Date(date); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d; }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function isoDate(d) { return d.toISOString().slice(0, 10); }

export default function TodoTrackerPanel({ workspaceId }) {
  const [tab, setTab] = useState("HARIAN");
  const [tasks, setTasks] = useState([]);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [logs, setLogs] = useState({});

  const filtered = useMemo(() => tasks.filter(t => t.frekuensi === tab), [tasks, tab]);

  const load = async () => {
    const start = fmt(year, month, 1);
    const end = fmt(year, month, daysInMonth(year, month));
    const [t, l] = await Promise.all([
      api.get(`/workspaces/${workspaceId}/tasks`),
      api.get(`/workspaces/${workspaceId}/task-logs`, { params: { start, end } }),
    ]);
    setTasks(t.data);
    const m = {};
    l.data.forEach((x) => { m[`${x.task_id}_${x.date}`] = x.completed; });
    setLogs(m);
  };
  useEffect(() => { load(); }, [workspaceId, year, month]);

  const toggle = async (taskId, date) => {
    const key = `${taskId}_${date}`;
    const cur = !!logs[key];
    setLogs((p) => ({ ...p, [key]: !cur }));
    try { await api.post(`/workspaces/${workspaceId}/task-logs`, { task_id: taskId, date, completed: !cur }); }
    catch { setLogs((p) => ({ ...p, [key]: cur })); toast.error("Gagal"); }
  };

  const monthNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const monthNamesFull = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const dim = daysInMonth(year, month);

  // Weekly slots (4-5 weeks of the month)
  const weekSlots = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = startOfIsoWeek(first);
    const arr = []; let cur = start; let i = 0;
    while (cur <= new Date(year, month, dim) && i < 6) {
      arr.push({ label: `Minggu ${i + 1}`, date: isoDate(cur) });
      cur = addDays(cur, 7); i++;
    }
    return arr;
  }, [year, month, dim]);

  const monthSlots = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ label: monthNames[i], date: `${year}-${String(i + 1).padStart(2, "0")}-01` })), [year]);

  const todayStr = isoDate(today);

  const renderGrid = (slots) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-200">
            <th className="text-left font-semibold py-2 pr-3 min-w-[240px]">Nama Tugas</th>
            {slots.map((s) => (
              <th key={s.date} className="font-medium px-0.5 py-2 text-slate-400 text-center min-w-[28px]">
                {tab === "HARIAN" ? s.date.slice(-2) : s.label}
              </th>
            ))}
            <th className="text-right font-semibold py-2 pl-3 min-w-[70px]">Progres</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={slots.length + 2} className="text-center py-8 text-slate-500 text-sm">Belum ada task {tab.toLowerCase()}.</td></tr>}
          {filtered.map((t) => {
            const done = slots.filter(s => logs[`${t.id}_${s.date}`]).length;
            const pct = slots.length ? Math.round((done / slots.length) * 100) : 0;
            return (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-3">
                  <div className="font-medium text-slate-900">{t.name}</div>
                  <div className="text-[10px] text-slate-500">{t.kategori} • {t.frekuensi}</div>
                </td>
                {slots.map((s) => {
                  const completed = !!logs[`${t.id}_${s.date}`];
                  return (
                    <td key={s.date} className="p-0.5">
                      <div className="habit-cell" data-completed={completed} data-today={s.date === todayStr}
                           onClick={() => toggle(t.id, s.date)}
                           data-testid={`todo-cell-${t.id}-${s.date}`} />
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right">
                  <div className="font-semibold text-emerald-700">{pct}%</div>
                  <div className="text-[10px] text-slate-500">{done}/{slots.length}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const dailySlots = useMemo(() => Array.from({ length: dim }, (_, i) => ({ label: String(i + 1), date: fmt(year, month, i + 1) })), [year, month, dim]);

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-emerald-700 text-[10px] font-bold uppercase tracking-[0.2em]">To-Do Tracker</div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-1">Rutinitas Harian, Mingguan &amp; Bulanan</h2>
          <p className="text-xs text-slate-500 mt-1">Tugas diambil dari Execution Scoreboard berdasarkan frekuensi.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{monthNamesFull.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="HARIAN" data-testid="todo-harian">Harian</TabsTrigger>
          <TabsTrigger value="MINGGUAN" data-testid="todo-mingguan">Mingguan</TabsTrigger>
          <TabsTrigger value="BULANAN" data-testid="todo-bulanan">Bulanan</TabsTrigger>
        </TabsList>
        <TabsContent value="HARIAN" className="mt-5">{renderGrid(dailySlots)}</TabsContent>
        <TabsContent value="MINGGUAN" className="mt-5">{renderGrid(weekSlots)}</TabsContent>
        <TabsContent value="BULANAN" className="mt-5">{renderGrid(monthSlots)}</TabsContent>
      </Tabs>
    </Card>
  );
}
