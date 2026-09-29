"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FLOW_META_KEY, loadState, mergeRows, serializeState, type FlowMeta, type RawAnswers } from "@/lib/flow/alias";
import { createEngine } from "@/lib/flow/derive";
import { flowPages } from "@/lib/flow/schema";
import type { FlowSpec } from "@/lib/flow/schema";
import { editDerived, regenerate, setAnswer } from "@/lib/flow/state";
import type { AnswerValue, FlowState } from "@/lib/flow/types";
import { BlockView, type Ctx } from "./blocks";

type Props = { spec: FlowSpec; lectures: Record<string, string>; stageKey: string; courseKey: string; workspaceId: string; learnHref: string; nextHref: string };
type Row = { task_key: string; status: string; answer_json: unknown; submitted_at?: string | null };
type Sync = "loading" | "saved" | "saving" | "error" | "local" | "dirty";

const SYNC_TEXT: Record<Sync, string> = { loading: "載入中…", saved: "已同步", saving: "儲存中…", error: "尚未同步（按「重試」）", local: "未登入：只存在這個瀏覽器", dirty: "有變更，儲存中…" };

function bridgeStageOneAnswers(stageKey: string, raw: RawAnswers): { raw: RawAnswers; count: number } {
  if (stageKey !== "stage-02") return { raw, count: 0 };
  const mappings: Record<string, string> = {
    "stage2.t21.q1": "stage1.t1.b.quote",
    "stage2.t21.q4": "stage1.t2.a.top",
    "stage2.t22.q1": "stage1.t1.a.identity",
    "stage2.t22.q13": "stage1.t1.b.sentence",
    "stage2.t23.q13": "stage1.t1.a.identity",
    "stage2.t23.q25": "stage1.t1.c.sentence_a",
    "stage2.t24.q14": "stage1.t1.a.sentence",
    "stage2.t25.q31": "stage1.t1.b.to",
  };
  let count = 0;
  const next = { ...raw };
  for (const [target, source] of Object.entries(mappings)) {
    if (next[target] === undefined && raw[source] !== undefined && raw[source] !== "") { next[target] = raw[source]; count++; }
  }
  return { raw: next, count };
}

