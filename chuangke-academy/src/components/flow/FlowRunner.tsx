"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Flow, FlowBlock, FlowDocument, FlowPage, Answers } from "@/lib/flow/schema";
import { deriveAll, getAnswer } from "@/lib/flow/derive";
import { createClient } from "@/lib/supabase/client";
import { flowMeta, mergeSubmissionAnswers, parseStoredState, scopedAnswers, type FlowStorageState, type SubmissionRow } from "@/lib/flow/persistence";

type Props = { document: FlowDocument; stageKey: string; workspaceId: string; learnerName?: string };
type SaveSnapshot = { answers: Answers; page: number; mode: string };
const storageKey = (workspaceId: string, stageKey: string) => `chuangke-flow-${workspaceId}-${stageKey}`;

function FlowBlockView({ block, answers, derived, onChange }: { block: FlowBlock; answers: Answers; derived: Record<string, unknown>; onChange: (key: string, value: string | string[]) => void }) {
  const value = block.derive ? getAnswer(answers, derived, block.derive) : (block.key ? answers[block.key] : "");
  const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
  if (block.type === "heading" || block.type === "prose") return <div className={block.type === "heading" ? "flow-block-heading" : "flow-prose"}>{block.prompt}</div>;
  if (block.type === "callout") return <div className="flow-callout"><span>✦</span><div><strong>{block.label}</strong><p>{block.prompt}</p></div></div>;
  if (block.type === "sentence") return <div className="flow-sentence"><span>{String(value || "還沒組好，先完成上面的欄位")}</span><small>可先用自動組句，再依你的說法修改</small></div>;
  if (block.type === "check") { const sentence = String(getAnswer(answers, derived, block.derive)); const count = sentence.replace(/\s/g, "").length; const ok = count > 0 && count <= 25; return <div className={`flow-check ${ok ? "is-good" : "is-neutral"}`}><b>{ok ? "✓" : "○"}</b>{ok ? `目前 ${count} 字，讀起來很清楚` : "填完上面的欄位後，這裡會即時幫你檢查"}</div>; }
  if (block.type === "choice") return <fieldset className="flow-fieldset"><legend>{block.label}</legend>{block.description && <p className="flow-hint">{block.description}</p>}<div className="flow-options">{(block.options ?? []).map((option) => { const active = selected.includes(option.id) || selected.includes(option.label); return <button type="button" key={option.id} aria-pressed={active} className={`flow-option ${active ? "is-selected" : ""}`} onClick={() => { const next = block.multiple ? (active ? selected.filter((item) => item !== option.id && item !== option.label) : [...selected, option.label]) : [option.label]; onChange(block.key ?? "", block.multiple ? next : next[0]); }}><span className="flow-option-mark">{active ? "✓" : ""}</span><span><b>{option.label}</b>{option.hint && <small>{option.hint}</small>}</span></button>; })}</div></fieldset>;
  if (block.type === "blueprint") return <div className="flow-blueprint">{Object.entries(derived).filter(([key]) => key.startsWith("stage1.")).map(([key, item]) => <div className="flow-blueprint-card" key={key}><small>{key.replace("stage1.", "")}</small><p>{Array.isArray(item) ? item.join("、") : String(item || "暫定")}</p></div>)}</div>;
  if (block.type === "lecture") return <div className="flow-prose">{block.prompt}</div>;
  const inputValue = String(block.key ? answers[block.key] ?? "" : "");
  return <label className="flow-input-label">{block.label}<span>{block.type === "textarea" ? <textarea value={inputValue} placeholder={block.placeholder} rows={4} onChange={(event) => onChange(block.key ?? "", event.target.value)} /> : <input value={inputValue} placeholder={block.placeholder} onChange={(event) => onChange(block.key ?? "", event.target.value)} />}</span></label>;
}

