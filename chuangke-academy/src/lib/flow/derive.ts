import type { Answers, FlowDocument } from "./schema";

const text = (value: unknown) => Array.isArray(value) ? value.join("、") : (value && typeof value === "object" ? Object.values(value).join("、") : String(value ?? ""));
const clean = (value: unknown) => text(value).replace(/\s/g, "");
export function deriveValue(op: string, inputs: string[], answers: Answers, args: Record<string, unknown> = {}) {
  const values = inputs.map((key) => answers[key]);
  switch (op) {
    case "template": return String(args.template ?? "").replace(/\{\{([^}]+)\}\}/g, (_, key) => text(answers[String(key).trim()]) || String(args.blank ?? "＿＿"));
    case "joinNonEmpty": return values.map(text).filter(Boolean).join(String(args.separator ?? "，")) + (values.some(Boolean) ? String(args.end ?? "") : "");
    case "firstNonEmpty": return values.map(text).find(Boolean) ?? "";
    case "countEquals": return values.filter((value) => text(value) === String(args.equals ?? "是")).length;
    case "countItems": return values.flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).length;
    case "charCount": { const value = clean(values[0]); const max = Number(args.max ?? 0); return { value, count: value.length, ok: !max || value.length <= max }; }
    case "regexAbsent": { const value = text(values[0]); const regex = new RegExp(String(args.pattern ?? "學會")); return { value, ok: !regex.test(value) }; }
    case "mapJoin": return values.flatMap((value) => Array.isArray(value) ? value : [value]).map((item) => String((args.map as Record<string, string> | undefined)?.[String(item)] ?? item)).filter(Boolean).join(String(args.separator ?? "、"));
    case "format": return String(args.template ?? "").replace(/\{\{([^}]+)\}\}/g, (_, key) => text(answers[String(key).trim()]));
    case "band": { const score = Number(values[0] ?? 0); const bands = (args.bands as Array<{ max: number; label: string; detail?: string }> | undefined) ?? []; return bands.find((band) => score <= band.max) ?? bands.at(-1) ?? { label: "", detail: "" }; }
    case "whereAny": return inputs.filter((key) => { const value = text(answers[key]); const includes = (args.includes as Record<string, string[]> | undefined)?.[key] ?? []; return !value || includes.some((item) => value.includes(item)); });
    default: return values[0] ?? "";
  }
}
export function deriveAll(document: FlowDocument, answers: Answers) {
  const output: Record<string, unknown> = {};
  for (const [id, rule] of Object.entries(document.derived)) {
    const mergedAnswers: Answers = { ...answers };
    for (const [key, value] of Object.entries(output)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || Array.isArray(value)) mergedAnswers[key] = value as string | number | boolean | string[];
    }
    output[id] = deriveValue(rule.op, rule.inputs, mergedAnswers, rule.args);
  }
  return output;
}
export function getAnswer(answers: Answers, derived: Record<string, unknown>, key?: string) { return key && key in derived ? derived[key] : key ? answers[key] : ""; }
