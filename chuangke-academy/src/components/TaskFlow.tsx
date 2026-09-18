"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Stage } from "@/lib/content/schema";
import type { TaskSection } from "@/lib/content/taskSections";
import { createClient } from "@/lib/supabase/client";

type Props = { stage: Stage; courseKey: string; tasks: TaskSection[] };

type Tab = "lecture" | "assignment";

export default function TaskFlow({ stage, courseKey, tasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("lecture");
  const [userId, setUserId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [status, setStatus] = useState("登入後可同步任務完成狀態");
  const task = tasks[active];

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!alive) return;
      const id = auth.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const { data } = await supabase.from("submissions").select("task_key,status").eq("stage_key", stage.key).eq("status", "completed");
      if (alive) setCompleted((data ?? []).map((row) => row.task_key));
    }
    void load();
    return () => { alive = false; };
  }, [stage.key, supabase]);

  async function markComplete() {
    if (!task) return;
    if (!userId) { setCompleted((current) => current.includes(task.key) ? current : [...current, task.key]); setStatus("本次瀏覽已標記完成；登入後才能跨裝置同步"); return; }
    setStatus("正在同步…");
    const { error } = await supabase.from("submissions").upsert({ user_id: userId, course_key: courseKey, stage_key: stage.key, task_key: task.key, status: "completed", answer_json: { source: "task-flow" }, submitted_at: new Date().toISOString() }, { onConflict: "user_id,stage_key,task_key" });
    if (error) { setStatus(`同步失敗：${error.message}`); return; }
    setCompleted((current) => current.includes(task.key) ? current : [...current, task.key]);
    setStatus("任務完成狀態已同步");
  }

  if (!task) return <div className="rounded-3xl bg-white p-8">此階段尚未建立任務。</div>;
  const percent = tasks.length ? Math.round((completed.filter((key) => tasks.some((item) => item.key === key)).length / tasks.length) * 100) : 0;

  return <div className="min-h-screen bg-[#f5f7f4] text-slate-900"><header className="border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8"><Link href="/app" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-sm font-bold text-white">創</span><span className="font-semibold">創客學院</span></Link><div className="flex items-center gap-4 text-sm text-slate-500"><span>{status}</span><Link href="/app" className="font-medium text-teal-700">返回課程</Link></div></div></header><main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[260px_1fr] lg:px-8"><aside className="lg:sticky lg:top-6 lg:self-start"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">任務式學習</p><h1 className="mt-3 text-2xl font-bold">{stage.title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{stage.summary}</p><div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"><div className="flex justify-between text-sm"><span>階段進度</span><strong className="text-teal-700">{percent}%</strong></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${percent}%` }} /></div></div><nav className="mt-6 space-y-2" aria-label="階段任務">{tasks.map((item, index) => <button key={item.key} onClick={() => { setActive(index); setTab("lecture"); }} className={`w-full rounded-xl px-3 py-3 text-left text-sm ${index === active ? "bg-teal-700 font-semibold text-white" : "bg-white text-slate-600 hover:bg-teal-50"}`}><span className="block text-xs opacity-70">{completed.includes(item.key) ? "已完成" : `任務 ${index + 1}`}</span><span className="mt-1 block">{item.title}</span></button>)}</nav></aside><section><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:p-8"><p className="text-sm font-semibold text-teal-700">任務 {active + 1} / {tasks.length}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{task.title}</h2><p className="mt-3 leading-7 text-slate-600">完成一個任務的順序是：先讀這一任務的講義，再完成對應作業，最後標記任務完成。</p><div className="mt-7 flex flex-wrap gap-2 border-b border-slate-100 pb-3"><button onClick={() => setTab("lecture")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === "lecture" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>1. 閱讀講義</button><button onClick={() => setTab("assignment")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === "assignment" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>2. 完成作業</button></div><div className="prose prose-slate mt-7 max-w-none prose-headings:font-bold prose-a:text-teal-700 prose-blockquote:border-teal-500 prose-blockquote:bg-teal-50 prose-blockquote:px-4 prose-table:text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{tab === "lecture" ? task.lecture : task.assignment}</ReactMarkdown></div><div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="text-sm leading-6 text-teal-900">{tab === "lecture" ? "讀完後切換到「完成作業」，把教材方法用在自己的情境。" : "確認這個任務的作業已完成，再標記任務完成。"}</p>{tab === "lecture" ? <button onClick={() => setTab("assignment")} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">開始對應作業 →</button> : <button onClick={markComplete} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">{completed.includes(task.key) ? "已完成此任務" : "標記任務完成"}</button>}</div></div></section></main></div>;
}
