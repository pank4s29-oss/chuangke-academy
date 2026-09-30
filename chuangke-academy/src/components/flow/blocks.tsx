"use client";
// Generic block renderers. They only know block *types*, never a stage (R-2). No node:fs imports (R-8).
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Engine } from "@/lib/flow/derive";
import { cellKey, tableRowCount } from "@/lib/flow/schema";
import type { BlockT, FlowSpec } from "@/lib/flow/schema";
import { toggleMulti } from "@/lib/flow/state";
import type { AnswerValue, FlowState } from "@/lib/flow/types";
import { getQuestionGuidance } from "@/lib/flow/guidance";
import BlueprintPage from "./BlueprintPage";

export type Ctx = {
  spec: FlowSpec; eng: Engine; st: FlowState; lectures: Record<string, string>; pageId: string;
  set: (key: string, v: AnswerValue) => void; edit: (key: string, text: string) => void; regen: (key: string) => void;
};

export const Md = ({ children }: { children: string }) => <div className="flow-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>;
const arr = (v: AnswerValue): string[] => (Array.isArray(v) ? v : v ? [v] : []);
const str = (v: AnswerValue) => (Array.isArray(v) ? v.join("、") : v);

function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return <div className="flow-field">{label && <div className="flow-label">{label}</div>}{hint && <div className="flow-hint">{hint}</div>}{children}</div>;
}

function QuestionGuide({ c, q }: { c: Ctx; q: string }) {
  const def = c.spec.questions[q];
  if (!def) return null;
  const g = getQuestionGuidance(c.spec, q, c.eng);
  return <aside className="flow-guide" aria-label={`${def.label}的作答引導`}>
    <div className="flow-guide-heading"><span className="flow-guide-icon" aria-hidden="true">?</span><strong>先理解，再作答</strong></div>
    <div className="flow-guide-row"><span className="flow-guide-key">這題在問什麼</span><span>{g.meaning}</span></div>
    <div className="flow-guide-row"><span className="flow-guide-key">為什麼要填</span><span>{g.why}</span></div>
    {def.answerExample && <div className="flow-guide-example"><span>可以這樣想：</span>{def.answerExample}</div>}
    {g.downstream.length > 0 && <div className="flow-guide-impact"><span className="flow-guide-key">會自動帶入</span><span>{g.downstream.join("、")}</span></div>}
  </aside>;
}

