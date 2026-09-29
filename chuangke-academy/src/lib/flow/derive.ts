// Declarative derivation engine (plan 7.2). Pure: no fs, no dynamic code execution,
// never produces HTML strings — sentence fragments are returned as structured parts.
import type { Cond, Derived, FlowSpec, Question } from "./schema";
import type { AnswerValue, DerivedValue, FlowState, Part } from "./types";

const TEMPLATE_KEY_RE = /\{\{\s*([^}\s]+)\s*\}\}/g;

export function templateKeys(t: string) {
  return [...t.matchAll(TEMPLATE_KEY_RE)].map((m) => m[1]);
}

/** Every question key / derived id this derived value reads. Used by validate.ts and the engine. */
export function derivedRefs(d: Derived): string[] {
  switch (d.op) {
    case "template": case "format": return templateKeys(d.template);
    case "switch": return [d.input];
    case "cases": return d.cases.flatMap((c) => [...(c.when.input ? [c.when.input] : []), ...(c.when.inputs ?? []), ...templateKeys(c.template)]);
    case "joinNonEmpty": case "countEquals": case "weightedCount": case "charCount": case "firstNonEmpty": return d.inputs;
    case "band": case "regexAbsent": case "orderedList": case "mapJoin": case "dateAdd": case "dateFormat": return [d.input];
    case "whereAny": return d.rules.map((r) => r.input);
    case "weekSplit": return [d.start, d.end];
  }
}

export function condRefs(c: Cond): string[] { return [...(c.input ? [c.input] : []), ...(c.inputs ?? [])]; }

const isEmpty = (v: AnswerValue | undefined) => v === undefined || (Array.isArray(v) ? v.length === 0 : v.trim() === "");

/** Whitespace (incl. full-width) and 【】 markers do not count — "唸出來的整句"（D-07）. */
export function countChars(text: string) {
  return [...text.replace(/[\s\u3000【】]/g, "")].length;
}

export function parseIsoDate(v: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((v ?? "").trim());
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return d.getUTCMonth() === Number(m[2]) - 1 ? t : null;
}
const DAY = 86_400_000;
export const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const md = (t: number) => `${new Date(t).getUTCMonth() + 1}/${new Date(t).getUTCDate()}`;

export function weekRange(start: string, end: string, parts: number, index: number): string {
  const s = parseIsoDate(start), e = parseIsoDate(end);
  if (s === null || e === null || e <= s) return "—";
  const total = Math.round((e - s) / DAY);
  const a = s + Math.round((total * index) / parts) * DAY + (index > 0 ? DAY : 0);
  const b = s + Math.round((total * (index + 1)) / parts) * DAY;
  return `${md(Math.min(a, b))} ～ ${md(b)}`;
}

export type Engine = {
  values: Record<string, DerivedValue>;
  /** Effective value: what downstream consumers (derived, blueprint, copy-all) should see. */
  value(key: string): AnswerValue;
  /** Human-readable text of a key (option labels for choices; other-text for 其他). */
  text(key: string): string;
  cond(c: Cond): boolean;
  labels(key: string): string[];
};

