import type { SavedAnswersByStage, RecallAnswers } from "./recall";

export type RecallSetting = {
  stage_key: string;
  task_key: string;
  field_key: string;
  enabled: boolean;
  updated_by?: string;
  updated_at?: string;
};

export type RecallTargetRow = {
  stage_key: string;
  task_key: string;
  field_key: string;
  target_stage_key: string;
  target_task_key: string;
  target_field_key: string;
  position: number;
  updated_by?: string;
  updated_at?: string;
};

export type RecallConfig = { enabled: boolean; targets: RecallTargetRow[] };
export type RecallConfigMap = Record<string, RecallConfig>;

export function buildRecallConfigMap(settings: RecallSetting[], targets: RecallTargetRow[]): RecallConfigMap {
  const map: RecallConfigMap = {};
  settings.forEach((setting) => {
    map[setting.field_key] = { enabled: setting.enabled, targets: [] };
  });
  targets.forEach((target) => {
    const config = map[target.field_key] ?? { enabled: true, targets: [] };
    config.targets.push(target);
    map[target.field_key] = config;
  });
  Object.values(map).forEach((config) => config.targets.sort((a, b) => a.position - b.position));
  return map;
}

function present(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0;
}

/** Fills only empty learner answers from configured target answers. Existing answers always win. */
export function applyRecallConfigAnswers(configs: RecallConfigMap, saved: SavedAnswersByStage, current: RecallAnswers) {
  const next = { ...current };
  let count = 0;
  Object.values(configs).forEach((config) => {
    if (!config.enabled) return;
    config.targets.forEach((target) => {
      if (present(next[target.field_key])) return;
      const value = saved[target.target_stage_key]?.[target.target_field_key];
      if (!present(value)) return;
      next[target.field_key] = value;
      count += 1;
    });
  });
  return { answers: next, count };
}

export function recallConfigKey(stageKey: string, taskKey: string, fieldKey: string) {
  return `${stageKey}:${taskKey}:${fieldKey}`;
}

export type { RecallAnswers, SavedAnswersByStage };
