import type { Question } from "./schema";
export function validate(value: unknown, question: Question) { const text=String(value??"").trim(); return [...(question.required&&!text?["此題為必填。"]:[]),...(question.rules??[]).flatMap(rule=>rule.type==="min_length"&&text.length<(rule.value??0)?[rule.message]:[])]; }
