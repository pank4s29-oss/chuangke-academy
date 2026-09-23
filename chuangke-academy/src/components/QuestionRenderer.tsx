"use client";

import type { CanonicalQuestion } from "@/lib/content/questions";
import type { TaskWithFields } from "@/lib/content/taskSections";
import { RecallText } from "./RecallMarkdown";
import type { RecallTargetOverride } from "@/lib/content/recallOverrides";

type Props = { question: CanonicalQuestion; questionNumbers?: Record<string, number>; value: string | string[]; onChange: (value: string | string[]) => void; otherValues?: Record<string, string | string[]>; onOtherChange?: (key: string, value: string) => void; showError?: boolean; recallTasks?: TaskWithFields[]; answersByStage?: Record<string, Record<string, string | string[]>>; currentTaskKey?: string; recallOverrides?: RecallTargetOverride[] };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export default function QuestionRenderer({ question, questionNumbers = {}, value, onChange, otherValues = {}, onOtherChange, showError, recallTasks = [], answersByStage = {}, currentTaskKey, recallOverrides = [] }: Props) {
  const recall = (text: string) => recallTasks.length ? <RecallText text={text} tasks={recallTasks} answersByStage={answersByStage} currentTaskKey={currentTaskKey} recallOverrides={recallOverrides} /> : text;
  if (question.type === "single_choice" || question.type === "multi_choice") {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    const multiple = question.type === "multi_choice";
    return <fieldset className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="sr-only">{recall(question.label)}</legend>{question.options?.map((option) => {
      const inputId = `${question.id}-${option.id}`;
      const isSelected = selected.includes(option.id);
      return <div key={option.id} className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm leading-6 transition ${isSelected ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-white text-slate-700 hover:border-teal-200"}`}>
        <input id={inputId} className="peer sr-only" type={multiple ? "checkbox" : "radio"} name={question.id} checked={isSelected} onChange={(event) => { if (!multiple) onChange(event.currentTarget.checked ? option.id : ""); else onChange(event.currentTarget.checked ? [...selected, option.id] : selected.filter((item) => item !== option.id)); }} />
        <span aria-hidden="true" className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-teal-400 peer-focus-visible:ring-offset-1 ${multiple ? "rounded-md" : "rounded-full"} ${isSelected ? "border-teal-600 bg-white" : "border-slate-300 bg-white"}`}>
          {isSelected && (multiple ? <span className="text-[11px] font-black leading-none text-teal-600">✓</span> : <span className="h-2 w-2 rounded-full bg-teal-600" />)}
        </span>
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">{recall(option.label)}</label>
        {option.otherInputKey && isSelected && <input className="mt-2 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-100" aria-label={`${option.label}補充內容`} placeholder="請填寫其他內容" value={String(otherValues[option.otherInputKey] ?? "")} onChange={(event) => onOtherChange?.(option.otherInputKey!, event.target.value)} />}
      </div>;
    })}</fieldset>;
  }
  if (question.type === "long_text") return <textarea className={`${inputClass} mt-3 min-h-32 resize-y`} placeholder="請在這裡填寫完整答案…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  return <input className={`${inputClass} mt-3`} placeholder="請填寫答案…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
}

function circledNumber(number: number) {
  const circled = "⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  return number <= 20 ? circled[number] : `第 ${number} 題`;
}

function CompletionLabel({ label, questionNumbers }: { label: string; questionNumbers: Record<string, number> }) {
  const target: Record<string, string> = { "1-A": "stage-01-1-answer-3", "1-B": "stage-01-1-answer-11", "1-C": "stage-01-1-answer-14" };
  const parts = label.split(/(1-[ABC])/g);
  return <>{parts.map((part, index) => { const id = target[part]; const number = id ? questionNumbers[id] : undefined; return id ? <a key={`${part}-${index}`} href={`#field-${id}`} className="font-bold text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900" onClick={(event) => event.stopPropagation()}>{number ? circledNumber(number) : part}</a> : <span key={`${part}-${index}`}>{part}</span>; })}</>;
}
