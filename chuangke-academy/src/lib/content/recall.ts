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

/** Like `copy`, but for mutually-exclusive alternatives where `sourceKeys` is
 *  an *ordered preference*, not a set to merge: use the first key that has a
 *  value and ignore the rest, even when more than one happens to be filled
 *  in. `copy` instead bundles every non-empty source together, which is
 *  right when a question is genuinely built from several answers (e.g. the
 *  three sentence-template blanks that make up a summary line) but wrong
 *  here — 2.2-A's two persona boxes ("人選 1"/"人選 2") can *both* legitimately
 *  hold text at once (the instructions say to keep the one not drawn "放在
 *  旁邊留著" for later), so bundling them together into one answer would
 *  glue two unrelated sentences into a single field. */
function copyPreferred(target: RecallAnswers, source: RecallAnswers, targetKey: string, sourceKeys: string[]) {
  if (valuePresent(target[targetKey])) return false;
  const value = sourceKeys.map((key) => source[key]).find(valuePresent);
  if (value === undefined) return false;
  target[targetKey] = value;
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
    // 2.2-A lets the learner draw either "人選 1"（抄 1.1-A）or, if they
    // checked D back in 1.2-E, "人選 2"（抄 1.2-E 的 D 項）— see the "二選一"
    // checkbox at stage-02-2-2-answer-3. Later fields that say "2.2-A 開頭你
    // 選定的那個人" (e.g. 2.3-B's first blank) must follow *that* choice
    // instead of always assuming 人選 1, or a learner who picked 人選 2 gets
    // the wrong sentence recalled.
    const personaChoice = stage2["stage-02-2-2-answer-3"];
    const choseSecondPersona = Array.isArray(personaChoice) ? personaChoice.includes("stage-02-2-2-option-3-1") : personaChoice === "stage-02-2-2-option-3-1";
    const personaSources = choseSecondPersona ? ["stage-02-2-2-answer-2", "stage-02-2-2-answer-1"] : ["stage-02-2-2-answer-1", "stage-02-2-2-answer-2"];
    if (copyPreferred(next, stage2, "stage-02-2-3-answer-13", personaSources)) count += 1;

    const pairs: Array<[string, string[]]> = [
      ["stage-02-2-1-answer-1", ["stage-01-1-answer-10"]],
      ["stage-02-2-1-answer-4", ["stage-01-2-answer-20"]],
      ["stage-02-2-2-answer-1", ["stage-01-1-answer-3"]],
      ["stage-02-2-4-answer-19", ["stage-01-4-answer-12"]],
      ["stage-02-2-5-answer-12", ["stage-02-2-4-answer-14"]],
      ["stage-02-2-5-answer-31", ["stage-02-2-4-answer-13"]],
      ["stage-02-附錄-answer-0", ["stage-02-2-1-answer-30"]],
      // The appendix asks for the selected person's name and profile, not the
      // earlier "person 1" setup sentence. Combine the three fields from the
      // actual 2.2-A first portrait box when they have been filled.
      ["stage-02-附錄-answer-1", ["stage-02-2-2-answer-7", "stage-02-2-2-answer-8", "stage-02-2-2-answer-9"]],
      ["stage-02-附錄-answer-5", ["stage-02-2-3-answer-25"]],
      ["stage-02-附錄-answer-6", ["stage-02-2-4-answer-14", "stage-02-2-4-answer-15"]],
      ["stage-02-附錄-answer-7", ["stage-02-2-5-answer-34"]],
    ];
    pairs.forEach(([target, sources]) => { if (copy(next, stage2, target, sources) || copy(next, stage1, target, sources)) count += 1; });

    // 2.1-B's competitor table (賣給誰／主打什麼／價格帶／承諾什麼／最大弱點 —
    // 5 columns × 3 competitors, answer-11..25) does *not* line up cell-for-
    // cell with stage 1's competitor research: 1.2-B only recorded 3 columns
    // per competitor (名稱／刊登多久／他在賣什麼, answer-22..30) and 1.2-C
    // recorded a further 2 (哪裡不夠好／我可以怎麼做得比他好, answer-31..36).
    // A single sequential offset across both tables — as this used to do —
    // walks row-by-row through one table and then the other, while 2.1-B's
    // columns are laid out competitor-by-competitor; the two orders don't
    // match, so most of the 15 cells landed in the wrong column (e.g.
    // "價格帶" was getting filled with stage 1's "刊登多久"). Only two
    // columns actually have a stage-1 equivalent to recall — 主打什麼 and
    // 最大弱點 — so only those are auto-filled; 賣給誰／價格帶／承諾什麼 are
    // new research for stage 2 and are left for the learner to fill in.
    for (let row = 0; row < 3; row += 1) {
      if (copy(next, stage1, `stage-02-2-1-answer-${12 + row * 5}`, [`stage-01-2-answer-${24 + row * 3}`])) count += 1; // 主打什麼
      if (copy(next, stage1, `stage-02-2-1-answer-${15 + row * 5}`, [`stage-01-2-answer-${31 + row * 2}`])) count += 1; // 最大弱點 ← 哪裡不夠好
    }
  }

  return { answers: next, count };
}
