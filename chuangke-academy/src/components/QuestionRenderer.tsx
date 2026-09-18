"use client";

import type { CanonicalQuestion } from "@/lib/content/questions";

type Props = { question: CanonicalQuestion; value: string | string[]; onChange: (value: string | string[]) => void; showError?: boolean };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

export default function QuestionRenderer({ question, value, onChange, showError }: Props) {
  if (question.type === "single_choice" || question.type === "multi_choice") {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    const multiple = question.type === "multi_choice";
    return <fieldset className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="sr-only">{question.label}</legend>{question.options?.map((option) => <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm leading-6 transition ${selected.includes(option.id) ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-white text-slate-700 hover:border-teal-200"}`}><input className="mt-1 h-4 w-4 shrink-0 accent-teal-600" type={multiple ? "checkbox" : "radio"} name={question.id} checked={selected.includes(option.id)} onChange={(event) => { if (!multiple) onChange(event.target.checked ? [option.id] : []); else onChange(event.target.checked ? [...selected, option.id] : selected.filter((item) => item !== option.id)); }} />{option.label}</label>)}</fieldset>;
  }
  if (question.type === "long_text") return <textarea className={`${inputClass} mt-3 min-h-32 resize-y`} placeholder="請在這裡填寫完整答案…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  return <input className={`${inputClass} mt-3`} placeholder="請填寫答案…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
}
