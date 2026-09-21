"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Stage } from "@/lib/content/schema";
import type { AssignmentField, TaskWithFields } from "@/lib/content/taskSections";
import { fieldsToCanonical } from "@/lib/content/questions";
import QuestionRenderer from "./QuestionRenderer";
import AssignmentTable from "./AssignmentTable";
import StageBlueprint from "./StageBlueprint";
import { createClient } from "@/lib/supabase/client";

type Props = { stage: Stage; courseKey: string; tasks: TaskWithFields[] };
type Tab = "lecture" | "assignment" | "blueprint";
type Answers = Record<string, string | string[]>;

const storageKey = (stageKey: string) => `chuangke-draft-${stageKey}`;

function fieldIsComplete(field: AssignmentField, value: Answers[string]) {
  if (field.type === "checkboxes") return Array.isArray(value) ? value.length > 0 : Boolean(value);
  return String(value ?? "").trim().length > 0;
}

function fieldIsActive(field: AssignmentField, answers: Answers) {
  if (!field.dependsOn) return true;
  const value = answers[field.dependsOn.fieldKey];
  return Array.isArray(value) ? value.includes(field.dependsOn.optionKey) : value === field.dependsOn.optionKey;
}

function Field({ field, value, answers, onChange, onOtherChange, showError }: { field: AssignmentField; value: Answers[string]; answers: Answers; onChange: (value: string | string[]) => void; onOtherChange: (key: string, value: string) => void; showError?: boolean }) {
  const question = fieldsToCanonical([field])[0];
  return <QuestionRenderer question={question} value={value ?? ""} otherValues={answers} onOtherChange={onOtherChange} onChange={onChange} showError={showError} />;
}

