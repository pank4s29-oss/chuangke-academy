"use client";

import type { AssignmentField } from "@/lib/content/taskSections";
import { getQuestionNumbers } from "@/lib/content/questionNumbers";
import { fieldsToCanonical } from "@/lib/content/questions";
import QuestionRenderer from "./QuestionRenderer";

type Answers = Record<string, string | string[]>;
type Props = { fields: AssignmentField[]; answers: Answers; onChange: (key: string, value: string | string[]) => void; onOtherChange: (key: string, value: string) => void; showErrors: boolean };
type Block = { kind: "field"; field: AssignmentField } | { kind: "group"; group: string; fields: AssignmentField[] } | { kind: "table"; group: string; fields: AssignmentField[] };

function complete(field: AssignmentField, value: string | string[] | undefined) {
  if (field.required === false) return true;
  return field.type === "checkboxes" ? Array.isArray(value) ? value.length > 0 : Boolean(value) : String(value ?? "").trim().length > 0;
}

function Cell({ field, answers, onChange, onOtherChange, showErrors, questionNumbers }: { field: AssignmentField; answers: Answers; onChange: Props["onChange"]; onOtherChange: Props["onOtherChange"]; showErrors: boolean; questionNumbers: Record<string, number> }) {
  const question = fieldsToCanonical([field])[0];
  return <><QuestionRenderer question={question} questionNumbers={questionNumbers} value={answers[field.key] ?? ""} otherValues={answers} onOtherChange={onOtherChange} onChange={(value) => onChange(field.key, value)} />{showErrors && !complete(field, answers[field.key]) && <p className="mt-1 text-xs text-rose-600">請填寫</p>}</>;
}

function TableBlock({ group, fields, answers, onChange, onOtherChange, showErrors, questionNumbers }: { group: string; fields: AssignmentField[]; answers: Answers; onChange: Props["onChange"]; onOtherChange: Props["onOtherChange"]; showErrors: boolean; questionNumbers: Record<string, number> }) {
  const columns = [...new Set(fields.map((field) => field.tableColumn ?? "答案"))];
  const rows = [...new Set(fields.map((field) => field.tableRow ?? field.prompt))];
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-700"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-white text-xs text-teal-700 ring-1 ring-slate-200">{questionNumbers[fields[0]?.key]}</span>{group}</div>
    <div className="hidden overflow-hidden md:block"><table className="w-full table-fixed border-collapse text-sm"><thead><tr><th className="w-[24%] border-b border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-500">題目</th>{columns.map((column) => <th key={column} className="border-b border-slate-200 px-3 py-3 text-left font-semibold leading-5 text-slate-500">{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row} className="align-top odd:bg-slate-50/50"><th className="border-r border-slate-200 px-4 py-4 text-left font-semibold leading-6 text-slate-700">{row}</th>{columns.map((column) => { const field = fields.find((item) => (item.tableRow ?? item.prompt) === row && (item.tableColumn ?? "答案") === column); if (!field) return <td key={column} className="border-slate-200 px-3 py-4 text-slate-300">—</td>; return <td key={column} className="px-3 py-3 align-top"><Cell field={field} answers={answers} onChange={onChange} onOtherChange={onOtherChange} showErrors={showErrors} questionNumbers={questionNumbers} /></td>; })}</tr>)}</tbody></table></div>
    <div className="space-y-3 p-3 md:hidden">{rows.map((row) => <article key={row} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><h3 className="font-semibold leading-6 text-slate-800">{row}</h3><div className="mt-3 space-y-3">{columns.map((column) => { const field = fields.find((item) => (item.tableRow ?? item.prompt) === row && (item.tableColumn ?? "答案") === column); if (!field) return null; return <div key={column} className="rounded-lg bg-white p-3 ring-1 ring-slate-200/70"><p className="mb-2 text-xs font-semibold leading-5 text-slate-500">{column}</p><Cell field={field} answers={answers} onChange={onChange} onOtherChange={onOtherChange} showErrors={showErrors} questionNumbers={questionNumbers} /></div>; })}</div></article>)}</div>
  </section>;
}

