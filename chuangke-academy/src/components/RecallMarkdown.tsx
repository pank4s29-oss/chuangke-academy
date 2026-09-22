"use client";

import { useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssignmentField, TaskWithFields } from "@/lib/content/taskSections";
import { isFieldActive, stepOrdinal } from "@/lib/content/taskSections";
import { fieldsToCanonical, answerDisplay } from "@/lib/content/questions";
import { getQuestionNumbers } from "@/lib/content/questionNumbers";

type Answer = string | string[];
type Answers = Record<string, Answer>;
type SavedAnswersByStage = Record<string, Answers>;
type Props = { markdown: string; tasks: TaskWithFields[]; answersByStage: SavedAnswersByStage };
type RecallTarget = { code: string; stageKey: string; task: TaskWithFields; fieldKey?: string; questionNumber?: number };
type SectionEntry = { stageKey: string; task: TaskWithFields; fields: AssignmentField[] };

const RECALL_RE = /(?<![\w.])([12])\.(\d+(?:\.\d+)?)-([A-Z])\b/g;
const REFERENCES = ["1.1-A", "1.1-B", "1.1-C", "1.1-D", "1.1-E", "1.2-A", "1.2-B", "1.2-C", "1.2-D", "1.2-E", "1.3-A", "1.3-B", "1.3-C", "1.3-D", "1.4-A", "1.4-B", "1.4-C", "1.4-D", "1.5-A", "1.5-B", "1.5-C", "1.5-D", "2.1-A", "2.1-B", "2.1-C", "2.2-A", "2.2-B", "2.2-C", "2.3-A", "2.3-B", "2.3-C", "2.3-D", "2.4-A", "2.4-B", "2.4-C", "2.4-D", "2.5-A", "2.5-B", "2.5-C", "2.5-D", "2.5-E"];

// How many characters after a code like "1.1-B" to look at when deciding
// *which* sub-question inside that lettered section the reference means
// (e.g. "步驟 2", "第 4 格", "恐懼層"). Long enough to catch every qualifier
// phrase actually used in the content, short enough to never reach into an
// unrelated sentence.
const QUALIFIER_WINDOW = 18;

// A layer-table reference (2.1-A's 表面痛／真正要的結果／恐懼 rows) is often
// worded as a nickname rather than the literal row label — "中間那層" for the
// middle row, "恐懼那一層" / just "恐懼" for the bottom one — so map every
// wording actually used in the content to the row label the parser records
// on the field (`tableRow`). Longest/most specific alternatives first.
const LAYER_KEYWORDS: Array<[string, string]> = [
  ["真正要的結果", "真正要的結果"],
  ["中間那層", "真正要的結果"],
  ["表面痛", "表面痛"],
  ["恐懼那一層", "恐懼"],
  ["恐懼層", "恐懼"],
  ["恐懼", "恐懼"],
];

type Qualifier = { kind: "step"; n: number } | { kind: "layer"; row: string };

/** Reads the qualifier (if any) right after a "1.1-B"-style code, e.g. the
 *  " 步驟 2 那句…" in "抄 1.1-B 步驟 2 那句「他會親口說的話」", or the
 *  "恐懼層）" in "（抄 2.1-A 恐懼層）". Returns undefined when the following
 *  text is just ordinary prose with no specific sub-question named. */
function extractQualifier(tail: string): Qualifier | undefined {
  const trimmed = tail.replace(/^[\s、，,的]+/, "");
  const stepMatch = trimmed.match(/^(?:步驟|槓桿|第)\s*([0-9]+)\s*(?:格|項|問)?/);
  if (stepMatch) return { kind: "step", n: Number(stepMatch[1]) };
  for (const [keyword, row] of LAYER_KEYWORDS) {
    if (trimmed.startsWith(keyword)) return { kind: "layer", row };
  }
  return undefined;
}

