"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StageBlueprint from "./StageBlueprint";
import AssignmentTable from "./AssignmentTable";
import type { AssignmentField, TaskWithFields } from "@/lib/content/taskSections";
import AssignmentFileImport from "./AssignmentFileImport";

type ReviewStatus = "pending" | "approved" | "needs_revision";
type Submission = {
  id: string;
  user_id: string | null;
  learner_name: string | null;
  stage_key: string;
  task_key: string;
  status: "draft" | "completed";
  review_status: ReviewStatus;
  answer_json: Record<string, unknown>;
  teacher_feedback: string | null;
  consultant_advice: string | null;
  submitted_at: string | null;
  updated_at: string;
  imported_file_id: string | null;
  workspace_id: string | null;
};
type Profile = { id: string; display_name: string | null; role: string };
type Props = { optionLabels: Record<string, string>; stageTitles: Record<string, string>; stageTasks: Record<string, TaskWithFields[]> };
const reviewLabels: Record<ReviewStatus, string> = { pending: "待批改", approved: "已通過", needs_revision: "需要修改" };
const reviewOrder: ReviewStatus[] = ["needs_revision", "pending", "approved"];

/**
 * One card in the dashboard = one learner's whole imported (or self-answered)
 * stage, not one task. Assignment files are imported a whole stage at a
 * time (see AssignmentFileImport), so the teacher thinks in terms of
 * "王小明's 階段一", not five separate task rows for the same file — grouping
 * here is what keeps the sidebar from exploding into "too many options" once
 * a multi-task stage is imported.
 */
type SubmissionGroup = {
  key: string;
  learnerKey: string;
  learnerLabel: string;
  userId: string | null;
  learnerName: string | null;
  stageKey: string;
  items: Submission[];
  reviewStatus: ReviewStatus;
  updatedAt: string;
  submittedAt: string | null;
  isImported: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
};

function learnerKeyOf(item: Submission) {
  return item.workspace_id ? `w:${item.workspace_id}` : item.user_id ? `u:${item.user_id}` : `n:${(item.learner_name ?? "").trim().toLowerCase() || item.id}`;
}

function aggregateReviewStatus(items: Submission[]): ReviewStatus {
  for (const status of reviewOrder) if (items.some((item) => item.review_status === status)) return status;
  return "pending";
}

function fieldIsActive(field: AssignmentField, answers: Record<string, unknown>) {
  if (!field.dependsOn) return true;
  const value = answers[field.dependsOn.fieldKey];
  return Array.isArray(value) ? value.includes(field.dependsOn.optionKey) : value === field.dependsOn.optionKey;
}

function fieldIsFilled(field: AssignmentField, value: unknown) {
  return Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0;
}