function GroupBlock({ group, fields, answers, onChange, onOtherChange, showErrors, questionNumbers }: { group: string; fields: AssignmentField[]; answers: Answers; onChange: Props["onChange"]; onOtherChange: Props["onOtherChange"]; showErrors: boolean; questionNumbers: Record<string, number> }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="border-b border-slate-100 pb-3 text-base font-bold leading-7 text-slate-800"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-slate-50 text-xs text-teal-700 ring-1 ring-slate-200">{questionNumbers[fields[0]?.key]}</span>{group}</h3><div className="mt-4 space-y-4">{fields.map((field) => { const question = fieldsToCanonical([field])[0]; return <div id={`field-${field.key}`} key={field.key} className="min-w-0 rounded-xl bg-slate-50/70 p-3 sm:p-4"><label className="block text-sm font-semibold leading-6 text-slate-700">{field.prompt || "請完成這一題"}<span className="ml-2 text-xs font-normal text-slate-400">{field.required === false ? "選填" : ""}</span></label>{field.description && <p className="mt-1 text-sm leading-6 text-slate-500">{field.description}</p>}{field.type === "checkboxes" && <p className="mt-1 text-xs text-slate-500">{field.multiple ? "可複選" : "請選一項"}</p>}<QuestionRenderer question={question} questionNumbers={questionNumbers} value={answers[field.key] ?? ""} otherValues={answers} onOtherChange={onOtherChange} onChange={(value) => onChange(field.key, value)} />{showErrors && !complete(field, answers[field.key]) && <p className="mt-2 text-sm text-rose-600">請完成這個欄位，或先保存進度稍後繼續。</p>}</div>; })}</div></section>;
}

function blocksFromFields(fields: AssignmentField[]): Block[] {
  const blocks: Block[] = [];
  const tableBlockByGroup = new Map<string, Extract<Block, { kind: "table" }>>();
  const fieldGroupByGroup = new Map<string, Extract<Block, { kind: "group" }>>();
  fields.forEach((field) => {
    if (field.layout !== "table") { blocks.push({ kind: "field", field }); return; }
    const group = field.group ?? "表格作答";
    let block = tableBlockByGroup.get(group);
    if (!block) { block = { kind: "table", group, fields: [] }; tableBlockByGroup.set(group, block); blocks.push(block); }
    block.fields.push(field);
  });
  const grouped: Block[] = [];
  blocks.forEach((block) => {
    if (block.kind !== "field" || !/^stage-02-2-2-/.test(block.field.key) || !/^第 [1-3] 格：/.test(block.field.group ?? "")) { grouped.push(block); return; }
    const group = block.field.group!;
    let target = fieldGroupByGroup.get(group);
    if (!target) { target = { kind: "group", group, fields: [] }; fieldGroupByGroup.set(group, target); grouped.push(target); }
    target.fields.push(block.field);
  });
  return grouped;
}

export default function AssignmentTable({ fields, answers, onChange, onOtherChange, showErrors }: Props) {
  const questionNumbers = getQuestionNumbers(fields);
  return <div className="min-w-0 space-y-5">{blocksFromFields(fields).map((block) => {
    if (block.kind === "table") return <TableBlock key={`table-${block.group}`} group={block.group} fields={block.fields} answers={answers} onChange={onChange} onOtherChange={onOtherChange} showErrors={showErrors} questionNumbers={questionNumbers} />;
    if (block.kind === "group") return <GroupBlock key={`group-${block.group}`} group={block.group} fields={block.fields} answers={answers} onChange={onChange} onOtherChange={onOtherChange} showErrors={showErrors} questionNumbers={questionNumbers} />;
    const field = block.field;
    const question = fieldsToCanonical([field])[0];
    return <div id={`field-${field.key}`} key={field.key} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"><div className="flex min-w-0 gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-teal-700 ring-1 ring-slate-200">{questionNumbers[field.key]}</span><div className="min-w-0 flex-1"><label className="block text-[15px] font-semibold leading-7 text-slate-800">{field.prompt || "請完成這一題"}<span className="ml-2 text-xs font-normal text-slate-400">{field.required === false ? "選填" : ""}</span></label>{field.description && <p className="mt-1 text-sm leading-6 text-slate-500">{field.description}</p>}{field.type === "checkboxes" && <p className="mt-1 text-xs text-slate-500">{field.multiple ? "可複選" : "請選一項"}</p>}<QuestionRenderer question={question} questionNumbers={questionNumbers} value={answers[field.key] ?? ""} otherValues={answers} onOtherChange={onOtherChange} onChange={(value) => onChange(field.key, value)} />{showErrors && !complete(field, answers[field.key]) && <p className="mt-2 text-sm text-amber-700">尚未填寫；不影響提交，可稍後補上。</p>}</div></div></div>;
  })}</div>;
}