/** Narrows a section's fields down to the one(s) a reference + qualifier
 *  actually names, instead of always handing back the section's first field
 *  regardless of what the surrounding text says.
 *
 *  - A "步驟 N" / "槓桿 N" / "第 N 格" qualifier restricts to the fields filed
 *    under that specific sub-heading (see `sourceStepKey` in taskSections.ts).
 *  - A layer qualifier (表面痛／中間那層／恐懼層…) restricts to the matching
 *    table row.
 *  - With no qualifier — most references are just "1.1-B", not "1.1-B 步驟 2"
 *    — the field the box is actually named for is almost always the *last*
 *    one: earlier fields in the same lettered section are scaffolding
 *    checkboxes (see 1-B's 步驟 1 "他半夜睡不著在想的事") that build up to a
 *    single synthesized sentence at the end (1-B's 步驟 3 "我幫他解決的問題
 *    是…"). Optional/supplementary fields (e.g. 2-E's "選填" keyword notes)
 *    are excluded first so they never get picked over the section's real
 *    question.
 *  - When the resulting field is one of several mutually-exclusive branch
 *    alternatives (e.g. 1-C's 經歷型／方法型／結果型 sentences, which all
 *    `dependsOn` the same 切角 checkbox), every sibling in that branch group
 *    is returned so the caller can pick whichever one the learner actually
 *    selected once it knows the saved answers. */
function pickCandidateFields(fields: AssignmentField[], qualifier: Qualifier | undefined): AssignmentField[] {
  if (qualifier?.kind === "layer") {
    const layered = fields.filter((field) => field.tableRow === qualifier.row);
    if (layered.length) return layered;
  }
  let pool = fields;
  if (qualifier?.kind === "step") {
    const stepped = fields.filter((field) => stepOrdinal(field.sourceStepKey) === qualifier.n);
    if (stepped.length) pool = stepped;
  }
  const required = pool.filter((field) => field.required !== false);
  const finalPool = required.length ? required : pool;
  const last = finalPool[finalPool.length - 1];
  if (!last) return [];
  if (last.dependsOn) {
    const branchKey = last.dependsOn.fieldKey;
    return finalPool.filter((field) => field.dependsOn?.fieldKey === branchKey);
  }
  return [last];
}

/** Among mutually-exclusive branch candidates, picks the one the learner
 *  actually selected (same check the live assignment form uses to decide
 *  which branch field to show). Falls back to the first candidate — usually
 *  the most common branch — when nothing has been answered yet. */
function resolveField(candidates: AssignmentField[], answers: Answers): AssignmentField | undefined {
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((field) => isFieldActive(field, answers)) ?? candidates[0];
}

function normalizeLocalReferences(text: string, currentTaskKey?: string) {
  if (!currentTaskKey) return text;
  const match = currentTaskKey.match(/^stage-(01|02)-(.+)$/);
  if (!match) return text;
  const taskNumber = match[1] === "01" ? match[2].split("-").at(-1) : match[2].replace(/-/g, ".");
  const stageNumber = match[1] === "01" ? "1" : "2";
  return text.replace(/(?<![\w.])([1-5]-[A-Z])\b/g, (_full, local: string) => `${stageNumber}.${taskNumber}-${local.split("-")[1]}`);
}

export function referenceParts(code: string) {
  const match = code.match(/^([12])\.(\d+(?:\.\d+)?)-([A-Z])$/);
  if (!match) return null;
  const sectionKey = match[1] === "1" ? `${match[2].split(".").at(-1)}-${match[3]}` : `2.${match[2]}-${match[3]}`;
  const taskKey = match[1] === "1" ? `stage-01-${match[2].split(".").at(-1)}` : `stage-02-2-${match[2]}`;
  return { stageKey: `stage-0${match[1]}`, taskKey, sectionKey };
}

