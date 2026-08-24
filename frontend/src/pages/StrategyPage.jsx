import { useEffect, useState, useMemo } from "react";
import { api, formatErr } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit3, Landmark, Users, Cog, GraduationCap, Target, X, Sparkles, Building2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

const PERSPECTIVES = [
  { id: "financial", label: "Financial Aspect", desc: "Pencapaian keuntungan, pertumbuhan pendapatan, dan nilai ekonomi.", icon: Landmark, tone: "emerald" },
  { id: "customer", label: "Customer Aspect", desc: "Kepuasan, loyalitas, dan pangsa pasar pelanggan.", icon: Users, tone: "teal" },
  { id: "process", label: "Internal Process Aspect", desc: "Efisiensi, kualitas, dan produktivitas operasional.", icon: Cog, tone: "amber" },
  { id: "learning", label: "Learning & Growth Aspect", desc: "Kompetensi karyawan, budaya, dan teknologi.", icon: GraduationCap, tone: "rose" },
];

function kpiProgress(k) {
  const t = Number(k.target || 0), b = Number(k.baseline || 0), r = Number(k.realisasi || 0);
  if (t === b) return r >= t ? 100 : 0;
  return Math.max(0, Math.min(100, ((r - b) / (t - b)) * 100));
}
function healthColor(p) { return p >= 75 ? "bg-emerald-500" : p >= 40 ? "bg-amber-500" : "bg-rose-500"; }
function healthPill(p) {
  const c = p >= 75 ? "bg-emerald-100 text-emerald-700" : p >= 40 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  const l = p >= 75 ? "On Track" : p >= 40 ? "At Risk" : "Off Track";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c}`}>{l}</span>;
}

export default function StrategyPage({ isSpv }) {
  const [tab, setTab] = useState("landasan");
  const [year, setYear] = useState(2026);
  const [org, setOrg] = useState(null);
  const [goals, setGoals] = useState([]);
  const [cascade, setCascade] = useState(null);

  const load = async () => {
    try {
      const [o, g] = await Promise.all([api.get("/organization"), api.get("/strategy/goals", { params: { year } })]);
      setOrg(o.data);
      setGoals(g.data);
    } catch (e) {
      toast.error("Gagal memuat data strategi");
      if (!org) setOrg({ name: "", vision: "", mission: [], values: [] });
    }
  };
  const loadCascade = async () => {
    try {
      const { data } = await api.get("/strategy/cascade", { params: { year } });
      setCascade(data);
    } catch (e) {
      toast.error("Gagal memuat cascade view");
      setCascade({ organization: { name: "", vision: "", values: [] }, goals: [], okrs: [], initiatives: [] });
    }
  };

  useEffect(() => { load(); }, [year]);
  useEffect(() => { if (tab === "cascade") loadCascade(); }, [tab, year]);

  return (
    <div className="space-y-6" data-testid="strategy-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-emerald-700 text-xs font-bold uppercase tracking-[0.2em]">Strategi Eksekusi</div>
          <h1 className="font-display text-4xl font-bold text-slate-900 mt-2">Blueprint Perusahaan</h1>
          <p className="text-slate-500 mt-2">Landasan strategis, Balanced Scorecard, dan cascade view — dari visi ke task harian.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500">Tahun</Label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" data-testid="strategy-year" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none h-auto p-0 gap-1">
          <TabsTrigger value="landasan" data-testid="tab-landasan" className="tab-underline"><Building2 className="w-4 h-4 mr-2" />Landasan Strategis</TabsTrigger>
          <TabsTrigger value="bsc" data-testid="tab-bsc" className="tab-underline"><Target className="w-4 h-4 mr-2" />Balanced Scorecard</TabsTrigger>
          <TabsTrigger value="cascade" data-testid="tab-cascade" className="tab-underline"><Sparkles className="w-4 h-4 mr-2" />Cascade View</TabsTrigger>
        </TabsList>

        <TabsContent value="landasan" className="mt-8">
          <LandasanPanel org={org} isSpv={isSpv} onSaved={load} />
        </TabsContent>
        <TabsContent value="bsc" className="mt-8">
          <BscPanel goals={goals} year={year} isSpv={isSpv} onChange={load} />
        </TabsContent>
        <TabsContent value="cascade" className="mt-8">
          <CascadePanel cascade={cascade} />
        </TabsContent>
      </Tabs>

      <style>{`
        .tab-underline { border-radius:0 !important; background:transparent !important; border-bottom:2px solid transparent !important; color:#64748b !important; padding:12px 16px !important; font-weight:500 !important; box-shadow:none !important; }
        .tab-underline[data-state="active"] { color:#047857 !important; border-bottom-color:#059669 !important; background:transparent !important; }
      `}</style>
    </div>
  );
}

function LandasanPanel({ org, isSpv, onSaved }) {
  const [form, setForm] = useState({ name: "", vision: "", mission: [""], values: [""] });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (org) setForm({
      name: org.name || "",
      vision: org.vision || "",
      mission: org.mission?.length ? org.mission : [""],
      values: org.values?.length ? org.values : [""],
    });
  }, [org]);

  const setList = (k, i, v) => setForm(f => ({ ...f, [k]: f[k].map((x, idx) => idx === i ? v : x) }));
  const addItem = (k) => setForm(f => ({ ...f, [k]: [...f[k], ""] }));
  const rmItem = (k, i) => setForm(f => ({ ...f, [k]: f[k].filter((_, idx) => idx !== i) }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form, mission: form.mission.filter(Boolean), values: form.values.filter(Boolean) };
      await api.put("/organization", payload);
      toast.success("Landasan strategis tersimpan");
      onSaved?.();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (!org) return <div className="text-slate-500 text-sm">Memuat...</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="p-6 border-slate-200 shadow-sm">
        <div className="text-emerald-700 text-[10px] font-bold uppercase tracking-[0.2em]">Identitas</div>
        <h3 className="font-display text-lg font-semibold text-slate-900 mt-1">Perusahaan</h3>
        <div className="mt-4 space-y-4">
          <div><Label>Nama Perusahaan</Label><Input disabled={!isSpv} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="org-name" /></div>
          <div><Label>Visi</Label><Textarea disabled={!isSpv} rows={4} value={form.vision} onChange={(e) => setForm(f => ({ ...f, vision: e.target.value }))} data-testid="org-vision" placeholder="Menjadi..." /></div>
        </div>
      </Card>

      <Card className="p-6 border-slate-200 shadow-sm">
        <div className="text-emerald-700 text-[10px] font-bold uppercase tracking-[0.2em]">Misi &amp; Nilai</div>
        <h3 className="font-display text-lg font-semibold text-slate-900 mt-1">Prinsip</h3>
        <div className="mt-4 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2"><Label>Misi</Label>{isSpv && <Button variant="outline" size="sm" onClick={() => addItem("mission")} data-testid="add-mission"><Plus className="w-3 h-3 mr-1" />Misi</Button>}</div>
            <div className="space-y-2">
              {form.mission.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-6 h-9 text-xs flex items-center justify-center font-semibold text-emerald-700">{i + 1}.</span>
                  <Textarea rows={2} disabled={!isSpv} value={m} onChange={(e) => setList("mission", i, e.target.value)} data-testid={`mission-${i}`} />
                  {isSpv && form.mission.length > 1 && <Button variant="ghost" size="sm" onClick={() => rmItem("mission", i)}><X className="w-4 h-4" /></Button>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><Label>Nilai / Values</Label>{isSpv && <Button variant="outline" size="sm" onClick={() => addItem("values")} data-testid="add-value"><Plus className="w-3 h-3 mr-1" />Value</Button>}</div>
            <div className="space-y-2">
              {form.values.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <Input disabled={!isSpv} value={v} onChange={(e) => setList("values", i, e.target.value)} placeholder="Amanah, Ihsan, Ta'awun..." data-testid={`value-${i}`} />
                  {isSpv && form.values.length > 1 && <Button variant="ghost" size="sm" onClick={() => rmItem("values", i)}><X className="w-4 h-4" /></Button>}
                </div>
              ))}
            </div>
          </div>
          {isSpv && (
            <Button onClick={save} disabled={busy} data-testid="org-save" className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 h-11">
              {busy ? "Menyimpan..." : "Simpan Landasan"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function BscPanel({ goals, year, isSpv, onChange }) {
  const grouped = useMemo(() => {
    const m = {}; PERSPECTIVES.forEach(p => { m[p.id] = []; });
    goals.forEach(g => { (m[g.perspective] = m[g.perspective] || []).push(g); });
    return m;
  }, [goals]);

  const [open, setOpen] = useState(false);
  const [perspectiveForNew, setPerspectiveForNew] = useState("financial");
  const [editing, setEditing] = useState(null);
  const emptyKpi = () => ({ id: crypto.randomUUID(), name: "", baseline: 0, target: 0, realisasi: 0, unit: "%", linked_kr_id: "" });
  const initial = () => ({ perspective: "financial", title: "", year, order: 0, kpis: [emptyKpi()] });
  const [form, setForm] = useState(initial());

  const openNew = (p) => { setEditing(null); setPerspectiveForNew(p); setForm({ ...initial(), perspective: p }); setOpen(true); };
  const openEdit = (g) => { setEditing(g); setForm({ ...g, kpis: g.kpis.length ? g.kpis : [emptyKpi()] }); setOpen(true); };

  const updKpi = (i, k, v) => setForm(f => ({ ...f, kpis: f.kpis.map((x, idx) => idx === i ? { ...x, [k]: v } : x) }));
  const addKpi = () => setForm(f => ({ ...f, kpis: [...f.kpis, emptyKpi()] }));
  const rmKpi = (i) => setForm(f => ({ ...f, kpis: f.kpis.filter((_, idx) => idx !== i) }));

  const save = async () => {
    try {
      const payload = {
        ...form, year: Number(form.year),
        kpis: form.kpis.map(k => ({ ...k, baseline: Number(k.baseline), target: Number(k.target), realisasi: Number(k.realisasi) })),
      };
      if (editing) await api.patch(`/strategy/goals/${editing.id}`, payload);
      else await api.post("/strategy/goals", payload);
      toast.success("Goal tersimpan"); setOpen(false); onChange?.();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const remove = async (g) => { if (!window.confirm(`Hapus goal "${g.title}"?`)) return; await api.delete(`/strategy/goals/${g.id}`); onChange?.(); };

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5">
        {PERSPECTIVES.map((p) => (
          <Card key={p.id} className="p-6 border-slate-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center"><p.icon className="w-5 h-5" /></div>
                <div>
                  <div className="font-display text-lg font-semibold text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5 max-w-md">{p.desc}</div>
                </div>
              </div>
              {isSpv && <Button size="sm" onClick={() => openNew(p.id)} data-testid={`add-goal-${p.id}`} className="rounded-full bg-emerald-700 hover:bg-emerald-800"><Plus className="w-3 h-3 mr-1" />Goal</Button>}
            </div>

            {grouped[p.id].length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">Belum ada goal.</div>
            ) : (
              <div className="space-y-4">
                {grouped[p.id].map((g, gi) => (
                  <div key={g.id} className="border border-slate-200 rounded-lg p-4" data-testid={`goal-${g.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-emerald-700 tracking-widest">GOAL #{gi + 1}</div>
                        <div className="font-semibold text-slate-900 mt-0.5">{g.title}</div>
                      </div>
                      {isSpv && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(g)} data-testid={`goal-edit-${g.id}`}><Edit3 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(g)} data-testid={`goal-delete-${g.id}`}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      {g.kpis.map((k) => {
                        const pr = Math.round(kpiProgress(k));
                        return (
                          <div key={k.id} className="text-sm">
                            <div className="flex justify-between items-center">
                              <div className="text-slate-700 min-w-0 flex-1 pr-3 truncate">{k.name || <em className="text-slate-400">KPI kosong</em>}</div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-slate-500">{k.realisasi}{k.unit} / <span className="text-emerald-700 font-semibold">{k.target}{k.unit}</span></span>
                                {healthPill(pr)}
                              </div>
                            </div>
                            <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${healthColor(pr)} transition-all`} style={{ width: `${pr}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Goal" : "Tambah Goal"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Perspective</Label>
                <Select value={form.perspective} onValueChange={(v) => setForm(f => ({ ...f, perspective: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERSPECTIVES.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tahun</Label><Input type="number" value={form.year} onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))} /></div>
            </div>
            <div><Label>Judul Sasaran Strategis</Label><Textarea rows={2} value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} data-testid="goal-title" placeholder="Peningkatan Net Profit Margin..." /></div>
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-3"><Label>Indikator KPI</Label><Button size="sm" variant="outline" onClick={addKpi} data-testid="add-kpi"><Plus className="w-3 h-3 mr-1" /> KPI</Button></div>
              <div className="space-y-3">
                {form.kpis.map((k, i) => (
                  <div key={k.id} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/30">
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] font-bold text-emerald-700 tracking-widest">KPI {i + 1}</div>
                      {form.kpis.length > 1 && <Button variant="ghost" size="sm" onClick={() => rmKpi(i)} data-testid={`kpi-remove-${i}`}><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                    <Input placeholder="Nama KPI" value={k.name} onChange={(e) => updKpi(i, "name", e.target.value)} data-testid={`kpi-name-${i}`} />
                    <div className="grid grid-cols-4 gap-2">
                      <Input type="number" placeholder="Baseline" value={k.baseline} onChange={(e) => updKpi(i, "baseline", e.target.value)} data-testid={`kpi-baseline-${i}`} />
                      <Input type="number" placeholder="Target" value={k.target} onChange={(e) => updKpi(i, "target", e.target.value)} data-testid={`kpi-target-${i}`} />
                      <Input type="number" placeholder="Realisasi" value={k.realisasi} onChange={(e) => updKpi(i, "realisasi", e.target.value)} data-testid={`kpi-realisasi-${i}`} />
                      <Input placeholder="Unit (%, Rp, hari)" value={k.unit} onChange={(e) => updKpi(i, "unit", e.target.value)} data-testid={`kpi-unit-${i}`} />
                    </div>
                    <Input placeholder="Link Key Result ID (opsional)" value={k.linked_kr_id || ""} onChange={(e) => updKpi(i, "linked_kr_id", e.target.value)} data-testid={`kpi-linked-${i}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={save} className="bg-emerald-700 hover:bg-emerald-800" data-testid="goal-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CascadePanel({ cascade }) {
  if (!cascade) return <div className="text-slate-500 text-sm">Memuat...</div>;
  const { organization, goals, okrs, initiatives } = cascade;
  const grouped = {}; PERSPECTIVES.forEach(p => { grouped[p.id] = []; });
  goals.forEach(g => { (grouped[g.perspective] = grouped[g.perspective] || []).push(g); });

  return (
    <Card className="p-6 md:p-8 border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="text-emerald-700 text-xs font-bold uppercase tracking-[0.2em]">Landasan</div>
        <h3 className="font-display text-2xl font-bold text-slate-900 mt-2">{organization.name}</h3>
        <p className="text-slate-600 mt-3 italic">"{organization.vision || "Belum ada visi"}"</p>
        {organization.values?.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {organization.values.map((v, i) => <Badge key={i} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">{v}</Badge>)}
          </div>
        )}
      </div>

      <div className="w-px h-8 bg-emerald-300 mx-auto" />

      <div className="grid md:grid-cols-2 gap-5">
        {PERSPECTIVES.map((p) => (
          <div key={p.id} className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center"><p.icon className="w-4 h-4" /></div>
              <div className="font-semibold text-slate-900">{p.label}</div>
            </div>
            <div className="ml-4 border-l-2 border-emerald-200 pl-4 space-y-3">
              {grouped[p.id].length === 0 && <div className="text-xs text-slate-400 italic">Belum ada goal</div>}
              {grouped[p.id].map((g) => (
                <div key={g.id}>
                  <div className="text-sm font-semibold text-slate-800">{g.title}</div>
                  {g.kpis.map((k) => {
                    const pr = Math.round(kpiProgress(k));
                    const linked = k.linked_kr_id ? okrs.flatMap(o => o.key_results.map(kr => ({ ...kr, okr: o }))).find(kr => kr.id === k.linked_kr_id) : null;
                    return (
                      <div key={k.id} className="ml-3 mt-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <div className={`w-2 h-2 rounded-full ${healthColor(pr)}`} />
                          <span className="flex-1">{k.name}</span>
                          <span className="font-semibold text-slate-700">{pr}%</span>
                        </div>
                        {linked && (
                          <div className="ml-4 mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                            <LinkIcon className="w-3 h-3" /> OKR: {linked.okr.objective} → {linked.metric}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center">
        <div><div className="font-display text-2xl font-bold text-emerald-700">{goals.length}</div><div className="text-xs text-slate-500 mt-1">Sasaran Strategis</div></div>
        <div><div className="font-display text-2xl font-bold text-emerald-700">{okrs.length}</div><div className="text-xs text-slate-500 mt-1">OKR</div></div>
        <div><div className="font-display text-2xl font-bold text-emerald-700">{initiatives.length}</div><div className="text-xs text-slate-500 mt-1">Initiative</div></div>
      </div>
    </Card>
  );
}
