// Semantic key <-> legacy positional key mapping (plan 7.3, R-7). Pure: no fs.
// READ: new key wins; otherwise fall back to the legacy key (never deleted).
// WRITE: only new keys, plus a mirrored legacy key (dual write) so the old TaskFlow keeps working (R-9).
import { cellKey, taskSlugOf, tableRowCount } from "./schema";
import type { FlowSpec, Question } from "./schema";
import type { AnswerValue, Answers, FlowState } from "./types";

export type RawAnswers = Record<string, unknown>;
export type FlowMeta = { page?: string; mode?: string; edited?: string[] };
export const FLOW_META_KEY = "_flow";

/** `${task}-answer-N` -> option key for option i, per taskSections.ts (`${taskKey}-option-${fieldIndex}-${i}`). */
export function legacyOptionKey(legacyFieldKey: string, index: number) {
  return legacyFieldKey.replace(/-answer-(\d+)$/, `-option-$1-${index}`);
}

const STAGE_NUM: Record<string, string> = { "2": "s2", "二": "s2", "4": "s4", "四": "s4", "5": "s5", "五": "s5", "6": "s6", "六": "s6" };
const NUM_TO_CN: Record<string, string> = { s2: "二", s4: "四", s5: "五", s6: "六" };

/** "9月29日" / "9/29" / "9-29" -> ISO in `year`. */
export function legacyMdToIso(text: string, year: number): string {
  const m = /(\d{1,2})\s*(?:月|\/|-|\.)\s*(\d{1,2})/.exec(text);
  if (!m) return "";
  const mm = Number(m[1]), dd = Number(m[2]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
export function isoToLegacyMd(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[1])}月${Number(m[2])}日` : "";
}

const isNonEmpty = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null);
const asString = (v: unknown) => (Array.isArray(v) ? String(v[0] ?? "") : v === undefined || v === null ? "" : String(v));

function fromLegacy(q: Question, raw: unknown, legacyKey: string, year: number): AnswerValue | undefined {
  if (!isNonEmpty(raw)) return undefined;
  if (q.kind === "single" || q.kind === "multi") {
    const list = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const options = q.options ?? [];
    const found: string[] = [];
    for (const item of list) {
      const idx = options.findIndex((_o, i) => legacyOptionKey(legacyKey, i) === item);
      if (idx >= 0) { found.push(options[idx].id); continue; }
      // legacy free-text field (e.g. 3-C "階段＿"): match by legacyText or stage number
      const byText = options.find((o) => o.legacyText && o.legacyText === item.trim());
      if (byText) { found.push(byText.id); continue; }
      if (q.legacyParse === "stage_num") { const d = /[2456二四五六]/.exec(item); const id = d && STAGE_NUM[d[0]]; if (id && options.some((o) => o.id === id)) found.push(id); }
    }
    if (!found.length) return undefined;
    return q.kind === "single" ? found[0] : found;
  }
  const s = asString(raw);
  if (q.kind === "date") return legacyMdToIso(s, year) || undefined;
  if (q.legacyParse === "n1" || q.legacyParse === "n2") {
    const nums = s.match(/\d+/g) ?? [];
    return nums[q.legacyParse === "n1" ? 0 : 1];
  }
  return s;
}

export function taskKeyOf(spec: FlowSpec, key: string): string {
  const base = key.replace(/_other$/, "");
  const q = spec.questions[base];
  if (q?.task) return q.task;
  const slug = taskSlugOf(base);
  return spec.tasks[slug] ?? Object.values(spec.tasks)[0];
}

/** Merge all submission rows (oldest first) into one raw answer bag. */
export function mergeRows(rows: { answer_json: unknown }[]): RawAnswers {
  const out: RawAnswers = {};
  for (const r of rows) if (r.answer_json && typeof r.answer_json === "object") Object.assign(out, r.answer_json as RawAnswers);
  return out;
}

export function readMeta(raw: RawAnswers): FlowMeta { const m = raw[FLOW_META_KEY]; return m && typeof m === "object" ? (m as FlowMeta) : {}; }

export function loadState(spec: FlowSpec, raw: RawAnswers, year = new Date().getFullYear()): { state: FlowState; meta: FlowMeta; migrated: string[] } {
  const answers: Answers = {};
  const meta = readMeta(raw);
  const edited = new Set(meta.edited ?? []);
  const migrated: string[] = [];
  for (const [key, q] of Object.entries(spec.questions)) {
    if (q.readonly) continue;
    const own = raw[key];
    if (own !== undefined && own !== null) {
      answers[key] = q.kind === "multi" ? (Array.isArray(own) ? own.map(String) : own ? [String(own)] : []) : Array.isArray(own) ? String(own[0] ?? "") : String(own);
    } else {
      const legacyKey = q.legacyKeys[0] ?? q.legacyReadKey;
      if (legacyKey) {
        const v = fromLegacy(q, raw[legacyKey], legacyKey, year);
        if (v !== undefined) { answers[key] = v; migrated.push(key); if (q.derived) edited.add(key); }
      }
    }
    const otherOwn = raw[`${key}_other`];
    if (typeof otherOwn === "string") answers[`${key}_other`] = otherOwn;
    else if (q.legacyOtherKey && typeof raw[q.legacyOtherKey] === "string") answers[`${key}_other`] = raw[q.legacyOtherKey] as string;
  }
  return { state: { answers, edited: [...edited].filter((k) => spec.questions[k]?.derived) }, meta, migrated };
}

function toLegacy(q: Question, value: AnswerValue, legacyKey: string): AnswerValue | undefined {
  if (q.kind === "single" || q.kind === "multi") {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    const options = q.options ?? [];
    if (options.some((o) => o.legacyText)) { const o = options.find((x) => x.id === list[0]); return o?.legacyText ?? (q.legacyParse === "stage_num" && list[0] ? NUM_TO_CN[list[0]] ?? "" : ""); }
    const keys = list.map((id) => options.findIndex((o) => o.id === id)).filter((i) => i >= 0).map((i) => legacyOptionKey(legacyKey, i));
    // legacy fields were always `checkboxes`: single => string, multi (or parser-flagged multiple) => string[]
    return q.kind === "single" ? (keys[0] ?? "") : keys;
  }
  if (q.kind === "date") return isoToLegacyMd(String(value));
  return Array.isArray(value) ? value.join("、") : String(value);
}

export type EffectiveFn = (key: string) => AnswerValue;

/**
 * Build the per-task answer_json payloads for saving.
 * `effective` comes from the derive engine so derived-but-unedited sentences are mirrored to legacy keys.
 */
export function serializeState(spec: FlowSpec, state: FlowState, effective: EffectiveFn, meta: FlowMeta, currentTask: string): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const put = (task: string, key: string, value: unknown) => { (out[task] ??= {})[key] = value; };
  const editedSet = new Set(state.edited);
  for (const [key, q] of Object.entries(spec.questions)) {
    const task = taskKeyOf(spec, key);
    const touched = key in state.answers;
    const stored = state.answers[key];
    if (touched && !q.readonly && (!q.derived || editedSet.has(key))) put(task, key, stored);
    const other = state.answers[`${key}_other`];
    if (typeof other === "string") put(task, `${key}_other`, other);
    // dual write (legacy mirror)
    const legacyKey = q.legacyKeys[0];
    if (legacyKey && q.dualWrite !== false) {
      const mirrorable = q.derived ? true : touched;
      if (mirrorable) {
        const v = effective(key);
        const empty = Array.isArray(v) ? v.length === 0 : String(v).trim() === "";
        if (!empty || touched) { const legacy = toLegacy(q, v, legacyKey); if (legacy !== undefined) put(task, legacyKey, legacy); }
      }
    }
    if (q.legacyOtherKey && typeof other === "string") put(task, q.legacyOtherKey, other);
  }
  const edited = state.edited.filter((k) => spec.questions[k]);
  put(currentTask, FLOW_META_KEY, { ...meta, edited } satisfies FlowMeta);
  return out;
}

/** Strip UI-only keys before export / blueprint / teacher statistics (K-6). */
export function stripFlowMeta<T extends Record<string, unknown>>(answers: T): Omit<T, typeof FLOW_META_KEY> {
  const { [FLOW_META_KEY]: _ignored, ...rest } = answers;
  void _ignored;
  return rest;
}

/** Every legacy key the spec accounts for (mapped fields, other-text fields, read aliases, dropped). */
export function accountedLegacyKeys(spec: FlowSpec): Set<string> {
  const s = new Set<string>();
  for (const q of Object.values(spec.questions)) { q.legacyKeys.forEach((k) => s.add(k)); if (q.legacyOtherKey) s.add(q.legacyOtherKey); if (q.legacyReadKey) s.add(q.legacyReadKey); }
  spec.dropped.forEach((d) => s.add(d.legacyKey));
  return s;
}

export function tableCellKeys(spec: FlowSpec, table: string): string[][] {
  const t = spec.tables[table];
  if (!t) return [];
  return Array.from({ length: tableRowCount(t) }, (_v, r) => t.columns.map((c) => cellKey(table, r + 1, c.id)));
}
