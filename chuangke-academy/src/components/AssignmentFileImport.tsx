"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { stageKey: string; onImported: (source: string, fileName: string) => void };

export default function AssignmentFileImport({ stageKey, onImported }: Props) {
  const supabase = createClient();
  const [status, setStatus] = useState("可匯入 .md 或 .txt 作業檔");
  async function importFile(file: File) {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) { setStatus("目前支援 Markdown 或純文字檔案"); return; }
    const source = await file.text();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setStatus("登入後才能保存匯入檔案"); onImported(source, file.name); return; }
    const { error } = await supabase.from("assignment_imports").insert({ user_id: auth.user.id, stage_key: stageKey, file_name: file.name, file_type: file.type || "text/markdown", source_text: source, imported_by: auth.user.id });
    if (error) { setStatus(`匯入失敗：${error.message}`); return; }
    onImported(source, file.name);
    setStatus(`已匯入 ${file.name}`);
  }
  return <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-teal-950">匯入學員作業檔</p><p className="mt-1 text-xs leading-5 text-teal-800">老師可代替學員匯入 Markdown／TXT，再交由系統解析成結構化答案。</p></div><label className="cursor-pointer rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">選擇檔案<input className="sr-only" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} /></label></div><p className="mt-2 text-xs text-teal-800">{status}</p></div>;
}
