export type QuestionType = "text" | "textarea" | "number" | "single_select" | "multi_select" | "checkbox" | "matrix";
export type Rule = { type: "required" | "min_length" | "selected_count"; value?: number; message: string };
export type Question = { key: string; label: string; type: QuestionType; required?: boolean; rules?: Rule[] };
export type Step = { key: string; title: string; learning: string[]; questions: Question[] };
export type Task = { key: string; title: string; steps: Step[] };
export type Stage = { key: string; title: string; summary: string; tasks: Task[] };
export type Course = { key: string; title: string; stages: Stage[] };
