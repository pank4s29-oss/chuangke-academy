import type { AssignmentField, AssignmentOption, TaskWithFields } from "./taskSections";

export type QuestionOverride = {
  stage_key: string;
  task_key: string;
  field_key: string;
  prompt?: string | null;
  description?: string | null;
  options?: AssignmentOption[] | null;
  field_type?: "checkboxes" | "single_choice" | "text" | "textarea" | null;
  multiple?: boolean | null;
  sort_order?: number | null;
};

/** Applies only learner-facing copy. Stable field keys and branching metadata remain untouched. */
export function applyQuestionOverrides(tasks: TaskWithFields[], overrides: QuestionOverride[]) {
  const byField = new Map(overrides.map((item) => [item.field_key, item]));
  return tasks.map((task) => ({
    ...task,
    fields: task.fields.map((field: AssignmentField, originalIndex) => {
      const override = byField.get(field.key);
      if (!override) return field;
      return {
        ...field,
        ...(override.prompt != null ? { prompt: override.prompt } : {}),
        ...(override.description != null ? { description: override.description } : {}),
        ...(override.options != null ? { options: override.options } : {}),
        ...(override.field_type === "checkboxes" ? { type: "checkboxes" as const, multiple: true } : {}),
        ...(override.field_type === "single_choice" ? { type: "checkboxes" as const, multiple: false } : {}),
        ...(override.field_type === "text" ? { type: "text" as const, multiple: undefined } : {}),
        ...(override.field_type === "textarea" ? { type: "textarea" as const, multiple: undefined } : {}),
        ...((override.multiple != null && (override.field_type === "checkboxes" || override.field_type === "single_choice")) ? { multiple: override.multiple } : {}),
        __sortOrder: override.sort_order ?? originalIndex,
      };
    }).sort((a, b) => ((a as AssignmentField & { __sortOrder?: number }).__sortOrder ?? task.fields.indexOf(a)) - ((b as AssignmentField & { __sortOrder?: number }).__sortOrder ?? task.fields.indexOf(b))),
  }));
}
