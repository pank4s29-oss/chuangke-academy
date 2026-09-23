"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Stage } from "@/lib/content/schema";
import type { AssignmentField, TaskWithFields } from "@/lib/content/taskSections";
import { isFieldActive } from "@/lib/content/fieldState";
import { fieldsToCanonical } from "@/lib/content/questions";
import QuestionRenderer from "./QuestionRenderer";
import AssignmentTable from "./AssignmentTable";
import StageBlueprint from "./StageBlueprint";
import { createClient } from "@/lib/supabase/client";
import { buildRecallAnswers, type SavedAnswersByStage } from "@/lib/content/recall";
import RecallMarkdown from "./RecallMarkdown";
import { applyQuestionOverrides, type QuestionOverride } from "@/lib/content/overrides";

type Props = { stage: Stage; courseKey: string; tasks: TaskWithFields[]; referenceTasks?: TaskWithFields[]; workspaceId?: string; nextStageKey?: string };
type Tab = "lecture" | "assignment" | "blueprint";
type Answers = Record<string, string | string[]>;

const storageKey = (stageKey: string, workspaceId?: string) => `chuangke-draft-${workspaceId ?? "legacy"}-${stageKey}`;

function fieldIsComplete(field: AssignmentField, value: Answers[string]) {
  if (field.type === "checkboxes") return Array.isArray(value) ? value.length > 0 : Boolean(value);
  return String(value ?? "").trim().length > 0;
}

const fieldIsActive = isFieldActive;

function Field({ field, value, answers, onChange, onOtherChange, showError }: { field: AssignmentField; value: Answers[string]; answers: Answers; onChange: (value: string | string[]) => void; onOtherChange: (key: string, value: string) => void; showError?: boolean }) {
  const question = fieldsToCanonical([field])[0];
  return <QuestionRenderer question={question} value={value ?? ""} otherValues={answers} onOtherChange={onOtherChange} onChange={onChange} showError={showError} />;
}

