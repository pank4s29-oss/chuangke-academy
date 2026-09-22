"use client";

import { useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TaskWithFields } from "@/lib/content/taskSections";
import { fieldsToCanonical, answerDisplay } from "@/lib/content/questions";
import { getQuestionNumbers } from "@/lib/content/questionNumbers";

type Answer = string | string[];
type Answers = Record<string, Answer>;
type SavedAnswersByStage = Record<string, Answers>;
type Props = { markdown: string; tasks: TaskWithFields[]; answersByStage: SavedAnswersByStage };
type RecallTarget = { code: string; stageKey: string; task: TaskWithFields; fieldKey?: string; questionNumber?: number };

const RECALL_RE = /(?<![\w.])([12])\.(\d+(?:\.\d+)?)-([A-Z])\b/g;
const REFERENCES = ["1.1-A", "1.1-B", "1.1-C", "1.1-D", "1.1-E", "1.2-A", "1.2-B", "1.2-C", "1.2-D", "1.2-E", "1.3-A", "1.3-B", "1.3-C", "1.3-D", "1.4-A", "1.4-B", "1.4-C", "1.4-D", "1.5-A", "1.5-B", "1.5-C", "1.5-D", "2.1-A", "2.1-B", "2.1-C", "2.2-A", "2.2-B", "2.2-C", "2.3-A", "2.3-B", "2.3-C", "2.3-D", "2.4-A", "2.4-B", "2.4-C", "2.4-D", "2.5-A", "2.5-B", "2.5-C", "2.5-D", "2.5-E"];

export function referenceParts(code: string) {
  const match = code.match(/^([12])\.(\d+(?:\.\d+)?)-([A-Z])$/);
  if (!match) return null;
  const sectionKey = match[1] === "1" ? `${match[2].split(".").at(-1)}-${match[3]}` : `2.${match[2]}-${match[3]}`;
  const taskKey = match[1] === "1" ? `stage-01-${match[2].split(".").at(-1)}` : `stage-02-2-${match[2]}`;
  return { stageKey: `stage-0${match[1]}`, taskKey, sectionKey };
}

function textWithReferences(text: string, resolve: (code: string) => RecallTarget | undefined, onSelect: (target: RecallTarget) => void) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  RECALL_RE.lastIndex = 0;
  for (const match of text.matchAll(RECALL_RE)) {
    const code = match[0];
    const start = match.index ?? 0;
    if (start > cursor) parts.push(text.slice(cursor, start));
    const target = resolve(code);
    parts.push(target ? <button key={`${code}-${start}`} type="button" onClick={() => onSelect(target)} className="mx-0.5 inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-[0.92em] font-bold text-teal-800 ring-1 ring-inset ring-teal-200 transition hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500" title={`查看 ${code} 的作答`}>第 {target.questionNumber ?? "—"} 題</button> : code);
    cursor = start + code.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function renderChildren(children: ReactNode, resolve: (code: string) => RecallTarget | undefined, onSelect: (target: RecallTarget) => void): ReactNode {
  if (typeof children === "string") return textWithReferences(children, resolve, onSelect);
  if (Array.isArray(children)) return children.map((child, index) => <span key={index}>{renderChildren(child, resolve, onSelect)}</span>);
  return children;
}

function AnswerDialog({ target, answers, onClose }: { target: RecallTarget; answers: Answers; onClose: () => void }) {
  const field = target.fieldKey ? target.task.fields.find((item) => item.key === target.fieldKey) : undefined;
  const value = field ? answerDisplay(fieldsToCanonical([field])[0], answers[field.key]) : "";
  const answer = value.trim() || "尚未作答";
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 sm:p-7" role="dialog" aria-modal="true" aria-labelledby="recall-dialog-title">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">回顧作答</p><h2 id="recall-dialog-title" className="mt-2 text-xl font-bold text-slate-900">{target.code} · 第 {target.questionNumber ?? "—"} 題</h2></div><button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="關閉作答視窗">×</button></div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70"><p className="text-xs font-semibold text-slate-500">{target.task.title}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{field?.prompt ?? "此回顧區段包含多個作答欄位"}</p></div>
      <div className={`mt-4 rounded-2xl p-4 ${answer === "尚未作答" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-teal-50 text-teal-950 ring-1 ring-teal-100"}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-70">當初的作答</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{answer}</p></div>
      <p className="mt-4 text-xs leading-5 text-slate-500">這裡顯示目前已保存的答案；尚未填寫的題目會顯示「尚未作答」。</p>
    </section>
  </div>;
}

export default function RecallMarkdown({ markdown, tasks, answersByStage }: Props) {
  const [selected, setSelected] = useState<RecallTarget>();
  const targets = useMemo(() => {
    const map = new Map<string, RecallTarget>();
    tasks.forEach((task) => {
      const numbers = getQuestionNumbers(task.fields);
      const bySection = new Map<string, typeof task.fields>();
      task.fields.filter((field) => !field.hiddenInGroup && field.sourceSectionKey).forEach((field) => {
        const list = bySection.get(field.sourceSectionKey!) ?? [];
        list.push(field);
        bySection.set(field.sourceSectionKey!, list);
      });
      REFERENCES.forEach((code) => {
        const parts = referenceParts(code);
        if (!parts || parts.taskKey !== task.key) return;
        const field = bySection.get(parts.sectionKey)?.[0];
        map.set(code, { code, stageKey: parts.stageKey, task, fieldKey: field?.key, questionNumber: field ? numbers[field.key] : undefined });
      });
    });
    return map;
  }, [tasks]);
  const resolve = (code: string) => targets.get(code);
  const components = {
    p: ({ children }: { children?: ReactNode }) => <p>{renderChildren(children, resolve, setSelected)}</p>,
    li: ({ children }: { children?: ReactNode }) => <li>{renderChildren(children, resolve, setSelected)}</li>,
    blockquote: ({ children }: { children?: ReactNode }) => <blockquote>{renderChildren(children, resolve, setSelected)}</blockquote>,
    strong: ({ children }: { children?: ReactNode }) => <strong>{renderChildren(children, resolve, setSelected)}</strong>,
    em: ({ children }: { children?: ReactNode }) => <em>{renderChildren(children, resolve, setSelected)}</em>,
  };
  return <><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{markdown}</ReactMarkdown>{selected && <AnswerDialog target={selected} answers={answersByStage[selected.stageKey] ?? {}} onClose={() => setSelected(undefined)} />}</>;
}
