import { reverseTemplate } from "./derive";
import type { FlowSpec } from "./schema";
import type { AnswerValue, FlowState } from "./types";

export function setAnswer(state: FlowState, key: string, value: AnswerValue): FlowState {
  return { ...state, answers: { ...state.answers, [key]: value } };
}

/**
 * Learner typed into an auto-composed sentence.
 * - If a spec is given and the text still follows the sentence pattern, the slots are written back to the
 *   source answers (two-way sync) and the sentence stays auto-composed — so every place that reuses those
 *   answers updates too.
 * - Otherwise it is a free manual edit: lock it (P-04). Clearing the field unlocks it again.
 */
export function editDerived(state: FlowState, key: string, text: string, spec?: FlowSpec): FlowState {
  if (text.trim() === "") return regenerate(state, key);
  const slots = spec ? reverseTemplate(spec, key, text) : null;
  if (slots) {
    const base = regenerate(state, key);
    const answers = { ...base.answers };
    for (const [k, v] of Object.entries(slots)) { if (v === "") delete answers[k]; else answers[k] = v; }
    return { ...base, answers };
  }
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
