"use client";

import { useMemo } from "react";
import type { TaskWithFields } from "@/lib/content/taskSections";
import { buildStageBlueprint } from "@/lib/content/blueprint";

type Props = { stageTitle: string; tasks: TaskWithFields[]; answers: Record<string, string | string[]>; optionLabels: Record<string, string>; learnerName: string };

export default function StageBlueprint({ stageTitle, tasks, answers, optionLabels, learnerName }: Props) {
  const sections = useMemo(() => buildStageBlueprint(stageTitle, tasks, answers, optionLabels), [answers, optionLabels, stageTitle, tasks]);
  function printBlueprint() { window.print(); }
  return <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:p-8 print:shadow-none print:ring-0"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Stage blueprint</p><h2 className="mt-2 text-2xl font-bold">{stageTitle}｜{learnerName}</h2><p className="mt-2 text-sm leading-6 text-slate-500">由學員各任務作答自動彙整，供顧問快速掌握重點。</p></div><button onClick={printBlueprint} className="print:hidden rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">匯出／列印藍圖</button></div><div className="mt-7 space-y-6">{sections.map((section) => <article key={section.title} className="break-inside-avoid rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-bold text-slate-800">{section.title}</h3><dl className="mt-4 grid gap-4 sm:grid-cols-2">{section.items.map((item) => <div key={`${section.title}-${item.label}`} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold leading-5 text-slate-500">{item.label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.value}</dd></div>)}</dl></article>)}</div></section>;
}