export default function FlowRunner({ spec, lectures, stageKey, courseKey, workspaceId, learnHref, nextHref }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const flowIds = Object.keys(spec.flows);
  const [flowId, setFlowId] = useState(flowIds[0]);
  const [st, setSt] = useState<FlowState>({ answers: {}, edited: [] });
  const [pageId, setPageId] = useState<string>("");
  const [sync, setSync] = useState<Sync>("loading");
  const [ready, setReady] = useState(false);
  const [prefilled, setPrefilled] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const rows = useRef<Record<string, Row>>({});
  const lastSaved = useRef<Record<string, string>>({});
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const localKey = `chuangke-flow-${workspaceId}-${stageKey}`;
  const rootRef = useRef<HTMLDivElement>(null);

  const eng = useMemo(() => createEngine(spec, st), [spec, st]);
  const flow = spec.flows[flowId];
  const visible = useMemo(() => flowPages(flow).filter((id) => { const p = spec.pages[id]; return p && (!p.showWhen || eng.cond(p.showWhen)); }), [flow, spec, eng]);
  const pos = Math.max(0, visible.indexOf(pageId));
  const page = spec.pages[visible[pos]];
  const current = visible[pos];
  const partIndex = flow.parts.findIndex((p) => p.pages.includes(current));
  const taskOfPage = useCallback((id: string) => spec.tasks[id.split(".")[1]] ?? Object.values(spec.tasks)[0], [spec]);

  // ---- load (alias-aware: old positional keys are read, never deleted) ----
  useEffect(() => {
    let alive = true;
    (async () => {
      let raw: RawAnswers = {};
      try { const l = window.localStorage.getItem(`chuangke-draft-${workspaceId}-${stageKey}`); if (l) raw = { ...raw, ...JSON.parse(l) }; } catch { /* ignore */ }
      try { const l = window.localStorage.getItem(localKey); if (l) raw = { ...raw, ...JSON.parse(l) }; } catch { /* ignore */ }
      if (stageKey === "stage-02") {
        try { const l = window.localStorage.getItem(`chuangke-flow-${workspaceId}-stage-01`); if (l) raw = { ...raw, ...JSON.parse(l) }; } catch { /* ignore */ }
      }
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!alive) return;
      setUserId(uid);
      if (uid) {
        const { data, error } = await supabase.from("submissions").select("task_key,status,answer_json,submitted_at").eq("workspace_id", workspaceId).eq("stage_key", stageKey);
        if (error) { setSync("error"); }
        for (const r of (data ?? []) as Row[]) rows.current[r.task_key] = r;
        raw = { ...raw, ...mergeRows((data ?? []) as Row[]) };
        for (const [t, r] of Object.entries(rows.current)) lastSaved.current[t] = JSON.stringify(r.answer_json ?? {});
      }
      const bridged = bridgeStageOneAnswers(stageKey, raw);
      const { state, meta } = loadState(spec, bridged.raw);
      if (!alive) return;
      setSt(state);
      const mode = meta.mode && spec.flows[meta.mode] ? meta.mode : flowIds[0];
      setFlowId(mode);
      const first = flowPages(spec.flows[mode])[0];
      setPageId(meta.page && flowPages(spec.flows[mode]).includes(meta.page) ? meta.page : first);
      setPrefilled(bridged.count);
      setSync(uid ? "saved" : "local");
      setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- save (single write point, debounced; failures are visible and retried) ----
  const persist = useCallback(async (): Promise<void> => {
    const meta: FlowMeta = { page: current, mode: flowId };
    const out = serializeState(spec, st, eng.value, meta, taskOfPage(current));
    try { window.localStorage.setItem(localKey, JSON.stringify(Object.assign({}, ...Object.values(out)))); } catch { /* storage full / blocked */ }
    if (!userId) { setSync("local"); dirty.current = false; return; }
    setSync("saving");
    let failed = false;
    for (const [task, payload] of Object.entries(out)) {
      // Merge onto what the row already holds so no legacy answer can ever be dropped (R-7).
      const merged = { ...((rows.current[task]?.answer_json as RawAnswers | undefined) ?? {}), ...payload };
      const json = JSON.stringify(merged);
      if (lastSaved.current[task] === json) continue;
      const existing = rows.current[task];
      const { error } = await supabase.from("submissions").upsert({ user_id: userId, course_key: courseKey, stage_key: stageKey, task_key: task, workspace_id: workspaceId, status: existing?.status ?? "draft", answer_json: merged, submitted_at: existing?.submitted_at ?? null }, { onConflict: "workspace_id,stage_key,task_key" });
      if (error) { failed = true; console.error("flow save failed", task, error.message); continue; }
      rows.current[task] = { task_key: task, status: existing?.status ?? "draft", answer_json: merged, submitted_at: existing?.submitted_at ?? null };
      lastSaved.current[task] = json;
    }
    dirty.current = failed;
    setSync(failed ? "error" : "saved");
  }, [spec, st, eng, current, flowId, userId, supabase, courseKey, stageKey, workspaceId, taskOfPage, localKey]);

  useEffect(() => {
    if (!ready) return;
    dirty.current = true;
    setSync((s) => (s === "local" ? s : "dirty"));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void persist(); }, 600);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [st, current, flowId, ready, persist]);
  useEffect(() => {
    const online = () => { if (dirty.current) void persist(); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [persist]);

  // ---- navigation ----
  const go = useCallback((delta: number) => {
    const n = Math.min(visible.length - 1, Math.max(0, pos + delta));
    setPageId(visible[n]);
    rootRef.current?.scrollIntoView({ block: "start" });
  }, [pos, visible]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const ctx: Ctx = useMemo(() => ({
    spec, eng, st, lectures, pageId: current ?? "",
    set: (k: string, v: AnswerValue) => setSt((s) => setAnswer(s, k, v)),
    edit: (k: string, t: string) => setSt((s) => editDerived(s, k, t)),
    regen: (k: string) => setSt((s) => regenerate(s, k)),
  }), [spec, eng, st, lectures, current]);

  function switchFlow(id: string) {
    setFlowId(id);
    const ids = flowPages(spec.flows[id]);
    setPageId(ids.includes(current) ? current : ids[0]);
  }

  if (!ready || !page) return <div className="flow-root"><div className="flow-shell"><p className="flow-hint">載入中…</p></div></div>;
  const partPages = flow.parts[partIndex]?.pages.filter((id) => visible.includes(id)) ?? [];
  const inPart = Math.max(0, partPages.indexOf(current));
  const isLast = pos === visible.length - 1;

  return (
    <div className="flow-root" ref={rootRef}>
      <header className="flow-top">
        <div className="flow-top-row">
          <div className="flow-brand" aria-label="創客學院課程工作單"><strong>創客學院</strong><span aria-hidden="true">｜</span><span>{spec.title}</span></div>
          <div className="flow-top-actions"><Link href={learnHref} className="flow-link">回到一般作答</Link><span className={`flow-sync flow-sync-${sync}`} role="status">{SYNC_TEXT[sync]}{sync === "error" && <button type="button" className="flow-link" onClick={() => void persist()}>重試</button>}</span></div>
        </div>
        <nav className="flow-parts" aria-label="進度">
          {flow.parts.map((p, i) => {
            const ids = p.pages.filter((id) => visible.includes(id));
            const reached = ids.filter((id) => visible.indexOf(id) <= pos).length;
            const pct = i < partIndex ? 100 : i === partIndex ? Math.round(((inPart + 1) / Math.max(1, ids.length)) * 100) : 0;
            return <button type="button" key={p.label} className={`flow-part${i === partIndex ? " is-current" : ""}`} onClick={() => ids[0] && setPageId(ids[0])} aria-current={i === partIndex} title={`${reached}/${ids.length}`}><span className="flow-part-bar"><span style={{ width: `${pct}%` }} /></span><span className="flow-part-name">{p.label}</span></button>;
          })}
        </nav>
        {prefilled > 0 && stageKey === "stage-02" && <div className="flow-prefill" role="status">已從階段一帶入 {prefilled} 個可修改答案；請逐格確認後再繼續。</div>}
        {flowIds.length > 1 && <div className="flow-modes" role="group" aria-label="流程版本">{flowIds.map((id) => <button type="button" key={id} className="flow-chip" aria-pressed={id === flowId} onClick={() => switchFlow(id)}>{spec.flows[id].label}</button>)}</div>}
      </header>
      <main className="flow-shell">
        <article className="flow-sheet" aria-labelledby="flow-title">
          <div className="flow-eyebrow">{flow.parts[partIndex]?.label}　{inPart + 1} / {partPages.length}</div>
          <h1 id="flow-title" className="flow-title">{page.title}</h1>
          {page.blocks.map((b, i) => <BlockView key={`${current}-${i}`} b={b} c={ctx} index={i} />)}
        </article>
        <div className="flow-nav">
          <button type="button" className="flow-btn flow-btn-ghost" disabled={pos === 0} onClick={() => go(-1)}>← 上一頁</button>
          <span className="flow-hint">第 {pos + 1} / {visible.length} 頁　·　可用 ← → 鍵換頁</span>
          {isLast ? <Link className="flow-btn" href={nextHref}>前往下一階段 →</Link> : <button type="button" className="flow-btn" onClick={() => go(1)}>下一頁 →</button>}
        </div>
      </main>
    </div>
  );
}
export { FLOW_META_KEY };
