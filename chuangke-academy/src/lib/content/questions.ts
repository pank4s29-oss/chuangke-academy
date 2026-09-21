import type { AssignmentField } from "./taskSections";

export type CanonicalQuestionType = "short_text" | "long_text" | "single_choice" | "multi_choice";
export type CanonicalQuestion = {
  id: string;
  label: string;
  /** Short helper text shown under the label — e.g. the original fill-in-
   *  the-blank sentence template ("我服務的是____的____。") — so the student
   *  sees exactly what shape of answer is expected without the label itself
   *  having to spell that out and become unwieldy. */
  description?: string;
  type: CanonicalQuestionType;
  options?: { id: string; label: string; otherInputKey?: string }[];
  required: boolean;
  source: "structured" | "legacy" | "table";
  group?: string;
};

export function normalizeAssignmentMarkdown(source: string) {
  let blankIndex = 0;
  return source.split(/\r?\n/).map((line) => {
    const checkboxLine = line.replace(/^(\s*)(?:[-*]\s*)?☐\s+/, "$1- [ ] ");
    if (checkboxLine !== line) return checkboxLine;
    return line.replace(/＿＿+|_{4,}/g, () => `{{blank:auto-${blankIndex++}}}`);
  }).join("\n");
}

export function fieldsToCanonical(fields: AssignmentField[]): CanonicalQuestion[] {
  return fields.map((field) => ({
    id: field.key,
    label: field.prompt,
    description: field.description,
    type: field.type === "checkboxes" ? (field.multiple ? "multi_choice" : "single_choice") : field.type === "textarea" ? "long_text" : "short_text",
    options: field.options?.map((option) => ({ id: option.key, label: option.label, otherInputKey: option.otherInputKey })),
    required: true,
    source: field.group?.includes("表格") ? "table" : "legacy",
    group: field.group,
  }));
}

export function answerDisplay(question: CanonicalQuestion, value: unknown) {
  const labels = new Map((question.options ?? []).map((option) => [option.id, option.label]));
  if (Array.isArray(value)) return value.map((item) => labels.get(String(item)) ?? String(item)).join("、");
  return labels.get(String(value)) ?? String(value ?? "");
}