export default function FlowRunner({ document, stageKey, workspaceId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState("self_study");
  const flow: Flow = document.flows[mode] ?? document.flows.self_study;
  const pages = flow.pages.length ? flow.pages : document.flows.self_study.pages;
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saved, setSaved] = useState("正在載入進度…");
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const answersRef = useRef(answers);
  const pageRef = useRef(pageIndex);
  const modeRef = useRef(mode);
  const pendingRef = useRef<SaveSnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const page: FlowPage = pages[pageIndex] ?? pages[0];
  const derived = useMemo(() => deriveAll(document, answers), [document, answers]);

  const localState = useCallback((snapshot: SaveSnapshot) => {
    const state: FlowStorageState = { answers: snapshot.answers, page: snapshot.page, mode: snapshot.mode, edited: [] };
    window.localStorage.setItem(storageKey(workspaceId, stageKey), JSON.stringify(state));
  }, [stageKey, workspaceId]);

  const flushRemote = useCallback(async () => {
    if (savingRef.current || !pendingRef.current || !userId) return;
    const snapshot = pendingRef.current;
    pendingRef.current = null;
    savingRef.current = true;
    const scoped = scopedAnswers(document, snapshot.answers, pages[snapshot.page]?.id ?? page.id);
    const payload = { user_id: userId, course_key: "maker-academy", stage_key: stageKey, task_key: scoped.taskKey, status: "draft" as const, answer_json: { ...scoped.answers, ...flowMeta(snapshot.page, snapshot.mode) }, submitted_at: null, workspace_id: workspaceId };
    const { error } = await supabase.from("submissions").upsert(payload, { onConflict: "workspace_id,stage_key,task_key" });
    savingRef.current = false;
    if (!mountedRef.current) return;
    if (error) {
      pendingRef.current = snapshot;
      retryCountRef.current += 1;
      const retryDelay = Math.min(1000 * 2 ** Math.min(retryCountRef.current - 1, 3), 8000);
      setSaved(`尚未同步，${Math.round(retryDelay / 1000)} 秒後重試`);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => { void flushRemote(); }, retryDelay);
      return;
    }
    retryCountRef.current = 0;
    setSaved("已同步");
    if (pendingRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void flushRemote(); }, 600);
    }
  }, [document, page, pages, stageKey, supabase, userId, workspaceId]);

  const queueSave = useCallback((snapshot: SaveSnapshot) => {
    localState(snapshot);
    if (!userId) { setSaved("已保存到此瀏覽器；登入後可同步"); return; }
    pendingRef.current = snapshot;
    setSaved("等待同步…");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flushRemote(); }, 600);
  }, [flushRemote, localState, userId]);

  useEffect(() => {
    mountedRef.current = true;
    const local = parseStoredState(window.localStorage.getItem(storageKey(workspaceId, stageKey)));
    if (local) { setAnswers(local.answers); setPageIndex(Math.min(Math.max(local.page, 0), pages.length - 1)); setMode(local.mode); setSaved("已載入本機草稿，正在檢查雲端…"); }
    let alive = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!alive) return;
      setUserId(auth.user?.id ?? null);
      if (!auth.user) { setHydrated(true); if (!local) setSaved("已保存到此瀏覽器；登入後可同步"); return; }
      const { data, error } = await supabase.from("submissions").select("stage_key,task_key,answer_json").eq("workspace_id", workspaceId).eq("stage_key", stageKey);
      if (!alive) return;
      if (error) { setHydrated(true); setSaved("雲端載入失敗，仍可離線編輯"); return; }
      const remote = mergeSubmissionAnswers(document, (data ?? []) as SubmissionRow[]);
      setAnswers((current) => ({ ...remote, ...(local?.answers ?? {}), ...current }));
      setHydrated(true);
      setSaved("已載入雲端進度");
    })();
    return () => { alive = false; mountedRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, [document, pages.length, stageKey, supabase, workspaceId]);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { pageRef.current = pageIndex; }, [pageIndex]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { if (!hydrated) return; queueSave({ answers, page: pageIndex, mode }); }, [answers, mode, pageIndex, hydrated, queueSave]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.target as HTMLElement).matches("input,textarea,select")) return; if (event.key === "ArrowRight") setPageIndex((index) => Math.min(index + 1, pages.length - 1)); if (event.key === "ArrowLeft") setPageIndex((index) => Math.max(index - 1, 0)); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [pages.length]);

  const update = (key: string, value: string | string[]) => setAnswers((current) => ({ ...current, [key]: value }));
  const save = () => queueSave({ answers: answersRef.current, page: pageRef.current, mode: modeRef.current });
  const copy = async () => { const text = Object.entries({ ...answers, ...derived }).filter(([key]) => !key.startsWith("_flow")).map(([key, value]) => `${key}\n${Array.isArray(value) ? value.join("、") : String(value ?? "暫定")}`).join("\n\n"); try { await navigator.clipboard.writeText(text); setSaved("已複製全部答案"); } catch { setSaved("複製失敗，請手動選取內容"); } };
  const currentPart = flow.parts.find((part) => part.pageIds.includes(page.id));

  return <div className="flow-root"><header className="flow-topbar"><a href="/app" className="flow-brand"><span>創</span>創客學院</a><div className="flow-status"><span className="flow-save-dot" />{saved}</div></header><main className="flow-shell"><div className="flow-kicker">階段一 · {document.title}</div><div className="flow-layout"><aside className="flow-aside"><div className="flow-mode"><span>模式</span><button type="button" onClick={() => { setMode(mode === "self_study" ? "consult_session" : "self_study"); setPageIndex(0); }}>{mode === "self_study" ? "自學版" : "諮詢版"}</button></div><nav className="flow-parts" aria-label="流程進度">{flow.parts.map((part) => <button type="button" key={part.id} className={currentPart?.id === part.id ? "is-active" : ""} onClick={() => setPageIndex(Math.max(0, pages.findIndex((item) => part.pageIds.includes(item.id))))}><span>{part.label}</span><i>{part.pageIds.length} 頁</i></button>)}</nav><div className="flow-aside-note">← → 也可以換頁<br />輸入框內不會誤觸<br />修改後 0.6 秒自動同步</div></aside><section className="flow-sheet"><div className="flow-progress"><span>{pageIndex + 1} / {pages.length}</span><div><i style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }} /></div></div><p className="flow-page-label">{currentPart?.label ?? "流程"}</p><h1>{page.title}</h1>{page.description && <p className="flow-page-description">{page.description}</p>}<div className="flow-blocks">{page.blocks.map((block, index) => <FlowBlockView key={`${page.id}-${index}`} block={block} answers={answers} derived={derived} onChange={update} />)}</div><footer className="flow-actions"><button type="button" className="flow-secondary" onClick={save}>立即保存</button>{pageIndex === pages.length - 1 && <button type="button" className="flow-secondary" onClick={copy}>複製全部答案</button>}<div className="flow-spacer" /><button type="button" className="flow-secondary" disabled={pageIndex === 0} onClick={() => setPageIndex((index) => index - 1)}>上一步</button><button type="button" className="flow-primary" onClick={() => { save(); setPageIndex((index) => Math.min(index + 1, pages.length - 1)); }}>{pageIndex === pages.length - 1 ? "完成第一版藍圖" : "下一步 →"}</button></footer></section></div></main></div>;
}
