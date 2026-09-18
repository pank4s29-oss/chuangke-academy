import type { TaskWithFields } from "./taskSections";

export type AnswerValue = string | string[] | undefined;
export type BlueprintSection = { title: string; items: { label: string; value: string }[] };

export function answerText(value: AnswerValue, labels: Record<string, string> = {}) {
  if (Array.isArray(value)) return value.map((item) => labels[item] ?? item).join("、");
  return String(value ?? "").trim();
}

export function buildStageBlueprint(stageTitle: string, tasks: TaskWithFields[], answers: Record<string, AnswerValue>, labels: Record<string, string> = {}): BlueprintSection[] {
  return tasks.map((task) => ({
    title: task.title,
    items: task.fields.map((field) => ({ label: field.prompt, value: answerText(answers[field.key], labels) || "尚未填寫" })),
  })).filter((section) => section.items.length > 0).concat([{ title: `${stageTitle}｜顧問快速摘要`, items: [{ label: "使用方式", value: "以各任務的作答欄位為主；教師可依此摘要快速進入原題批改。" }] }]);
}
