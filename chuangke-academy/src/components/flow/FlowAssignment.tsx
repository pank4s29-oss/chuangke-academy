"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssignmentField, TaskWithFields } from "@/lib/content/taskSections";
import { getQuestionNumbers } from "@/lib/content/questionNumbers";
import { fieldsToCanonical } from "@/lib/content/questions";
import QuestionRenderer from "../QuestionRenderer";
import RecallPanel from "../RecallPanel";
import type { RecallConfig } from "@/lib/content/recallSettings";

type Answers = Record<string, string | string[]>;
type Props = {
  stageKey: string;
  fields: AssignmentField[];
  allFields?: AssignmentField[];
  answers: Answers;
  onChange: (key: string, value: string | string[]) => void;
  onOtherChange: (key: string, value: string) => void;
  showErrors: boolean;
  recallTasks?: TaskWithFields[];
  answersByStage?: Record<string, Answers>;
  recallConfigMap?: Record<string, RecallConfig>;
};

function complete(field: AssignmentField, value: string | string[] | undefined) {
  if (field.required === false) return true;
  return field.type === "checkboxes"
    ? Array.isArray(value) ? value.length > 0 : Boolean(value)
    : String(value ?? "").trim().length > 0;
}

export default function FlowAssignment({
  fields,
  allFields,
  answers,
  onChange,
  onOtherChange,
  showErrors,
  recallTasks = [],
  answersByStage = {},
  recallConfigMap = {},
}: Props) {
  const visible = fields.filter((field) => !field.hiddenInGroup);
  const [active, setActive] = useState(0);
  const questionNumbers = useMemo(() => getQuestionNumbers(allFields ?? visible), [allFields, visible]);
  const current = visible[Math.min(active, Math.max(0, visible.length - 1))];

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  if (!current) return <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">這個任務目前沒有可作答欄位。</p>;

  const question = fieldsToCanonical([current])[0];
  const isDone = complete(current, answers[current.key]);
  const answered = visible.filter((field) => complete(field, answers[field.key])).length;
  const recallConfig = recallConfigMap[current.key];

  return (
    <section className="rounded-2xl border border-teal-100 bg-[#fbfdfb] p-4 shadow-sm sm:p-6" aria-label="引導式作答">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-teal-100 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">一頁一件事</p>
          <p className="mt-1 text-sm text-slate-500">第 {active + 1} / {visible.length} 題</p>
        </div>
        <p className="text-sm font-semibold text-teal-800">{answered} / {visible.length} 已完成</p>
      </div>
      <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-slate-200/80 sm:p-5">
        <div className="flex gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-700 ring-1 ring-teal-100">{questionNumbers[current.key]}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-7 text-slate-800">{current.prompt || "請完成這一題"}</h3>
            {current.description && <p className="mt-1 text-sm leading-6 text-slate-500">{current.description}</p>}
            {current.type === "checkboxes" && <p className="mt-1 text-xs text-slate-500">{current.multiple ? "可複選" : "請選一項"}{current.required === false ? " · 選填" : ""}</p>}
            <div className="mt-4">
              <QuestionRenderer
                question={question}
                questionNumbers={questionNumbers}
                value={answers[current.key] ?? ""}
                otherValues={answers}
                onOtherChange={onOtherChange}
                onChange={(value) => onChange(current.key, value)}
              />
            </div>
            {showErrors && !isDone && <p className="mt-3 text-sm text-amber-700">尚未填寫；不影響保存，你可以稍後補上。</p>}
          </div>
        </div>
        {recallConfig?.enabled && <div className="mt-4 border-t border-slate-100 pt-4"><RecallPanel targets={recallConfig.targets} tasks={recallTasks} answersByStage={answersByStage} /></div>}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setActive((index) => Math.max(0, index - 1))} disabled={active === 0} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">← 上一題</button>
        <div className="flex gap-2">
          {active < visible.length - 1 ? <button type="button" onClick={() => setActive((index) => Math.min(visible.length - 1, index + 1))} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">下一題 →</button> : <span className="rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800">本任務題目已走完</span>}
        </div>
      </div>
    </section>
  );
}
