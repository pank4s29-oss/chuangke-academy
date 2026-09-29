export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue | undefined>;
export type FlowState = { answers: Answers; edited: string[] };
export type Part = { text: string; kind: "lit" | "filled" | "blank" };
export type DerivedValue = {
  text: string;
  parts?: Part[];
  list?: string[];
  number?: number;
  tone?: "good" | "bad" | "neutral";
  complete: boolean;
};
export const EMPTY_STATE: FlowState = { answers: {}, edited: [] };
