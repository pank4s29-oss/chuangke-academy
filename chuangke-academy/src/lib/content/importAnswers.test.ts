import { describe, expect, it } from "vitest";
import { extractImportedAnswers } from "./importAnswers";
import { getAssignmentFields } from "./taskSections";

describe("teacher assignment import", () => {
  it("maps checked options and inline other text", () => {
    const fields = getAssignmentFields("你目前的狀態\n☐ A. 已完成\n☐ 其他：____", "task");
    const other = fields.find((field) => field.hiddenInGroup);
    const source = "你目前的狀態\n☑ A. 已完成\n☑ 其他：目前正在測試";
    const answers = extractImportedAnswers(source, fields);
    expect(answers[fields[0].key]).toEqual([fields[0].options?.[0].key, fields[0].options?.[1].key]);
    expect(other).toBeDefined();
    expect(answers[other!.key]).toBe("目前正在測試");
  });

  it("maps a filled table cell to its field", () => {
    const fields = getAssignmentFields("| 項目 | 原話 |\n|---|---|\n| 1 | ＿＿＿＿ |", "task");
    const answers = extractImportedAnswers("| 項目 | 原話 |\n|---|---|\n| 1 | 我希望更快完成 |", fields);
    expect(answers[fields[0].key]).toBe("我希望更快完成");
  });
});
