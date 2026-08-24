import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import OkrPanel from "@/components/workspace/OkrPanel";
import InitiativePanel from "@/components/workspace/InitiativePanel";
import ExecutionPanel from "@/components/workspace/ExecutionPanel";
import AmaliyahPanel from "@/components/workspace/AmaliyahPanel";
import TodoTrackerPanel from "@/components/workspace/TodoTrackerPanel";
import { Target, ListChecks, ClipboardList, Sparkles, CalendarDays } from "lucide-react";

export default function WorkspacePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ws, setWs] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState("okr");

  const load = useCallback(async () => {
    const [wsRes, sumRes] = await Promise.all([
      api.get(`/workspaces/${id}`),
      api.get(`/workspaces/${id}/summary`),
    ]);
    setWs(wsRes.data);
    setSummary(sumRes.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!ws) return <div className="text-slate-500">Memuat workspace...</div>;

  const isSpv = user?.role === "spv" || user?.role === "admin";

  return (
    <div className="space-y-6" data-testid="workspace-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-emerald-700 text-xs font-bold uppercase tracking-[0.2em]">Workspace</div>
          <h1 className="font-display text-4xl font-bold text-slate-900 mt-2">{ws.name}</h1>
          <p className="text-slate-500 mt-1">
            {ws.owner?.name} • {ws.division || "Umum"} • Cycle {ws.cycle}
          </p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label="Execution" value={`${summary.tasks.execution_score}%`} sub={`${summary.tasks.selesai}/${summary.tasks.total} selesai`} progress={summary.tasks.execution_score} color="emerald" />
          <MiniStat label="OKR Progress" value={`${summary.okr.avg_progress}%`} sub={`${summary.okr.total} objective`} progress={summary.okr.avg_progress} color="amber" />
          <MiniStat label="Overdue" value={summary.tasks.overdue} sub={`${summary.tasks.terkendala} terkendala`} color={summary.tasks.overdue ? "rose" : "slate"} />
          <MiniStat label="Amaliyah 30 hari" value={`${summary.habits.compliance_30d}%`} sub={`${summary.habits.total} amalan`} progress={summary.habits.compliance_30d} color="teal" />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none h-auto p-0 gap-1">
          <TabsTrigger value="okr" data-testid="tab-okr" className="tab-underline"><Target className="w-4 h-4 mr-2" />OKR &amp; Initiative</TabsTrigger>
          <TabsTrigger value="execution" data-testid="tab-execution" className="tab-underline"><ClipboardList className="w-4 h-4 mr-2" />Execution Scoreboard</TabsTrigger>
          <TabsTrigger value="todo" data-testid="tab-todo" className="tab-underline"><CalendarDays className="w-4 h-4 mr-2" />Tracker Harian/Mingguan</TabsTrigger>
          <TabsTrigger value="amaliyah" data-testid="tab-amaliyah" className="tab-underline"><Sparkles className="w-4 h-4 mr-2" />Amaliyah Spiritual</TabsTrigger>
        </TabsList>

        <TabsContent value="okr" className="mt-8 space-y-8">
          <OkrPanel workspaceId={id} isSpv={isSpv} onChange={load} />
          <InitiativePanel workspaceId={id} isSpv={isSpv} onChange={load} />
        </TabsContent>
        <TabsContent value="execution" className="mt-8">
          <ExecutionPanel workspaceId={id} isSpv={isSpv} onChange={load} />
        </TabsContent>
        <TabsContent value="todo" className="mt-8">
          <TodoTrackerPanel workspaceId={id} isSpv={isSpv} />
        </TabsContent>
        <TabsContent value="amaliyah" className="mt-8">
          <AmaliyahPanel workspaceId={id} isSpv={isSpv} onChange={load} />
        </TabsContent>
      </Tabs>

      <style>{`
        .tab-underline {
          border-radius: 0 !important;
          background: transparent !important;
          border-bottom: 2px solid transparent !important;
          color: #64748b !important;
          padding: 12px 16px !important;
          font-weight: 500 !important;
          box-shadow: none !important;
        }
        .tab-underline[data-state="active"] {
          color: #047857 !important;
          border-bottom-color: #059669 !important;
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}

function MiniStat({ label, value, sub, progress, color = "emerald" }) {
  const bar = { emerald: "[&>div]:bg-emerald-600", amber: "[&>div]:bg-amber-500", rose: "[&>div]:bg-rose-500", slate: "[&>div]:bg-slate-400", teal: "[&>div]:bg-teal-600" }[color];
  return (
    <Card className="p-5 border-slate-200 shadow-sm">
      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{label}</div>
      <div className="font-display text-2xl font-bold text-slate-900 mt-1">{value}</div>
      {typeof progress === "number" && <Progress value={progress} className={`h-1.5 mt-3 ${bar}`} />}
      {sub && <div className="text-xs text-slate-500 mt-2">{sub}</div>}
    </Card>
  );
}
