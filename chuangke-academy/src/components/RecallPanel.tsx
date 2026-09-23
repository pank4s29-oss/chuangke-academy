"use client";

import { useMemo, useState } from "react";
import type { TaskWithFields } from "@/lib/content/taskSections";
import { answerDisplay, fieldsToCanonical } from "@/lib/content/questions";
import { getQuestionNumbers } from "@/lib/content/questionNumbers";
import type { RecallTargetRow } from "@/lib/content/recallSettings";

type AnswersByStage = Record<string, Record<string, string | string[]>>;

type ResolvedTarget = { row: RecallTargetRow; task: TaskWithFields; fieldKey: string; number?: number };

export default function RecallPanel({ targets, tasks, answersByStage }: { targets: RecallTargetRow[]; tasks: TaskWithFields[]; answersByStage: AnswersByStage }) {
  const [selected, setSelected] = useState<ResolvedTarget | null>(null);
  const resolved = useMemo(() => targets.map((row) => {
    const task = tasks.find((item) => item.key === row.target_task_key);
    const field = task?.fields.find((item) => item.key === row.target_field_key);
    if (!task || !field) return null;
    return { row, task, fieldKey: field.key, number: getQuestionNumbers(task.fields)[field.key] };
  }).filter(Boolean) as ResolvedTarget[], [targets, tasks]);
  if (!resolved.length) return null;
  const answer = selected ? answerDisplay(fieldsToCanonical([selected.task.fields.find((field) => field.key === selected.fieldKey)!])[0], answersByStage[selected.row.target_stage_key]?.[selected.fieldKey]).trim() : "";
  return <>
    <aside className="shrink-0 rounded-xl border border-teal-200 bg-teal-50/70 p-3 sm:w-52" aria-label="可回顧題目">
      <p className="text-xs font-bold text-teal-900">回顧作答</p>
      <p className="mt-1 text-xs leading-5 text-teal-800">可查看相關題目的已保存答案</p>
      <div className="mt-2 flex flex-wrap gap-1.5 sm:flex-col">
        {resolved.map((target) => <button key={`${target.row.target_stage_key}|${target.row.target_task_key}|${target.fieldKey}`} type="button" onClick={() => setSelected(target)} className="rounded-lg bg-white px-2.5 py-1.5 text-left text-xs font-bold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100">第 {target.number ?? "—"} 題</button>)}
      </div>
    </aside>
    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="recall-panel-title">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">回顧作答</p><h2 id="recall-panel-title" className="mt-2 text-xl font-bold text-slate-900">第 {selected.number ?? "—"} 題</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-full px-3 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100" aria-label="關閉作答視窗">×</button></div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{selected.task.title}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{selected.task.fields.find((field) => field.key === selected.fieldKey)?.prompt ?? "作答題目"}</p></div>
        <div className={`mt-4 rounded-2xl p-4 ${answer ? "bg-teal-50 text-teal-950" : "bg-amber-50 text-amber-900"}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-70">當初的作答</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{answer || "尚未作答"}</p></div>
      </section>
    </div>}
  </>;
}
