"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AssignmentField, AssignmentOption, TaskWithFields } from "@/lib/content/taskSections";
import type { RecallSetting, RecallTargetRow } from "@/lib/content/recallSettings";
import { applyQuestionOverrides, type QuestionOverride } from "@/lib/content/overrides";

type EditableType = "checkboxes" | "single_choice" | "text" | "textarea";
type OverrideRow = QuestionOverride & { stage_key: string; task_key: string; field_key: string; prompt: string | null; description: string | null; options: AssignmentOption[] | null; field_type: EditableType | null; multiple: boolean | null; sort_order: number | null; is_deleted?: boolean | null; is_custom?: boolean | null; table_key?: string | null; table_title?: string | null; table_row?: string | null; table_column?: string | null };
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

function RecallTargetEditor({ field, stageKey, taskKey, stageTitles, stageTasks, setting, targets, saving, onToggle, onToggleTarget }: {
  field: AssignmentField;
  stageKey: string;
  taskKey: string;
  stageTitles: Record<string, string>;
  stageTasks: Record<string, TaskWithFields[]>;
  setting?: RecallSetting;
  targets: RecallTargetRow[];
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onToggleTarget: (targetStageKey: string, targetTaskKey: string, targetFieldKey: string, checked: boolean) => void;
}) {
  const enabled = setting?.enabled ?? false;
  const selectedKeys = new Set(targets.map((row) => `${row.target_stage_key}|${row.target_task_key}|${row.target_field_key}`));
  return <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
    <label className="flex items-center gap-2 text-xs font-bold text-teal-900">
      <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={enabled} disabled={saving} onChange={(event) => onToggle(event.target.checked)} />
      開啟這一題的回顧功能
    </label>
    <p className="mt-1 text-xs leading-5 text-teal-800">開啟後，學員作答這一題時，右側會顯示下面勾選的題目，可點擊查看當初的作答。可勾選多題。</p>
    {enabled && <div className="mt-3 max-h-56 space-y-3 overflow-y-auto rounded-lg border border-teal-100 bg-white p-3">
      {Object.entries(stageTasks).map(([targetStage, targetTasks]) => <div key={targetStage}>
        <p className="text-xs font-bold text-slate-500">{stageTitles[targetStage] ?? targetStage}</p>
        {targetTasks.map((targetTask) => <div key={targetTask.key} className="mt-1.5">
          <p className="text-xs font-semibold text-slate-600">{targetTask.title}</p>
          <div className="mt-1 grid gap-1 pl-2">
            {targetTask.fields.filter((targetField) => !targetField.hiddenInGroup && !(targetTask.key === taskKey && targetField.key === field.key)).map((targetField) => {
              const value = `${targetStage}|${targetTask.key}|${targetField.key}`;
              return <label key={value} className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-teal-700" disabled={saving} checked={selectedKeys.has(value)} onChange={(event) => onToggleTarget(targetStage, targetTask.key, targetField.key, event.target.checked)} />
                {fieldLabel(targetField)}
              </label>;
            })}
          </div>
        </div>)}
      </div>)}
    </div>}
  </div>;
}

