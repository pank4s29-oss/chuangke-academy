"use client";

import { useMemo, useState } from "react";
import type { TaskWithFields } from "@/lib/content/taskSections";
import { buildStageBlueprint, buildStageBlueprintMarkdown } from "@/lib/content/blueprint";

type Props = { stageTitle: string; tasks: TaskWithFields[]; answers: Record<string, string | string[]>; optionLabels: Record<string, string>; learnerName: string };

function slugify(text: string) {
  return text.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "") || "blueprint";
}

export default function StageBlueprint({ stageTitle, tasks, answers, optionLabels, learnerName }: Props) {
  const sections = useMemo(() => buildStageBlueprint(stageTitle, tasks, answers, optionLabels), [answers, optionLabels, stageTitle, tasks]);
  const [exportStatus, setExportStatus] = useState("");

  // PDF export deliberately reuses the browser's own print-to-PDF flow
  // (via the existing print stylesheet) rather than a client-side PDF
  // library: most lightweight JS PDF generators don't embed a CJK font by
  // default, so they either drop or mis-render the Traditional Chinese
  // content here. The browser's own renderer handles it correctly for free.
  function exportPdf() {
    window.print();
  }

  function exportMarkdown() {
    const markdown = buildStageBlueprintMarkdown(stageTitle, learnerName, sections);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(stageTitle)}-${slugify(learnerName || "學員")}-藍圖.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportStatus("已下載 Markdown 檔案");
    setTimeout(() => setExportStatus(""), 3000);
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:p-8 print:shadow-none print:ring-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Stage blueprint</p>
          <h2 className="mt-2 text-2xl font-bold">{stageTitle}｜{learnerName}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">由學員各任務作答自動彙整，供顧問快速掌握重點。</p>
        </div>
        <div className="print:hidden flex flex-col items-end gap-2">
          <div className="flex flex-wrap gap-2">
            <button onClick={exportPdf} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">匯出 PDF／列印</button>
            <button onClick={exportMarkdown} className="rounded-xl border border-teal-700 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">下載 Markdown</button>
          </div>
          {exportStatus && <p className="text-xs text-teal-700">{exportStatus}</p>}
        </div>
      </div>
      <div className="mt-7 space-y-6">
        {sections.map((section) => (
          <article key={section.title} className="break-inside-avoid rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-800">{section.title}</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {section.items.map((item) => (
                <div key={`${section.title}-${item.label}`} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold leading-5 text-slate-500">{item.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
