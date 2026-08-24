import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, TrendingUp, Users, Target, Activity, ArrowRight } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, tone = "emerald" }) {
  const toneMap = {
    emerald: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50",
    slate: "text-slate-700 bg-slate-100",
    rose: "text-rose-700 bg-rose-50",
  };
  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">{label}</div>
          <div className="font-display text-3xl font-bold text-slate-900 mt-2">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export default function SpvDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/spv").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Memuat dashboard...</div>;
  const rows = data?.workspaces || [];

  const totals = rows.reduce((acc, r) => {
    acc.workspaces += 1;
    acc.tasks += r.total_tasks;
    acc.selesai += r.selesai;
    acc.overdue += r.overdue;
    acc.okrProgSum += r.okr_progress;
    acc.habitSum += r.habit_compliance;
    return acc;
  }, { workspaces: 0, tasks: 0, selesai: 0, overdue: 0, okrProgSum: 0, habitSum: 0 });

  const avgOkr = rows.length ? Math.round(totals.okrProgSum / rows.length) : 0;
  const avgHabit = rows.length ? Math.round(totals.habitSum / rows.length) : 0;
  const execScore = totals.tasks ? Math.round((totals.selesai / totals.tasks) * 100) : 0;

  return (
    <div className="space-y-8" data-testid="spv-dashboard">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-emerald-700 text-xs font-bold uppercase tracking-[0.2em]">Dashboard SPV</div>
          <h1 className="font-display text-4xl font-bold text-slate-900 mt-2">Overview Tim</h1>
          <p className="text-slate-500 mt-2">Ringkasan progres OKR, execution scoreboard, dan amaliyah yaumiyah semua anggota.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Users} label="Total Workspace" value={totals.workspaces} sub="Anggota tim aktif" />
        <StatCard icon={CheckCircle2} label="Execution Score" value={`${execScore}%`} sub={`${totals.selesai}/${totals.tasks} task selesai`} tone="emerald" />
        <StatCard icon={AlertTriangle} label="Task Overdue" value={totals.overdue} sub="Perlu tindak lanjut" tone={totals.overdue ? "rose" : "slate"} />
        <StatCard icon={Target} label="OKR Progress" value={`${avgOkr}%`} sub="Rata-rata semua tim" tone="amber" />
      </div>

      <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">Progres per Workspace</h2>
            <p className="text-xs text-slate-500 mt-1">Klik untuk lihat detail arahan &amp; catatan.</p>
          </div>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0">
            <Activity className="w-3 h-3 mr-1" /> Amaliyah rata-rata {avgHabit}%
          </Badge>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <div className="p-12 text-center text-slate-500">Belum ada workspace. Ajak anggota tim untuk mendaftar.</div>
          )}
          {rows.map((r) => (
            <Link key={r.workspace.id} to={`/workspaces/${r.workspace.id}`}
                  className="flex items-center gap-6 p-5 hover:bg-slate-50 transition-colors duration-200 group"
                  data-testid={`ws-row-${r.workspace.id}`}>
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-semibold">
                {r.owner?.name?.slice(0, 1) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-slate-900 truncate">{r.workspace.name}</div>
                  {r.workspace.division && (
                    <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">{r.workspace.division}</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{r.owner?.name} • {r.owner?.email}</div>
              </div>
              <div className="hidden md:block w-40">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Execution</div>
                <Progress value={r.execution_score} className="h-2 [&>div]:bg-emerald-600" />
                <div className="text-xs text-slate-700 mt-1 font-medium">{r.execution_score}% • {r.selesai}/{r.total_tasks}</div>
              </div>
              <div className="hidden lg:block w-32">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">OKR</div>
                <Progress value={r.okr_progress} className="h-2 [&>div]:bg-amber-500" />
                <div className="text-xs text-slate-700 mt-1 font-medium">{r.okr_progress}%</div>
              </div>
              <div className="hidden lg:block w-32">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Amaliyah 30d</div>
                <Progress value={r.habit_compliance} className="h-2 [&>div]:bg-teal-600" />
                <div className="text-xs text-slate-700 mt-1 font-medium">{r.habit_compliance}%</div>
              </div>
              <div className="flex items-center gap-2">
                {r.overdue > 0 && (
                  <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-0">
                    {r.overdue} overdue
                  </Badge>
                )}
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
