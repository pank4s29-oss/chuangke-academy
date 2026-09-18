"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Question, Stage } from "@/lib/content/schema";
import { validate } from "@/lib/content/rules";

type Answers = Record<string, string | string[]>;

type Props = { stage: Stage; courseKey: string };

function questionCount(stage: Stage) {
  return stage.tasks.reduce((total, task) => total + task.steps.reduce((sum, step) => sum + step.questions.length, 0), 0);
}

function allQuestions(stage: Stage) {
  return stage.tasks.flatMap((task) => task.steps.flatMap((step) => step.questions));
}

function QuestionField({ question, value, onChange }: { question: Question; value: Answers[string]; onChange: (value: string | string[]) => void }) {
  const common = "mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
  if (question.type === "textarea") {
    return <textarea className={`${common} min-h-32 resize-y`} placeholder="把你的真實答案寫在這裡…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  }
  if (question.type === "number") {
    return <input className={common} inputMode="numeric" type="number" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
  }
  if (question.type === "checkbox") {
    const checked = value === "checked";
    return <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input className="h-5 w-5 accent-teal-600" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked ? "checked" : "")} />我已完成這個小練習</label>;
  }
  return <input className={common} placeholder="輸入你的答案…" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
}

export default function StageWorkspace({ stage, courseKey }: Props) {
  const storageKey = `chuangke:${courseKey}:${stage.key}:answers`;
  const questions = useMemo(() => allQuestions(stage), [stage]);
  const [answers, setAnswers] = useState<Answers>({});
  const [activeTask, setActiveTask] = useState(0);
  const [mode, setMode] = useState<"learn" | "practice">("learn");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setAnswers(JSON.parse(stored) as Answers);
    } catch { /* localStorage unavailable: the workspace remains usable */ }
  }, [storageKey]);

  const completed = questions.filter((question) => validate(answers[question.key], question).length === 0).length;
  const percent = questions.length ? Math.round((completed / questions.length) * 100) : 0;
  const task = stage.tasks[activeTask];

  function updateAnswer(key: string, value: string | string[]) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setSavedAt(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
    } catch { /* keep in-memory state */ }
  }

  function errors(question: Question) {
    return showErrors ? validate(answers[question.key], question) : [];
  }

  return (
    <div className="min-h-screen bg-[#f5f7f4] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/app" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-sm font-bold text-white">創</span><span className="font-semibold tracking-tight">創客學院</span></Link>
          <div className="flex items-center gap-4 text-sm text-slate-500"><span>{savedAt ? `已儲存 ${savedAt}` : "尚未開始作答"}</span><Link href="/app" className="font-medium text-teal-700 hover:text-teal-900">返回課程</Link></div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">學習路徑</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{stage.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{stage.summary}</p>
          <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"><div className="flex items-end justify-between"><span className="text-sm font-medium">完成度</span><strong className="text-xl text-teal-700">{percent}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-slate-500">{completed} / {questions.length} 題完成</p></div>
          <nav className="mt-6 space-y-2" aria-label="作業任務">
            {stage.tasks.map((item, index) => <button key={item.key} onClick={() => setActiveTask(index)} className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${index === activeTask ? "bg-teal-700 font-semibold text-white shadow-sm" : "bg-white text-slate-600 hover:bg-teal-50"}`}><span className="block text-xs opacity-70">任務 {index + 1}</span><span className="mt-1 block">{item.title}</span></button>)}
          </nav>
        </aside>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-teal-700">任務 {activeTask + 1} / {stage.tasks.length}</p><h2 className="mt-1 text-3xl font-bold tracking-tight">{task.title}</h2></div><div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200/70"><button onClick={() => setMode("learn")} className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "learn" ? "bg-slate-900 text-white" : "text-slate-500"}`}>先理解</button><button onClick={() => setMode("practice")} className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "practice" ? "bg-teal-700 text-white" : "text-slate-500"}`}>開始作業</button></div></div>
          {mode === "learn" ? <div className="mt-8 space-y-5">{task.steps.map((step, index) => <article key={step.key} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:p-8"><div className="flex gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">{index + 1}</span><div><h3 className="text-xl font-semibold">{step.title}</h3><div className="mt-4 space-y-3 text-[15px] leading-7 text-slate-600">{step.learning.map((line) => <p key={line}>{line}</p>)}</div></div></div></article>)}<button onClick={() => setMode("practice")} className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-teal-800">我理解了，開始作業 →</button></div> : <div className="mt-8 space-y-5">{task.steps.map((step) => <article key={step.key} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:p-8"><h3 className="text-xl font-semibold">{step.title}</h3><div className="mt-6 space-y-7">{step.questions.map((question) => <div key={question.key}><label className="block text-[15px] font-semibold leading-6">{question.label}{question.required && <span className="ml-1 text-rose-500">*</span>}</label><QuestionField question={question} value={answers[question.key] ?? ""} onChange={(value) => updateAnswer(question.key, value)} />{errors(question).map((error) => <p className="mt-2 text-sm text-rose-600" key={error}>{error}</p>)}</div>)}</div></article>)}<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="text-sm text-teal-900">答案會先保存在這台裝置，之後接上 Supabase 登入即可跨裝置同步。</p><button onClick={() => { setShowErrors(true); if (completed === questions.length) setMode("learn"); }} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">檢查這份作業</button></div></div>}
        </section>
      </main>
    </div>
  );
}

export { questionCount };
