"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Workspace = { id: string; name: string; course_key: string; updated_at: string; created_at: string };

type Props = { courseKey: string; courseTitle: string; stageOptions: { key: string; title: string }[] };

export default function WorkspaceLauncher({ courseKey, courseTitle, stageOptions }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!alive) return;
      setUserId(auth.user?.id ?? null);
      if (!auth.user) { setLoading(false); return; }
      const { data, error } = await supabase.from("assignment_workspaces").select("id,name,course_key,updated_at,created_at").eq("course_key", courseKey).order("updated_at", { ascending: false });
      if (alive) {
        setWorkspaces((data ?? []) as Workspace[]);
        if (error) setMessage(`載入作業清單失敗：${error.message}`);
        setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [courseKey, supabase]);

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setMessage("請先輸入作業名稱，例如：王老師－霧眉服務定位"); return; }
    if (!userId) { setMessage("請先登入，才能建立可跨裝置同步的作業"); return; }
    setCreating(true); setMessage("");
    const { data, error } = await supabase.from("assignment_workspaces").insert({ owner_id: userId, course_key: courseKey, name: trimmed }).select("id,name,course_key,updated_at,created_at").single();
    setCreating(false);
    if (error) { setMessage(`建立失敗：${error.message}`); return; }
    if (data) { setWorkspaces((current) => [data as Workspace, ...current]); setName(""); setMessage("作業已建立，請點選它開始作答"); }
  }

  if (!userId && !loading) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950"><strong className="block text-base">請先登入再開始建立作業</strong><p className="mt-2">登入後，每一份作業都會有自己的名稱與進度，不會再和之前匯入的作業混在一起。</p><Link href="/auth/login" className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white">前往登入</Link></div>;

  return <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">我的作業工作區</p><h2 className="mt-2 text-2xl font-bold">先命名，再開始作答</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">每建立一份作業，就會有獨立的答案、進度與階段藍圖。你可以為不同老師、不同服務或不同學員各建立一份。</p></div>
      <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">{courseTitle}</span>
    </div>
    <form onSubmit={createWorkspace} className="mt-6 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row"><label className="sr-only" htmlFor={`workspace-name-${courseKey}`}>新作業名稱</label><input id={`workspace-name-${courseKey}`} value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="例如：美業老師－霧眉教學第一版" maxLength={120} /><button disabled={creating} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{creating ? "建立中…" : "建立新作業"}</button></form>
    {message && <p className="mt-3 text-sm font-medium text-teal-800">{message}</p>}
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {loading ? <p className="text-sm text-slate-500">載入作業清單…</p> : workspaces.map((workspace) => <article key={workspace.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/40"><div className="flex items-start justify-between gap-3"><strong className="leading-6 text-slate-800">{workspace.name}</strong><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">作業</span></div><p className="mt-2 text-xs text-slate-500">最後更新：{new Date(workspace.updated_at).toLocaleString("zh-TW")}</p><div className="mt-3 flex flex-wrap gap-2">{stageOptions.map((stage) => <Link key={stage.key} href={`/app/workspaces/${workspace.id}/courses/${courseKey}/stages/${stage.key}/learn`} className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800">{stage.title.split("：")[0]}：開始／繼續</Link>)}</div></article>)}
      {!loading && workspaces.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm leading-7 text-slate-500 md:col-span-2">目前還沒有作業。請先在上方輸入名稱建立第一份，系統就不會再自動載入之前匯入的美業老師作業。</div>}
    </div>
  </section>;
}
