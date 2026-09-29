import type { AnswerValue, FlowState } from "./types";

export function setAnswer(state: FlowState, key: string, value: AnswerValue): FlowState {
  return { ...state, answers: { ...state.answers, [key]: value } };
}

/** Learner typed into an auto-composed sentence: lock it (P-04). Clearing the field unlocks it again. */
export function editDerived(state: FlowState, key: string, text: string): FlowState {
  if (text.trim() === "") return regenerate(state, key);
  return { answers: { ...state.answers, [key]: text }, edited: state.edited.includes(key) ? state.edited : [...state.edited, key] };
}

/** 「照選項重新組合」. */
export function regenerate(state: FlowState, key: string): FlowState {
  const { [key]: _drop, ...rest } = state.answers;
  void _drop;
  return { answers: rest, edited: state.edited.filter((k) => k !== key) };
}

export function toggleMulti(current: string[], id: string, max?: number): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (max && current.length >= max) return current;
  return [...current, id];
}
