"use client";

import type { CanonicalQuestion } from "@/lib/content/questions";

type Props = { question: CanonicalQuestion; value: string | string[]; onChange: (value: string | string[]) => void; otherValues?: Record<string, string | string[]>; onOtherChange?: (key: string, value: string) => void; showError?: boolean };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export default function QuestionRenderer({ question, value, onChange, otherValues = {}, onOtherChange, showError }: Props) {
  if (question.type === "single_choice" || question.type === "multi_choice") {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    const multiple = question.type === "multi_choice";
    return <fieldset className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="sr-only">{question.label}</legend>{question.options?.map((option) => <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm leading-6 transition ${selected.includes(option.id) ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-white text-slate-700 hover:border-teal-200"}`}><input className="mt-1 h-4 w-4 shrink-0 accent-teal-600" type={multiple ? "checkbox" : "radio"} name={question.id} checked={selected.includes(option.id)} onChange={(event) => { if (!multiple) onChange(event.target.checked ? [option.id] : []); else onChange(event.target.checked ? [...selected, option.id] : selected.filter((item) => item !== option.id)); }} /><span className="min-w-0 flex-1">{question.id === "stage-01-1-answer-17" ? <CompletionLabel label={option.label} /> : option.label}{option.otherInputKey && selected.includes(option.id) && <input className="mt-2 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-100" aria-label={`${option.label}補充內容`} placeholder="請填寫其他內容" value={String(otherValues[option.otherInputKey] ?? "")} onChange={(event) => onOtherChange?.(option.otherInputKey!, event.target.value)} />}</span></label>)}</fieldset>;
  }
  if (question.type === "long_text") return <textarea className={`${inputClass} mt-3 min-h-32 resize-y`} placeholder="請在這裡填寫完整答案…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  return <input className={`${inputClass} mt-3`} placeholder="請填寫答案…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
}

function CompletionLabel({ label }: { label: string }) {
  const target: Record<string, string> = { "1-A": "stage-01-1-answer-3", "1-B": "stage-01-1-answer-11", "1-C": "stage-01-1-answer-14" };
  const parts = label.split(/(1-[ABC])/g);
  return <>{parts.map((part, index) => { const id = target[part]; return id ? <a key={`${part}-${index}`} href={`#field-${id}`} className="font-bold text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900" onClick={(event) => event.stopPropagation()}>{part}</a> : <span key={`${part}-${index}`}>{part}</span>; })}</>;
}