function textWithReferences(text: string, resolve: (code: string, tail: string) => RecallTarget | undefined, onSelect: (target: RecallTarget) => void) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  RECALL_RE.lastIndex = 0;
  for (const match of text.matchAll(RECALL_RE)) {
    const code = match[0];
    const start = match.index ?? 0;
    if (start > cursor) parts.push(text.slice(cursor, start));
    const tail = text.slice(start + code.length, start + code.length + QUALIFIER_WINDOW);
    const target = resolve(code, tail);
    parts.push(target ? <button key={`${code}-${start}`} type="button" onClick={() => onSelect(target)} className="mx-0.5 inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-[0.92em] font-bold text-teal-800 ring-1 ring-inset ring-teal-200 transition hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500" title={`查看 ${code} 的作答`}>第 {target.questionNumber ?? "—"} 題</button> : code);
    cursor = start + code.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function renderChildren(children: ReactNode, resolve: (code: string, tail: string) => RecallTarget | undefined, onSelect: (target: RecallTarget) => void): ReactNode {
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

/** Indexes every field belonging to each "1.1-B"-style section, keyed by
 *  code, so a reference can be resolved against *all* of that section's
 *  fields (see `pickCandidateFields`) instead of a single field baked in
 *  ahead of time. This step is answer-independent and safe to memoize on
 *  `tasks` alone; the actual field choice happens per-occurrence in
 *  `resolveTarget`, once the qualifier text and saved answers are known. */
export function buildSectionIndex(tasks: TaskWithFields[]) {
  const map = new Map<string, SectionEntry>();
  tasks.forEach((task) => {
    const bySection = new Map<string, AssignmentField[]>();
    task.fields.filter((field) => !field.hiddenInGroup && field.sourceSectionKey).forEach((field) => {
      const list = bySection.get(field.sourceSectionKey!) ?? [];
      list.push(field);
      bySection.set(field.sourceSectionKey!, list);
    });
    REFERENCES.forEach((code) => {
      const parts = referenceParts(code);
      if (!parts || parts.taskKey !== task.key) return;
      const fields = bySection.get(parts.sectionKey);
      if (fields?.length) map.set(code, { stageKey: parts.stageKey, task, fields });
    });
  });
  return map;
}

export function resolveTarget(code: string, tail: string, index: Map<string, SectionEntry>, answersByStage: SavedAnswersByStage): RecallTarget | undefined {
  const entry = index.get(code);
  if (!entry) return undefined;
  const qualifier = extractQualifier(tail);
  const candidates = pickCandidateFields(entry.fields, qualifier);
  const field = resolveField(candidates, answersByStage[entry.stageKey] ?? {});
  const numbers = getQuestionNumbers(entry.task.fields);
  return { code, stageKey: entry.stageKey, task: entry.task, fieldKey: field?.key, questionNumber: field ? numbers[field.key] : undefined };
}

export function RecallText({ text, tasks, answersByStage, currentTaskKey, className }: { text: string; tasks: TaskWithFields[]; answersByStage: SavedAnswersByStage; currentTaskKey?: string; className?: string }) {
  const [selected, setSelected] = useState<RecallTarget>();
  const index = useMemo(() => buildSectionIndex(tasks), [tasks]);
  return <span className={className}>{textWithReferences(normalizeLocalReferences(text, currentTaskKey), (code, tail) => resolveTarget(code, tail, index, answersByStage), setSelected)}{selected && <AnswerDialog target={selected} answers={answersByStage[selected.stageKey] ?? {}} onClose={() => setSelected(undefined)} />}</span>;
}

export default function RecallMarkdown({ markdown, tasks, answersByStage, currentTaskKey }: Props & { currentTaskKey?: string }) {
  const [selected, setSelected] = useState<RecallTarget>();
  const index = useMemo(() => buildSectionIndex(tasks), [tasks]);
  const resolve = (code: string, tail: string) => resolveTarget(code, tail, index, answersByStage);
  const components = {
    p: ({ children }: { children?: ReactNode }) => <p>{renderChildren(children, resolve, setSelected)}</p>,
    li: ({ children }: { children?: ReactNode }) => <li>{renderChildren(children, resolve, setSelected)}</li>,
    blockquote: ({ children }: { children?: ReactNode }) => <blockquote>{renderChildren(children, resolve, setSelected)}</blockquote>,
    strong: ({ children }: { children?: ReactNode }) => <strong>{renderChildren(children, resolve, setSelected)}</strong>,
    em: ({ children }: { children?: ReactNode }) => <em>{renderChildren(children, resolve, setSelected)}</em>,
  };
  return <><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{normalizeLocalReferences(markdown, currentTaskKey)}</ReactMarkdown>{selected && <AnswerDialog target={selected} answers={answersByStage[selected.stageKey] ?? {}} onClose={() => setSelected(undefined)} />}</>;
}
