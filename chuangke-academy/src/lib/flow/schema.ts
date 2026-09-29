// Flow content model (see docs/flow/FLOW_SPEC.md). Pure module: NO node:fs,
// so client components may import values from here (R-8).
import { z } from "zod";

export const QUESTION_KEY_RE = /^stage\d+(\.[a-z0-9_]+)+$/;

export const Origin = z.enum(["source", "source-derived", "artifact-only", "authored"]);
export type Origin = z.infer<typeof Origin>;

export const SourceRef = z.object({
  file: z.enum(["作業", "講義"]),
  heading: z.string().min(1),
  step: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const Option = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().optional(),
  other: z.boolean().optional(),
  /** Text written to a legacy *text* field when the legacy field was free text. */
  legacyText: z.string().optional(),
});
export type Option = z.infer<typeof Option>;

const LegacyParse = z.enum(["md", "n1", "n2", "stage_num"]);

export const QuestionKind = z.enum(["single", "multi", "text", "textarea", "number", "date", "json"]);
export type QuestionKind = z.infer<typeof QuestionKind>;

export const Question = z.object({
  kind: QuestionKind,
  label: z.string().min(1),
  hint: z.string().optional(),
  task: z.string().optional(),
  options: z.array(Option).optional(),
  max: z.number().int().positive().optional(),
  optional: z.boolean().optional(),
  placeholder: z.string().optional(),
  /** Derived id that supplies the automatic value. The stored answer only exists once the learner edits it. */
  derived: z.string().optional(),
  /** Derived-only value that is never edited by the learner (still mirrored to legacy keys). */
  readonly: z.boolean().optional(),
  legacyKeys: z.array(z.string()).default([]),
  /** Legacy hidden text field that held the "其他" text. */
  legacyOtherKey: z.string().optional(),
  /** Read-only alias source when this question has no 1:1 legacy key. */
  legacyReadKey: z.string().optional(),
  legacyParse: LegacyParse.optional(),
  /** Set false to skip writing the legacy key back (documented limitation). */
  dualWrite: z.boolean().optional(),
  origin: Origin.default("source"),
  sourceRef: SourceRef.optional(),
});
export type Question = z.infer<typeof Question>;

export const TableDef = z.object({
  label: z.string().min(1),
  task: z.string().optional(),
  rows: z.union([z.number().int().positive(), z.array(z.string()).min(1)]),
  rowLabel: z.string().optional(),
  columns: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), kind: z.enum(["text", "number"]).default("text"), chips: z.array(z.string()).optional() })).min(1),
  /** Row-major legacy field keys (row1 col1, row1 col2, …). */
  legacyKeys: z.array(z.string()).default([]),
  optional: z.boolean().optional(),
  origin: Origin.default("source"),
  sourceRef: SourceRef.optional(),
});
export type TableDef = z.infer<typeof TableDef>;

export const Cond = z.object({
  input: z.string().optional(),
  inputs: z.array(z.string()).optional(),
  equals: z.string().optional(),
  includes: z.string().optional(),
  empty: z.boolean().optional(),
  nonEmpty: z.boolean().optional(),
  allEqual: z.string().optional(),
  anyEqual: z.string().optional(),
  else: z.boolean().optional(),
});
export type Cond = z.infer<typeof Cond>;

