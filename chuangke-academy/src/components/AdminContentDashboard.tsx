"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Stage = { id: string; stage_key: string; title: string; position: number };
type Version = { id: string; stage_id: string; status: "draft" | "published" | "archived"; version_number: number; source_hash: string; parser_version: string; source_file_set: { name?: string }[]; content_json: { sourceMarkdown?: string; validation?: { warnings: string[]; errors: string[] } }; created_at: string };
type Job = { id: string; stage_key?: string; status: string; warning_count: number; error_count: number; started_at: string; completed_at: string | null };

function validateMarkdown(source: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!source.trim()) errors.push("來源內容不可為空");
  if (!/^#\s+/m.test(source)) errors.push("找不到任務標題（# 任務…）");
  if (!/作業|題目|步驟/.test(source)) warnings.push("內容中未偵測到常見作業結構，請在預覽確認");
  if ((source.match(/\[\[[^\]]+\]\]/g) ?? []).length) warnings.push("偵測到可能未解析的雙括號標記");
  return { errors, warnings };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function AdminContentDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stageKey, setStageKey] = useState("stage-01");
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("");
  const [selected, setSelected] = useState<Version | null>(null);
  const [status, setStatus] = useState("載入管理資料…");
  const [busy, setBusy] = useState(false);
  const stage = stages.find((item) => item.stage_key === stageKey);
  const selectedStageVersions = versions.filter((item) => item.stage_id === stage?.id);
  const report = useMemo(() => validateMarkdown(source), [source]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setAllowed(false); setStatus("請先登入 Admin 帳號"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    if (profile?.role !== "admin") { setAllowed(false); setStatus("此頁面僅限 Admin 帳號"); return; }
    setAllowed(true);
    const [{ data: stageRows, error: stageError }, { data: versionRows, error: versionError }, { data: jobRows }] = await Promise.all([
      supabase.from("stages").select("id,stage_key,title,position").order("position"),
      supabase.from("content_versions").select("id,stage_id,status,version_number,source_hash,parser_version,source_file_set,content_json,created_at").order("created_at", { ascending: false }),
      supabase.from("content_import_jobs").select("id,stage_key,status,warning_count,error_count,started_at,completed_at").order("started_at", { ascending: false }).limit(20),
    ]);
    if (stageError || versionError) { setStatus(`載入失敗：${stageError?.message ?? versionError?.message}`); return; }
    setStages((stageRows ?? []) as Stage[]); setVersions((versionRows ?? []) as Version[]); setJobs((jobRows ?? []) as Job[]); setStatus("Admin 內容管理已就緒");
  }, [supabase]);
  useEffect(() => { void load(); }, [load]);

  async function importDraft(file?: File) {
    if (!file || !stage) return;
    setBusy(true); setStatus("正在建立 Draft…");
    const text = await file.text();
    const validation = validateMarkdown(text);
    const hash = await sha256(text);
    const stageVersions = versions.filter((item) => item.stage_id === stage.id);
    const nextVersion = Math.max(0, ...stageVersions.map((item) => item.version_number)) + 1;
    const { data: auth } = await supabase.auth.getUser();
    const { data: job, error: jobError } = await supabase.from("content_import_jobs").insert({ repository: "admin-upload", stage_key: stageKey, commit_sha: hash.slice(0, 12), mode: "draft", status: validation.errors.length ? "failed" : validation.warnings.length ? "warning" : "completed", manifest_json: { stageKey, fileName: file.name }, warning_count: validation.warnings.length, error_count: validation.errors.length, completed_at: new Date().toISOString() }).select("id").single();
    if (jobError) { setBusy(false); setStatus(`匯入紀錄失敗：${jobError.message}`); return; }
    if (validation.errors.length) { setBusy(false); setStatus(`驗證失敗：${validation.errors.join("、")}`); return; }
    const { data: created, error } = await supabase.from("content_versions").insert({ stage_id: stage.id, status: "draft", version_number: nextVersion, source_hash: hash, parser_version: "markdown-admin-v1", source_file_set: [{ name: file.name }], content_json: { sourceMarkdown: text, validation, importedBy: auth.user?.id, importJobId: job?.id } }).select("id,stage_id,status,version_number,source_hash,parser_version,source_file_set,content_json,created_at").single();
    setBusy(false);
    if (error || !created) { setStatus(`Draft 建立失敗：${error?.message ?? "未知錯誤"}`); return; }
    setSource(text); setFileName(file.name); setSelected(created as Version); setStatus(`Draft v${nextVersion} 已建立；請先預覽並通過驗證，再發布。`); await load();
  }

  async function publish(version: Version) {
    if (!stage || version.status !== "draft") return;
    const validation = version.content_json?.validation ?? { errors: [], warnings: [] };
    if (validation.errors?.length) { setStatus("此版本仍有錯誤，不能發布"); return; }
    if (!window.confirm(`確定發布 ${stage.title} v${version.version_number}？目前 published 版本會保留為 archived。`)) return;
    setBusy(true);
    await supabase.from("content_versions").update({ status: "archived" }).eq("stage_id", stage.id).eq("status", "published");
    const { error } = await supabase.from("content_versions").update({ status: "published" }).eq("id", version.id).eq("status", "draft");
    setBusy(false); setStatus(error ? `發布失敗：${error.message}` : `已發布 ${stage.title} v${version.version_number}`); await load();
  }

  if (allowed === false) return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] px-5"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200"><p className="text-sm font-semibold text-rose-600">無法進入 Admin 後台</p><h1 className="mt-3 text-2xl font-bold">{status}</h1><Link href="/app" className="mt-6 inline-block rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white">返回學員端</Link></div></main>;
  if (allowed === null) return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] text-sm text-slate-500">{status}</main>;
  return <main className="min-h-screen bg-[#f5f7f4] text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Content operations</p><h1 className="mt-1 text-2xl font-bold">Admin 內容管理後台</h1></div><div className="flex gap-4 text-sm"><Link href="/teacher" className="font-semibold text-slate-600">教師批改</Link><Link href="/app" className="font-semibold text-teal-700">學員端</Link></div></div></header><div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8"><aside className="rounded-3xl bg-slate-900 p-4 text-white"><p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Admin workflow</p><nav className="mt-4 space-y-1 text-sm"><a href="#content" className="block rounded-xl bg-white/10 px-3 py-3 font-semibold">內容清單</a><a href="#import" className="block rounded-xl px-3 py-3 text-slate-300 hover:bg-white/10">匯入 Draft</a><a href="#preview" className="block rounded-xl px-3 py-3 text-slate-300 hover:bg-white/10">預覽／驗證</a><a href="#history" className="block rounded-xl px-3 py-3 text-slate-300 hover:bg-white/10">版本歷史</a></nav></aside><section className="space-y-6"><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" id="content"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold text-teal-700">T10.2 Content list</p><h2 className="mt-1 text-xl font-bold">內容清單</h2><p className="mt-2 text-sm text-slate-500">每個 Stage 都以 Draft → Preview → Validate → Publish 管理，已發布版本不直接覆寫。</p></div><select value={stageKey} onChange={(event) => setStageKey(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{stages.map((item) => <option key={item.stage_key} value={item.stage_key}>{item.title}（{item.stage_key}）</option>)}</select></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Draft</p><strong className="mt-1 block text-2xl">{selectedStageVersions.filter((item) => item.status === "draft").length}</strong></div><div className="rounded-2xl bg-teal-50 p-4"><p className="text-xs text-teal-700">Published</p><strong className="mt-1 block text-2xl text-teal-800">{selectedStageVersions.filter((item) => item.status === "published").length}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">History</p><strong className="mt-1 block text-2xl">{selectedStageVersions.length}</strong></div></div></div><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" id="import"><p className="text-sm font-bold text-teal-700">T10.3 Import screen</p><h2 className="mt-1 text-xl font-bold">匯入 Markdown Draft</h2><p className="mt-2 text-sm leading-6 text-slate-600">上傳完整 Stage 原始檔，系統會計算 source hash、建立匯入紀錄、執行基礎驗證並保存 Draft。匯入不會直接發布。</p><label className="mt-5 inline-flex cursor-pointer rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white">選擇 Markdown 檔案<input className="sr-only" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importDraft(file); event.currentTarget.value = ""; }} /></label>{fileName && <span className="ml-3 text-sm text-slate-600">最近匯入：{fileName}</span>}<p className="mt-3 text-sm text-teal-800">{status}</p></div><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" id="preview"><p className="text-sm font-bold text-teal-700">T10.4–T10.6 Preview / Validate / Publish</p><h2 className="mt-1 text-xl font-bold">預覽、驗證與發布</h2>{selected ? <><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><strong>{stage?.title} v{selected.version_number}</strong><p className="mt-1 text-xs text-slate-500">{selected.status} · hash {selected.source_hash.slice(0, 16)}…</p></div><button disabled={busy || selected.status !== "draft"} onClick={() => void publish(selected)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">發布此版本</button></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div><h3 className="font-semibold">Validation report</h3><p className="mt-2 text-sm text-rose-700">{report.errors.length ? report.errors.join("、") : "沒有阻擋性錯誤"}</p><p className="mt-1 text-sm text-amber-700">{report.warnings.length ? report.warnings.join("、") : "沒有警告"}</p></div><pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{selected.content_json?.sourceMarkdown ?? source}</pre></div></> : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">先從內容歷史選擇版本，或上傳新的 Markdown Draft。</p>}</div><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" id="history"><p className="text-sm font-bold text-teal-700">T10.7 Version history</p><h2 className="mt-1 text-xl font-bold">版本歷史</h2><div className="mt-4 space-y-2">{selectedStageVersions.map((version) => <button key={version.id} onClick={() => { setSelected(version); setSource(version.content_json?.sourceMarkdown ?? ""); }} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${selected?.id === version.id ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><span><strong>v{version.version_number}</strong><span className="ml-3 text-sm text-slate-500">{version.source_file_set?.[0]?.name ?? "來源檔案"}</span></span><span className="text-xs font-semibold uppercase text-slate-500">{version.status}</span></button>)}{!selectedStageVersions.length && <p className="text-sm text-slate-500">目前尚無版本。</p>}</div><h3 className="mt-7 font-semibold">Import history</h3><div className="mt-3 space-y-2">{jobs.slice(0, 8).map((job) => <div key={job.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span>{job.stage_key ?? "Stage"} · {job.status}</span><span>警告 {job.warning_count}／錯誤 {job.error_count}</span></div>)}</div></div></section></div></main>;
}