export function createEngine(spec: FlowSpec, state: FlowState): Engine {
  const values: Record<string, DerivedValue> = {};
  const visiting = new Set<string>();
  const editedSet = new Set(state.edited);

  const question = (key: string): Question | undefined => spec.questions[key];
  const optionLabel = (q: Question, id: string, key: string) => {
    const o = q.options?.find((x) => x.id === id);
    if (!o) return id;
    if (o.other) {
      const other = state.answers[`${key}_other`];
      return typeof other === "string" && other.trim() ? other.trim() : o.label;
    }
    return o.label;
  };

  function derive(id: string): DerivedValue {
    const cached = values[id];
    if (cached) return cached;
    const def = spec.derived[id];
    if (!def) return { text: "", complete: false };
    if (visiting.has(id)) throw new Error(`derived 循環依賴：${id}`);
    visiting.add(id);
    const v = compute(def);
    visiting.delete(id);
    values[id] = v;
    return v;
  }

  function value(key: string): AnswerValue {
    if (spec.derived[key]) { const d = derive(key); return d.list && !d.text ? d.list : d.text; }
    const q = question(key);
    if (q?.derived && (q.readonly || !editedSet.has(key))) {
      const d = derive(q.derived);
      return d.complete ? d.text : "";
    }
    const stored = state.answers[key];
    if (stored === undefined) return q?.kind === "multi" ? [] : "";
    return stored;
  }

  function labels(key: string): string[] {
    const q = question(key);
    const v = value(key);
    if (q && (q.kind === "single" || q.kind === "multi")) return (Array.isArray(v) ? v : v ? [v] : []).map((id) => optionLabel(q, id, key));
    if (Array.isArray(v)) return v.filter(Boolean);
    return String(v).trim() ? [String(v).trim()] : [];
  }
  const text = (key: string) => labels(key).join("、");
  const str = (key: string) => { const v = value(key); return Array.isArray(v) ? v.join("") : String(v ?? ""); };
  const ids = (key: string) => { const v = value(key); return Array.isArray(v) ? v : v ? [v] : []; };

  function cond(c: Cond): boolean {
    if (c.else) return true;
    if (c.input) {
      const v = value(c.input);
      if (c.equals !== undefined) return Array.isArray(v) ? v.includes(c.equals) : v === c.equals;
      if (c.includes !== undefined) return Array.isArray(v) ? v.includes(c.includes) : String(v).includes(c.includes);
      if (c.empty) return isEmpty(v);
      if (c.nonEmpty) return !isEmpty(v);
    }
    if (c.inputs?.length) {
      if (c.allEqual !== undefined) return c.inputs.every((k) => ids(k).length === 1 && ids(k)[0] === c.allEqual);
      if (c.anyEqual !== undefined) return c.inputs.some((k) => ids(k).includes(c.anyEqual!));
    }
    return false;
  }

  function interpolate(t: string) { return t.replace(TEMPLATE_KEY_RE, (_m, k: string) => (spec.derived[k] ? derive(k).text : text(k))); }

  function compute(d: Derived): DerivedValue {
    switch (d.op) {
      case "template": {
        const parts: Part[] = []; let complete = true; let last = 0; let plain = "";
        for (const m of d.template.matchAll(TEMPLATE_KEY_RE)) {
          const idx = m.index ?? 0;
          if (idx > last) parts.push({ text: d.template.slice(last, idx), kind: "lit" });
          const v = spec.derived[m[1]] ? derive(m[1]).text : text(m[1]);
          if (v.trim()) { parts.push({ text: v.trim(), kind: "filled" }); plain += v.trim(); } else { parts.push({ text: d.blank, kind: "blank" }); complete = false; plain += d.blank; }
          last = idx + m[0].length;
        }
        if (last < d.template.length) parts.push({ text: d.template.slice(last), kind: "lit" });
        const litPlain = parts.map((p) => p.text).join("");
        void plain;
        return { text: litPlain, parts, complete };
      }
      case "format": {
        let complete = true;
        const out = d.template.replace(TEMPLATE_KEY_RE, (_m, k: string) => { const v = spec.derived[k] ? derive(k).text : text(k); if (!v.trim()) complete = false; return v.trim(); });
        return { text: out, complete };
      }
      case "switch": {
        const v = ids(d.input)[0];
        const t = (v && d.cases[v]) ?? d.default ?? "";
        return { text: t, complete: Boolean(t) };
      }
      case "cases": {
        for (const c of d.cases) if (cond(c.when)) return { text: interpolate(c.template), tone: c.tone, complete: true };
        return { text: "", complete: false };
      }
      case "joinNonEmpty": {
        const parts = d.inputs.map((k) => (spec.derived[k] ? derive(k).text : text(k)).trim()).filter(Boolean);
        return { text: parts.length ? parts.join(d.sep) + d.end : "", complete: d.requireAll ? parts.length === d.inputs.length : parts.length > 0 };
      }
      case "countEquals": {
        const unanswered = d.inputs.filter((k) => ids(k).length === 0);
        const n = d.inputs.filter((k) => ids(k).includes(d.equals)).length;
        const complete = unanswered.length === 0;
        if (d.output === "left") return { text: complete ? "" : (d.leftText ?? "還有 {{n}} 題沒答").replace("{{n}}", String(unanswered.length)), tone: "neutral", complete: !complete, list: unanswered };
        return { text: complete ? String(n) : "", number: n, complete, list: unanswered };
      }
      case "weightedCount": {
        const unanswered = d.inputs.filter((k) => ids(k).length === 0);
        const raw = d.inputs.reduce((sum, k) => sum + ids(k).reduce((n, id) => n + (d.weights[id] ?? 0), 0), 0);
        const n = d.cap === undefined ? raw : Math.min(raw, d.cap);
        if (unanswered.length) return { text: d.incomplete ?? "", number: n, complete: false, list: unanswered, tone: "neutral" };
        return { text: `${n}${d.suffix}`, number: n, complete: true };
      }
      case "band": {
        const src = spec.derived[d.input] ? derive(d.input) : { number: Number(str(d.input)), complete: str(d.input) !== "", text: str(d.input) } as DerivedValue;
        if (!src.complete || src.number === undefined || Number.isNaN(src.number)) return { text: d.incomplete ?? "", complete: false, tone: "neutral" };
        const b = d.bands.find((x) => src.number! >= x.min && src.number! <= x.max);
        return { text: b ? b[d.output] : "", complete: Boolean(b) };
      }
      case "whereAny": {
        const hit = d.rules.map((r, i) => ({ r, i })).filter(({ r }) => {
          const chosen = ids(r.input);
          return (r.orEmpty && chosen.length === 0) || r.includesAny.some((x) => chosen.includes(x));
        });
        const list = hit.map(({ r, i }) => (d.output === "ordinals" ? String(i + 1) : r.label));
        return { text: list.join("、"), list, complete: true };
      }
      case "charCount": {
        const texts = d.inputs.map((k) => str(k));
        const missing = d.inputs.map((_k, i) => ({ i, empty: !texts[i].trim() })).filter((x) => x.empty).map((x) => d.labels?.[x.i] ?? d.inputs[x.i]);
        if (missing.length) return { text: (d.incomplete ?? "").replace("{{missing}}", missing.join("、")), tone: "neutral", complete: false };
        const n = texts.reduce((s, t) => s + countChars(t), 0);
        const ok = n <= d.max;
        return { text: (ok ? d.good : d.bad).replace("{{n}}", String(n)).replace("{{max}}", String(d.max)), tone: ok ? "good" : "bad", number: n, complete: true };
      }
      case "regexAbsent": {
        const t = str(d.input);
        if (!t.trim()) return { text: "", complete: false };
        if (new RegExp(d.pattern, "u").test(t)) return { text: d.bad, tone: d.tone, complete: true };
        return d.good ? { text: d.good, tone: "good", complete: true } : { text: "", complete: true };
      }
      case "orderedList": {
        const l = labels(d.input);
        if (d.index !== undefined) return { text: l[d.index] ?? "", complete: d.index < l.length };
        return { text: l.join(d.sep), list: l, complete: l.length > 0 };
      }
      case "mapJoin": {
        const q = question(d.input);
        const l = ids(d.input).map((id) => (q && d.map?.[id]) ?? (q ? optionLabel(q, id, d.input) : id));
        return { text: l.join(d.sep), list: l, complete: l.length > 0 };
      }
      case "firstNonEmpty": {
        for (const k of d.inputs) { const t = (spec.derived[k] ? derive(k).text : text(k)).trim(); if (t) return { text: t, complete: true }; }
        return { text: "", complete: false };
      }
      case "dateAdd": {
        const s = parseIsoDate(str(d.input));
        return s === null ? { text: "", complete: false } : { text: toIso(s + d.days * DAY), complete: true };
      }
      case "dateFormat": {
        const t = spec.derived[d.input] ? derive(d.input).text : str(d.input);
        const p = parseIsoDate(t);
        if (p === null) return { text: "", complete: false };
        const dt = new Date(p);
        return { text: `${dt.getUTCMonth() + 1} 月 ${dt.getUTCDate()} 日`, complete: true };
      }
      case "weekSplit": {
        const start = spec.derived[d.start] ? derive(d.start).text : str(d.start);
        const end = spec.derived[d.end] ? derive(d.end).text : str(d.end);
        const t = weekRange(start, end, d.parts, d.index);
        return { text: t, complete: t !== "—" };
      }
    }
  }

  for (const id of Object.keys(spec.derived)) derive(id);
  return { values, value, text, cond, labels };
}
