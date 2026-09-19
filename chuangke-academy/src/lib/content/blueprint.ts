import type { AssignmentField, TaskWithFields } from "./taskSections";

export type AnswerValue = string | string[] | undefined;
export type BlueprintSection = { title: string; items: { label: string; value: string }[] };

export function answerText(value: AnswerValue, labels: Record<string, string> = {}) {
  if (Array.isArray(value)) return value.map((item) => labels[item] ?? item).join("、");
  return String(value ?? "").trim();
}

function isFieldFilled(field: AssignmentField, value: AnswerValue) {
  if (Array.isArray(value)) return value.length > 0;
  return String(value ?? "").trim().length > 0;
}

/**
 * Turn a learner's raw answers into short, actionable notes a consultant/
 * teacher can act on directly, instead of a static "how to use this" line.
 * This stays deterministic and rule-based (no external AI call) so it works
 * offline and is easy to reason about; it can later be swapped for an LLM
 * call without changing the caller.
 */
export function buildAdvisorInsights(stageTitle: string, tasks: TaskWithFields[], answers: Record<string, AnswerValue>) {
  let totalFields = 0;
  let answeredFields = 0;
  const gapsByTask: { title: string; missingPrompts: string[] }[] = [];

  tasks.forEach((task) => {
    const missingPrompts: string[] = [];
    task.fields.forEach((field) => {
      totalFields += 1;
      if (isFieldFilled(field, answers[field.key])) {
        answeredFields += 1;
      } else {
        missingPrompts.push(field.prompt);
      }
    });
    if (missingPrompts.length > 0) gapsByTask.push({ title: task.title, missingPrompts });
  });

  const percent = totalFields ? Math.round((answeredFields / totalFields) * 100) : 0;
  const items: { label: string; value: string }[] = [
    { label: "填寫完成度", value: `${answeredFields} / ${totalFields}（約 ${percent}%）` },
  ];

  if (totalFields === 0) {
    items.push({ label: "顧問建議", value: "這個階段目前沒有可辨識的作答欄位，請確認講義／作業的 Markdown 格式，或聯絡系統管理員檢查解析結果。" });
    return items;
  }

  if (gapsByTask.length === 0) {
    items.push({ label: "顧問建議", value: `${stageTitle} 各任務欄位皆已填寫完成，可直接安排下一次對談或進入下一階段。` });
    return items;
  }

  const worstTask = [...gapsByTask].sort((a, b) => b.missingPrompts.length - a.missingPrompts.length)[0];
  const taskSummary = gapsByTask.map((gap) => `「${gap.title}」還有 ${gap.missingPrompts.length} 題未完成`).join("；");

  items.push({
    label: "顧問建議",
    value:
      gapsByTask.length === 1
        ? `建議先請學員補齊「${worstTask.title}」剩下的 ${worstTask.missingPrompts.length} 題，再安排批改或對談，避免討論時卡在還沒想清楚的欄位。`
        : `${gapsByTask.length} 個任務仍有未完成欄位（${taskSummary}）。建議優先請學員補齊「${worstTask.title}」——這裡留白最多，很可能是卡住的地方；同一格反覆留白超過一次，建議直接安排 15 分鐘一對一釐清，而不是持續等學員自己想通。`,
  });

  items.push({
    label: "待補欄位（依任務）",
    value: gapsByTask.map((gap) => `${gap.title}：${gap.missingPrompts.slice(0, 4).join("、")}${gap.missingPrompts.length > 4 ? `…（共 ${gap.missingPrompts.length} 題）` : ""}`).join("\n"),
  });

  return items;
}

export function buildStageBlueprint(stageTitle: string, tasks: TaskWithFields[], answers: Record<string, AnswerValue>, labels: Record<string, string> = {}): BlueprintSection[] {
  const taskSections = tasks
    .map((task) => ({
      title: task.title,
      items: task.fields.map((field) => ({ label: field.prompt, value: answerText(answers[field.key], labels) || "尚未填寫" })),
    }))
    .filter((section) => section.items.length > 0);

  return taskSections.concat([{ title: `${stageTitle}｜顧問建議摘要`, items: buildAdvisorInsights(stageTitle, tasks, answers) }]);
}
