import type { AssignmentField } from "./taskSections";
type AnswerValue = string | string[] | undefined;

export type CompositionResult = { answers: Record<string, AnswerValue>; generated: string[] };

function text(value: AnswerValue | undefined) {
  return Array.isArray(value) ? value.join("、") : String(value ?? "").trim();
}

function optionText(field: AssignmentField | undefined, value: AnswerValue | undefined, labels: Record<string, string> = {}) {
  if (!field) return text(value);
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => {
    const raw = String(item);
    if (labels[raw]) return labels[raw];
    const exact = field.options?.find((option) => option.key === raw);
    if (exact) return exact.label;
    // Old drafts sometimes contain the positional option key even when the
    // field's option list was edited later: answer-N -> option-N-index.
    const fieldNumber = field.key.match(/-answer-(\d+)$/)?.[1];
    const optionIndex = raw.match(new RegExp(`-option-${fieldNumber ?? "\\d+"}-(\\d+)$`))?.[1];
    const byPosition = optionIndex === undefined ? undefined : field.options?.[Number(optionIndex)];
    return byPosition?.label ?? raw;
  }).filter(Boolean).join("、");
}

function put(out: Record<string, AnswerValue>, generated: string[], key: string, value: string, preserveKey?: string) {
  if (key === preserveKey) return;
  out[key] = value;
  generated.push(key);
}

/**
 * Compose the sentence-shaped legacy fields while the learner is answering.
 * The rules intentionally key off stable source field positions and sentence
 * wording, so teacher-edited prompts do not break the important Stage 1 flow.
 */
export function composeLegacyAnswers(fields: AssignmentField[], answers: Record<string, AnswerValue>, preserveKey?: string): CompositionResult {
  const out = { ...answers };
  const generated: string[] = [];
  const position = (field: AssignmentField) => Number(field.key.match(/-answer-(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
  const stage = fields.find((field) => field.key === "stage-01-1-answer-0");
  const identity = fields.find((field) => field.key === "stage-01-1-answer-2");
  const sentence = fields.find((field) => field.key === "stage-01-1-answer-3");
  if (stage && identity && sentence) {
    const state = optionText(stage, answers[stage.key]);
    const person = text(answers[identity.key]);
    put(out, generated, sentence.key, state || person ? `我服務的是【${state}】的【${person}】。` : "", preserveKey);
  }

  // "把三格串起來" — preserve the labels selected in the three preceding
  // choice fields, including any custom "其他" text.
  const quote = fields.find((field) => /把三格串起來/.test(field.prompt) || /把三格串起來/.test(field.description ?? ""));
  if (quote) {
    const preceding = fields.filter((field) => position(field) < position(quote) && field.type === "checkboxes").slice(-3);
    if (preceding.length === 3) {
      const parts = preceding.map((field) => optionText(field, answers[field.key])).filter(Boolean);
      put(out, generated, quote.key, parts.length ? `${parts.join("，")}。` : "", preserveKey);
    }
  }

  return { answers: out, generated };
}
