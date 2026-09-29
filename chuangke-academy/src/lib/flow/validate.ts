// Static validator for a parsed flow spec (plan Phase 1). Pure function; returns messages, never throws.
import { condRefs, derivedRefs } from "./derive";
import { QUESTION_KEY_RE, cellKey, flowPages, tableRowCount, taskSlugOf } from "./schema";
import type { BlockT, FlowSpec, SourceRef } from "./schema";

export type ValidationReport = { errors: string[]; warnings: string[] };
export type SourceTexts = { 作業: string; 講義: string };

const norm = (s: string) => s.replace(/[\s\u3000*_`>#|]/g, "");

export function blockRefs(b: BlockT): { questions: string[]; derived: string[]; tables: string[]; conds: string[] } {
  const r = { questions: [] as string[], derived: [] as string[], tables: [] as string[], conds: [] as string[] };
  switch (b.type) {
    case "choice": case "textarea": case "number": case "checklist": r.questions.push(b.q); if (b.type === "checklist") r.derived.push(...Object.values(b.auto ?? {})); break;
    case "text": r.questions.push(b.q); if (b.placeholderFrom) r.derived.push(b.placeholderFrom); break;
    case "date": r.questions.push(b.q); if (b.defaultFrom) r.derived.push(b.defaultFrom); break;
    case "sentence": r.questions.push(b.q); break;
    case "pickerGroup": r.questions.push(...b.items.map((i) => i.q)); break;
    case "likert": r.questions.push(...b.items); break;
    case "readout": case "check": case "tip": r.derived.push(b.derived); break;
    case "table": r.tables.push(b.table); break;
    case "tableDynamic": r.tables.push(b.table); r.questions.push(b.extra); break;
    case "score": r.derived.push(b.value, b.label, b.detail); break;
    case "schedule": r.conds.push(b.start, b.end); r.questions.push(b.done); r.derived.push(...b.weeks.map((w) => w.derived)); break;
    case "group": r.conds.push(...condRefs(b.showWhen)); for (const inner of b.blocks) { const x = blockRefs(inner); r.questions.push(...x.questions); r.derived.push(...x.derived); r.tables.push(...x.tables); r.conds.push(...x.conds); } break;
    default: break;
  }
  return r;
}

export function findHeading(md: string, ref: SourceRef): boolean {
  const lines = md.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l)).map((l) => norm(l.replace(/^#{1,6}\s+/, "")));
  const target = norm(ref.heading);
  return lines.some((l) => l.includes(target));
}

export function validateFlow(spec: FlowSpec, sources?: SourceTexts): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isQ = (k: string) => k in spec.questions || (k.endsWith("_other") && k.slice(0, -6) in spec.questions);
  const isD = (k: string) => k in spec.derived;
  const known = (k: string) => isQ(k) || isD(k);

  for (const k of [...Object.keys(spec.questions), ...Object.keys(spec.derived), ...Object.keys(spec.tables)]) {
    if (!QUESTION_KEY_RE.test(k)) errors.push(`key 不符合命名規則（stage{N}.{task}…，全小寫）：${k}`);
  }
  for (const k of Object.keys(spec.derived)) if (k in spec.questions) errors.push(`derived id 與題目 key 重複：${k}`);
  for (const k of [...Object.keys(spec.questions), ...Object.keys(spec.derived)]) {
    const slug = taskSlugOf(k);
    if (slug && !(slug in spec.tasks) && !k.includes(".r")) warnings.push(`key ${k} 的 task「${slug}」未列在 tasks 對照表`);
  }

  // questions
  const legacySeen = new Map<string, string>();
  for (const [key, q] of Object.entries(spec.questions)) {
    if ((q.kind === "single" || q.kind === "multi") && !(q.options?.length)) errors.push(`${key}：選擇題沒有 options`);
    if (q.kind !== "single" && q.kind !== "multi" && q.options?.length) errors.push(`${key}：非選擇題不應有 options`);
    const seen = new Set<string>();
    for (const o of q.options ?? []) { if (seen.has(o.id)) errors.push(`${key}：option id 重複 ${o.id}`); seen.add(o.id); }
    if (q.derived && !isD(q.derived)) errors.push(`${key}：derived 指向不存在的 ${q.derived}`);
    for (const lk of [...q.legacyKeys, ...(q.legacyOtherKey ? [q.legacyOtherKey] : [])]) {
      const prev = legacySeen.get(lk);
      if (prev && prev !== key) errors.push(`legacy key ${lk} 同時被 ${prev} 與 ${key} 使用`);
      legacySeen.set(lk, key);
    }
  }
  for (const d of spec.dropped) if (legacySeen.has(d.legacyKey)) errors.push(`dropped 的 ${d.legacyKey} 同時已對應到 ${legacySeen.get(d.legacyKey)}`);

  // tables
  for (const [key, t] of Object.entries(spec.tables)) {
    const cells = tableRowCount(t) * t.columns.length;
    if (t.legacyKeys.length && t.legacyKeys.length !== cells) errors.push(`表格 ${key}：legacyKeys 數量 ${t.legacyKeys.length} ≠ 格數 ${cells}`);
    void cellKey;
  }

  // derived refs + cycles
  const edges = new Map<string, string[]>();
  for (const [id, d] of Object.entries(spec.derived)) {
    const refs = derivedRefs(d);
    for (const r of refs) if (!known(r)) errors.push(`derived ${id} 引用不存在的 key：${r}`);
    edges.set(id, refs.flatMap((r) => (isD(r) ? [r] : spec.questions[r]?.derived ? [spec.questions[r].derived!] : [])));
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { errors.push(`derived 循環依賴：${[...path, id].join(" → ")}`); return; }
    state.set(id, 1);
    for (const n of edges.get(id) ?? []) visit(n, [...path, id]);
    state.set(id, 2);
  };
  for (const id of edges.keys()) visit(id, []);

  // pages / flows / blocks
  for (const [flowId, flow] of Object.entries(spec.flows)) {
    const seenInFlow = new Set<string>();
    for (const p of flowPages(flow)) {
      if (!spec.pages[p]) errors.push(`flow ${flowId} 引用不存在的 page：${p}`);
      if (seenInFlow.has(p)) errors.push(`flow ${flowId}：page ${p} 重複出現`);
      seenInFlow.add(p);
    }
  }
  const usedPages = new Set(Object.values(spec.flows).flatMap((f) => flowPages(f)));
  for (const id of Object.keys(spec.pages)) if (!usedPages.has(id)) warnings.push(`page ${id} 沒有被任何 flow 使用`);
  for (const [pid, page] of Object.entries(spec.pages)) {
    if (page.showWhen) for (const r of condRefs(page.showWhen)) if (!known(r)) errors.push(`page ${pid} 的 showWhen 引用不存在的 key：${r}`);
    for (const b of page.blocks) {
      const r = blockRefs(b as BlockT);
      for (const k of r.questions) if (!isQ(k)) errors.push(`page ${pid}（${b.type}）引用不存在的題目：${k}`);
      for (const k of r.derived) if (!isD(k)) errors.push(`page ${pid}（${b.type}）引用不存在的 derived：${k}`);
      for (const k of r.tables) if (!(k in spec.tables)) errors.push(`page ${pid}（${b.type}）引用不存在的表格：${k}`);
      for (const k of r.conds) if (!known(k)) errors.push(`page ${pid} 的 showWhen 引用不存在的 key：${k}`);
      if (b.type === "lecture" && sources && !findHeading(sources.講義, b.sourceRef)) warnings.push(`page ${pid}：講義找不到標題「${b.sourceRef.heading}」`);
    }
    if (page.sourceRef && sources && !findHeading(sources[page.sourceRef.file], page.sourceRef)) warnings.push(`page ${pid}：${page.sourceRef.file}找不到標題「${page.sourceRef.heading}」`);
  }
  if (spec.blueprint.nameKey && !isQ(spec.blueprint.nameKey)) errors.push(`blueprint.nameKey 引用不存在的題目：${spec.blueprint.nameKey}`);
  for (const s of spec.blueprint.sections) for (const i of s.items) {
    if (!i.value && !i.table) errors.push(`blueprint「${i.label}」需要 value 或 table`);
    if (i.value && !known(i.value)) errors.push(`blueprint「${i.label}」引用不存在的 key：${i.value}`);
    if (i.table && !(i.table in spec.tables)) errors.push(`blueprint「${i.label}」引用不存在的表格：${i.table}`);
  }
  if (sources) {
    for (const [k, q] of Object.entries(spec.questions)) if (q.sourceRef && !findHeading(sources[q.sourceRef.file], q.sourceRef)) warnings.push(`題目 ${k}：找不到標題「${q.sourceRef.heading}」`);
  }
  return { errors, warnings };
}
