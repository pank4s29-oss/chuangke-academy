"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AssignmentField, AssignmentOption, TaskWithFields } from "@/lib/content/taskSections";
import type { RecallTargetOverride } from "@/lib/content/recallOverrides";

type EditableType = "checkboxes" | "single_choice" | "text" | "textarea";
type OverrideRow = { stage_key: string; task_key: string; field_key: string; prompt: string | null; description: string | null; options: AssignmentOption[] | null; field_type: EditableType | null; multiple: boolean | null; sort_order: number | null };
type Props = { stageTitles: Record<string, string>; stageTasks: Record<string, TaskWithFields[]> };

function typeFor(field: AssignmentField, override?: OverrideRow): EditableType {
  if (override?.field_type) return override.field_type;
  if (field.type === "checkboxes") return field.multiple ? "checkboxes" : "single_choice";
  return field.type;
}
function typeLabel(type: EditableType) {
  return type === "checkboxes" ? "勾選題（可複選）" : type === "single_choice" ? "選擇題（單選）" : type === "textarea" ? "長文字填空" : "填空題";
}
function fieldLabel(field: AssignmentField) { return field.prompt || field.sourceStepKey || field.key; }
function optionText(options: AssignmentOption[] | undefined) { return (options ?? []).map((option) => option.label).join("\n"); }
function optionsFromText(fieldKey: string, text: string, current: AssignmentOption[]) {
  return text.split("\n").map((label, index) => ({ key: current[index]?.key ?? `${fieldKey}-custom-option-${index + 1}`, label: label.trim() })).filter((option) => option.label);
}

function recallCodeFor(stageKey: string, taskKey: string, sectionKey?: string) {
  if (!sectionKey) return null;
  const taskNumber = stageKey === "stage-01" ? taskKey.replace(/^stage-01-/, "") : taskKey.replace(/^stage-02-2-/, "");
  return `${stageKey === "stage-01" ? "1" : "2"}.${taskNumber}-${sectionKey.split("-").at(-1)}`;
}