export default function TaskFlow({ stage, courseKey, tasks, referenceTasks, workspaceId, nextStageKey }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("assignment");
  const [userId, setUserId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [savedAnswersByStage, setSavedAnswersByStage] = useState<SavedAnswersByStage>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [status, setStatus] = useState("尚未保存；可先開始填寫");
  const [recallStatus, setRecallStatus] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [liveTasks, setLiveTasks] = useState(tasks);
  const [liveReferenceTasks, setLiveReferenceTasks] = useState(referenceTasks ?? tasks);
  const task = liveTasks[active];

  useEffect(() => {
    setLiveTasks(tasks);
    setLiveReferenceTasks(referenceTasks ?? tasks);
  }, [tasks, referenceTasks]);

  useEffect(() => {
    let alive = true;
    const applyLatest = async () => {
      const { data } = await supabase.from("question_overrides").select("stage_key,task_key,field_key,prompt,description,options,field_type,multiple,sort_order").in("stage_key", ["stage-01", "stage-02"]);
      if (!alive || !data) return;
      const overrides = data as QuestionOverride[];
      // Always start from the server-rendered baseline. Applying to the
      // already-overridden array would leave deleted overrides and stale order.
      setLiveTasks(applyQuestionOverrides(tasks, overrides));
      setLiveReferenceTasks(applyQuestionOverrides(referenceTasks ?? tasks, overrides));
    };
    void applyLatest();
    const polling = window.setInterval(() => { void applyLatest(); }, 2000);
    const channel = supabase.channel(`question-overrides-${stage.key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "question_overrides" }, () => { void applyLatest(); })
      .subscribe();
    return () => { alive = false; window.clearInterval(polling); void supabase.removeChannel(channel); };
  }, [stage.key, supabase, tasks, referenceTasks]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(stage.key, workspaceId));
    if (saved) { try { setAnswers(JSON.parse(saved) as Answers); setStatus("已載入本機草稿"); } catch { window.localStorage.removeItem(storageKey(stage.key, workspaceId)); } }
    let alive = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!alive) return;
      const id = auth.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const [{ data: workspace }, { data: answerRows }, { data: submissionRows }] = await Promise.all([
        workspaceId ? supabase.from("assignment_workspaces").select("id,name,course_key").eq("id", workspaceId).maybeSingle() : Promise.resolve({ data: null }),
        workspaceId ? Promise.resolve({ data: [] }) : supabase.from("answers").select("stage_key,question_key,value"),
        supabase.from("submissions").select("stage_key,task_key,status,answer_json").eq(workspaceId ? "workspace_id" : "user_id", workspaceId ?? id),
      ]);
      if (workspaceId && (!workspace || workspace.course_key !== courseKey)) { setStatus("找不到這份作業，請回到作業清單重新選擇"); return; }
      if (workspaceId) setWorkspaceName(workspace?.name ?? "");
      const savedByStage: SavedAnswersByStage = {};
      (answerRows ?? []).forEach((row) => {
        const stageAnswers = savedByStage[row.stage_key] ?? {};
        stageAnswers[row.question_key] = row.value as string | string[];
        savedByStage[row.stage_key] = stageAnswers;
      });
      (submissionRows ?? []).forEach((row) => {
        if (!row.answer_json || typeof row.answer_json !== "object") return;
        savedByStage[row.stage_key] = { ...(savedByStage[row.stage_key] ?? {}), ...(row.answer_json as Answers) };
      });
      if (alive) setSavedAnswersByStage(savedByStage);
      if (alive) setAnswers((current) => {
        const merged = { ...(savedByStage[stage.key] ?? {}), ...current };
        const recalled = buildRecallAnswers(stage.key, tasks, savedByStage, merged);
        if (recalled.count > 0) setRecallStatus(`已自動帶入 ${recalled.count} 個前置回顧答案；你仍可修改。`);
        return recalled.answers;
      });
      if (alive && submissionRows) setCompleted(submissionRows.filter((row) => row.status === "completed").map((row) => row.task_key));
      if (alive) setStatus("已連線；修改會同步到你的帳號");
    }
    void load();
    return () => { alive = false; };
  }, [stage.key, supabase, tasks, courseKey, workspaceId]);

  const currentFields = task?.fields.filter((field) => !field.hiddenInGroup && fieldIsActive(field, answers)) ?? [];
  const requiredFields = currentFields.filter((field) => field.required !== false);
  const answered = requiredFields.filter((field) => fieldIsComplete(field, answers[field.key])).length;
  const totalAnswered = liveTasks.reduce((sum, item) => sum + item.fields.filter((field) => !field.hiddenInGroup && field.required !== false && fieldIsActive(field, answers) && fieldIsComplete(field, answers[field.key])).length, 0);
  const totalFields = liveTasks.reduce((sum, item) => sum + item.fields.filter((field) => !field.hiddenInGroup && field.required !== false && fieldIsActive(field, answers)).length, 0);
  const percent = totalFields ? Math.round((totalAnswered / totalFields) * 100) : 0;

  function updateAnswer(key: string, value: string | string[]) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    window.localStorage.setItem(storageKey(stage.key, workspaceId), JSON.stringify(next));
    if (userId && !workspaceId) void supabase.from("answers").upsert({ user_id: userId, stage_key: stage.key, question_key: key, content_version_id: null, value }, { onConflict: "user_id,stage_key,question_key" });
    setStatus("草稿已更新");
  }

  function updateOtherAnswer(key: string, value: string) { updateAnswer(key, value); }

  async function saveDraft() {
    window.localStorage.setItem(storageKey(stage.key, workspaceId), JSON.stringify(answers));
    if (!userId || !task) { setStatus("已保存到此瀏覽器；登入後即可跨裝置同步"); return; }
    const payload = { user_id: userId, course_key: courseKey, stage_key: stage.key, task_key: task.key, status: "draft" as const, answer_json: answers, submitted_at: null, ...(workspaceId ? { workspace_id: workspaceId } : {}) };
    const { error } = await supabase.from("submissions").upsert(payload, { onConflict: workspaceId ? "workspace_id,stage_key,task_key" : "user_id,stage_key,task_key" });
    setStatus(error ? `保存失敗：${error.message}` : "進度已保存，可稍後回來繼續");
  }

  async function submitTask() {
    if (!task) return;
    setShowErrors(true);
    const missing = requiredFields.length - answered;
    if (!userId) {
      setCompleted((current) => current.includes(task.key) ? current : [...current, task.key]);
      setStatus(missing > 0 ? `已提交；還有 ${missing} 個欄位尚未完成` : "已提交");
      goNext();
      return;
    }
    const payload = { user_id: userId, course_key: courseKey, stage_key: stage.key, task_key: task.key, status: "completed" as const, answer_json: answers, submitted_at: new Date().toISOString(), ...(workspaceId ? { workspace_id: workspaceId } : {}) };
    const { error } = await supabase.from("submissions").upsert(payload, { onConflict: workspaceId ? "workspace_id,stage_key,task_key" : "user_id,stage_key,task_key" });
    if (error) { setStatus(`提交失敗：${error.message}`); return; }
    setCompleted((current) => current.includes(task.key) ? current : [...current, task.key]);
    setStatus(missing > 0 ? `已提交；還有 ${missing} 個欄位尚未完成` : "已提交");
    goNext();
  }

  function goNext() {
    const nextTask = liveTasks[active + 1];
    if (nextTask) {
      setStatus("已完成，前往下一個任務…");
      setActive((current) => current + 1);
      setTab("lecture");
      setShowErrors(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStatus(nextStageKey ? "本階段已完成，前往下一階段…" : "本階段已完成；可回到作業清單");
    if (nextStageKey && workspaceId) router.push(`/app/workspaces/${workspaceId}/courses/${courseKey}/stages/${nextStageKey}/learn`);
    else router.push("/app");
  }

  const recallTasks = liveReferenceTasks;
  if (!task) return <div className="min-h-screen bg-[#f5f7f4] p-8">此階段尚未建立任務。</div>;
  return <div className="min-h-screen max-w-full overflow-x-hidden bg-[#f5f7f4] text-slate-900"><header className="border-b border-slate-200/80 bg-white/95"><div className="mx-auto flex min-w-0 max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-5 lg:px-8"><Link href="/app" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-sm font-bold text-white">創</span><span className="font-semibold">創客學院</span></Link><div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-right text-xs text-slate-500 sm:text-sm"><span>{status}</span><Link href="/app" className="font-semibold text-teal-700 hover:text-teal-900">返回作業清單</Link></div></div></header><main className="mx-auto grid min-w-0 max-w-7xl gap-5 px-4 py-6 sm:px-5 sm:py-8 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] lg:gap-8 lg:px-8"><aside className="min-w-0 lg:sticky lg:top-6 lg:self-start"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">任務式學習</p><h1 className="mt-3 text-2xl font-bold leading-tight">{workspaceName || "作業工作區"}</h1><p className="mt-2 text-sm font-semibold text-teal-700">{stage.title}</p><p className="mt-3 text-sm leading-7 text-slate-500">{stage.summary}</p><div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"><div className="flex justify-between text-sm"><span>整體填寫進度</span><strong className="text-teal-700">{percent}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-slate-500">{totalAnswered} / {totalFields} 個欄位已填</p></div><nav className="mt-6 space-y-2" aria-label="階段任務">{liveTasks.map((item, index) => <button key={item.key} onClick={() => { setActive(index); setTab("assignment"); setShowErrors(false); }} className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${index === active ? "bg-teal-700 font-semibold text-white shadow-sm" : "bg-white text-slate-600 hover:bg-teal-50"}`}><span className="block text-xs opacity-70">{completed.includes(item.key) ? "已提交" : `任務 ${index + 1}`}</span><span className="mt-1 block leading-5">{item.title}</span><span className="mt-2 block text-xs opacity-75">{item.fields.length} 個作答欄位</span></button>)}</nav></aside><section className="min-w-0"><div className="min-w-0 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-6 lg:p-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">任務 {active + 1} / {liveTasks.length}</p><h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{task.title}</h2><p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">先讀懂這一任務的講義，再完成作業。你可以隨時保存進度，未完成的內容不會遺失。</p></div><div className="rounded-xl bg-teal-50 px-3 py-2 text-right text-xs text-teal-800"><strong className="block text-lg">{answered}/{requiredFields.length}</strong>本任務已填<span className="mt-1 block text-[11px] opacity-75">未完成也可以先提交（另有選填）</span></div></div><div className="mt-6 flex flex-wrap gap-2 border-b border-slate-100 pb-3"><button onClick={() => setTab("lecture")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "lecture" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>1. 閱讀講義</button><button onClick={() => setTab("assignment")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "assignment" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>2. 填寫答案</button><button onClick={() => setTab("blueprint")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "blueprint" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>階段藍圖</button></div>{tab === "blueprint" ? <div className="mt-8"><StageBlueprint stageTitle={stage.title} tasks={liveTasks} answers={answers} optionLabels={Object.fromEntries(liveTasks.flatMap((item) => item.fields.flatMap((field) => (field.options ?? []).map((option) => [option.key, option.label]))))} learnerName="我的作答" /></div> : tab === "lecture" ? <div className="md-content mt-6 max-w-3xl min-w-0 sm:mt-8"><RecallMarkdown markdown={task.lecture} tasks={recallTasks} answersByStage={{ ...savedAnswersByStage, [stage.key]: answers }} currentTaskKey={task.key} /></div> : <div className="mt-6 min-w-0 space-y-6 sm:mt-8 sm:space-y-8"><div className="rounded-2xl border border-teal-100 bg-teal-50 p-5 text-sm leading-7 text-teal-950"><strong>作答提醒：</strong>下方是依照正式作業中的勾選題與填空處建立的互動欄位。完成一部分就按「保存進度」；全部完成並確認後，再按「提交這份作業」。{recallStatus && <span className="mt-2 block font-semibold text-teal-800">{recallStatus}</span>}</div><AssignmentTable fields={currentFields} answers={answers} onChange={updateAnswer} onOtherChange={updateOtherAnswer} showErrors={showErrors} recallTasks={recallTasks} answersByStage={{ ...savedAnswersByStage, [stage.key]: answers }} currentTaskKey={task.key} /><details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700">查看正式作業原文與範例</summary><div className="md-content max-w-none border-t border-slate-100 px-5 py-6"><RecallMarkdown markdown={task.assignment} tasks={recallTasks} answersByStage={{ ...savedAnswersByStage, [stage.key]: answers }} /></div></details><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="text-sm leading-6 text-teal-900">{userId ? "已登入：答案會同步到你的帳號。" : "未登入：先保存在本機；登入後可跨裝置同步。"}</p><div className="flex flex-wrap gap-2"><button onClick={saveDraft} className="rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">保存進度</button><button onClick={submitTask} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">{completed.includes(task.key) ? "已提交（可再次提交）" : "檢查並提交"}</button></div></div></div>}</div></section></main></div>;
}
