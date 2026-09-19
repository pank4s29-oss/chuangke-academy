"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StageBlueprint from "./StageBlueprint";
import type { TaskWithFields } from "@/lib/content/taskSections";
import AssignmentFileImport from "./AssignmentFileImport";

type Submission = { id: string; user_id: string; stage_key: string; task_key: string; status: "draft" | "completed"; review_status: "pending" | "approved" | "needs_revision"; answer_json: Record<string, unknown>; teacher_feedback: string | null; consultant_advice: string | null; submitted_at: string | null; updated_at: string };
type Profile = { id: string; display_name: string | null; role: string };
type Props = { optionLabels: Record<string, string>; stageTitles: Record<string, string>; stageTasks: Record<string, TaskWithFields[]> };
const reviewLabels = { pending: "待批改", approved: "已通過", needs_revision: "需要修改" } as const;

export default function TeacherDashboard({ optionLabels, stageTitles, stageTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selected, setSelected] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState("");
  const [advice, setAdvice] = useState("");
  const [filter, setFilter] = useState<"all" | Submission["review_status"]>("all");
  const [status, setStatus] = useState("載入中…");
  const [view, setView] = useState<"answers" | "blueprint">("answers");
  const [importStage, setImportStage] = useState(Object.keys(stageTasks)[0] ?? "stage-01");
  const [importTaskKey, setImportTaskKey] = useState(stageTasks[Object.keys(stageTasks)[0] ?? "stage-01"]?.[0]?.key ?? "");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setAllowed(false); setStatus("請先登入教師帳號"); return; }
    const { data: profile } = await supabase.from("profiles").select("id,display_name,role").eq("id", auth.user.id).single();
    if (profile?.role !== "teacher") { setAllowed(false); setStatus("此頁面僅限教師使用"); return; }
    setAllowed(true);
    const [{ data: submissionRows, error }, { data: profileRows }] = await Promise.all([
      supabase.from("submissions").select("id,user_id,stage_key,task_key,status,review_status,answer_json,teacher_feedback,consultant_advice,submitted_at,updated_at").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id,display_name,role"),
    ]);
    if (error) { setStatus(`載入失敗：${error.message}`); return; }
    setSubmissions((submissionRows ?? []) as Submission[]);
    setProfiles(Object.fromEntries(((profileRows ?? []) as Profile[]).map((item) => [item.id, item])));
    setStatus(`共 ${submissionRows?.length ?? 0} 份提交`);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function grade(reviewStatus: Submission["review_status"]) {
    if (!selected) return;
    const { error } = await supabase.from("submissions").update({ review_status: reviewStatus, teacher_feedback: feedback.trim() || null, consultant_advice: advice.trim() || null, graded_at: new Date().toISOString() }).eq("id", selected.id);
    if (error) { setStatus(`批改失敗：${error.message}`); return; }
    setSubmissions((current) => current.map((item) => item.id === selected.id ? { ...item, review_status: reviewStatus, teacher_feedback: feedback.trim() || null, consultant_advice: advice.trim() || null } : item));
    setSelected((current) => current ? { ...current, review_status: reviewStatus, teacher_feedback: feedback.trim() || null, consultant_advice: advice.trim() || null } : current);
    setStatus("批改結果已保存");
  }

  const visible = submissions.filter((item) => filter === "all" || item.review_status === filter);
  const learners = Object.values(profiles).filter((profile) => profile.role !== "teacher");
  const importTasks = stageTasks[importStage] ?? [];
  const importTask = importTasks.find((item) => item.key === importTaskKey) ?? importTasks[0];
  if (allowed === false) return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] px-5"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200"><p className="text-sm font-semibold text-rose-600">無法進入教師後台</p><h1 className="mt-3 text-2xl font-bold">{status}</h1><p className="mt-3 text-sm leading-7 text-slate-500">請使用已設定為教師角色的帳號登入。</p><Link href="/app" className="mt-6 inline-block rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">返回課程</Link></div></main>;
  if (allowed === null) return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] text-sm text-slate-500">載入教師後台…</main>;

  return <main className="min-h-screen bg-[#f5f7f4] text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Teacher workspace</p><h1 className="mt-1 text-2xl font-bold">作業批改後台</h1></div><div className="flex items-center gap-4 text-sm"><span className="text-slate-500">{status}</span><Link href="/teacher/guide" className="font-semibold text-slate-600">教師帳號設定</Link><Link href="/app" className="font-semibold text-teal-700">回到學員端</Link></div></div></header><div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[330px_1fr] lg:px-8"><aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex flex-wrap gap-2">{(["all", "pending", "needs_revision", "approved"] as const).map((key) => <button key={key} onClick={() => setFilter(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === key ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"}`}>{key === "all" ? "全部" : reviewLabels[key]}</button>)}</div><div className="mt-5"><label className="block text-xs font-semibold text-slate-500" htmlFor="import-stage">匯入作業所屬階段</label><select id="import-stage" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={importStage} onChange={(event) => { const nextStage = event.target.value; setImportStage(nextStage); setImportTaskKey(stageTasks[nextStage]?.[0]?.key ?? ""); }}>{Object.entries(stageTitles).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select><select aria-label="匯入任務" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={importTaskKey} onChange={(event) => setImportTaskKey(event.target.value)}>{importTasks.map((task) => <option key={task.key} value={task.key}>{task.title}</option>)}</select><div className="mt-3"><AssignmentFileImport stageKey={importStage} task={importTask} learners={learners} onImported={(fileName, learnerName, answerCount) => { setStatus(`已建立 ${learnerName} 的 ${fileName}，辨識 ${answerCount} 個答案欄位`); void load(); }} /></div></div><div className="mt-5 space-y-2">{visible.map((item) => <button key={item.id} onClick={() => { setSelected(item); setFeedback(item.teacher_feedback ?? ""); setAdvice(item.consultant_advice ?? ""); setView("answers"); }} className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id === item.id ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-teal-200"}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{profiles[item.user_id]?.display_name || `學員 ${item.user_id.slice(0, 6)}`}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{reviewLabels[item.review_status]}</span></div><p className="mt-2 text-xs text-slate-500">{item.stage_key} · {item.task_key}</p><p className="mt-1 text-xs text-slate-400">{item.submitted_at ? new Date(item.submitted_at).toLocaleString("zh-TW") : "草稿更新"}</p></button>)}{visible.length === 0 && <p className="py-8 text-center text-sm text-slate-500">目前沒有符合條件的提交。</p>}</div></aside><section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:p-8">{selected ? <><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5"><div><p className="text-sm font-semibold text-teal-700">{selected.stage_key} · {selected.task_key}</p><h2 className="mt-2 text-2xl font-bold">{profiles[selected.user_id]?.display_name || "學員作業"}</h2><p className="mt-2 text-sm text-slate-500">狀態：{selected.status === "completed" ? "學員已提交" : "學員草稿"}</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">{reviewLabels[selected.review_status]}</span></div><div className="mt-6 flex flex-wrap gap-2 border-b border-slate-100 pb-3"><button onClick={() => setView("answers")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === "answers" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>本次作答</button><button onClick={() => setView("blueprint")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === "blueprint" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>完整階段藍圖</button></div>{view === "blueprint" ? <div className="mt-6"><StageBlueprint stageTitle={stageTitles[selected.stage_key] ?? selected.stage_key} tasks={stageTasks[selected.stage_key] ?? []} answers={Object.assign({}, ...submissions.filter((item) => item.user_id === selected.user_id && item.stage_key === selected.stage_key).map((item) => item.answer_json))} optionLabels={optionLabels} learnerName={profiles[selected.user_id]?.display_name || `學員 ${selected.user_id.slice(0, 6)}`} /></div> : <div className="mt-6"><h3 className="text-sm font-bold text-slate-700">作答內容</h3><div className="mt-3 grid gap-3">{Object.entries(selected.answer_json ?? {}).map(([key, value]) => <article key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{key}</p><p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{Array.isArray(value) ? value.map((item) => optionLabels[String(item)] ?? String(item)).join("、") : optionLabels[String(value)] ?? String(value ?? "")}</p></article>)}{Object.keys(selected.answer_json ?? {}).length === 0 && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">這份提交沒有可顯示的作答內容。</p>}</div></div>}<div className="mt-7 border-t border-slate-100 pt-6"><label className="block text-sm font-bold text-slate-700" htmlFor="advice">顧問建議</label><textarea id="advice" className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="整理給顧問的下一步建議、風險與跟進重點…" value={advice} onChange={(event) => setAdvice(event.target.value)} /><label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="feedback">教師回饋</label><textarea id="feedback" className="mt-3 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="寫下具體、可執行的回饋…" value={feedback} onChange={(event) => setFeedback(event.target.value)} /><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void grade("needs_revision")} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">退回修改</button><button onClick={() => void grade("approved")} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">批改通過</button></div></div></> : <div className="grid min-h-[520px] place-items-center text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">✓</div><h2 className="mt-5 text-xl font-bold">選擇一份作業開始批改</h2><p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">左側會列出學員的草稿與已提交作業，選取後即可檢視答案並留下回饋。</p></div></div>}</section></div></main>;
}