const DerivedBase = { origin: Origin.default("source"), sourceRef: SourceRef.optional(), note: z.string().optional() };
export const Derived = z.discriminatedUnion("op", [
  z.object({ op: z.literal("template"), template: z.string(), blank: z.string().default("＿＿＿"), ...DerivedBase }),
  z.object({ op: z.literal("format"), template: z.string(), ...DerivedBase }),
  z.object({ op: z.literal("switch"), input: z.string(), cases: z.record(z.string()), default: z.string().optional(), ...DerivedBase }),
  z.object({ op: z.literal("cases"), cases: z.array(z.object({ when: Cond, template: z.string(), tone: z.enum(["good", "bad", "neutral"]).optional() })), ...DerivedBase }),
  z.object({ op: z.literal("joinNonEmpty"), inputs: z.array(z.string()).min(1), sep: z.string().default(""), end: z.string().default(""), requireAll: z.boolean().default(false), ...DerivedBase }),
  z.object({ op: z.literal("countEquals"), inputs: z.array(z.string()).min(1), equals: z.string(), output: z.enum(["count", "left"]).default("count"), leftText: z.string().optional(), ...DerivedBase }),
  z.object({ op: z.literal("band"), input: z.string(), output: z.enum(["label", "detail"]), bands: z.array(z.object({ min: z.number(), max: z.number(), label: z.string(), detail: z.string() })).min(1), incomplete: z.string().optional(), ...DerivedBase }),
  z.object({ op: z.literal("whereAny"), output: z.enum(["labels", "ordinals"]).default("labels"), rules: z.array(z.object({ label: z.string(), input: z.string(), includesAny: z.array(z.string()).default([]), orEmpty: z.boolean().default(false) })).min(1), ...DerivedBase }),
  z.object({ op: z.literal("charCount"), inputs: z.array(z.string()).min(1), labels: z.array(z.string()).optional(), max: z.number().int().positive(), unit: z.string().default("字"), good: z.string(), bad: z.string(), incomplete: z.string().optional(), ...DerivedBase }),
  z.object({ op: z.literal("regexAbsent"), input: z.string(), pattern: z.string(), good: z.string().optional(), bad: z.string(), tone: z.enum(["bad", "neutral"]).default("bad"), ...DerivedBase }),
  z.object({ op: z.literal("orderedList"), input: z.string(), index: z.number().int().nonnegative().optional(), sep: z.string().default("、"), ...DerivedBase }),
  z.object({ op: z.literal("mapJoin"), input: z.string(), sep: z.string().default("、"), map: z.record(z.string()).optional(), ...DerivedBase }),
  z.object({ op: z.literal("firstNonEmpty"), inputs: z.array(z.string()).min(1), ...DerivedBase }),
  z.object({ op: z.literal("dateAdd"), input: z.string(), days: z.number().int(), ...DerivedBase }),
  z.object({ op: z.literal("dateFormat"), input: z.string(), ...DerivedBase }),
  z.object({ op: z.literal("weekSplit"), start: z.string(), end: z.string(), parts: z.number().int().positive(), index: z.number().int().nonnegative(), ...DerivedBase }),
]);
export type Derived = z.infer<typeof Derived>;

// ---- blocks ---------------------------------------------------------------
const Q = z.string().min(1);
export const Block: z.ZodType<BlockT> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("prose"), text: z.string(), origin: Origin.optional() }),
    z.object({ type: z.literal("callout"), text: z.string(), tone: z.enum(["note", "warn", "ok"]).default("note"), origin: Origin.optional() }),
    z.object({ type: z.literal("quote"), text: z.string() }),
    z.object({ type: z.literal("details"), summary: z.string(), text: z.string(), origin: Origin.optional() }),
    z.object({ type: z.literal("lecture"), sourceRef: SourceRef }),
    z.object({ type: z.literal("choice"), q: Q, columns: z.number().int().min(1).max(2).default(1) }),
    z.object({ type: z.literal("pickerGroup"), items: z.array(z.object({ q: Q, title: z.string() })).min(1) }),
    z.object({ type: z.literal("text"), q: Q, chips: z.array(z.string()).optional(), chipsLabel: z.string().optional(), placeholderFrom: z.string().optional(), chipsFromTable: z.object({ table: z.string(), column: z.string() }).optional(), prefix: z.string().optional(), suffix: z.string().optional() }),
    z.object({ type: z.literal("textarea"), q: Q, prefix: z.string().optional(), suffix: z.string().optional() }),
    z.object({ type: z.literal("number"), q: Q, unit: z.string().optional() }),
    z.object({ type: z.literal("date"), q: Q, defaultFrom: z.string().optional() }),
    z.object({ type: z.literal("sentence"), q: Q, title: z.string().optional(), multiline: z.boolean().optional(), prefix: z.string().optional(), suffix: z.string().optional() }),
    z.object({ type: z.literal("readout"), derived: Q, title: z.string().optional() }),
    z.object({ type: z.literal("check"), derived: Q }),
    z.object({ type: z.literal("tip"), derived: Q }),
    z.object({ type: z.literal("likert"), items: z.array(Q).min(1), title: z.string().optional() }),
    z.object({ type: z.literal("table"), table: Q }),
    z.object({ type: z.literal("tableDynamic"), table: Q, extra: Q }),
    z.object({ type: z.literal("score"), value: Q, label: Q, detail: Q, total: z.number().int().positive() }),
    z.object({ type: z.literal("schedule"), start: Q, end: Q, done: Q, weeks: z.array(z.object({ id: z.string(), label: z.string(), derived: Q, what: z.string(), output: z.string() })).min(1) }),
    z.object({ type: z.literal("checklist"), q: Q, auto: z.record(z.string()).optional() }),
    z.object({ type: z.literal("blueprint") }),
    z.object({ type: z.literal("group"), showWhen: Cond, blocks: z.array(Block) }),
  ]),
) as never;

