import { describe, expect, it } from "vitest";
import { applyQuestionOverrides, type QuestionOverride } from "./overrides";
import type { TaskWithFields } from "./taskSections";

const tasks: TaskWithFields[] = [{
  key: "stage-01-1",
  title: "任務 1",
  lecture: "",
  assignment: "",
  fields: [
    { key: "stage-01-1-answer-0", prompt: "原始題目", type: "text", required: true },
    { key: "stage-01-1-answer-1", prompt: "要刪除的題目", type: "text", required: true },
  ],
}];

describe("applyQuestionOverrides", () => {
  it("can add a custom question and keep it sorted with source fields", () => {
    const overrides: QuestionOverride[] = [{
      stage_key: "stage-01", task_key: "stage-01-1", field_key: "stage-01-1-custom-1",
      prompt: "教師新增題目", field_type: "textarea", is_custom: true, sort_order: 1,
    }];
    const result = applyQuestionOverrides(tasks, overrides)[0].fields;
    expect(result.map((field) => field.key)).toEqual(["stage-01-1-answer-0", "stage-01-1-answer-1", "stage-01-1-custom-1"]);
    expect(result[2].type).toBe("textarea");
  });

  it("soft-deletes a source question without changing the other stable fields", () => {
    const overrides: QuestionOverride[] = [{
      stage_key: "stage-01", task_key: "stage-01-1", field_key: "stage-01-1-answer-1",
      is_deleted: true,
    }];
    const result = applyQuestionOverrides(tasks, overrides)[0].fields;
    expect(result.map((field) => field.key)).toEqual(["stage-01-1-answer-0"]);
  });

  it("applies a teacher-edited table title to every field in the table", () => {
    const tableTasks: TaskWithFields[] = [{ ...tasks[0], fields: [
      { key: "table-0", prompt: "列 1｜欄 A", type: "text", required: true, layout: "table", tableKey: "table-a", tableTitle: "原標題", tableRow: "列 1", tableColumn: "欄 A" },
      { key: "table-1", prompt: "列 2｜欄 A", type: "text", required: true, layout: "table", tableKey: "table-a", tableTitle: "原標題", tableRow: "列 2", tableColumn: "欄 A" },
    ] }];
    const overrides: QuestionOverride[] = [{ stage_key: "stage-01", task_key: "stage-01-1", field_key: "table-0", table_key: "table-a", table_title: "教師改過的表格標題" }];
    const result = applyQuestionOverrides(tableTasks, overrides)[0].fields;
    expect(result[0].tableTitle).toBe("教師改過的表格標題");
    expect(result[0].group).toBe("教師改過的表格標題");
    expect(result[1].tableTitle).toBe("教師改過的表格標題");
    expect(result[1].group).toBe("教師改過的表格標題");
  });
});