export default function TeacherDashboard({ optionLabels, stageTitles, stageTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [advice, setAdvice] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [answerDraft, setAnswerDraft] = useState<Record<string, unknown>>({});
  const [filter, setFilter] = useState<"all" | ReviewStatus>("all");
  const [learnerFilter, setLearnerFilter] = useState<string>("all"); // req 3: filter the whole dashboard down to one learner
  const [status, setStatus] = useState("載入中…");
  const [view, setView] = useState<"answers" | "blueprint">("answers");
  const [importStage, setImportStage] = useState(Object.keys(stageTasks)[0] ?? "stage-01");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setAllowed(false); setStatus("請先登入教師帳號"); return; }
    const { data: profile } = await supabase.from("profiles").select("id,display_name,role").eq("id", auth.user.id).single();
    if (!profile) { setAllowed(false); setStatus("找不到此登入帳號的 profiles 記錄，請執行 profile bootstrap migration"); return; }
    if (profile.role !== "teacher") { setAllowed(false); setStatus(`目前角色為 ${profile.role ?? "未設定"}，請將 public.profiles.role 更新為 teacher`); return; }
    setAllowed(true);
    const initialSubmissionResult = await supabase.from("submissions").select("id,user_id,learner_name,workspace_id,stage_key,task_key,status,review_status,answer_json,teacher_feedback,consultant_advice,submitted_at,updated_at,imported_file_id").order("updated_at", { ascending: false });
    const [{ data: profileRows }, { data: workspaceRows, error: workspaceError }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,role"),
      supabase.from("assignment_workspaces").select("id,name"),
    ]);
    let legacySchema = false;
    let submissionRows = initialSubmissionResult.data as unknown[] | null;
    let submissionError = initialSubmissionResult.error;
    if (submissionError?.code === "42703" || /workspace_id.*does not exist/i.test(submissionError?.message ?? "")) {
      legacySchema = true;
      const legacyResult = await supabase.from("submissions").select("id,user_id,learner_name,stage_key,task_key,status,review_status,answer_json,teacher_feedback,consultant_advice,submitted_at,updated_at,imported_file_id").order("updated_at", { ascending: false });
      submissionRows = legacyResult.data as unknown[] | null;
      submissionError = legacyResult.error;
    }
    if (submissionError) { setStatus(`載入失敗：${submissionError.message}`); return; }
    if (workspaceError) setStatus("教師後台已載入，但 Supabase 尚未套用作業工作區 migration；請執行 202609210001_assignment_workspaces.sql");
    else if (legacySchema) setStatus("教師後台已載入舊資料；請執行作業工作區 migration 以啟用多份作業");
    setSubmissions((submissionRows ?? []) as Submission[]);
    setProfiles(Object.fromEntries(((profileRows ?? []) as Profile[]).map((item) => [item.id, item])));
    setWorkspaceNames(Object.fromEntries(((workspaceRows ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name])));
    if (!workspaceError && !legacySchema) setStatus(`共 ${submissionRows?.length ?? 0} 份提交`);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  function learnerLabelFor(item: Submission) {
    if (item.workspace_id && workspaceNames[item.workspace_id]) return workspaceNames[item.workspace_id];
    if (item.learner_name?.trim()) return item.learner_name.trim();
    if (item.user_id) return profiles[item.user_id]?.display_name || `學員 ${item.user_id.slice(0, 6)}`;
    return "未命名學員";
  }

  // req 2: group the flat per-task submission rows into one card per
  // learner+stage. A stage import always creates one row per task, but the
  // teacher never imports "a task" — they import a whole stage — so this is
  // the unit the UI should show.
  const groups = useMemo<SubmissionGroup[]>(() => {
    const map = new Map<string, Submission[]>();
    submissions.forEach((item) => {
      const key = `${learnerKeyOf(item)}__${item.stage_key}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return [...map.entries()].map(([key, items]) => {
      const [learnerKey] = key.split("__");
      const latest = [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      return {
        key,
        learnerKey,
        learnerLabel: learnerLabelFor(latest),
        userId: latest.user_id,
        learnerName: latest.learner_name,
        workspaceId: latest.workspace_id,
        workspaceName: latest.workspace_id ? workspaceNames[latest.workspace_id] ?? null : null,
        stageKey: latest.stage_key,
        items,
        reviewStatus: aggregateReviewStatus(items),
        updatedAt: latest.updated_at,
        submittedAt: items.map((item) => item.submitted_at).filter(Boolean).sort().pop() ?? null,
        isImported: items.some((item) => item.imported_file_id),
      };
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, profiles, workspaceNames]);

  const learnerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    groups.forEach((group) => { if (!seen.has(group.learnerKey)) seen.set(group.learnerKey, group.learnerLabel); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-TW"));
  }, [groups]);

  const visibleGroups = groups.filter((group) => (filter === "all" || group.reviewStatus === filter) && (learnerFilter === "all" || group.learnerKey === learnerFilter));
  const selected = groups.find((group) => group.key === selectedKey) ?? null;
  const importTasks = stageTasks[importStage] ?? [];
  const stageTasksForSelected = selected ? (stageTasks[selected.stageKey] ?? []) : [];

  function openGroup(group: SubmissionGroup) {
    setSelectedKey(group.key);
    setLearnerName(group.learnerLabel);
    setAnswerDraft(Object.assign({}, ...group.items.map((item) => item.answer_json)));
    const latest = [...group.items].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    setFeedback(latest.teacher_feedback ?? "");
    setAdvice(latest.consultant_advice ?? "");
    setView("answers");
  }

  async function saveName() {
    if (!selected) return;
    const name = learnerName.trim() || "未命名學員";
    const { error } = await supabase.from("submissions").update({ learner_name: name }).in("id", selected.items.map((item) => item.id));
    if (error) { setStatus(`名稱更新失敗：${error.message}`); return; }
    setSubmissions((current) => current.map((item) => selected.items.some((selItem) => selItem.id === item.id) ? { ...item, learner_name: name } : item));
    setStatus("作業名稱已更新");
  }

  // req 1: split the whole-stage draft back into each task's own slice
  // before writing it — the DB still keeps one row per task — but nothing
  // here requires a field to already have a value, so a field the teacher
  // just typed into for the first time (one that was blank after import) is
  // saved exactly the same way as one that arrived filled in.
  async function saveAnswers() {
    if (!selected) return;
    const tasks = stageTasksForSelected;
    const results = await Promise.all(tasks.map(async (task) => {
      const taskAnswers = Object.fromEntries(Object.entries(answerDraft).filter(([key]) => task.fields.some((field) => field.key === key || field.otherFor === key)));
      const existing = selected.items.find((item) => item.task_key === task.key);
      if (existing) {
        const { error } = await supabase.from("submissions").update({ answer_json: taskAnswers }).eq("id", existing.id);
        return { error, task, existing, taskAnswers, insertedId: undefined as string | undefined };
      }
      // The learner (or teacher, mid-edit) never had a row for this task yet
      // (e.g. a self-paced student who hasn't opened it) — create one rather
      // than silently dropping what the teacher just filled in for it.
      const hasContent = Object.values(taskAnswers).some((value) => Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0);
      if (!hasContent) return { error: null, task, existing: null, taskAnswers, insertedId: undefined as string | undefined };
      const { data, error } = await supabase.from("submissions").insert({ user_id: selected.userId, learner_name: selected.learnerName, course_key: "maker-academy", stage_key: selected.stageKey, task_key: task.key, status: "completed", answer_json: taskAnswers, submitted_at: new Date().toISOString(), review_status: "pending" }).select("id").single();
      return { error, task, existing: null, taskAnswers, insertedId: data?.id };
    }));
    const failed = results.find((result) => result.error);
    if (failed) { setStatus(`答案更新失敗（${failed.task.title}）：${failed.error?.message}`); return; }
    setSubmissions((current) => {
      let next = current.map((item) => {
        const match = results.find((result) => result.existing?.id === item.id);
        return match ? { ...item, answer_json: match.taskAnswers } : item;
      });
      const inserted = results.filter((result) => result.insertedId);
      if (inserted.length) {
        next = next.concat(inserted.map((result) => ({
          id: result.insertedId as string, user_id: selected.userId, learner_name: selected.learnerName, workspace_id: selected.workspaceId, stage_key: selected.stageKey, task_key: result.task.key,
          status: "completed" as const, review_status: "pending" as const, answer_json: result.taskAnswers, teacher_feedback: null, consultant_advice: null,
          submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), imported_file_id: null,
        })));
      }
      return next;
    });
    setStatus("作答內容已更新");
  }

  // Grading is applied to the whole stage at once — the teacher reviews a
  // learner's imported stage as one piece of work, not task by task.
  async function grade(reviewStatus: ReviewStatus) {
    if (!selected) return;
    const patch = { review_status: reviewStatus, teacher_feedback: feedback.trim() || null, consultant_advice: advice.trim() || null, graded_at: new Date().toISOString() };
    const { error } = await supabase.from("submissions").update(patch).in("id", selected.items.map((item) => item.id));
    if (error) { setStatus(`批改失敗：${error.message}`); return; }
    setSubmissions((current) => current.map((item) => selected.items.some((selItem) => selItem.id === item.id) ? { ...item, ...patch } : item));
    setStatus("批改結果已保存（套用到整個階段）");
  }

  async function removeGroup(group: SubmissionGroup) {
    if (!window.confirm(`確定刪除「${group.learnerLabel}」的「${stageTitles[group.stageKey] ?? group.stageKey}」整份作業嗎？此操作無法復原。`)) return;
    const { error } = await supabase.from("submissions").delete().in("id", group.items.map((item) => item.id));
    if (error) { setStatus(`刪除失敗：${error.message}`); return; }
    const importIds = [...new Set(group.items.map((item) => item.imported_file_id).filter((value): value is string => Boolean(value)))];
    if (importIds.length) await supabase.from("assignment_imports").delete().in("id", importIds);
    setSubmissions((current) => current.filter((item) => !group.items.some((groupItem) => groupItem.id === item.id)));
    if (selectedKey === group.key) setSelectedKey(null);
    setStatus("作業已刪除");
  }

  if (allowed === false) return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] px-5"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200"><p className="text-sm font-semibold text-rose-600">無法進入教師後台</p><h1 className="mt-3 text-2xl font-bold">{status}</h1><p className="mt-3 text-sm leading-7 text-slate-500">請使用已設定為教師角色的帳號登入。</p><Link href="/app" className="mt-6 inline-block rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">返回課程</Link></div></main>;
  if (allowed === null) return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] text-sm text-slate-500">載入教師後台…</main>;

  return (
    <main className="min-h-screen bg-[#f5f7f4] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Teacher workspace</p>
            <h1 className="mt-1 text-2xl font-bold">作業批改後台</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{status}</span>
            <Link href="/teacher/guide" className="font-semibold text-slate-600">教師帳號設定</Link>
            <Link href="/app" className="font-semibold text-teal-700">回到學員端</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[330px_1fr] lg:px-8">
        <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "needs_revision", "approved"] as const).map((key) => (
              <button key={key} onClick={() => setFilter(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === key ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"}`}>{key === "all" ? "全部" : reviewLabels[key]}</button>
            ))}
          </div>

          {/* req 3: pick a specific learner to see only their work, across
              every stage — instead of hunting through the whole submitted
              list. */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-500" htmlFor="learner-filter">篩選學員</label>
            <select id="learner-filter" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={learnerFilter} onChange={(event) => setLearnerFilter(event.target.value)}>
              <option value="all">全部學員（{learnerOptions.length} 人）</option>
              {learnerOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>

          <div className="mt-5">
            <label className="block text-xs font-semibold text-slate-500" htmlFor="import-stage">匯入作業所屬階段</label>
            <select id="import-stage" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={importStage} onChange={(event) => setImportStage(event.target.value)}>
              {Object.entries(stageTitles).map(([key, title]) => <option key={key} value={key}>{title}</option>)}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">此階段包含 {importTasks.length} 個任務，將一次匯入整份作業，並在下方以「一個學員、一個階段」的方式呈現，不會拆成多筆任務選項。</p>
            <div className="mt-3">
              <AssignmentFileImport stageKey={importStage} tasks={importTasks} onImported={(fileName, name, answerCount, taskCount) => { setStatus(`已建立 ${name} 的 ${fileName}，包含 ${taskCount} 個任務、${answerCount} 個已辨識答案欄位（未填寫的欄位仍會顯示，供你補上）`); void load(); }} />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {visibleGroups.map((group) => (
              <button key={group.key} onClick={() => openGroup(group)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedKey === group.key ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-teal-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <strong className="truncate text-sm">{group.learnerLabel}</strong>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{reviewLabels[group.reviewStatus]}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{stageTitles[group.stageKey] ?? group.stageKey} · 共 {group.items.length} 個任務{group.isImported ? "（匯入檔案）" : ""}</p>
                <p className="mt-1 text-xs text-slate-400">{group.submittedAt ? new Date(group.submittedAt).toLocaleString("zh-TW") : "草稿更新"}</p>
              </button>
            ))}
            {visibleGroups.length === 0 && <p className="py-8 text-center text-sm text-slate-500">目前沒有符合條件的提交。</p>}
          </div>
        </aside>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:p-8">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-sm font-semibold text-teal-700">{stageTitles[selected.stageKey] ?? selected.stageKey}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input aria-label="學員名稱" className="rounded-xl border border-slate-200 px-3 py-2 text-xl font-bold outline-none focus:border-teal-500" value={learnerName} onChange={(event) => setLearnerName(event.target.value)} placeholder="輸入學員名稱" />
                    <button onClick={() => void saveName()} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">保存名稱</button>
                    <button onClick={() => void removeGroup(selected)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">刪除整份作業</button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">共 {selected.items.length} 個任務 · {selected.isImported ? "由教師匯入" : "學員自行作答"}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">{reviewLabels[selected.reviewStatus]}</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
                <button onClick={() => setView("answers")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === "answers" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>本次作答（可編輯）</button>
                <button onClick={() => setView("blueprint")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === "blueprint" ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>完整階段藍圖（可匯出）</button>
              </div>

              {view === "blueprint" ? (
                <div className="mt-6">
                  <StageBlueprint
                    stageTitle={stageTitles[selected.stageKey] ?? selected.stageKey}
                    tasks={stageTasksForSelected}
                    answers={answerDraft as Record<string, string | string[]>}
                    optionLabels={optionLabels}
                    learnerName={learnerName || selected.learnerLabel}
                    reviewStatus={selected.reviewStatus}
                    teacherFeedback={feedback}
                    consultantAdvice={advice}
                  />
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
                    這裡會列出這個階段<strong>每一題</strong>，包含匯入檔案裡沒有填寫的空白題目——直接在空格中幫學員補上或修改即可，不會只顯示已填寫的內容。
                  </div>
                  {stageTasksForSelected.map((task) => {
                    const visibleFields = task.fields.filter((field) => !field.hiddenInGroup && fieldIsActive(field, answerDraft));
                    const filledCount = visibleFields.filter((field) => fieldIsFilled(field, answerDraft[field.key])).length;
                    return (
                      <article key={task.key} className="rounded-2xl border border-slate-200 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-800">{task.title}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filledCount === visibleFields.length ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-800"}`}>{filledCount}/{visibleFields.length} 已填</span>
                        </div>
                        <div className="mt-4">
                          <AssignmentTable
                            fields={visibleFields}
                            answers={answerDraft as Record<string, string | string[]>}
                            onChange={(key, value) => setAnswerDraft((current) => ({ ...current, [key]: value }))}
                            onOtherChange={(key, value) => setAnswerDraft((current) => ({ ...current, [key]: value }))}
                            showErrors={false}
                          />
                        </div>
                      </article>
                    );
                  })}
                  {stageTasksForSelected.length === 0 && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">找不到這個階段的題目內容，請確認講義／作業檔案是否存在。</p>}
                  <button onClick={() => void saveAnswers()} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">保存所有修改</button>
                </div>
              )}

              <div className="mt-7 border-t border-slate-100 pt-6">
                <label className="block text-sm font-bold text-slate-700" htmlFor="advice">顧問建議</label>
                <textarea id="advice" className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="整理給顧問的下一步建議、風險與跟進重點…" value={advice} onChange={(event) => setAdvice(event.target.value)} />
                <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="feedback">教師回饋</label>
                <textarea id="feedback" className="mt-3 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="寫下具體、可執行的回饋…" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
                <p className="mt-2 text-xs leading-5 text-slate-500">批改狀態、顧問建議與教師回饋會套用到這個學員整個階段（所有任務），並會出現在「完整階段藍圖」的匯出檔案中。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void grade("needs_revision")} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">退回修改</button>
                  <button onClick={() => void grade("approved")} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">批改通過</button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid min-h-[520px] place-items-center text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">✓</div>
                <h2 className="mt-5 text-xl font-bold">選擇一份作業開始批改</h2>
                <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">左側會列出每位學員每個階段的作業（已合併同一階段的所有任務），選取後即可檢視答案、補上空白欄位並留下回饋。</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