export type BlockT =
  | { type: "prose"; text: string; origin?: Origin }
  | { type: "callout"; text: string; tone: "note" | "warn" | "ok"; origin?: Origin }
  | { type: "quote"; text: string }
  | { type: "details"; summary: string; text: string; origin?: Origin }
  | { type: "lecture"; sourceRef: SourceRef }
  | { type: "choice"; q: string; columns: number }
  | { type: "pickerGroup"; items: { q: string; title: string }[] }
  | { type: "text"; q: string; chips?: string[]; chipsLabel?: string; placeholderFrom?: string; chipsFromTable?: { table: string; column: string }; prefix?: string; suffix?: string }
  | { type: "textarea"; q: string; prefix?: string; suffix?: string }
  | { type: "number"; q: string; unit?: string }
  | { type: "date"; q: string; defaultFrom?: string }
  | { type: "sentence"; q: string; title?: string; multiline?: boolean; prefix?: string; suffix?: string }
  | { type: "readout"; derived: string; title?: string }
  | { type: "check"; derived: string }
  | { type: "tip"; derived: string }
  | { type: "likert"; items: string[]; title?: string }
  | { type: "table"; table: string }
  | { type: "tableDynamic"; table: string; extra: string }
  | { type: "score"; value: string; label: string; detail: string; total: number }
  | { type: "schedule"; start: string; end: string; done: string; weeks: { id: string; label: string; derived: string; what: string; output: string }[] }
  | { type: "checklist"; q: string; auto?: Record<string, string> }
  | { type: "blueprint" }
  | { type: "group"; showWhen: Cond; blocks: BlockT[] };

export const Page = z.object({
  title: z.string().min(1),
  sourceRef: SourceRef.optional(),
  task: z.string().optional(),
  /** A whole lecture chapter (H1 title in the 講義 file). The loader expands it into one page per "##" section. */
  lectureChapter: z.string().optional(),
  blocks: z.array(Block).default([]),
  showWhen: Cond.optional(),
  requiredToAdvance: z.boolean().default(false),
}).refine((p) => p.blocks.length > 0 || Boolean(p.lectureChapter), "page 需要 blocks 或 lectureChapter");
export type Page = z.infer<typeof Page>;

export const Blueprint = z.object({
  /** Question whose text is printed as the learner's name on the blueprint. */
  nameKey: z.string().optional(),
  sections: z.array(z.object({
    title: z.string(),
    copyOnly: z.boolean().optional(),
    items: z.array(z.object({ label: z.string(), value: z.string().optional(), table: z.string().optional(), fallback: z.string().default("暫定"), multiline: z.boolean().optional() })).min(1),
  })).min(1),
});

export const FlowPart = z.object({ label: z.string().min(1), pages: z.array(z.string()).min(1) });
export const FlowDef = z.object({ label: z.string(), parts: z.array(FlowPart).min(1) });
export type FlowDefT = z.infer<typeof FlowDef>;
export const flowPages = (f: FlowDefT) => f.parts.flatMap((p) => p.pages);

export const FlowFile = z.object({
  schemaVersion: z.literal(1),
  stage: z.string().regex(/^stage-\d+$/),
  title: z.string(),
  /** short task slug → task key used in submissions.task_key */
  tasks: z.record(z.string()),
  flows: z.record(FlowDef).refine((f) => Object.keys(f).length > 0, "至少要有一個 flow"),
  pages: z.record(Page),
  questions: z.record(Question).default({}),
  tables: z.record(TableDef).default({}),
  derived: z.record(Derived).default({}),
  blueprint: Blueprint,
  dropped: z.array(z.object({ legacyKey: z.string(), reason: z.string().min(1) })).default([]),
});
export type FlowFile = z.infer<typeof FlowFile>;

/** A FlowFile after tables were expanded into plain questions. */
export type FlowSpec = Omit<FlowFile, "tables"> & { tables: Record<string, TableDef>; questions: Record<string, Question> };

export function taskSlugOf(key: string) { return key.split(".")[1] ?? ""; }
export function cellKey(table: string, row: number, col: string) { return `${table}.r${row}.${col}`; }
export function tableRowCount(t: TableDef) { return typeof t.rows === "number" ? t.rows : t.rows.length; }

/** Expand each table into per-cell questions (row-major legacy keys). */
export function expandTables(file: FlowFile): FlowSpec {
  const questions: Record<string, Question> = { ...file.questions };
  for (const [tkey, t] of Object.entries(file.tables)) {
    const rows = tableRowCount(t);
    t.columns.forEach((col, ci) => {
      for (let r = 1; r <= rows; r++) {
        const legacy = t.legacyKeys[(r - 1) * t.columns.length + ci];
        questions[cellKey(tkey, r, col.id)] = {
          kind: col.kind === "number" ? "number" : "text",
          label: `${t.label}｜第 ${r} 列｜${col.label}`,
          task: t.task, optional: t.optional ?? true, legacyKeys: legacy ? [legacy] : [], origin: t.origin, sourceRef: t.sourceRef,
        };
      }
    });
  }
  return { ...file, questions } as FlowSpec;
}
