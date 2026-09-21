"use client";

import type { AssignmentField } from "@/lib/content/taskSections";
import { fieldsToCanonical } from "@/lib/content/questions";
import QuestionRenderer from "./QuestionRenderer";

type Answers = Record<string, string | string[]>;
type Props = { fields: AssignmentField[]; answers: Answers; onChange: (key: string, value: string | string[]) => void; onOtherChange: (key: string, value: string) => void; showErrors: boolean };
type Block = { kind: "field"; field: AssignmentField } | { kind: "table"; group: string; fields: AssignmentField[] };

function complete(field: AssignmentField, value: string | string[] | undefined) {
  return field.type === "checkboxes" ? Array.isArray(value) ? value.length > 0 : Boolean(value) : String(value ?? "").trim().length > 0;
}

function TableBlock({ group, fields, answers, onChange, onOtherChange, showErrors }: { group: string; fields: AssignmentField[]; answers: Answers; onChange: Props["onChange"]; onOtherChange: Props["onOtherChange"]; showErrors: boolean }) {
  const columns = [...new Set(fields.map((field) => field.tableColumn ?? "答案"))];
  const rows = [...new Set(fields.map((field) => field.tableRow ?? field.prompt))];
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-700">{group}</div><div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead><tr><th className="border-b border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-500">題目</th>{columns.map((column) => <th key={column} className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-500">{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row} className="align-top odd:bg-slate-50/50"><th className="border-r border-slate-200 px-4 py-4 text-left font-semibold leading-6 text-slate-700">{row}</th>{columns.map((column) => { const field = fields.find((item) => (item.tableRow ?? item.prompt) === row && (item.tableColumn ?? "答案") === column); if (!field) return <td key={column} className="border-slate-200 px-4 py-4 text-slate-300">—</td>; const question = fieldsToCanonical([field])[0]; return <td key={column} className="min-w-52 px-3 py-3"><QuestionRenderer question={question} value={answers[field.key] ?? ""} otherValues={answers} onOtherChange={onOtherChange} onChange={(value) => onChange(field.key, value)} />{showErrors && !complete(field, answers[field.key]) && <p className="mt-1 text-xs text-rose-600">請填寫</p>}</td>; })}</tr>)}</tbody></table></div></section>;
}

function blocksFromFields(fields: AssignmentField[]): Block[] {
  const blocks: Block[] = [];
  const tableBlockByGroup = new Map<string, Extract<Block, { kind: "table" }>>();
  fields.forEach((field) => {
    if (field.layout !== "table") { blocks.push({ kind: "field", field }); return; }
    const group = field.group ?? "表格作答";
    let block = tableBlockByGroup.get(group);
    if (!block) { block = { kind: "table", group, fields: [] }; tableBlockByGroup.set(group, block); blocks.push(block); }
    block.fields.push(field);
  });
  return blocks;
}

export default function AssignmentTable({ fields, answers, onChange, onOtherChange, showErrors }: Props) {
  return <div className="space-y-6">{blocksFromFields(fields).map((block) => {
    if (block.kind === "table") return <TableBlock key={`table-${block.group}`} group={block.group} fields={block.fields} answers={answers} onChange={onChange} onOtherChange={onOtherChange} showErrors={showErrors} />;
    const field = block.field;
    const question = fieldsToCanonical([field])[0];
    return <div key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5"><div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-teal-700 ring-1 ring-slate-200">{fields.indexOf(field) + 1}</span><div className="min-w-0 flex-1"><label className="block text-[15px] font-semibold leading-7 text-slate-800">{field.prompt || "請完成這一題"}</label>{field.description && <p className="mt-1 text-sm leading-6 text-slate-500">{field.description}</p>}{field.type === "checkboxes" && <p className="mt-1 text-xs text-slate-500">{field.multiple ? "可複選" : "請選一項"}</p>}<QuestionRenderer question={question} value={answers[field.key] ?? ""} otherValues={answers} onOtherChange={onOtherChange} onChange={(value) => onChange(field.key, value)} />{showErrors && !complete(field, answers[field.key]) && <p className="mt-2 text-sm text-rose-600">請完成這個欄位，或先保存進度稍後繼續。</p>}</div></div></div>;
  })}</div>;
}
