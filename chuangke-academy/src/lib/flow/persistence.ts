import type { Answers, FlowDocument } from "./schema";

export type FlowStorageState = { answers: Answers; page: number; mode: string; edited: string[] };
export type SubmissionRow = { stage_key: string; task_key: string; answer_json: unknown };

export function taskKeyForPage(pageId: string) {
  if (pageId === "p.open") return "stage-01-open";
  if (pageId.startsWith("p.t1.")) return "stage-01-1";
  if (pageId === "p.t3") return "stage-01-3";
  if (pageId === "p.blueprint") return "stage-01-appendix";
  return "stage-01-flow";
}

function isAnswer(value: unknown): value is Answers[string] {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || Array.isArray(value);
}

export function parseStoredState(raw: string | null): FlowStorageState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FlowStorageState>;
    if (!value.answers || typeof value.answers !== "object") return null;
    return { answers: value.answers as Answers, page: Number.isFinite(value.page) ? Number(value.page) : 0, mode: value.mode ?? "self_study", edited: Array.isArray(value.edited) ? value.edited : [] };
  } catch {
    return null;
  }
}

export function mergeSubmissionAnswers(document: FlowDocument, rows: SubmissionRow[]) {
  const merged: Answers = {};
  for (const row of rows) {
    if (!row.answer_json || typeof row.answer_json !== "object" || Array.isArray(row.answer_json)) continue;
    for (const [key, value] of Object.entries(row.answer_json as Record<string, unknown>)) if (key !== "_flow" && isAnswer(value)) merged[key] = value;
  }
  for (const [legacyKey, semanticKey] of Object.entries(document.legacyKeyMap)) {
    if (merged[semanticKey] === undefined && merged[legacyKey] !== undefined) merged[semanticKey] = merged[legacyKey];
  }
  return merged;
}

export function scopedAnswers(document: FlowDocument, answers: Answers, pageId: string) {
  const taskKey = taskKeyForPage(pageId);
  const prefix = pageId.startsWith("p.t1.") ? "stage1.t1." : pageId === "p.t3" ? "stage1.t3." : pageId === "p.open" ? "stage1.open." : "";
  const scoped: Answers = {};
  for (const [key, value] of Object.entries(answers)) if (!key.startsWith("_flow") && (!prefix || key.startsWith(prefix))) scoped[key] = value;
  for (const [legacyKey, semanticKey] of Object.entries(document.legacyKeyMap)) if (semanticKey in scoped && answers[legacyKey] !== undefined) scoped[legacyKey] = answers[legacyKey];
  return { taskKey, answers: scoped };
}

export function flowMeta(page: number, mode: string, edited: string[] = []) { return { _flow: { page, mode, edited } }; }
