"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractImportedAnswers } from "@/lib/content/importAnswers";
import type { TaskWithFields } from "@/lib/content/taskSections";

type Learner = { id: string; display_name: string | null; role: string };
type Props = { stageKey: string; task: TaskWithFields | undefined; learners: Learner[]; onImported: (fileName: string, learnerName: string, answerCount: number) => void };

export default function AssignmentFileImport({ stageKey, task, learners, onImported }: Props) {
  const supabase = createClient();
  const [learnerId, setLearnerId] = useState(learners[0]?.id ?? "");
  const [status, setStatus] = useState("選擇學員後匯入 .md 或 .txt 作業檔");
  async function importFile(file: File) {
    if (!task || !learnerId) { setStatus("請先選擇學員與任務"); return; }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) { setStatus("目前支援 Markdown 或純文字檔案"); return; }
    const source = await file.text();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setStatus("請先登入教師帳號"); return; }
    const learner = learners.find((item) => item.id === learnerId);
    const answers = extractImportedAnswers(source, task.fields);
    const { data: imported, error: importError } = await supabase.from("assignment_imports").insert({ user_id: learnerId, stage_key: stageKey, file_name: file.name, file_type: file.type || "text/markdown", source_text: source, imported_by: auth.user.id }).select("id").single();
    if (importError || !imported) { setStatus(`匯入檔案失敗：${importError?.message ?? "無法建立匯入紀錄"}`); return; }
    const { error: submissionError } = await supabase.from("submissions").upsert({ user_id: learnerId, course_key: "maker-academy", stage_key: stageKey, task_key: task.key, status: "completed", answer_json: answers, imported_file_id: imported.id, submitted_at: new Date().toISOString(), review_status: "pending" }, { onConflict: "user_id,stage_key,task_key" });
    if (submissionError) { setStatus(`已保存檔案，但建立作業提交失敗：${submissionError.message}`); return; }
    onImported(file.name, learner?.display_name || "指定學員", Object.keys(answers).length);
    setStatus(`已建立 ${learner?.display_name || "學員"} 的作業，共辨識 ${Object.keys(answers).length} 個答案欄位`);
  }
  return <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/60 p-4"><p className="text-sm font-semibold text-teal-950">匯入學員作業並建立提交</p><p className="mt-1 text-xs leading-5 text-teal-800">選擇學員與任務後，系統會辨識勾選項目與表格／文字答案，直接建立一份待批改作業。</p><select aria-label="作業學員" className="mt-3 w-full rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm" value={learnerId} onChange={(event) => setLearnerId(event.target.value)}><option value="">選擇學員</option>{learners.filter((item) => item.role !== "teacher").map((learner) => <option key={learner.id} value={learner.id}>{learner.display_name || `學員 ${learner.id.slice(0, 6)}`}</option>)}</select><label className="mt-3 inline-flex cursor-pointer rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">選擇作業檔<input className="sr-only" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} /></label><p className="mt-2 text-xs text-teal-800">{status}</p></div>;
}
