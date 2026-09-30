import { hasEmptySlot } from "./fieldState";
import type { AssignmentField } from "./taskSections";
type AnswerValue = string | string[] | undefined;

export type CompositionResult = { answers: Record<string, AnswerValue>; generated: string[] };

function text(value: AnswerValue | undefined) {
  return Array.isArray(value) ? value.join("、") : String(value ?? "").trim();
}

function optionText(field: AssignmentField | undefined, value: AnswerValue | undefined, labels: Record<string, string> = {}) {
  if (!field) return text(value);
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => {
    const raw = String(item);
    if (labels[raw]) return labels[raw];
    const exact = field.options?.find((option) => option.key === raw);
    if (exact) return exact.label;
    // Old drafts sometimes contain the positional option key even when the
    // field's option list was edited later: answer-N -> option-N-index.
    const fieldNumber = field.key.match(/-answer-(\d+)$/)?.[1];
    const optionIndex = raw.match(new RegExp(`-option-${fieldNumber ?? "\\d+"}-(\\d+)$`))?.[1];
    const byPosition = optionIndex === undefined ? undefined : field.options?.[Number(optionIndex)];
    return byPosition?.label ?? raw;
  }).filter(Boolean).join("、");
}

const SLOT_BLANK = "＿＿＿＿＿＿＿＿＿＿";
const isBlank = (v: string) => v.replace(/[＿_\s]/g, "") === "";

/** Option indexes picked in a checkbox field, in the order the learner picked them. */
function pickedIndexes(field: AssignmentField | undefined, value: AnswerValue | undefined): number[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const number = field?.key.match(/-answer-(\d+)$/)?.[1];
  return values.map((item) => {
    const raw = String(item);
    const exact = field?.options?.findIndex((option) => option.key === raw) ?? -1;
    if (exact >= 0) return exact;
    const pos = number === undefined ? undefined : raw.match(new RegExp(`-option-${number}-(\\d+)$`))?.[1];
    return pos === undefined ? -1 : Number(pos);
  }).filter((i) => i >= 0);
}

/** Labels of the picked options; an option with a "其他＿＿" box is replaced by what the learner typed there. */
function pickedTexts(field: AssignmentField | undefined, value: AnswerValue | undefined, answers: Record<string, AnswerValue>) {
  return pickedIndexes(field, value).map((i) => {
    const option = field?.options?.[i];
    const typed = option?.otherInputKey ? text(answers[option.otherInputKey]) : "";
    return typed || option?.label || "";
  }).filter(Boolean);
}

const taskPrefix = (field: AssignmentField) => field.key.replace(/-answer-\d+$/, "");

/**
 * Compose the sentence-shaped legacy fields while the learner is answering.
 * The rules key off stable field positions inside ONE task (never across tasks) and sentence wording,
 * so teacher-edited prompts do not break the important Stage 1 flow.
 *
 * `previous` = the answers before this change. With it, a field the learner wrote over by hand
 * (its value differs from what the system had generated) is left alone until it is cleared;
 * without it, the two original sentences (1-A, 三格串起來) are simply regenerated and the new
 * carry-over fields only fill in while empty.
 */
export function composeLegacyAnswers(fields: AssignmentField[], answers: Record<string, AnswerValue>, preserveKey?: string, previous?: Record<string, AnswerValue>): CompositionResult {
  // Snapshot run: what the system would have generated for the previous answers (nothing is written).
  const prevTargets = previous ? run(fields, previous, undefined, undefined, true).targets : undefined;
  const { out, generated } = run(fields, answers, preserveKey, prevTargets);
  return { answers: out, generated };
}