export default function QuestionContentEditor({ stageTitles, stageTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const stageKeys = Object.keys(stageTasks);
  const [stageKey, setStageKey] = useState(stageKeys[0] ?? "stage-01");
  const [taskKey, setTaskKey] = useState(stageTasks[stageKeys[0] ?? "stage-01"]?.[0]?.key ?? "");
  const [rows, setRows] = useState<Record<string, OverrideRow>>({});
  const [drafts, setDrafts] = useState<Record<string, OverrideRow>>({});
  const [recallSettings, setRecallSettings] = useState<Record<string, RecallSetting>>({});
  const [recallTargets, setRecallTargets] = useState<Record<string, RecallTargetRow[]>>({});
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("載入教師可編輯的題目…");
  const [saving, setSaving] = useState(false);
  const effectiveStageTasks = useMemo(() => Object.fromEntries(Object.entries(stageTasks).map(([key, tasks]) => [key, applyQuestionOverrides(tasks, Object.values(rows) as QuestionOverride[])])), [stageTasks, rows]);
  const tasksForStage = effectiveStageTasks[stageKey] ?? [];
  const effectiveTasksForStage = effectiveStageTasks[stageKey] ?? [];
  const selectedTask = effectiveTasksForStage.find((task) => task.key === taskKey) ?? effectiveTasksForStage[0];
  const fields = useMemo(() => selectedTask?.fields.filter((field) => !field.hiddenInGroup).map((field, index) => ({ task: selectedTask, field, index })).sort((a, b) => (drafts[a.field.key]?.sort_order ?? a.index) - (drafts[b.field.key]?.sort_order ?? b.index)) ?? [], [selectedTask, drafts]);
  const deletedFields = useMemo(() => {
    const taskRows = Object.values(rows).filter((row) => row.task_key === taskKey && row.is_deleted);
    const sourceFields = stageTasks[stageKey]?.find((task) => task.key === taskKey)?.fields ?? [];
    return taskRows.map((row) => ({ row, field: sourceFields.find((field) => field.key === row.field_key) ?? ({ key: row.field_key, prompt: row.prompt ?? "已刪除題目", type: row.field_type === "textarea" ? "textarea" : row.field_type === "checkboxes" || row.field_type === "single_choice" ? "checkboxes" : "text", options: row.options ?? undefined, multiple: row.multiple ?? undefined, required: true } as AssignmentField) }));
  }, [rows, stageTasks, stageKey, taskKey]);
  const visible = fields.filter(({ task, field }) => `${task.title} ${fieldLabel(field)} ${field.group ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  const load = useCallback(async () => {
    setStatus("載入題目覆寫…");
    const [{ data, error }, { data: settingsData, error: settingsError }, { data: targetsData, error: targetsError }] = await Promise.all([
      supabase.from("question_overrides").select("stage_key,task_key,field_key,prompt,description,options,field_type,multiple,sort_order,is_deleted,is_custom,table_key,table_title,table_row,table_column").eq("stage_key", stageKey),
      supabase.from("recall_settings").select("stage_key,task_key,field_key,enabled,updated_by,updated_at"),
      supabase.from("recall_targets").select("stage_key,task_key,field_key,target_stage_key,target_task_key,target_field_key,position,updated_by,updated_at"),
    ]);
    if (error) { setStatus(`題目覆寫資料表尚未可用：${error.message}`); return; }
    if (settingsError || targetsError) { setStatus(`回顧設定資料表尚未可用：${settingsError?.message ?? targetsError?.message}`); }
    const loaded = Object.fromEntries(((data ?? []) as OverrideRow[]).map((row) => [row.field_key, row]));
    setRows(loaded); setDrafts(loaded);
    setRecallSettings(Object.fromEntries(((settingsData ?? []) as RecallSetting[]).map((row) => [row.field_key, row])));
    const groupedTargets: Record<string, RecallTargetRow[]> = {};
    ((targetsData ?? []) as RecallTargetRow[]).forEach((row) => { (groupedTargets[row.field_key] ??= []).push(row); });
    setRecallTargets(groupedTargets);
    if (!settingsError && !targetsError) setStatus(`已載入 ${data?.length ?? 0} 個已修改題目與 ${(settingsData ?? []).length} 個回顧設定；未修改的題目沿用原始教材。`);
  }, [stageKey, supabase]);
  useEffect(() => { void load(); }, [load]);

  function draftFor(task: TaskWithFields, field: AssignmentField, index = 0): OverrideRow {
    return drafts[field.key] ?? { stage_key: stageKey, task_key: task.key, field_key: field.key, prompt: field.prompt, description: field.description ?? null, options: field.options ?? null, field_type: typeFor(field), multiple: field.type === "checkboxes" ? field.multiple ?? true : null, sort_order: index, is_deleted: false, is_custom: false, table_key: field.tableKey ?? null, table_title: field.tableTitle ?? null, table_row: field.tableRow ?? null, table_column: field.tableColumn ?? null };
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
  async function setDeleted(field: AssignmentField, deleted: boolean) {
    const updatedBy = await getEditorUserId();
    if (!updatedBy || !selectedTask) return;
    const draft = draftFor(selectedTask, field, fields.findIndex((item) => item.field.key === field.key));
    const payload = { ...draft, is_deleted: deleted, updated_by: updatedBy, updated_at: new Date().toISOString() };
    setSaving(true); setStatus(deleted ? "刪除題目中…" : "恢復題目中…");
    const { error } = await supabase.from("question_overrides").upsert(payload, { onConflict: "stage_key,task_key,field_key" });
    setSaving(false);
    if (error) { setStatus(`題目狀態保存失敗：${error.message}`); return; }
    setRows((items) => ({ ...items, [field.key]: payload }));
    setDrafts((items) => ({ ...items, [field.key]: payload }));
    setStatus(deleted ? `已刪除「${fieldLabel(field)}」；可在刪除題目清單中恢復。` : `已恢復「${fieldLabel(field)}」。`);
  }
  function addCustomField() {
    if (!selectedTask) return;
    const customNumber = Object.values(rows).filter((row) => row.task_key === selectedTask.key && row.is_custom).length + 1;
    const fieldKey = `${selectedTask.key}-custom-${customNumber}-${Date.now().toString(36)}`;
    const row: OverrideRow = { stage_key: stageKey, task_key: selectedTask.key, field_key: fieldKey, prompt: "新題目", description: null, options: null, field_type: "text", multiple: null, sort_order: selectedTask.fields.length, is_deleted: false, is_custom: true };
    setRows((items) => ({ ...items, [fieldKey]: row }));
    setDrafts((items) => ({ ...items, [fieldKey]: row }));
    setStatus("已新增未保存題目，請完成內容後按「保存題目」。");
  }
  async function saveTableTitle(tableKey: string, title: string) {
    const updatedBy = await getEditorUserId();
    if (!updatedBy || !selectedTask) return;
    const tableFields = selectedTask.fields.filter((field) => field.tableKey === tableKey);
    setSaving(true);
    const results = await Promise.all(tableFields.map((field) => {
      const draft = draftFor(selectedTask, field, fields.findIndex((item) => item.field.key === field.key));
      return supabase.from("question_overrides").upsert({ ...draft, table_title: title, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "stage_key,task_key,field_key" });
    }));
    setSaving(false);
    const failed = results.find((result) => result.error);
    if (failed?.error) { setStatus(`表格標題保存失敗：${failed.error.message}`); return; }
    setRows((items) => Object.fromEntries(Object.entries(items).map(([key, row]) => row.table_key === tableKey ? [key, { ...row, table_title: title }] : [key, row])));
    setDrafts((items) => Object.fromEntries(Object.entries(items).map(([key, row]) => row.table_key === tableKey ? [key, { ...row, table_title: title }] : [key, row])));
    setStatus("表格主標題已保存。");
  }
  async function toggleRecall(field: AssignmentField, task: TaskWithFields, nextEnabled: boolean) {
    const updatedBy = await getEditorUserId();
    if (!updatedBy) return;
    setSaving(true); setStatus("保存回顧開關中…");
    const payload = { stage_key: stageKey, task_key: task.key, field_key: field.key, enabled: nextEnabled, updated_by: updatedBy, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("recall_settings").upsert(payload, { onConflict: "stage_key,task_key,field_key" });
    setSaving(false);
    if (error) { setStatus(`回顧開關保存失敗：${error.message}`); return; }
    setRecallSettings((items) => ({ ...items, [field.key]: payload }));
    setStatus(`已${nextEnabled ? "開啟" : "關閉"}「${fieldLabel(field)}」的回顧功能；學員端會在 2 秒內同步。`);
  }

  async function toggleRecallTarget(field: AssignmentField, task: TaskWithFields, targetStageKey: string, targetTaskKey: string, targetFieldKey: string, checked: boolean) {
    const updatedBy = await getEditorUserId();
    if (!updatedBy) return;
    setSaving(true); setStatus("保存回顧目標中…");
    if (checked) {
      const existing = recallTargets[field.key] ?? [];
      const payload = { stage_key: stageKey, task_key: task.key, field_key: field.key, target_stage_key: targetStageKey, target_task_key: targetTaskKey, target_field_key: targetFieldKey, position: existing.length, updated_by: updatedBy, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("recall_targets").upsert(payload, { onConflict: "stage_key,task_key,field_key,target_stage_key,target_task_key,target_field_key" });
      setSaving(false);
      if (error) { setStatus(`回顧目標保存失敗：${error.message}`); return; }
      setRecallTargets((items) => ({ ...items, [field.key]: [...existing, payload] }));
    } else {
      const { error } = await supabase.from("recall_targets").delete().eq("stage_key", stageKey).eq("task_key", task.key).eq("field_key", field.key).eq("target_stage_key", targetStageKey).eq("target_task_key", targetTaskKey).eq("target_field_key", targetFieldKey);
      setSaving(false);
      if (error) { setStatus(`回顧目標移除失敗：${error.message}`); return; }
      setRecallTargets((items) => ({ ...items, [field.key]: (items[field.key] ?? []).filter((row) => !(row.target_stage_key === targetStageKey && row.target_task_key === targetTaskKey && row.target_field_key === targetFieldKey)) }));
    }
    setStatus(`已更新「${fieldLabel(field)}」的回顧目標；學員端會在 2 秒內同步。`);
  }

  if (!stageKeys.length) return <section className="mt-8 rounded-3xl bg-white p-6">找不到可編輯的階段題目。</section>;
  return <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">Question editor</p><h2 className="mt-2 text-2xl font-bold text-slate-900">題目內容、題型與順序管理</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">可修改題目文字、題型、選項與顯示順序。題目 key 與答案 key 保持不變；變更保存後，學員已開啟的作業會透過 Realtime 或輪詢自動取得最新版本。</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">教師可保存</span></div>
    <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]"><select aria-label="選擇階段" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold" value={stageKey} onChange={(event) => { const nextStage = event.target.value; setStageKey(nextStage); setTaskKey(effectiveStageTasks[nextStage]?.[0]?.key ?? ""); }}>{stageKeys.map((key) => <option key={key} value={key}>{stageTitles[key] ?? key}</option>)}</select><select aria-label="選擇任務單元" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold" value={selectedTask?.key ?? ""} onChange={(event) => setTaskKey(event.target.value)}>{tasksForStage.map((task, index) => <option key={task.key} value={task.key}>任務 {index + 1}｜{task.title.replace(/^任務\s*\d+(?:\.\d+)?：?\s*/, "")}</option>)}</select><button type="button" onClick={addCustomField} disabled={!selectedTask || saving} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">＋新增題目</button></div><input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="在目前任務中搜尋題目…" />
    <p className="mt-3 text-xs leading-5 text-slate-500">{status}</p>
    <div className="mt-6 space-y-4">{visible.map(({ task, field, index }) => { const draft = draftFor(task, field, index); const mode = typeFor(field, draft); const changed = JSON.stringify(rows[field.key] ?? {}) !== JSON.stringify(draft); return <article key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-teal-700">{task.title} · {field.key}</p><p className="mt-1 text-sm font-semibold text-slate-700">目前提示：{fieldLabel(field)}</p>{field.tableKey && <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-slate-500">表格主標題<input className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-normal" defaultValue={draft.table_title ?? field.tableTitle ?? "表格作答"} onBlur={(event) => { if (event.target.value.trim() && event.target.value.trim() !== (draft.table_title ?? field.tableTitle)) void saveTableTitle(field.tableKey!, event.target.value.trim()); }} /></label><span className="text-xs text-slate-400">列：{field.tableRow ?? "—"}／欄：{field.tableColumn ?? "—"}</span></div>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={index === 0 || saving} onClick={() => move(task, field, -1, index)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">↑ 上移</button><button type="button" disabled={index === task.fields.filter((item) => !item.hiddenInGroup).length - 1 || saving} onClick={() => move(task, field, 1, index)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">↓ 下移</button>{rows[field.key]?.is_custom && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">自訂題目</span>}{rows[field.key] && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">已覆寫</span>}</div></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-sm font-semibold text-slate-700">學員看到的題目<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={draft.prompt ?? ""} onChange={(event) => update(field, task, { prompt: event.target.value }, index)} /></label><label className="text-sm font-semibold text-slate-700">補充說明<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={draft.description ?? ""} onChange={(event) => update(field, task, { description: event.target.value }, index)} /></label></div><label className="mt-4 block text-sm font-semibold text-slate-700">題型<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal" value={mode} onChange={(event) => { const next = event.target.value as EditableType; update(field, task, { field_type: next, multiple: next === "checkboxes" ? true : next === "single_choice" ? false : null, options: next === "text" || next === "textarea" ? null : draft.options ?? [] }, index); }}>{(["checkboxes", "single_choice", "text", "textarea"] as EditableType[]).map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></label>{(mode === "checkboxes" || mode === "single_choice") && <label className="mt-4 block text-sm font-semibold text-slate-700">選項文字<span className="ml-2 font-normal text-slate-500">一行一個；可以新增、刪除或重新命名選項</span><textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={optionText(draft.options ?? [])} onChange={(event) => update(field, task, { options: optionsFromText(field.key, event.target.value, draft.options ?? []) }, index)} /></label>}<div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={() => void save(field, task, index)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">保存題目</button><button disabled={saving} onClick={() => void setDeleted(field, true)} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50">刪除題目</button>{rows[field.key] && <button disabled={saving} onClick={() => void reset(field)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">回復原始內容</button>}{changed && <span className="self-center text-xs text-amber-700">有尚未保存的修改</span>}</div><RecallTargetEditor field={field} stageKey={stageKey} taskKey={task.key} stageTitles={stageTitles} stageTasks={stageTasks} setting={recallSettings[field.key]} targets={recallTargets[field.key] ?? []} saving={saving} onToggle={(nextEnabled) => void toggleRecall(field, task, nextEnabled)} onToggleTarget={(targetStageKey, targetTaskKey, targetFieldKey, checked) => void toggleRecallTarget(field, task, targetStageKey, targetTaskKey, targetFieldKey, checked)} /></article>; })}</div>{deletedFields.length > 0 && <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/50 p-4"><p className="text-sm font-bold text-rose-800">已刪除題目（可恢復）</p><div className="mt-3 space-y-2">{deletedFields.map(({ row, field }) => <div key={row.field_key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><span className="text-sm text-slate-700">{fieldLabel(field)}</span><button type="button" disabled={saving} onClick={() => void setDeleted(field, false)} className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 disabled:opacity-50">恢復題目</button></div>)}</div></div>}{visible.length === 0 && deletedFields.length === 0 && <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">找不到符合條件的題目。</p>}
  </section>;
}