function Choice({ c, q, compact }: { c: Ctx; q: string; compact?: boolean }) {
  const def = c.spec.questions[q];
  const multi = def.kind === "multi";
  const cur = arr(c.eng.value(q));
  const pick = (id: string) => {
    if (multi) c.set(q, toggleMulti(cur, id, def.max));
    else c.set(q, cur[0] === id ? "" : id);
  };
  return (
    <div className="flow-field">
      {!compact && <div className="flow-label">{def.label}</div>}
      {!compact && multi && def.max && <div className="flow-hint">最多選 {def.max} 個（已選 {cur.length}）</div>}
      {!compact && <QuestionGuide c={c} q={q} />}
      <div className="flow-opts" role={multi ? "group" : "radiogroup"} aria-label={def.label}>
        {def.options?.map((o) => {
          const on = cur.includes(o.id);
          return (
            <div key={o.id} className="flow-opt-wrap">
              <button type="button" className="flow-opt" aria-pressed={on} onClick={() => pick(o.id)}>
                <span className="flow-opt-mark" aria-hidden="true">{on ? "✓" : ""}</span>
                <span><span className="flow-opt-label">{o.label}</span>{o.hint && !compact && <span className="flow-opt-hint">{o.hint}</span>}</span>
              </button>
              {o.other && on && <input className="flow-input" aria-label={`${o.label}補充內容`} placeholder="請填寫其他內容" value={str(c.st.answers[`${q}_other`] ?? "")} onChange={(e) => c.set(`${q}_other`, e.target.value)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextInput({ c, b }: { c: Ctx; b: Extract<BlockT, { type: "text" | "number" | "date" | "textarea" }> }) {
  const def = c.spec.questions[b.q];
  const v = str(c.eng.value(b.q));
  const stored = str(c.st.answers[b.q] ?? "");
  const ph = b.type === "text" && b.placeholderFrom ? c.eng.values[b.placeholderFrom]?.text : def.placeholder;
  const chips = b.type === "text" ? [...(b.chips ?? []), ...(b.chipsFromTable ? Array.from({ length: tableRowCount(c.spec.tables[b.chipsFromTable.table]) }, (_x, i) => str(c.eng.value(cellKey(b.chipsFromTable!.table, i + 1, b.chipsFromTable!.column)))).filter(Boolean) : [])] : [];
  const dateDefault = b.type === "date" && b.defaultFrom ? c.eng.values[b.defaultFrom]?.text : "";
  return (
    <Field label={def.label} hint={def.hint}>
      <QuestionGuide c={c} q={b.q} />
      {b.type === "textarea"
        ? <textarea className="flow-input" rows={3} placeholder={ph} value={v} onChange={(e) => c.set(b.q, e.target.value)} />
        : <div className="flow-inline">
            {b.type === "text" && b.prefix && <span className="flow-affix">{b.prefix}</span>}
            <input className="flow-input" type={b.type === "number" ? "number" : b.type === "date" ? "date" : "text"} inputMode={b.type === "number" ? "numeric" : undefined} placeholder={ph}
              value={b.type === "date" ? stored || "" : v} onChange={(e) => c.set(b.q, e.target.value)} />
            {b.type === "text" && b.suffix && <span className="flow-affix">{b.suffix}</span>}
            {b.type === "number" && b.unit && <span className="flow-affix">{b.unit}</span>}
          </div>}
      {b.type === "date" && dateDefault && !stored && <div className="flow-hint">預設是 {dateDefault}（今天＋30 天），可以直接改。</div>}
      {chips.length > 0 && <div className="flow-chips">{b.type === "text" && b.chipsLabel && <span className="flow-hint">{b.chipsLabel}：</span>}{chips.map((t) => <button type="button" key={t} className="flow-chip" onClick={() => c.set(b.q, t)}>{t}</button>)}</div>}
    </Field>
  );
}

function Sentence({ c, b }: { c: Ctx; b: Extract<BlockT, { type: "sentence" }> }) {
  const def = c.spec.questions[b.q];
  const edited = c.st.edited.includes(b.q);
  const derived = def.derived ? c.eng.values[def.derived] : undefined;
  const v = str(c.eng.value(b.q));
  return (
    <Field label={b.title ?? def.label} hint={def.hint}>
      <QuestionGuide c={c} q={b.q} />
      <div className="flow-compose-status"><span className="flow-compose-dot" aria-hidden="true">{edited ? "✎" : "↗"}</span><strong>{edited ? "這句已由你手動調整" : "這句會跟著上面的答案自動組合"}</strong>{!edited && derived?.complete && <span>前面答案已全部帶入</span>}</div>
      {derived?.parts && !edited && (
        <p className="flow-sentence" aria-live="polite">{derived.parts.map((p, i) => <span key={i} className={p.kind === "filled" ? "flow-mark" : p.kind === "blank" ? "flow-blank" : undefined}>{p.text}</span>)}</p>
      )}
      <textarea className="flow-input" rows={b.multiline ? 3 : 2} aria-label={`${b.title ?? def.label}（可修改）`} placeholder={derived?.parts ? "上面是自動組好的句子，可以直接在這裡修改" : undefined} value={edited ? str(c.st.answers[b.q] ?? "") : v} onChange={(e) => c.edit(b.q, e.target.value)} />
      {edited && <button type="button" className="flow-link" onClick={() => c.regen(b.q)}>↻ 重新套用前面答案</button>}
    </Field>
  );
}

function Tone({ text, tone }: { text: string; tone?: "good" | "bad" | "neutral" }) {
  if (!text) return null;
  return <div className={`flow-tone flow-tone-${tone ?? "neutral"}`} role="status">{text.split("\n").map((l, i) => <div key={i}>{l}</div>)}</div>;
}

function Table({ c, b }: { c: Ctx; b: Extract<BlockT, { type: "table" | "tableDynamic" }> }) {
  const t = c.spec.tables[b.table];
  const rows = tableRowCount(t);
  const dyn = b.type === "tableDynamic";
  let extra: { cols: string[]; cells: Record<string, string> } = { cols: [], cells: {} };
  if (dyn) { try { const p = JSON.parse(str(c.st.answers[b.extra] ?? "")); if (p && Array.isArray(p.cols)) extra = { cols: p.cols, cells: p.cells ?? {} }; } catch { /* empty */ } }
  const saveExtra = (n: typeof extra) => c.set(b.type === "tableDynamic" ? b.extra : "", JSON.stringify(n));
  return (
    <div className="flow-field">
      <div className="flow-label">{t.label}</div>
      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead><tr><th>{t.rowLabel ?? "#"}</th>{t.columns.map((col) => <th key={col.id}>{col.label}</th>)}{extra.cols.map((n, i) => <th key={`x${i}`}><input className="flow-input" aria-label="自訂欄位名稱" value={n} onChange={(e) => saveExtra({ ...extra, cols: extra.cols.map((x, j) => (j === i ? e.target.value : x)) })} /></th>)}</tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_v, r) => (
              <tr key={r}>
                <th scope="row">{Array.isArray(t.rows) ? t.rows[r] : r + 1}</th>
                {t.columns.map((col) => {
                  const k = cellKey(b.table, r + 1, col.id);
                  return <td key={col.id} data-label={col.label}><input className="flow-input" inputMode={col.kind === "number" ? "numeric" : undefined} aria-label={`${Array.isArray(t.rows) ? t.rows[r] : `第 ${r + 1} 列`} ${col.label}`} value={str(c.st.answers[k] ?? "")} onChange={(e) => c.set(k, e.target.value)} />
                    {col.chips && <div className="flow-chips">{col.chips.map((x) => <button type="button" key={x} className="flow-chip" onClick={() => c.set(k, x)}>{x}</button>)}</div>}</td>;
                })}
                {extra.cols.map((_n, i) => <td key={`x${i}`}><input className="flow-input" aria-label="自訂欄位數字" value={extra.cells[`${r}:${i}`] ?? ""} onChange={(e) => saveExtra({ ...extra, cells: { ...extra.cells, [`${r}:${i}`]: e.target.value } })} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dyn && <button type="button" className="flow-link" onClick={() => saveExtra({ ...extra, cols: [...extra.cols, ""] })}>＋ 加一欄（流程中間多一關時用）</button>}
    </div>
  );
}

export function BlockView({ b, c, index }: { b: BlockT; c: Ctx; index: number }): ReactNode {
  switch (b.type) {
    case "prose": return <Md>{b.text}</Md>;
    case "quote": return <blockquote className="flow-quote">{b.text}</blockquote>;
    case "callout": return <div className={`flow-callout flow-callout-${b.tone}`}><Md>{b.text}</Md></div>;
    case "details": return <details className="flow-details"><summary>{b.summary}</summary><Md>{b.text}</Md></details>;
    case "lecture": return <Md>{c.lectures[`${c.pageId}#${index}`] ?? ""}</Md>;
    case "choice": return <Choice c={c} q={b.q} />;
    case "pickerGroup": return <div className="flow-picker">{b.items.map((it) => <div key={it.q}><div className="flow-label">{it.title}</div><Choice c={c} q={it.q} compact /></div>)}</div>;
    case "text": case "number": case "date": case "textarea": return <TextInput c={c} b={b} />;
    case "sentence": return <Sentence c={c} b={b} />;
    case "readout": { const d = c.eng.values[b.derived]; return <Field label={b.title}><div className="flow-readout">{d?.parts ? d.parts.map((p, i) => <span key={i} className={p.kind === "filled" ? "flow-mark" : p.kind === "blank" ? "flow-blank" : undefined}>{p.text}</span>) : d?.text || "（還沒有內容）"}</div></Field>; }
    case "check": case "tip": { const d = c.eng.values[b.derived]; return <Tone text={d?.text ?? ""} tone={b.type === "tip" ? "neutral" : d?.tone} />; }
    case "likert": return <div className="flow-field">{b.title && <div className="flow-label">{b.title}</div>}{b.items.map((q) => <div key={q} className="flow-likert"><div className="flow-likert-q">{c.spec.questions[q].label}{c.spec.questions[q].hint && <span className="flow-hint">　{c.spec.questions[q].hint}</span>}</div><QuestionGuide c={c} q={q} /><Choice c={c} q={q} compact /></div>)}</div>;
    case "table": case "tableDynamic": return <Table c={c} b={b} />;
    case "score": { const v = c.eng.values[b.value]; return <div className="flow-score"><div className="flow-score-n">{v?.complete ? v.number : "—"}<small> / {b.total}</small></div><div><strong>{c.eng.values[b.label]?.text}</strong><div>{c.eng.values[b.detail]?.text}</div></div></div>; }
    case "schedule": {
      const done = arr(c.eng.value(b.done));
      return <div className="flow-table-wrap"><table className="flow-table"><thead><tr><th>週次</th><th>日期範圍</th><th>要完成的事</th><th>產出什麼</th><th>完成</th></tr></thead><tbody>{b.weeks.map((w) => <tr key={w.id}><th scope="row">{w.label}</th><td data-label="日期範圍">{c.eng.values[w.derived]?.text || "—"}</td><td data-label="要完成的事">{w.what}</td><td data-label="產出什麼">{w.output}</td><td data-label="完成"><input type="checkbox" aria-label={`${w.label}完成`} checked={done.includes(w.id)} onChange={() => c.set(b.done, toggleMulti(done, w.id))} /></td></tr>)}</tbody></table></div>;
    }
    case "checklist": {
      const def = c.spec.questions[b.q];
      const cur = arr(c.eng.value(b.q));
      return <div className="flow-field">{def.label && <div className="flow-label">{def.label}</div>}<div className="flow-checks">{def.options?.map((o) => {
        const d = b.auto?.[o.id] ? c.eng.values[b.auto[o.id]] : undefined;
        const auto = Boolean(d && d.complete && d.tone !== "bad");
        return <label key={o.id} className="flow-check"><input type="checkbox" checked={cur.includes(o.id)} onChange={() => c.set(b.q, toggleMulti(cur, o.id))} /><span>{o.label}{o.hint && <span className="flow-opt-hint">{o.hint}</span>}{auto && <em className="flow-auto">✓ 依你的答案，這項已經達成</em>}{d && !auto && b.auto && <em className="flow-auto flow-auto-no">目前看起來還沒達成</em>}</span></label>;
      })}</div></div>;
    }
    case "blueprint": return <BlueprintPage c={c} />;
    case "group": return c.eng.cond(b.showWhen) ? <>{b.blocks.map((x, i) => <BlockView key={i} b={x} c={c} index={i} />)}</> : null;
  }
}
