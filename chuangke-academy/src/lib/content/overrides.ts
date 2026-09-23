import type { AssignmentField, AssignmentOption, TaskWithFields } from "./taskSections";

export type QuestionOverride = {
  stage_key: string;
  task_key: string;
  field_key: string;
  prompt?: string | null;
  description?: string | null;
  options?: AssignmentOption[] | null;
};

/** Applies only learner-facing copy. Stable field keys and branching metadata remain untouched. */
export function applyQuestionOverrides(tasks: TaskWithFields[], overrides: QuestionOverride[]) {
  const byField = new Map(overrides.map((item) => [item.field_key, item]));
  return tasks.map((task) => ({
    ...task,
    fields: task.fields.map((field: AssignmentField) => {
      const override = byField.get(field.key);
      if (!override) return field;
      return {
        ...field,
        ...(override.prompt != null ? { prompt: override.prompt } : {}),
        ...(override.description != null ? { description: override.description } : {}),
        ...(override.options != null ? { options: override.options } : {}),
      };
    }),
  }));
}
