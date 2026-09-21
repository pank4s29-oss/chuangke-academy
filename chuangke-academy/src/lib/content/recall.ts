import type { TaskWithFields } from "./taskSections";

export type RecallAnswers = Record<string, string | string[]>;
export type SavedAnswersByStage = Record<string, RecallAnswers>;

function valuePresent(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0;
}

function copy(target: RecallAnswers, source: RecallAnswers, targetKey: string, sourceKeys: string[]) {
  if (valuePresent(target[targetKey])) return false;
  const values = sourceKeys.map((key) => source[key]).filter(valuePresent);
  if (!values.length) return false;
  target[targetKey] = values.length === 1 ? values[0] : values.map((value) => Array.isArray(value) ? value.join("、") : String(value));
  return true;
}

/**
 * Build conservative defaults for fields that explicitly tell the learner to
 * copy an answer from an earlier task/stage. Existing answers always win, so
 * recall is a starting point rather than an overwrite.
 */
export function buildRecallAnswers(stageKey: string, tasks: TaskWithFields[], saved: SavedAnswersByStage, current: RecallAnswers) {
  const next = { ...current };
  let count = 0;
  const stage1 = saved["stage-01"] ?? {};
  const stage2 = saved["stage-02"] ?? {};

  if (stageKey === "stage-01") {
    const pairs: Array<[string, string[]]> = [
      ["stage-01-4-answer-0", ["stage-01-1-answer-3"]],
      ["stage-01-4-answer-18", ["stage-01-1-answer-3"]],
      ["stage-01-附錄-answer-0", ["stage-01-1-answer-3"]],
      ["stage-01-附錄-answer-1", ["stage-01-1-answer-11"]],
      ["stage-01-附錄-answer-2", ["stage-01-1-answer-14", "stage-01-1-answer-15", "stage-01-1-answer-16"]],
      ["stage-01-附錄-answer-3", ["stage-01-2-answer-20"]],
      ["stage-01-附錄-answer-4", ["stage-01-4-answer-12"]],
      ["stage-01-附錄-answer-5", ["stage-01-4-answer-15"]],
      ["stage-01-附錄-answer-6", ["stage-01-5-answer-0"]],
    ];
    pairs.forEach(([target, sources]) => { if (copy(next, stage1, target, sources)) count += 1; });
  }

  if (stageKey === "stage-02") {
    const pairs: Array<[string, string[]]> = [
      ["stage-02-2-1-answer-1", ["stage-01-1-answer-10"]],
      ["stage-02-2-1-answer-4", ["stage-01-2-answer-20"]],
      ["stage-02-2-2-answer-1", ["stage-01-1-answer-3"]],
      ["stage-02-2-3-answer-13", ["stage-02-2-2-answer-1"]],
      ["stage-02-2-3-answer-18", ["stage-02-2-1-answer-30"]],
      ["stage-02-2-4-answer-17", ["stage-01-4-answer-12"]],
      ["stage-02-2-4-answer-19", ["stage-01-4-answer-12"]],
      ["stage-02-2-5-answer-12", ["stage-02-2-4-answer-14"]],
      ["stage-02-2-5-answer-31", ["stage-02-2-4-answer-13"]],
      ["stage-02-附錄-answer-0", ["stage-02-2-1-answer-30"]],
      ["stage-02-附錄-answer-1", ["stage-02-2-2-answer-1"]],
      ["stage-02-附錄-answer-5", ["stage-02-2-3-answer-25"]],
      ["stage-02-附錄-answer-6", ["stage-02-2-4-answer-14", "stage-02-2-4-answer-15"]],
      ["stage-02-附錄-answer-7", ["stage-02-2-5-answer-34"]],
    ];
    pairs.forEach(([target, sources]) => { if (copy(next, stage2, target, sources) || copy(next, stage1, target, sources)) count += 1; });

    // The 2.1 competitor and gap tables intentionally mirror stage 1's
    // tables. Pair by their ordered table blocks, not by row number alone.
    for (let offset = 0; offset < 15; offset += 1) {
      if (copy(next, stage1, `stage-02-2-1-answer-${11 + offset}`, [`stage-01-2-answer-${22 + offset}`])) count += 1;
    }
  }

  return { answers: next, count };
}
