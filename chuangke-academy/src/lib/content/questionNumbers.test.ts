import { describe, expect, it } from "vitest";
import { getQuestionNumbers } from "./questionNumbers";
import { readStageTasks } from "./taskSections";

describe("作業顯示題號", () => {
  it("uses one number for every table block instead of every cell", () => {
    const task = readStageTasks("stage-01").find((item) => item.key === "stage-01-2")!;
    const numbers = getQuestionNumbers(task.fields);
    const tableFields = task.fields.filter((field) => field.layout === "table");
    const groups = [...new Set(tableFields.map((field) => field.group))];
    expect(groups.length).toBeGreaterThan(1);
    groups.forEach((group) => {
      const values = [...new Set(tableFields.filter((field) => field.group === group).map((field) => numbers[field.key]))];
      expect(values).toHaveLength(1);
    });
    expect(numbers[tableFields[0].key]).toBeLessThan(numbers[tableFields[tableFields.length - 1].key]);
  });

  it("provides the actual task number used by completion links", () => {
    const task = readStageTasks("stage-01").find((item) => item.key === "stage-01-1")!;
    const numbers = getQuestionNumbers(task.fields);
    expect(numbers["stage-01-1-answer-3"]).toBe(4);
    expect(numbers["stage-01-1-answer-11"]).toBe(10);
    expect(numbers["stage-01-1-answer-14"]).toBe(13);
  });
});
