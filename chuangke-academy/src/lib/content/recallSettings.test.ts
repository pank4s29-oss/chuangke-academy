import { describe, expect, it } from "vitest";
import { applyRecallConfigAnswers, buildRecallConfigMap } from "./recallSettings";

describe("recall settings", () => {
  it("supports multiple targets and fills only empty answers", () => {
    const settings = [{ stage_key: "stage-02", task_key: "stage-02-2-1", field_key: "target", enabled: true }];
    const targets = [
      { stage_key: "stage-02", task_key: "stage-02-2-1", field_key: "target", target_stage_key: "stage-01", target_task_key: "stage-01-1", target_field_key: "source-a", position: 0 },
      { stage_key: "stage-02", task_key: "stage-02-2-1", field_key: "target", target_stage_key: "stage-01", target_task_key: "stage-01-1", target_field_key: "source-b", position: 1 },
    ];
    const map = buildRecallConfigMap(settings, targets);
    const result = applyRecallConfigAnswers(map, { "stage-01": { "source-a": "已保存答案 A", "source-b": "答案 B" } }, {});
    expect(map.target.targets).toHaveLength(2);
    expect(result.answers.target).toBe("已保存答案 A");
    expect(result.count).toBe(1);
  });

  it("does not fill when the teacher disables recall or learner already answered", () => {
    const map = buildRecallConfigMap([{ stage_key: "stage-02", task_key: "task", field_key: "target", enabled: false }], [{ stage_key: "stage-02", task_key: "task", field_key: "target", target_stage_key: "stage-01", target_task_key: "source-task", target_field_key: "source", position: 0 }]);
    expect(applyRecallConfigAnswers(map, { "stage-01": { source: "old" } }, { target: "new" }).answers.target).toBe("new");
    expect(applyRecallConfigAnswers(map, { "stage-01": { source: "old" } }, {}).count).toBe(0);
  });
});
