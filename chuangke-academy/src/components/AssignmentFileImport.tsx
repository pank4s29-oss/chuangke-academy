"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractImportedAnswers } from "@/lib/content/importAnswers";
import type { TaskWithFields } from "@/lib/content/taskSections";

type Props = { stageKey: string; tasks: TaskWithFields[]; onImported: (fileName: string, learnerName: string, answerCount: number, taskCount: number) => void };

export default function AssignmentFileImport({ stageKey, tasks, onImported }: Props) {
  const supabase = createClient();
  const [learnerName, setLearnerName] = useState("");
  const [status, setStatus] = useState("輸入學員名稱後匯入整個階段的 .md 或 .txt 作業檔");

  async function importFile(file: File) {
    if (!tasks.length || !learnerName.trim()) { setStatus("請先輸入學員名稱與確認階段內容"); return; }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) { setStatus("目前支援 Markdown 或純文字檔案"); return; }
    const source = await file.text();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setStatus("請先登入教師帳號"); return; }
    const name = learnerName.trim();
    const allFields = tasks.flatMap((task) => task.fields);
    const answers = extractImportedAnswers(source, allFields);
    const { data: imported, error: importError } = await supabase.from("assignment_imports").insert({ user_id: null, learner_name: name, stage_key: stageKey, file_name: file.name, file_type: file.type || "text/markdown", source_text: source, imported_by: auth.user.id }).select("id").single();
    if (importError || !imported) { setStatus(`匯入檔案失敗：${importError?.message ?? "無法建立匯入紀錄"}`); return; }
    for (const task of tasks) {
      const taskAnswers = Object.fromEntries(Object.entries(answers).filter(([key]) => task.fields.some((field) => field.key === key || field.otherFor === key)));
      const { error } = await supabase.from("submissions").insert({ user_id: null, learner_name: name, course_key: "maker-academy", stage_key: stageKey, task_key: task.key, status: "completed", answer_json: taskAnswers, imported_file_id: imported.id, submitted_at: new Date().toISOString(), review_status: "pending" });
      if (error) { setStatus(`檔案已保存，但建立「${task.title}」提交失敗：${error.message}`); return; }
    }
    onImported(file.name, name, Object.keys(answers).length, tasks.length);
    setStatus(`已建立「${name}」的完整階段作業，共 ${tasks.length} 個任務、${Object.keys(answers).length} 個答案欄位`);
    setLearnerName("");
  }

  return <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/60 p-4"><p className="text-sm font-semibold text-teal-950">匯入整個階段作業</p><p className="mt-1 text-xs leading-5 text-teal-800">一次讀取整份階段作業，系統會依照任務分配答案，並建立完整階段藍圖。</p><input aria-label="學員名稱" className="mt-3 w-full rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm" placeholder="例如：王小明／A 顧問班 03" value={learnerName} onChange={(event) => setLearnerName(event.target.value)} /><label className="mt-3 inline-flex cursor-pointer rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">選擇整階段作業檔<input className="sr-only" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} /></label><p className="mt-2 text-xs text-teal-800">{status}</p></div>;
}
