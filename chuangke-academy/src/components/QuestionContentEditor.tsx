"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AssignmentField, AssignmentOption, TaskWithFields } from "@/lib/content/taskSections";

type OverrideRow = { stage_key: string; task_key: string; field_key: string; prompt: string | null; description: string | null; options: AssignmentOption[] | null };
type Props = { stageTitles: Record<string, string>; stageTasks: Record<string, TaskWithFields[]> };

function optionText(options: AssignmentOption[] | undefined) {
  return (options ?? []).map((option) => option.label).join("\n");
}

function fieldLabel(field: AssignmentField) {
  return field.prompt || field.sourceStepKey || field.key;
}

export default function QuestionContentEditor({ stageTitles, stageTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const stageKeys = Object.keys(stageTasks);
  const [stageKey, setStageKey] = useState(stageKeys[0] ?? "stage-01");
  const [rows, setRows] = useState<Record<string, OverrideRow>>({});
  const [drafts, setDrafts] = useState<Record<string, OverrideRow>>({});
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("載入教師可編輯的題目…");
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => stageTasks[stageKey]?.flatMap((task) => task.fields.filter((field) => !field.hiddenInGroup).map((field) => ({ task, field }))) ?? [], [stageKey, stageTasks]);
  const visible = fields.filter(({ task, field }) => `${task.title} ${fieldLabel(field)} ${field.group ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  const load = useCallback(async () => {
    setStatus("載入題目覆寫…");
    const { data, error } = await supabase.from("question_overrides").select("stage_key,task_key,field_key,prompt,description,options").eq("stage_key", stageKey);
    if (error) { setStatus(`尚未啟用題目覆寫資料表：${error.message}`); return; }
    const loaded = Object.fromEntries(((data ?? []) as OverrideRow[]).map((row) => [row.field_key, row]));
    setRows(loaded);
    setDrafts(loaded);
    setStatus(`已載入 ${data?.length ?? 0} 個已修改題目；未修改的題目沿用 Markdown 原文。`);
  }, [stageKey, supabase]);

  useEffect(() => { void load(); }, [load]);

  function draftFor(task: TaskWithFields, field: AssignmentField): OverrideRow {
    return drafts[field.key] ?? { stage_key: stageKey, task_key: task.key, field_key: field.key, prompt: field.prompt, description: field.description ?? null, options: field.options ?? null };
  }

  function update(field: AssignmentField, task: TaskWithFields, patch: Partial<OverrideRow>) {
    const current = draftFor(task, field);
    setDrafts((items) => ({ ...items, [field.key]: { ...current, ...patch } }));
  }

  async function save(field: AssignmentField, task: TaskWithFields) {
    const draft = draftFor(task, field);
    setSaving(true); setStatus("保存中…");
    const { error } = await supabase.from("question_overrides").upsert({ ...draft, updated_at: new Date().toISOString() }, { onConflict: "stage_key,task_key,field_key" });
    setSaving(false);
    if (error) { setStatus(`保存失敗：${error.message}`); return; }
    setRows((items) => ({ ...items, [field.key]: draft }));
    setStatus(`已保存「${fieldLabel(field)}」；學員下次載入題目時會看到新內容。`);
  }

  async function reset(field: AssignmentField) {
    setSaving(true); setStatus("回復原始題目…");
    const { error } = await supabase.from("question_overrides").delete().eq("stage_key", stageKey).eq("field_key", field.key);
    setSaving(false);
    if (error) { setStatus(`回復失敗：${error.message}`); return; }
    setDrafts((items) => { const next = { ...items }; delete next[field.key]; return next; });
    setRows((items) => { const next = { ...items }; delete next[field.key]; return next; });
    setStatus(`已回復「${fieldLabel(field)}」的 Markdown 原始內容。歷史版本仍保留在資料庫。`);
  }

  return <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">Question copy editor</p><h2 className="mt-2 text-2xl font-bold text-slate-900">題目內容管理</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">教師可修改學員看到的題目提示、補充說明與選項文字；題目識別碼、答案鍵、回顧連結與原始 Markdown 不會被改寫。每次更新前的版本會保留，亦可逐題回復原始內容。</p></div>
      <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">僅教師可保存</span>
    </div>
    <div className="mt-6 flex flex-wrap gap-3"><select className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold" value={stageKey} onChange={(event) => setStageKey(event.target.value)}>{stageKeys.map((key) => <option key={key} value={key}>{stageTitles[key] ?? key}</option>)}</select><input className="min-w-64 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜尋任務或題目…" /></div>
    <p className="mt-3 text-xs leading-5 text-slate-500">{status}</p>
    <div className="mt-6 space-y-4">{visible.map(({ task, field }) => { const draft = draftFor(task, field); const changed = Boolean(rows[field.key]) && JSON.stringify(rows[field.key]) !== JSON.stringify(draft); return <article key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-teal-700">{task.title} · {field.key}</p><p className="mt-1 text-sm font-semibold text-slate-700">原始提示：{fieldLabel(field)}</p></div>{rows[field.key] && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">已覆寫</span>}</div><div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-sm font-semibold text-slate-700">學員看到的題目<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={draft.prompt ?? ""} onChange={(event) => update(field, task, { prompt: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">補充說明<textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={draft.description ?? ""} onChange={(event) => update(field, task, { description: event.target.value })} /></label></div>{(field.options ?? []).length > 0 && <label className="mt-4 block text-sm font-semibold text-slate-700">選項文字<span className="ml-2 font-normal text-slate-500">一行一個，順序與選項鍵保持不變</span><textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" value={optionText(draft.options ?? [])} onChange={(event) => update(field, task, { options: (draft.options ?? []).map((option, index) => ({ ...option, label: event.target.value.split("\n")[index] ?? "" })) })} /></label>}<div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={() => void save(field, task)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">保存題目</button>{rows[field.key] && <button disabled={saving} onClick={() => void reset(field)} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50">回復原始內容</button>}{changed && <span className="self-center text-xs text-amber-700">有尚未保存的修改</span>}</div></article>; })}</div>
    {visible.length === 0 && <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">找不到符合條件的題目。</p>}
  </section>;
}