export default function QuestionContentEditor({ stageTitles, stageTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const stageKeys = Object.keys(stageTasks);
  const [stageKey, setStageKey] = useState(stageKeys[0] ?? "stage-01");
  const [taskKey, setTaskKey] = useState(stageTasks[stageKeys[0] ?? "stage-01"]?.[0]?.key ?? "");
  const [rows, setRows] = useState<Record<string, OverrideRow>>({});
  const [drafts, setDrafts] = useState<Record<string, OverrideRow>>({});
  const [recallRows, setRecallRows] = useState<Record<string, RecallTargetOverride>>({});
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("載入教師可編輯的題目…");
  const [saving, setSaving] = useState(false);
  const tasksForStage = stageTasks[stageKey] ?? [];
  const selectedTask = tasksForStage.find((task) => task.key === taskKey) ?? tasksForStage[0];
  const fields = useMemo(() => selectedTask?.fields.filter((field) => !field.hiddenInGroup).map((field, index) => ({ task: selectedTask, field, index })).sort((a, b) => (drafts[a.field.key]?.sort_order ?? a.index) - (drafts[b.field.key]?.sort_order ?? b.index)) ?? [], [selectedTask, drafts]);
  const visible = fields.filter(({ task, field }) => `${task.title} ${fieldLabel(field)} ${field.group ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  const load = useCallback(async () => {
    setStatus("載入題目覆寫…");
    const [{ data, error }, { data: recallData }] = await Promise.all([
      supabase.from("question_overrides").select("stage_key,task_key,field_key,prompt,description,options,field_type,multiple,sort_order").eq("stage_key", stageKey),
      supabase.from("recall_target_overrides").select("source_code,target_stage_key,target_task_key,target_field_key,updated_by,updated_at"),
    ]);
    if (error) { setStatus(`題目覆寫資料表尚未可用：${error.message}`); return; }
    const loaded = Object.fromEntries(((data ?? []) as OverrideRow[]).map((row) => [row.field_key, row]));
    setRows(loaded); setDrafts(loaded); setRecallRows(Object.fromEntries(((recallData ?? []) as RecallTargetOverride[]).map((row) => [row.source_code, row]))); setStatus(`已載入 ${data?.length ?? 0} 個已修改題目與 ${(recallData ?? []).length} 個回顧設定；未修改的題目沿用原始教材。`);
  }, [stageKey, supabase]);
  useEffect(() => { void load(); }, [load]);

  function draftFor(task: TaskWithFields, field: AssignmentField, index = 0): OverrideRow {
    return drafts[field.key] ?? { stage_key: stageKey, task_key: task.key, field_key: field.key, prompt: field.prompt, description: field.description ?? null, options: field.options ?? null, field_type: typeFor(field), multiple: field.type === "checkboxes" ? field.multiple ?? true : null, sort_order: index };
  }
  function update(field: AssignmentField, task: TaskWithFields, patch: Partial<OverrideRow>, index = 0) {
    const current = draftFor(task, field, index);
    setDrafts((items) => ({ ...items, [field.key]: { ...current, ...patch } }));
  }
  async function getEditorUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { setStatus("保存失敗：目前登入狀態已失效，請重新登入教師帳號。"); return null; }
    return data.user.id;
  }
  async function move(task: TaskWithFields, field: AssignmentField, direction: -1 | 1, index: number) {
    const current = draftFor(task, field, index);
    const next = Math.max(0, index + direction);
    const sibling = task.fields.filter((item) => !item.hiddenInGroup).sort((a, b) => (drafts[a.key]?.sort_order ?? task.fields.indexOf(a)) - (drafts[b.key]?.sort_order ?? task.fields.indexOf(b)))[next];
    if (!sibling) return;
    const siblingDraft = draftFor(task, sibling, next);
    const currentNext = { ...current, sort_order: next };
    const siblingNext = { ...siblingDraft, sort_order: index };
    const updatedBy = await getEditorUserId();
    if (!updatedBy) return;
    setDrafts((items) => ({ ...items, [field.key]: currentNext, [sibling.key]: siblingNext }));
    setSaving(true); setStatus("保存題目順序中…");
    const [first, second] = await Promise.all([currentNext, siblingNext].map((payload) => supabase.from("question_overrides").upsert({ ...payload, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "stage_key,task_key,field_key" })));
    setSaving(false);
    if (first.error || second.error) { setStatus(`順序保存失敗：${first.error?.message ?? second.error?.message}`); return; }
    setRows((items) => ({ ...items, [field.key]: currentNext, [sibling.key]: siblingNext }));
    setStatus("題目順序已保存；學員端會在 2 秒內同步。");
  }
  async function save(field: AssignmentField, task: TaskWithFields, index: number) {
    const draft = draftFor(task, field, index);
    const updatedBy = await getEditorUserId();
    if (!updatedBy) return;
    setSaving(true); setStatus("保存中…");
    const payload = { ...draft, updated_by: updatedBy, updated_at: new Date().toISOString(), multiple: draft.field_type === "checkboxes" ? true : draft.field_type === "single_choice" ? false : null };
    const { error } = await supabase.from("question_overrides").upsert(payload, { onConflict: "stage_key,task_key,field_key" });
    setSaving(false);
    if (error) { setStatus(`保存失敗：${error.message}`); return; }
    setRows((items) => ({ ...items, [field.key]: payload })); setDrafts((items) => ({ ...items, [field.key]: payload }));
    setStatus(`已保存「${fieldLabel(field)}」；學員端會在 2 秒內同步新題目。`);
  }
  async function reset(field: AssignmentField) {
    setSaving(true); setStatus("回復原始題目…");
    const { error } = await supabase.from("question_overrides").delete().eq("stage_key", stageKey).eq("field_key", field.key);
    setSaving(false);
    if (error) { setStatus(`回復失敗：${error.message}`); return; }
    setDrafts((items) => { const next = { ...items }; delete next[field.key]; return next; }); setRows((items) => { const next = { ...items }; delete next[field.key]; return next; });
    setStatus(`已回復「${fieldLabel(field)}」的原始內容。`);
  }
  async function saveRecall(sourceCode: string, value: string) {
    const [targetStageKey, targetTaskKey, targetFieldKey] = value.split("|");
    const updatedBy = await getEditorUserId();
    if (!updatedBy || !targetStageKey || !targetTaskKey || !targetFieldKey) return;
    setSaving(true); setStatus("保存回顧目標中…");
    const payload = { source_code: sourceCode, target_stage_key: targetStageKey, target_task_key: targetTaskKey, target_field_key: targetFieldKey, updated_by: updatedBy, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("recall_target_overrides").upsert(payload, { onConflict: "source_code" });
    setSaving(false);
    if (error) { setStatus(`回顧目標保存失敗：${error.message}`); return; }
    setRecallRows((items) => ({ ...items, [sourceCode]: payload })); setStatus(`已保存 ${sourceCode} 的回顧目標；學員端會在 2 秒內同步。`);
  }

  if (!stageKeys.length) return <section className="mt-8 rounded-3xl bg-white p-6">找不到可編輯的階段題目。</section>;
  return <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">Question editor</p><h2 className="mt-2 text-2xl font-bold text-slate-900">題目內容、題型與順序管理</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">可修改題目文字、題型、選項與顯示順序。題目 key 與答案 key 保持不變；變更保存後，學員已開啟的作業會透過 Realtime 或輪詢自動取得最新版本。</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">教師可保存</span></div>
    <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"><select aria-label="選擇階段" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold" value={stageKey} onChange={(event) => { const nextStage = event.target.value; setStageKey(nextStage); setTaskKey(stageTasks[nextStage]?.[0]?.key ?? ""); }}>{stageKeys.map((key) => <option key={key} value={key}>{stageTitles[key] ?? key}</option>)}</select><select aria-label="選擇任務單元" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold" value={selectedTask?.key ?? ""} onChange={(event) => setTaskKey(event.target.value)}>{tasksForStage.map((task, index) => <option key={task.key} value={task.key}>任務 {index + 1}｜{task.title.replace(/^任務\s*\d+(?:\.\d+)?：?\s*/, "")}</option>)}</select></div><input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="在目前任務中搜尋題目…" />
    <p className="mt-3 text-xs leading-5 text-slate-500">{status}</p>
    <div className="mt-6 space-y-4">{visible.map(({ task, field, index }) => { const draft = draftFor(task, field, index); const mode = typeFor(field, draft); const changed = JSON.stringify(rows[field.key] ?? {}) !== JSON.stringify(draft); return <article key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-teal-700">{task.title} · {field.key}</p><p className="mt-1 text-sm font-semibold text-slate-700">原始提示：{fieldLabel(field)}</p></div><div className="flex gap-2"><button type="button" disabled={index === 0 || saving} onClick={() => move(task, field, -1, index)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">↑ 上移</button><button type="button" disabled={index === task.fields.filter((item) => !item.hiddenInGroup).length - 1 || saving} onClick={() => move(task, field, 1, index)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">↓ 下移</button>{rows[field.key] && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">已覆寫</span>}</div></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-sm font-semibold text-slate-700">學員看到的題目<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={draft.prompt ?? ""} onChange={(event) => update(field, task, { prompt: event.target.value }, index)} /></label><label className="text-sm font-semibold text-slate-700">補充說明<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={draft.description ?? ""} onChange={(event) => update(field, task, { description: event.target.value }, index)} /></label></div><label className="mt-4 block text-sm font-semibold text-slate-700">題型<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal" value={mode} onChange={(event) => { const next = event.target.value as EditableType; update(field, task, { field_type: next, multiple: next === "checkboxes" ? true : next === "single_choice" ? false : null, options: next === "text" || next === "textarea" ? null : draft.options ?? [] }, index); }}>{(["checkboxes", "single_choice", "text", "textarea"] as EditableType[]).map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></label>{(mode === "checkboxes" || mode === "single_choice") && <label className="mt-4 block text-sm font-semibold text-slate-700">選項文字<span className="ml-2 font-normal text-slate-500">一行一個；可以新增、刪除或重新命名選項</span><textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={optionText(draft.options ?? [])} onChange={(event) => update(field, task, { options: optionsFromText(field.key, event.target.value, draft.options ?? []) }, index)} /></label>}<div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={() => void save(field, task, index)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">保存題目</button>{rows[field.key] && <button disabled={saving} onClick={() => void reset(field)} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50">回復原始內容</button>}{changed && <span className="self-center text-xs text-amber-700">有尚未保存的修改</span>}</div></article>; })}</div>{selectedTask && <section className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/50 p-4 sm:p-5"><h3 className="font-bold text-teal-950">回顧題目設定</h3><p className="mt-1 text-sm leading-6 text-teal-900">可指定目前任務中的回顧代碼要開啟哪一題；學員端題號、作答視窗與答案會同步更新。</p>{[...new Set(selectedTask.fields.map((field) => recallCodeFor(stageKey, selectedTask.key, field.sourceSectionKey)).filter(Boolean) as string[])].map((code) => { const current = recallRows[code]; const currentValue = current ? `${current.target_stage_key}|${current.target_task_key}|${current.target_field_key}` : ""; return <div key={code} className="mt-3 grid gap-2 md:grid-cols-[150px_minmax(0,1fr)] md:items-center"><strong className="text-sm text-teal-900">{code}</strong><select className="rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm" value={currentValue} onChange={(event) => void saveRecall(code, event.target.value)} disabled={saving}><option value="">沿用系統自動判斷</option>{Object.entries(stageTasks).flatMap(([targetStage, targetTasks]) => targetTasks.flatMap((targetTask) => targetTask.fields.filter((targetField) => !targetField.hiddenInGroup).map((targetField) => <option key={`${targetStage}|${targetTask.key}|${targetField.key}`} value={`${targetStage}|${targetTask.key}|${targetField.key}`}>{stageTitles[targetStage] ?? targetStage}｜{targetTask.title}｜{fieldLabel(targetField)}</option>)))}</select></div>; })}</section>}{visible.length === 0 && <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">找不到符合條件的題目。</p>}
  </section>;
}