function run(fields: AssignmentField[], answers: Record<string, AnswerValue>, preserveKey: string | undefined, prevTargets: Record<string, string> | undefined, snapshot = false) {
  const out: Record<string, AnswerValue> = { ...answers };
  const generated: string[] = [];
  const targets: Record<string, string> = {};
  const F = new Map(fields.map((field) => [field.key, field]));
  const get = (task: number | string, n: number) => F.get(`stage-01-${task}-answer-${n}`);
  const position = (field: AssignmentField) => Number(field.key.match(/-answer-(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER);

  /** Set an automatic value. `always` = the original rules that regenerate even without a `previous` snapshot. */
  const set = (field: AssignmentField | undefined, value: string, always = false) => {
    if (!field) return;
    targets[field.key] = value;
    if (snapshot || field.key === preserveKey) return;
    const cur = text(out[field.key]);
    if (cur !== "" && cur !== value) {
      if (prevTargets) { if (cur !== prevTargets[field.key]) return; } // written over by hand → keep
      else if (!always) return;
    }
    out[field.key] = value;
    generated.push(field.key);
  };
  const eff = (field: AssignmentField | undefined) => (field ? text(out[field.key]) : "");

  // ---- 1-A ----
  const stage = get(1, 0), identity = get(1, 2), sentence = get(1, 3);
  const state = stage ? optionText(stage, answers[stage.key]) : "";
  const person = identity ? text(answers[identity.key]) : "";
  if (stage && identity && sentence) set(sentence, state || person ? `我服務的是【${state}】的【${person}】。` : "", true);

  // ---- 1-B「把三格串起來」: the three choice boxes right before it, inside the SAME task ----
  const quote = fields.find((field) => /把三格串起來/.test(field.prompt) || /把三格串起來/.test(field.description ?? ""));
  if (quote) {
    const preceding = fields.filter((field) => taskPrefix(field) === taskPrefix(quote) && position(field) < position(quote) && field.type === "checkboxes").slice(-3);
    if (preceding.length === 3) {
      const parts = preceding.map((field) => pickedTexts(field, answers[field.key], answers).join("、")).filter(Boolean);
      set(quote, parts.length ? `${parts.join("，")}。` : "", true);
    }
  }

  // ---- 1-B 步驟 3 / 1-C: sentence patterns (the slots are not separate fields in the legacy form) ----
  const patterns: Array<[RegExp, string]> = [
    [/^句型[：:]\s*我幫他解決的問題是/, `我幫他解決的問題是，從【${SLOT_BLANK}】，變成【${SLOT_BLANK}】。`],
    [/^句型[：:]\s*我以前也/, `我以前也【${SLOT_BLANK}】，後來我【${SLOT_BLANK}】。`],
    [/^句型[：:]\s*我有一套/, `我有一套【${SLOT_BLANK}】，專門解決【${SLOT_BLANK}】。`],
    [/^句型[：:]\s*我做過/, `我做過【${SLOT_BLANK}】，達成【${SLOT_BLANK}】。`],
  ];
  for (const field of fields) {
    if (field.type !== "text" || !/^stage-01-1-answer-\d+$/.test(field.key) || text(answers[field.key]) !== "") continue;
    const pattern = patterns.find(([re]) => re.test(field.prompt));
    if (pattern && !snapshot && field.key !== preserveKey) { out[field.key] = pattern[1]; generated.push(field.key); }
  }

  // ---- 3-B 總分：六題答「是」的題數（六題都答了才算）----
  const totals = [8, 9, 10, 11, 12, 13].map((n) => get(3, n));
  if (get(3, 14) && totals.every(Boolean)) {
    const picks = totals.map((field) => pickedIndexes(field, answers[field!.key])[0]);
    set(get(3, 14), picks.every((i) => i !== undefined) ? String(picks.filter((i) => i === 0).length) : "");
  }

  // ---- 3-C 破口：3-A 四格裡寫「目前沒有」的是第幾格 ----
  const gap = get(3, 15);
  if (gap && get(3, 0) && get(3, 2) && get(3, 4) && get(3, 6)) {
    const has = (n: number, ...idx: number[]) => { const p = pickedIndexes(get(3, n), answers[`stage-01-3-answer-${n}`]); return idx.some((i) => p.includes(i)); };
    const empty = (n: number) => pickedIndexes(get(3, n), answers[`stage-01-3-answer-${n}`]).length === 0;
    const hit = [has(0, 4) || empty(0), has(2, 0, 1, 3), has(4, 0, 3), has(6, 3) || empty(6)];
    set(gap, hit.flatMap((h, i) => (h ? [String(i + 1)] : [])).join("、"));
  }

  // ---- 4-A 抄任務 1-A ----
  set(get(4, 0), state || person ? `我要找的人是【${state}】的【${person}】。` : "");

  // ---- 4-B「我不收＿＿的人」：勾到的原選項串起來（不改寫）----
  const noParts = [8, 10].map((n) => pickedTexts(get(4, n), answers[`stage-01-4-answer-${n}`], answers).join("、")).filter(Boolean);
  set(get(4, 12), noParts.join("、"));

  // ---- 4-C 三題：照勾選順序 ----
  const asks = pickedTexts(get(4, 13), answers["stage-01-4-answer-13"], answers);
  [15, 16, 17].forEach((n, i) => set(get(4, n), asks[i] ?? ""));

  // ---- 4-D 串成一段話 ----
  set(get(4, 18), state && person ? `${state}的${person}` : "");
  set(get(4, 19), eff(get(4, 12)));
  set(get(4, 20), eff(get(4, 15)));

  // ---- 附錄：一頁藍圖抄前面任務 ----
  const solve = /從【(.+?)】，變成【(.+?)】/.exec(eff(get(1, 11)));
  const angle = pickedIndexes(get(1, 13), answers["stage-01-1-answer-13"])[0];
  const reason = angle === undefined ? "" : eff(get(1, 14 + angle));
  const complaint = text(answers["stage-01-2-answer-20"]) || eff(get(1, 10));
  const usable = (v: string) => (v && !hasEmptySlot(v) ? v : "");
  set(get("附錄", 0), usable(eff(get(1, 3))));
  set(get("附錄", 1), solve && !isBlank(solve[1]) && !isBlank(solve[2]) ? `從${solve[1]}，變成${solve[2]}` : "");
  set(get("附錄", 2), usable(reason));
  set(get("附錄", 3), complaint);
  set(get("附錄", 4), eff(get(4, 12)));
  set(get("附錄", 5), eff(get(4, 15)));
  set(get("附錄", 6), text(answers["stage-01-5-answer-1"]));

  return { out, generated, targets };
}