export default function TaskFlow({ stage, courseKey, tasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("assignment");
  const [userId, setUserId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [status, setStatus] = useState("尚未保存；可先開始填寫");
  const [showErrors, setShowErrors] = useState(false);
  const task = tasks[active];

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(stage.key));
    if (saved) { try { setAnswers(JSON.parse(saved) as Answers); setStatus("已載入本機草稿"); } catch { window.localStorage.removeItem(storageKey(stage.key)); } }
    let alive = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!alive) return;
      const id = auth.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const [{ data: answerRows }, { data: submissionRows }] = await Promise.all([
        supabase.from("answers").select("question_key,value").eq("stage_key", stage.key),
        supabase.from("submissions").select("task_key,status").eq("stage_key", stage.key),
      ]);
      if (alive && answerRows?.length) setAnswers((current) => ({ ...current, ...Object.fromEntries(answerRows.map((row) => [row.question_key, row.value as string | string[]])) }));
      if (alive && submissionRows) setCompleted(submissionRows.filter((row) => row.status === "completed").map((row) => row.task_key));
      if (alive) setStatus("已連線；修改會同步到你的帳號");
    }
    void load();
    return () => { alive = false; };
  }, [stage.key, supabase]);

  const currentFields = task?.fields.filter((field) => !field.hiddenInGroup && fieldIsActive(field, answers)) ?? [];
  const answered = currentFields.filter((field) => fieldIsComplete(field, answers[field.key])).length;
  const totalAnswered = tasks.reduce((sum, item) => sum + item.fields.filter((field) => !field.hiddenInGroup && fieldIsActive(field, answers) && fieldIsComplete(field, answers[field.key])).length, 0);
  const totalFields = tasks.reduce((sum, item) => sum + item.fields.filter((field) => !field.hiddenInGroup && fieldIsActive(field, answers)).length, 0);
  const percent = totalFields ? Math.round((totalAnswered / totalFields) * 100) : 0;

  function updateAnswer(key: string, value: string | string[]) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    window.localStorage.setItem(storageKey(stage.key), JSON.stringify(next));
    if (userId) void supabase.from("answers").upsert({ user_id: userId, stage_key: stage.key, question_key: key, content_version_id: null, value }, { onConflict: "user_id,stage_key,question_key" });
    setStatus("草稿已更新");
  }

  function updateOtherAnswer(key: string, value: string) { updateAnswer(key, value); }

  async function saveDraft() {
    window.localStorage.setItem(storageKey(stage.key), JSON.stringify(answers));
    if (!userId || !task) { setStatus("已保存到此瀏覽器；登入後即可跨裝置同步"); return; }
    const { error } = await supabase.from("submissions").upsert({ user_id: userId, course_key: courseKey, stage_key: stage.key, task_key: task.key, status: "draft", answer_json: answers, submitted_at: null }, { onConflict: "user_id,stage_key,task_key" });
    setStatus(error ? `保存失敗：${error.message}` : "進度已保存，可稍後回來繼續");
  }

  async function submitTask() {
    if (!task) return;
    setShowErrors(true);
    if (answered < currentFields.length) { setStatus(`還有 ${currentFields.length - answered} 個欄位未完成，已保留草稿`); await saveDraft(); return; }
    if (!userId) { setCompleted((current) => current.includes(task.key) ? current : [...current, task.key]); setStatus("本次瀏覽已提交完成；登入後可跨裝置同步"); return; }
    const { error } = await supabase.from("submissions").upsert({ user_id: userId, course_key: courseKey, stage_key: stage.key, task_key: task.key, status: "completed", answer_json: answers, submitted_at: new Date().toISOString() }, { onConflict: "user_id,stage_key,task_key" });
    if (error) { setStatus(`提交失敗：${error.message}`); return; }
    setCompleted((current) => current.includes(task.key) ? current : [...current, task.key]);
    setStatus("作業已提交完成；之後仍可回來修改");
  }

  if (!task) return <div className="min-h-screen bg-[#f5f7f4] p-8">此階段尚未建立任務。</div>;
  return <div className="min-h-screen bg-[#f5f7f4] text-slate-900"><header className="border-b border-slate-200/80 bg-white/95"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8"><Link href="/app" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-sm font-bold text-white">創</span><span className="font-semibold">創客學院</span></Link><div className="flex items-center gap-3 text-right text-xs text-slate-500 sm:text-sm"><span>{status}</span><Link href="/app" className="font-semibold text-teal-700 hover:text-teal-900">返回課程</Link></div></div></header><main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[270px_1fr] lg:px-8"><aside className="lg:sticky lg:top-6 lg:self-start"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">任務式學習</p><h1 className="mt-3 text-2xl font-bold leading-tight">{stage.title}</h1><p className="mt-3 text-sm leading-7 text-slate-500">{stage.summary}</p><div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"><div className="flex justify-between text-sm"><span>整體填寫進度</span><strong className="text-teal-700">{percent}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-slate-500">{totalAnswered} / {totalFields} 個欄位已填</p></div><nav className="mt-6 space-y-2" aria-label="階段任務">{tasks.map((item, index) => <button key={item.key} onClick={() => { setActive(index); setTab("assignment"); setShowErrors(false); }} className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${index === active ? "bg-teal-700 font-semibold text-white shadow-sm" : "bg-white text-slate-600 hover:bg-teal-50"}`}><span className="block text-xs opacity-70">{completed.includes(item.key) ? "已提交" : `任務 ${index + 1}`}</span><span className="mt-1 block leading-5">{item.title}</span><span className="mt-2 block text-xs opacity-75">{item.fields.length} 個作答欄位</span></button>)}</nav></aside><section><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:p-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">任務 {active + 1} / {tasks.length}</p><h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{task.title}</h2><p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">先讀懂這一任務的講義，再完成作業。你可以隨時保存進度，未完成的內容不會遺失。</p></div><div className="rounded-xl bg-teal-50 px-3 py-2 text-right text-xs text-teal-800"><strong className="block text-lg">{answered}/{currentFields.length}</strong>本任務已填<span className="mt-1 block text-[11px] opacity-75">共 {currentFields.length} 題</span></div></div><div className="mt-8 flex flex-wrap gap-2 border-b border-slate-100 pb-3"><button onClick={() => setTab("lecture")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "lecture" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>1. 閱讀講義</button><button onClick={() => setTab("assignment")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "assignment" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>2. 填寫答案</button><button onClick={() => setTab("blueprint")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "blueprint" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>階段藍圖</button></div>{tab === "blueprint" ? <div className="mt-8"><StageBlueprint stageTitle={stage.title} tasks={tasks} answers={answers} optionLabels={Object.fromEntries(tasks.flatMap((item) => item.fields.flatMap((field) => (field.options ?? []).map((option) => [option.key, option.label]))))} learnerName="我的作答" /></div> : tab === "lecture" ? <div className="md-content mt-8 max-w-3xl"><ReactMarkdown remarkPlugins={[remarkGfm]}>{task.lecture}</ReactMarkdown></div> : <div className="mt-8 space-y-8"><div className="rounded-2xl border border-teal-100 bg-teal-50 p-5 text-sm leading-7 text-teal-950"><strong>作答提醒：</strong>下方是依照正式作業中的勾選題與填空處建立的互動欄位。完成一部分就按「保存進度」；全部完成並確認後，再按「提交這份作業」。</div><AssignmentTable fields={currentFields} answers={answers} onChange={updateAnswer} onOtherChange={updateOtherAnswer} showErrors={showErrors} /><details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700">查看正式作業原文與範例</summary><div className="md-content max-w-none border-t border-slate-100 px-5 py-6"><ReactMarkdown remarkPlugins={[remarkGfm]}>{task.assignment}</ReactMarkdown></div></details><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="text-sm leading-6 text-teal-900">{userId ? "已登入：答案會同步到你的帳號。" : "未登入：先保存在本機；登入後可跨裝置同步。"}</p><div className="flex flex-wrap gap-2"><button onClick={saveDraft} className="rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">保存進度</button><button onClick={submitTask} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">{completed.includes(task.key) ? "已提交（可再次提交）" : "檢查並提交"}</button></div></div></div>}</div></section></main></div>;
}
