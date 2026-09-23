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
  is_deleted?: boolean | null;
  is_custom?: boolean | null;
  table_key?: string | null;
  table_title?: string | null;
  table_row?: string | null;
  table_column?: string | null;
};

/** Applies only learner-facing copy. Stable field keys and branching metadata remain untouched. */
export function applyQuestionOverrides(tasks: TaskWithFields[], overrides: QuestionOverride[]) {
  const byField = new Map(overrides.map((item) => [item.field_key, item]));
  const customByTask = new Map<string, QuestionOverride[]>();
  overrides.filter((item) => item.is_custom && !item.is_deleted).forEach((item) => {
    const list = customByTask.get(item.task_key) ?? [];
    list.push(item);
    customByTask.set(item.task_key, list);
  });
  return tasks.map((task) => ({
    ...task,
    fields: [...task.fields, ...(customByTask.get(task.key) ?? []).map((item) => ({
      key: item.field_key,
      prompt: item.prompt ?? "請完成這一題",
      description: item.description ?? undefined,
      type: item.field_type === "checkboxes" || item.field_type === "single_choice" ? "checkboxes" as const : item.field_type === "textarea" ? "textarea" as const : "text" as const,
      options: item.options ?? undefined,
      multiple: item.field_type === "checkboxes" ? true : item.field_type === "single_choice" ? false : undefined,
      required: true,
      group: item.table_key ? (item.table_title ?? "表格作答") : undefined,
      layout: item.table_key ? "table" as const : undefined,
      tableKey: item.table_key ?? undefined,
      tableTitle: item.table_title ?? undefined,
      tableRow: item.table_row ?? undefined,
      tableColumn: item.table_column ?? undefined,
      __sortOrder: item.sort_order ?? task.fields.length,
    } as AssignmentField)),].map((field: AssignmentField, originalIndex) => {
      const override = byField.get(field.key);
      if (override?.is_deleted) return null;
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
        ...(override.table_key != null ? { tableKey: override.table_key } : {}),
        ...(override.table_title != null ? { tableTitle: override.table_title, group: override.table_title } : {}),
        ...(override.table_row != null ? { tableRow: override.table_row } : {}),
        ...(override.table_column != null ? { tableColumn: override.table_column } : {}),
        __sortOrder: override.sort_order ?? originalIndex,
      };
    }).filter((field): field is AssignmentField => Boolean(field)).sort((a, b) => ((a as AssignmentField & { __sortOrder?: number }).__sortOrder ?? task.fields.indexOf(a)) - ((b as AssignmentField & { __sortOrder?: number }).__sortOrder ?? task.fields.indexOf(b))),
  }));
}
